import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Titolo mancante" }, { status: 400 });

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title,
      area: typeof body.area === "string" ? body.area : "growth",
      horizon: typeof body.horizon === "string" ? body.horizon : "quarter",
      status: typeof body.status === "string" ? body.status : "active",
      target_value: body.target_value === "" || body.target_value == null ? null : Number(body.target_value),
      current_value: body.current_value === "" || body.current_value == null ? 0 : Number(body.current_value),
      unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : null,
      due_date: typeof body.due_date === "string" && body.due_date ? body.due_date : null,
      linked_project_id: typeof body.linked_project_id === "string" && body.linked_project_id ? body.linked_project_id : null,
      notes: typeof body.notes === "string" ? body.notes : "",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}
