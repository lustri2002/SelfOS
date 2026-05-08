import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Progetto mancante" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  }

  const { error: tasksError } = await supabase
    .from("tasks")
    .update({ project_id: null })
    .eq("project_id", id)
    .eq("user_id", user.id);

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  await supabase
    .from("notes")
    .update({ project_id: null })
    .eq("project_id", id)
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
