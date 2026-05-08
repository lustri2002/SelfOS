import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import NotesListLazy from "@/components/notes/NotesListLazy";

export default async function NotesPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const [{ data: notes }, { data: notebooks }, { data: templates }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, tags, pinned, updated_at, created_at, notebook_id, color, emoji")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("notebooks")
      .select("id, name, area, parent_id")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("note_templates")
      .select("id, name, content, tags")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  return (
    <NotesListLazy
      notes={notes ?? []}
      notebooks={notebooks ?? []}
      templates={templates ?? []}
    />
  );
}
