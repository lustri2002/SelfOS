import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import HomeView from "@/components/home/HomeView";

interface RecentNote {
  id: string;
  title: string;
  tags: string[];
  updated_at: string;
  notebook_id: string | null;
  color: string | null;
  emoji: string | null;
}

interface PinnedNote {
  id: string;
  title: string;
  tags: string[];
  updated_at: string;
  emoji: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  project_id: string | null;
}

interface ProjectItem {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface ReminderItem {
  id: string;
  note_id: string;
  remind_at: string;
  notes: { title: string } | { title: string }[] | null;
}

export default async function HomePage() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  const uid = user.id;

  const now = new Date();
  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const weekStartDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;

  const [
    { data: recentNotes },
    { count: totalNotes },
    { data: pinnedNotes },
    { data: urgentTasks },
    { count: completedThisWeek },
    { data: projects },
    { data: upcomingReminders },
    { data: snapshots },
    { data: income },
    { count: workoutsThisWeek },
  ] = await Promise.all([
    // 1. Recent notes (last 5). Keep the home payload tiny: no TipTap content here.
    supabase
      .from("notes")
      .select("id, title, tags, updated_at, notebook_id, color, emoji")
      .eq("user_id", uid)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .is("deleted_at", null),
    // 2. Pinned notes
    supabase
      .from("notes")
      .select("id, title, tags, updated_at, emoji")
      .eq("user_id", uid)
      .is("deleted_at", null)
      .eq("pinned", true)
      .order("updated_at", { ascending: false })
      .limit(4),
    // 6. Overdue + today tasks in ONE query
    supabase
      .from("tasks")
      .select("id, title, priority, status, due_date, project_id")
      .eq("user_id", uid)
      .is("deleted_at", null)
      .neq("status", "done")
      .not("due_date", "is", null)
      .lt("due_date", tomorrowDate)
      .order("due_date"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .is("deleted_at", null)
      .eq("status", "done")
      .gte("completed_at", weekStartDate),
    // 9. Projects
    supabase
      .from("projects")
      .select("id, name, color, emoji")
      .eq("user_id", uid)
      .eq("archived", false)
      .order("name")
      .limit(20),
    // 10. Upcoming reminders with note title via FK join
    supabase
      .from("note_reminders")
      .select("id, note_id, remind_at, notes(title)")
      .eq("user_id", uid)
      .eq("dismissed", false)
      .gte("remind_at", now.toISOString())
      .order("remind_at")
      .limit(5),
    supabase
      .from("balance_snapshots")
      .select("balance, snapshot_month")
      .eq("user_id", uid)
      .order("snapshot_month", { ascending: false })
      .limit(50),
    supabase
      .from("monthly_income")
      .select("amount, month")
      .eq("user_id", uid)
      .order("month", { ascending: false })
      .limit(12),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("date", weekStartDate),
  ]);

  // Split urgent tasks into overdue vs today (client-side, no extra query)
  const allUrgent = urgentTasks ?? [];
  const overdueTasks = allUrgent.filter((t) => t.due_date! < todayDate);
  const todayTasks = allUrgent.filter((t) => t.due_date! >= todayDate);

  // Build a small tag cloud from notes already fetched for the shell.
  const tagCounts: Record<string, number> = {};
  for (const note of [...(recentNotes ?? []), ...(pinnedNotes ?? [])]) {
    for (const tag of (note.tags as string[]) ?? []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const reminders = ((upcomingReminders ?? []) as ReminderItem[]).map((r) => {
    const noteData = Array.isArray(r.notes) ? r.notes[0] : r.notes;
    return {
      id: r.id,
      note_id: r.note_id,
      remind_at: r.remind_at,
      noteTitle: noteData?.title || "Senza titolo",
    };
  });

  const financeSnapshots = snapshots ?? [];
  const monthlyIncome = income ?? [];
  const latestSnapshotMonth = financeSnapshots[0]?.snapshot_month?.slice(0, 7) ?? null;
  const netWorth = latestSnapshotMonth
    ? financeSnapshots
        .filter((snapshot) => snapshot.snapshot_month.slice(0, 7) === latestSnapshotMonth)
        .reduce((sum, snapshot) => sum + Number(snapshot.balance), 0)
    : 0;
  const latestIncomeMonth = monthlyIncome[0]?.month ?? null;
  const monthIncome = latestIncomeMonth
    ? monthlyIncome
        .filter((item) => item.month === latestIncomeMonth)
        .reduce((sum, item) => sum + Number(item.amount), 0)
    : 0;

  return (
    <HomeView
      userName={(user.user_metadata?.display_name as string) || user.email?.split("@")[0] || ""}
      recentNotes={(recentNotes ?? []) as RecentNote[]}
      pinnedNotes={(pinnedNotes ?? []) as PinnedNote[]}
      totalNotes={totalNotes ?? 0}
      topTags={topTags}
      todayTasks={todayTasks as TaskItem[]}
      overdueTasks={overdueTasks as TaskItem[]}
      totalActiveTasks={allUrgent.length}
      completedThisWeek={completedThisWeek ?? 0}
      projects={(projects ?? []) as ProjectItem[]}
      pendingBalanceMonth={null}
      financeWidget={{ netWorth, monthIncome, hasData: Boolean(latestSnapshotMonth || latestIncomeMonth) }}
      fitnessWidget={{ workoutsThisWeek: workoutsThisWeek ?? 0, hasData: Boolean(workoutsThisWeek) }}
      upcomingInstallments={[]}
      upcomingReminders={reminders}
    />
  );
}
