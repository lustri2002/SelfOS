import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Titolo mancante" }, { status: 400 });

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      description: typeof body.description === "string" ? body.description : "",
      priority: body.priority ?? "medium",
      project_id: typeof body.project_id === "string" && body.project_id ? body.project_id : null,
      note_id: typeof body.note_id === "string" && body.note_id ? body.note_id : null,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [],
      recurring: body.recurring ?? null,
      due_date: typeof body.due_date === "string" ? body.due_date : null,
    })
    .select("*, subtasks(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
