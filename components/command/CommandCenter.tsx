import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, CheckSquare, CircleDollarSign, Dumbbell, GraduationCap, Sparkles, Target, Zap } from "lucide-react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Panel } from "@/components/ui/Panel";
import { fmt } from "@/lib/finance/format";
import { cn } from "@/lib/utils/cn";
import { isModuleEnabled } from "@/config/modules";
import type { Database } from "@/types/database";

type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Automation = Database["public"]["Tables"]["automation_rules"]["Row"];

interface TaskItem {
  id: string;
  title: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
}

interface ReminderItem {
  id: string;
  note_id: string;
  remind_at: string;
  noteTitle: string;
}

interface FinanceSignal {
  netWorth: number;
  monthlyIncome: number;
  fixedCosts: number;
  upcomingDueCount: number;
}

interface FitnessSignal {
  workoutsThisWeek: number;
  activeHabits: number;
  habitsDoneToday: number;
}

interface UniversitySignal {
  examsSoon: number;
  nextExam: string | null;
}

interface CommandCenterProps {
  userName: string;
  todayTasks: TaskItem[];
  overdueTasks: TaskItem[];
  reminders: ReminderItem[];
  goals: Goal[];
  automations: Automation[];
  finance: FinanceSignal;
  fitness: FitnessSignal;
  university: UniversitySignal;
}

const PRIORITY = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
};

function formatReminder(value: string) {
  const date = parseISO(value);
  if (isToday(date)) return `Oggi ${format(date, "HH:mm")}`;
  if (isTomorrow(date)) return `Domani ${format(date, "HH:mm")}`;
  return format(date, "d MMM HH:mm", { locale: it });
}

function goalProgress(goal: Goal) {
  if (!goal.target_value || goal.target_value <= 0) return goal.status === "completed" ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)));
}

export default function CommandCenter({
  userName,
  todayTasks,
  overdueTasks,
  reminders,
  goals,
  automations,
  finance,
  fitness,
  university,
}: CommandCenterProps) {
  const modules = {
    notes: isModuleEnabled("notes"),
    tasks: isModuleEnabled("tasks"),
    goals: isModuleEnabled("goals"),
    finance: isModuleEnabled("finance"),
    fitness: isModuleEnabled("fitness"),
    education: isModuleEnabled("education"),
    automation: isModuleEnabled("automation"),
  };
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const atRiskGoals = activeGoals.filter((goal) => goal.due_date && parseISO(goal.due_date) < new Date() && goalProgress(goal) < 100);
  const activeAutomations = automations.filter((rule) => rule.is_active);
  const focusLoad = (modules.tasks ? overdueTasks.length * 2 + todayTasks.length : 0)
    + (modules.goals ? atRiskGoals.length * 2 : 0)
    + (modules.finance ? finance.upcomingDueCount : 0);
  const mode = focusLoad >= 8 ? "Modalita contenimento" : focusLoad >= 4 ? "Modalita execution" : "Modalita costruzione";
  const briefing = [
    modules.tasks ? (overdueTasks.length > 0 ? `${overdueTasks.length} task in ritardo richiedono una decisione.` : "Nessun arretrato critico nei task.") : null,
    modules.goals ? (atRiskGoals.length > 0 ? `${atRiskGoals.length} obiettivi sono fuori traiettoria.` : "Gli obiettivi attivi non mostrano allarmi immediati.") : null,
    modules.finance ? (finance.upcomingDueCount > 0 ? `${finance.upcomingDueCount} scadenze finanziarie sono vicine.` : "Nessuna scadenza finanziaria imminente.") : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="sb-page max-w-7xl">
      <section className="sb-hero sb-module-system mb-6 p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
          <div>
            <p className="sb-eyebrow mb-3">{format(new Date(), "EEEE d MMMM", { locale: it })}</p>
            <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-5xl">Command Center, {userName}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--sb-muted)]">
              {mode}: il sistema fonde i moduli attivi in una sola cabina di regia.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric value={todayTasks.length} label="Oggi" />
            <Metric value={overdueTasks.length} label="Ritardi" danger={overdueTasks.length > 0} />
            <Metric value={activeAutomations.length} label="Auto" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Panel className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--sb-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--sb-text)]">Briefing operativo</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {briefing.map((line) => (
                <div key={line} className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3 text-sm leading-relaxed text-[var(--sb-text)]">
                  {line}
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            {modules.tasks && <SignalPanel href="/tasks" icon={CheckSquare} title="Focus task" cta="Apri task">
              <TaskList tasks={[...overdueTasks, ...todayTasks].slice(0, 5)} />
            </SignalPanel>}

            {modules.goals && <SignalPanel href="/goals" icon={Target} title="Goal OS" cta="Apri obiettivi">
              {activeGoals.slice(0, 4).map((goal) => (
                <div key={goal.id} className="py-2">
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-[var(--sb-text)]">{goal.title}</span>
                    <span className="text-xs tabular-nums text-[var(--sb-muted)]">{goalProgress(goal)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sb-border)]">
                    <div className="h-full rounded-full bg-[var(--sb-accent)]" style={{ width: `${goalProgress(goal)}%` }} />
                  </div>
                </div>
              ))}
              {activeGoals.length === 0 && <EmptyLine text="Nessun obiettivo attivo." />}
            </SignalPanel>}

            {modules.finance && <SignalPanel href="/finance" icon={CircleDollarSign} title="Traiettoria finanziaria" cta="Scenario planner">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Net worth" value={fmt(finance.netWorth)} />
                <MiniStat label="Entrate" value={fmt(finance.monthlyIncome)} />
                <MiniStat label="Fissi/mese" value={fmt(finance.fixedCosts)} />
                <MiniStat label="Scadenze" value={finance.upcomingDueCount} />
              </div>
            </SignalPanel>}

            {modules.automation && <SignalPanel href="/automation" icon={Zap} title="Automation Studio" cta="Apri studio">
              {activeAutomations.slice(0, 4).map((rule) => (
                <div key={rule.id} className="flex items-center gap-2 border-b border-[var(--sb-border)] py-2 last:border-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="truncate text-sm text-[var(--sb-text)]">{rule.name}</span>
                </div>
              ))}
              {activeAutomations.length === 0 && <EmptyLine text="Nessuna automazione attiva." />}
            </SignalPanel>}
          </div>
        </div>

        <div className="space-y-6">
          {modules.notes && <Panel className="p-4">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-[var(--sb-text)]">Segnali prossimi</h2>
            </div>
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <Link key={reminder.id} href={`/notes/${reminder.note_id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[var(--sb-hover)]">
                  <span className="truncate text-sm text-[var(--sb-text)]">{reminder.noteTitle}</span>
                  <span className="shrink-0 text-xs text-[var(--sb-muted)]">{formatReminder(reminder.remind_at)}</span>
                </Link>
              ))}
              {reminders.length === 0 && <EmptyLine text="Nessun reminder imminente." />}
            </div>
          </Panel>}

          <Panel className="p-4">
            <h2 className="mb-4 text-sm font-semibold text-[var(--sb-text)]">Sistema personale</h2>
            <div className="space-y-3">
              {modules.fitness && <SystemRow icon={Dumbbell} label="Fitness" value={`${fitness.workoutsThisWeek} workout, ${fitness.habitsDoneToday}/${fitness.activeHabits} abitudini`} />}
              {modules.education && <SystemRow icon={GraduationCap} label="Education" value={university.nextExam ? `${university.nextExam}` : `${university.examsSoon} esami vicini`} />}
              <SystemRow icon={AlertTriangle} label="Carico" value={mode} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label, danger }: { value: string | number; label: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className={cn("text-2xl font-bold tabular-nums text-[var(--sb-text)]", danger && "text-red-300")}>{value}</p>
      <p className="text-[10px] uppercase text-[var(--sb-muted)]">{label}</p>
    </div>
  );
}

function SignalPanel({ href, icon: Icon, title, cta, children }: { href: string; icon: typeof Target; title: string; cta: string; children: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--sb-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--sb-text)]">{title}</h2>
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)]">
          {cta}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </Panel>
  );
}

function TaskList({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) return <EmptyLine text="Nessun task critico oggi." />;
  return tasks.map((task) => (
    <Link key={task.id} href="/tasks" className="flex items-center gap-2 border-b border-[var(--sb-border)] py-2 last:border-0">
      <span className={cn("h-2 w-2 rounded-full", PRIORITY[task.priority])} />
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--sb-text)]">{task.title}</span>
      {task.due_date && <span className="text-xs text-[var(--sb-muted)]">{task.due_date}</span>}
    </Link>
  ));
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3">
      <p className="text-xs text-[var(--sb-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-[var(--sb-text)]">{value}</p>
    </div>
  );
}

function SystemRow({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3">
      <Icon className="h-4 w-4 text-[var(--sb-accent)]" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--sb-text)]">{label}</p>
        <p className="truncate text-xs text-[var(--sb-muted)]">{value}</p>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-3 text-sm text-[var(--sb-muted)]">{text}</p>;
}
