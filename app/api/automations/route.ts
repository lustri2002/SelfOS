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
    .from("automation_rules")
    .insert({
      user_id: user.id,
      name,
      trigger_type: typeof body.trigger_type === "string" ? body.trigger_type : "daily_briefing",
      condition_config: typeof body.condition_config === "object" && body.condition_config ? body.condition_config : {},
      action_type: typeof body.action_type === "string" ? body.action_type : "surface_in_command_center",
      action_config: typeof body.action_config === "object" && body.action_config ? body.action_config : {},
      is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automation: data });
}
