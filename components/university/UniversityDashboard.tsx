"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle, BadgeCheck, BookMarked, CalendarDays, CalendarPlus, Check, ChevronDown, ChevronRight,
  Download, FileUp, LayoutDashboard, PlayCircle, Plus, Save, X,
  Target, Trophy,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database";

type Settings = Database["public"]["Tables"]["university_settings"]["Row"];
type Exam = Database["public"]["Tables"]["university_exams"]["Row"];
type ExamInsert = Database["public"]["Tables"]["university_exams"]["Insert"];
type ExamStatus = Exam["status"];
type ExamType = Exam["exam_type"];
type Filter = "all" | "official" | "online" | "planned";

type DraftExam = {
  id?: string;
  name: string;
  cfu: string;
  grade: string;
  honors: boolean;
  status: ExamStatus;
  exam_type: ExamType;
  year: string;
  area: string;
  exam_date: string;
};

type GradeTransition = {
  exam: Exam;
  nextStatus: ExamStatus;
  grade: string;
  examDate: string;
};

type ImportExam = {
  anno?: number;
  nome?: string;
  ssd?: string | null;
  voto?: number | string | null;
  data?: string | null;
  stato?: string | null;
  cfu_acquisiti?: number;
  cfu_richiesti?: number;
};

export interface UniversityDashboardProps {
  settings: Settings;
  exams: Exam[];
}

const emptyDraft: DraftExam = {
  name: "",
  cfu: "",
  grade: "",
  honors: false,
  status: "planned",
  exam_type: "mandatory",
  year: "1",
  area: "",
  exam_date: "",
};

const statusMeta: Record<ExamStatus, { label: string; className: string }> = {
  recognized: { label: "Convalidato", className: "bg-sky-500/10 text-sky-500" },
  online: { label: "Online svolto", className: "bg-violet-500/10 text-violet-400" },
  booked: { label: "Prenotato", className: "bg-indigo-500/10 text-indigo-400" },
  planned: { label: "Da sostenere", className: "bg-amber-500/10 text-amber-500" },
};

const examTypeMeta: Record<ExamType, { label: string; className: string }> = {
  mandatory: { label: "Obbligatorio", className: "border-sky-500/20 bg-sky-500/10 text-sky-500" },
  elective: { label: "A scelta", className: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-400" },
};

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "official", label: "Ufficiali" },
  { id: "online", label: "Online" },
  { id: "planned", label: "Mancanti" },
];

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value) || value === 0) return "-";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function isOfficial(exam: Exam) {
  return exam.status === "recognized";
}

function normalizeStatus(status?: string | null): ExamStatus {
  const value = String(status ?? "").toLowerCase();
  if (value.includes("da sostenere")) return "planned";
  if (value.includes("prenotato")) return "booked";
  if (value.includes("convalidato")) return "recognized";
  if (value.includes("online")) return "online";
  if (value.includes("sostenuto")) return "online";
  return "online";
}

function normalizeDate(date?: string | null) {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const match = String(date).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function gradeValue(exam: Exam, honorsValue: number) {
  if (!exam.grade) return null;
  return exam.honors ? honorsValue : Number(exam.grade);
}

function sortExams(items: Exam[]) {
  return [...items].sort((a, b) => (
    a.year - b.year
    || a.sort_order - b.sort_order
    || a.name.localeCompare(b.name)
  ));
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextStatusFor(exam: Exam): ExamStatus | null {
  if (exam.status === "planned") return "booked";
  if (exam.status === "booked" && !exam.exam_date) return "booked";
  if (exam.status === "booked") return "online";
  if (exam.status === "online") return "recognized";
  return null;
}

function suggestedGradeFor(exam: Exam) {
  if (!exam.grade) return "";
  return String(exam.grade);
}

function NextStatusIcon({ status }: { status: ExamStatus }) {
  if (status === "booked") return <CalendarPlus className="h-4 w-4" />;
  if (status === "online") return <PlayCircle className="h-4 w-4" />;
  return <BadgeCheck className="h-4 w-4" />;
}

function groupedByYear(items: Exam[]) {
  const groups = new Map<number, Exam[]>();
  items.forEach((exam) => {
    const year = exam.year || 1;
    groups.set(year, [...(groups.get(year) ?? []), exam]);
  });
  return Array.from(groups.entries()).sort(([yearA], [yearB]) => yearA - yearB);
}

function initialCollapsedYears(items: Exam[]) {
  const collapsed = new Set<number>();
  groupedByYear(items).forEach(([year, yearExams]) => {
    const completed = yearExams.every((exam) => exam.status === "recognized");
    const future = yearExams.every((exam) => exam.status === "planned" && !exam.exam_date && !exam.grade);
    if (completed || future) collapsed.add(year);
  });

  if (collapsed.size === groupedByYear(items).length) {
    const firstActiveYear = groupedByYear(items).find(([, exams]) => (
      exams.some((exam) => exam.status !== "recognized")
    ))?.[0] ?? groupedByYear(items)[0]?.[0];
    if (firstActiveYear) collapsed.delete(firstActiveYear);
  }

  return collapsed;
}

export default function UniversityDashboard({
  settings: initialSettings,
  exams: initialExams,
}: UniversityDashboardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState(initialSettings);
  const [settingsDraft, setSettingsDraft] = useState({
    student_name: initialSettings.student_name ?? "",
    student_number: initialSettings.student_number ?? "",
    degree_course: initialSettings.degree_course ?? "Percorso di studio",
    total_cfu: String(initialSettings.total_cfu ?? 180),
    bonus_points: String(initialSettings.bonus_points ?? 0),
    honors_value: String(initialSettings.honors_value ?? 31),
  });
  const [exams, setExams] = useState(sortExams(initialExams));
  const [draft, setDraft] = useState<DraftExam>(emptyDraft);
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(() => initialCollapsedYears(sortExams(initialExams)));
  const [showExamModal, setShowExamModal] = useState(false);
  const [gradeTransition, setGradeTransition] = useState<GradeTransition | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const gradeRequiredDraft = draft.status === "online" || draft.status === "recognized";
  const dateRequiredDraft = draft.status !== "planned";
  const draftError = draft.status === "booked" && !draft.exam_date
    ? "Per lo stato Prenotato serve la data esame."
    : (draft.status === "online" || draft.status === "recognized") && (!draft.grade || !draft.exam_date)
      ? "Per gli esami svolti o convalidati servono voto e data."
    : null;

  const stats = useMemo(() => {
    const honorsValue = Number(settings.honors_value);
    const official = exams.filter(isOfficial);
    const online = exams.filter((exam) => exam.status === "online");
    const available = exams.filter((exam) => isOfficial(exam) || exam.status === "online");

    const weightedAverage = (items: Exam[], onlineIncrease = 0) => {
      const graded = items.filter((exam) => exam.counts_avg && gradeValue(exam, honorsValue));
      const points = graded.reduce((sum, exam) => {
        const value = gradeValue(exam, honorsValue) ?? 0;
        const adjusted = exam.status === "online" ? Math.min(value + onlineIncrease, honorsValue) : value;
        return sum + adjusted * Number(exam.cfu || 0);
      }, 0);
      const cfu = graded.reduce((sum, exam) => sum + Number(exam.cfu || 0), 0);
      return { avg: cfu ? points / cfu : 0, points, cfu };
    };

    const degreeFromAverage = (avg: number) => (
      avg ? Math.min((avg * 110) / 30 + Number(settings.bonus_points || 0), 110) : 0
    );

    const totalCfu = Number(settings.total_cfu) || 0;
    const officialAverage = weightedAverage(official);
    const availableAverage = weightedAverage(available, 0);
    const availablePlusAverage = weightedAverage(available, 2);
    const earnedCfu = official.reduce((sum, exam) => sum + Number(exam.cfu || 0), 0);
    const onlineCfu = online.reduce((sum, exam) => sum + Number(exam.cfu || 0), 0);
    const missingCfu = Math.max(totalCfu - earnedCfu, 0);

    return {
      totalCfu,
      earnedCfu,
      onlineCfu,
      missingCfu,
      completion: totalCfu ? Math.min((earnedCfu / totalCfu) * 100, 100) : 0,
      weightedAvg: officialAverage.avg,
      gradedCfu: officialAverage.cfu,
      availableAvg: availableAverage.avg,
      availableCfu: availableAverage.cfu,
      availablePlusAvg: availablePlusAverage.avg,
      availableDegree: degreeFromAverage(availableAverage.avg),
      availablePlusDegree: degreeFromAverage(availablePlusAverage.avg),
    };
  }, [exams, settings]);

  const visibleExams = useMemo(() => exams.filter((exam) => {
    if (filter === "all") return true;
    if (filter === "official") return isOfficial(exam);
    if (filter === "online") return exam.status === "online";
    return exam.status === "planned" || exam.status === "booked";
  }), [exams, filter]);

  const examsByYear = useMemo(() => {
    return groupedByYear(visibleExams);
  }, [visibleExams]);

  function toggleYear(year: number) {
    setCollapsedYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function openNewExamModal() {
    setDraft(emptyDraft);
    setShowExamModal(true);
  }

  function closeExamModal() {
    setDraft(emptyDraft);
    setShowExamModal(false);
  }

  async function updateExamStatus(exam: Exam, nextStatus: ExamStatus, grade?: number) {
    setSaving(true);
    setNotice(null);

    const patch = {
      status: nextStatus,
      grade: nextStatus === "booked" ? exam.grade : grade,
      exam_date: gradeTransition?.examDate || todayDate(),
      counts_avg: true,
    };

    try {
      const response = await fetch("/api/university/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exam.id, data: patch }),
      });
      const result = (await response.json()) as { exam?: Exam; error?: string };
      if (!response.ok || !result.exam) throw new Error(result.error || "Aggiornamento non riuscito");

      const updatedExam = result.exam;
      setExams((current) => sortExams(current.map((item) => (
        item.id === updatedExam.id ? updatedExam : item
      ))));
      setGradeTransition(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Aggiornamento non riuscito");
    } finally {
      setSaving(false);
    }
  }

  function advanceExam(exam: Exam) {
    const nextStatus = nextStatusFor(exam);
    if (!nextStatus) return;

    setGradeTransition({
      exam,
      nextStatus,
      grade: suggestedGradeFor(exam),
      examDate: exam.exam_date ?? todayDate(),
    });
  }

  async function submitGradeTransition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gradeTransition) return;
    if (gradeTransition.nextStatus === "booked" && !gradeTransition.examDate) return;
    if (gradeTransition.nextStatus !== "booked" && !gradeTransition.grade) return;
    await updateExamStatus(
      gradeTransition.exam,
      gradeTransition.nextStatus,
      gradeTransition.nextStatus === "booked" ? undefined : Number(gradeTransition.grade),
    );
  }

  async function saveExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.cfu) return;
    if (draftError) {
      setNotice(draftError);
      return;
    }
    setSaving(true);
    setNotice(null);

    try {
      const payload: Omit<ExamInsert, "user_id"> = {
        name: draft.name.trim(),
        cfu: Number(draft.cfu),
        grade: draft.grade ? Number(draft.grade) : null,
        honors: draft.honors,
        status: draft.status,
        exam_type: draft.exam_type,
        year: Number(draft.year),
        area: draft.area.trim() || null,
        exam_date: draft.exam_date || null,
        counts_avg: true,
        sort_order: draft.id ? exams.find((exam) => exam.id === draft.id)?.sort_order ?? exams.length : exams.length,
      };

      const response = await fetch("/api/university/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id || undefined, data: payload }),
      });
      const result = (await response.json()) as { exam?: Exam; error?: string };
      if (!response.ok || !result.exam) throw new Error(result.error || "Salvataggio non riuscito");
      const savedExam = result.exam;

      setExams((current) => sortExams(draft.id
        ? current.map((exam) => (exam.id === draft.id ? savedExam : exam))
        : [...current, savedExam]));
      closeExamModal();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  function exportData() {
    const payload = JSON.stringify({ settings, exams }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "education-record.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function parseImportedExams(parsed: unknown, uid: string): ExamInsert[] {
    const source = parsed as { exams?: Partial<Exam>[]; esami?: ImportExam[] };
    if (Array.isArray(source.exams)) {
      return source.exams.map((exam, index) => {
        const grade = exam.grade ? Number(exam.grade) : null;
        const examDate = exam.exam_date || null;
        const status = normalizeStatus(exam.status);

        return {
          user_id: uid,
          name: exam.name || "Esame senza nome",
          cfu: Number(exam.cfu || 1),
          grade,
          honors: Boolean(exam.honors),
          exam_type: exam.exam_type ?? "mandatory",
          status: status === "planned"
            ? "planned"
            : status === "booked" && examDate
              ? "booked"
              : grade && examDate
                ? status
                : examDate
                  ? "booked"
                  : "planned",
          year: Number(exam.year || 1),
          area: exam.area || null,
          exam_date: examDate,
          counts_avg: true,
          sort_order: index,
        };
      });
    }

    if (Array.isArray(source.esami)) {
      return source.esami.map((exam, index) => {
        const grade = Number(exam.voto);
        const hasGrade = Number.isFinite(grade) && grade >= 18;
        const examDate = normalizeDate(exam.data);
        const status = normalizeStatus(exam.stato);

        return {
          user_id: uid,
          name: exam.nome || "Esame senza nome",
          cfu: Number(exam.cfu_richiesti || exam.cfu_acquisiti || 1),
          grade: hasGrade ? grade : null,
          honors: String(exam.voto ?? "").toLowerCase().includes("l"),
          exam_type: "mandatory",
          status: status === "planned"
            ? "planned"
            : status === "booked" && examDate
              ? "booked"
              : hasGrade && examDate
                ? status
                : examDate
                  ? "booked"
                  : "planned",
          year: Number(exam.anno || 1),
          area: exam.ssd || null,
          exam_date: examDate,
          counts_avg: true,
          sort_order: index,
        };
      });
    }

    throw new Error("Formato non valido");
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    setNotice(null);

    try {
      const parsed = JSON.parse(await file.text());
      const imported = parseImportedExams(parsed, "server");
      const response = await fetch("/api/university/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace_all", exams: imported }),
      });
      const result = (await response.json()) as { exams?: Exam[]; error?: string };
      if (!response.ok || !result.exams) throw new Error(result.error || "Import non riuscito");
      setExams(result.exams);
      setDraft(emptyDraft);
      setNotice("Import completato.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import non riuscito");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveSettings() {
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/university/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsDraft),
      });
      const result = (await response.json()) as { settings?: Settings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error || "Impostazioni non salvate");
      setSettings(result.settings);
      setNotice("Impostazioni Education salvate.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impostazioni non salvate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-[var(--sb-glass-border)] sb-glass">
        <div className="px-4 pb-0 pt-4 md:px-6">
          <div className="sb-hero sb-module-university mb-4 p-4 md:p-5">
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.9fr] lg:items-end">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-4xl">Education</h1>
                <p className="mt-2 max-w-xl truncate text-sm text-[var(--sb-muted)]">{settings.degree_course}</p>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--sb-text)]">{stats.earnedCfu} / {stats.totalCfu} crediti</span>
                    <span className="text-sky-300">{Math.round(stats.completion)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-300 transition-all duration-700"
                      style={{ width: `${stats.completion}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-xl font-bold tabular-nums text-[var(--sb-text)]">{stats.missingCfu}</p>
                  <p className="text-[10px] uppercase text-[var(--sb-muted)]">Mancanti</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-xl font-bold tabular-nums text-sky-300">{formatNumber(stats.weightedAvg)}</p>
                  <p className="text-[10px] uppercase text-[var(--sb-muted)]">Media</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-xl font-bold tabular-nums text-teal-300">{stats.availablePlusDegree ? formatNumber(stats.availablePlusDegree, 1) : "-"}</p>
                  <p className="text-[10px] uppercase text-[var(--sb-muted)]">Proiez.</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="default" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" />} onClick={openNewExamModal} className="bg-sky-500 hover:bg-sky-400">
                Esame
              </Button>
              <IconButton aria-label="Importa dati" title="Importa dati" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="h-4 w-4" />
              </IconButton>
              <IconButton aria-label="Esporta dati" title="Esporta dati" onClick={exportData}>
                <Download className="h-4 w-4" />
              </IconButton>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(event) => importData(event.target.files?.[0])}
              />
            </div>
          </div>

        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20 md:p-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          {notice && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] px-3 py-2 text-sm text-[var(--sb-muted)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sb-accent)]" />
              <span>{notice}</span>
            </div>
          )}

          <section className="grid gap-3 md:grid-cols-4">
            <StatCard label="Crediti ottenuti" value={String(stats.earnedCfu)} hint={`su ${stats.totalCfu} crediti`} icon={BookMarked} accent />
            <StatCard label="Crediti mancanti" value={String(stats.missingCfu)} hint={`${Math.round(stats.completion)}% completato`} icon={Target} />
            <StatCard label="Media confermata" value={formatNumber(stats.weightedAvg)} hint={`${stats.gradedCfu} crediti ufficiali`} icon={Check} />
            <StatCard label="Proiezione finale" value={stats.availablePlusDegree ? `${formatNumber(stats.availablePlusDegree)}/110` : "-"} hint={`${stats.availableCfu} crediti con voti reali`} icon={Trophy} accent />
          </section>

          <section className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 shadow-[var(--sb-shadow-sm)]">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--sb-text)]">Impostazioni percorso</h2>
                <p className="text-xs text-[var(--sb-muted)]">Personalizza il modulo per scuola, universita, certificazioni o altri percorsi a crediti.</p>
              </div>
              <Button type="button" size="sm" variant="subtle" onClick={saveSettings} disabled={saving}>
                Salva impostazioni
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Nome percorso" value={settingsDraft.degree_course} onChange={(degree_course) => setSettingsDraft((draft) => ({ ...draft, degree_course }))} placeholder="Percorso di studio" />
              <TextField label="Nome studente" value={settingsDraft.student_name} onChange={(student_name) => setSettingsDraft((draft) => ({ ...draft, student_name }))} placeholder="Opzionale" />
              <TextField label="ID studente" value={settingsDraft.student_number} onChange={(student_number) => setSettingsDraft((draft) => ({ ...draft, student_number }))} placeholder="Opzionale" />
              <TextField label="Crediti totali" value={settingsDraft.total_cfu} onChange={(total_cfu) => setSettingsDraft((draft) => ({ ...draft, total_cfu }))} type="number" min={1} step={1} />
              <TextField label="Bonus finale" value={settingsDraft.bonus_points} onChange={(bonus_points) => setSettingsDraft((draft) => ({ ...draft, bonus_points }))} type="number" min={0} step={0.5} />
              <TextField label="Valore lode" value={settingsDraft.honors_value} onChange={(honors_value) => setSettingsDraft((draft) => ({ ...draft, honors_value }))} type="number" min={30} max={33} step={0.5} />
            </div>
          </section>

        <section className="sb-chart-card sb-module-university min-w-0">
          <div className="flex flex-col gap-3 border-b border-[var(--sb-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--sb-text)]">Roadmap esami</h2>
              <p className="text-xs text-[var(--sb-muted)]">{visibleExams.length} visibili su {exams.length}, organizzati per anno</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-1">
                {filters.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      "sb-focus cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      filter === item.id
                        ? "bg-[var(--sb-hover)] text-[var(--sb-text)]"
                        : "text-[var(--sb-muted)] hover:text-[var(--sb-text)]",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[var(--sb-muted)]">{stats.onlineCfu} CFU online</span>
            </div>
          </div>

          <div className="divide-y divide-[var(--sb-border)]">
            {examsByYear.map(([year, yearExams]) => {
              const collapsed = collapsedYears.has(year);
              const yearCfu = yearExams.reduce((sum, exam) => sum + Number(exam.cfu || 0), 0);
              const recognizedCfu = yearExams
                .filter((exam) => exam.status === "recognized")
                .reduce((sum, exam) => sum + Number(exam.cfu || 0), 0);
              const statusLabel = yearExams.every((exam) => exam.status === "recognized")
                ? "Concluso"
                : yearExams.every((exam) => exam.status === "planned" && !exam.exam_date && !exam.grade)
                  ? "Futuro"
                  : "In corso";

              return (
                <section key={year}>
                  <button
                    type="button"
                    onClick={() => toggleYear(year)}
                    className="sb-focus flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--sb-hover)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {collapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--sb-muted)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--sb-muted)]" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--sb-text)]">Anno {year}</h3>
                        <p className="text-xs text-[var(--sb-muted)]">
                          {yearExams.length} esami · {recognizedCfu}/{yearCfu} CFU completati
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      statusLabel === "Concluso" && "bg-emerald-500/10 text-emerald-500",
                      statusLabel === "In corso" && "bg-[var(--sb-accent-soft)] text-[var(--sb-accent)]",
                      statusLabel === "Futuro" && "bg-[var(--sb-card)] text-[var(--sb-muted)]",
                    )}>
                      {statusLabel}
                    </span>
                  </button>

                  {!collapsed && (
                    <div className="divide-y divide-[var(--sb-border)] px-2 pb-2">
                      {yearExams.map((exam) => {
                        const nextStatus = nextStatusFor(exam);

                        return (
                          <div
                            key={exam.id}
                            className="grid gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--sb-hover)] md:grid-cols-[2.5rem_minmax(0,1fr)_4rem_4rem_9rem_8rem] md:items-center"
                          >
                            <div>
                              {nextStatus && (
                                <IconButton
                                  aria-label={`Avanza a ${statusMeta[nextStatus].label}`}
                                  title={`Avanza a ${statusMeta[nextStatus].label}`}
                                  onClick={() => advanceExam(exam)}
                                  disabled={saving}
                                >
                                  <NextStatusIcon status={nextStatus} />
                                </IconButton>
                              )}
                            </div>

                            <div className="min-w-0">
                              <strong className="block truncate text-sm text-[var(--sb-text)]">{exam.name}</strong>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--sb-muted)]">
                                <span className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-card)] px-1.5 py-0.5">
                                  {exam.area || "Nessun ambito"}
                                </span>
                                <span className={cn("rounded-md border px-1.5 py-0.5", examTypeMeta[exam.exam_type].className)}>
                                  {examTypeMeta[exam.exam_type].label}
                                </span>
                                {!exam.counts_avg && (
                                  <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-500">
                                    Fuori media
                                  </span>
                                )}
                              </div>
                            </div>

                            <Metric label="CFU" value={String(exam.cfu)} />
                            <Metric label="Voto" value={exam.grade ? `${exam.grade}${exam.honors ? "L" : ""}` : "-"} />

                            <div className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)]">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>{formatDate(exam.exam_date)}</span>
                            </div>

                            <span className={cn("inline-flex min-h-7 w-fit items-center rounded-full px-2.5 text-xs font-semibold", statusMeta[exam.status].className)}>
                              {statusMeta[exam.status].label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {!visibleExams.length && (
            <div className="py-8 text-center text-sm text-[var(--sb-muted)]">
              <strong className="block text-[var(--sb-text)]">Nessun esame trovato</strong>
              <span>Aggiungi il primo esame o importa un file JSON.</span>
            </div>
          )}
        </section>
        </div>
      </div>

      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
          <div className="sb-mobile-modal w-full max-w-xl rounded-t-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-lg)] safe-bottom md:rounded-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--sb-border)] bg-[var(--sb-surface)] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--sb-text)]">{draft.id ? "Modifica esame" : "Nuovo esame"}</h2>
                <p className="text-xs text-[var(--sb-muted)]">Voto e data sono obbligatori quando lo stato non e Da sostenere.</p>
              </div>
              <IconButton aria-label="Chiudi modale" variant="ghost" onClick={closeExamModal}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <form className="grid gap-3 p-4" onSubmit={saveExam}>
              <TextField label="Nome esame" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Analisi matematica" required />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="CFU" value={draft.cfu} onChange={(cfu) => setDraft((d) => ({ ...d, cfu }))} type="number" min={1} step={1} required />
                <SelectField label="Anno" value={draft.year} onChange={(year) => setDraft((d) => ({ ...d, year }))} options={["1", "2", "3", "4", "5", "6"]} />
              </div>
              <TextField label="Ambito / SSD" value={draft.area} onChange={(area) => setDraft((d) => ({ ...d, area }))} placeholder="INF/01" />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Tipologia"
                  value={draft.exam_type}
                  onChange={(exam_type) => setDraft((d) => ({ ...d, exam_type: exam_type as ExamType }))}
                  options={["mandatory", "elective"]}
                  getLabel={(value) => examTypeMeta[value as ExamType].label}
                />
                <SelectField
                  label="Stato"
                  value={draft.status}
                  onChange={(status) => setDraft((d) => ({ ...d, status: status as ExamStatus }))}
                  options={["planned", "booked", "online", "recognized"]}
                  getLabel={(value) => statusMeta[value as ExamStatus].label}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Voto" value={draft.grade} onChange={(grade) => setDraft((d) => ({ ...d, grade }))} type="number" min={18} max={30} step={1} placeholder="28" required={gradeRequiredDraft} />
                <TextField label="Data" value={draft.exam_date} onChange={(exam_date) => setDraft((d) => ({ ...d, exam_date }))} type="date" required={dateRequiredDraft} />
              </div>
              <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3 text-sm text-[var(--sb-muted)]">
                <label className="flex items-center gap-2">
                  <input className="h-4 w-4 accent-[var(--sb-accent)]" type="checkbox" checked={draft.honors} onChange={(event) => setDraft((d) => ({ ...d, honors: event.target.checked }))} />
                  Lode
                </label>
              </div>
              {draftError && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                  {draftError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="subtle" className="flex-1" onClick={closeExamModal}>
                  Annulla
                </Button>
                <Button type="submit" variant="default" className="flex-1" leadingIcon={<Save className="h-4 w-4" />} disabled={saving || Boolean(draftError)}>
                  Salva
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {gradeTransition && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
          <div className="sb-mobile-modal w-full max-w-sm rounded-t-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-lg)] safe-bottom md:rounded-lg">
            <div className="flex items-center justify-between border-b border-[var(--sb-border)] px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[var(--sb-text)]">{gradeTransition.exam.name}</h2>
                <p className="text-xs text-[var(--sb-muted)]">
                  Passa a {statusMeta[gradeTransition.nextStatus].label}.
                </p>
                {gradeTransition.nextStatus === "booked" && (
                  <p className="mt-1 text-xs text-[var(--sb-muted)]">
                    Inserisci la data della prenotazione, che coincide con la data esame.
                  </p>
                )}
                {gradeTransition.exam.status === "online" && gradeTransition.nextStatus === "recognized" && (
                  <p className="mt-1 text-xs text-[var(--sb-muted)]">
                    Voto online originale precompilato: confermalo o aumentalo se serve.
                  </p>
                )}
              </div>
              <IconButton aria-label="Chiudi modale" variant="ghost" onClick={() => setGradeTransition(null)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <form className="grid gap-3 p-4" onSubmit={submitGradeTransition}>
              {gradeTransition.nextStatus === "booked" ? (
                <TextField
                  label="Data esame"
                  value={gradeTransition.examDate}
                  onChange={(examDate) => setGradeTransition((current) => (
                    current ? { ...current, examDate } : current
                  ))}
                  type="date"
                  required
                />
              ) : (
                <TextField
                  label="Voto"
                  value={gradeTransition.grade}
                  onChange={(grade) => setGradeTransition((current) => (
                    current ? { ...current, grade } : current
                  ))}
                  type="number"
                  min={18}
                  max={30}
                  step={1}
                  placeholder="28"
                  required
                />
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="subtle" className="flex-1" onClick={() => setGradeTransition(null)}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  className="flex-1"
                  leadingIcon={<Check className="h-4 w-4" />}
                  disabled={saving || (gradeTransition.nextStatus === "booked" ? !gradeTransition.examDate : !gradeTransition.grade)}
                >
                  Conferma
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function inputClass() {
  return "min-h-10 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface-solid)] px-3 text-sm text-[var(--sb-text)] outline-none transition focus:border-[var(--sb-accent)] focus:ring-2 focus:ring-[var(--sb-accent-soft)]";
}

function TextField({
  label, value, onChange, ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[var(--sb-muted)]">
      {label}
      <input className={inputClass()} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function SelectField({
  label, value, onChange, options, getLabel = (option) => option,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  getLabel?: (option: string) => string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[var(--sb-muted)]">
      {label}
      <select className={inputClass()} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{getLabel(option)}</option>
        ))}
      </select>
    </label>
  );
}

function StatCard({
  label, value, hint, icon: Icon, accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof LayoutDashboard;
  accent?: boolean;
}) {
  return (
    <article className={cn(
      "sb-depth-card sb-module-university p-4",
      accent
        ? "text-white"
        : "text-[var(--sb-text)]",
    )}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={cn("text-sm", accent ? "text-white/80" : "text-[var(--sb-muted)]")}>{label}</span>
        <span className="sb-module-icon h-8 w-8">
          <Icon className="h-4 w-4 opacity-90" />
        </span>
      </div>
      <strong className="block text-3xl font-semibold leading-none">{value}</strong>
      <small className={cn("mt-2 block text-xs", accent ? "text-white/75" : "text-[var(--sb-muted)]")}>{hint}</small>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] font-semibold uppercase text-[var(--sb-muted)] md:hidden">{label}</span>
      <span className="text-sm font-semibold text-[var(--sb-text)]">{value}</span>
    </div>
  );
}
