import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/strava";
import { encryptSecret } from "@/lib/crypto";

/**
 * GET /api/fitness/strava/callback
 * Strava redireziona qui dopo l'autorizzazione. Scambia il code con i token,
 * li cifra, salva la connessione e rimanda l'utente a /fitness con un flag.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const scope = url.searchParams.get("scope") ?? "";

  const redirectHome = (params: Record<string, string>) => {
    const base = new URL("/fitness", url.origin);
    Object.entries(params).forEach(([k, v]) => base.searchParams.set(k, v));
    const res = NextResponse.redirect(base, { status: 302 });
    // Consuma lo state cookie.
    res.cookies.set("strava_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (error) {
    return redirectHome({ strava: "error", reason: error });
  }
  if (!code || !state) {
    return redirectHome({ strava: "error", reason: "missing_code" });
  }

  const storedState = req.cookies.get("strava_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return redirectHome({ strava: "error", reason: "state_mismatch" });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirectHome({ strava: "error", reason: "not_authenticated" });
  }

  // Verifica scope minimo: ci serve almeno "activity:read_all" per le attivita' private.
  if (!scope.includes("activity:read_all")) {
    return redirectHome({ strava: "error", reason: "missing_scope" });
  }

  try {
    const tok = await exchangeCodeForTokens(code);
    const expiresAt = new Date(tok.expires_at * 1000).toISOString();

    const { error: upErr } = await supabase
      .from("strava_connections")
      .upsert(
        {
          user_id: user.id,
          athlete_id: tok.athlete?.id ?? 0,
          athlete_firstname: tok.athlete?.firstname ?? null,
          athlete_lastname: tok.athlete?.lastname ?? null,
          access_token_enc: encryptSecret(tok.access_token),
          refresh_token_enc: encryptSecret(tok.refresh_token),
          expires_at: expiresAt,
          scope,
          last_sync_error: null,
        },
        { onConflict: "user_id" },
      );

    if (upErr) {
      console.error("[strava/callback] upsert error:", upErr.message);
      return redirectHome({ strava: "error", reason: "db_error" });
    }

    return redirectHome({ strava: "connected" });
  } catch (err) {
    console.error("[strava/callback]", err instanceof Error ? err.message : "unknown");
    return redirectHome({ strava: "error", reason: "exchange_failed" });
  }
}
