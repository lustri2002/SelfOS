import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOwnedSubtask(supabase: Awaited<ReturnType<typeof createClient>>, subtaskId: string, userId: string) {
  const { data, error } = await supabase
    .from("subtasks")
    .select("id, task_id, tasks!inner(user_id)")
    .eq("id", subtaskId)
    .eq("tasks.user_id", userId)
    .maybeSingle();

  return error ? null : data;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const owned = await getOwnedSubtask(supabase, id, user.id);
  if (!owned) return NextResponse.json({ error: "Subtask non trovato" }, { status: 404 });

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") updateData.completed = body.completed;
  if (typeof body.title === "string") updateData.title = body.title;

  const { data, error } = await supabase
    .from("subtasks")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subtask: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const owned = await getOwnedSubtask(supabase, id, user.id);
  if (!owned) return NextResponse.json({ error: "Subtask non trovato" }, { status: 404 });

  const { error } = await supabase.from("subtasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
