"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity, Plus, Trash2, Check, X, Camera,
  Heart, Timer, Flame, Footprints, Mountain, Zap,
  ChevronDown, ChevronUp, Pencil,
  Dumbbell, Brain, Target, TrendingUp, Calendar,
  Smile, Meh, Frown, AlertCircle, Loader2, Sparkles,
  BarChart3, Clock, Award, Scale, Gauge, Trophy, Medal,
  RefreshCw, Link2, Link2Off,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "@/components/charts/recharts-dynamic";
import { format, subDays, startOfWeek, addDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { fmtDuration, fmtPace, getBmiCategory, getWorkoutIntervals, todayStr } from "@/lib/fitness/format";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import {
  computeLoadSeries,
  summarizeLoad,
  FORM_LABELS,
  RISK_LABELS,
  formColor,
  riskColor,
  type LoadPoint,
  type LoadSummary,
  type WorkoutLike,
} from "@/lib/training-load";

/* ── Types ─────────────────────────────────────────────────── */

type Workout = Database["public"]["Tables"]["workouts"]["Row"];
type TrainingPlan = Database["public"]["Tables"]["training_plans"]["Row"];
type PlannedWorkout = Database["public"]["Tables"]["planned_workouts"]["Row"];
type BodyMetric = Database["public"]["Tables"]["body_metrics"]["Row"];
type CoachPreferences = Database["public"]["Tables"]["fitness_coach_preferences"]["Row"];

type TabType = "today" | "workouts" | "body" | "coach";

export interface FitnessTrackerProps {
  workouts: Workout[];
  trainingPlans: TrainingPlan[];
  plannedWorkouts: PlannedWorkout[];
  bodyMetrics: BodyMetric[];
  coachPreferences: CoachPreferences | null;
}

/* ── Constants ─────────────────────────────────────────────── */

const TABS: { key: TabType; label: string; icon: typeof Activity }[] = [
  { key: "today", label: "Oggi", icon: Calendar },
  { key: "workouts", label: "Allenamenti", icon: Dumbbell },
  { key: "body", label: "Corpo", icon: Scale },
  { key: "coach", label: "Coach AI", icon: Brain },
];

const WORKOUT_TYPES: Record<string, { label: string; emoji: string }> = {
  easy_run: { label: "Corsa facile", emoji: "\u{1F3C3}" },
  tempo_run: { label: "Tempo run", emoji: "\u{1F525}" },
  interval: { label: "Intervalli", emoji: "\u26A1" },
  long_run: { label: "Lungo", emoji: "\u{1F6E3}\uFE0F" },
  recovery: { label: "Recupero", emoji: "\u{1F9D8}" },
  race: { label: "Gara", emoji: "\u{1F3C6}" },
  walk: { label: "Camminata", emoji: "\u{1F6B6}" },
  cycling: { label: "Ciclismo", emoji: "\u{1F6B4}" },
  other: { label: "Altro", emoji: "\u{1F4AA}" },
};

const FEELING_ICONS = [
  { value: 1, icon: Frown, label: "Pessimo", color: "text-red-400" },
  { value: 2, icon: Frown, label: "Male", color: "text-orange-400" },
  { value: 3, icon: Meh, label: "Normale", color: "text-amber-400" },
  { value: 4, icon: Smile, label: "Bene", color: "text-emerald-400" },
  { value: 5, icon: Smile, label: "Ottimo", color: "text-green-400" },
];

/* ── Achievement definitions ─────────────────────────────── */

interface Achievement {
  id: string;
  icon: string;
  label: string;
  description: string;
  unlocked: boolean;
  progress?: string;
}

function computeAchievements(workouts: Workout[], metrics: BodyMetric[]): Achievement[] {
  const totalKm = workouts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
  const totalWorkouts = workouts.length;
  const runWorkouts = workouts.filter((w) => w.distance_km && Number(w.distance_km) > 0);

  // Consecutive weeks with at least 1 workout
  let weekStreak = 0;
  let checkWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  while (true) {
    const ws = format(checkWeek, "yyyy-MM-dd");
    const we = format(addDays(checkWeek, 7), "yyyy-MM-dd");
    const hasWorkout = workouts.some((w) => w.date >= ws && w.date < we);
    if (!hasWorkout) break;
    weekStreak++;
    checkWeek = subDays(checkWeek, 7);
  }

  // Longest single run
  const longestRun = runWorkouts.reduce((best, w) => Math.max(best, Number(w.distance_km) || 0), 0);

  // Has body metrics
  const hasMetrics = metrics.length > 0;

  return [
    {
      id: "first_run",
      icon: "\u{1F3C3}",
      label: "Prima corsa",
      description: "Registra il tuo primo allenamento",
      unlocked: totalWorkouts >= 1,
    },
    {
      id: "ten_workouts",
      icon: "\u{1F4AA}",
      label: "Costanza",
      description: "Completa 10 allenamenti",
      unlocked: totalWorkouts >= 10,
      progress: `${Math.min(totalWorkouts, 10)}/10`,
    },
    {
      id: "fifty_workouts",
      icon: "\u{1F525}",
      label: "Instancabile",
      description: "Completa 50 allenamenti",
      unlocked: totalWorkouts >= 50,
      progress: `${Math.min(totalWorkouts, 50)}/50`,
    },
    {
      id: "hundred_workouts",
      icon: "\u{1F451}",
      label: "Centurione",
      description: "Completa 100 allenamenti",
      unlocked: totalWorkouts >= 100,
      progress: `${Math.min(totalWorkouts, 100)}/100`,
    },
    {
      id: "total_10km",
      icon: "\u{1F3C5}",
      label: "10 km totali",
      description: "Corri 10 km in totale",
      unlocked: totalKm >= 10,
      progress: `${Math.min(totalKm, 10).toFixed(1)}/10 km`,
    },
    {
      id: "total_50km",
      icon: "\u{1F30D}",
      label: "50 km totali",
      description: "Corri 50 km in totale",
      unlocked: totalKm >= 50,
      progress: `${Math.min(totalKm, 50).toFixed(1)}/50 km`,
    },
    {
      id: "total_100km",
      icon: "\u{1F680}",
      label: "100 km totali",
      description: "Corri 100 km in totale",
      unlocked: totalKm >= 100,
      progress: `${Math.min(totalKm, 100).toFixed(1)}/100 km`,
    },
    {
      id: "total_500km",
      icon: "\u2B50",
      label: "500 km totali",
      description: "Corri 500 km in totale",
      unlocked: totalKm >= 500,
      progress: `${Math.min(totalKm, 500).toFixed(1)}/500 km`,
    },
    {
      id: "five_k",
      icon: "\u{1F3AF}",
      label: "5K",
      description: "Completa una corsa di almeno 5 km",
      unlocked: longestRun >= 5,
    },
    {
      id: "ten_k",
      icon: "\u{1F396}\uFE0F",
      label: "10K",
      description: "Completa una corsa di almeno 10 km",
      unlocked: longestRun >= 10,
    },
    {
      id: "half_marathon",
      icon: "\u{1F3C6}",
      label: "Mezza maratona",
      description: "Completa una corsa di almeno 21.1 km",
      unlocked: longestRun >= 21.1,
    },
    {
      id: "marathon",
      icon: "\u{1F947}",
      label: "Maratoneta",
      description: "Completa una maratona (42.195 km)",
      unlocked: longestRun >= 42.195,
    },
    {
      id: "three_weeks",
      icon: "\u{1F4C5}",
      label: "3 settimane",
      description: "Allenati per 3 settimane consecutive",
      unlocked: weekStreak >= 3,
      progress: `${Math.min(weekStreak, 3)}/3`,
    },
    {
      id: "eight_weeks",
      icon: "\u{1F4C6}",
      label: "2 mesi",
      description: "Allenati per 8 settimane consecutive",
      unlocked: weekStreak >= 8,
      progress: `${Math.min(weekStreak, 8)}/8`,
    },
    {
      id: "body_tracker",
      icon: "\u{1FA7A}",
      label: "Body tracker",
      description: "Registra la tua prima misurazione corporea",
      unlocked: hasMetrics,
    },
    {
      id: "screenshot_master",
      icon: "\u{1F4F7}",
      label: "Screenshot master",
      description: "Carica un allenamento da screenshot",
      unlocked: workouts.some((w) => w.source === "screenshot"),
    },
  ];
}

/* ── Component ─────────────────────────────────────────────── */

export default function FitnessTracker({ workouts: initWorkouts, trainingPlans: initPlans, plannedWorkouts: initPlanned, bodyMetrics: initMetrics, coachPreferences: initCoachPreferences }: FitnessTrackerProps) {
  const searchParams = useSearchParams();
  const today = todayStr();

  // Strava state
  interface StravaStatus {
    connected: boolean;
    athlete_name?: string;
    last_sync_at?: string | null;
    last_sync_count?: number | null;
    last_sync_error?: string | null;
  }
  const [stravaStatus, setStravaStatus] = useState<StravaStatus>({ connected: false });
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const autoSyncedRef = useRef(false);

  // State
  const [tab, setTab] = useState<TabType>("today");
  const needsBodyData = tab === "body";
  const needsCoachData = tab === "coach";
  const needsTrainingLoad = tab === "today";
  const [workouts, setWorkouts] = useState(initWorkouts);
  const [plans, setPlans] = useState(initPlans);
  const [planned, setPlanned] = useState(initPlanned);
  const [metrics, setMetrics] = useState(initMetrics);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initPlans[0]?.id ?? null);
  const [linkingPlannedId, setLinkingPlannedId] = useState<string | null>(null);

  // Body metrics form
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [mDate, setMDate] = useState(today);
  const [mWeight, setMWeight] = useState("");
  const [mFat, setMFat] = useState("");
  const [mWaist, setMWaist] = useState("");
  const [mRestHR, setMRestHR] = useState("");
  const [mHeight, setMHeight] = useState("");
  const [mNotes, setMNotes] = useState("");

  // Workout form
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  // Workout form fields
  const [wDate, setWDate] = useState(today);
  const [wType, setWType] = useState("easy_run");
  const [wDistance, setWDistance] = useState("");
  const [wDuration, setWDuration] = useState("");
  const [wAvgPace, setWAvgPace] = useState("");
  const [wBestPace, setWBestPace] = useState("");
  const [wCalories, setWCalories] = useState("");
  const [wAvgHR, setWAvgHR] = useState("");
  const [wMaxHR, setWMaxHR] = useState("");
  const [wCadence, setWCadence] = useState("");
  const [wElevation, setWElevation] = useState("");
  const [wSteps, setWSteps] = useState("");
  const [wFeeling, setWFeeling] = useState<number>(3);
  const [wNotes, setWNotes] = useState("");

  // Campi estesi popolati dallo screenshot (non editabili dall'utente in inserimento manuale)
  type IntervalRow = { type: string; time: string; distance: string; pace: string };
  type HrZonesState = {
    leggera: number | null;
    intensiva: number | null;
    aerobica: number | null;
    anaerobica: number | null;
    vo2max: number | null;
  };
  const [wIntervals, setWIntervals] = useState<IntervalRow[] | null>(null);
  const [wTrainingEffectAerobic, setWTrainingEffectAerobic] = useState<number | null>(null);
  const [wTrainingEffectAnaerobic, setWTrainingEffectAnaerobic] = useState<number | null>(null);
  const [wMaxCadence, setWMaxCadence] = useState("");
  const [wAvgStrideCm, setWAvgStrideCm] = useState("");
  const [wMaxStrideCm, setWMaxStrideCm] = useState("");
  const [wVo2Max, setWVo2Max] = useState("");
  const [wRecoveryHours, setWRecoveryHours] = useState("");
  const [wHrZones, setWHrZones] = useState<HrZonesState | null>(null);

  // Screenshot upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref al form — ci scrolliamo sopra quando apriamo "Modifica" su un workout
  // in fondo alla pagina, altrimenti il form si apre off-screen.
  const workoutFormRef = useRef<HTMLDivElement>(null);

  // Coach AI
  const [coachGoal, setCoachGoal] = useState(initCoachPreferences?.goal ?? initPlans[0]?.goal ?? "");
  const [coachNotes, setCoachNotes] = useState(initCoachPreferences?.notes ?? initPlans[0]?.notes ?? "");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [coachPrefsSaving, setCoachPrefsSaving] = useState(false);
  const [coachPrefsSavedAt, setCoachPrefsSavedAt] = useState<string | null>(initCoachPreferences?.updated_at ?? null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Modifica allenamento esistente: se !== null, saveWorkout fa UPDATE invece di INSERT
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  // Se l'allenamento che stiamo modificando aveva gia' un parere del Coach,
  // dopo il salvataggio rigeneriamo il parere con i dati aggiornati.
  const [editingHadFeedback, setEditingHadFeedback] = useState(false);

  // Coach AI — parere sull'allenamento appena salvato / riaperto
  const [reviewModal, setReviewModal] = useState<{
    workoutId: string;
    title: string;
    feedback: string;
    generatedAt: string | null;
    loading: boolean;
    error: string;
  } | null>(null);

  /* ── Derived data ───────────────────────────────────────── */

  // Workout stats
  const workoutStats = useMemo(() => {
    const total = workouts.length;
    const totalDistance = workouts.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
    const totalDuration = workouts.reduce((s, w) => s + (Number(w.duration_minutes) || 0), 0);
    const avgHR = workouts.filter((w) => w.avg_heart_rate).length > 0
      ? Math.round(
          workouts.reduce((s, w) => s + (Number(w.avg_heart_rate) || 0), 0) /
          workouts.filter((w) => w.avg_heart_rate).length,
        )
      : null;

    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const thisWeek = workouts.filter((w) => w.date >= weekStart);
    const weekDistance = thisWeek.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
    const weekCount = thisWeek.length;

    return { total, totalDistance, totalDuration, avgHR, weekDistance, weekCount };
  }, [workouts]);

  // Weekly distance chart data (last 8 weeks)
  const weeklyChart = useMemo(() => {
    const weeks: Record<string, number> = {};
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      weeks[key] = 0;
    }
    for (const w of workouts) {
      const ws = startOfWeek(parseISO(w.date), { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      if (key in weeks) {
        weeks[key] += Number(w.distance_km) || 0;
      }
    }
    return Object.entries(weeks).map(([k, v]) => ({
      week: format(parseISO(k), "dd/MM", { locale: it }),
      km: Number(v.toFixed(1)),
    }));
  }, [workouts]);

  // Pace trend (last 20 workouts with pace)
  const paceChart = useMemo(() => {
    return workouts
      .filter((w) => w.avg_pace)
      .slice(0, 20)
      .reverse()
      .map((w) => {
        const match = w.avg_pace?.match(/(\d+)['"]\s*(\d+)/);
        const seconds = match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
        return {
          date: format(parseISO(w.date), "dd/MM", { locale: it }),
          pace: seconds > 0 ? seconds : null,
          label: w.avg_pace,
        };
      })
      .filter((d) => d.pace !== null);
  }, [workouts]);

  // Personal records
  const personalRecords = useMemo(() => {
    const paceToSec = (p: string | null) => {
      if (!p) return Infinity;
      const m = p.match(/(\d+)['"]\s*(\d+)/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : Infinity;
    };

    const runWorkouts = workouts.filter((w) => w.distance_km && Number(w.distance_km) > 0);
    if (runWorkouts.length === 0) return null;

    const bestPace = runWorkouts.reduce((best, w) => {
      const s = paceToSec(w.avg_pace);
      return s < paceToSec(best?.avg_pace ?? null) ? w : best;
    }, runWorkouts[0]);

    const longestDistance = runWorkouts.reduce((best, w) =>
      Number(w.distance_km) > Number(best.distance_km) ? w : best, runWorkouts[0]);

    const longestDuration = workouts.filter((w) => w.duration_minutes).reduce((best, w) =>
      Number(w.duration_minutes) > Number(best.duration_minutes) ? w : best, workouts[0]);

    return {
      bestPace: bestPace?.avg_pace ? { value: bestPace.avg_pace, date: bestPace.date } : null,
      longestDistance: { value: Number(longestDistance.distance_km).toFixed(2), date: longestDistance.date },
      longestDuration: longestDuration?.duration_minutes ? { value: fmtDuration(Number(longestDuration.duration_minutes)), date: longestDuration.date } : null,
      totalWorkouts: workouts.length,
    };
  }, [workouts]);

  // HR zones (based on max HR from history)
  const hrZones = useMemo(() => {
    const maxHRs = workouts.map((w) => Number(w.max_heart_rate)).filter((v) => v > 0);
    if (maxHRs.length === 0) return null;
    const maxHR = Math.max(...maxHRs);
    return {
      maxHR,
      zones: [
        { name: "Z1 \u2014 Recupero", min: Math.round(maxHR * 0.50), max: Math.round(maxHR * 0.60), color: "bg-blue-400" },
        { name: "Z2 \u2014 Aerobica", min: Math.round(maxHR * 0.60), max: Math.round(maxHR * 0.70), color: "bg-emerald-400" },
        { name: "Z3 \u2014 Tempo", min: Math.round(maxHR * 0.70), max: Math.round(maxHR * 0.80), color: "bg-amber-400" },
        { name: "Z4 \u2014 Soglia", min: Math.round(maxHR * 0.80), max: Math.round(maxHR * 0.90), color: "bg-orange-400" },
        { name: "Z5 \u2014 Max", min: Math.round(maxHR * 0.90), max: maxHR, color: "bg-red-400" },
      ],
    };
  }, [workouts]);

  // Workout zone distribution
  const zoneDistribution = useMemo(() => {
    if (!hrZones) return [];
    const counts = [0, 0, 0, 0, 0];
    for (const w of workouts) {
      const hr = Number(w.avg_heart_rate);
      if (!hr) continue;
      const pct = hr / hrZones.maxHR;
      if (pct < 0.60) counts[0]++;
      else if (pct < 0.70) counts[1]++;
      else if (pct < 0.80) counts[2]++;
      else if (pct < 0.90) counts[3]++;
      else counts[4]++;
    }
    return counts;
  }, [workouts, hrZones]);

  // Race predictor (Riegel formula)
  const racePredictions = useMemo(() => {
    const runWorkouts = workouts.filter((w) => w.distance_km && w.duration_minutes && Number(w.distance_km) >= 1);
    if (runWorkouts.length === 0) return null;

    let bestTimePer = Infinity;
    let bestD = 0;
    let bestT = 0;
    for (const w of runWorkouts) {
      const d = Number(w.distance_km);
      const t = Number(w.duration_minutes);
      const per = t / d;
      if (per < bestTimePer) {
        bestTimePer = per;
        bestD = d;
        bestT = t;
      }
    }
    if (bestD === 0) return null;

    const predict = (targetKm: number) => {
      const mins = bestT * Math.pow(targetKm / bestD, 1.06);
      const h = Math.floor(mins / 60);
      const m = Math.floor(mins % 60);
      const s = Math.round((mins % 1) * 60);
      return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
    };

    return {
      fiveK: predict(5),
      tenK: predict(10),
      halfMarathon: predict(21.1),
      marathon: predict(42.195),
    };
  }, [workouts]);

  // Weekly recap
  const weeklyRecap = useMemo(() => {
    const now = new Date();
    const thisWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const lastWeekStart = format(startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), "yyyy-MM-dd");

    const thisWeek = workouts.filter((w) => w.date >= thisWeekStart);
    const lastWeek = workouts.filter((w) => w.date >= lastWeekStart && w.date < thisWeekStart);

    const thisKm = thisWeek.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
    const lastKm = lastWeek.reduce((s, w) => s + (Number(w.distance_km) || 0), 0);
    const thisTime = thisWeek.reduce((s, w) => s + (Number(w.duration_minutes) || 0), 0);

    let streak = 0;
    let checkWeek = startOfWeek(now, { weekStartsOn: 1 });
    while (true) {
      const ws = format(checkWeek, "yyyy-MM-dd");
      const we = format(addDays(checkWeek, 7), "yyyy-MM-dd");
      const hasWorkout = workouts.some((w) => w.date >= ws && w.date < we);
      if (!hasWorkout) break;
      streak++;
      checkWeek = subDays(checkWeek, 7);
    }

    return {
      thisWeek: { count: thisWeek.length, km: thisKm, time: thisTime },
      lastWeek: { count: lastWeek.length, km: lastKm },
      kmDiff: lastKm > 0 ? ((thisKm - lastKm) / lastKm) * 100 : 0,
      weekStreak: streak,
    };
  }, [workouts]);

  // Body metrics charts
  const weightChart = useMemo(() => {
    if (!needsBodyData) return [];
    return metrics
      .filter((m) => m.weight_kg != null)
      .map((m) => ({
        date: format(parseISO(m.date), "dd/MM", { locale: it }),
        kg: Number(m.weight_kg),
      }));
  }, [metrics, needsBodyData]);

  const waistChart = useMemo(() => {
    if (!needsBodyData) return [];
    return metrics
      .filter((m) => m.waist_cm != null)
      .map((m) => ({
        date: format(parseISO(m.date), "dd/MM", { locale: it }),
        cm: Number(m.waist_cm),
      }));
  }, [metrics, needsBodyData]);

  // BMI calculation
  const bmiData = useMemo(() => {
    if (!needsBodyData) return null;
    // Find latest weight and latest height
    const latestWithWeight = [...metrics].reverse().find((m) => m.weight_kg != null);
    const latestWithHeight = [...metrics].reverse().find((m) => m.height_cm != null);
    if (!latestWithWeight?.weight_kg || !latestWithHeight?.height_cm) return null;

    const weight = Number(latestWithWeight.weight_kg);
    const heightM = Number(latestWithHeight.height_cm) / 100;
    if (heightM <= 0) return null;

    const bmi = weight / (heightM * heightM);
    const category = getBmiCategory(bmi);

    // Lean mass & fat mass (if body fat % available)
    const latestFat = [...metrics].reverse().find((m) => m.body_fat_pct != null);
    let leanMass: number | null = null;
    let fatMass: number | null = null;
    if (latestFat?.body_fat_pct) {
      const fatPct = Number(latestFat.body_fat_pct) / 100;
      fatMass = weight * fatPct;
      leanMass = weight * (1 - fatPct);
    }

    return { bmi, category, weight, heightCm: Number(latestWithHeight.height_cm), leanMass, fatMass };
  }, [metrics, needsBodyData]);

  // Achievements
  const achievements = useMemo(() => computeAchievements(workouts, metrics), [workouts, metrics]);
  const unlockedCount = useMemo(() => achievements.filter((a) => a.unlocked).length, [achievements]);

  // BMI chart over time
  const bmiChart = useMemo(() => {
    if (!needsBodyData) return [];
    // Get the latest height
    const latestHeight = [...metrics].reverse().find((m) => m.height_cm != null);
    if (!latestHeight?.height_cm) return [];
    const heightM = Number(latestHeight.height_cm) / 100;
    if (heightM <= 0) return [];

    return metrics
      .filter((m) => m.weight_kg != null)
      .map((m) => ({
        date: format(parseISO(m.date), "dd/MM", { locale: it }),
        bmi: Number((Number(m.weight_kg) / (heightM * heightM)).toFixed(1)),
      }));
  }, [metrics, needsBodyData]);

  /* ── Training load ──────────────────────────────────────── */

  // Calcola TRIMP/CTL/ATL/TSB/ACWR sugli ultimi 90 giorni (ampio margine per
  // stabilizzare CTL a 42gg). La serie copre anche i rest day: CTL/ATL decadono
  // correttamente.
  const trainingLoad = useMemo<{ series: LoadPoint[]; summary: LoadSummary }>(() => {
    if (!needsTrainingLoad) {
      return {
        series: [],
        summary: { ctl: 0, atl: 0, tsb: 0, acwr: null, form: "neutral", risk: "unknown", workouts_in_series: 0, warmup: true },
      };
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const series = computeLoadSeries(workouts as unknown as WorkoutLike[], from, to);
    return { series, summary: summarizeLoad(series) };
  }, [needsTrainingLoad, workouts]);

  // Per il grafico teniamo gli ultimi 42 giorni (la finestra piu' parlante:
  // mostra la fase recente senza rumore dei 90gg pieni).
  const loadChart = useMemo(() => {
    const tail = trainingLoad.series.slice(-42);
    return tail.map((p) => ({
      date: format(parseISO(p.date), "dd/MM", { locale: it }),
      CTL: p.ctl,
      ATL: p.atl,
      TSB: p.tsb,
    }));
  }, [trainingLoad.series]);

  /* ── Body metrics actions ───────────────────────────────── */

  const fitnessRecord = useCallback(async <T,>(body: Record<string, unknown>) => {
    const response = await fetch("/api/fitness/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { row?: T; plan?: TrainingPlan; plannedWorkouts?: PlannedWorkout[]; saved_at?: string; error?: string };
    if (!response.ok) throw new Error(result.error || "Operazione fitness non riuscita");
    return result;
  }, []);

  const resetMetricForm = useCallback(() => {
    setMDate(today);
    setMWeight("");
    setMFat("");
    setMWaist("");
    setMRestHR("");
    setMHeight("");
    setMNotes("");
  }, [today]);

  const saveMetric = useCallback(async () => {
    setSaving(true);
    const metric = {
      date: mDate,
      weight_kg: mWeight ? parseFloat(mWeight) : null,
      body_fat_pct: mFat ? parseFloat(mFat) : null,
      waist_cm: mWaist ? parseFloat(mWaist) : null,
      resting_hr: mRestHR ? parseInt(mRestHR) : null,
      height_cm: mHeight ? parseFloat(mHeight) : null,
      notes: mNotes || null,
    };

    try {
      const { row } = await fitnessRecord<BodyMetric>({ action: "upsert_metric", data: metric });
      if (row) {
      const m = row;
      setMetrics((prev) => {
        const filtered = prev.filter((x) => x.date !== m.date);
        return [...filtered, m].sort((a, b) => a.date.localeCompare(b.date));
      });
      }

    resetMetricForm();
    setShowMetricForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Non sono riuscito a salvare la metrica");
    }
    setSaving(false);
  }, [mDate, mWeight, mFat, mWaist, mRestHR, mHeight, mNotes, fitnessRecord, resetMetricForm]);

  const deleteMetric = useCallback(async (id: string) => {
    await fitnessRecord({ action: "delete_metric", id });
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  }, [fitnessRecord]);

  /* ── Workout actions ────────────────────────────────────── */

  const resetWorkoutForm = useCallback(() => {
    setWDate(today);
    setWType("easy_run");
    setWDistance("");
    setWDuration("");
    setWAvgPace("");
    setWBestPace("");
    setWCalories("");
    setWAvgHR("");
    setWMaxHR("");
    setWCadence("");
    setWElevation("");
    setWSteps("");
    setWFeeling(3);
    setWNotes("");
    setWIntervals(null);
    setWTrainingEffectAerobic(null);
    setWTrainingEffectAnaerobic(null);
    setWMaxCadence("");
    setWAvgStrideCm("");
    setWMaxStrideCm("");
    setWVo2Max("");
    setWRecoveryHours("");
    setWHrZones(null);
    setPreviewImage(null);
    setUploadError("");
    setEditingWorkoutId(null);
    setEditingHadFeedback(false);
  }, [today]);

  /**
   * Apre il form in modalita' "modifica" precompilando tutti i campi dal workout esistente.
   * Il salvataggio successivo fara' UPDATE invece di INSERT, e se esisteva un parere del Coach
   * verra' rigenerato con i dati aggiornati.
   */
  const openEditWorkout = useCallback((w: Workout) => {
    setEditingWorkoutId(w.id);
    setEditingHadFeedback(Boolean(w.ai_feedback));
    setWDate(w.date);
    setWType(w.type);
    setWDistance(w.distance_km != null ? String(w.distance_km) : "");
    setWDuration(w.duration_minutes != null ? String(w.duration_minutes) : "");
    setWAvgPace(w.avg_pace ?? "");
    setWBestPace(w.best_pace ?? "");
    setWCalories(w.calories != null ? String(w.calories) : "");
    setWAvgHR(w.avg_heart_rate != null ? String(w.avg_heart_rate) : "");
    setWMaxHR(w.max_heart_rate != null ? String(w.max_heart_rate) : "");
    setWCadence(w.avg_cadence != null ? String(w.avg_cadence) : "");
    setWElevation(w.elevation_m != null ? String(w.elevation_m) : "");
    setWSteps(w.steps != null ? String(w.steps) : "");
    setWFeeling(w.feeling ?? 3);
    setWNotes(w.notes ?? "");

    // Campi estesi
    const ivs = w.intervals as unknown;
    setWIntervals(Array.isArray(ivs) && ivs.length > 0 ? (ivs as IntervalRow[]) : null);
    setWTrainingEffectAerobic(w.training_effect_aerobic != null ? Number(w.training_effect_aerobic) : null);
    setWTrainingEffectAnaerobic(w.training_effect_anaerobic != null ? Number(w.training_effect_anaerobic) : null);
    setWMaxCadence(w.max_cadence != null ? String(w.max_cadence) : "");
    setWAvgStrideCm(w.avg_stride_cm != null ? String(w.avg_stride_cm) : "");
    setWMaxStrideCm(w.max_stride_cm != null ? String(w.max_stride_cm) : "");
    setWVo2Max(w.vo2_max != null ? String(w.vo2_max) : "");
    setWRecoveryHours(w.recovery_hours != null ? String(w.recovery_hours) : "");
    const zones = w.hr_zones as unknown;
    if (zones && typeof zones === "object" && !Array.isArray(zones)) {
      const z = zones as Record<string, unknown>;
      const parsed: HrZonesState = {
        leggera: typeof z.leggera === "number" ? z.leggera : null,
        intensiva: typeof z.intensiva === "number" ? z.intensiva : null,
        aerobica: typeof z.aerobica === "number" ? z.aerobica : null,
        anaerobica: typeof z.anaerobica === "number" ? z.anaerobica : null,
        vo2max: typeof z.vo2max === "number" ? z.vo2max : null,
      };
      setWHrZones(Object.values(parsed).some((v) => v != null) ? parsed : null);
    } else {
      setWHrZones(null);
    }

    setPreviewImage(null);
    setUploadError("");
    setShowWorkoutForm(true);
    // Scroll al form: l'utente clicca "Modifica" da una card in fondo allo storico,
    // il form e' in cima quindi fuori dal viewport. requestAnimationFrame garantisce
    // che il DOM sia aggiornato prima dello scroll.
    requestAnimationFrame(() => {
      workoutFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  /**
   * Richiede il parere del Coach AI su un allenamento con contesto completo.
   * Non blocca il salvataggio: apre subito la modale in stato loading.
   * Se `force` e' true, rigenera il feedback ignorando quello persistito.
   */
  const requestReview = useCallback(
    async (workoutId: string, title: string, force = false) => {
      setReviewModal({
        workoutId,
        title,
        feedback: "",
        generatedAt: null,
        loading: true,
        error: "",
      });

      try {
        const res = await fetch("/api/fitness/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workoutId, force }),
        });
        const j = await res.json();

        if (!res.ok || !j.success) {
          if (j?.isCreditError) {
            toast.error("Crediti terminati: valuta i costi attuali e decidi quale utilizzare", {
              duration: 8000,
              description: "Puoi cambiare provider in config/ai.ts",
            });
          }
          setReviewModal((m) =>
            m && m.workoutId === workoutId
              ? { ...m, loading: false, error: j?.error || "Errore durante la generazione del parere" }
              : m,
          );
          return;
        }

        // Aggiorna il workout in memoria cosi' il badge "parere" compare subito
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === workoutId
              ? ({ ...w, ai_feedback: j.feedback, ai_feedback_generated_at: j.generated_at } as Workout)
              : w,
          ),
        );

        setReviewModal((m) =>
          m && m.workoutId === workoutId
            ? { ...m, loading: false, feedback: j.feedback, generatedAt: j.generated_at }
            : m,
        );
      } catch {
        setReviewModal((m) =>
          m && m.workoutId === workoutId
            ? { ...m, loading: false, error: "Errore di rete durante la richiesta del parere" }
            : m,
        );
      }
    },
    [],
  );

  const saveWorkout = useCallback(async () => {
    setSaving(true);

    const workout = {
      date: wDate,
      type: wType,
      distance_km: wDistance ? parseFloat(wDistance) : null,
      duration_minutes: wDuration ? parseFloat(wDuration) : null,
      avg_pace: wAvgPace || null,
      best_pace: wBestPace || null,
      calories: wCalories ? parseInt(wCalories) : null,
      avg_heart_rate: wAvgHR ? parseInt(wAvgHR) : null,
      max_heart_rate: wMaxHR ? parseInt(wMaxHR) : null,
      avg_cadence: wCadence ? parseInt(wCadence) : null,
      elevation_m: wElevation ? parseInt(wElevation) : null,
      steps: wSteps ? parseInt(wSteps) : null,
      feeling: wFeeling,
      notes: wNotes || null,
      intervals: wIntervals && wIntervals.length > 0 ? wIntervals : null,
      training_effect_aerobic: wTrainingEffectAerobic,
      training_effect_anaerobic: wTrainingEffectAnaerobic,
      max_cadence: wMaxCadence ? parseInt(wMaxCadence) : null,
      avg_stride_cm: wAvgStrideCm ? parseInt(wAvgStrideCm) : null,
      max_stride_cm: wMaxStrideCm ? parseInt(wMaxStrideCm) : null,
      vo2_max: wVo2Max ? parseFloat(wVo2Max) : null,
      recovery_hours: wRecoveryHours ? parseInt(wRecoveryHours) : null,
      hr_zones: wHrZones,
      source: previewImage ? "screenshot" : "manual",
    };

    let savedId: string | null = null;
    let savedTitle = "";
    let shouldRegenerateFeedback = false;

    if (editingWorkoutId) {
      // UPDATE — quando stiamo modificando un allenamento esistente.
      // Invalidiamo il feedback precedente per forzare una rigenerazione coerente coi nuovi dati.
      const updatePayload = {
        date: workout.date,
        type: workout.type,
        distance_km: workout.distance_km,
        duration_minutes: workout.duration_minutes,
        avg_pace: workout.avg_pace,
        best_pace: workout.best_pace,
        calories: workout.calories,
        avg_heart_rate: workout.avg_heart_rate,
        max_heart_rate: workout.max_heart_rate,
        avg_cadence: workout.avg_cadence,
        elevation_m: workout.elevation_m,
        steps: workout.steps,
        feeling: workout.feeling,
        notes: workout.notes,
        intervals: workout.intervals,
        training_effect_aerobic: workout.training_effect_aerobic,
        training_effect_anaerobic: workout.training_effect_anaerobic,
        max_cadence: workout.max_cadence,
        avg_stride_cm: workout.avg_stride_cm,
        max_stride_cm: workout.max_stride_cm,
        vo2_max: workout.vo2_max,
        recovery_hours: workout.recovery_hours,
        hr_zones: workout.hr_zones,
        ...(editingHadFeedback ? { ai_feedback: null, ai_feedback_generated_at: null } : {}),
      };
      const { row } = await fitnessRecord<Workout>({ action: "update_workout", id: editingWorkoutId, data: updatePayload });
      if (row) {
        const saved = row;
        setWorkouts((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
        savedId = saved.id;
        const wt = WORKOUT_TYPES[saved.type] || WORKOUT_TYPES.other;
        savedTitle = `${wt.label} · ${format(parseISO(saved.date), "d MMMM yyyy", { locale: it })}`;
        shouldRegenerateFeedback = editingHadFeedback;
      }
    } else {
      // INSERT — nuovo allenamento. Richiede sempre il parere del Coach.
      const { row } = await fitnessRecord<Workout>({ action: "insert_workout", data: workout });
      if (row) {
        const saved = row;
        setWorkouts((prev) => [saved, ...prev]);
        savedId = saved.id;
        const wt = WORKOUT_TYPES[saved.type] || WORKOUT_TYPES.other;
        savedTitle = `${wt.label} · ${format(parseISO(saved.date), "d MMMM yyyy", { locale: it })}`;
        shouldRegenerateFeedback = true;
      }
    }

    resetWorkoutForm();
    setShowWorkoutForm(false);
    setSaving(false);

    // Kick off AI review con contesto completo — non blocca il salvataggio.
    // In modifica lo facciamo SOLO se c'era gia' un parere (altrimenti rispettiamo
    // la scelta dell'utente di non averlo chiesto).
    if (savedId && shouldRegenerateFeedback) {
      // force=true in modifica per scavalcare eventuale cache-hit (gia' nulled sopra ma difensivo)
      void requestReview(savedId, savedTitle, !!editingWorkoutId);
    }
  }, [wDate, wType, wDistance, wDuration, wAvgPace, wBestPace, wCalories, wAvgHR, wMaxHR, wCadence, wElevation, wSteps, wFeeling, wNotes, wIntervals, wTrainingEffectAerobic, wTrainingEffectAnaerobic, wMaxCadence, wAvgStrideCm, wMaxStrideCm, wVo2Max, wRecoveryHours, wHrZones, previewImage, fitnessRecord, resetWorkoutForm, requestReview, editingWorkoutId, editingHadFeedback]);

  const deleteWorkout = useCallback(async (id: string) => {
    await fitnessRecord({ action: "delete_workout", id });
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }, [fitnessRecord]);

  /* ── Screenshot upload ──────────────────────────────────── */

  const handleApiError = useCallback((result: { error?: string; isCreditError?: boolean }) => {
    if (result.isCreditError) {
      toast.error("Crediti terminati: valuta i costi attuali e decidi quale utilizzare", {
        duration: 8000,
        description: "Puoi cambiare provider in config/ai.ts",
      });
      return true;
    }
    return false;
  }, []);

  const handleScreenshot = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError("");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Screenshot di app fitness contengono tabelle con testo piccolo (tempi,
          // distanze). La compressione JPEG introduce artefatti che confondono
          // l'OCR della Vision AI (cifre scambiate, digit persi). Usiamo PNG
          // lossless e limitiamo solo dimensioni estreme per rispettare il cap di 5MB.
          const MAX = 2400;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const scale = Math.min(MAX / width, MAX / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          // Hint per il renderer: preservare la nitidezza del testo.
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Prova PNG (lossless). Se risulta oltre il budget del server, fallback
          // a JPEG 0.95 che resta comunque molto piu' fedele di 0.85.
          const png = canvas.toDataURL("image/png");
          const MAX_BASE64 = 7_000_000; // coerente col limite server
          if (png.length <= MAX_BASE64) {
            resolve(png);
            return;
          }
          const jpeg = canvas.toDataURL("image/jpeg", 0.95);
          resolve(jpeg);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      setPreviewImage(base64);

      const res = await fetch("/api/fitness/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        if (handleApiError(result)) return;
        setUploadError(result.error || "Errore nell'analisi dello screenshot");
        return;
      }

      const d = result.data;
      if (d.date) setWDate(d.date);
      if (d.type) setWType(d.type);
      if (d.distance_km != null) setWDistance(String(d.distance_km));
      if (d.duration_minutes != null) setWDuration(String(d.duration_minutes));
      if (d.avg_pace) setWAvgPace(d.avg_pace);
      if (d.best_pace) setWBestPace(d.best_pace);
      if (d.calories != null) setWCalories(String(d.calories));
      if (d.avg_heart_rate != null) setWAvgHR(String(d.avg_heart_rate));
      if (d.max_heart_rate != null) setWMaxHR(String(d.max_heart_rate));
      if (d.avg_cadence != null) setWCadence(String(d.avg_cadence));
      if (d.elevation_m != null) setWElevation(String(d.elevation_m));
      if (d.steps != null) setWSteps(String(d.steps));
      if (d.max_cadence != null) setWMaxCadence(String(d.max_cadence));
      if (d.avg_stride_cm != null) setWAvgStrideCm(String(d.avg_stride_cm));
      if (d.max_stride_cm != null) setWMaxStrideCm(String(d.max_stride_cm));
      if (d.vo2_max != null) setWVo2Max(String(d.vo2_max));
      if (d.recovery_hours != null) setWRecoveryHours(String(d.recovery_hours));
      if (d.training_effect_aerobic != null) setWTrainingEffectAerobic(Number(d.training_effect_aerobic));
      if (d.training_effect_anaerobic != null) setWTrainingEffectAnaerobic(Number(d.training_effect_anaerobic));
      if (d.hr_zones) setWHrZones(d.hr_zones as HrZonesState);
      if (Array.isArray(d.intervals) && d.intervals.length > 0) setWIntervals(d.intervals as IntervalRow[]);

      setShowWorkoutForm(true);
    } catch {
      setUploadError("Errore durante il caricamento");
    } finally {
      setUploading(false);
    }
  }, [handleApiError]);

  /* ── Strava ─────────────────────────────────────────────── */

  const fetchStravaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/fitness/strava/status", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setStravaStatus(j);
    } catch {
      // Silent: non bloccare la UI se l'endpoint ha un problema temporaneo.
    }
  }, []);

  /**
   * Esegue la sync delle attivita' da Strava.
   * - `full=true`  → backfill dell'intero storico (primo sync o pulsante "Risincronizza tutto").
   * - `forceNow=true` → ignora il debounce server-side (per il click manuale).
   * Ricarica i workouts dal DB a fine sync, cosi' la UI vede subito le nuove righe.
   */
  const handleStravaSync = useCallback(
    async (opts: { full?: boolean; silent?: boolean } = {}) => {
      const { full = false, silent = false } = opts;
      if (stravaSyncing) return;
      setStravaSyncing(true);
      try {
        const res = await fetch("/api/fitness/strava/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full, forceNow: !silent }),
        });
        const j = await res.json();

        if (!res.ok || !j.success) {
          if (!silent) toast.error(j?.error || "Sync Strava fallita");
          return;
        }

        if (j.skipped) {
          // Debounced: niente toast, aggiorno comunque il last_sync.
          await fetchStravaStatus();
          return;
        }

        // Ricarica i workouts dal DB (possono esserci nuovi insert o update).
        if ((j.imported ?? 0) + (j.updated ?? 0) > 0) {
          const response = await fetch("/api/fitness/workouts");
          const result = (await response.json()) as { workouts?: Workout[] };
          if (response.ok && Array.isArray(result.workouts)) setWorkouts(result.workouts);
        }

        if (!silent) {
          const parts: string[] = [];
          if (j.imported) parts.push(`${j.imported} nuovi`);
          if (j.updated) parts.push(`${j.updated} aggiornati`);
          if (j.failed) parts.push(`${j.failed} falliti`);
          toast.success(parts.length > 0 ? `Strava: ${parts.join(", ")}` : "Strava: nessuna novita'");
        }

        await fetchStravaStatus();
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : "Errore di rete durante la sync");
        }
      } finally {
        setStravaSyncing(false);
      }
    },
    [stravaSyncing, fetchStravaStatus],
  );

  const handleStravaConnect = useCallback(() => {
    window.location.href = "/api/fitness/strava/connect";
  }, []);

  const handleStravaDisconnect = useCallback(async () => {
    if (!confirm("Disconnettere Strava? I workout gia' importati restano.")) return;
    try {
      const res = await fetch("/api/fitness/strava/disconnect", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.success) {
        toast.error(j?.error || "Impossibile disconnettere");
        return;
      }
      setStravaStatus({ connected: false });
      toast.success("Strava disconnesso");
    } catch {
      toast.error("Errore di rete");
    }
  }, []);

  // 1) Al mount, leggi lo stato della connessione.
  // 2) Gestisci il redirect del callback (?strava=connected|error).
  // 3) Se connesso, fai una sync automatica (una volta per sessione della vista).
  useEffect(() => {
    const strava = searchParams.get("strava");
    if (strava === "connected") {
      toast.success("Strava connesso");
    } else if (strava === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast.error(`Connessione Strava fallita: ${reason}`);
    }
    if (strava) {
      // Pulisco i query params senza ricaricare.
      const url = new URL(window.location.href);
      url.searchParams.delete("strava");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }

    // Flusso: prima il fetch status, poi (se connesso) auto-sync una sola volta.
    void (async () => {
      await fetchStravaStatus();
    })();
  }, [searchParams, fetchStravaStatus]);

  useEffect(() => {
    if (!stravaStatus.connected) return;
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    // Auto-sync "delta" all'apertura: server debounce copre aperture ravvicinate.
    void handleStravaSync({ silent: true });
  }, [stravaStatus.connected, handleStravaSync]);

  /* ── Coach AI ───────────────────────────────────────────── */

  const saveCoachPreferences = useCallback(async () => {
    setCoachPrefsSaving(true);
    setCoachError("");

    try {
      const result = await fitnessRecord({ action: "save_coach_preferences", goal: coachGoal, notes: coachNotes });

      setCoachPrefsSavedAt(result.saved_at || new Date().toISOString());
      return true;
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : "Errore di connessione");
      return false;
    } finally {
      setCoachPrefsSaving(false);
    }
  }, [coachGoal, coachNotes, fitnessRecord]);

  const generatePlan = useCallback(async () => {
    setCoachLoading(true);
    setCoachError("");

    try {
      const prefsSaved = await saveCoachPreferences();
      if (!prefsSaved) return;

      const res = await fetch("/api/fitness/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: coachGoal, notes: coachNotes }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        if (handleApiError(result)) return;
        setCoachError(result.error || "Errore nella generazione del piano");
        return;
      }

      const nextMonday = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
      const weekStart = format(nextMonday, "yyyy-MM-dd");

      const aiWorkouts = (result.workouts || []) as {
        day: string; title: string; type: string;
        distance_km: number | null; duration_minutes: number | null;
        pace_target: string | null; description: string;
      }[];
      const saved = await fitnessRecord({
        action: "create_training_plan",
        goal: coachGoal || null,
        notes: coachNotes || null,
        plan: result.summary || "",
        week_start: weekStart,
        workouts: aiWorkouts,
      });

      if (saved.plan) {
        const plan = saved.plan;
        setPlans((prev) => [plan, ...prev]);
        setSelectedPlanId(plan.id);

        if (saved.plannedWorkouts && saved.plannedWorkouts.length > 0) {
          setPlanned((prev) => [...prev, ...saved.plannedWorkouts!]);
        }

        toast.success("Piano salvato nell'app");
      }
    } catch {
      setCoachError("Errore di connessione");
    } finally {
      setCoachLoading(false);
    }
  }, [coachGoal, coachNotes, fitnessRecord, handleApiError, saveCoachPreferences]);

  const deletePlan = useCallback(async (id: string) => {
    await fitnessRecord({ action: "delete_training_plan", id });
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setPlanned((prev) => prev.filter((pw) => pw.plan_id !== id));
    setSelectedPlanId((prev) => prev === id ? (plans.find((p) => p.id !== id)?.id ?? null) : prev);
  }, [fitnessRecord, plans]);

  const linkWorkoutToPlanned = useCallback(async (plannedId: string, workoutId: string) => {
    const { row } = await fitnessRecord<PlannedWorkout>({ action: "update_planned_workout", id: plannedId, actual_workout_id: workoutId });
    if (row) {
      setPlanned((prev) => prev.map((pw) => pw.id === plannedId ? row : pw));
    }
    setLinkingPlannedId(null);
  }, [fitnessRecord]);

  const unlinkWorkoutFromPlanned = useCallback(async (plannedId: string) => {
    const { row } = await fitnessRecord<PlannedWorkout>({ action: "update_planned_workout", id: plannedId, actual_workout_id: null });
    if (row) {
      setPlanned((prev) => prev.map((pw) => pw.id === plannedId ? row : pw));
    }
  }, [fitnessRecord]);

  const selectedPlan = useMemo(
    () => needsCoachData ? plans.find((p) => p.id === selectedPlanId) ?? null : null,
    [needsCoachData, plans, selectedPlanId],
  );

  const selectedPlannedWorkouts = useMemo(
    () => needsCoachData && selectedPlanId ? planned.filter((pw) => pw.plan_id === selectedPlanId).sort((a, b) => a.sort_order - b.sort_order) : [],
    [needsCoachData, planned, selectedPlanId],
  );

  /* ── Main render ────────────────────────────────────────── */

  return (
    <div className="sb-page max-w-5xl">
      {/* Header */}
      <div className="sb-hero sb-module-fitness mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-4xl">Fitness</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--sb-muted)]">
            Traccia carico, forma, recupero e progressi reali.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-xl font-bold tabular-nums text-[var(--sb-text)]">{workoutStats.weekCount}</p>
            <p className="text-[10px] uppercase text-[var(--sb-muted)]">Settimana</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-xl font-bold tabular-nums text-rose-300">{workoutStats.weekDistance.toFixed(1)}</p>
            <p className="text-[10px] uppercase text-[var(--sb-muted)]">Km</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-sm font-bold text-orange-300">{RISK_LABELS[trainingLoad.summary.risk]}</p>
            <p className="text-[10px] uppercase text-[var(--sb-muted)]">Risk</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sb-toolbar mb-6 gap-1 overflow-x-auto p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "sb-focus sb-row flex min-w-12 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-sm transition-all",
              tab === key
                ? "bg-[var(--sb-hover)] text-[var(--sb-text)] font-medium"
                : "text-[var(--sb-muted)] hover:text-[var(--sb-text)]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TODAY TAB                                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === "today" && (
        <div className="space-y-6">
          {/* Last workout */}
          <section>
            <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-indigo-400" />
              Ultimo allenamento
            </h2>

            {workouts.length === 0 ? (
              <EmptyState
                icon={<Dumbbell className="h-5 w-5" />}
                title="Nessun allenamento registrato"
                action={
                  <Button
                    onClick={() => { setTab("workouts"); setShowWorkoutForm(true); }}
                    size="sm"
                    variant="ghost"
                  >
                    Registra il tuo primo allenamento
                  </Button>
                }
                className="rounded-lg border border-dashed border-[var(--sb-border)] p-8"
              />
            ) : (
              (() => {
                const last = workouts[0];
                const wt = WORKOUT_TYPES[last.type] || WORKOUT_TYPES.other;
                return (
                  <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{wt.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-[var(--sb-text)]">{wt.label}</p>
                          <p className="text-[10px] text-[var(--sb-muted)]">
                            {format(parseISO(last.date), "d MMMM yyyy", { locale: it })}
                          </p>
                        </div>
                      </div>
                      {last.feeling && (
                        <div className={cn("text-sm", FEELING_ICONS[last.feeling - 1]?.color)}>
                          {(() => { const F = FEELING_ICONS[last.feeling - 1]?.icon; return F ? <F className="h-5 w-5" /> : null; })()}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {last.distance_km != null && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-[var(--sb-text)] tabular-nums">{Number(last.distance_km).toFixed(2)}</p>
                          <p className="text-[10px] text-[var(--sb-muted)]">km</p>
                        </div>
                      )}
                      {last.duration_minutes != null && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-[var(--sb-text)] tabular-nums">{fmtDuration(Number(last.duration_minutes))}</p>
                          <p className="text-[10px] text-[var(--sb-muted)]">durata</p>
                        </div>
                      )}
                      {last.avg_pace && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-[var(--sb-text)] tabular-nums">{fmtPace(last.avg_pace)}</p>
                          <p className="text-[10px] text-[var(--sb-muted)]">passo medio</p>
                        </div>
                      )}
                    </div>
                    {(last.avg_heart_rate || last.calories) && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--sb-border)]">
                        {last.avg_heart_rate != null && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)]">
                            <Heart className="h-3.5 w-3.5 text-red-400" />
                            <span>{last.avg_heart_rate} bpm</span>
                          </div>
                        )}
                        {last.calories != null && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)]">
                            <Flame className="h-3.5 w-3.5 text-orange-400" />
                            <span>{last.calories} kcal</span>
                          </div>
                        )}
                        {last.steps != null && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)]">
                            <Footprints className="h-3.5 w-3.5 text-blue-400" />
                            <span>{last.steps}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </section>

          {/* Training load & form */}
          {workouts.length > 0 && (() => {
            const s = trainingLoad.summary;
            return (
              <section>
                <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-indigo-400" />
                  Carico &amp; Forma
                  {s.warmup && (
                    <span
                      title="Servono ~42 giorni di storico per stabilizzare CTL"
                      className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-300"
                    >
                      preliminare
                    </span>
                  )}
                </h2>
                <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xl font-bold text-emerald-400 tabular-nums">{s.ctl}</p>
                      <p className="text-[10px] text-[var(--sb-muted)]">Fitness (CTL 42gg)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-red-400 tabular-nums">{s.atl}</p>
                      <p className="text-[10px] text-[var(--sb-muted)]">Fatica (ATL 7gg)</p>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-xl font-bold tabular-nums", s.tsb >= 0 ? "text-blue-400" : "text-amber-400")}>
                        {s.tsb >= 0 ? "+" : ""}{s.tsb}
                      </p>
                      <p className="text-[10px] text-[var(--sb-muted)]">Forma (TSB)</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-[var(--sb-border)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--sb-muted)]">Stato</p>
                      <p className={cn("text-sm font-medium", formColor(s.form))}>
                        {FORM_LABELS[s.form]}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--sb-muted)]">Rischio (ACWR)</p>
                      <p className={cn("text-sm font-medium", riskColor(s.risk))}>
                        {s.acwr != null ? `${s.acwr.toFixed(2)} \u00b7 ` : ""}{RISK_LABELS[s.risk]}
                      </p>
                    </div>
                  </div>

                  {loadChart.length > 0 && (
                    <div className="pt-2">
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={loadChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 9, fill: "var(--sb-muted)" }}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 9, fill: "var(--sb-muted)" }} />
                          <Tooltip
                            contentStyle={{
                              background: "var(--sb-surface)",
                              border: "1px solid var(--sb-border)",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                          <Line type="monotone" dataKey="CTL" stroke="#34d399" strokeWidth={2} dot={false} name="Fitness" />
                          <Line type="monotone" dataKey="ATL" stroke="#f87171" strokeWidth={2} dot={false} name="Fatica" />
                          <Line type="monotone" dataKey="TSB" stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Forma" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Weekly recap */}
          {workouts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                Riepilogo settimanale
              </h2>
              <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-xl font-bold text-[var(--sb-text)] tabular-nums">{weeklyRecap.thisWeek.count}</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">Uscite</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-400 tabular-nums">{weeklyRecap.thisWeek.km.toFixed(1)} km</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">Distanza</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-[var(--sb-text)] tabular-nums">{fmtDuration(weeklyRecap.thisWeek.time)}</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">Tempo</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-400 tabular-nums">{weeklyRecap.weekStreak}</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">Sett. consecutive</p>
                  </div>
                </div>
                {weeklyRecap.lastWeek.km > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--sb-border)]">
                    <TrendingUp className={cn("h-3.5 w-3.5", weeklyRecap.kmDiff >= 0 ? "text-emerald-400" : "text-red-400")} />
                    <span className="text-xs text-[var(--sb-muted)]">
                      {weeklyRecap.kmDiff >= 0 ? "+" : ""}{weeklyRecap.kmDiff.toFixed(0)}% vs settimana scorsa ({weeklyRecap.lastWeek.km.toFixed(1)} km)
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Personal records */}
          {personalRecords && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-400" />
                Record personali
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {personalRecords.bestPace && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                    <Award className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-[var(--sb-text)]">{personalRecords.bestPace.value}</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">Miglior passo</p>
                    <p className="text-[10px] text-amber-400 mt-0.5">{format(parseISO(personalRecords.bestPace.date), "d MMM", { locale: it })}</p>
                  </div>
                )}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <Award className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-[var(--sb-text)]">{personalRecords.longestDistance.value} km</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">Piu lontano</p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">{format(parseISO(personalRecords.longestDistance.date), "d MMM", { locale: it })}</p>
                </div>
                {personalRecords.longestDuration && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-center">
                    <Award className="h-4 w-4 text-indigo-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-[var(--sb-text)]">{personalRecords.longestDuration.value}</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">Piu lungo</p>
                    <p className="text-[10px] text-indigo-400 mt-0.5">{format(parseISO(personalRecords.longestDuration.date), "d MMM", { locale: it })}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Achievements */}
          <section>
            <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
              <Medal className="h-4 w-4 text-amber-400" />
              Achievement ({unlockedCount}/{achievements.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-xl border p-3 text-center transition-all",
                    a.unlocked
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-[var(--sb-border)] bg-[var(--sb-surface)] opacity-40 grayscale",
                  )}
                >
                  <span className="text-2xl block mb-1">{a.icon}</span>
                  <p className="text-xs font-medium text-[var(--sb-text)]">{a.label}</p>
                  <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">{a.description}</p>
                  {a.progress && !a.unlocked && (
                    <p className="text-[10px] text-amber-400 mt-1 font-medium">{a.progress}</p>
                  )}
                  {a.unlocked && (
                    <Check className="h-3.5 w-3.5 text-amber-400 mx-auto mt-1" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Race predictions */}
          {racePredictions && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-indigo-400" />
                Predizione tempi gara
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "5K", time: racePredictions.fiveK },
                  { label: "10K", time: racePredictions.tenK },
                  { label: "Mezza", time: racePredictions.halfMarathon },
                  { label: "Maratona", time: racePredictions.marathon },
                ].map(({ label, time }) => (
                  <div key={label} className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3 text-center">
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-1">{label}</p>
                    <p className="text-sm font-bold text-[var(--sb-text)] tabular-nums">{time}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--sb-muted)] mt-2 italic">
                Stime basate sulla formula di Riegel. Migliorano man mano che accumuli dati.
              </p>
            </section>
          )}

          {/* HR Zones */}
          {hrZones && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-red-400" />
                Zone FC (max: {hrZones.maxHR} bpm)
              </h2>
              <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 space-y-2">
                {hrZones.zones.map((z, i) => {
                  const totalWithHR = zoneDistribution.reduce((s, c) => s + c, 0);
                  const pct = totalWithHR > 0 ? (zoneDistribution[i] / totalWithHR) * 100 : 0;
                  return (
                    <div key={z.name} className="flex items-center gap-3">
                      <div className="w-28 shrink-0">
                        <p className="text-xs text-[var(--sb-text)] font-medium">{z.name}</p>
                        <p className="text-[10px] text-[var(--sb-muted)]">{z.min}\u2013{z.max} bpm</p>
                      </div>
                      <div className="flex-1 h-4 rounded-full bg-[var(--sb-border)] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", z.color)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-[var(--sb-muted)] w-8 text-right tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* WORKOUTS TAB                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === "workouts" && (
        <div className="space-y-6">
          {/* Strava panel */}
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-card)] p-3">
            {!stravaStatus.connected ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--sb-text)] font-medium">Strava</p>
                    <p className="text-xs text-[var(--sb-muted)] truncate">
                      Importa automaticamente le tue attivit&agrave;
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleStravaConnect}
                  className="shrink-0 rounded-lg bg-orange-500 hover:bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                >
                  Connetti
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--sb-text)] font-medium truncate">
                      Strava {stravaStatus.athlete_name ? `\u00b7 ${stravaStatus.athlete_name}` : ""}
                    </p>
                    <p className="text-xs text-[var(--sb-muted)] truncate">
                      {stravaStatus.last_sync_error
                        ? `Errore: ${stravaStatus.last_sync_error}`
                        : stravaStatus.last_sync_at
                          ? `Ultima sync: ${format(parseISO(stravaStatus.last_sync_at), "d MMM HH:mm", { locale: it })}`
                          : "Mai sincronizzato"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleStravaSync({ full: false })}
                    disabled={stravaSyncing}
                    title="Sincronizza ora (delta)"
                    className="rounded-lg border border-[var(--sb-border)] hover:border-orange-500/40 hover:text-orange-400 px-2.5 py-1.5 text-xs text-[var(--sb-text)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {stravaSyncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sincronizza
                  </button>
                  <button
                    onClick={() => handleStravaSync({ full: true })}
                    disabled={stravaSyncing}
                    title="Risincronizza tutto lo storico"
                    className="rounded-lg border border-[var(--sb-border)] hover:border-orange-500/40 hover:text-orange-400 px-2 py-1.5 text-xs text-[var(--sb-muted)] transition-colors disabled:opacity-50"
                  >
                    Tutto
                  </button>
                  <button
                    onClick={handleStravaDisconnect}
                    title="Disconnetti Strava"
                    className="rounded-lg border border-transparent hover:border-red-500/30 hover:text-red-400 px-2 py-1.5 text-xs text-[var(--sb-muted)] transition-colors"
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { resetWorkoutForm(); setShowWorkoutForm(true); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--sb-border)] p-3 text-sm text-[var(--sb-muted)] hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Inserimento manuale
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--sb-border)] p-3 text-sm text-[var(--sb-muted)] hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {uploading ? "Analisi..." : "Da screenshot"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScreenshot(file);
                e.target.value = "";
              }}
            />
          </div>

          {uploadError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{uploadError}</p>
            </div>
          )}

          {/* Workout form */}
          {showWorkoutForm && (
            <div ref={workoutFormRef} className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 scroll-mt-4">
              <h3 className="text-sm font-medium text-[var(--sb-text)] mb-4 flex items-center gap-2">
                {editingWorkoutId ? (
                  <>
                    <Pencil className="h-4 w-4 text-emerald-400" />
                    Modifica allenamento
                    {editingHadFeedback && (
                      <span className="ml-2 text-[10px] font-normal text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-full">
                        Il parere del Coach verr&agrave; rigenerato
                      </span>
                    )}
                  </>
                ) : previewImage ? (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Dati estratti dallo screenshot — verifica e salva
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 text-emerald-400" />
                    Nuovo allenamento
                  </>
                )}
              </h3>

              {previewImage && (
                <div className="mb-4 rounded-lg overflow-hidden border border-[var(--sb-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- previewImage is a transient user-selected data URL/blob, not an optimizable app asset. */}
                  <img src={previewImage} alt="Screenshot" className="w-full max-h-48 object-contain bg-black/50" />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Data</label>
                  <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Tipo</label>
                  <select value={wType} onChange={(e) => setWType(e.target.value)}
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50">
                    {Object.entries(WORKOUT_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Distanza (km)</label>
                  <input type="number" step="0.01" value={wDistance} onChange={(e) => setWDistance(e.target.value)} placeholder="0.00"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Durata (min)</label>
                  <input type="number" step="0.1" value={wDuration} onChange={(e) => setWDuration(e.target.value)} placeholder="0.0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Passo medio</label>
                  <input type="text" value={wAvgPace} onChange={(e) => setWAvgPace(e.target.value)} placeholder={`10'07"`}
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Passo migliore</label>
                  <input type="text" value={wBestPace} onChange={(e) => setWBestPace(e.target.value)} placeholder={`5'59"`}
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Calorie</label>
                  <input type="number" value={wCalories} onChange={(e) => setWCalories(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">FC media</label>
                  <input type="number" value={wAvgHR} onChange={(e) => setWAvgHR(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">FC max</label>
                  <input type="number" value={wMaxHR} onChange={(e) => setWMaxHR(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Cadenza (spm)</label>
                  <input type="number" value={wCadence} onChange={(e) => setWCadence(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Dislivello (m)</label>
                  <input type="number" value={wElevation} onChange={(e) => setWElevation(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Passi</label>
                  <input type="number" value={wSteps} onChange={(e) => setWSteps(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                </div>
              </div>

              {/* Dati avanzati: intervalli, zone FC, effetto allenamento, falcata, VO2 max, recupero.
                  Editabili sia in inserimento manuale che in modifica. Il pannello e' sempre
                  visibile (collassato di default se non ci sono dati, espanso altrimenti). */}
              {(() => {
                const hasAdvancedData =
                  (wIntervals && wIntervals.length > 0) ||
                  (wHrZones && Object.values(wHrZones).some((v) => v != null)) ||
                  wTrainingEffectAerobic != null ||
                  wTrainingEffectAnaerobic != null ||
                  !!wMaxCadence || !!wAvgStrideCm || !!wMaxStrideCm || !!wVo2Max || !!wRecoveryHours;

                // Formatta secondi come MM:SS o H:MM:SS
                const fmtSec = (s: number | null): string => {
                  if (s == null || !Number.isFinite(s)) return "";
                  const n = Math.max(0, Math.round(s));
                  const h = Math.floor(n / 3600);
                  const m = Math.floor((n % 3600) / 60);
                  const ss = n % 60;
                  return h > 0
                    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
                    : `${m}:${String(ss).padStart(2, "0")}`;
                };
                // Parsa "MM:SS" / "H:MM:SS" / "SS" in secondi. Ritorna null se vuoto o invalido.
                const parseTime = (v: string): number | null => {
                  const s = v.trim();
                  if (!s) return null;
                  const parts = s.split(":").map((p) => p.trim());
                  if (parts.some((p) => !/^\d+$/.test(p))) return null;
                  const nums = parts.map(Number);
                  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
                  if (nums.length === 2) return nums[0] * 60 + nums[1];
                  if (nums.length === 1) return nums[0];
                  return null;
                };

                const intervals = wIntervals ?? [];
                const zones: HrZonesState = wHrZones ?? { leggera: null, intensiva: null, aerobica: null, anaerobica: null, vo2max: null };
                const zoneDefs = [
                  { key: "leggera" as const, label: "Leggera", color: "border-slate-500/40" },
                  { key: "intensiva" as const, label: "Intensiva", color: "border-blue-500/40" },
                  { key: "aerobica" as const, label: "Aerobica", color: "border-emerald-500/40" },
                  { key: "anaerobica" as const, label: "Anaerobica", color: "border-orange-500/40" },
                  { key: "vo2max" as const, label: "VO2 max", color: "border-red-500/40" },
                ];

                return (
                  <details className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 group" open={hasAdvancedData}>
                    <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 list-none">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                      <span className="text-xs font-medium text-indigo-300 flex-1">Dati avanzati (intervalli, zone FC, VO2, falcata...)</span>
                      <ChevronDown className="h-4 w-4 text-indigo-300 transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="px-3 pb-3 space-y-4">
                      {/* ── INTERVALLI ─────────────────────────────────────────── */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] text-[var(--sb-muted)] uppercase">
                            Intervalli {intervals.length > 0 && <span className="normal-case">({intervals.length})</span>}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const next: IntervalRow = { type: "", time: "", distance: "", pace: "" };
                              setWIntervals([...(wIntervals ?? []), next]);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-300 hover:text-emerald-200 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" /> Aggiungi riga
                          </button>
                        </div>

                        {intervals.length > 0 ? (
                          <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] overflow-hidden">
                            <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-x-2 px-2 py-1 text-[10px] text-[var(--sb-muted)] uppercase border-b border-[var(--sb-border)]">
                              <span>#</span>
                              <span>Tipo</span>
                              <span>Tempo</span>
                              <span>Distanza</span>
                              <span>Passo</span>
                              <span></span>
                            </div>
                            {intervals.map((iv, i) => (
                              <div key={i} className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-x-2 px-2 py-1.5 items-center border-b border-[var(--sb-border)] last:border-b-0">
                                <span className="text-xs text-[var(--sb-muted)] tabular-nums">{i + 1}</span>
                                <input
                                  type="text"
                                  value={iv.type}
                                  onChange={(e) => {
                                    const next = [...intervals];
                                    next[i] = { ...next[i], type: e.target.value };
                                    setWIntervals(next);
                                  }}
                                  placeholder="Allenamento / Riposo / Riscaldamento"
                                  className="w-full rounded border border-transparent hover:border-[var(--sb-border)] bg-transparent px-1.5 py-1 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50 focus:bg-[var(--sb-surface)]"
                                />
                                <input
                                  type="text"
                                  value={iv.time}
                                  onChange={(e) => {
                                    const next = [...intervals];
                                    next[i] = { ...next[i], time: e.target.value };
                                    setWIntervals(next);
                                  }}
                                  placeholder="00:02:30"
                                  className="w-full rounded border border-transparent hover:border-[var(--sb-border)] bg-transparent px-1.5 py-1 text-xs text-[var(--sb-text)] tabular-nums outline-none focus:border-emerald-500/50 focus:bg-[var(--sb-surface)]"
                                />
                                <input
                                  type="text"
                                  value={iv.distance}
                                  onChange={(e) => {
                                    const next = [...intervals];
                                    next[i] = { ...next[i], distance: e.target.value };
                                    setWIntervals(next);
                                  }}
                                  placeholder="326m"
                                  className="w-full rounded border border-transparent hover:border-[var(--sb-border)] bg-transparent px-1.5 py-1 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50 focus:bg-[var(--sb-surface)]"
                                />
                                <input
                                  type="text"
                                  value={iv.pace}
                                  onChange={(e) => {
                                    const next = [...intervals];
                                    next[i] = { ...next[i], pace: e.target.value };
                                    setWIntervals(next);
                                  }}
                                  placeholder={`7'40"`}
                                  className="w-full rounded border border-transparent hover:border-[var(--sb-border)] bg-transparent px-1.5 py-1 text-xs text-[var(--sb-text)] tabular-nums outline-none focus:border-emerald-500/50 focus:bg-[var(--sb-surface)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = intervals.filter((_, idx) => idx !== i);
                                    setWIntervals(next.length > 0 ? next : null);
                                  }}
                                  className="p-1 text-[var(--sb-muted)] hover:text-red-400 transition-colors cursor-pointer"
                                  title="Rimuovi riga"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--sb-muted)] italic">Nessun intervallo. Clicca &quot;Aggiungi riga&quot; per inserirne uno.</p>
                        )}
                      </div>

                      {/* ── ZONE FC ───────────────────────────────────────────── */}
                      <div>
                        <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-1.5">Zone frequenza cardiaca (tempo MM:SS o H:MM:SS)</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                          {zoneDefs.map(({ key, label, color }) => (
                            <div key={key} className={cn("rounded border px-1.5 py-1 bg-[var(--sb-bg)]", color)}>
                              <label className="block text-[9px] text-[var(--sb-muted)]">{label}</label>
                              <input
                                type="text"
                                value={fmtSec(zones[key])}
                                onChange={(e) => {
                                  const s = parseTime(e.target.value);
                                  const next: HrZonesState = { ...zones, [key]: s };
                                  const hasAny = Object.values(next).some((v) => v != null);
                                  setWHrZones(hasAny ? next : null);
                                }}
                                placeholder="0:00"
                                className="w-full bg-transparent text-xs text-[var(--sb-text)] tabular-nums outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── METRICHE EXTRA ────────────────────────────────────── */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">TE aerobico (0-5)</label>
                          <input
                            type="number"
                            step="0.1" min="0" max="5"
                            value={wTrainingEffectAerobic ?? ""}
                            onChange={(e) => setWTrainingEffectAerobic(e.target.value === "" ? null : Number(e.target.value))}
                            placeholder="0.0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">TE anaerobico (0-5)</label>
                          <input
                            type="number"
                            step="0.1" min="0" max="5"
                            value={wTrainingEffectAnaerobic ?? ""}
                            onChange={(e) => setWTrainingEffectAnaerobic(e.target.value === "" ? null : Number(e.target.value))}
                            placeholder="0.0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Cadenza max (spm)</label>
                          <input
                            type="number" value={wMaxCadence} onChange={(e) => setWMaxCadence(e.target.value)} placeholder="0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Falcata media (cm)</label>
                          <input
                            type="number" value={wAvgStrideCm} onChange={(e) => setWAvgStrideCm(e.target.value)} placeholder="0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Falcata max (cm)</label>
                          <input
                            type="number" value={wMaxStrideCm} onChange={(e) => setWMaxStrideCm(e.target.value)} placeholder="0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">VO2 max (ml/kg/min)</label>
                          <input
                            type="number" step="0.1" value={wVo2Max} onChange={(e) => setWVo2Max(e.target.value)} placeholder="0.0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Recupero (ore)</label>
                          <input
                            type="number" value={wRecoveryHours} onChange={(e) => setWRecoveryHours(e.target.value)} placeholder="0"
                            className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 py-1.5 text-xs text-[var(--sb-text)] outline-none focus:border-emerald-500/50" />
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })()}

              {/* Feeling */}
              <div className="mt-4">
                <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-2">Come ti sei sentito?</label>
                <div className="flex gap-2">
                  {FEELING_ICONS.map(({ value, icon: FIcon, label, color }) => (
                    <button
                      key={value}
                      onClick={() => setWFeeling(value)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all cursor-pointer",
                        wFeeling === value
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-[var(--sb-border)] hover:bg-[var(--sb-hover)]",
                      )}
                    >
                      <FIcon className={cn("h-5 w-5", wFeeling === value ? color : "text-[var(--sb-muted)]")} />
                      <span className="text-[10px] text-[var(--sb-muted)]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="mt-3">
                <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Note</label>
                <textarea value={wNotes} onChange={(e) => setWNotes(e.target.value)}
                  placeholder="Come e' andato l'allenamento?" rows={2}
                  className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-emerald-500/50 resize-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setShowWorkoutForm(false); resetWorkoutForm(); }}
                  className="flex-1 rounded-lg border border-[var(--sb-border)] py-2 text-sm text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer">
                  Annulla
                </button>
                <button onClick={saveWorkout} disabled={saving}
                  className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm text-white font-medium hover:bg-emerald-600 transition-all disabled:opacity-50 cursor-pointer">
                  {saving ? "Salvo..." : editingWorkoutId ? "Salva modifiche" : "Salva allenamento"}
                </button>
              </div>
            </div>
          )}

          {/* Charts */}
          {workouts.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Km settimanali
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface)", border: "1px solid var(--sb-border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: unknown) => [`${value} km`, "Distanza"]} />
                    <Bar dataKey="km" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {paceChart.length > 2 && (
                <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                  <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-indigo-400" />
                    Andamento passo
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={paceChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--sb-muted)" }}
                        tickFormatter={(v: number) => `${Math.floor(v / 60)}'${String(v % 60).padStart(2, "0")}`}
                        reversed />
                      <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface)", border: "1px solid var(--sb-border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(value: unknown) => {
                          const v = Number(value);
                          const m = Math.floor(v / 60);
                          const s = v % 60;
                          return [`${m}'${String(s).padStart(2, "0")}"/km`, "Passo"];
                        }} />
                      <Line type="monotone" dataKey="pace" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Workout list */}
          <section>
            <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-indigo-400" />
              Storico allenamenti
            </h2>

            {workouts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-8 text-center">
                <Dumbbell className="h-8 w-8 text-[var(--sb-muted)]/30 mx-auto mb-2" />
                <p className="text-sm text-[var(--sb-muted)]">Nessun allenamento registrato</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workouts.map((w) => {
                  const wt = WORKOUT_TYPES[w.type] || WORKOUT_TYPES.other;
                  const isExpanded = expandedWorkout === w.id;
                  return (
                    <div key={w.id} className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
                      <button
                        onClick={() => setExpandedWorkout(isExpanded ? null : w.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-[var(--sb-hover)] transition-all cursor-pointer"
                      >
                        <span className="text-lg shrink-0">{wt.emoji}</span>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--sb-text)]">{wt.label}</span>
                            {w.source === "screenshot" && <Camera className="h-3 w-3 text-indigo-400" />}
                            {w.source === "strava" && (
                              <span title="Importato da Strava" className="inline-flex items-center">
                                <Link2 className="h-3 w-3 text-orange-400" />
                              </span>
                            )}
                            {w.ai_feedback && (
                              <span
                                title="Parere Coach disponibile"
                                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300"
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                Parere
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[var(--sb-muted)]">
                            {format(parseISO(w.date), "d MMMM yyyy", { locale: it })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          {w.distance_km != null && (
                            <span className="text-sm font-medium text-[var(--sb-text)] tabular-nums">{Number(w.distance_km).toFixed(1)} km</span>
                          )}
                          {w.duration_minutes != null && (
                            <span className="text-xs text-[var(--sb-muted)] tabular-nums">{fmtDuration(Number(w.duration_minutes))}</span>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-[var(--sb-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--sb-muted)]" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-[var(--sb-border)]">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                            {w.avg_pace && (
                              <div className="flex items-center gap-1.5">
                                <Timer className="h-3.5 w-3.5 text-emerald-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Passo medio</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{fmtPace(w.avg_pace)}</p>
                                </div>
                              </div>
                            )}
                            {w.best_pace && (
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 text-amber-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Passo migliore</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{fmtPace(w.best_pace)}</p>
                                </div>
                              </div>
                            )}
                            {w.avg_heart_rate != null && (
                              <div className="flex items-center gap-1.5">
                                <Heart className="h-3.5 w-3.5 text-red-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">FC media</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.avg_heart_rate} bpm</p>
                                </div>
                              </div>
                            )}
                            {w.max_heart_rate != null && (
                              <div className="flex items-center gap-1.5">
                                <Heart className="h-3.5 w-3.5 text-red-500" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">FC max</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.max_heart_rate} bpm</p>
                                </div>
                              </div>
                            )}
                            {w.calories != null && (
                              <div className="flex items-center gap-1.5">
                                <Flame className="h-3.5 w-3.5 text-orange-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Calorie</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.calories} kcal</p>
                                </div>
                              </div>
                            )}
                            {w.avg_cadence != null && (
                              <div className="flex items-center gap-1.5">
                                <Footprints className="h-3.5 w-3.5 text-blue-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Cadenza</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.avg_cadence} spm</p>
                                </div>
                              </div>
                            )}
                            {w.elevation_m != null && (
                              <div className="flex items-center gap-1.5">
                                <Mountain className="h-3.5 w-3.5 text-teal-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Dislivello</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.elevation_m} m</p>
                                </div>
                              </div>
                            )}
                            {w.steps != null && (
                              <div className="flex items-center gap-1.5">
                                <Footprints className="h-3.5 w-3.5 text-indigo-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Passi</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.steps.toLocaleString("it-IT")}</p>
                                </div>
                              </div>
                            )}
                            {w.training_effect_aerobic != null && (
                              <div className="flex items-center gap-1.5">
                                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">TE Aerobico</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{Number(w.training_effect_aerobic).toFixed(1)}</p>
                                </div>
                              </div>
                            )}
                            {w.training_effect_anaerobic != null && (
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 text-purple-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">TE Anaerobico</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{Number(w.training_effect_anaerobic).toFixed(1)}</p>
                                </div>
                              </div>
                            )}
                            {w.max_cadence != null && (
                              <div className="flex items-center gap-1.5">
                                <Footprints className="h-3.5 w-3.5 text-blue-300" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Cadenza max</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.max_cadence} spm</p>
                                </div>
                              </div>
                            )}
                            {w.avg_stride_cm != null && (
                              <div className="flex items-center gap-1.5">
                                <Footprints className="h-3.5 w-3.5 text-cyan-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Falcata media</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.avg_stride_cm} cm</p>
                                </div>
                              </div>
                            )}
                            {w.max_stride_cm != null && (
                              <div className="flex items-center gap-1.5">
                                <Footprints className="h-3.5 w-3.5 text-cyan-300" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Falcata max</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.max_stride_cm} cm</p>
                                </div>
                              </div>
                            )}
                            {w.vo2_max != null && (
                              <div className="flex items-center gap-1.5">
                                <Activity className="h-3.5 w-3.5 text-fuchsia-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">VO2 max</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{Number(w.vo2_max).toFixed(1)} ml/kg/min</p>
                                </div>
                              </div>
                            )}
                            {w.recovery_hours != null && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-sky-400" />
                                <div>
                                  <p className="text-xs text-[var(--sb-muted)]">Recupero</p>
                                  <p className="text-sm font-medium text-[var(--sb-text)]">{w.recovery_hours} h</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {w.hr_zones && typeof w.hr_zones === "object" && !Array.isArray(w.hr_zones) && (
                            (() => {
                              const z = w.hr_zones as { leggera?: number | null; intensiva?: number | null; aerobica?: number | null; anaerobica?: number | null; vo2max?: number | null };
                              const hasAny = [z.leggera, z.intensiva, z.aerobica, z.anaerobica, z.vo2max].some((v) => v != null && Number(v) > 0);
                              if (!hasAny) return null;
                              const zoneRows = [
                                { key: "leggera", label: "Leggera", color: "bg-slate-400", s: z.leggera ?? 0 },
                                { key: "intensiva", label: "Intensiva", color: "bg-blue-400", s: z.intensiva ?? 0 },
                                { key: "aerobica", label: "Aerobica", color: "bg-emerald-400", s: z.aerobica ?? 0 },
                                { key: "anaerobica", label: "Anaerobica", color: "bg-orange-400", s: z.anaerobica ?? 0 },
                                { key: "vo2max", label: "VO2 max", color: "bg-red-400", s: z.vo2max ?? 0 },
                              ];
                              const totalS = zoneRows.reduce((sum, r) => sum + Number(r.s || 0), 0);
                              const fmtSec = (s: number) => {
                                const n = Math.max(0, Math.round(Number(s || 0)));
                                const h = Math.floor(n / 3600);
                                const m = Math.floor((n % 3600) / 60);
                                const ss = n % 60;
                                return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
                              };
                              return (
                                <div className="mt-3">
                                  <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-1.5">Zone frequenza cardiaca</p>
                                  <div className="space-y-1">
                                    {zoneRows.map((r) => {
                                      const pct = totalS > 0 ? (Number(r.s) / totalS) * 100 : 0;
                                      return (
                                        <div key={r.key} className="flex items-center gap-2 text-xs">
                                          <span className="w-20 text-[var(--sb-muted)]">{r.label}</span>
                                          <div className="flex-1 h-1.5 bg-[var(--sb-bg)] rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full", r.color)} style={{ width: `${pct}%` }} />
                                          </div>
                                          <span className="w-20 text-right text-[var(--sb-text)] tabular-nums">{fmtSec(Number(r.s))}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()
                          )}

                          {w.feeling && (
                            <div className="mt-3 flex items-center gap-2">
                              {(() => {
                                const fi = FEELING_ICONS[w.feeling - 1];
                                if (!fi) return null;
                                const FIcon = fi.icon;
                                return (
                                  <>
                                    <FIcon className={cn("h-4 w-4", fi.color)} />
                                    <span className="text-xs text-[var(--sb-muted)]">{fi.label}</span>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {w.notes && <p className="mt-2 text-xs text-[var(--sb-muted)] italic">{w.notes}</p>}

                          {getWorkoutIntervals(w.intervals).length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-1">Intervalli</p>
                              <div className="space-y-1">
                                {getWorkoutIntervals(w.intervals).map((iv, i) => (
                                  <div key={i} className="flex items-center gap-3 text-xs text-[var(--sb-muted)]">
                                    <span className="w-4 text-[10px]">{i + 1}</span>
                                    <span className="text-[var(--sb-text)]">{iv.type || "\u2014"}</span>
                                    <span>{iv.time || "\u2014"}</span>
                                    <span>{iv.distance || "\u2014"}</span>
                                    <span>{iv.pace || "\u2014"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-[var(--sb-border)] flex items-center justify-between gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                const title = `${wt.label} · ${format(parseISO(w.date), "d MMMM yyyy", { locale: it })}`;
                                void requestReview(w.id, title, false);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition-colors cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              {w.ai_feedback ? "Vedi parere Coach" : "Chiedi parere al Coach"}
                            </button>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => openEditWorkout(w)}
                                className="flex items-center gap-1 text-xs text-[var(--sb-muted)] hover:text-emerald-300 transition-colors cursor-pointer"
                                title={w.ai_feedback ? "Modifica — il parere del Coach verra' rigenerato" : "Modifica allenamento"}
                              >
                                <Pencil className="h-3 w-3" />
                                Modifica
                              </button>
                              <button
                                onClick={() => { if (confirm("Eliminare questo allenamento?")) deleteWorkout(w.id); }}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                                Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BODY TAB                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === "body" && (
        <div className="space-y-6">
          {/* Add metric */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-indigo-400" />
              Metriche corporee
            </h2>
            <button
              onClick={() => { resetMetricForm(); setShowMetricForm(true); }}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi
            </button>
          </div>

          {/* Metric form */}
          {showMetricForm && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Data</label>
                  <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Peso (kg)</label>
                  <input type="number" step="0.1" value={mWeight} onChange={(e) => setMWeight(e.target.value)} placeholder="0.0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Altezza (cm)</label>
                  <input type="number" step="0.5" value={mHeight} onChange={(e) => setMHeight(e.target.value)}
                    placeholder={bmiData ? String(bmiData.heightCm) : "175"}
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Grasso (%)</label>
                  <input type="number" step="0.1" value={mFat} onChange={(e) => setMFat(e.target.value)} placeholder="0.0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Girovita (cm)</label>
                  <input type="number" step="0.5" value={mWaist} onChange={(e) => setMWaist(e.target.value)} placeholder="0.0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">FC a riposo</label>
                  <input type="number" value={mRestHR} onChange={(e) => setMRestHR(e.target.value)} placeholder="0"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Note</label>
                  <input type="text" value={mNotes} onChange={(e) => setMNotes(e.target.value)} placeholder="opzionale"
                    className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowMetricForm(false)}
                  className="flex-1 rounded-lg border border-[var(--sb-border)] py-2 text-sm text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer">
                  Annulla
                </button>
                <button onClick={saveMetric} disabled={saving || (!mWeight && !mFat && !mWaist && !mRestHR && !mHeight)}
                  className="flex-1 rounded-lg bg-indigo-500 py-2 text-sm text-white font-medium hover:bg-indigo-600 transition-all disabled:opacity-50 cursor-pointer">
                  {saving ? "Salvo..." : "Salva"}
                </button>
              </div>
            </div>
          )}

          {/* BMI & Body Composition */}
          {bmiData && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-indigo-400" />
                BMI & Composizione corporea
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* BMI */}
                <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--sb-text)] tabular-nums">{bmiData.bmi.toFixed(1)}</p>
                  <p className="text-[10px] text-[var(--sb-muted)] uppercase">BMI</p>
                  <p className={cn("text-xs font-medium mt-0.5", bmiData.category.color)}>{bmiData.category.label}</p>
                </div>
                {/* Weight */}
                <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--sb-text)] tabular-nums">{bmiData.weight.toFixed(1)}</p>
                  <p className="text-[10px] text-[var(--sb-muted)] uppercase">Peso (kg)</p>
                </div>
                {/* Lean mass */}
                {bmiData.leanMass != null && (
                  <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">{bmiData.leanMass.toFixed(1)}</p>
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase">Massa magra (kg)</p>
                  </div>
                )}
                {/* Fat mass */}
                {bmiData.fatMass != null && (
                  <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3 text-center">
                    <p className="text-2xl font-bold text-amber-400 tabular-nums">{bmiData.fatMass.toFixed(1)}</p>
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase">Massa grassa (kg)</p>
                  </div>
                )}
              </div>

              {/* BMI scale bar */}
              <div className="mt-4">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div className="flex-1 bg-blue-400" />
                  <div className="flex-[1.5] bg-emerald-400" />
                  <div className="flex-1 bg-amber-400" />
                  <div className="flex-1 bg-red-400" />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--sb-muted)] mt-1">
                  <span>16</span>
                  <span>18.5</span>
                  <span>25</span>
                  <span>30</span>
                  <span>40</span>
                </div>
                {/* BMI marker */}
                <div className="relative h-0">
                  <div
                    className="absolute -top-6 w-0.5 h-3 bg-[var(--sb-text)] rounded-full"
                    style={{
                      left: `${Math.min(Math.max(((bmiData.bmi - 16) / 24) * 100, 0), 100)}%`,
                      transform: "translateX(-50%)",
                    }}
                  />
                </div>
              </div>

              {/* Body composition bar (if fat % available) */}
              {bmiData.leanMass != null && bmiData.fatMass != null && (
                <div className="mt-4">
                  <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-1">Composizione</p>
                  <div className="flex h-5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 flex items-center justify-center text-[10px] text-white font-medium"
                      style={{ width: `${(bmiData.leanMass / bmiData.weight) * 100}%` }}
                    >
                      {((bmiData.leanMass / bmiData.weight) * 100).toFixed(0)}%
                    </div>
                    <div
                      className="bg-amber-400 flex items-center justify-center text-[10px] text-white font-medium"
                      style={{ width: `${(bmiData.fatMass / bmiData.weight) * 100}%` }}
                    >
                      {((bmiData.fatMass / bmiData.weight) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--sb-muted)] mt-1">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Magra</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Grassa</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current stats */}
          {metrics.length > 0 && !bmiData && (() => {
            const latest = metrics[metrics.length - 1];
            const first = metrics[0];
            const weightDiff = (latest.weight_kg && first.weight_kg) ? Number(latest.weight_kg) - Number(first.weight_kg) : null;
            const waistDiff = (latest.waist_cm && first.waist_cm) ? Number(latest.waist_cm) - Number(first.waist_cm) : null;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {latest.weight_kg != null && (
                  <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3 text-center">
                    <p className="text-xl font-bold text-[var(--sb-text)] tabular-nums">{Number(latest.weight_kg).toFixed(1)}</p>
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase">Peso (kg)</p>
                    {weightDiff != null && metrics.length > 1 && (
                      <p className={cn("text-[10px] mt-0.5 font-medium", weightDiff <= 0 ? "text-emerald-400" : "text-red-400")}>
                        {weightDiff <= 0 ? "" : "+"}{weightDiff.toFixed(1)} kg
                      </p>
                    )}
                  </div>
                )}
                {latest.body_fat_pct != null && (
                  <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3 text-center">
                    <p className="text-xl font-bold text-[var(--sb-text)] tabular-nums">{Number(latest.body_fat_pct).toFixed(1)}%</p>
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase">Grasso</p>
                  </div>
                )}
                {latest.waist_cm != null && (
                  <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3 text-center">
                    <p className="text-xl font-bold text-[var(--sb-text)] tabular-nums">{Number(latest.waist_cm).toFixed(1)}</p>
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase">Girovita (cm)</p>
                    {waistDiff != null && metrics.length > 1 && (
                      <p className={cn("text-[10px] mt-0.5 font-medium", waistDiff <= 0 ? "text-emerald-400" : "text-red-400")}>
                        {waistDiff <= 0 ? "" : "+"}{waistDiff.toFixed(1)} cm
                      </p>
                    )}
                  </div>
                )}
                {latest.resting_hr != null && (
                  <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3 text-center">
                    <p className="text-xl font-bold text-[var(--sb-text)] tabular-nums">{latest.resting_hr}</p>
                    <p className="text-[10px] text-[var(--sb-muted)] uppercase">FC riposo</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* BMI chart */}
          {bmiChart.length > 1 && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                Andamento BMI
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={bmiChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                  <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface)", border: "1px solid var(--sb-border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: unknown) => [`${value}`, "BMI"]} />
                  <Line type="monotone" dataKey="bmi" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weight chart */}
          {weightChart.length > 1 && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                Andamento peso
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface)", border: "1px solid var(--sb-border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: unknown) => [`${value} kg`, "Peso"]} />
                  <Line type="monotone" dataKey="kg" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Waist chart */}
          {waistChart.length > 1 && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Andamento girovita
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={waistChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: "var(--sb-muted)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface)", border: "1px solid var(--sb-border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: unknown) => [`${value} cm`, "Girovita"]} />
                  <Line type="monotone" dataKey="cm" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Metrics history */}
          {metrics.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--sb-text)] mb-3">Storico misurazioni</h3>
              <div className="space-y-1">
                {[...metrics].reverse().map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--sb-hover)] transition-all group">
                    <span className="text-xs text-[var(--sb-muted)] w-16 shrink-0">{format(parseISO(m.date), "d MMM", { locale: it })}</span>
                    <div className="flex-1 flex items-center gap-4 text-xs text-[var(--sb-text)]">
                      {m.weight_kg != null && <span>{Number(m.weight_kg).toFixed(1)} kg</span>}
                      {m.body_fat_pct != null && <span>{Number(m.body_fat_pct).toFixed(1)}%</span>}
                      {m.waist_cm != null && <span>{Number(m.waist_cm).toFixed(1)} cm</span>}
                      {m.resting_hr != null && <span>{m.resting_hr} bpm</span>}
                      {m.height_cm != null && <span>{Number(m.height_cm).toFixed(0)} cm alt.</span>}
                    </div>
                    <button
                      onClick={() => { if (confirm("Eliminare questa misurazione?")) deleteMetric(m.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[var(--sb-muted)] hover:text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {metrics.length === 0 && !showMetricForm && (
            <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-8 text-center">
              <Scale className="h-8 w-8 text-[var(--sb-muted)]/30 mx-auto mb-2" />
              <p className="text-sm text-[var(--sb-muted)] mb-2">Nessuna misurazione registrata</p>
              <button onClick={() => setShowMetricForm(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
                Registra la tua prima misurazione
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* COACH AI TAB                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === "coach" && (
        <div className="space-y-6">
          {/* Info */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-semibold text-[var(--sb-text)]">Coach AI</h2>
            </div>
            <p className="text-xs text-[var(--sb-muted)]">
              Il tuo assistente personale analizza il tuo storico allenamenti e genera un piano settimanale su misura.
              {workouts.length === 0 && " Registra almeno un allenamento per iniziare."}
            </p>
          </div>

          {/* Goal + Notes + Generate */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Il tuo obiettivo persistente</label>
              <input type="text" value={coachGoal} onChange={(e) => setCoachGoal(e.target.value)}
                placeholder="Es: Correre 5km senza fermarmi, preparare una 10K..."
                className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50" />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--sb-muted)] uppercase mb-1">Note aggiuntive (opzionale)</label>
              <textarea value={coachNotes} onChange={(e) => setCoachNotes(e.target.value)}
                placeholder="Es: Ho un lieve fastidio al ginocchio, posso allenarmi 3 volte a settimana..." rows={2}
                className="w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm text-[var(--sb-text)] outline-none focus:border-indigo-500/50 resize-none" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button onClick={saveCoachPreferences} disabled={coachPrefsSaving}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--sb-border)] px-3 py-2 text-xs font-medium text-[var(--sb-text)] hover:border-indigo-500/40 hover:text-indigo-300 transition-all disabled:opacity-50 cursor-pointer">
                {coachPrefsSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvo...</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Salva obiettivi</>
                )}
              </button>
              <p className="text-[11px] text-[var(--sb-muted)]">
                {coachPrefsSavedAt ? "Il Coach li usera' automaticamente nei prossimi piani." : "Salvali una volta: resteranno disponibili per i prossimi piani."}
              </p>
            </div>
            <button onClick={generatePlan} disabled={coachLoading || coachPrefsSaving || workouts.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm text-white font-medium hover:bg-indigo-600 transition-all disabled:opacity-50 cursor-pointer">
              {coachLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Genero il piano...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Genera piano settimanale</>
              )}
            </button>
          </div>

          {coachError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{coachError}</p>
            </div>
          )}

          {/* Saved plans selector */}
          {plans.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-400" />
                I tuoi piani
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {plans.map((p) => {
                  const pw = planned.filter((x) => x.plan_id === p.id);
                  const trackable = pw.filter((x) => !["rest", "walk", "stretching", "cross_training"].includes(x.workout_type));
                  const done = trackable.filter((x) => x.actual_workout_id).length;
                  const total = trackable.length;
                  return (
                    <button key={p.id} onClick={() => setSelectedPlanId(p.id)}
                      className={cn(
                        "shrink-0 rounded-lg border px-3 py-2 text-xs transition-all cursor-pointer",
                        selectedPlanId === p.id
                          ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-medium"
                          : "border-[var(--sb-border)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]",
                      )}>
                      <span className="block">Sett. {format(parseISO(p.week_start), "d MMM", { locale: it })}</span>
                      {total > 0 && <span className="block text-[10px] mt-0.5 opacity-60">{done}/{total} completati</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Selected plan */}
          {selectedPlan && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-[var(--sb-text)]">
                      Piano settimana {format(parseISO(selectedPlan.week_start), "d MMMM", { locale: it })}
                    </h3>
                  </div>
                  <button
                    onClick={() => { if (confirm("Eliminare questo piano e tutti gli allenamenti pianificati?")) deletePlan(selectedPlan.id); }}
                    className="p-1.5 rounded-lg text-[var(--sb-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selectedPlan.goal && (
                  <p className="text-[10px] text-indigo-400 mb-3 flex items-center gap-1">
                    <Target className="h-3 w-3" /> {selectedPlan.goal}
                  </p>
                )}
                {selectedPlannedWorkouts.length > 0 && (() => {
                  const NON_TRACKABLE = new Set(["rest", "walk", "stretching", "cross_training"]);
                  const done = selectedPlannedWorkouts.filter((pw) => pw.actual_workout_id).length;
                  const total = selectedPlannedWorkouts.filter((pw) => !NON_TRACKABLE.has(pw.workout_type)).length;
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] text-[var(--sb-muted)] mb-1">
                        <span>Completamento</span>
                        <span>{done}/{total} allenamenti</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                          style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }} />
                      </div>
                    </div>
                  );
                })()}
                {selectedPlan.plan && (
                  <div className="prose-fitness">
                    <ReactMarkdown components={{
                      h1: ({ children }) => <h1 className="text-base font-bold text-[var(--sb-text)] mb-3 mt-5">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-2 mt-4">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-medium text-indigo-400 mb-1 mt-3">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-[var(--sb-text)] leading-relaxed mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="text-sm text-[var(--sb-text)] pl-5 mb-3 list-disc space-y-1.5">{children}</ul>,
                      ol: ({ children }) => <ol className="text-sm text-[var(--sb-text)] pl-5 mb-3 list-decimal space-y-1.5">{children}</ol>,
                      li: ({ children }) => <li className="text-sm text-[var(--sb-text)] leading-relaxed">{children}</li>,
                      strong: ({ children }) => <strong className="text-[var(--sb-text)] font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="text-[var(--sb-muted)]">{children}</em>,
                      hr: () => <hr className="border-[var(--sb-border)] my-4" />,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500/40 pl-3 my-3 text-sm text-[var(--sb-text)] opacity-80">{children}</blockquote>,
                    }}>
                      {selectedPlan.plan}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Planned workouts cards */}
              {selectedPlannedWorkouts.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-[var(--sb-text)] mb-3 flex items-center gap-1.5">
                    <Dumbbell className="h-4 w-4 text-emerald-400" />
                    Allenamenti della settimana
                  </h3>
                  <div className="space-y-2">
                    {selectedPlannedWorkouts.map((pw) => {
                      const wt = WORKOUT_TYPES[pw.workout_type] || WORKOUT_TYPES.other;
                      const isRest = pw.workout_type === "rest";
                      const actualW = pw.actual_workout_id ? workouts.find((w) => w.id === pw.actual_workout_id) : null;
                      const isLinking = linkingPlannedId === pw.id;

                      return (
                        <div key={pw.id}
                          className={cn(
                            "rounded-xl border overflow-hidden transition-all",
                            actualW ? "border-emerald-500/30 bg-emerald-500/5"
                              : isRest ? "border-[var(--sb-border)] bg-[var(--sb-surface)] opacity-60"
                              : "border-[var(--sb-border)] bg-[var(--sb-surface)]",
                          )}>
                          <div className="p-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg shrink-0">{wt.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-indigo-400 font-medium uppercase">{pw.day_label}</span>
                                  {actualW && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                                </div>
                                <p className="text-sm font-medium text-[var(--sb-text)]">{pw.title}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--sb-muted)]">
                                {pw.distance_km != null && <span>{Number(pw.distance_km).toFixed(1)} km</span>}
                                {pw.duration_minutes != null && <span>{fmtDuration(Number(pw.duration_minutes))}</span>}
                                {pw.pace_target && <span>{pw.pace_target}</span>}
                              </div>
                            </div>
                            {pw.description && (
                              <p className="text-xs text-[var(--sb-muted)] mt-2 ml-9 leading-relaxed">{pw.description}</p>
                            )}

                            {/* Actual vs planned comparison */}
                            {actualW && (
                              <div className="mt-3 ml-9 rounded-lg bg-[var(--sb-bg)] border border-[var(--sb-border)] p-2.5">
                                <p className="text-[10px] text-emerald-400 font-medium uppercase mb-1.5">Risultato</p>
                                <div className="flex items-center gap-4 text-xs">
                                  {actualW.distance_km != null && (
                                    <div>
                                      <span className="text-[var(--sb-muted)]">Distanza: </span>
                                      <span className="text-[var(--sb-text)] font-medium">{Number(actualW.distance_km).toFixed(2)} km</span>
                                    </div>
                                  )}
                                  {actualW.avg_pace && (
                                    <div>
                                      <span className="text-[var(--sb-muted)]">Passo: </span>
                                      <span className="text-[var(--sb-text)] font-medium">{fmtPace(actualW.avg_pace)}</span>
                                    </div>
                                  )}
                                  {actualW.avg_heart_rate != null && (
                                    <div>
                                      <span className="text-[var(--sb-muted)]">FC: </span>
                                      <span className="text-[var(--sb-text)] font-medium">{actualW.avg_heart_rate} bpm</span>
                                    </div>
                                  )}
                                  {actualW.feeling != null && (
                                    <div className="flex items-center gap-1">
                                      {(() => { const fi = FEELING_ICONS[actualW.feeling - 1]; const F = fi?.icon; return F ? <F className={cn("h-3.5 w-3.5", fi.color)} /> : null; })()}
                                    </div>
                                  )}
                                </div>
                                <button onClick={() => unlinkWorkoutFromPlanned(pw.id)}
                                  className="text-[10px] text-[var(--sb-muted)] hover:text-red-400 mt-1.5 transition-colors cursor-pointer">
                                  Scollega
                                </button>
                              </div>
                            )}

                            {/* Link action */}
                            {!actualW && !["walk", "stretching", "rest", "cross_training"].includes(pw.workout_type) && (
                              <div className="mt-2 ml-9">
                                {isLinking ? (
                                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2">
                                    <p className="text-[10px] text-[var(--sb-muted)] mb-2">Seleziona l&apos;allenamento eseguito:</p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {workouts.slice(0, 10).map((w) => {
                                        const wtt = WORKOUT_TYPES[w.type] || WORKOUT_TYPES.other;
                                        return (
                                          <button key={w.id} onClick={() => linkWorkoutToPlanned(pw.id, w.id)}
                                            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer text-left">
                                            <span>{wtt.emoji}</span>
                                            <span className="flex-1 truncate">{wtt.label} — {format(parseISO(w.date), "d MMM", { locale: it })}</span>
                                            {w.distance_km != null && <span className="text-[var(--sb-muted)]">{Number(w.distance_km).toFixed(1)} km</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button onClick={() => setLinkingPlannedId(null)}
                                      className="text-[10px] text-[var(--sb-muted)] hover:text-[var(--sb-text)] mt-1.5 transition-colors cursor-pointer">
                                      Annulla
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setLinkingPlannedId(pw.id)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Collega allenamento eseguito
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Stats summary */}
          {workouts.length > 0 && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <h3 className="text-sm font-medium text-[var(--sb-text)] mb-3">Il tuo profilo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-[var(--sb-text)]">{workoutStats.total}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">Allenamenti</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[var(--sb-text)]">{workoutStats.totalDistance.toFixed(1)} km</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">Distanza totale</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[var(--sb-text)]">{fmtDuration(workoutStats.totalDuration)}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">Tempo totale</p>
                </div>
                {workoutStats.avgHR && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--sb-text)]">{workoutStats.avgHR} bpm</p>
                    <p className="text-[10px] text-[var(--sb-muted)]">FC media</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
         COACH REVIEW MODAL — parere sul singolo allenamento
         ═════════════════════════════════════════════════════════ */}
      {reviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReviewModal(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-up"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow-lg)]"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--sb-border)] bg-[var(--sb-surface)]/95 backdrop-blur px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--sb-text)] truncate">Parere del Coach</p>
                  <p className="text-[11px] text-[var(--sb-muted)] truncate">{reviewModal.title}</p>
                </div>
              </div>
              <button
                onClick={() => setReviewModal(null)}
                aria-label="Chiudi"
                className="shrink-0 rounded-lg p-1.5 text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-4">
              {reviewModal.loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--sb-muted)]">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                  <p className="text-sm">Il Coach sta analizzando l&apos;allenamento e lo storico…</p>
                  <p className="text-[11px] text-[var(--sb-muted)]">
                    Ci vogliono pochi secondi.
                  </p>
                </div>
              )}

              {!reviewModal.loading && reviewModal.error && (
                <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Non sono riuscito a generare il parere</span>
                  </div>
                  <p className="text-xs text-red-300/80">{reviewModal.error}</p>
                  <button
                    onClick={() => void requestReview(reviewModal.workoutId, reviewModal.title, true)}
                    className="self-start inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors cursor-pointer"
                  >
                    Riprova
                  </button>
                </div>
              )}

              {!reviewModal.loading && !reviewModal.error && reviewModal.feedback && (
                <>
                  <div className="prose prose-invert prose-sm max-w-none text-[var(--sb-text)] [&_h1]:text-[var(--sb-text)] [&_h2]:text-[var(--sb-text)] [&_h3]:text-[var(--sb-text)] [&_strong]:text-[var(--sb-text)] [&_p]:leading-relaxed [&_ul]:text-[var(--sb-text)]">
                    <ReactMarkdown>{reviewModal.feedback}</ReactMarkdown>
                  </div>
                  {reviewModal.generatedAt && (
                    <p className="mt-4 text-[11px] text-[var(--sb-muted)]">
                      Generato il {format(parseISO(reviewModal.generatedAt), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-[var(--sb-border)]">
                    <button
                      onClick={() => void requestReview(reviewModal.workoutId, reviewModal.title, true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sb-hover)] hover:bg-[var(--sb-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Rigenera parere
                    </button>
                    <button
                      onClick={() => setReviewModal(null)}
                      className="inline-flex items-center rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      Chiudi
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
