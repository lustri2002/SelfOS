import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import { applyDueInvestmentPlans, syncInvestmentPricesForUser } from "@/lib/finance/investments";
import FinanceDashboardLazy from "@/components/finance/FinanceDashboardLazy";
import type { Database } from "@/types/database";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Snapshot = Database["public"]["Tables"]["balance_snapshots"]["Row"];
type Recurring = Database["public"]["Tables"]["recurring_expenses"]["Row"];
type Commitment = Database["public"]["Tables"]["financial_commitments"]["Row"];
type Income = Database["public"]["Tables"]["monthly_income"]["Row"];
type MonthlyNote = Database["public"]["Tables"]["monthly_notes"]["Row"];
type BudgetCycle = Database["public"]["Tables"]["budget_cycles"]["Row"];
type InvestmentInstrument = Database["public"]["Tables"]["investment_instruments"]["Row"];
type InvestmentTransaction = Database["public"]["Tables"]["investment_transactions"]["Row"];
type InvestmentRecurringPlan = Database["public"]["Tables"]["investment_recurring_plans"]["Row"];

const AUTO_PAYMENT_TIME_ZONE = "Europe/Rome";

function getTodayParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AUTO_PAYMENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.year);
  const month = Number(byType.month);
  const day = Number(byType.day);

  return {
    year,
    month,
    day,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}`;
}

function monthsToAutoPay(lastAutoPaidMonth: string | null, currentMonth: string, includeCurrentMonth: boolean) {
  if (!lastAutoPaidMonth) return includeCurrentMonth ? [currentMonth] : [];

  const months: string[] = [];
  let cursor = nextMonthKey(lastAutoPaidMonth);
  while (cursor <= currentMonth) {
    if (cursor === currentMonth && !includeCurrentMonth) break;
    months.push(cursor);
    cursor = nextMonthKey(cursor);
  }
  return months;
}

async function applyDueCommitmentPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const today = getTodayParts();
  const lastDay = new Date(today.year, today.month, 0).getDate();

  const { data: dueCommitments } = await supabase
    .from("financial_commitments")
    .select("id, monthly_payment, total_installments, paid_installments, due_day, last_auto_paid_month")
    .eq("user_id", userId)
    .eq("is_active", true)
    .neq("goal_type", "savings")
    .not("total_installments", "is", null)
    .not("due_day", "is", null);

  await Promise.all((dueCommitments ?? []).map(async (commitment) => {
    const dueDay = Math.min(commitment.due_day ?? 31, lastDay);
    const dueReached = today.day >= dueDay;
    const dueMonths = monthsToAutoPay(commitment.last_auto_paid_month, today.monthKey, dueReached);
    const totalInstallments = commitment.total_installments ?? 0;
    const remainingInstallments = Math.max(0, totalInstallments - commitment.paid_installments);
    const installmentsToPay = Math.min(dueMonths.length, remainingInstallments);

    if (installmentsToPay <= 0) return;

    const paidInstallments = commitment.paid_installments + installmentsToPay;
    const remainingAmount = Math.max(0, (totalInstallments - paidInstallments) * Number(commitment.monthly_payment));

    await supabase
      .from("financial_commitments")
      .update({
        paid_installments: paidInstallments,
        remaining_amount: remainingAmount,
        last_auto_paid_month: dueMonths[installmentsToPay - 1],
      })
      .eq("id", commitment.id)
      .eq("user_id", userId);
  }));
}

export default async function FinancePage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const uid = user.id;

  await applyDueCommitmentPayments(supabase, uid);
  await syncInvestmentPricesForUser(supabase, uid).catch(() => null);
  await applyDueInvestmentPlans(supabase, uid).catch(() => null);

  const [
    { data: accounts },
    { data: snapshots },
    { data: recurring },
    { data: commitments },
    { data: income },
    { data: monthlyNotes },
    { data: budgetCycles },
    { data: investmentInstruments },
    { data: investmentTransactions },
    { data: investmentPlans },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", uid).eq("is_active", true),
    supabase.from("balance_snapshots").select("*").eq("user_id", uid).order("snapshot_month", { ascending: true }),
    supabase.from("recurring_expenses").select("*").eq("user_id", uid).eq("is_active", true),
    supabase.from("financial_commitments").select("*").eq("user_id", uid).eq("is_active", true),
    supabase.from("monthly_income").select("*").eq("user_id", uid).order("month", { ascending: false }),
    supabase.from("monthly_notes").select("*").eq("user_id", uid).order("month", { ascending: false }),
    supabase.from("budget_cycles").select("*").eq("user_id", uid).order("month", { ascending: false }),
    supabase.from("investment_instruments").select("*").eq("user_id", uid).order("name", { ascending: true }),
    supabase.from("investment_transactions").select("*").eq("user_id", uid).order("trade_date", { ascending: false }),
    supabase.from("investment_recurring_plans").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
  ]);

  return (
    <FinanceDashboardLazy
      userId={uid}
      accounts={(accounts ?? []) as Account[]}
      snapshots={(snapshots ?? []) as Snapshot[]}
      recurring={(recurring ?? []) as Recurring[]}
      commitments={(commitments ?? []) as Commitment[]}
      income={(income ?? []) as Income[]}
      monthlyNotes={(monthlyNotes ?? []) as MonthlyNote[]}
      budgetCycles={(budgetCycles ?? []) as BudgetCycle[]}
      investmentInstruments={(investmentInstruments ?? []) as InvestmentInstrument[]}
      investmentTransactions={(investmentTransactions ?? []) as InvestmentTransaction[]}
      investmentPlans={(investmentPlans ?? []) as InvestmentRecurringPlan[]}
    />
  );
}
