"use client";

import { useState } from "react";
import { Palette, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const COLORS = [
  { name: "Nessuno", value: null, bg: "bg-transparent", ring: "ring-[var(--sb-border)]" },
  { name: "Rosso", value: "red", bg: "bg-red-500", ring: "ring-red-500" },
  { name: "Arancio", value: "orange", bg: "bg-orange-500", ring: "ring-orange-500" },
  { name: "Ambra", value: "amber", bg: "bg-amber-500", ring: "ring-amber-500" },
  { name: "Verde", value: "green", bg: "bg-emerald-500", ring: "ring-emerald-500" },
  { name: "Blu", value: "blue", bg: "bg-blue-500", ring: "ring-blue-500" },
  { name: "Indigo", value: "indigo", bg: "bg-indigo-500", ring: "ring-indigo-500" },
  { name: "Viola", value: "purple", bg: "bg-purple-500", ring: "ring-purple-500" },
  { name: "Rosa", value: "pink", bg: "bg-pink-500", ring: "ring-pink-500" },
];

const EMOJIS = ["📝", "💡", "🔥", "⭐", "🎯", "📌", "🚀", "💼", "🎨", "📚", "🧠", "💭", "✅", "❤️", "🏠", "🎵"];

interface Props {
  color: string | null;
  emoji: string | null;
  onChange: (color: string | null, emoji: string | null) => void;
}

export default function NoteColorPicker({ color, emoji, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const currentColor = COLORS.find((c) => c.value === color);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-all cursor-pointer",
          "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
        )}
        title="Colore e icona"
      >
        {emoji ? (
          <span className="text-sm">{emoji}</span>
        ) : (
          <Palette className="h-3 w-3" />
        )}
        {color && (
          <span className={cn("w-2 h-2 rounded-full", currentColor?.bg)} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--sb-text)]">Personalizza</h3>
            <button onClick={() => setOpen(false)} className="p-1 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Colors */}
          <p className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-2">Colore</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => { onChange(c.value, emoji); }}
                className={cn(
                  "w-6 h-6 rounded-full transition-all cursor-pointer",
                  c.value === null ? "border-2 border-dashed border-[var(--sb-border)]" : c.bg,
                  color === c.value && "ring-2 ring-offset-2 ring-offset-[var(--sb-surface)]",
                  color === c.value && c.ring
                )}
                title={c.name}
              />
            ))}
          </div>

          {/* Emojis */}
          <p className="text-[10px] text-[var(--sb-muted)] uppercase font-semibold mb-2">Icona</p>
          <div className="grid grid-cols-8 gap-1">
            <button
              onClick={() => { onChange(color, null); }}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all cursor-pointer",
                emoji === null
                  ? "bg-[var(--sb-hover)] text-[var(--sb-text)]"
                  : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]",
                "border border-dashed border-[var(--sb-border)]"
              )}
              title="Nessuna icona"
            >
              ✕
            </button>
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { onChange(color, e); }}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all cursor-pointer hover:bg-[var(--sb-hover)]",
                  emoji === e && "bg-[var(--sb-hover)] ring-1 ring-[var(--sb-accent)]"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper: color class for note list border ── */
export function getNoteColorClass(color: string | null): string {
  switch (color) {
    case "red": return "border-l-red-500";
    case "orange": return "border-l-orange-500";
    case "amber": return "border-l-amber-500";
    case "green": return "border-l-emerald-500";
    case "blue": return "border-l-blue-500";
    case "indigo": return "border-l-indigo-500";
    case "purple": return "border-l-purple-500";
    case "pink": return "border-l-pink-500";
    default: return "border-l-transparent";
  }
}
