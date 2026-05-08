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

// 5 requests per 60 seconds per user (coach calls are heavier)
const limiter = createRateLimiter("coach", { maxRequests: 5, windowMs: 60_000 });

/**
 * POST /api/fitness/coach
 * Fetches the user's workout history and generates a personalized
 * weekly training plan with structured workouts.
 *
 * Body: { goal?: string, notes?: string }
 * Returns: { success: true, summary: string, workouts: PlannedWorkoutAI[] } | { error: string, isCreditError?: boolean }
 */

interface PlannedWorkoutAI {
  day: string;
  title: string;
  type: string;
  distance_km: number | null;
  duration_minutes: number | null;
  pace_target: string | null;
  description: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Rate limit check
  const rl = limiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Troppe richieste, riprova tra poco" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const config = aiConfig.coach;

  try {
    const body = await request.json();
    let { goal, notes } = body as { goal?: string; notes?: string };

    const { data: coachPreferences } = await supabase
      .from("fitness_coach_preferences")
      .select("goal, notes")
      .eq("user_id", user.id)
      .maybeSingle();

    goal = goal?.trim() || coachPreferences?.goal || "";
    notes = notes?.trim() || coachPreferences?.notes || "";

    // Fetch last 30 workouts — include TUTTE le metriche estese per un piano informato
    const { data: workouts } = await supabase
      .from("workouts")
      .select(
        "date, type, distance_km, duration_minutes, avg_pace, best_pace, avg_heart_rate, max_heart_rate, avg_cadence, max_cadence, avg_stride_cm, max_stride_cm, feeling, notes, calories, elevation_m, training_effect_aerobic, training_effect_anaerobic, vo2_max, recovery_hours, hr_zones",
      )
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30);

    // Profilo atleta: peso, altezza, FC riposo per calibrare zone / VO2
    const { data: latestBody } = await supabase
      .from("body_metrics")
      .select("weight_kg, height_cm, resting_hr, date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!workouts || workouts.length === 0) {
      return NextResponse.json(
        { error: "Serve almeno un allenamento registrato per generare un piano" },
        { status: 400 },
      );
    }

    // Also fetch the latest planned workouts with actual data (for feedback loop)
    const { data: prevPlannedRaw } = await supabase
      .from("planned_workouts")
      .select("day_label, title, workout_type, distance_km, duration_minutes, pace_target, actual_workout_id")
      .eq("user_id", user.id)
      .not("actual_workout_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch actual workout data for completed planned workouts
    let comparisonBlock = "";
    if (prevPlannedRaw && prevPlannedRaw.length > 0) {
      const actualIds = prevPlannedRaw.map((p) => p.actual_workout_id).filter(Boolean) as string[];
      if (actualIds.length > 0) {
        const { data: actuals } = await supabase
          .from("workouts")
          .select("id, distance_km, duration_minutes, avg_pace, avg_heart_rate, feeling")
          .in("id", actualIds);

        const actualMap = new Map((actuals ?? []).map((a) => [a.id, a]));

        const lines = prevPlannedRaw.map((p) => {
          const actual = actualMap.get(p.actual_workout_id!);
          if (!actual) return null;
          return `- Piano: ${p.title} (${p.distance_km ?? "?"}km, passo ${p.pace_target ?? "?"}) → Eseguito: ${actual.distance_km ?? "?"}km, passo ${actual.avg_pace ?? "?"}, FC ${actual.avg_heart_rate ?? "?"}, sensazione ${actual.feeling ?? "?"}/5`;
        }).filter(Boolean);

        if (lines.length > 0) {
          comparisonBlock = `\n\nCONFRONTO PIANO PRECEDENTE VS ESEGUITO:\n${lines.join("\n")}`;
        }
      }
    }

    // Build workout summary — include tutte le metriche utili al planner
    const workoutSummary = workouts.map((w) => {
      const parts = [`${w.date}: ${w.type}`];
      if (w.distance_km) parts.push(`${w.distance_km}km`);
      if (w.duration_minutes) parts.push(`${w.duration_minutes}min`);
      if (w.avg_pace) parts.push(`passo ${w.avg_pace}`);
      if (w.best_pace) parts.push(`best ${w.best_pace}`);
      if (w.avg_heart_rate) parts.push(`FC ${w.avg_heart_rate}bpm`);
      if (w.max_heart_rate) parts.push(`FCmax ${w.max_heart_rate}`);
      if (w.avg_cadence) parts.push(`cad ${w.avg_cadence}spm`);
      if (w.elevation_m) parts.push(`${w.elevation_m}m D+`);
      if (w.training_effect_aerobic) parts.push(`TEa ${Number(w.training_effect_aerobic).toFixed(1)}`);
      if (w.training_effect_anaerobic) parts.push(`TEan ${Number(w.training_effect_anaerobic).toFixed(1)}`);
      if (w.vo2_max) parts.push(`VO2 ${Number(w.vo2_max).toFixed(1)}`);
      if (w.recovery_hours) parts.push(`recup ${w.recovery_hours}h`);
      if (w.feeling) parts.push(`sens ${w.feeling}/5`);
      if (w.notes) parts.push(`nota: ${w.notes}`);
      return parts.join(" | ");
    }).join("\n");

    // Stats aggregate
    const totalWorkouts = workouts.length;
    const totalDistance = workouts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
    const avgDistance = totalWorkouts > 0 ? (totalDistance / totalWorkouts).toFixed(1) : "0";
    const totalDuration = workouts.reduce((s, w) => s + (Number(w.duration_minutes) || 0), 0);
    const avgHR = workouts.filter((w) => w.avg_heart_rate).length > 0
      ? Math.round(workouts.reduce((s, w) => s + (Number(w.avg_heart_rate) || 0), 0) / workouts.filter((w) => w.avg_heart_rate).length)
      : null;

    // VO2 max stimato recente (ultimo valore disponibile)
    const latestVo2 = workouts.find((w) => w.vo2_max != null)?.vo2_max ?? null;

    // Training effect medio (indice dell'intensita' dell'ultimo periodo)
    const teaSamples = workouts.filter((w) => w.training_effect_aerobic != null);
    const avgTEaerobic = teaSamples.length
      ? (teaSamples.reduce((s, w) => s + Number(w.training_effect_aerobic), 0) / teaSamples.length).toFixed(1)
      : null;
    const teanSamples = workouts.filter((w) => w.training_effect_anaerobic != null);
    const avgTEanaerobic = teanSamples.length
      ? (teanSamples.reduce((s, w) => s + Number(w.training_effect_anaerobic), 0) / teanSamples.length).toFixed(1)
      : null;

    // Recupero residuo: se l'ultimo allenamento ha recovery_hours, segnalalo
    const lastWorkout = workouts[0];
    let recoveryHint = "";
    if (lastWorkout?.recovery_hours != null && lastWorkout?.date) {
      const hoursSince = (Date.now() - new Date(lastWorkout.date).getTime()) / 3_600_000;
      const remaining = Math.max(0, Math.round(Number(lastWorkout.recovery_hours) - hoursSince));
      recoveryHint = remaining > 0
        ? `Recupero residuo dall'ultimo allenamento: ~${remaining} ore consigliate prima di un'altra seduta intensa.`
        : `L'atleta ha completato il recupero dall'ultima seduta.`;
    }

    // Distribuzione tempo nelle zone FC (somma su ultimi 30)
    const zoneTotals = { leggera: 0, intensiva: 0, aerobica: 0, anaerobica: 0, vo2max: 0 };
    for (const w of workouts) {
      const z = w.hr_zones as { leggera?: number | null; intensiva?: number | null; aerobica?: number | null; anaerobica?: number | null; vo2max?: number | null } | null;
      if (z && typeof z === "object") {
        zoneTotals.leggera += Number(z.leggera) || 0;
        zoneTotals.intensiva += Number(z.intensiva) || 0;
        zoneTotals.aerobica += Number(z.aerobica) || 0;
        zoneTotals.anaerobica += Number(z.anaerobica) || 0;
        zoneTotals.vo2max += Number(z.vo2max) || 0;
      }
    }
    const zoneTotalSum = Object.values(zoneTotals).reduce((a, b) => a + b, 0);
    const zoneDistribution = zoneTotalSum > 0
      ? `- Distribuzione zone FC (% del tempo totale):\n  - Leggera: ${((zoneTotals.leggera / zoneTotalSum) * 100).toFixed(0)}%\n  - Intensiva: ${((zoneTotals.intensiva / zoneTotalSum) * 100).toFixed(0)}%\n  - Aerobica: ${((zoneTotals.aerobica / zoneTotalSum) * 100).toFixed(0)}%\n  - Anaerobica: ${((zoneTotals.anaerobica / zoneTotalSum) * 100).toFixed(0)}%\n  - VO2 max: ${((zoneTotals.vo2max / zoneTotalSum) * 100).toFixed(0)}%`
      : "";

    // Training load: CTL/ATL/TSB/ACWR calcolati sugli ultimi 90 giorni.
    // Il Coach usa questi numeri per capire se l'atleta e' fresco, affaticato,
    // se sta ramp-ando troppo (rischio infortunio) o sotto-allenando.
    const loadFrom = new Date();
    loadFrom.setDate(loadFrom.getDate() - 90);
    const loadSeries = computeLoadSeries(workouts as WorkoutLike[], loadFrom, new Date());
    const loadSummary = summarizeLoad(loadSeries);
    const loadBlock = formatLoadForPrompt(loadSummary);

    // Profilo atleta
    const bodyContext: string[] = [];
    if (latestBody?.weight_kg) bodyContext.push(`peso ${latestBody.weight_kg}kg`);
    if (latestBody?.height_cm) bodyContext.push(`altezza ${latestBody.height_cm}cm`);
    if (latestBody?.resting_hr) bodyContext.push(`FC riposo ${latestBody.resting_hr}bpm`);

    const systemPrompt = `Sei un coach di running esperto e motivante. Parli in italiano.
Crei piani di allenamento settimanali personalizzati basati sullo storico dell'atleta.

RISPONDI ESCLUSIVAMENTE con un oggetto JSON valido, senza markdown, senza testo aggiuntivo.
Usa questo schema esatto:

{
  "summary": "Testo markdown con: analisi del livello, punti di forza, aree di miglioramento, consigli su recupero/alimentazione. Massimo 300 parole. Usa emoji per rendere leggibile.",
  "workouts": [
    {
      "day": "Lunedi",
      "title": "Nome breve dell'allenamento",
      "type": "easy_run | tempo_run | interval | long_run | recovery | race | walk | rest | stretching | cross_training",
      "distance_km": numero o null,
      "duration_minutes": numero o null,
      "pace_target": "MM'SS\\"/km o null",
      "description": "Istruzioni dettagliate: riscaldamento, fase principale, defaticamento. 2-3 frasi."
    }
  ]
}

Regole:
- INCLUDI SOLO allenamenti di corsa effettivi nell'array "workouts" (easy_run, tempo_run, interval, long_run, recovery, race)
- NON includere giorni di riposo, stretching, camminate o yoga nell'array — menzionali solo nel "summary" come consigli
- Il numero di allenamenti DEVE rispettare le indicazioni dell'utente. Se dice "3 allenamenti", l'array deve contenere esattamente 3 elementi
- I giorni devono essere: Lunedi, Martedi, Mercoledi, Giovedi, Venerdi, Sabato, Domenica
- Non superare un aumento del 10% settimanale sul volume
- Alterna intensita (facile, medio, intenso)
- Se c'e un confronto piano-vs-eseguito, usalo per calibrare meglio le intensita
- Adatta il passo target ai dati reali dell'atleta

Uso dei dati avanzati (quando disponibili):
- Effetto allenamento (TEa / TEan, 0-5): TEa > 4 indica stimolo aerobico alto; TEan > 3 indica stimolo anaerobico significativo. Usa questi indici per valutare se l'atleta ha gia' avuto sufficiente intensita' di recente.
- VO2 max stimato: serve per tarare i passi target (atleta con VO2 piu' alto puo' sostenere passi piu' veloci in soglia).
- Ore di recupero consigliate: se l'atleta ha recupero residuo elevato dall'ultima seduta, NON pianificare una seduta intensa il giorno dopo.
- Distribuzione zone FC: regola 80/20 polarizzata — circa 70-80% del tempo in Leggera/Aerobica, 10-20% in Anaerobica/VO2max. Se vedi squilibri (es. troppa zona intensiva, poco facile), correggi nel piano.
- Cadenza e falcata: se cadenza < 170 spm segnala di lavorarci; se falcata cala sotto i valori medi personali in intervalli tecnici, puo' essere fatica.
- Profilo atleta (peso, FC riposo): usa per contestualizzare i dati, non citarli esplicitamente a meno che non rilevi qualcosa di anomalo.

Training load (CTL/ATL/TSB/ACWR) — USA QUESTI DATI PER CALIBRARE LA SETTIMANA:
- CTL (fitness) basso → priorita' a costruire base aerobica (aumenta gradualmente il volume).
- ATL (fatica) alto rispetto a CTL → riduci volume/intensita' la prossima settimana.
- TSB positivo (> +5) → l'atleta e' fresco: puoi proporre sedute di qualita' o una gara.
- TSB negativo severo (< -25) → l'atleta e' in overreaching: pianifica una settimana di scarico (~60% del volume), niente sedute intense.
- ACWR > 1.5 → rischio infortunio alto: TAGLIA il volume settimanale, max 1 seduta intensa.
- ACWR < 0.8 → puoi aumentare leggermente (ma non oltre +10% settimanale).
- Se il flag "warmup" e' attivo (< 42gg di storico), usa i valori come indicazione ma non basare tutto il piano su di essi.`;

    const userMessage = `Storico allenamenti (ultimi ${totalWorkouts}, dal piu' recente):

${workoutSummary}

Statistiche aggregate:
- Distanza totale: ${totalDistance.toFixed(1)} km
- Distanza media: ${avgDistance} km/allenamento
- Tempo totale: ${totalDuration.toFixed(0)} minuti
${avgHR ? `- FC media: ${avgHR} bpm` : ""}
${latestVo2 ? `- VO2 max attuale: ${Number(latestVo2).toFixed(1)} ml/kg/min` : ""}
${avgTEaerobic ? `- Effetto aerobico medio: ${avgTEaerobic}/5` : ""}
${avgTEanaerobic ? `- Effetto anaerobico medio: ${avgTEanaerobic}/5` : ""}
${zoneDistribution}
${loadBlock ? `\nCarico e forma (ultimi 90gg):\n${loadBlock}` : ""}
${recoveryHint ? `\n${recoveryHint}` : ""}
${bodyContext.length ? `\nProfilo atleta: ${bodyContext.join(", ")}` : ""}
${comparisonBlock}

${goal ? `Obiettivo: ${goal}` : "Nessun obiettivo specifico, migliorare gradualmente."}
${notes ? `Note: ${notes}` : ""}

Genera il piano per la prossima settimana tenendo conto di TUTTE le metriche sopra (intensita' recente, distribuzione zone FC, recupero residuo, VO2 max).`;

    const result = await callAI(config, [{ role: "user", content: userMessage }], systemPrompt);

    if (result.error) {
      return NextResponse.json(
        { error: result.error, isCreditError: result.isCreditError ?? false },
        { status: result.isCreditError ? 402 : 502 },
      );
    }

    // Parse structured JSON from AI
    let parsed: { summary: string; workouts: PlannedWorkoutAI[] };
    try {
      const jsonStr = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: if AI returned markdown instead of JSON, wrap it
      console.error("[coach] JSON parse failed, falling back to raw text");
      return NextResponse.json({
        success: true,
        summary: result.text,
        workouts: [],
      });
    }

    return NextResponse.json({
      success: true,
      summary: parsed.summary || "",
      workouts: parsed.workouts || [],
    });
  } catch (err) {
    console.error("[coach]", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "Errore interno durante la generazione del piano" },
      { status: 500 },
    );
  }
}
