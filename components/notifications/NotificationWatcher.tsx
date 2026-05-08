"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isNotificationSupported,
  markNotificationSeen,
  NOTIFICATION_ENABLED_KEY,
  showAppNotification,
  wasNotificationSeen,
} from "@/components/notifications/notify";

interface ReminderRow {
  id: string;
  remind_at: string;
  notes?: { title?: string | null } | null;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
}

interface RecurringRow {
  id: string;
  name: string;
  next_due_date: string;
}

interface ExamRow {
  id: string;
  name: string;
  exam_date: string | null;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function notifyOnce(id: string, title: string, body: string, url: string) {
  if (wasNotificationSeen(id)) return;
  const sent = await showAppNotification(title, {
    body,
    tag: id,
    data: { url },
  });
  if (sent) markNotificationSeen(id);
}

export default function NotificationWatcher() {
  const supabase = useMemo(() => createClient(), []);
  const runningRef = useRef(false);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    async function check(options: { force?: boolean } = {}) {
      if (runningRef.current) return;
      if (Notification.permission !== "granted") return;
      if (localStorage.getItem(NOTIFICATION_ENABLED_KEY) !== "true") return;
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) return;

      const nowMs = Date.now();
      if (!options.force && nowMs - lastCheckRef.current < 5 * 60 * 1000) return;
      lastCheckRef.current = nowMs;

      runningRef.current = true;
      try {
        const today = todayDate();
        const tomorrow = tomorrowDate();
        const now = new Date().toISOString();

        const [reminders, tasks, recurring, exams] = await Promise.all([
          supabase
            .from("note_reminders")
            .select("id, remind_at, notes(title)")
            .eq("dismissed", false)
            .lte("remind_at", now)
            .limit(3),
          supabase
            .from("tasks")
            .select("id, title, due_date")
            .is("deleted_at", null)
            .neq("status", "done")
            .lte("due_date", today)
            .limit(3),
          supabase
            .from("recurring_expenses")
            .select("id, name, next_due_date")
            .eq("is_active", true)
            .lte("next_due_date", today)
            .limit(3),
          supabase
            .from("university_exams")
            .select("id, name, exam_date")
            .eq("status", "booked")
            .gte("exam_date", today)
            .lte("exam_date", tomorrow)
            .limit(3),
        ]);

        for (const item of (reminders.data ?? []) as ReminderRow[]) {
          await notifyOnce(
            `note-reminder-${item.id}`,
            "Promemoria nota",
            item.notes?.title ? `È ora di rivedere: ${item.notes.title}` : "Hai un promemoria nota in scadenza.",
            "/home",
          );
        }

        for (const task of (tasks.data ?? []) as TaskRow[]) {
          await notifyOnce(
            `task-due-${task.id}`,
            "Task in scadenza",
            task.title,
            "/tasks",
          );
        }

        for (const item of (recurring.data ?? []) as RecurringRow[]) {
          await notifyOnce(
            `recurring-due-${item.id}`,
            "Scadenza finanziaria",
            item.name,
            "/finance",
          );
        }

        for (const exam of (exams.data ?? []) as ExamRow[]) {
          await notifyOnce(
            `exam-booked-${exam.id}`,
            "Esame vicino",
            exam.name,
            "/university",
          );
        }
      } finally {
        runningRef.current = false;
      }
    }

    check({ force: true });
    const interval = window.setInterval(check, 5 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void check({ force: true });
    };
    const handleOnline = () => {
      void check({ force: true });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [supabase]);

  return null;
}
