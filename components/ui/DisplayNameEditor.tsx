"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

export default function DisplayNameEditor({ initialName, email }: { initialName: string; email: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: name.trim() }),
    });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleCancel() {
    setName(initialName);
    setEditing(false);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-[var(--sb-muted)]">Nome visualizzato</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <TextField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            autoFocus
            className="flex-1 bg-[var(--sb-bg)] py-1.5"
            placeholder="Il tuo nome"
          />
          <IconButton
            aria-label="Salva nome"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            variant="default"
            className="h-8 w-8"
          >
            <Check className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            aria-label="Annulla modifica nome"
            onClick={handleCancel}
            variant="ghost"
            className="h-8 w-8"
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--sb-text)]">{name || email.split("@")[0]}</span>
          <IconButton
            aria-label="Modifica nome"
            onClick={() => setEditing(true)}
            variant="ghost"
            className="h-7 w-7"
          >
            <Pencil className="h-3 w-3" />
          </IconButton>
          {saved && <span className="text-xs text-emerald-500">Salvato!</span>}
        </div>
      )}
      <p className="text-xs text-[var(--sb-muted)]">{email}</p>
    </div>
  );
}
