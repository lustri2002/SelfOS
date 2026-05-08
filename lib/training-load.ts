/**
 * Training Load: Edwards TRIMP + CTL/ATL/TSB + ACWR.
 *
 * - TRIMP (Training Impulse) quantifica il carico di una singola seduta.
 *   Priorita' per il calcolo:
 *     1) Edwards TRIMP dalle zone FC (piu' accurato): sum(min_in_zone × zone_weight 1..5)
 *     2) HR-based: durata × zone_weight stimata da avg_hr / max_hr
 *     3) Durata-only (fallback conservativo: trattato come easy, weight=1)
 *
 * - CTL (Chronic Training Load) = media mobile esponenziale a 42 giorni del TRIMP.
 *   Indica la FITNESS di base. Formula: CTL_t = CTL_{t-1} + (TRIMP_t - CTL_{t-1}) / 42.
 *
 * - ATL (Acute Training Load) = media mobile esponenziale a 7 giorni. Indica FATICA.
 *   Formula: ATL_t = ATL_{t-1} + (TRIMP_t - ATL_{t-1}) / 7.
 *
 * - TSB (Training Stress Balance) = CTL - ATL. Indica FORMA:
 *     > +15  picco di forma (possibile gara)
 *     +5..+15 freschezza
 *     -10..+5 neutro
 *     -25..-10 affaticamento
 *     < -25  overreaching / rischio
 *
 * - ACWR (Acute:Chronic Workload Ratio) = ATL / CTL. Indica RISCHIO INFORTUNIO:
 *     < 0.8   sottoallenamento
 *     0.8-1.3 sweet spot (ottimale)
 *     1.3-1.5 cautela
 *     > 1.5   rischio alto (Gabbett et al.)
 *
 * Le funzioni sono pure: nessun IO, facile da testare e usare sia lato server (route
 * Coach/Review) che lato client (dashboard).
 */

export interface WorkoutLike {
  date: string;                 // YYYY-MM-DD
  duration_minutes?: number | string | null;
  avg_heart_rate?: number | string | null;
  max_heart_rate?: number | string | null;
  hr_zones?: {
    leggera?: number | null;
    intensiva?: number | null;
    aerobica?: number | null;
    anaerobica?: number | null;
    vo2max?: number | null;
  } | null;
}

export interface LoadPoint {
  date: string;
  trimp: number;
  ctl: number;
  atl: number;
  tsb: number;
  acwr: number | null;
  had_workout: boolean;
}

export type FormState =
  | "peak"          // TSB alto e CTL solido
  | "fresh"         // TSB positivo
  | "neutral"       // TSB vicino a 0
  | "fatigued"      // TSB negativo
  | "overreaching"; // TSB molto negativo

export type InjuryRisk =
  | "undertraining"
  | "optimal"
  | "caution"
  | "high_risk"
  | "unknown";

export interface LoadSummary {
  ctl: number;
  atl: number;
  tsb: number;
  acwr: number | null;
  form: FormState;
  risk: InjuryRisk;
  workouts_in_series: number;
  /**
   * true se lo storico coperto e' < 42 giorni (CTL non ancora stabile).
   * Usare con cautela: i valori sono indicativi finche' si accumula base.
   */
  warmup: boolean;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Calcola il TRIMP di un singolo allenamento usando la gerarchia di fallback. */
export function computeTrimp(w: WorkoutLike, maxHrHint: number | null = null): number {
  // 1) Edwards TRIMP dalle zone FC.
  const z = w.hr_zones;
  if (z && typeof z === "object") {
    const leggera = num(z.leggera) ?? 0;
    const intensiva = num(z.intensiva) ?? 0;
    const aerobica = num(z.aerobica) ?? 0;
    const anaerobica = num(z.anaerobica) ?? 0;
    const vo2max = num(z.vo2max) ?? 0;
    const sum =
      (leggera / 60) * 1 +
      (intensiva / 60) * 2 +
      (aerobica / 60) * 3 +
      (anaerobica / 60) * 4 +
      (vo2max / 60) * 5;
    if (sum > 0) return Math.round(sum * 10) / 10;
  }

  // 2) HR-based da avg_hr.
  const duration = num(w.duration_minutes) ?? 0;
  if (duration <= 0) return 0;

  const avgHr = num(w.avg_heart_rate);
  if (avgHr != null && avgHr > 0) {
    const maxHr = num(w.max_heart_rate) ?? maxHrHint ?? 190;
    const pct = Math.max(0, Math.min(1, avgHr / maxHr));
    const zoneWeight =
      pct < 0.6 ? 1 : pct < 0.7 ? 2 : pct < 0.8 ? 3 : pct < 0.9 ? 4 : 5;
    return Math.round(duration * zoneWeight * 10) / 10;
  }

  // 3) Durata-only (treat as easy).
  return Math.round(duration * 1 * 10) / 10;
}

/** YYYY-MM-DD dalla data locale (no UTC shift). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Genera la serie giornaliera di load da `fromDate` a `toDate` inclusi.
 * Gli allenamenti sono indicizzati per data; i giorni senza workout hanno TRIMP=0
 * ma CTL/ATL continuano a decadere esponenzialmente.
 */
export function computeLoadSeries(
  workouts: WorkoutLike[],
  fromDate: Date,
  toDate: Date,
): LoadPoint[] {
  // Hint per la max HR: maggior max_hr osservata storicamente.
  const maxHrHint = workouts.reduce((m, w) => {
    const v = num(w.max_heart_rate);
    return v != null && v > m ? v : m;
  }, 0) || null;

  // TRIMP per data (sommiamo se ci sono 2 sedute nello stesso giorno).
  const trimpByDate = new Map<string, number>();
  for (const w of workouts) {
    if (!w.date) continue;
    const trimp = computeTrimp(w, maxHrHint);
    trimpByDate.set(w.date, (trimpByDate.get(w.date) ?? 0) + trimp);
  }

  const series: LoadPoint[] = [];
  let ctl = 0;
  let atl = 0;
  const day = new Date(fromDate);
  day.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  while (day.getTime() <= end.getTime()) {
    const iso = toIsoDate(day);
    const trimp = trimpByDate.get(iso) ?? 0;
    ctl = ctl + (trimp - ctl) / 42;
    atl = atl + (trimp - atl) / 7;
    const tsb = ctl - atl;
    const acwr = ctl > 0.5 ? atl / ctl : null;
    series.push({
      date: iso,
      trimp: Math.round(trimp * 10) / 10,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      acwr: acwr != null ? Math.round(acwr * 100) / 100 : null,
      had_workout: trimpByDate.has(iso),
    });
    day.setDate(day.getDate() + 1);
  }

  return series;
}

function classifyForm(tsb: number, ctl: number): FormState {
  // Se la base e' troppo bassa, la "forma" non e' ancora un concetto utile.
  if (ctl < 10) return "neutral";
  if (tsb > 15) return "peak";
  if (tsb > 5) return "fresh";
  if (tsb > -10) return "neutral";
  if (tsb > -25) return "fatigued";
  return "overreaching";
}

function classifyRisk(acwr: number | null, ctl: number): InjuryRisk {
  if (acwr == null || ctl < 5) return "unknown";
  if (acwr < 0.8) return "undertraining";
  if (acwr <= 1.3) return "optimal";
  if (acwr <= 1.5) return "caution";
  return "high_risk";
}

/** Riepiloga la serie: stato di forma, rischio, flag warmup. */
export function summarizeLoad(series: LoadPoint[]): LoadSummary {
  const last = series[series.length - 1];
  if (!last) {
    return {
      ctl: 0, atl: 0, tsb: 0, acwr: null,
      form: "neutral", risk: "unknown",
      workouts_in_series: 0, warmup: true,
    };
  }
  const workoutDays = series.filter((s) => s.had_workout).length;
  // Warmup: servono ~42gg di storico per stabilizzare CTL.
  const warmup = series.length < 42;
  return {
    ctl: last.ctl,
    atl: last.atl,
    tsb: last.tsb,
    acwr: last.acwr,
    form: classifyForm(last.tsb, last.ctl),
    risk: classifyRisk(last.acwr, last.ctl),
    workouts_in_series: workoutDays,
    warmup,
  };
}

/** Etichette IT per la UI e i prompt AI. */
export const FORM_LABELS: Record<FormState, string> = {
  peak: "Picco di forma",
  fresh: "Fresco",
  neutral: "Neutro",
  fatigued: "Affaticato",
  overreaching: "Overreaching",
};

export const RISK_LABELS: Record<InjuryRisk, string> = {
  undertraining: "Sotto-allenamento",
  optimal: "Ottimale",
  caution: "Cautela",
  high_risk: "Rischio alto",
  unknown: "Dati insufficienti",
};

/** Etichetta + colore semantico per la UI. */
export function formColor(form: FormState): string {
  switch (form) {
    case "peak": return "text-emerald-400";
    case "fresh": return "text-emerald-300";
    case "neutral": return "text-[var(--sb-muted)]";
    case "fatigued": return "text-amber-400";
    case "overreaching": return "text-red-400";
  }
}

export function riskColor(risk: InjuryRisk): string {
  switch (risk) {
    case "optimal": return "text-emerald-400";
    case "undertraining": return "text-blue-400";
    case "caution": return "text-amber-400";
    case "high_risk": return "text-red-400";
    case "unknown": return "text-[var(--sb-muted)]";
  }
}

/**
 * Blocco testuale compatto da iniettare nei prompt AI (Coach / Review).
 * Mantiene solo numeri e categorie, niente fluff.
 */
export function formatLoadForPrompt(s: LoadSummary): string {
  if (s.workouts_in_series === 0) return "";
  const lines = [
    `- Fitness (CTL 42gg): ${s.ctl}`,
    `- Fatica (ATL 7gg): ${s.atl}`,
    `- Forma (TSB = CTL - ATL): ${s.tsb} (${FORM_LABELS[s.form]})`,
  ];
  if (s.acwr != null) {
    lines.push(`- ACWR (ATL/CTL): ${s.acwr.toFixed(2)} (${RISK_LABELS[s.risk]})`);
  }
  if (s.warmup) {
    lines.push("- Nota: meno di 42gg di storico, valori ancora preliminari");
  }
  return lines.join("\n");
}
