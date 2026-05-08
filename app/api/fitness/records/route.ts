import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WORKOUT_FIELDS = [
  "date", "type", "distance_km", "duration_minutes", "avg_pace", "best_pace", "calories",
  "avg_heart_rate", "max_heart_rate", "avg_cadence", "elevation_m", "steps", "feeling",
  "notes", "intervals", "training_effect_aerobic", "training_effect_anaerobic", "source",
  "hr_zones", "max_cadence", "avg_stride_cm", "max_stride_cm", "vo2_max", "recovery_hours",
  "ai_feedback", "ai_feedback_generated_at",
];

const METRIC_FIELDS = ["date", "weight_kg", "body_fat_pct", "waist_cm", "resting_hr", "height_cm", "notes"];

function pick(data: Record<string, unknown>, fields: string[]) {
  const allowed = new Set(fields);
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key)));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json();
  const action = body.action;

  if (action === "upsert_metric") {
    const payload = pick((body.data ?? {}) as Record<string, unknown>, METRIC_FIELDS) as { date: string };
    const { data, error } = await supabase
      .from("body_metrics")
      .upsert({ ...payload, user_id: user.id }, { onConflict: "user_id,date" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (action === "delete_metric") {
    const { error } = await supabase.from("body_metrics").delete().eq("id", body.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "insert_workout") {
    const payload = pick((body.data ?? {}) as Record<string, unknown>, WORKOUT_FIELDS) as { date: string };
    const { data, error } = await supabase.from("workouts").insert({ ...payload, user_id: user.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (action === "update_workout") {
    const payload = pick((body.data ?? {}) as Record<string, unknown>, WORKOUT_FIELDS);
    const { data, error } = await supabase
      .from("workouts")
      .update(payload)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (action === "delete_workout") {
    const { error } = await supabase.from("workouts").delete().eq("id", body.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "save_coach_preferences") {
    const { error } = await supabase
      .from("fitness_coach_preferences")
      .upsert({
        user_id: user.id,
        goal: typeof body.goal === "string" && body.goal.trim() ? body.goal.trim() : null,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, saved_at: new Date().toISOString() });
  }

  if (action === "create_training_plan") {
    const { data: plan, error } = await supabase
      .from("training_plans")
      .insert({
        user_id: user.id,
        goal: typeof body.goal === "string" && body.goal ? body.goal : null,
        notes: typeof body.notes === "string" && body.notes ? body.notes : null,
        plan: typeof body.plan === "string" ? body.plan : "",
        week_start: body.week_start,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const savedPlan = plan as { id: string };

    let plannedWorkouts: unknown[] = [];
    if (Array.isArray(body.workouts) && body.workouts.length > 0) {
      const inserts = body.workouts.map((w: Record<string, unknown>, i: number) => ({
        plan_id: savedPlan.id,
        user_id: user.id,
        day_label: typeof w.day === "string" && w.day ? w.day : `Giorno ${i + 1}`,
        workout_type: typeof w.type === "string" && w.type ? w.type : "easy_run",
        title: typeof w.title === "string" && w.title ? w.title : "Allenamento",
        description: typeof w.description === "string" && w.description ? w.description : null,
        distance_km: typeof w.distance_km === "number" ? w.distance_km : null,
        duration_minutes: typeof w.duration_minutes === "number" ? w.duration_minutes : null,
        pace_target: typeof w.pace_target === "string" ? w.pace_target : null,
        sort_order: i,
      }));
      const { data } = await supabase.from("planned_workouts").insert(inserts).select();
      plannedWorkouts = data ?? [];
    }

    return NextResponse.json({ plan, plannedWorkouts });
  }

  if (action === "delete_training_plan") {
    const { error } = await supabase.from("training_plans").delete().eq("id", body.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "update_planned_workout") {
    const { data, error } = await supabase
      .from("planned_workouts")
      .update({ actual_workout_id: body.actual_workout_id ?? null })
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
}
