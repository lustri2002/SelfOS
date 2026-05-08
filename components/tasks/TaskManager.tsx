"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Filter, X,
  LayoutList, Columns3, CalendarDays, Sun,
  FolderPlus,
  Flag, Clock, ArrowUpDown, Trash2,
  CheckCircle2, Circle, Loader2,
  BookOpen, Link2, Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { DialogPanel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDistanceToNow, format, isToday, isPast, isTomorrow, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

/* ── Types ───────────────────────────────────────────────────── */

interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  note_id: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "urgent" | "high" | "medium" | "low";
  due_date: string | null;
  tags: string[];
  sort_order: number;
  recurring: "daily" | "weekly" | "monthly" | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
}

interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface NoteRef {
  id: string;
  title: string;
}

export interface TaskManagerProps {
  initialTasks: Task[];
  initialProjects: Project[];
  notes: NoteRef[];
}

/* ── Priority helpers ────────────────────────────────────────── */

const PRIORITY_CONFIG = {
  urgent: { label: "Urgente", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500", order: 0 },
  high: { label: "Alta", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-500", order: 1 },
  medium: { label: "Media", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500", order: 2 },
  low: { label: "Bassa", color: "text-[var(--sb-muted)]", bg: "bg-[var(--sb-card)]", border: "border-[var(--sb-border)]", dot: "bg-[var(--sb-muted)]", order: 3 },
};

const STATUS_CONFIG = {
  todo: { label: "Da fare", icon: Circle, color: "text-[var(--sb-muted)]" },
  in_progress: { label: "In corso", icon: Loader2, color: "text-blue-500" },
  done: { label: "Completato", icon: CheckCircle2, color: "text-emerald-500" },
};

const PROJECT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500", red: "bg-red-500", orange: "bg-orange-500",
  amber: "bg-amber-500", green: "bg-emerald-500", blue: "bg-blue-500",
  purple: "bg-purple-500", pink: "bg-pink-500", teal: "bg-teal-500",
};

type ViewMode = "list" | "kanban" | "calendar" | "today";
type SortMode = "priority" | "due_date" | "created" | "title";

/* ── Main Component ──────────────────────────────────────────── */

export default function TaskManager({ initialTasks, initialProjects, notes }: TaskManagerProps) {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Quick add
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddPriority, setQuickAddPriority] = useState<Task["priority"]>("medium");
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Task detail
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Project management
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("indigo");

  // Delete dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  /* ── Derived data ────────────────────────────────────────────── */

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags)));

  const filtered = tasks.filter((task) => {
    if (task.status === "done" && !showCompleted) return false;
    const q = search.toLowerCase();
    const matchSearch = !search || task.title.toLowerCase().includes(q) || task.description.toLowerCase().includes(q);
    const matchProject = !filterProject || task.project_id === filterProject;
    const matchPriority = !filterPriority || task.priority === filterPriority;
    const matchTag = !filterTag || task.tags.includes(filterTag);
    return matchSearch && matchProject && matchPriority && matchTag;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Done tasks go to bottom
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;

    switch (sortMode) {
      case "priority":
        return PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order;
      case "due_date": {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      case "title":
        return a.title.localeCompare(b.title, "it");
      case "created":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  const todayTasks = filtered.filter((t) => {
    if (t.status === "done") return false;
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return isToday(d) || isPast(d);
  }).sort((a, b) => PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order);

  const stats = {
    total: tasks.filter((t) => t.status !== "done").length,
    today: todayTasks.length,
    overdue: tasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && t.status !== "done").length,
    done_week: tasks.filter((t) => {
      if (!t.completed_at) return false;
      const d = new Date(t.completed_at);
      return d > addDays(new Date(), -7);
    }).length,
  };

  /* ── CRUD ────────────────────────────────────────────────────── */

  async function quickAdd() {
    const title = quickAddTitle.trim();
    if (!title) return;
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        title,
        priority: quickAddPriority,
        project_id: filterProject || null,
        }),
      });
      const result = (await response.json()) as { task?: Task; error?: string };
      if (!response.ok || !result.task) throw new Error(result.error || "Create failed");
      setTasks((prev) => [result.task!, ...prev]);
      setQuickAddTitle("");
      setQuickAddPriority("medium");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a creare il task");
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const updateData: Record<string, unknown> = { ...updates };
    delete updateData.subtasks;

    if (updates.status === "done") {
      updateData.completed_at = new Date().toISOString();
    } else if (updates.status) {
      updateData.completed_at = null;
    }

    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
    const result = (await response.json()) as { task?: Task; recurringTask?: Task | null; error?: string };
    if (!response.ok || !result.task) {
      toast.error(result.error || "Non sono riuscito ad aggiornare il task");
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, ...(updates.status === "done" ? { completed_at: new Date().toISOString() } : {}), ...(updates.status && updates.status !== "done" ? { completed_at: null } : {}) } : t))
    );
    if (selectedTask?.id === id) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : null);
    }

    if (result.recurringTask) {
      setTasks((prev) => [result.recurringTask!, ...prev]);
    }
  }

  async function deleteTask(id: string) {
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Non sono riuscito a eliminare il task");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
    if (selectedTask?.id === id) setSelectedTask(null);
  }

  async function addSubtask(taskId: string, title: string) {
    const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const result = (await response.json()) as { subtask?: Subtask; error?: string };
    if (!response.ok || !result.subtask) {
      toast.error(result.error || "Non sono riuscito ad aggiungere la sotto-attivita");
      return;
    }
    const sub = result.subtask;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub] } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, subtasks: [...prev.subtasks, sub] } : null);
      }
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    const response = await fetch(`/api/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Non sono riuscito ad aggiornare la sotto-attivita");
      return;
    }
    const updateFn = (t: Task): Task => ({
      ...t,
      subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed } : s)),
    });
    setTasks((prev) => prev.map((t) => t.subtasks.some((s) => s.id === subtaskId) ? updateFn(t) : t));
    if (selectedTask?.subtasks.some((s) => s.id === subtaskId)) {
      setSelectedTask((prev) => prev ? updateFn(prev) : null);
    }
  }

  async function deleteSubtask(subtaskId: string) {
    const response = await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Non sono riuscito a eliminare la sotto-attivita");
      return;
    }
    const updateFn = (t: Task): Task => ({
      ...t,
      subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
    });
    setTasks((prev) => prev.map((t) => t.subtasks.some((s) => s.id === subtaskId) ? updateFn(t) : t));
    if (selectedTask?.subtasks.some((s) => s.id === subtaskId)) {
      setSelectedTask((prev) => prev ? updateFn(prev) : null);
    }
  }

  async function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newProjectColor }),
    });
    const result = (await response.json()) as { project?: Project; error?: string };
    if (!response.ok || !result.project) {
      toast.error(result.error || "Non sono riuscito a creare il progetto");
      return;
    }
      setProjects((prev) => [...prev, result.project!]);
      setNewProjectName("");
      setShowNewProject(false);
  }

  async function deleteProject(id: string) {
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.map((task) => (task.project_id === id ? { ...task, project_id: null } : task)));
      if (filterProject === id) setFilterProject(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a eliminare il progetto");
    }
  }

  /* ── Kanban drag state ─────────────────────────────────────── */

  const dragTaskId = useRef<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  function handleKanbanDrop(status: Task["status"]) {
    if (dragTaskId.current) {
      updateTask(dragTaskId.current, { status });
    }
    dragTaskId.current = null;
    setDragOverColumn(null);
  }

  /* ── Render helpers ────────────────────────────────────────── */

  function DueLabel({ date }: { date: string | null }) {
    if (!date) return null;
    const d = new Date(date);
    const overdue = isPast(d) && !isToday(d);
    const today = isToday(d);
    const tomorrow = isTomorrow(d);
    return (
      <span className={cn("text-[10px] flex items-center gap-0.5", overdue ? "text-red-500" : today ? "text-amber-500" : tomorrow ? "text-blue-400" : "text-[var(--sb-muted)]")}>
        <Clock className="h-2.5 w-2.5" />
        {overdue ? "Scaduto" : today ? "Oggi" : tomorrow ? "Domani" : formatDistanceToNow(d, { addSuffix: true, locale: it })}
      </span>
    );
  }

  function TaskRow({ task }: { task: Task }) {
    const project = projects.find((p) => p.id === task.project_id);
    const pConfig = PRIORITY_CONFIG[task.priority];
    const StatusIcon = STATUS_CONFIG[task.status].icon;
    const completedSubs = task.subtasks.filter((s) => s.completed).length;
    const totalSubs = task.subtasks.length;

    return (
      <div
        className={cn(
          "group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer hover:bg-[var(--sb-hover)] border-l-[3px]",
          pConfig.border,
          task.status === "done" && "opacity-50"
        )}
        onClick={() => setSelectedTask(task)}
        draggable
        onDragStart={() => { dragTaskId.current = task.id; }}
        onDragEnd={() => { dragTaskId.current = null; setDragOverColumn(null); }}
      >
        {/* Status toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const nextStatus = task.status === "done" ? "todo" : "done";
            updateTask(task.id, { status: nextStatus });
          }}
          className={cn("mt-0.5 transition-colors cursor-pointer", STATUS_CONFIG[task.status].color)}
        >
          <StatusIcon className={cn("h-4 w-4", task.status === "in_progress" && "animate-spin")} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm text-[var(--sb-text)]", task.status === "done" && "line-through text-[var(--sb-muted)]")}>
            {task.title || "Senza titolo"}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {project && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--sb-muted)]">
                <span className={cn("w-2 h-2 rounded-full", PROJECT_COLORS[project.color] || "bg-indigo-500")} />
                {project.name}
              </span>
            )}
            <DueLabel date={task.due_date} />
            {task.recurring && (
              <span className="text-[10px] text-[var(--sb-muted)] flex items-center gap-0.5">
                <Repeat className="h-2.5 w-2.5" />
                {task.recurring === "daily" ? "Giornaliero" : task.recurring === "weekly" ? "Settimanale" : "Mensile"}
              </span>
            )}
            {totalSubs > 0 && (
              <span className="text-[10px] text-[var(--sb-muted)]">
                ✓ {completedSubs}/{totalSubs}
              </span>
            )}
            {task.note_id && (
              <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
                <Link2 className="h-2.5 w-2.5" />
                Nota
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag} className="text-[10px] text-[var(--sb-muted)] bg-[var(--sb-card)] rounded px-1.5 py-0.5">{tag}</span>
            ))}
          </div>
        </div>

        {/* Priority dot */}
        <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", pConfig.dot)} title={pConfig.label} />

        {/* Delete on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(task.id); }}
          className="p-1 rounded-md text-[var(--sb-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  /* ── Kanban View ───────────────────────────────────────────── */

  function KanbanView() {
    const columns: { key: Task["status"]; label: string }[] = [
      { key: "todo", label: "Da fare" },
      { key: "in_progress", label: "In corso" },
      { key: "done", label: "Completati" },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = sorted.filter((t) => t.status === col.key);
          const StatusIcon = STATUS_CONFIG[col.key].icon;
          return (
            <div
              key={col.key}
              className={cn(
                "flex flex-col rounded-xl border border-[var(--sb-border)] bg-[var(--sb-card)] min-h-[200px]",
                dragOverColumn === col.key && "ring-2 ring-indigo-500/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={() => handleKanbanDrop(col.key)}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--sb-border)]">
                <StatusIcon className={cn("h-4 w-4", STATUS_CONFIG[col.key].color)} />
                <span className="text-xs font-semibold text-[var(--sb-text)]">{col.label}</span>
                <span className="text-[10px] text-[var(--sb-muted)] ml-auto">{colTasks.length}</span>
              </div>
              <div className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto max-h-[60vh]">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-[var(--sb-muted)] text-center py-8">Nessun task</p>
                ) : (
                  colTasks.map((task) => <TaskRow key={task.id} task={task} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Calendar View ─────────────────────────────────────────── */

  function CalendarView() {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCalendarMonth(addDays(monthStart, -1))} className="px-3 py-1 text-xs rounded-md bg-[var(--sb-card)] text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors cursor-pointer">
            ←
          </button>
          <h3 className="text-sm font-semibold text-[var(--sb-text)] capitalize">
            {format(calendarMonth, "MMMM yyyy", { locale: it })}
          </h3>
          <button onClick={() => setCalendarMonth(addDays(monthEnd, 1))} className="px-3 py-1 text-xs rounded-md bg-[var(--sb-card)] text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors cursor-pointer">
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-[var(--sb-border)] rounded-xl overflow-hidden">
          {dayNames.map((d) => (
            <div key={d} className="bg-[var(--sb-surface)] px-2 py-2 text-center text-[10px] font-semibold text-[var(--sb-muted)] uppercase">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dayTasks = filtered.filter((t) => t.due_date && isSameDay(new Date(t.due_date), day));
            const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
            const isCurrentDay = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "bg-[var(--sb-surface)] min-h-[80px] p-1.5",
                  !isCurrentMonth && "opacity-40",
                  isCurrentDay && "bg-indigo-500/5"
                )}
              >
                <span className={cn(
                  "text-[11px] font-medium block mb-1",
                  isCurrentDay ? "text-indigo-400" : "text-[var(--sb-muted)]"
                )}>
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        "text-[9px] px-1 py-0.5 rounded truncate text-left cursor-pointer transition-colors",
                        task.status === "done" ? "line-through text-[var(--sb-muted)] bg-[var(--sb-card)]" : cn(PRIORITY_CONFIG[task.priority].bg, PRIORITY_CONFIG[task.priority].color)
                      )}
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] text-[var(--sb-muted)] px-1">+{dayTasks.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Today View ────────────────────────────────────────────── */

  function TodayView() {
    const overdue = todayTasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const today = todayTasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
    const noDue = filtered.filter((t) => !t.due_date && t.status !== "done");

    return (
      <div className="space-y-6">
        {overdue.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-red-500 uppercase mb-2 flex items-center gap-1.5">
              <Flag className="h-3 w-3" />
              In ritardo ({overdue.length})
            </h3>
            <div className="flex flex-col gap-0.5">
              {overdue.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          </section>
        )}
        <section>
          <h3 className="text-xs font-semibold text-amber-500 uppercase mb-2 flex items-center gap-1.5">
            <Sun className="h-3 w-3" />
            Oggi ({today.length})
          </h3>
          {today.length === 0 ? (
            <p className="text-xs text-[var(--sb-muted)] py-4">Nessun task per oggi. Ottimo lavoro! 🎉</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {today.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </section>
        {noDue.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-[var(--sb-muted)] uppercase mb-2">
              Senza scadenza ({noDue.length})
            </h3>
            <div className="flex flex-col gap-0.5">
              {noDue.slice(0, 10).map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ── Task Detail Panel ─────────────────────────────────────── */

  function TaskDetail() {
    const [editTitle, setEditTitle] = useState(selectedTask?.title ?? "");
    const [editDesc, setEditDesc] = useState(selectedTask?.description ?? "");
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [editTags, setEditTags] = useState(selectedTask?.tags.join(", ") ?? "");
    const [showNotePicker, setShowNotePicker] = useState(false);
    const [noteSearch, setNoteSearch] = useState("");
    const filteredNotes = notes.filter((n) =>
      !noteSearch || (n.title || "").toLowerCase().includes(noteSearch.toLowerCase())
    );

    if (!selectedTask) return null;

    const task = selectedTask;
    const linkedNote = notes.find((n) => n.id === task.note_id);

    function saveDetail() {
      const tagArr = editTags.split(",").map((t) => t.trim()).filter(Boolean);
      updateTask(task.id, { title: editTitle, description: editDesc, tags: tagArr });
    }

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-start md:p-4 md:pt-[10vh]" onClick={() => { saveDetail(); setSelectedTask(null); }}>
        <div className="sb-mobile-modal w-full max-w-lg rounded-t-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-2xl safe-bottom md:rounded-lg" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sb-border)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = task.status === "done" ? "todo" : "done";
                  updateTask(task.id, { status: next });
                }}
                className={cn("cursor-pointer", STATUS_CONFIG[task.status].color)}
              >
                {(() => { const I = STATUS_CONFIG[task.status].icon; return <I className="h-5 w-5" />; })()}
              </button>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={saveDetail}
                className="text-lg font-semibold text-[var(--sb-text)] bg-transparent focus:outline-none flex-1"
                placeholder="Titolo task"
              />
            </div>
            <button onClick={() => { saveDetail(); setSelectedTask(null); }} className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Status / Priority / Due Date row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Stato</label>
                <select
                  value={task.status}
                  onChange={(e) => updateTask(task.id, { status: e.target.value as Task["status"] })}
                  className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none cursor-pointer"
                >
                  <option value="todo">Da fare</option>
                  <option value="in_progress">In corso</option>
                  <option value="done">Completato</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Priorità</label>
                <select
                  value={task.priority}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value as Task["priority"] })}
                  className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none cursor-pointer"
                >
                  <option value="urgent">🔴 Urgente</option>
                  <option value="high">🟠 Alta</option>
                  <option value="medium">🔵 Media</option>
                  <option value="low">⚪ Bassa</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Scadenza</label>
                <input
                  type="date"
                  value={task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : ""}
                  onChange={(e) => updateTask(task.id, { due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Project + Recurring */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Progetto</label>
                <select
                  value={task.project_id || ""}
                  onChange={(e) => updateTask(task.id, { project_id: e.target.value || null })}
                  className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none cursor-pointer"
                >
                  <option value="">Nessun progetto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.emoji ? `${p.emoji} ` : ""}{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Ricorrenza</label>
                <select
                  value={task.recurring || ""}
                  onChange={(e) => updateTask(task.id, { recurring: (e.target.value || null) as Task["recurring"] })}
                  className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none cursor-pointer"
                >
                  <option value="">Nessuna</option>
                  <option value="daily">Giornaliero</option>
                  <option value="weekly">Settimanale</option>
                  <option value="monthly">Mensile</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Descrizione</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onBlur={saveDetail}
                rows={3}
                placeholder="Aggiungi una descrizione..."
                className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-3 py-2 text-xs text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Tag (separati da virgola)</label>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                onBlur={saveDetail}
                placeholder="es. lavoro, urgente"
                className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-3 py-1.5 text-xs text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none"
              />
            </div>

            {/* Linked note */}
            <div>
              <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-1 block">Nota collegata</label>
              {linkedNote ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/notes/${linkedNote.id}`, "_blank")}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    <BookOpen className="h-3 w-3" />
                    {linkedNote.title || "Senza titolo"}
                  </button>
                  <button onClick={() => updateTask(task.id, { note_id: null })} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">
                    Scollega
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => { setShowNotePicker(!showNotePicker); setNoteSearch(""); }}
                    className="text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] cursor-pointer flex items-center gap-1"
                  >
                    <Link2 className="h-3 w-3" />
                    Collega una nota
                  </button>
                  {showNotePicker && (
                    <div className="absolute left-0 top-full mt-1 bg-[var(--sb-bg)] border border-[var(--sb-border)] rounded-xl shadow-xl z-20 w-72">
                      <div className="p-2 border-b border-[var(--sb-border)]">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--sb-muted)]" />
                          <input
                            value={noteSearch}
                            onChange={(e) => setNoteSearch(e.target.value)}
                            placeholder="Cerca nota..."
                            autoFocus
                            className="w-full bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none focus:border-[var(--sb-accent)]"
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {filteredNotes.length === 0 ? (
                          <p className="text-xs text-[var(--sb-muted)] text-center py-3">Nessuna nota trovata</p>
                        ) : (
                          filteredNotes.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => { updateTask(task.id, { note_id: n.id }); setShowNotePicker(false); setNoteSearch(""); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)] transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <BookOpen className="h-3 w-3 shrink-0" />
                              <span className="truncate">{n.title || "Senza titolo"}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <label className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-2 block">
                Sottotask ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
              </label>
              <div className="flex flex-col gap-1 mb-2">
                {task.subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 group/sub">
                    <button onClick={() => toggleSubtask(sub.id, !sub.completed)} className="cursor-pointer">
                      {sub.completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-[var(--sb-muted)]" />
                      )}
                    </button>
                    <span className={cn("text-xs flex-1", sub.completed ? "line-through text-[var(--sb-muted)]" : "text-[var(--sb-text)]")}>
                      {sub.title}
                    </span>
                    <button onClick={() => deleteSubtask(sub.id)} className="p-0.5 text-[var(--sb-muted)] hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all cursor-pointer">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubtaskTitle.trim()) {
                      addSubtask(task.id, newSubtaskTitle.trim());
                      setNewSubtaskTitle("");
                    }
                  }}
                  placeholder="Aggiungi sottotask..."
                  className="flex-1 bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none"
                />
                <button
                  onClick={() => { if (newSubtaskTitle.trim()) { addSubtask(task.id, newSubtaskTitle.trim()); setNewSubtaskTitle(""); } }}
                  className="px-2 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Aggiungi
                </button>
              </div>
            </div>

            {/* Delete */}
            <div className="pt-2 border-t border-[var(--sb-border)]">
              <button
                onClick={() => setConfirmDeleteId(task.id)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Elimina task
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Render ───────────────────────────────────────────── */

  return (
    <div className="sb-page flex h-full max-w-6xl flex-col">
      {/* Header */}
      <div className="sb-hero sb-module-tasks mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-4xl">Task</h1>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-xl font-bold tabular-nums text-[var(--sb-text)]">{stats.total}</p>
              <p className="text-[10px] uppercase text-[var(--sb-muted)]">Attivi</p>
            </div>
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2">
              <p className="text-xl font-bold tabular-nums text-red-300">{stats.overdue}</p>
              <p className="text-[10px] uppercase text-[var(--sb-muted)]">Ritardo</p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
              <p className="text-xl font-bold tabular-nums text-emerald-300">{stats.done_week}</p>
              <p className="text-[10px] uppercase text-[var(--sb-muted)]">Settimana</p>
            </div>
          </div>
        </div>

        {/* View toggles */}
        <div className="sb-toolbar gap-1 bg-white/[0.04] p-1">
          {([
            { key: "list" as ViewMode, icon: LayoutList, label: "Lista" },
            { key: "kanban" as ViewMode, icon: Columns3, label: "Kanban" },
            { key: "calendar" as ViewMode, icon: CalendarDays, label: "Calendario" },
            { key: "today" as ViewMode, icon: Sun, label: "Oggi" },
          ]).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "sb-focus sb-row flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-xs transition-all",
                view === v.key
                  ? "bg-[var(--sb-hover)] text-[var(--sb-text)] font-medium"
                  : "text-[var(--sb-muted)] hover:text-[var(--sb-text)]"
              )}
              title={v.label}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick add */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--sb-muted)]" />
          <input
            ref={quickAddRef}
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }}
            placeholder="Aggiungi un task... (Invio per creare)"
            className="sb-focus w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--sb-text)] placeholder-[var(--sb-muted)] transition-all focus:border-[var(--sb-accent)]"
          />
        </div>
        <select
          value={quickAddPriority}
          onChange={(e) => setQuickAddPriority(e.target.value as Task["priority"])}
          className="sb-focus cursor-pointer rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] px-2 py-2.5 text-xs text-[var(--sb-text)]"
        >
          <option value="urgent">🔴</option>
          <option value="high">🟠</option>
          <option value="medium">🔵</option>
          <option value="low">⚪</option>
        </select>
        <button onClick={quickAdd} disabled={!quickAddTitle.trim()} className="sb-focus rounded-lg border border-[var(--sb-accent)] bg-[var(--sb-accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--sb-accent-strong)] disabled:opacity-50 cursor-pointer">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--sb-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca task..."
            className="sb-focus w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] py-2 pl-10 pr-4 text-sm text-[var(--sb-text)] placeholder-[var(--sb-muted)] transition-all focus:border-[var(--sb-accent)]"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all cursor-pointer",
            (filterProject || filterPriority || filterTag) ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/10" : "border-[var(--sb-border)] text-[var(--sb-muted)] bg-[var(--sb-card)] hover:text-[var(--sb-text)]"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtri
          {(filterProject || filterPriority || filterTag) && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          )}
        </button>

        {/* Sort */}
        <div className="relative">
          <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center gap-1.5 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] px-3 py-2 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-all cursor-pointer">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-2 z-30 min-w-[160px]">
              {([
                { key: "priority" as SortMode, label: "Priorità" },
                { key: "due_date" as SortMode, label: "Scadenza" },
                { key: "created" as SortMode, label: "Data creazione" },
                { key: "title" as SortMode, label: "Titolo" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setSortMode(opt.key); setShowSortMenu(false); }}
                  className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer", sortMode === opt.key ? "bg-[var(--sb-hover)] text-[var(--sb-text)] font-medium" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                >
                  {opt.label}
                  {sortMode === opt.key && <span className="ml-auto text-indigo-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Show completed */}
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all cursor-pointer",
            showCompleted ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-[var(--sb-border)] text-[var(--sb-muted)] bg-[var(--sb-card)] hover:text-[var(--sb-text)]"
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completati
        </button>
      </div>

      {/* Filters detail row */}
      {showFilters && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[var(--sb-card)] border border-[var(--sb-border)] flex-wrap">
          {/* Project filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold">Progetto:</span>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setFilterProject(null)} className={cn("px-2 py-0.5 text-[10px] rounded-md transition-colors cursor-pointer", !filterProject ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]")}>
                Tutti
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFilterProject(filterProject === p.id ? null : p.id)}
                  className={cn("flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition-colors cursor-pointer", filterProject === p.id ? "bg-indigo-500/20 text-indigo-300" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]")}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", PROJECT_COLORS[p.color] || "bg-indigo-500")} />
                  {p.name}
                </button>
              ))}
              <button onClick={() => setShowNewProject(true)} className="text-[10px] text-[var(--sb-muted)] hover:text-[var(--sb-text)] cursor-pointer px-1">
                <FolderPlus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="w-px h-4 bg-[var(--sb-border)]" />

          {/* Priority filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold">Priorità:</span>
            <div className="flex gap-1">
              <button onClick={() => setFilterPriority(null)} className={cn("px-2 py-0.5 text-[10px] rounded-md transition-colors cursor-pointer", !filterPriority ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]")}>
                Tutte
              </button>
              {(["urgent", "high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                  className={cn("flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition-colors cursor-pointer", filterPriority === p ? cn(PRIORITY_CONFIG[p].bg, PRIORITY_CONFIG[p].color) : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]")}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_CONFIG[p].dot)} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <>
              <div className="w-px h-4 bg-[var(--sb-border)]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold">Tag:</span>
                <div className="flex flex-wrap gap-1">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                      className={cn("px-2 py-0.5 text-[10px] rounded-md transition-colors cursor-pointer", filterTag === tag ? "bg-indigo-500/20 text-indigo-300" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]")}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Clear all */}
          {(filterProject || filterPriority || filterTag) && (
            <button onClick={() => { setFilterProject(null); setFilterPriority(null); setFilterTag(null); }} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer ml-auto">
              Cancella filtri
            </button>
          )}
        </div>
      )}

      {/* Projects bar */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setFilterProject(null)}
          className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer", !filterProject ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "bg-[var(--sb-card)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
        >
          Tutti
        </button>
        {projects.map((p) => (
          <div key={p.id} className="group/proj relative">
            <button
              onClick={() => setFilterProject(filterProject === p.id ? null : p.id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer border", filterProject === p.id ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" : "bg-[var(--sb-card)] text-[var(--sb-muted)] border-transparent hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
            >
              <span className={cn("w-2 h-2 rounded-full", PROJECT_COLORS[p.color] || "bg-indigo-500")} />
              {p.emoji && <span className="text-sm">{p.emoji}</span>}
              {p.name}
              <span className="text-[10px] text-[var(--sb-muted)]">
                ({tasks.filter((t) => t.project_id === p.id && t.status !== "done").length})
              </span>
            </button>
            <button onClick={() => deleteProject(p.id)} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[var(--sb-surface)] text-[var(--sb-muted)] hover:text-red-400 opacity-0 group-hover/proj:opacity-100 transition-all cursor-pointer">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {showNewProject ? (
          <div className="flex items-center gap-1">
            <select value={newProjectColor} onChange={(e) => setNewProjectColor(e.target.value)} className="bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-1 py-1 text-xs cursor-pointer">
              {Object.keys(PROJECT_COLORS).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createProject(); if (e.key === "Escape") setShowNewProject(false); }} placeholder="Nome progetto..." autoFocus className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-card)] px-2 py-1 text-xs text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none w-28" />
            <button onClick={createProject} className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">OK</button>
          </div>
        ) : (
          <button onClick={() => setShowNewProject(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer">
            <FolderPlus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === "list" && (
          sorted.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title={search || filterProject || filterPriority || filterTag ? "Nessun task trovato." : "Nessun task ancora. Aggiungine uno!"}
              className="py-20"
            />
          ) : (
            <div className="flex flex-col gap-0.5">
              {sorted.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          )
        )}
        {view === "kanban" && <KanbanView />}
        {view === "calendar" && <CalendarView />}
        {view === "today" && <TodayView />}
      </div>

      {/* Task detail modal */}
      {selectedTask && <TaskDetail />}

      {/* Delete dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-4" onClick={() => setConfirmDeleteId(null)}>
          <DialogPanel className="sb-mobile-modal max-w-sm rounded-t-lg p-5 safe-bottom md:rounded-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-2">Eliminare il task?</h2>
            <p className="text-xs text-[var(--sb-muted)] mb-5 leading-relaxed">
              Il task verrà spostato nel cestino.
            </p>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setConfirmDeleteId(null)} size="sm" variant="subtle">
                Annulla
              </Button>
              <Button onClick={() => deleteTask(confirmDeleteId)} size="sm" variant="danger">
                Elimina
              </Button>
            </div>
          </DialogPanel>
        </div>
      )}

      {/* New project dialog */}
    </div>
  );
}
