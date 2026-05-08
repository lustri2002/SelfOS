import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await request.json()) as {
    account_id?: unknown;
    balance?: unknown;
    snapshot_month?: unknown;
  };

  const accountId = typeof body.account_id === "string" ? body.account_id : "";
  const month = typeof body.snapshot_month === "string" ? body.snapshot_month.slice(0, 7) : "";
  const balance = typeof body.balance === "number" ? body.balance : Number(body.balance);

  if (!accountId || !/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(balance)) {
    return NextResponse.json({ error: "Dati saldo non validi" }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  if (!account) {
    return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
  }

  const { data: row, error } = await supabase
    .from("balance_snapshots")
    .upsert(
      { account_id: accountId, balance, snapshot_month: month, user_id: user.id },
      { onConflict: "account_id,snapshot_month" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snapshot: row });
}
