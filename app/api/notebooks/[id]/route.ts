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
    return NextResponse.json({ error: "Notebook mancante" }, { status: 400 });
  }

  const { data: notebook, error: notebookError } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (notebookError) {
    return NextResponse.json({ error: notebookError.message }, { status: 500 });
  }

  if (!notebook) {
    return NextResponse.json({ error: "Notebook non trovato" }, { status: 404 });
  }

  const { error: childError } = await supabase
    .from("notebooks")
    .update({ parent_id: null })
    .eq("parent_id", id)
    .eq("user_id", user.id);

  if (childError) {
    return NextResponse.json({ error: childError.message }, { status: 500 });
  }

  const { error: notesError } = await supabase
    .from("notes")
    .update({ notebook_id: null })
    .eq("notebook_id", id)
    .eq("user_id", user.id);

  if (notesError) {
    return NextResponse.json({ error: notesError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("notebooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
