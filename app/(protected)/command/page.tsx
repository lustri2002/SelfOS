import CommandCenter from "@/components/command/CommandCenter";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Automation = Database["public"]["Tables"]["automation_rules"]["Row"];
type Recurring = Database["public"]["Tables"]["recurring_expenses"]["Row"];
type Commitment = Database["public"]["Tables"]["financial_commitments"]["Row"];

interface ReminderJoin {
  id: string;
  note_id: string;
  remind_at: string;
  notes: { title: string } | { title: string }[] | null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function CommandPage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const uid = user.id;
  const now = new Date();
  const today = dateKey(now);
  const tomorrow = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const weekStart = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14).toISOString().slice(0, 10);

  const [
    { data: tasks },
    { data: remindersRaw },
    { data: goals },
    { data: automations },
    { data: snapshots },
    { data: income },
    { data: recurring },
    { data: commitments },
    { data: workouts },
    { data: habits },
    { data: habitEntries },
    { data: exams },
  ] = await Promise.all([
    supabase.from("tasks").select("id, title, priority, status, due_date").eq("user_id", uid).is("deleted_at", null).neq("status", "done").not("due_date", "is", null).lt("due_date", tomorrow).order("due_date"),
    supabase.from("note_reminders").select("id, note_id, remind_at, notes(title)").eq("user_id", uid).eq("dismissed", false).gte("remind_at", now.toISOString()).order("remind_at").limit(6),
    supabase.from("goals").select("*").eq("user_id", uid).eq("status", "active").order("due_date", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("automation_rules").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(8),
    supabase.from("balance_snapshots").select("balance, snapshot_month").eq("user_id", uid).order("snapshot_month", { ascending: false }).limit(20),
    supabase.from("monthly_income").select("amount, month").eq("user_id", uid).order("month", { ascending: false }).limit(12),
    supabase.from("recurring_expenses").select("*").eq("user_id", uid).eq("is_active", true),
    supabase.from("financial_commitments").select("*").eq("user_id", uid).eq("is_active", true),
    supabase.from("workouts").select("id").eq("user_id", uid).gte("date", weekStart),
    supabase.from("habits").select("id").eq("user_id", uid).eq("is_active", true),
    supabase.from("habit_entries").select("id").eq("user_id", uid).eq("date", today),
    supabase.from("university_exams").select("name, exam_date").eq("user_id", uid).gte("exam_date", today).lte("exam_date", soon).order("exam_date").limit(3),
  ]);

  const allTasks = tasks ?? [];
  const overdueTasks = allTasks.filter((task) => task.due_date && task.due_date < today);
  const todayTasks = allTasks.filter((task) => task.due_date && task.due_date >= today);
  const reminders = ((remindersRaw ?? []) as ReminderJoin[]).map((reminder) => {
    const note = Array.isArray(reminder.notes) ? reminder.notes[0] : reminder.notes;
    return { id: reminder.id, note_id: reminder.note_id, remind_at: reminder.remind_at, noteTitle: note?.title ?? "Senza titolo" };
  });

  const latestMonth = snapshots?.[0]?.snapshot_month?.slice(0, 7);
  const netWorth = (snapshots ?? [])
    .filter((snapshot) => snapshot.snapshot_month.slice(0, 7) === latestMonth)
    .reduce((sum, snapshot) => sum + Number(snapshot.balance), 0);
  const monthlyIncome = (income ?? []).filter((item) => item.month === (income?.[0]?.month ?? "")).reduce((sum, item) => sum + Number(item.amount), 0);
  const fixedCosts = ((recurring ?? []) as Recurring[]).reduce((sum, item) => {
    const amount = Number(item.amount);
    if (item.frequency === "annual") return sum + amount / 12;
    if (item.frequency === "quarterly") return sum + amount / 3;
    return sum + amount;
  }, 0);
  const upcomingDueCount = ((recurring ?? []) as Recurring[]).filter((item) => item.next_due_date <= soon).length
    + ((commitments ?? []) as Commitment[]).filter((item) => item.due_day && item.due_day >= now.getDate()).length;

  return (
    <CommandCenter
      userName={(user.user_metadata?.display_name as string) || user.email?.split("@")[0] || ""}
      todayTasks={todayTasks}
      overdueTasks={overdueTasks}
      reminders={reminders}
      goals={(goals ?? []) as Goal[]}
      automations={(automations ?? []) as Automation[]}
      finance={{ netWorth, monthlyIncome, fixedCosts, upcomingDueCount }}
      fitness={{ workoutsThisWeek: workouts?.length ?? 0, activeHabits: habits?.length ?? 0, habitsDoneToday: habitEntries?.length ?? 0 }}
      university={{ examsSoon: exams?.length ?? 0, nextExam: exams?.[0] ? `${exams[0].name} il ${exams[0].exam_date}` : null }}
    />
  );
}
