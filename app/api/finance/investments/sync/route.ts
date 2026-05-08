import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { applyDueInvestmentPlans, syncInvestmentPricesForUser } from "@/lib/finance/investments";

const limiter = createRateLimiter("investment-sync", { maxRequests: 4, windowMs: 60_000 });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const rl = limiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Troppe sync consecutive, riprova tra poco" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { force?: boolean; applyPac?: boolean };

  try {
    const prices = await syncInvestmentPricesForUser(supabase, user.id, { force: !!body.force });
    const pac = body.applyPac === false ? null : await applyDueInvestmentPlans(supabase, user.id);
    return NextResponse.json({ success: true, prices, pac });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync investimenti non riuscita" },
      { status: 500 },
    );
  }
}
