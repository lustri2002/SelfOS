import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const { data, error } = await supabase
    .from("automation_rules")
    .update({
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      trigger_type: typeof body.trigger_type === "string" ? body.trigger_type : undefined,
      condition_config: typeof body.condition_config === "object" && body.condition_config ? body.condition_config : undefined,
      action_type: typeof body.action_type === "string" ? body.action_type : undefined,
      action_config: typeof body.action_config === "object" && body.action_config ? body.action_config : undefined,
      is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automation: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await context.params;
  const { error } = await supabase.from("automation_rules").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
