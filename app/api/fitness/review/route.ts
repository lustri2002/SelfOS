import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiConfig } from "@/config/ai";
import { callAI } from "@/lib/ai/client";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  computeLoadSeries,
  summarizeLoad,
  formatLoadForPrompt,
  type WorkoutLike,
} from "@/lib/training-load";

// 15 requests / 60s per utente — il review si attiva dopo ogni save,
// quindi serve un budget piu' ampio del coach ma comunque limitato.
const limiter = createRateLimiter("review", { maxRequests: 15, windowMs: 60_000 });

/**
 * POST /api/fitness/review
 * Genera il parere del Coach AI su un singolo allenamento, passando
 * come contesto gli ultimi 30 allenamenti dell'utente per valutarne
 * i progressi. Il risultato viene salvato sul record del workout
 * nei campi `ai_feedback` + `ai_feedback_generated_at`.
 *
 * Body:    { workoutId: string, force?: boolean }
 * Returns: { success: true, feedback: string, generated_at: string }
 *          | { error: string, isCreditError?: boolean }
 *
 * Se `force` e' false (default) e il workout ha gia' un feedback, viene
 * restituito quello esistente senza chiamare il modello.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const rl = limiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Troppe richieste, riprova tra poco" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const workoutId = body?.workoutId as string | undefined;
  const force = Boolean(body?.force);

  if (!workoutId || typeof workoutId !== "string") {
    return NextResponse.json({ error: "workoutId mancante" }, { status: 400 });
  }

  // 1) Carica l'allenamento target (RLS garantisce che sia dell'utente)
  const { data: target, error: targetErr } = await supabase
    .from("workouts")
    .select(
      "id, date, type, distance_km, duration_minutes, avg_pace, best_pace, avg_heart_rate, max_heart_rate, avg_cadence, max_cadence, avg_stride_cm, max_stride_cm, feeling, notes, calories, elevation_m, training_effect_aerobic, training_effect_anaerobic, vo2_max, recovery_hours, hr_zones, intervals, ai_feedback, ai_feedback_generated_at",
    )
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .single();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Allenamento non trovato" }, { status: 404 });
  }

  // Cache-hit: restituisci il feedback esistente senza bruciare token
  if (!force && target.ai_feedback && target.ai_feedback_generated_at) {
    return NextResponse.json({
      success: true,
      feedback: target.ai_feedback,
      generated_at: target.ai_feedback_generated_at,
      cached: true,
    });
  }

  // 2) Carica fino a 30 allenamenti precedenti (escludendo quello target)
  const { data: history } = await supabase
    .from("workouts")
    .select(
      "date, type, distance_km, duration_minutes, avg_pace, avg_heart_rate, max_heart_rate, feeling, notes, calories, elevation_m, avg_cadence, training_effect_aerobic, training_effect_anaerobic, vo2_max, recovery_hours, hr_zones",
    )
    .eq("user_id", user.id)
    .neq("id", workoutId)
    .lte("date", target.date) // solo cio' che e' venuto prima o lo stesso giorno
    .order("date", { ascending: false })
    .limit(30);

  // 3) Carica le metriche corporee piu' recenti per contesto (peso, altezza)
  const { data: latestMetric } = await supabase
    .from("body_metrics")
    .select("weight_kg, height_cm, resting_hr, date")
    .eq("user_id", user.id)
    .lte("date", target.date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Build the context block ───────────────────────────────
  // Storico: formato compatto per 30 sessioni — priorita' ai KPI di progressione.
  const formatHistoryWorkout = (w: {
    date: string;
    type: string;
    distance_km: number | null;
    duration_minutes: number | null;
    avg_pace: string | null;
    avg_heart_rate: number | null;
    max_heart_rate: number | null;
    feeling: number | null;
    notes: string | null;
    calories: number | null;
    elevation_m: number | null;
    avg_cadence: number | null;
    training_effect_aerobic: number | null;
    training_effect_anaerobic: number | null;
    vo2_max: number | null;
    recovery_hours: number | null;
  }) => {
    const parts = [`${w.date}: ${w.type}`];
    if (w.distance_km) parts.push(`${w.distance_km}km`);
    if (w.duration_minutes) parts.push(`${w.duration_minutes}min`);
    if (w.avg_pace) parts.push(`passo ${w.avg_pace}`);
    if (w.avg_heart_rate) parts.push(`FC ${w.avg_heart_rate}bpm`);
    if (w.max_heart_rate) parts.push(`FCmax ${w.max_heart_rate}`);
    if (w.avg_cadence) parts.push(`cad ${w.avg_cadence}spm`);
    if (w.elevation_m) parts.push(`${w.elevation_m}m D+`);
    if (w.training_effect_aerobic) parts.push(`TEa ${Number(w.training_effect_aerobic).toFixed(1)}`);
    if (w.training_effect_anaerobic) parts.push(`TEan ${Number(w.training_effect_anaerobic).toFixed(1)}`);
    if (w.vo2_max) parts.push(`VO2 ${Number(w.vo2_max).toFixed(1)}`);
    if (w.recovery_hours) parts.push(`recup ${w.recovery_hours}h`);
    if (w.feeling) parts.push(`sens ${w.feeling}/5`);
    if (w.notes) parts.push(`note: ${w.notes}`);
    return parts.join(" | ");
  };

  // Target: rappresentazione espansa con intervalli e zone FC se presenti.
  const secToHms = (s: number) => {
    const n = Math.max(0, Math.round(Number(s || 0)));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const ss = n % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
  };

  const targetParts: string[] = [];
  targetParts.push(`Data: ${target.date}`);
  targetParts.push(`Tipo: ${target.type}`);
  if (target.distance_km) targetParts.push(`Distanza: ${target.distance_km} km`);
  if (target.duration_minutes) targetParts.push(`Durata: ${target.duration_minutes} min`);
  if (target.avg_pace) targetParts.push(`Passo medio: ${target.avg_pace}`);
  if (target.best_pace) targetParts.push(`Passo migliore: ${target.best_pace}`);
  if (target.avg_heart_rate) targetParts.push(`FC media: ${target.avg_heart_rate} bpm`);
  if (target.max_heart_rate) targetParts.push(`FC max: ${target.max_heart_rate} bpm`);
  if (target.avg_cadence) targetParts.push(`Cadenza media: ${target.avg_cadence} spm`);
  if (target.max_cadence) targetParts.push(`Cadenza max: ${target.max_cadence} spm`);
  if (target.avg_stride_cm) targetParts.push(`Falcata media: ${target.avg_stride_cm} cm`);
  if (target.max_stride_cm) targetParts.push(`Falcata max: ${target.max_stride_cm} cm`);
  if (target.calories) targetParts.push(`Calorie: ${target.calories} kcal`);
  if (target.elevation_m) targetParts.push(`Dislivello: ${target.elevation_m} m`);
  if (target.training_effect_aerobic) targetParts.push(`Effetto aerobico: ${Number(target.training_effect_aerobic).toFixed(1)}/5`);
  if (target.training_effect_anaerobic) targetParts.push(`Effetto anaerobico: ${Number(target.training_effect_anaerobic).toFixed(1)}/5`);
  if (target.vo2_max) targetParts.push(`VO2 max: ${Number(target.vo2_max).toFixed(1)} ml/kg/min`);
  if (target.recovery_hours) targetParts.push(`Recupero consigliato: ${target.recovery_hours} h`);
  if (target.feeling) targetParts.push(`Sensazione: ${target.feeling}/5`);
  if (target.notes) targetParts.push(`Note: ${target.notes}`);

  const targetZones = target.hr_zones as { leggera?: number | null; intensiva?: number | null; aerobica?: number | null; anaerobica?: number | null; vo2max?: number | null } | null;
  let hrZonesBlock = "";
  if (targetZones && typeof targetZones === "object") {
    const z = targetZones;
    const rows: string[] = [];
    if (z.leggera != null) rows.push(`  - Leggera: ${secToHms(z.leggera)}`);
    if (z.intensiva != null) rows.push(`  - Intensiva: ${secToHms(z.intensiva)}`);
    if (z.aerobica != null) rows.push(`  - Aerobica: ${secToHms(z.aerobica)}`);
    if (z.anaerobica != null) rows.push(`  - Anaerobica: ${secToHms(z.anaerobica)}`);
    if (z.vo2max != null) rows.push(`  - VO2 max: ${secToHms(z.vo2max)}`);
    if (rows.length) hrZonesBlock = `\nZone frequenza cardiaca:\n${rows.join("\n")}`;
  }

  const targetIntervals = target.intervals as { type?: string; time?: string; distance?: string; pace?: string }[] | null;
  let intervalsBlock = "";
  if (Array.isArray(targetIntervals) && targetIntervals.length > 0) {
    const rows = targetIntervals.map((iv, i) => `  ${i + 1}. ${iv.type ?? "-"} | ${iv.time ?? "-"} | ${iv.distance ?? "-"} | passo ${iv.pace ?? "-"}`);
    intervalsBlock = `\nIntervalli (${targetIntervals.length} split):\n${rows.join("\n")}`;
  }

  const targetBlock = `${targetParts.join("\n")}${hrZonesBlock}${intervalsBlock}`;
  const historyBlock = (history ?? []).map(formatHistoryWorkout).join("\n") || "(nessun allenamento precedente)";

  // Statistiche aggregate sullo storico (esclude il target)
  const hist = history ?? [];
  const totalDistance = hist.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
  const totalDuration = hist.reduce((s, w) => s + (Number(w.duration_minutes) || 0), 0);
  const hrSamples = hist.filter((w) => w.avg_heart_rate);
  const avgHR = hrSamples.length
    ? Math.round(hrSamples.reduce((s, w) => s + (Number(w.avg_heart_rate) || 0), 0) / hrSamples.length)
    : null;
  const feelingSamples = hist.filter((w) => w.feeling);
  const avgFeeling = feelingSamples.length
    ? (feelingSamples.reduce((s, w) => s + (Number(w.feeling) || 0), 0) / feelingSamples.length).toFixed(1)
    : null;

  const bodyContext: string[] = [];
  if (latestMetric?.weight_kg) bodyContext.push(`peso ${latestMetric.weight_kg}kg`);
  if (latestMetric?.height_cm) bodyContext.push(`altezza ${latestMetric.height_cm}cm`);
  if (latestMetric?.resting_hr) bodyContext.push(`FC riposo ${latestMetric.resting_hr}bpm`);

  // Training load fino al giorno del workout (incluso): cosi' il parere vede
  // carico/forma/rischio dell'atleta "al momento" di quella seduta.
  const loadFrom = new Date();
  loadFrom.setDate(loadFrom.getDate() - 90);
  const loadTo = target.date ? new Date(target.date) : new Date();
  const loadSummary = summarizeLoad(
    computeLoadSeries([target, ...hist] as WorkoutLike[], loadFrom, loadTo),
  );
  const loadBlock = formatLoadForPrompt(loadSummary);

  const systemPrompt = `Sei un coach di running esperto, diretto ma incoraggiante. Parli in italiano.

Ti viene mostrato UN SINGOLO allenamento appena registrato dall'atleta, insieme al suo storico (fino a 30 sessioni precedenti). Devi dare un parere SU QUESTO allenamento, inquadrandolo nel contesto della sua progressione.

Regole di output:
- Rispondi in MARKDOWN, massimo 180 parole.
- Struttura il testo con 2-4 sezioni brevi con titoli in grassetto (es. **Come e' andato**, **Confronto con lo storico**, **Cosa migliorare**).
- Usa emoji con parsimonia (max 3 in tutta la risposta).
- NO preamboli stile "Ciao atleta!", vai dritto al punto.
- Se i dati sono scarsi (es. primo allenamento, metriche mancanti) dillo e suggerisci cosa tracciare meglio la prossima volta.
- Se vedi segnali di affaticamento (FC elevata + sensazione bassa + volumi in aumento), segnalalo.
- Se vedi progressi (passo piu' rapido a pari FC, distanze crescenti, sensazione stabile), elogiali concretamente citando i numeri.
- Confronta sempre con ALMENO una metrica dello storico, non limitarti a commentare l'allenamento isolato.
- Se hai a disposizione le zone cardiache, gli intervalli o l'effetto allenamento, usali per valutare l'intensita' reale (es. troppo tempo in VO2 max per una recovery, pochi intervalli in soglia per un tempo-run).
- Se vedi l'intervallo "Recupero consigliato", tienilo in conto quando suggerisci la prossima seduta.
- Se hai i valori di carico (CTL/ATL/TSB/ACWR), usali: TSB molto negativo indica affaticamento, ACWR > 1.5 indica ramp pericoloso, TSB positivo e CTL crescente indica progressione sana. Cita la metrica solo se aggiunge valore concreto al parere.
- NON inventare dati che non sono nello storico.`;

  const userMessage = `ALLENAMENTO APPENA REGISTRATO:
${targetBlock}

STORICO (${hist.length} allenamenti, dal piu' recente al piu' vecchio):
${historyBlock}

STATISTICHE AGGREGATE STORICO:
- Volume totale: ${totalDistance.toFixed(1)} km, ${totalDuration.toFixed(0)} min
${avgHR ? `- FC media storica: ${avgHR} bpm` : "- FC media storica: non disponibile"}
${avgFeeling ? `- Sensazione media storica: ${avgFeeling}/5` : ""}
${loadBlock ? `\nCARICO E FORMA (al giorno di questo allenamento):\n${loadBlock}` : ""}
${bodyContext.length ? `\nPROFILO ATLETA: ${bodyContext.join(", ")}` : ""}

Dammi il tuo parere su questo allenamento.`;

  const result = await callAI(aiConfig.review, [{ role: "user", content: userMessage }], systemPrompt);

  if (result.error) {
    return NextResponse.json(
      { error: result.error, isCreditError: result.isCreditError ?? false },
      { status: result.isCreditError ? 402 : 502 },
    );
  }

  const feedback = result.text.trim();
  const generatedAt = new Date().toISOString();

  // Persisti il parere sul workout — RLS garantisce ownership via user_id
  const { error: updErr } = await supabase
    .from("workouts")
    .update({
      ai_feedback: feedback,
      ai_feedback_generated_at: generatedAt,
    })
    .eq("id", workoutId)
    .eq("user_id", user.id);

  if (updErr) {
    // Non bloccare la risposta — il feedback e' comunque utile anche senza persistenza
    console.error("[review] persist failed:", updErr.message);
  }

  return NextResponse.json({
    success: true,
    feedback,
    generated_at: generatedAt,
    cached: false,
  });
}
