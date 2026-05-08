import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const noteId = typeof body.note_id === "string" ? body.note_id : "";
  const remindAt = typeof body.remind_at === "string" ? body.remind_at : "";
  if (!noteId || !remindAt) return NextResponse.json({ error: "Dati promemoria mancanti" }, { status: 400 });

  const { data: note } = await supabase.from("notes").select("id").eq("id", noteId).eq("user_id", user.id).maybeSingle();
  if (!note) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });

  await supabase.from("note_reminders").delete().eq("note_id", noteId).eq("user_id", user.id).eq("dismissed", false);

  const { data, error } = await supabase
    .from("note_reminders")
    .insert({ note_id: noteId, user_id: user.id, remind_at: remindAt })
    .select("id, remind_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}
