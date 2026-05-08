"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, Coffee, Brain } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Phase = "focus" | "break";

const FOCUS_MINUTES = 25;
const BREAK_MINUTES = 5;

export default function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = phase === "focus" ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60;
  const progress = 1 - secondsLeft / totalSeconds;

  const notify = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192x192.png" });
    }
    // Also play a subtle beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = phase === "focus" ? 800 : 600;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not available
    }
  }, [phase]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (phase === "focus") {
            setSessions((s) => s + 1);
            notify("Pausa! ☕", "Hai completato 25 minuti di focus. Prenditi 5 minuti.");
            setPhase("break");
            return BREAK_MINUTES * 60;
          } else {
            notify("Si ricomincia! 🧠", "Pausa finita. Torniamo a scrivere.");
            setPhase("focus");
            return FOCUS_MINUTES * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase, notify]);

  // Request notification permission on first play
  function handlePlay() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(FOCUS_MINUTES * 60);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "p-1.5 rounded-md transition-all cursor-pointer",
          running
            ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
            : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
        )}
        title="Pomodoro Timer"
      >
        <Timer className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(false)}
        className={cn(
          "p-1.5 rounded-md transition-all cursor-pointer",
          running
            ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
            : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
        )}
        title="Pomodoro Timer"
      >
        <Timer className="h-4 w-4" />
      </button>

      <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-4 z-30">
        {/* Phase indicator */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {phase === "focus" ? (
            <Brain className="h-4 w-4 text-indigo-400" />
          ) : (
            <Coffee className="h-4 w-4 text-amber-400" />
          )}
          <span className={cn(
            "text-xs font-semibold uppercase",
            phase === "focus" ? "text-indigo-400" : "text-amber-400"
          )}>
            {phase === "focus" ? "Focus" : "Pausa"}
          </span>
        </div>

        {/* Circular progress + time */}
        <div className="relative w-32 h-32 mx-auto mb-3">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--sb-border)" strokeWidth="4" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke={phase === "focus" ? "#6366f1" : "#f59e0b"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 276.46} 276.46`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-mono font-bold text-[var(--sb-text)]">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          {running ? (
            <button
              onClick={() => setRunning(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer"
            >
              <Pause className="h-3 w-3" />
              Pausa
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
                phase === "focus"
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              )}
            >
              <Play className="h-3 w-3" />
              Avvia
            </button>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        {/* Sessions counter */}
        {sessions > 0 && (
          <p className="text-center text-[10px] text-[var(--sb-muted)] mt-3">
            {sessions} {sessions === 1 ? "sessione" : "sessioni"} completat{sessions === 1 ? "a" : "e"} 🎯
          </p>
        )}
      </div>
    </div>
  );
}
