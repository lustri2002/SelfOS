import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  const uid = user.id;

  const [
    { data: notes },
    { data: notebooks },
    { data: accounts },
    { data: snapshots },
    { data: recurring },
    { data: commitments },
  ] = await Promise.all([
    supabase.from("notes").select("*").eq("user_id", uid),
    supabase.from("notebooks").select("*").eq("user_id", uid),
    supabase.from("accounts").select("*").eq("user_id", uid),
    supabase.from("balance_snapshots").select("*").eq("user_id", uid),
    supabase.from("recurring_expenses").select("*").eq("user_id", uid),
    supabase.from("financial_commitments").select("*").eq("user_id", uid),
  ]);

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    notes,
    notebooks,
    accounts,
    snapshots,
    recurring,
    commitments,
  });
}
