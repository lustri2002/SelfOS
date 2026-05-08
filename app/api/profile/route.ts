import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (!displayName) return NextResponse.json({ error: "Nome mancante" }, { status: 400 });

  const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
