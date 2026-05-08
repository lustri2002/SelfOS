import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const NOTE_UPDATE_FIELDS = new Set([
  "title",
  "content",
  "tags",
  "notebook_id",
  "project_id",
  "color",
  "emoji",
  "pinned",
  "deleted_at",
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (NOTE_UPDATE_FIELDS.has(key)) updateData[key] = value;
  }
  updateData.updated_at = new Date().toISOString();

  const { data: noteBefore } = await supabase
    .from("notes")
    .select("user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!noteBefore) {
    return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("notes")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, content, tags, pinned, updated_at, created_at, notebook_id, color, emoji, deleted_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.create_version === true && typeof body.title === "string" && body.content) {
    await supabase.from("note_versions").insert({
      note_id: id,
      user_id: user.id,
      title: body.title,
      content: body.content as Json,
    });
  }

  return NextResponse.json({ note: data });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Nota mancante" }, { status: 400 });
  }

  const permanent = new URL(request.url).searchParams.get("permanent") === "true";
  const query = permanent
    ? supabase.from("notes").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle()
    : supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
