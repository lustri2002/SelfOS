import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyDueInvestmentPlans, syncInvestmentPricesForUser } from "@/lib/finance/investments";

function isAuthorized(request: NextRequest) {
  const secret = process.env.FINANCE_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: plans, error } = await supabase
    .from("investment_recurring_plans")
    .select("user_id")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = Array.from(new Set((plans ?? []).map((plan) => plan.user_id)));
  const results = [];
  for (const userId of userIds) {
    try {
      const prices = await syncInvestmentPricesForUser(supabase, userId);
      const pac = await applyDueInvestmentPlans(supabase, userId);
      results.push({ userId, prices, pac });
    } catch (err) {
      results.push({ userId, error: err instanceof Error ? err.message : "Errore sconosciuto" });
    }
  }

  return NextResponse.json({ success: true, users: userIds.length, results });
}
