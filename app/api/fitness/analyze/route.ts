import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiConfig } from "@/config/ai";
import { callAI } from "@/lib/ai/client";
import { createRateLimiter } from "@/lib/rate-limit";

// 10 requests per 60 seconds per user
const limiter = createRateLimiter("analyze", { maxRequests: 10, windowMs: 60_000 });

/**
 * POST /api/fitness/analyze
 * Receives a base64 screenshot from Xiaomi Mi Fitness (or similar)
 * and uses AI Vision to extract structured workout data.
 *
 * Body: { image: string (base64 data URL or raw base64) }
 * Returns: { success: true, data: ExtractedWorkout } | { error: string, isCreditError?: boolean }
 */

interface HrZones {
  leggera: number | null;
  intensiva: number | null;
  aerobica: number | null;
  anaerobica: number | null;
  vo2max: number | null;
}

interface ExtractedWorkout {
  date: string;
  type: string;
  distance_km: number | null;
  duration_minutes: number | null;
  avg_pace: string | null;
  best_pace: string | null;
  calories: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;
  max_cadence: number | null;
  avg_stride_cm: number | null;
  max_stride_cm: number | null;
  elevation_m: number | null;
  steps: number | null;
  feeling: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_hours: number | null;
  hr_zones: HrZones | null;
  intervals: { type: string; time: string; distance: string; pace: string }[] | null;
}

/** Converte "HH:MM:SS" o "MM:SS" in secondi interi. */
function parseDurationToSeconds(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 1) return nums[0];
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  // Auth check
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

  const config = aiConfig.analyze;

  try {
    const body = await request.json();
    const { image } = body as { image: string };

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Immagine mancante" }, { status: 400 });
    }

    // P1 — reject oversized payloads (max 5 MB of base64 data ≈ 6.67 MB string)
    const MAX_BASE64_LENGTH = 7_000_000; // ~5 MB decoded
    if (image.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Immagine troppo grande (max 5 MB)" },
        { status: 413 },
      );
    }

    // Extract base64 and media type from data URL
    let base64Data: string;
    let mediaType: string = "image/jpeg";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ error: "Formato immagine non valido" }, { status: 400 });
      }
      mediaType = match[1];
      base64Data = match[2];
      // Ensure supported media type
      const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!supported.includes(mediaType)) {
        mediaType = "image/jpeg";
      }
    } else {
      base64Data = image;
    }

    const prompt = `Analizza questo screenshot di un'app fitness (probabilmente Xiaomi Mi Fitness / Zepp Life) e estrai TUTTI i dati visibili dell'allenamento, inclusi intervalli, zone di frequenza cardiaca, cadenza, falcata, VO2 max e recupero.

METODO DI LETTURA (FONDAMENTALE per gli intervalli):
1. Identifica prima la durata totale dell'allenamento (es. "00:28:06" = 28 minuti e 6 secondi).
2. Leggi la tabella degli intervalli cella per cella, da sinistra a destra, riga per riga.
3. Per ogni cella con un numero, riguarda la cifra piu' a sinistra: e' il digit che piu' spesso viene confuso (0 con 6/8, 1 con 7). In un allenamento di ~30 minuti, un intervallo NON puo' durare piu' di 30 minuti.
4. Verifica coerenza: la somma dei tempi degli intervalli deve avvicinarsi alla durata totale (±10%). Se noti uno scarto enorme, ricontrolla.
5. Per le distanze: una ripetuta in pista tipicamente e' 100m-2000m. Se leggi "32m" ma la tabella mostra "326m", preferisci la lettura piu' plausibile.
6. Se non sei sicuro al 100% di una cifra, preferisci comunque una stima plausibile coerente con la durata totale piuttosto che un valore assurdo.
7. Conta SEMPRE il numero di righe della tabella e estraile TUTTE, inclusi Riscaldamento e Defaticamento.

Rispondi SOLO con un oggetto JSON valido, senza markdown né testo aggiuntivo. Usa questo schema esatto:

{
  "type": "easy_run | tempo_run | interval | long_run | recovery | race | walk | cycling | other",
  "distance_km": number or null,
  "duration_minutes": number or null (converti ore:minuti:secondi in minuti decimali),
  "avg_pace": "string nel formato MM'SS\\"" or null,
  "best_pace": "string nel formato MM'SS\\"" or null,
  "calories": number or null,
  "avg_heart_rate": number or null,
  "max_heart_rate": number or null,
  "avg_cadence": number or null (passi/min medi),
  "max_cadence": number or null (passi/min massimi),
  "avg_stride_cm": number or null (lunghezza falcata media in cm),
  "max_stride_cm": number or null (lunghezza falcata massima in cm),
  "elevation_m": number or null (dislivello in metri),
  "steps": number or null,
  "training_effect_aerobic": number or null (0.0-5.0),
  "training_effect_anaerobic": number or null (0.0-5.0),
  "vo2_max": number or null (ml/kg/min stimato),
  "recovery_hours": number or null (ore di recupero consigliate),
  "hr_zones": {
    "leggera":    "HH:MM:SS" or null,
    "intensiva":  "HH:MM:SS" or null,
    "aerobica":   "HH:MM:SS" or null,
    "anaerobica": "HH:MM:SS" or null,
    "vo2max":     "HH:MM:SS" or null
  } or null,
  "intervals": [{"type": "string (es. Riscaldamento, Allenamento, Riposo, Defaticamento)", "time": "string MM:SS o HH:MM:SS", "distance": "string (es. 372m o 0.37km)", "pace": "string MM'SS\\""}] or null
}

Note:
- Per duration_minutes: "00:28:06" = 28.1 minuti
- Per distance_km: "2.78 km" = 2.78
- hr_zones: se nello screenshot vedi una lista tipo "Leggera 03:02:52 / Intensiva 00:06:59 / Aerobica 03:10:11 / Anaerobica 00:09:20 / VO2 max 00:01:01", mantieni i valori come stringhe nel formato HH:MM:SS cosi' come li vedi.
- intervals: estrai tutta la tabella degli intervalli (colonne tipo "Nome / Tempo / Distanza / Passo"). Includi anche Riscaldamento e Defaticamento se presenti. Mantieni l'ordine.
- Se un dato non e' visibile, usa null (non inventare valori).
- Per il type, deduci dal contesto: se la tabella intervalli mostra ripetute strutturate (Allenamento + Riposo ripetuti) → "interval". Altrimenti usa il tipo piu' plausibile.`;

    const result = await callAI(config, [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ]);

    if (result.error) {
      return NextResponse.json(
        { error: result.error, isCreditError: result.isCreditError ?? false },
        { status: result.isCreditError ? 402 : 502 },
      );
    }

    // Parse JSON from AI response (handle potential markdown wrapping)
    // hr_zones arriva come stringhe "HH:MM:SS" dal modello — lo convertiamo dopo.
    interface RawParsed extends Omit<ExtractedWorkout, "date" | "feeling" | "hr_zones"> {
      hr_zones: {
        leggera?: string | number | null;
        intensiva?: string | number | null;
        aerobica?: string | number | null;
        anaerobica?: string | number | null;
        vo2max?: string | number | null;
      } | null;
    }
    let parsed: RawParsed;
    try {
      const jsonStr = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const raw: unknown = JSON.parse(jsonStr);
      if (!isRecord(raw)) {
        return NextResponse.json(
          { error: "Risposta AI non valida" },
          { status: 422 },
        );
      }
      parsed = raw as unknown as RawParsed;
    } catch {
      console.error("[analyze] JSON parse failed, first 200 chars:", result.text.slice(0, 200));
      return NextResponse.json(
        { error: "Impossibile interpretare i dati dallo screenshot" },
        { status: 422 },
      );
    }

    // Sanity-check degli intervalli: la AI Vision ogni tanto confonde cifre
    // (0 letto come 6, 7 come 1, ecc). Scartiamo le righe palesemente impossibili
    // per evitare di persistere dati corrotti.
    let intervals = parsed.intervals;
    if (Array.isArray(intervals)) {
      const totalSec =
        typeof parsed.duration_minutes === "number" && Number.isFinite(parsed.duration_minutes)
          ? Math.round(parsed.duration_minutes * 60)
          : null;
      // Soglia: se conosciamo la durata totale, scartiamo split che la superano
      // (non possibile in un singolo intervallo). Aggiungiamo un margine del 20%.
      const maxSplitSec = totalSec != null ? Math.round(totalSec * 1.2) : null;

      const cleaned = intervals
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const time = typeof row.time === "string" ? row.time.trim() : "";
          const timeSec = parseDurationToSeconds(time);
          // Tempo non parsabile → teniamo la riga ma senza controllo.
          if (timeSec == null) return row;
          // Tempo che eccede la durata totale → riga corrotta: la scartiamo.
          if (maxSplitSec != null && timeSec > maxSplitSec) {
            console.warn(
              `[analyze] interval scartato: time=${time} (${timeSec}s) > soglia ${maxSplitSec}s`,
            );
            return null;
          }
          return row;
        })
        .filter((r): r is NonNullable<typeof r> => r != null);

      // Se la somma dei tempi e' assurda (ad es. > 3x la durata totale),
      // logghiamo un warning ma non blocchiamo: l'utente puo' correggere a mano.
      if (totalSec != null && cleaned.length > 0) {
        const sumSec = cleaned.reduce((acc, r) => {
          const s = parseDurationToSeconds(r.time);
          return acc + (s ?? 0);
        }, 0);
        if (sumSec > totalSec * 3) {
          console.warn(
            `[analyze] somma intervalli (${sumSec}s) molto > durata totale (${totalSec}s): probabile OCR corrotto`,
          );
        }
      }

      intervals = cleaned.length > 0 ? cleaned : null;
    }

    // Normalizza hr_zones: converte le durate in secondi.
    let hrZones: HrZones | null = null;
    if (parsed.hr_zones && typeof parsed.hr_zones === "object") {
      const z = parsed.hr_zones;
      const candidate: HrZones = {
        leggera: parseDurationToSeconds(z.leggera),
        intensiva: parseDurationToSeconds(z.intensiva),
        aerobica: parseDurationToSeconds(z.aerobica),
        anaerobica: parseDurationToSeconds(z.anaerobica),
        vo2max: parseDurationToSeconds(z.vo2max),
      };
      // Se nessuna zona ha valori, evita di salvare un oggetto vuoto.
      if (Object.values(candidate).some((v) => v != null)) hrZones = candidate;
    }

    // Build the final response with today's date as default
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const extracted: ExtractedWorkout = {
      date: dateStr,
      type: parsed.type || "easy_run",
      distance_km: parsed.distance_km ?? null,
      duration_minutes: parsed.duration_minutes ?? null,
      avg_pace: parsed.avg_pace ?? null,
      best_pace: parsed.best_pace ?? null,
      calories: parsed.calories ?? null,
      avg_heart_rate: parsed.avg_heart_rate ?? null,
      max_heart_rate: parsed.max_heart_rate ?? null,
      avg_cadence: parsed.avg_cadence ?? null,
      max_cadence: parsed.max_cadence ?? null,
      avg_stride_cm: parsed.avg_stride_cm ?? null,
      max_stride_cm: parsed.max_stride_cm ?? null,
      elevation_m: parsed.elevation_m ?? null,
      steps: parsed.steps ?? null,
      feeling: null,
      training_effect_aerobic: parsed.training_effect_aerobic ?? null,
      training_effect_anaerobic: parsed.training_effect_anaerobic ?? null,
      vo2_max: parsed.vo2_max ?? null,
      recovery_hours: parsed.recovery_hours ?? null,
      hr_zones: hrZones,
      intervals: intervals ?? null,
    };

    return NextResponse.json({ success: true, data: extracted });
  } catch (err) {
    console.error("[analyze]", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "Errore interno durante l'analisi" },
      { status: 500 },
    );
  }
}
