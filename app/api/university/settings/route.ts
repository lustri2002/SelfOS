import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const body = await request.json();

  const payload = {
    user_id: user.id,
    student_name: typeof body.student_name === "string" ? body.student_name.trim() : "",
    student_number: typeof body.student_number === "string" ? body.student_number.trim() : "",
    degree_course: typeof body.degree_course === "string" && body.degree_course.trim() ? body.degree_course.trim() : "Percorso di studio",
    total_cfu: Math.max(1, toNumber(body.total_cfu, 180)),
    bonus_points: Math.max(0, toNumber(body.bonus_points, 0)),
    honors_value: Math.max(30, toNumber(body.honors_value, 31)),
  };

  const { data, error } = await supabase
    .from("university_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
