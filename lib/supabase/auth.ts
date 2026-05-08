import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireUser(supabase?: ServerSupabaseClient) {
  if (!supabase) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    return user;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}
