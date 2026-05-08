import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireOwnedReminder(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from("note_reminders")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  if (!(await requireOwnedReminder(supabase, id, user.id))) return NextResponse.json({ error: "Promemoria non trovato" }, { status: 404 });

  const body = await request.json();
  const { error } = await supabase
    .from("note_reminders")
    .update({ dismissed: body.dismissed === true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  if (!(await requireOwnedReminder(supabase, id, user.id))) return NextResponse.json({ error: "Promemoria non trovato" }, { status: 404 });

  const { error } = await supabase.from("note_reminders").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
