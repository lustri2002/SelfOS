import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome mancante" }, { status: 400 });

  const { data, error } = await supabase
    .from("note_templates")
    .insert({
      user_id: user.id,
      name,
      content: (body.content ?? {}) as Json,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [],
    })
    .select("id, name, content, tags")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
