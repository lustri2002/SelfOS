"use client";

import { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface DeletedNote {
  id: string;
  title: string;
  tags: string[];
  deleted_at: string | null;
}

export interface TrashViewProps {
  notes: DeletedNote[];
}

export default function TrashView({ notes: initialNotes }: TrashViewProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [loading, setLoading] = useState(false);

  async function restoreNote(id: string) {
    setLoading(true);
    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted_at: null }),
    });
    if (response.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
    setLoading(false);
  }

  async function permanentlyDelete(id: string) {
    setLoading(true);
    const response = await fetch(`/api/notes/${id}?permanent=true`, { method: "DELETE" });
    if (response.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
    setConfirmDeleteId(null);
    setLoading(false);
  }

  async function emptyTrash() {
    setLoading(true);
    const ids = notes.map((n) => n.id);
    const results = await Promise.all(ids.map((id) => fetch(`/api/notes/${id}?permanent=true`, { method: "DELETE" })));
    if (results.every((response) => response.ok)) {
      setNotes([]);
    }
    setConfirmEmptyTrash(false);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-8 pb-20 md:pb-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--sb-text)]">Cestino</h1>
          {notes.length > 0 && (
            <span className="text-xs text-[var(--sb-muted)] bg-[var(--sb-card)] rounded-full px-2.5 py-0.5">
              {notes.length}
            </span>
          )}
        </div>
        {notes.length > 0 && (
          <button
            onClick={() => setConfirmEmptyTrash(true)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-600/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Svuota cestino
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 mb-6 rounded-lg bg-[var(--sb-card)] border border-[var(--sb-border)] px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-[var(--sb-muted)] shrink-0" />
        <p className="text-xs text-[var(--sb-muted)]">
          Le note eliminate verranno rimosse definitivamente dopo 30 giorni.
        </p>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="flex flex-col flex-1 items-center justify-center text-[var(--sb-muted)] gap-3">
          <Trash2 className="h-10 w-10" />
          <p className="text-sm">Il cestino è vuoto.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group relative flex items-start gap-2 rounded-lg px-2 py-3 hover:bg-[var(--sb-hover)] transition-all"
            >
              <FileText className="h-4 w-4 text-[var(--sb-muted)] shrink-0 mt-0.5" />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--sb-text)] truncate">
                  {note.title || "Senza titolo"}
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[var(--sb-muted)]">
                    Eliminata{" "}
                    {formatDistanceToNow(new Date(note.deleted_at!), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </span>

                  {note.tags.length > 0 && (
                    <div className="flex gap-1">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] text-[var(--sb-muted)] bg-[var(--sb-card)] rounded px-1.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                <button
                  onClick={() => restoreNote(note.id)}
                  disabled={loading}
                  className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-emerald-400 hover:bg-emerald-400/10 transition-all disabled:opacity-50 cursor-pointer"
                  title="Ripristina"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(note.id)}
                  disabled={loading}
                  className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50 cursor-pointer"
                  title="Elimina definitivamente"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm permanent delete dialog */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-[var(--sb-text)]">
                Eliminare definitivamente?
              </h2>
            </div>
            <p className="text-xs text-[var(--sb-muted)] mb-5 leading-relaxed">
              Questa nota verrà eliminata per sempre. L&apos;azione non può essere annullata.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => permanentlyDelete(confirmDeleteId)}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Eliminazione..." : "Elimina definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm empty trash dialog */}
      {confirmEmptyTrash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setConfirmEmptyTrash(false)}
        >
          <div
            className="bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-[var(--sb-text)]">
                Svuotare il cestino?
              </h2>
            </div>
            <p className="text-xs text-[var(--sb-muted)] mb-5 leading-relaxed">
              Tutte le {notes.length} note nel cestino verranno eliminate per sempre.
              L&apos;azione non può essere annullata.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmEmptyTrash(false)}
                className="px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={emptyTrash}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Eliminazione..." : "Svuota cestino"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
