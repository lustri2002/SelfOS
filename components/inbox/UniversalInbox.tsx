"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  BookOpen,
  CheckSquare,
  GraduationCap,
  Inbox,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { parseInboxText, toTiptapDoc, type InboxDraft, type InboxKind } from "@/lib/inbox/parser";
import { cn } from "@/lib/utils/cn";
import { Button, IconButton } from "@/components/ui/Button";
import { isModuleEnabled, type AppModuleId } from "@/config/modules";

const kindMeta: Record<InboxKind, { label: string; icon: typeof Inbox; hint: string }> = {
  note: { label: "Nota", icon: BookOpen, hint: "Crea una nota veloce" },
  task: { label: "Task", icon: CheckSquare, hint: "Aggiunge una cosa da fare" },
  workout: { label: "Workout", icon: Activity, hint: "Registra un allenamento" },
  income: { label: "Entrata", icon: Banknote, hint: "Aggiunge un'entrata mensile" },
  exam: { label: "Esame", icon: GraduationCap, hint: "Aggiunge un esame o milestone education" },
};

const kindOrder: InboxKind[] = ["note", "task", "workout", "income", "exam"];

const kindModule: Record<InboxKind, AppModuleId> = {
  note: "notes",
  task: "tasks",
  workout: "fitness",
  income: "finance",
  exam: "education",
};

const enabledKindOrder = kindOrder.filter((kind) => isModuleEnabled(kindModule[kind]));

function todayMonth() {
  return new Date().toISOString().slice(0, 7);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function UniversalInbox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kindOverride, setKindOverride] = useState<InboxKind | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const router = useRouter();

  const parsed = useMemo(() => parseInboxText(text), [text]);
  const parsedKindEnabled = isModuleEnabled(kindModule[parsed.kind]);
  const fallbackKind = enabledKindOrder[0] ?? "note";
  const draft: InboxDraft = { ...parsed, kind: kindOverride ?? (parsedKindEnabled ? parsed.kind : fallbackKind) };
  const selectedMeta = kindMeta[draft.kind];
  const SelectedIcon = selectedMeta.icon;

  useEffect(() => {
    function openInbox() {
      setOpen(true);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        openInbox();
      }
    }

    window.addEventListener("sb:open-inbox", openInbox);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("sb:open-inbox", openInbox);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setKindOverride(null);
  }, [text]);

  function close() {
    if (saving) return;
    setOpen(false);
    setText("");
    setKindOverride(null);
  }

  async function saveNote() {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title || "Nota inbox",
        content: toTiptapDoc(draft.body),
        tags: draft.tags,
      }),
    });
    const result = (await response.json()) as { note?: { id: string }; error?: string };

    if (!response.ok || !result.note) throw new Error(result.error || "Errore nota");
    router.push(`/notes/${result.note.id}`);
  }

  async function saveTask() {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      title: draft.title || "Task inbox",
      description: draft.body,
      priority: draft.priority,
      due_date: draft.date,
      tags: draft.tags,
      }),
    });

    if (!response.ok) throw new Error("Errore task");
    router.push("/tasks");
  }

  async function saveWorkout() {
    const response = await fetch("/api/fitness/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "insert_workout", data: {
      date: draft.date ?? todayDate(),
      type: draft.workoutType,
      distance_km: draft.distanceKm,
      duration_minutes: draft.durationMinutes,
      notes: draft.body,
      source: "manual",
      } }),
    });

    if (!response.ok) throw new Error("Errore workout");
    router.push("/fitness");
  }

  async function saveIncome() {
    const amount = draft.amount ?? 0;
    const response = await fetch("/api/finance/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "monthly_income", action: "insert", data: {
      month: (draft.date ?? todayDate()).slice(0, 7) || todayMonth(),
      label: draft.title || "Entrata inbox",
      amount,
      } }),
    });

    if (!response.ok) throw new Error("Errore entrata");
    router.push("/finance");
  }

  async function saveExam() {
    const response = await fetch("/api/university/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {
      name: draft.title || "Esame inbox",
      cfu: draft.cfu ?? 6,
      status: draft.date ? "booked" : "planned",
      exam_date: draft.date,
      year: 1,
      exam_type: "mandatory",
      sort_order: 999,
      } }),
    });

    if (!response.ok) throw new Error("Errore esame");
    router.push("/university");
  }

  async function save() {
    if (!text.trim()) return;

    setSaving(true);
    try {
      if (!isModuleEnabled(kindModule[draft.kind])) throw new Error("Modulo disabilitato");
      if (draft.kind === "note") await saveNote();
      if (draft.kind === "task") await saveTask();
      if (draft.kind === "workout") await saveWorkout();
      if (draft.kind === "income") await saveIncome();
      if (draft.kind === "exam") await saveExam();

      toast.success(`${selectedMeta.label} salvata dall'inbox`);
      setOpen(false);
      setText("");
      setKindOverride(null);
      router.refresh();
    } catch {
      toast.error("Non sono riuscito a salvare l'elemento");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.42)", backdropFilter: "blur(10px)" }}
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--sb-border)] px-4 py-3">
          <Inbox className="h-5 w-5 text-[var(--sb-accent)]" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-[var(--sb-text)]">Inbox universale</h2>
            <p className="text-xs text-[var(--sb-muted)]">Cmd+Shift+I per catturare al volo</p>
          </div>
          <IconButton aria-label="Chiudi inbox" variant="ghost" onClick={close}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="space-y-4 p-4">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            placeholder="Scrivi qualsiasi cosa: 'task pagare affitto domani #casa', 'nota idea progetto', 'corsa 5km 32min oggi', 'entrata stipendio 1200', 'esame Matematica 6 crediti 20/06/2026'"
            className="sb-focus min-h-28 w-full resize-none rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-3 text-sm text-[var(--sb-text)] placeholder:text-[var(--sb-muted)]"
          />

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(enabledKindOrder.length, 1)}, minmax(0, 1fr))` }}>
            {enabledKindOrder.map((kind) => {
              const Icon = kindMeta[kind].icon;
              const active = draft.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKindOverride(kind)}
                  className={cn(
                    "sb-focus flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-xs transition-colors sb-press",
                    active
                      ? "border-[var(--sb-accent)] bg-[var(--sb-accent-soft)] text-[var(--sb-text)]"
                      : "border-[var(--sb-border)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
                  )}
                  title={kindMeta[kind].hint}
                >
                  <Icon className={cn("h-4 w-4", active && "text-[var(--sb-accent)]")} />
                  <span className="truncate">{kindMeta[kind].label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3 text-xs text-[var(--sb-muted)]">
            <div className="mb-1 flex items-center gap-2 text-[var(--sb-text)]">
              <SelectedIcon className="h-4 w-4 text-[var(--sb-accent)]" />
              <strong>{draft.title || "Elemento inbox"}</strong>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {draft.date && <span>Data: {draft.date}</span>}
              {draft.tags.length > 0 && <span>Tag: {draft.tags.join(", ")}</span>}
              {draft.kind === "task" && <span>Priorita: {draft.priority}</span>}
              {draft.kind === "income" && <span>Importo: {draft.amount ?? 0}</span>}
              {draft.kind === "workout" && draft.distanceKm && <span>Distanza: {draft.distanceKm} km</span>}
              {draft.kind === "workout" && draft.durationMinutes && <span>Durata: {draft.durationMinutes} min</span>}
              {draft.kind === "exam" && <span>CFU: {draft.cfu ?? 6}</span>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={close}>Annulla</Button>
            <Button
              variant="default"
              onClick={save}
              disabled={!text.trim() || saving}
              leadingIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
            >
              Salva
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
