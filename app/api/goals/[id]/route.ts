import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const patch = {
    title: typeof body.title === "string" ? body.title.trim() : undefined,
    area: typeof body.area === "string" ? body.area : undefined,
    horizon: typeof body.horizon === "string" ? body.horizon : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    target_value: body.target_value === "" ? null : body.target_value == null ? undefined : Number(body.target_value),
    current_value: body.current_value === "" ? 0 : body.current_value == null ? undefined : Number(body.current_value),
    unit: typeof body.unit === "string" ? body.unit.trim() || null : undefined,
    due_date: typeof body.due_date === "string" ? body.due_date || null : undefined,
    linked_project_id: typeof body.linked_project_id === "string" ? body.linked_project_id || null : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
