import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE_FIELDS = {
  monthly_income: ["month", "budget_month", "label", "amount"],
  recurring_expenses: ["name", "amount", "frequency", "category", "next_due_date", "is_active"],
  financial_commitments: [
    "name", "type", "original_amount", "remaining_amount", "monthly_payment", "interest_rate", "end_date",
    "currency", "is_active", "goal_type", "target_amount", "current_saved", "total_installments",
    "paid_installments", "due_day", "last_auto_paid_month",
  ],
  accounts: ["name", "type", "currency", "is_active"],
  monthly_notes: ["month", "note", "updated_at"],
  budget_cycles: ["month", "planned_savings", "planned_variable_spending", "notes", "updated_at"],
  investment_instruments: [
    "symbol", "exchange", "isin", "name", "currency", "provider", "provider_symbol",
    "last_price", "last_price_at", "last_price_source",
  ],
  investment_transactions: [
    "account_id", "instrument_id", "recurring_plan_id", "type", "trade_date", "shares",
    "price", "fees", "currency", "source",
  ],
  investment_recurring_plans: [
    "account_id", "instrument_id", "name", "day_of_month", "amount", "currency",
    "is_active", "start_month", "last_executed_month",
  ],
} as const;

type FinanceTable = keyof typeof TABLE_FIELDS;

function isFinanceTable(value: unknown): value is FinanceTable {
  return typeof value === "string" && value in TABLE_FIELDS;
}

function pickAllowed(table: FinanceTable, data: Record<string, unknown>) {
  const allowed = new Set<string>(TABLE_FIELDS[table]);
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key)));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  if (!isFinanceTable(body.table)) return NextResponse.json({ error: "Tabella non valida" }, { status: 400 });
  const table = body.table;
  const action = body.action;
  const payload = pickAllowed(table, (body.data ?? {}) as Record<string, unknown>);

  if (action === "insert") {
    const { data, error } = await supabase
      .from(table)
      .insert({ ...payload, user_id: user.id })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (action === "update") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "ID mancante" }, { status: 400 });
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (action === "delete") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "ID mancante" }, { status: 400 });
    const { error } = await supabase.from(table).delete().eq("id", body.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "upsert_monthly_note") {
    const month = typeof payload.month === "string" ? payload.month : "";
    const note = typeof payload.note === "string" ? payload.note : "";
    if (!month) return NextResponse.json({ error: "Mese mancante" }, { status: 400 });
    const { data, error } = await supabase
      .from("monthly_notes")
      .upsert({ user_id: user.id, month, note, updated_at: new Date().toISOString() }, { onConflict: "user_id,month" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (action === "upsert_budget_cycle") {
    const month = typeof payload.month === "string" ? payload.month : "";
    if (!month) return NextResponse.json({ error: "Mese mancante" }, { status: 400 });
    const { data, error } = await supabase
      .from("budget_cycles")
      .upsert({
        user_id: user.id,
        month,
        planned_savings: Number(payload.planned_savings ?? 0),
        planned_variable_spending: Number(payload.planned_variable_spending ?? 0),
        notes: typeof payload.notes === "string" ? payload.notes : "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,month" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
}
