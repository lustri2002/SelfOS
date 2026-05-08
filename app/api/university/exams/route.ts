import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EXAM_FIELDS = ["name", "cfu", "grade", "honors", "status", "exam_type", "year", "area", "exam_date", "counts_avg", "sort_order"];

function pickExam(data: Record<string, unknown>) {
  const allowed = new Set(EXAM_FIELDS);
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key)));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();

  if (body.action === "replace_all") {
    const exams = Array.isArray(body.exams)
      ? body.exams.map((exam: Record<string, unknown>) => ({ ...pickExam(exam), user_id: user.id }))
      : [];
    await supabase.from("university_exams").delete().eq("user_id", user.id);
    const { data, error } = await supabase
      .from("university_exams")
      .insert(exams)
      .select("*")
      .order("year")
      .order("sort_order")
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exams: data ?? [] });
  }

  const payload = pickExam((body.data ?? {}) as Record<string, unknown>) as { name: string; cfu: number };
  if (body.id) {
    const { data, error } = await supabase
      .from("university_exams")
      .update(payload)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exam: data });
  }

  const { data, error } = await supabase
    .from("university_exams")
    .insert({ ...payload, user_id: user.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exam: data });
}
