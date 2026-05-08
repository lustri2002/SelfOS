/**
 * Client Strava per OAuth e fetch attivita'.
 *
 * - `exchangeCodeForTokens` / `refreshAccessToken`: flow OAuth.
 * - `getValidAccessToken`: legge la connessione dal DB, refresha se vicina a
 *   scadenza, riscrive i nuovi token cifrati. Idempotente.
 * - `listAthleteActivities`: pagina tutte le attivita' dopo un timestamp.
 * - `getActivityDetail`: dettaglio + laps.
 * - `getActivityZones`: zone FC/potenza (opzionale).
 * - `mapActivityToWorkout`: converte il payload Strava nel nostro schema.
 *
 * Il provider si identifica con `source = 'strava'` e `source_id = String(activity.id)`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

// ── Tipi Strava (solo i campi che usiamo) ────────────────────────

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  expires_in: number;
  token_type: string;
  athlete?: {
    id: number;
    firstname?: string;
    lastname?: string;
  };
  scope?: string;
}

export interface StravaActivitySummary {
  id: number;
  name: string;
  sport_type: string;
  type?: string;
  workout_type?: number | null;
  start_date: string;       // UTC ISO
  start_date_local: string; // local ISO
  distance: number;         // metri
  moving_time: number;      // secondi
  elapsed_time: number;     // secondi
  total_elevation_gain: number;
  average_speed?: number;   // m/s
  max_speed?: number;       // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  has_heartrate?: boolean;
}

export interface StravaLap {
  id: number;
  name?: string;
  lap_index: number;
  elapsed_time: number;
  moving_time: number;
  distance: number;           // metri
  average_speed?: number;     // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
}

export interface StravaActivityDetail extends StravaActivitySummary {
  description?: string;
  calories?: number;
  laps?: StravaLap[];
  device_name?: string;
}

export interface StravaZoneBucket {
  min: number;
  max: number;
  time: number; // secondi
}
export interface StravaZoneBlock {
  type: "heartrate" | "power";
  sensor_based?: boolean;
  custom_zones?: boolean;
  max?: number;
  distribution_buckets: StravaZoneBucket[];
}

// ── OAuth ────────────────────────────────────────────────────────

const STRAVA_OAUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

export function getStravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Config Strava mancante: imposta STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET e STRAVA_REDIRECT_URI in .env.local",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** URL a cui redirezionare l'utente per autorizzare. `state` e' CSRF/replay. */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getStravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });
  return `${STRAVA_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getStravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava token exchange fallito (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as StravaTokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = getStravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava token refresh fallito (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as StravaTokenResponse;
}

/**
 * Restituisce un access token valido: se la scadenza e' vicina (< 2 min),
 * esegue il refresh e riscrive i token cifrati in DB.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("strava_connections")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`DB strava_connections: ${error.message}`);
  if (!data) throw new Error("Nessuna connessione Strava trovata");

  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();
  const marginMs = 2 * 60 * 1000; // 2 minuti

  if (expiresAt - now > marginMs) {
    return decryptSecret(data.access_token_enc);
  }

  // Refresh needed.
  const refreshToken = decryptSecret(data.refresh_token_enc);
  const tok = await refreshAccessToken(refreshToken);
  const newExpires = new Date(tok.expires_at * 1000).toISOString();

  const upd = await supabase
    .from("strava_connections")
    .update({
      access_token_enc: encryptSecret(tok.access_token),
      refresh_token_enc: encryptSecret(tok.refresh_token),
      expires_at: newExpires,
    })
    .eq("user_id", userId);

  if (upd.error) {
    // Non fatale: possiamo comunque usare il token fresco per questa richiesta.
    console.error("[strava] update token fallito:", upd.error.message);
  }
  return tok.access_token;
}

// ── API calls ────────────────────────────────────────────────────

async function stravaFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Strava: token non autorizzato (scaduto/revocato)");
  if (res.status === 429) throw new Error("Strava: rate limit superato, riprova piu' tardi");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava API ${path} fallita (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * Lista le attivita' dell'atleta dopo un certo epoch (secondi). Impagina
 * automaticamente fino a `maxPages` pagine da 100 elementi ciascuna.
 */
export async function listAthleteActivities(
  token: string,
  afterEpochSec: number | null,
  opts: { maxPages?: number; perPage?: number } = {},
): Promise<StravaActivitySummary[]> {
  const maxPages = opts.maxPages ?? 10;
  const perPage = opts.perPage ?? 100;
  const all: StravaActivitySummary[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (afterEpochSec != null) qs.set("after", String(afterEpochSec));
    const batch = await stravaFetch<StravaActivitySummary[]>(token, `/athlete/activities?${qs}`);
    all.push(...batch);
    if (batch.length < perPage) break; // ultima pagina
  }
  return all;
}

export function getActivityDetail(token: string, activityId: number): Promise<StravaActivityDetail> {
  return stravaFetch<StravaActivityDetail>(token, `/activities/${activityId}?include_all_efforts=true`);
}

export function getActivityZones(token: string, activityId: number): Promise<StravaZoneBlock[]> {
  return stravaFetch<StravaZoneBlock[]>(token, `/activities/${activityId}/zones`);
}

// ── Mapping Strava → workout ─────────────────────────────────────

const FIVE_ZONES_KEYS = ["leggera", "intensiva", "aerobica", "anaerobica", "vo2max"] as const;

export interface MappedWorkout {
  date: string;                          // YYYY-MM-DD
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
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_hours: number | null;
  hr_zones: Record<string, number | null> | null;
  intervals:
    | { type: string; time: string; distance: string; pace: string }[]
    | null;
  notes: string | null;
  source: "strava";
  source_id: string;
  source_url: string;
}

/** "3.45" → "3'27\"" — passo per-km da velocita' in m/s. */
function paceFromSpeed(mps: number | null | undefined): string | null {
  if (!mps || mps <= 0) return null;
  const secPerKm = 1000 / mps;
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm - mm * 60);
  // Gestione overflow arrotondamento (ss == 60)
  const mmFinal = ss === 60 ? mm + 1 : mm;
  const ssFinal = ss === 60 ? 0 : ss;
  return `${mmFinal}'${String(ssFinal).padStart(2, "0")}"`;
}

/** sec → "MM:SS" o "HH:MM:SS". */
function fmtHms(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Deduce il nostro `type` dal sport_type Strava e dai laps. */
function deduceType(activity: StravaActivityDetail): string {
  const sport = (activity.sport_type || activity.type || "").toLowerCase();
  if (sport.includes("walk") || sport === "hike") return "walk";
  if (sport.includes("ride")) return "cycling";
  if (!sport.includes("run")) return "other";

  // E' una corsa. workout_type: 1=race, 2=long, 3=workout (interval/tempo).
  const wt = activity.workout_type ?? null;
  if (wt === 1) return "race";
  if (wt === 2) return "long_run";
  if (wt === 3) {
    // Distinzione interval vs tempo: interval ha laps alternati (recupero piu' lento).
    const laps = activity.laps ?? [];
    if (laps.length >= 3) return "interval";
    return "tempo_run";
  }
  // Senza indicazione esplicita: se ha molti laps di lunghezza variegata, interval.
  const laps = activity.laps ?? [];
  if (laps.length >= 4) {
    const distances = laps.map((l) => l.distance);
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    if (max > min * 2) return "interval";
  }
  return "easy_run";
}

function mapLaps(laps: StravaLap[] | undefined): MappedWorkout["intervals"] {
  if (!laps || laps.length === 0) return null;
  return laps.map((lap) => ({
    type: lap.name || `Lap ${lap.lap_index}`,
    time: fmtHms(lap.moving_time || lap.elapsed_time || 0),
    distance: lap.distance >= 1000
      ? `${(lap.distance / 1000).toFixed(2)}km`
      : `${Math.round(lap.distance)}m`,
    pace: paceFromSpeed(lap.average_speed) ?? "",
  }));
}

/**
 * Mappa le zone Strava nel nostro schema a 5 bucket.
 * Strava puo' restituire un numero variabile di zone (user-configured):
 *   - 5 zone → mapping diretto posizionale (Z1..Z5).
 *   - altrimenti null (preferiamo non falsificare il dato).
 */
function mapHrZones(zones: StravaZoneBlock[] | null): MappedWorkout["hr_zones"] {
  if (!zones) return null;
  const hr = zones.find((z) => z.type === "heartrate");
  if (!hr || !Array.isArray(hr.distribution_buckets)) return null;
  const buckets = hr.distribution_buckets;
  if (buckets.length !== 5) return null;
  const out: Record<string, number | null> = {};
  FIVE_ZONES_KEYS.forEach((key, i) => {
    const t = buckets[i]?.time;
    out[key] = typeof t === "number" && Number.isFinite(t) ? Math.max(0, Math.round(t)) : null;
  });
  // Se tutte a zero/null, ritorna null (niente da mostrare).
  if (Object.values(out).every((v) => !v)) return null;
  return out;
}

export function mapActivityToWorkout(
  activity: StravaActivityDetail,
  zones: StravaZoneBlock[] | null,
): MappedWorkout {
  // Data locale dell'attivita'.
  const localIso = activity.start_date_local || activity.start_date;
  const date = localIso.slice(0, 10);

  const distanceKm = activity.distance > 0 ? +(activity.distance / 1000).toFixed(2) : null;
  const durationMinutes = activity.moving_time > 0 ? +(activity.moving_time / 60).toFixed(1) : null;

  // Cadenza per running: Strava restituisce "strides/min per gamba";
  // convenzione comune e' raddoppiare per ottenere spm totali.
  const isRun = ((activity.sport_type || activity.type || "").toLowerCase()).includes("run");
  const avgCadence = activity.average_cadence != null
    ? Math.round(isRun ? activity.average_cadence * 2 : activity.average_cadence)
    : null;

  return {
    date,
    type: deduceType(activity),
    distance_km: distanceKm,
    duration_minutes: durationMinutes,
    avg_pace: paceFromSpeed(activity.average_speed),
    best_pace: paceFromSpeed(activity.max_speed),
    calories: activity.calories != null ? Math.round(activity.calories) : null,
    avg_heart_rate: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
    max_heart_rate: activity.max_heartrate != null ? Math.round(activity.max_heartrate) : null,
    avg_cadence: avgCadence,
    max_cadence: null,          // Strava non espone il massimo puntuale
    avg_stride_cm: null,        // idem
    max_stride_cm: null,
    elevation_m: activity.total_elevation_gain != null
      ? Math.round(activity.total_elevation_gain)
      : null,
    steps: null,                // Strava non lo fornisce
    training_effect_aerobic: null,
    training_effect_anaerobic: null,
    vo2_max: null,
    recovery_hours: null,
    hr_zones: mapHrZones(zones),
    intervals: mapLaps(activity.laps),
    notes: activity.description ? activity.description.trim().slice(0, 2000) : null,
    source: "strava",
    source_id: String(activity.id),
    source_url: `https://www.strava.com/activities/${activity.id}`,
  };
}
