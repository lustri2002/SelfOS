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
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      color: typeof body.color === "string" ? body.color : "indigo",
      emoji: typeof body.emoji === "string" ? body.emoji : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
