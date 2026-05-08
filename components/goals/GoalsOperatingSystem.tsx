"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Dumbbell, GraduationCap, Plus, Target, Trash2, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database";

type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

interface GoalsOperatingSystemProps {
  initialGoals: Goal[];
  projects: Project[];
}

const AREAS = [
  { id: "health", label: "Salute", icon: Dumbbell, className: "text-rose-400" },
  { id: "finance", label: "Soldi", icon: CircleDollarSign, className: "text-emerald-400" },
  { id: "study", label: "Studio", icon: GraduationCap, className: "text-sky-400" },
  { id: "work", label: "Lavoro", icon: TrendingUp, className: "text-amber-400" },
  { id: "relationships", label: "Relazioni", icon: Users, className: "text-pink-400" },
  { id: "growth", label: "Crescita", icon: Target, className: "text-indigo-400" },
];

const HORIZONS = [
  { id: "month", label: "Mese" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Anno" },
  { id: "life", label: "Visione" },
];

function completion(goal: Goal) {
  if (!goal.target_value || goal.target_value <= 0) return goal.status === "completed" ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)));
}

function areaMeta(area: string) {
  return AREAS.find((item) => item.id === area) ?? AREAS[AREAS.length - 1];
}

export default function GoalsOperatingSystem({ initialGoals, projects }: GoalsOperatingSystemProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    area: "growth",
    horizon: "quarter",
    target_value: "",
    current_value: "",
    unit: "",
    due_date: "",
    linked_project_id: "",
    notes: "",
  });

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");
  const averageProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((sum, goal) => sum + completion(goal), 0) / activeGoals.length)
    : 0;
  const atRiskGoals = activeGoals.filter((goal) => goal.due_date && isPast(parseISO(goal.due_date)) && completion(goal) < 100);

  const areaFocus = useMemo(() => {
    return AREAS.map((area) => ({
      ...area,
      count: activeGoals.filter((goal) => goal.area === area.id).length,
    })).sort((a, b) => b.count - a.count);
  }, [activeGoals]);

  async function createGoal() {
    if (!form.title.trim()) return;
    setSaving(true);
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Impossibile creare l'obiettivo");
      return;
    }
    setGoals((prev) => [payload.goal as Goal, ...prev]);
    setForm({ title: "", area: "growth", horizon: "quarter", target_value: "", current_value: "", unit: "", due_date: "", linked_project_id: "", notes: "" });
    toast.success("Obiettivo agganciato al sistema");
  }

  async function patchGoal(id: string, patch: Partial<Goal>) {
    const previous = goals;
    setGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, ...patch } : goal));
    const response = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json();
    if (!response.ok) {
      setGoals(previous);
      toast.error(payload.error ?? "Aggiornamento non riuscito");
      return;
    }
    setGoals((prev) => prev.map((goal) => goal.id === id ? payload.goal as Goal : goal));
  }

  async function deleteGoal(id: string) {
    const previous = goals;
    setGoals((prev) => prev.filter((goal) => goal.id !== id));
    const response = await fetch(`/api/goals/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setGoals(previous);
      toast.error("Eliminazione non riuscita");
    }
  }

  return (
    <div className="sb-page max-w-7xl">
      <section className="sb-hero sb-module-system mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="sb-eyebrow mb-3">Goal Operating System</p>
            <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-5xl">Direzione, metriche e prossime mosse.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--sb-muted)]">
              Collega obiettivi, progetti e numeri: il sistema ti mostra dove stai andando e cosa rischia di restare solo un&apos;intenzione.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:min-w-96">
            <Metric value={activeGoals.length} label="Attivi" />
            <Metric value={`${averageProgress}%`} label="Avanzamento" />
            <Metric value={atRiskGoals.length} label="A rischio" danger={atRiskGoals.length > 0} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.6fr]">
        <Panel className="h-fit p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--sb-text)]">Nuovo obiettivo</h2>
            <Target className="h-4 w-4 text-[var(--sb-accent)]" />
          </div>
          <div className="space-y-3">
            <TextField placeholder="Es. Chiudere la sessione con media 28" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <SelectField value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                {AREAS.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
              </SelectField>
              <SelectField value={form.horizon} onChange={(e) => setForm({ ...form, horizon: e.target.value })}>
                {HORIZONS.map((horizon) => <option key={horizon.id} value={horizon.id}>{horizon.label}</option>)}
              </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <TextField type="number" placeholder="Ora" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} />
              <TextField type="number" placeholder="Target" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
              <TextField placeholder="Unita" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <TextField type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <SelectField value={form.linked_project_id} onChange={(e) => setForm({ ...form, linked_project_id: e.target.value })}>
              <option value="">Nessun progetto collegato</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </SelectField>
            <TextArea rows={3} placeholder="Criterio di successo, motivazione, vincoli..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button variant="default" className="w-full" leadingIcon={<Plus className="h-4 w-4" />} onClick={createGoal} disabled={saving || !form.title.trim()}>
              Crea obiettivo
            </Button>
          </div>
        </Panel>

        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            {areaFocus.slice(0, 3).map((area) => {
              const Icon = area.icon;
              return (
                <Panel key={area.id} className="p-4">
                  <Icon className={cn("mb-3 h-5 w-5", area.className)} />
                  <p className="text-2xl font-bold text-[var(--sb-text)]">{area.count}</p>
                  <p className="text-xs text-[var(--sb-muted)]">{area.label}</p>
                </Panel>
              );
            })}
          </div>

          <div className="space-y-3">
            {goals.length === 0 ? (
              <Panel className="p-8 text-center">
                <Target className="mx-auto mb-3 h-8 w-8 text-[var(--sb-muted)]" />
                <p className="text-sm text-[var(--sb-muted)]">Nessun obiettivo ancora. Creane uno e il Command Center iniziera a usarlo.</p>
              </Panel>
            ) : goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} projects={projects} onPatch={patchGoal} onDelete={deleteGoal} />
            ))}
          </div>

          {completedGoals.length > 0 && (
            <p className="text-xs text-[var(--sb-muted)]">{completedGoals.length} obiettivi completati: archivio di prove, non solo promesse.</p>
          )}
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

function GoalCard({ goal, projects, onPatch, onDelete }: {
  goal: Goal;
  projects: Project[];
  onPatch: (id: string, patch: Partial<Goal>) => void;
  onDelete: (id: string) => void;
}) {
  const progress = completion(goal);
  const meta = areaMeta(goal.area);
  const Icon = meta.icon;
  const project = projects.find((item) => item.id === goal.linked_project_id);
  const overdue = goal.due_date && isPast(parseISO(goal.due_date)) && progress < 100;

  return (
    <Panel className="p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <span className="sb-module-icon shrink-0">
          <Icon className={cn("h-4 w-4", meta.className)} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--sb-text)]">{goal.title}</h3>
            <span className="sb-module-pill sb-module-system rounded-lg px-2 py-1 text-[10px] uppercase">{meta.label}</span>
            {overdue && <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] text-red-300"><AlertTriangle className="h-3 w-3" />Scaduto</span>}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sb-border)]">
            <div className="h-full rounded-full bg-[var(--sb-accent)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--sb-muted)]">
            <span>{progress}% completato</span>
            {goal.target_value && <span>{goal.current_value}/{goal.target_value} {goal.unit}</span>}
            {goal.due_date && <span>{format(parseISO(goal.due_date), "d MMM yyyy", { locale: it })}</span>}
            {project && <span>Progetto: {project.name}</span>}
          </div>
          {goal.notes && <p className="mt-3 text-sm leading-relaxed text-[var(--sb-muted)]">{goal.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TextField
            type="number"
            className="w-24"
            value={goal.current_value}
            onChange={(e) => onPatch(goal.id, { current_value: Number(e.target.value) })}
          />
          <Button
            size="icon"
            variant={goal.status === "completed" ? "default" : "subtle"}
            aria-label="Completa obiettivo"
            onClick={() => onPatch(goal.id, { status: goal.status === "completed" ? "active" : "completed" })}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="danger" aria-label="Elimina obiettivo" onClick={() => onDelete(goal.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Panel>
  );
}
