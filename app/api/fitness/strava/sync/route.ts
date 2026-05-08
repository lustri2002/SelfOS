import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  getActivityDetail,
  getActivityZones,
  getValidAccessToken,
  listAthleteActivities,
  mapActivityToWorkout,
  type StravaZoneBlock,
} from "@/lib/strava";

// Max 6 sync al minuto per utente: auto su mount + manuale devono convivere.
const limiter = createRateLimiter("strava-sync", { maxRequests: 6, windowMs: 60_000 });

interface SyncBody {
  /** Se true, ignora last_sync_at e riscansiona tutto lo storico. */
  full?: boolean;
  /** Se true, salta il debounce dei 60s post ultimo sync. */
  forceNow?: boolean;
}

/**
 * POST /api/fitness/strava/sync
 * Sincronizza le attivita' Strava verso la tabella workouts.
 * - Default: pulla le attivita' dopo `last_sync_at` (o da sempre al primo sync).
 * - `full: true` forza un backfill completo.
 * - Upsert idempotente su (user_id, source, source_id).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const rl = limiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Troppe sync consecutive, riprova tra poco" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const full = !!body.full;
  const forceNow = !!body.forceNow;

  // Carica connessione per leggere last_sync_at (debounce) e scope.
  const { data: conn, error: connErr } = await supabase
    .from("strava_connections")
    .select("last_sync_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connErr) {
    return NextResponse.json({ error: connErr.message }, { status: 500 });
  }
  if (!conn) {
    return NextResponse.json({ error: "Strava non connesso", connected: false }, { status: 400 });
  }

  // Debounce: se abbiamo sincronizzato < 60s fa e non e' forzato, skip.
  if (!forceNow && !full && conn.last_sync_at) {
    const ageMs = Date.now() - new Date(conn.last_sync_at).getTime();
    if (ageMs < 60_000) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "debounced",
        last_sync_at: conn.last_sync_at,
        imported: 0,
        updated: 0,
      });
    }
  }

  try {
    const token = await getValidAccessToken(supabase, user.id);

    // Cutoff: da quando pullare. Se full → dall'inizio (null).
    // Altrimenti: da last_sync_at (con buffer di 24h per attivita' modificate a posteriori).
    let afterEpochSec: number | null = null;
    if (!full && conn.last_sync_at) {
      const bufferedMs = new Date(conn.last_sync_at).getTime() - 24 * 3600 * 1000;
      afterEpochSec = Math.floor(Math.max(0, bufferedMs) / 1000);
    }

    const summaries = await listAthleteActivities(token, afterEpochSec, {
      maxPages: 10, // fino a 1000 attivita' — piu' che sufficiente
      perPage: 100,
    });

    let imported = 0;
    let updated = 0;
    const failed: { id: number; reason: string }[] = [];

    // Sequenziale: rispettiamo rate limit Strava (100 req/15min).
    for (const summary of summaries) {
      try {
        const detail = await getActivityDetail(token, summary.id);
        let zones: StravaZoneBlock[] | null = null;
        if (detail.has_heartrate) {
          // Zone sono opzionali: un fallimento non blocca l'import.
          try {
            zones = await getActivityZones(token, summary.id);
          } catch (err) {
            console.warn(
              `[strava/sync] zones fallite per ${summary.id}:`,
              err instanceof Error ? err.message : "unknown",
            );
          }
        }

        const mapped = mapActivityToWorkout(detail, zones);

        // Upsert sul vincolo unico parziale (user_id, source, source_id).
        const { error: upErr, data: upData } = await supabase
          .from("workouts")
          .upsert(
            {
              user_id: user.id,
              ...mapped,
              // Non toccare feeling/ai_feedback su update: sono campi utente.
            },
            { onConflict: "user_id,source,source_id", ignoreDuplicates: false },
          )
          .select("id, created_at")
          .maybeSingle();

        if (upErr) {
          failed.push({ id: summary.id, reason: upErr.message });
          continue;
        }

        // Euristica imported vs updated: se created_at e' nell'ultimo minuto,
        // e' una nuova riga.
        if (upData && Date.now() - new Date(upData.created_at).getTime() < 60_000) {
          imported += 1;
        } else {
          updated += 1;
        }
      } catch (err) {
        failed.push({
          id: summary.id,
          reason: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    const syncError = failed.length > 0
      ? `${failed.length} attivita' non importate (prima: ${failed[0].reason})`
      : null;

    await supabase
      .from("strava_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_count: imported + updated,
        last_sync_error: syncError,
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      imported,
      updated,
      failed: failed.length,
      total_seen: summaries.length,
      error: syncError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore durante la sync";
    // Registra l'errore in DB per mostrarlo in UI.
    await supabase
      .from("strava_connections")
      .update({ last_sync_error: msg })
      .eq("user_id", user.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
