import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import UniversityDashboardLazy from "@/components/university/UniversityDashboardLazy";
import { getDefaultUniversitySettings } from "@/lib/university/default-data";
import type { Database } from "@/types/database";

type Settings = Database["public"]["Tables"]["university_settings"]["Row"];
type Exam = Database["public"]["Tables"]["university_exams"]["Row"];

export default async function UniversityPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const uid = user.id;

  const [{ data: initialSettings }, { data: exams }] = await Promise.all([
    supabase.from("university_settings").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("university_exams").select("*").eq("user_id", uid).order("year").order("sort_order").order("name"),
  ]);
  let settings = initialSettings;

  if (!settings) {
    const { data } = await supabase
      .from("university_settings")
      .insert(getDefaultUniversitySettings(uid))
      .select("*")
      .single();
    settings = data;
  }

  return (
    <UniversityDashboardLazy
      settings={settings as Settings}
      exams={(exams ?? []) as Exam[]}
    />
  );
}
