import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import TrashViewLazy from "@/components/notes/TrashViewLazy";

export default async function TrashPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, tags, deleted_at")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return <TrashViewLazy notes={notes ?? []} />;
}
