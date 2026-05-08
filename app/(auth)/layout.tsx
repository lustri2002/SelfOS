import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/home");

  return <>{children}</>;
}
