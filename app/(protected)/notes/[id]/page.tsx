import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import NoteEditorClient from "@/components/notes/NoteEditorClient";
import type { Database } from "@/types/database";

type Note = Database["public"]["Tables"]["notes"]["Row"];
type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NotePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const [{ data: note }, { data: notebooks }, { data: projects }] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("notebooks")
      .select("*")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("name"),
  ]);

  if (!note) notFound();

  return (
    <NoteEditorClient
      note={note as Note}
      notebooks={(notebooks ?? []) as Notebook[]}
      projects={(projects ?? []) as Project[]}
    />
  );
}
