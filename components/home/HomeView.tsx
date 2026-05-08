import Link from "next/link";
import {
  FileText, Pin, Plus, ArrowRight,
  BookOpen, FolderOpen, Flame, Tag,
  CheckSquare, AlertTriangle, Wallet, CreditCard,
  CircleDot, Clock, CalendarDays, Trophy,
  ListTodo, Bell, TrendingUp,
  Activity, GraduationCap, Sparkles,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isTomorrow } from "date-fns";
import { it } from "date-fns/locale";
import { fmt, fmtCompactCurrency } from "@/lib/finance/format";
import { cn } from "@/lib/utils/cn";
import { isModuleEnabled } from "@/config/modules";

/* ── Types ─────────────────────────────────────────────────── */

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
  noteTitle: string;
}

interface FinanceWidget {
  netWorth: number;
  monthIncome: number;
  hasData: boolean;
}

interface FitnessWidget {
  workoutsThisWeek: number;
  hasData: boolean;
}

interface InstallmentItem {
  name: string;
  amount: number;
  dueDay: number;
  currency: string;
}

export interface HomeViewProps {
  userName: string;
  recentNotes: RecentNote[];
  pinnedNotes: PinnedNote[];
  totalNotes: number;
  topTags: [string, number][];
  todayTasks: TaskItem[];
  overdueTasks: TaskItem[];
  totalActiveTasks: number;
  completedThisWeek: number;
  projects: ProjectItem[];
  upcomingReminders: ReminderItem[];
  pendingBalanceMonth: string | null;
  financeWidget: FinanceWidget;
  fitnessWidget: FitnessWidget;
  upcomingInstallments: InstallmentItem[];
}

/* ── Quotes ────────────────────────────────────────────────── */

const quotes = [
  { text: "La mente non ha bisogno di tutto. Ha bisogno di sapere dove trovarlo.", author: "David Allen" },
  { text: "Scrivi per scoprire cosa pensi.", author: "Joan Didion" },
  { text: "Un'idea non registrata è un'idea persa.", author: "Richard Branson" },
  { text: "La conoscenza non è potere. L'applicazione della conoscenza è potere.", author: "Dale Carnegie" },
  { text: "Il miglior momento per piantare un albero era 20 anni fa. Il secondo è adesso.", author: "Proverbio cinese" },
  { text: "Non devi essere grande per iniziare, ma devi iniziare per essere grande.", author: "Zig Ziglar" },
  { text: "La creatività è l'intelligenza che si diverte.", author: "Albert Einstein" },
  { text: "Ogni giorno è un foglio bianco. Scrivici qualcosa di buono.", author: "Anonimo" },
  { text: "Cattura i tuoi pensieri, o scompariranno per sempre.", author: "Tiago Forte" },
  { text: "Il secondo cervello non rimpiazza il primo. Lo libera.", author: "Tiago Forte" },
  { text: "L'unico modo per fare un ottimo lavoro è amare quello che fai.", author: "Steve Jobs" },
  { text: "La semplicità è la sofisticazione suprema.", author: "Leonardo da Vinci" },
  { text: "Il segreto del successo è iniziare.", author: "Mark Twain" },
  { text: "Non contare i giorni, fai che i giorni contino.", author: "Muhammad Ali" },
  { text: "Fai ogni giorno una cosa che ti spaventa.", author: "Eleanor Roosevelt" },
  { text: "La disciplina è il ponte tra gli obiettivi e i risultati.", author: "Jim Rohn" },
  { text: "Pensa in grande, inizia in piccolo, agisci ora.", author: "Robin Sharma" },
  { text: "Il futuro appartiene a chi crede nella bellezza dei propri sogni.", author: "Eleanor Roosevelt" },
  { text: "La produttività non è fare di più. È fare ciò che conta.", author: "Cal Newport" },
  { text: "Ogni esperto era una volta un principiante.", author: "Helen Hayes" },
  { text: "Non rimandare a domani quello che puoi fare oggi.", author: "Benjamin Franklin" },
  { text: "Tutto quello che puoi immaginare è reale.", author: "Pablo Picasso" },
  { text: "Il tuo tempo è limitato. Non sprecarlo vivendo la vita di qualcun altro.", author: "Steve Jobs" },
  { text: "La mente è come un paracadute. Funziona solo se si apre.", author: "Frank Zappa" },
  { text: "Chi ha un perché può sopportare quasi ogni come.", author: "Friedrich Nietzsche" },
  { text: "Nella semplicità c'è la genialità.", author: "Bruce Lee" },
  { text: "Le grandi cose sono fatte da una serie di piccole cose messe insieme.", author: "Vincent van Gogh" },
  { text: "L'unica cosa impossibile è quella che non provi a fare.", author: "Anonimo" },
  { text: "Non è la più forte delle specie che sopravvive, ma la più adattabile.", author: "Charles Darwin" },
  { text: "Sii il cambiamento che vuoi vedere nel mondo.", author: "Mahatma Gandhi" },
  { text: "La persistenza è la strada del successo.", author: "Charlie Chaplin" },
];

/* ── Helpers ───────────────────────────────────────────────── */

const PROJECT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500", red: "bg-red-500", orange: "bg-orange-500",
  amber: "bg-amber-500", green: "bg-emerald-500", blue: "bg-blue-500",
  purple: "bg-purple-500", pink: "bg-pink-500", teal: "bg-teal-500",
};

const NOTE_BORDER_COLORS: Record<string, string> = {
  red: "border-l-red-400", orange: "border-l-orange-400", amber: "border-l-amber-400",
  green: "border-l-emerald-400", blue: "border-l-blue-400", indigo: "border-l-indigo-400",
  purple: "border-l-purple-400", pink: "border-l-pink-400",
};

const PRIORITY_CONFIG = {
  urgent: { dot: "bg-red-500", label: "Urgente" },
  high: { dot: "bg-orange-500", label: "Alta" },
  medium: { dot: "bg-amber-500", label: "Media" },
  low: { dot: "bg-blue-500", label: "Bassa" },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buonanotte";
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function getDailyQuote() {
  // Simple hash: day * month * year → spread across all quotes
  const now = new Date();
  const seed = (now.getDate() * 31 + (now.getMonth() + 1) * 397 + now.getFullYear() * 7919);
  const index = seed % quotes.length;
  return quotes[index];
}

function formatReminderDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return `Oggi alle ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Domani alle ${format(d, "HH:mm")}`;
  return format(d, "d MMM 'alle' HH:mm", { locale: it });
}

/* ── Component ─────────────────────────────────────────────── */

export default function HomeView({
  userName,
  recentNotes,
  pinnedNotes,
  totalNotes,
  topTags,
  todayTasks,
  overdueTasks,
  totalActiveTasks,
  completedThisWeek,
  projects,
  upcomingReminders,
  pendingBalanceMonth,
  financeWidget,
  fitnessWidget,
  upcomingInstallments,
}: HomeViewProps) {
  const quote = getDailyQuote();
  const greeting = getGreeting();
  const modules = {
    notes: isModuleEnabled("notes"),
    tasks: isModuleEnabled("tasks"),
    finance: isModuleEnabled("finance"),
    fitness: isModuleEnabled("fitness"),
    education: isModuleEnabled("education"),
  };

  const projectMap: Record<string, ProjectItem> = {};
  for (const p of projects) projectMap[p.id] = p;

  // Productivity streak message
  const productivityMsg = !modules.tasks
    ? "Configura i moduli attivi dalle variabili ambiente."
    : completedThisWeek >= 20
    ? "Settimana da record!"
    : completedThisWeek >= 10
      ? "Ottimo ritmo, continua cosi!"
      : completedThisWeek >= 5
        ? "Buon lavoro questa settimana!"
        : completedThisWeek >= 1
          ? "Sei sulla strada giusta!"
          : "Inizia completando un task!";

  const commandModules = [
    {
      enabled: modules.notes,
      href: "/notes",
      label: "Note",
      value: totalNotes,
      detail: "ultime aggiornate",
      icon: BookOpen,
      module: "sb-module-notes",
    },
    {
      enabled: modules.tasks,
      href: "/tasks",
      label: "Task",
      value: totalActiveTasks,
      detail: `${todayTasks.length + overdueTasks.length} richiedono focus`,
      icon: CheckSquare,
      module: "sb-module-tasks",
    },
    {
      enabled: modules.finance,
      href: "/finance",
      label: "Finanze",
      value: financeWidget.hasData ? fmtCompactCurrency(financeWidget.netWorth) : "Configura",
      detail: "Patrimonio netto",
      icon: Wallet,
      module: "sb-module-finance",
    },
    {
      enabled: modules.fitness,
      href: "/fitness",
      label: "Fitness",
      value: fitnessWidget.hasData ? fitnessWidget.workoutsThisWeek : 0,
      detail: "allenamenti questa settimana",
      icon: Activity,
      module: "sb-module-fitness",
    },
    {
      enabled: modules.education,
      href: "/university",
      label: "Education",
      value: projects.length,
      detail: "percorso di studio",
      icon: GraduationCap,
      module: "sb-module-university",
    },
  ].filter((module) => module.enabled);

  return (
    <div className="sb-page max-w-6xl">
      {/* Command Center hero */}
      <section className="sb-hero sb-module-system mb-6 p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr] lg:items-stretch">
          <div className="flex min-h-64 flex-col justify-between">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase text-[var(--sb-muted)]">
                {new Date().toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <h1 className="text-[2.25rem] font-bold leading-[1.02] text-[var(--sb-text)] md:text-5xl">
                {greeting},<br />
                <span className="capitalize text-[var(--sb-accent)]">{userName}</span>
              </h1>
              {quote.text && (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--sb-muted)]">
                  &ldquo;{quote.text}&rdquo; — {quote.author}
                </p>
              )}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 md:max-w-xl">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-2xl font-bold tabular-nums text-[var(--sb-text)]">{overdueTasks.length}</p>
                <p className="text-[10px] uppercase text-[var(--sb-muted)]">In ritardo</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-2xl font-bold tabular-nums text-[var(--sb-text)]">{todayTasks.length}</p>
                <p className="text-[10px] uppercase text-[var(--sb-muted)]">Oggi</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-2xl font-bold tabular-nums text-emerald-400">{completedThisWeek}</p>
                <p className="text-[10px] uppercase text-[var(--sb-muted)]">Chiusi</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {commandModules.map(({ href, label, value, detail, icon: Icon, module }) => (
              <Link
                key={href}
                href={href}
                className={cn(module, "sb-depth-card sb-lift flex items-center gap-3 p-3")}
              >
                <span className="sb-module-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--sb-text)]">{label}</p>
                  <p className="truncate text-[11px] text-[var(--sb-muted)]">{detail}</p>
                </div>
                <span className="text-lg font-bold tabular-nums text-[var(--sb-text)]">{value}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--sb-muted)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--sb-accent)]" />
        <span>{productivityMsg}</span>
      </div>

      {/* ── Finance: update balances reminder ────────────────── */}
      {modules.finance && pendingBalanceMonth && (
        <Link
          href="/finance"
          className="mb-6 flex items-center gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 transition-colors hover:bg-indigo-500/10 sb-press"
        >
          <Wallet className="h-5 w-5 text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--sb-text)]">Aggiorna i saldi di {format(new Date(pendingBalanceMonth + "-01"), "MMMM yyyy", { locale: it })}</p>
            <p className="text-xs text-[var(--sb-muted)] mt-0.5">Inserisci i saldi di fine mese per calcolare le spese</p>
          </div>
          <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0" />
        </Link>
      )}

      {/* ── Finance mini widget ──────────────────────────────── */}
      {modules.finance && financeWidget.hasData && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link
            href="/finance"
            className="group sb-panel p-4 transition-all hover:border-indigo-500/20 hover:bg-[var(--sb-hover)]"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Wallet className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[10px] text-[var(--sb-muted)] uppercase">Patrimonio</span>
            </div>
            <p className={cn("text-lg font-bold tabular-nums", financeWidget.netWorth >= 0 ? "text-[var(--sb-text)]" : "text-red-400")}>
              {fmt(financeWidget.netWorth)}
            </p>
          </Link>
          <Link
            href="/finance"
            className="group sb-panel p-4 transition-all hover:border-emerald-500/20 hover:bg-[var(--sb-hover)]"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-[var(--sb-muted)] uppercase">Entrate mese</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-400">
              {financeWidget.monthIncome > 0 ? fmt(financeWidget.monthIncome) : "—"}
            </p>
          </Link>
        </div>
      )}

      {/* ── Upcoming installments ─────────────────────────────── */}
      {modules.finance && upcomingInstallments.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">Rate in scadenza</h2>
          </div>
          <div className="space-y-1.5">
            {upcomingInstallments.map((inst) => (
              <Link
                key={inst.name}
                href="/finance"
                className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-amber-500/10 transition-colors"
              >
                <span className="text-sm text-[var(--sb-text)]">{inst.name}</span>
                <span className="text-xs text-amber-400 font-medium tabular-nums">
                  {new Intl.NumberFormat("it-IT", { style: "currency", currency: inst.currency }).format(inst.amount)} — il {inst.dueDay}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Overdue / Today tasks alert ─────────────────────── */}
      {modules.tasks && overdueTasks.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">
              {overdueTasks.length} task in ritardo
            </h2>
          </div>
          <div className="flex flex-col gap-1">
            {overdueTasks.slice(0, 3).map((task) => {
              const project = task.project_id ? projectMap[task.project_id] : null;
              return (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="group flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-red-500/10 transition-all"
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_CONFIG[task.priority].dot)} />
                  <span className="text-sm text-[var(--sb-text)] truncate flex-1 group-hover:text-red-400 transition-colors">
                    {task.title || "Senza titolo"}
                  </span>
                  {project && (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--sb-muted)] shrink-0">
                      <span className={cn("w-1.5 h-1.5 rounded-full", PROJECT_COLORS[project.color] || "bg-indigo-500")} />
                      {project.name}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="text-[10px] text-red-400 shrink-0">
                      {format(new Date(task.due_date + "T00:00:00"), "d MMM", { locale: it })}
                    </span>
                  )}
                </Link>
              );
            })}
            {overdueTasks.length > 3 && (
              <Link href="/tasks" className="text-xs text-red-400 hover:text-red-300 transition-colors pl-3 mt-1">
                +{overdueTasks.length - 3} altri →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Stats grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {modules.notes && <div className="sb-depth-card sb-module-notes p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-2xl font-bold text-[var(--sb-text)]">{totalNotes}</span>
          </div>
          <p className="text-[10px] text-[var(--sb-muted)] uppercase">Note recenti</p>
        </div>}
        {modules.tasks && <div className="sb-depth-card sb-module-tasks p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ListTodo className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-2xl font-bold text-[var(--sb-text)]">{totalActiveTasks}</span>
          </div>
          <p className="text-[10px] text-[var(--sb-muted)] uppercase">Da gestire</p>
        </div>}
        {modules.notes && <div className="sb-depth-card sb-module-finance p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Trophy className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-2xl font-bold text-[var(--sb-text)]">{pinnedNotes.length}</span>
          </div>
          <p className="text-[10px] text-[var(--sb-muted)] uppercase">In evidenza</p>
        </div>}
        {modules.notes && <div className="sb-depth-card sb-module-fitness p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-2xl font-bold text-[var(--sb-text)]">{topTags.length}</span>
          </div>
          <p className="text-[10px] text-[var(--sb-muted)] uppercase">Tag rapidi</p>
        </div>}
      </div>

      {/* Productivity message */}
      {modules.tasks && completedThisWeek > 0 && (
        <div className="mb-8 text-center">
          <p className="text-xs text-[var(--sb-muted)]">{productivityMsg}</p>
          {/* Mini progress bar */}
          <div className="mt-2 mx-auto max-w-xs h-1.5 rounded-full bg-[var(--sb-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${Math.min(completedThisWeek * 5, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Two-column layout: Tasks today + Reminders ──────── */}
      {(modules.tasks || modules.notes) && <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Today's tasks */}
        {modules.tasks && <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-amber-400" />
              Task di oggi
            </h2>
            <Link
              href="/tasks"
              className="text-xs text-[var(--sb-muted)] hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              Tutti i task
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {todayTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--sb-border)] p-6 text-center">
              <CheckSquare className="h-6 w-6 text-emerald-400/50 mx-auto mb-2" />
              <p className="text-xs text-[var(--sb-muted)]">
                {overdueTasks.length > 0 ? "Nessun task per oggi, ma hai task in ritardo!" : "Nessun task per oggi. Goditi la giornata! 🎉"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-sm)] overflow-hidden">
              {todayTasks.slice(0, 5).map((task, i) => {
                const project = task.project_id ? projectMap[task.project_id] : null;
                return (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className={cn(
                      "group flex items-center gap-2.5 px-4 py-3 hover:bg-[var(--sb-hover)] transition-all",
                      i < todayTasks.length - 1 && i < 4 && "border-b border-[var(--sb-border)]",
                    )}
                  >
                    <CircleDot className={cn("h-3.5 w-3.5 shrink-0", task.status === "in_progress" ? "text-blue-400" : "text-[var(--sb-muted)]")} />
                    <span className="text-sm text-[var(--sb-text)] truncate flex-1 group-hover:text-indigo-400 transition-colors">
                      {task.title || "Senza titolo"}
                    </span>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_CONFIG[task.priority].dot)} />
                    {project && (
                      <span className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--sb-muted)] shrink-0">
                        <span className={cn("w-1.5 h-1.5 rounded-full", PROJECT_COLORS[project.color] || "bg-indigo-500")} />
                        {project.name}
                      </span>
                    )}
                  </Link>
                );
              })}
              {todayTasks.length > 5 && (
                <Link href="/tasks" className="block text-center text-xs text-[var(--sb-muted)] hover:text-indigo-400 transition-colors py-2 border-t border-[var(--sb-border)]">
                  +{todayTasks.length - 5} altri task →
                </Link>
              )}
            </div>
          )}
        </section>}

        {/* Upcoming reminders */}
        {modules.notes && <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-400" />
              Promemoria
            </h2>
          </div>

          {upcomingReminders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--sb-border)] p-6 text-center">
              <Bell className="h-6 w-6 text-[var(--sb-muted)]/30 mx-auto mb-2" />
              <p className="text-xs text-[var(--sb-muted)]">Nessun promemoria in arrivo</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-sm)] overflow-hidden">
              {upcomingReminders.map((rem, i) => (
                <Link
                  key={rem.id}
                  href={`/notes/${rem.note_id}`}
                  className={cn(
                    "group flex items-center gap-2.5 px-4 py-3 hover:bg-[var(--sb-hover)] transition-all",
                    i < upcomingReminders.length - 1 && "border-b border-[var(--sb-border)]",
                  )}
                >
                  <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--sb-text)] truncate group-hover:text-indigo-400 transition-colors">
                      {rem.noteTitle}
                    </p>
                    <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">
                      {formatReminderDate(rem.remind_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>}
      </div>}

      {/* ── Quick access (pinned) ───────────────────────────── */}
      {modules.notes && pinnedNotes.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5">
              <Pin className="h-3.5 w-3.5 text-indigo-400" />
              Accesso rapido
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {pinnedNotes.map((note) => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="group rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-sm)] p-3 hover:bg-[var(--sb-hover)] hover:border-indigo-500/20 transition-all"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {note.emoji ? (
                    <span className="text-base">{note.emoji}</span>
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-[var(--sb-muted)] group-hover:text-indigo-400 transition-colors" />
                  )}
                  <p className="text-sm text-[var(--sb-text)] font-medium truncate group-hover:text-indigo-400 transition-colors">
                    {note.title || "Senza titolo"}
                  </p>
                </div>
                {note.tags.length > 0 && (
                  <div className="flex gap-1 overflow-hidden">
                    {note.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-[var(--sb-muted)] bg-[var(--sb-card)] rounded px-1.5 py-0.5 truncate"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent notes ────────────────────────────────────── */}
      {modules.notes && <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[var(--sb-muted)]" />
            Note recenti
          </h2>
          <Link
            href="/notes"
            className="text-xs text-[var(--sb-muted)] hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            Vedi tutte
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentNotes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--sb-border)] p-8 text-center">
            <FileText className="h-8 w-8 text-[var(--sb-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--sb-muted)] mb-3">Nessuna nota ancora</p>
            <Link
              href="/notes"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Crea la tua prima nota
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {recentNotes.map((note) => {
              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-[var(--sb-hover)] transition-all",
                    note.color && "border-l-[3px]",
                    note.color && (NOTE_BORDER_COLORS[note.color] || ""),
                  )}
                >
                  {note.emoji ? (
                    <span className="text-base shrink-0 mt-0.5">{note.emoji}</span>
                  ) : (
                    <FileText className="h-4 w-4 text-[var(--sb-muted)] shrink-0 mt-0.5 group-hover:text-indigo-400 transition-colors" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--sb-text)] truncate group-hover:text-indigo-400 transition-colors">
                      {note.title || "Senza titolo"}
                    </p>
                    {note.tags.length > 0 && (
                      <p className="text-xs text-[var(--sb-muted)] mt-0.5 line-clamp-1">
                        {note.tags.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--sb-muted)] shrink-0 mt-1 hidden sm:block">
                    {formatDistanceToNow(new Date(note.updated_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>}

      {/* ── Projects overview ───────────────────────────────── */}
      {modules.tasks && projects.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5 mb-3">
            <FolderOpen className="h-3.5 w-3.5 text-[var(--sb-muted)]" />
            Progetti
          </h2>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href="/tasks"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] px-3 py-2 text-xs text-[var(--sb-muted)] hover:text-indigo-400 hover:border-indigo-500/20 transition-all"
              >
                <span className={cn("w-2 h-2 rounded-full", PROJECT_COLORS[p.color] || "bg-indigo-500")} />
                {p.emoji && <span className="text-sm">{p.emoji}</span>}
                <span>{p.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Top tags ────────────────────────────────────────── */}
      {modules.notes && topTags.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5 mb-3">
            <Tag className="h-3.5 w-3.5 text-[var(--sb-muted)]" />
            Tag più usati
          </h2>
          <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count]) => (
              <Link
                key={tag}
                href="/notes"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] px-3 py-1.5 text-xs text-[var(--sb-muted)] hover:text-indigo-400 hover:border-indigo-500/20 transition-all"
              >
                <span>{tag}</span>
                <span className="text-[10px] bg-[var(--sb-card)] rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick actions ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {modules.notes && <Link
          href="/notes"
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--sb-border)] p-4 text-sm text-[var(--sb-muted)] hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuova nota
        </Link>}
        {modules.tasks && <Link
          href="/tasks"
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--sb-border)] p-4 text-sm text-[var(--sb-muted)] hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuovo task
        </Link>}
      </div>
    </div>
  );
}
