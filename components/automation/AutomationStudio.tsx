"use client";

import { useMemo, useState } from "react";
import { Bell, Bot, CheckSquare, Plus, Power, Sparkles, Trash2, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database";

type Automation = Database["public"]["Tables"]["automation_rules"]["Row"];

interface AutomationStudioProps {
  initialAutomations: Automation[];
}

const TRIGGERS = [
  { id: "daily_briefing", label: "Briefing giornaliero", icon: Bot },
  { id: "task_overdue", label: "Task in ritardo", icon: CheckSquare },
  { id: "goal_at_risk", label: "Obiettivo a rischio", icon: Sparkles },
  { id: "finance_due", label: "Scadenza finanziaria", icon: Wallet },
  { id: "habit_missed", label: "Abitudine saltata", icon: Bell },
];

const ACTIONS = [
  { id: "surface_in_command_center", label: "Mostra nel Command Center" },
  { id: "create_task", label: "Crea task" },
  { id: "raise_priority", label: "Alza priorita" },
  { id: "suggest_review", label: "Suggerisci review" },
];

export default function AutomationStudio({ initialAutomations }: AutomationStudioProps) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_type: "daily_briefing",
    condition: "ogni mattina alle 08:00",
    action_type: "surface_in_command_center",
    action: "aggiungi una card prioritaria",
  });

  const activeCount = automations.filter((rule) => rule.is_active).length;
  const triggerMix = useMemo(() => {
    return TRIGGERS.map((trigger) => ({
      ...trigger,
      count: automations.filter((rule) => rule.trigger_type === trigger.id).length,
    })).filter((item) => item.count > 0);
  }, [automations]);

  async function createAutomation() {
    if (!form.name.trim()) return;
    setSaving(true);
    const response = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        trigger_type: form.trigger_type,
        condition_config: { description: form.condition },
        action_type: form.action_type,
        action_config: { description: form.action },
        is_active: true,
      }),
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Automazione non creata");
      return;
    }
    setAutomations((prev) => [payload.automation as Automation, ...prev]);
    setForm({ name: "", trigger_type: "daily_briefing", condition: "ogni mattina alle 08:00", action_type: "surface_in_command_center", action: "aggiungi una card prioritaria" });
    toast.success("Automazione accesa");
  }

  async function toggleAutomation(rule: Automation) {
    const previous = automations;
    setAutomations((prev) => prev.map((item) => item.id === rule.id ? { ...item, is_active: !item.is_active } : item));
    const response = await fetch(`/api/automations/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    if (!response.ok) {
      setAutomations(previous);
      toast.error("Toggle non riuscito");
    }
  }

  async function deleteAutomation(id: string) {
    const previous = automations;
    setAutomations((prev) => prev.filter((item) => item.id !== id));
    const response = await fetch(`/api/automations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setAutomations(previous);
      toast.error("Eliminazione non riuscita");
    }
  }

  return (
    <div className="sb-page max-w-7xl">
      <section className="sb-hero sb-module-system mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="sb-eyebrow mb-3">Automation Studio</p>
            <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-5xl">Programma il tuo sistema personale.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--sb-muted)]">
              Regole leggibili: quando succede qualcosa, il sistema decide cosa evidenziare, creare o rilanciare.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:min-w-96">
            <Metric value={automations.length} label="Regole" />
            <Metric value={activeCount} label="Attive" />
            <Metric value={automations.reduce((sum, rule) => sum + rule.run_count, 0)} label="Esecuzioni" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.6fr]">
        <Panel className="h-fit p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--sb-text)]">Nuova automazione</h2>
            <Zap className="h-4 w-4 text-[var(--sb-accent)]" />
          </div>
          <div className="space-y-3">
            <TextField placeholder="Es. Proteggi gli obiettivi trimestrali" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <SelectField value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}>
              {TRIGGERS.map((trigger) => <option key={trigger.id} value={trigger.id}>{trigger.label}</option>)}
            </SelectField>
            <TextArea rows={2} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />
            <SelectField value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value })}>
              {ACTIONS.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
            </SelectField>
            <TextArea rows={2} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
            <Button variant="default" className="w-full" leadingIcon={<Plus className="h-4 w-4" />} onClick={createAutomation} disabled={saving || !form.name.trim()}>
              Crea automazione
            </Button>
          </div>
        </Panel>

        <div className="space-y-6">
          {triggerMix.length > 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {triggerMix.slice(0, 3).map((trigger) => {
                const Icon = trigger.icon;
                return (
                  <Panel key={trigger.id} className="p-4">
                    <Icon className="mb-3 h-5 w-5 text-[var(--sb-accent)]" />
                    <p className="text-2xl font-bold text-[var(--sb-text)]">{trigger.count}</p>
                    <p className="text-xs text-[var(--sb-muted)]">{trigger.label}</p>
                  </Panel>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            {automations.length === 0 ? (
              <Panel className="p-8 text-center">
                <Zap className="mx-auto mb-3 h-8 w-8 text-[var(--sb-muted)]" />
                <p className="text-sm text-[var(--sb-muted)]">Nessuna automazione. Crea la prima regola e il sistema iniziera a parlare con te.</p>
              </Panel>
            ) : automations.map((rule) => (
              <AutomationCard key={rule.id} rule={rule} onToggle={() => toggleAutomation(rule)} onDelete={() => deleteAutomation(rule.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-2xl font-bold tabular-nums text-[var(--sb-text)]">{value}</p>
      <p className="text-[10px] uppercase text-[var(--sb-muted)]">{label}</p>
    </div>
  );
}

function textFromJson(value: unknown) {
  if (value && typeof value === "object" && "description" in value) {
    const description = (value as { description?: unknown }).description;
    if (typeof description === "string") return description;
  }
  return "Configurazione personalizzata";
}

function AutomationCard({ rule, onToggle, onDelete }: { rule: Automation; onToggle: () => void; onDelete: () => void }) {
  const trigger = TRIGGERS.find((item) => item.id === rule.trigger_type) ?? TRIGGERS[0];
  const action = ACTIONS.find((item) => item.id === rule.action_type) ?? ACTIONS[0];
  const Icon = trigger.icon;

  return (
    <Panel className={cn("p-4", !rule.is_active && "opacity-65")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <span className="sb-module-icon shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--sb-text)]">{rule.name}</h3>
            <span className={cn("rounded-lg border px-2 py-1 text-[10px] uppercase", rule.is_active ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-[var(--sb-border)] text-[var(--sb-muted)]")}>
              {rule.is_active ? "Attiva" : "Spenta"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3">
              <p className="text-[10px] uppercase text-[var(--sb-muted)]">Quando</p>
              <p className="mt-1 text-sm text-[var(--sb-text)]">{trigger.label}</p>
              <p className="mt-1 text-xs text-[var(--sb-muted)]">{textFromJson(rule.condition_config)}</p>
            </div>
            <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3">
              <p className="text-[10px] uppercase text-[var(--sb-muted)]">Allora</p>
              <p className="mt-1 text-sm text-[var(--sb-text)]">{action.label}</p>
              <p className="mt-1 text-xs text-[var(--sb-muted)]">{textFromJson(rule.action_config)}</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="icon" variant={rule.is_active ? "default" : "subtle"} aria-label="Accendi o spegni automazione" onClick={onToggle}>
            <Power className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="danger" aria-label="Elimina automazione" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Panel>
  );
}
