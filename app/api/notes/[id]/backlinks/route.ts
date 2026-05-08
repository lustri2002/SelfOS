import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/utils/extract-text";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { data: note } = await supabase.from("notes").select("id, title").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!note) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 });

  const { data } = await supabase
    .from("notes")
    .select("id, title, content")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .neq("id", id);

  const backlinks = (data ?? [])
    .filter((candidate) => {
      const text = extractText(candidate.content);
      return text.includes(`[[${note.title}]]`) || JSON.stringify(candidate.content).includes(`"href":"${note.title}"`);
    })
    .map((candidate) => ({ id: candidate.id, title: candidate.title }));

  return NextResponse.json({ backlinks });
}
