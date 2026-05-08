import AutomationStudio from "@/components/automation/AutomationStudio";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Automation = Database["public"]["Tables"]["automation_rules"]["Row"];

export default async function AutomationPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <AutomationStudio initialAutomations={(data ?? []) as Automation[]} />;
}
