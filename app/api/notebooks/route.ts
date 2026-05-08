import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome mancante" }, { status: 400 });

  const { data, error } = await supabase
    .from("notebooks")
    .insert({
      user_id: user.id,
      name,
      parent_id: typeof body.parent_id === "string" && body.parent_id ? body.parent_id : null,
    })
    .select("id, name, area, parent_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notebook: data });
}
