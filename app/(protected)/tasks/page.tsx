import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import TaskManagerLazy from "@/components/tasks/TaskManagerLazy";
import type { Database } from "@/types/database";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];
type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];

export default async function TasksPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const [{ data: tasks }, { data: projects }, { data: notes }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, subtasks(*)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("name"),
    supabase
      .from("notes")
      .select("id, title")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <TaskManagerLazy
      initialTasks={(tasks ?? []) as (Task & { subtasks: Subtask[] })[]}
      initialProjects={(projects ?? []) as Project[]}
      notes={(notes ?? []) as { id: string; title: string }[]}
    />
  );
}
