import GoalsOperatingSystem from "@/components/goals/GoalsOperatingSystem";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

export default async function GoalsPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const [{ data: goals }, { data: projects }] = await Promise.all([
    supabase.from("goals").select("*").eq("user_id", user.id).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("projects").select("*").eq("user_id", user.id).eq("archived", false).order("name"),
  ]);

  return (
    <GoalsOperatingSystem
      initialGoals={(goals ?? []) as Goal[]}
      projects={(projects ?? []) as Project[]}
    />
  );
}
