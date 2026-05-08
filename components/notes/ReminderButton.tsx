"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

interface Props {
  noteId: string;
}

export default function ReminderButton({ noteId }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reminder, setReminder] = useState<{ id: string; remind_at: string } | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing reminder
  useEffect(() => {
    supabase
      .from("note_reminders")
      .select("id, remind_at")
      .eq("note_id", noteId)
      .eq("dismissed", false)
      .order("remind_at", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setReminder(data[0]);
      });
  }, [noteId, supabase]);

  async function setReminderTime() {
    if (!dateValue || !timeValue) return;
    setSaving(true);
    const remindAt = new Date(`${dateValue}T${timeValue}`).toISOString();

    const response = await fetch("/api/note-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId, remind_at: remindAt }),
    });
    const result = (await response.json()) as { reminder?: { id: string; remind_at: string } };

    if (response.ok && result.reminder) {
      setReminder(result.reminder);
      // Schedule notification
      scheduleNotification(result.reminder.remind_at, result.reminder.id);
    }
    setSaving(false);
    setOpen(false);
  }

  async function removeReminder() {
    if (!reminder) return;
    await fetch(`/api/note-reminders/${reminder.id}`, { method: "DELETE" });
    setReminder(null);
    setOpen(false);
  }

  function scheduleNotification(remindAt: string, reminderId: string) {
    const ms = new Date(remindAt).getTime() - Date.now();
    if (ms <= 0) return;
    if (ms > 2147483647) return; // setTimeout max (~24.8 days)

    setTimeout(async () => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Promemoria 📝", {
          body: "Hai un promemoria su una nota!",
          icon: "/icons/icon-192x192.png",
          tag: reminderId,
        });
      }
      // Dismiss the reminder
      await fetch(`/api/note-reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      setReminder(null);
    }, ms);
  }

  // Request notification permission and schedule existing on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    if (reminder) {
      scheduleNotification(reminder.remind_at, reminder.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder?.id]);

  // Quick presets
  function setQuickReminder(minutes: number) {
    const d = new Date(Date.now() + minutes * 60 * 1000);
    setDateValue(d.toISOString().slice(0, 10));
    setTimeValue(d.toISOString().slice(11, 16));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "p-1.5 rounded-md transition-all cursor-pointer",
          reminder
            ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
            : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
        )}
        title={reminder ? `Promemoria: ${new Date(reminder.remind_at).toLocaleString("it-IT")}` : "Imposta promemoria"}
      >
        {reminder ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--sb-text)]">Promemoria</h3>
            <button onClick={() => setOpen(false)} className="p-1 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {reminder && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-300 font-medium">Promemoria attivo</p>
                  <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">
                    {new Date(reminder.remind_at).toLocaleString("it-IT", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
                <button
                  onClick={removeReminder}
                  className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Rimuovi
                </button>
              </div>
            </div>
          )}

          {/* Quick presets */}
          <p className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-2">Rapido</p>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { label: "30 min", mins: 30 },
              { label: "1 ora", mins: 60 },
              { label: "3 ore", mins: 180 },
              { label: "Domani", mins: 24 * 60 },
              { label: "Tra 3gg", mins: 3 * 24 * 60 },
              { label: "1 sett", mins: 7 * 24 * 60 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setQuickReminder(preset.mins)}
                className="px-2 py-1.5 text-[10px] rounded-md bg-[var(--sb-card)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)] transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom date/time */}
          <p className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-2">Personalizzato</p>
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="flex-1 bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none focus:border-[var(--sb-accent)] transition-colors"
            />
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="w-24 bg-[var(--sb-card)] border border-[var(--sb-border)] rounded-md px-2 py-1.5 text-xs text-[var(--sb-text)] focus:outline-none focus:border-[var(--sb-accent)] transition-colors"
            />
          </div>

          <button
            onClick={setReminderTime}
            disabled={!dateValue || !timeValue || saving}
            className="w-full px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Salvataggio..." : "Imposta promemoria"}
          </button>
        </div>
      )}
    </div>
  );
}
