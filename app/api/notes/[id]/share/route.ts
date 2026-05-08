import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { data } = await supabase
    .from("shared_notes")
    .select("token")
    .eq("note_id", id)
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return NextResponse.json({ token: data?.token ?? null });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { data: note } = await supabase.from("notes").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!note) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });

  const { data, error } = await supabase
    .from("shared_notes")
    .insert({ note_id: id, user_id: user.id })
    .select("token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token: data.token });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { error } = await supabase.from("shared_notes").delete().eq("note_id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
