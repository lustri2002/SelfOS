import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

const TASK_UPDATE_FIELDS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "due_date",
  "tags",
  "sort_order",
  "recurring",
  "note_id",
  "project_id",
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (TASK_UPDATE_FIELDS.has(key)) updateData[key] = value;
  }

  if (updateData.status === "done") {
    updateData.completed_at = new Date().toISOString();
  } else if (typeof updateData.status === "string") {
    updateData.completed_at = null;
  }

  const { data: taskBefore, error: readError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!taskBefore) return NextResponse.json({ error: "Task non trovato" }, { status: 404 });
  const previousTask = taskBefore as TaskRow;

  const { data: task, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, subtasks(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let recurringTask = null;
  if (updateData.status === "done" && previousTask.recurring && previousTask.due_date) {
    const nextDate = new Date(previousTask.due_date);
    if (previousTask.recurring === "daily") nextDate.setDate(nextDate.getDate() + 1);
    if (previousTask.recurring === "weekly") nextDate.setDate(nextDate.getDate() + 7);
    if (previousTask.recurring === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);

    const { data: created } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: previousTask.title,
        description: previousTask.description,
        priority: previousTask.priority,
        project_id: previousTask.project_id,
        tags: previousTask.tags,
        recurring: previousTask.recurring,
        due_date: nextDate.toISOString(),
      })
      .select("*, subtasks(*)")
      .single();
    recurringTask = created;
  }

  return NextResponse.json({ task, recurringTask });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Task non trovato" }, { status: 404 });
  return NextResponse.json({ success: true });
}
