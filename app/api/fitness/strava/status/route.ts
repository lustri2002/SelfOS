import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/fitness/strava/status
 * Stato della connessione Strava dell'utente (per UI).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("strava_connections")
    .select(
      "athlete_firstname, athlete_lastname, last_sync_at, last_sync_count, last_sync_error, scope",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    athlete_name: [data.athlete_firstname, data.athlete_lastname].filter(Boolean).join(" "),
    last_sync_at: data.last_sync_at,
    last_sync_count: data.last_sync_count,
    last_sync_error: data.last_sync_error,
    scope: data.scope,
  });
}
