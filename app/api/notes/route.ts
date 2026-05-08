import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTiptapDoc, isTiptapDoc } from "@/lib/tiptap/document";
import type { Json } from "@/types/database";

type CreateNoteBody = {
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  notebook_id?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = (await request.json()) as CreateNoteBody;
  const notebookId = typeof body.notebook_id === "string" && body.notebook_id ? body.notebook_id : null;
  const content = isTiptapDoc(body.content) ? body.content : createTiptapDoc();

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      title: typeof body.title === "string" ? body.title : "Nuova nota",
      content: content as Json,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [],
      notebook_id: notebookId,
    })
    .select("id, title, content, tags, pinned, updated_at, created_at, notebook_id, color, emoji")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}
