import HelpViewLazy from "@/components/help/HelpViewLazy";
import { requireUser } from "@/lib/supabase/auth";

export default async function HelpPage() {
  await requireUser();

  return <HelpViewLazy />;
}
