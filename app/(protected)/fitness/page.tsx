import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import FitnessTrackerLazy from "@/components/fitness/FitnessTrackerLazy";
import type { Database } from "@/types/database";

type Workout = Database["public"]["Tables"]["workouts"]["Row"];
type TrainingPlan = Database["public"]["Tables"]["training_plans"]["Row"];
type PlannedWorkout = Database["public"]["Tables"]["planned_workouts"]["Row"];
type BodyMetric = Database["public"]["Tables"]["body_metrics"]["Row"];
type CoachPreferences = Database["public"]["Tables"]["fitness_coach_preferences"]["Row"];

export default async function FitnessPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const uid = user.id;

  const [
    { data: workouts },
    { data: trainingPlans },
    { data: plannedWorkouts },
    { data: bodyMetrics },
    { data: coachPreferences },
  ] = await Promise.all([
    supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: false }),
    supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("planned_workouts")
      .select("*")
      .eq("user_id", uid)
      .order("sort_order", { ascending: true }),
    supabase
      .from("body_metrics")
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: true }),
    supabase
      .from("fitness_coach_preferences")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle(),
  ]);

  return (
    <FitnessTrackerLazy
      workouts={(workouts ?? []) as Workout[]}
      trainingPlans={(trainingPlans ?? []) as TrainingPlan[]}
      plannedWorkouts={(plannedWorkouts ?? []) as PlannedWorkout[]}
      bodyMetrics={(bodyMetrics ?? []) as BodyMetric[]}
      coachPreferences={(coachPreferences ?? null) as CoachPreferences | null}
    />
  );
}
