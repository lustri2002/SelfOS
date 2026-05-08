import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl } from "@/lib/strava";

/**
 * GET /api/fitness/strava/connect
 * Inizia il flow OAuth: genera uno state CSRF in cookie e redireziona a Strava.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let url: string;
  try {
    const state = randomBytes(16).toString("hex");
    url = buildAuthorizeUrl(state);
    const response = NextResponse.redirect(url, { status: 302 });
    // httpOnly + SameSite=Lax: il callback arriva come GET cross-site da Strava
    // (top-level navigation), quindi Lax e' il minimo necessario.
    response.cookies.set("strava_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60, // 10 minuti
    });
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore configurazione Strava";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
