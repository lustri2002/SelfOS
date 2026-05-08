"use client";

import { useDeferredValue, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Search, Tag, Trash2, X, FileText,
  Pin, PinOff, FolderPlus, Folder, ChevronDown, ChevronRight,
  Copy, GripVertical, FolderInput, Upload,
  LayoutTemplate, Sparkles, ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { extractText } from "@/lib/utils/extract-text";
import { createTiptapDoc } from "@/lib/tiptap/document";
import { EmptyState } from "@/components/ui/EmptyState";
import ModalShell from "@/components/ui/ModalShell";
import { getNoteColorClass } from "@/components/notes/NoteColorPicker";
import type { Json } from "@/types/database";

interface Note {
  id: string;
  title: string;
  content?: Json | null;
  tags: string[];
  pinned: boolean;
  updated_at: string;
  created_at: string;
  notebook_id: string | null;
  color: string | null;
  emoji: string | null;
}

interface Notebook {
  id: string;
  name: string;
  area: string | null;
  parent_id: string | null;
}

interface Template {
  id: string;
  name: string;
  content: Json;
  tags: string[];
}

export interface NotesListProps {
  notes: Note[];
  notebooks: Notebook[];
  templates?: Template[];
}

function markdownToTipTap(md: string): object {
  const lines = md.split("\n");
  const content: object[] = [];
  for (const line of lines) {
    if (line.startsWith("### ")) {
      content.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: line.slice(4) }] });
    } else if (line.startsWith("## ")) {
      content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: line.slice(3) }] });
    } else if (line.startsWith("# ")) {
      content.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: line.slice(2) }] });
    } else if (line.startsWith("---") || line.startsWith("***")) {
      content.push({ type: "horizontalRule" });
    } else if (line.startsWith("> ")) {
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: line.slice(2) }] }] });
    } else if (/^- \[[ x]\] /.test(line)) {
      const checked = line[3] === "x";
      const text = line.slice(6);
      content.push({ type: "taskList", content: [{ type: "taskItem", attrs: { checked }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] }] });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      content.push({ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: line.slice(2) }] }] }] });
    } else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\.\s/, "");
      content.push({ type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }] });
    } else if (line.trim() === "") {
      content.push({ type: "paragraph" });
    } else {
      content.push({ type: "paragraph", content: [{ type: "text", text: line }] });
    }
  }
  return { type: "doc", content };
}

/* ── Highlight helper ──────────────────────────────────────── */

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function NotesList({ notes: initialNotes, notebooks: initialNotebooks, templates: initialTemplates = [] }: NotesListProps) {
  const router = useRouter();
  const supabase = createClient();

  const [notes, setNotes] = useState(initialNotes);
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Template dialog
  const [templateNote, setTemplateNote] = useState<Note | null>(null);
  const [templateName, setTemplateName] = useState("");

  // Notebook management
  const [showNewNotebook, setShowNewNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [showNotebooks, setShowNotebooks] = useState(true);

  // Drag & drop
  const dragNoteId = useRef<string | null>(null);
  const [dragOverNotebook, setDragOverNotebook] = useState<string | null>(null);

  // Move to notebook picker
  const [movePickerNoteId, setMovePickerNoteId] = useState<string | null>(null);

  // Markdown import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);

  // Sorting
  type SortMode = "updated" | "created" | "title" | "size";
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Nested notebooks expand state
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());

  const deferredSearch = useDeferredValue(search);
  const noteTextCache = useMemo(() => {
    const cache = new Map<string, string>();
    for (const note of notes) {
      cache.set(note.id, note.content ? extractText(note.content).toLowerCase() : "");
    }
    return cache;
  }, [notes]);

  const allTags = useMemo(() => Array.from(new Set(notes.flatMap((n) => n.tags))), [notes]);

  // Separate pinned for quick access
  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  const sorted = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const filtered = notes.filter((note) => {
      const matchSearch =
        !q ||
        note.title.toLowerCase().includes(q) ||
        note.tags.some((t) => t.toLowerCase().includes(q)) ||
        (noteTextCache.get(note.id) ?? "").includes(q);
      const matchTag = !activeTag || note.tags.includes(activeTag);
      const matchNotebook = activeNotebook === null || note.notebook_id === activeNotebook;
      return matchSearch && matchTag && matchNotebook;
    });

    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      switch (sortMode) {
        case "title":
          return (a.title || "").localeCompare(b.title || "", "it");
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "size":
          return (noteTextCache.get(b.id)?.length ?? 0) - (noteTextCache.get(a.id)?.length ?? 0);
        case "updated":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [activeNotebook, activeTag, deferredSearch, noteTextCache, notes, sortMode]);

  async function createNoteOnServer(input: { title?: string; content?: Json; tags?: string[]; notebook_id?: string | null }) {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as { note?: Note; error?: string };

    if (!response.ok || !result.note) {
      throw new Error(result.error || "Create note failed");
    }

    return result.note;
  }

  async function createNote(templateContent?: Json, templateTags?: string[]) {
    setCreating(true);
    try {
      const note = await createNoteOnServer({
        title: "Nuova nota",
        content: templateContent ?? createTiptapDoc(),
        tags: templateTags ?? [],
        notebook_id: activeNotebook || null,
      });
      router.push(`/notes/${note.id}`);
      setShowTemplates(false);
    } catch {
      toast.error("Non sono riuscito a creare la nota");
    } finally {
      setCreating(false);
    }
  }

  async function getNoteContent(note: Note) {
    if (note.content) return note.content;
    const { data } = await supabase
      .from("notes")
      .select("content")
      .eq("id", note.id)
      .single();
    return data?.content ?? createTiptapDoc();
  }

  async function duplicateNote(note: Note) {
    const content = await getNoteContent(note);
    try {
      const data = await createNoteOnServer({
        title: `${note.title} (copia)`,
        content,
        tags: note.tags,
        notebook_id: note.notebook_id,
      });
      setNotes((prev) => [data, ...prev]);
    } catch {
      toast.error("Non sono riuscito a duplicare la nota");
    }
  }

  // Soft delete
  async function deleteNote(id: string) {
    setDeleting(true);
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDeleteId(null);
      router.refresh();
    } catch {
      toast.error("Non sono riuscito a spostare la nota nel cestino");
    } finally {
      setDeleting(false);
    }
  }

  async function togglePin(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const newPinned = !note.pinned;
    const response = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: newPinned }),
    });
    if (!response.ok) {
      toast.error("Non sono riuscito ad aggiornare il pin");
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: newPinned } : n)));
  }

  async function moveNoteToNotebook(noteId: string, notebookId: string | null) {
    const response = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebook_id: notebookId }),
    });
    if (!response.ok) {
      toast.error("Non sono riuscito a spostare la nota");
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, notebook_id: notebookId } : n)));
    setMovePickerNoteId(null);
  }

  // State for creating sub-notebook
  const [newSubNotebookParent, setNewSubNotebookParent] = useState<string | null>(null);
  const [newSubNotebookName, setNewSubNotebookName] = useState("");

  async function createNotebook(parentId?: string | null) {
    const name = parentId ? newSubNotebookName.trim() : newNotebookName.trim();
    if (!name) return;
    const response = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId || null }),
    });
    const result = (await response.json()) as { notebook?: Notebook; error?: string };
    if (!response.ok || !result.notebook) {
      toast.error(result.error || "Non sono riuscito a creare il notebook");
      return;
    }
      setNotebooks((prev) => [...prev, result.notebook!]);
      if (parentId) {
        setNewSubNotebookParent(null);
        setNewSubNotebookName("");
      } else {
        setNewNotebookName("");
        setShowNewNotebook(false);
      }
  }

  async function deleteNotebook(id: string) {
    try {
      const response = await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      setNotebooks((prev) => prev.map((nb) => (nb.parent_id === id ? { ...nb, parent_id: null } : nb)).filter((nb) => nb.id !== id));
      setNotes((prev) => prev.map((n) => (n.notebook_id === id ? { ...n, notebook_id: null } : n)));
      if (activeNotebook === id) setActiveNotebook(null);
      router.refresh();
    } catch {
      toast.error("Non sono riuscito a eliminare il notebook");
    }
  }

  async function importMarkdown(files: FileList) {
    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".md")) continue;
      const text = await file.text();
      const title = file.name.replace(/\.md$/, "");
      const content = markdownToTipTap(text);
      try {
        const data = await createNoteOnServer({ title, content: content as Json, tags: [], notebook_id: activeNotebook || null });
        setNotes((prev) => [data, ...prev]);
      } catch {
        toast.error(`Non sono riuscito a importare ${file.name}`);
      }
    }
  }

  // Save current note as template
  async function confirmSaveTemplate() {
    if (!templateNote || !templateName.trim()) return;
    const content = await getNoteContent(templateNote);
    const response = await fetch("/api/note-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName.trim(), content, tags: templateNote.tags }),
    });
    const result = (await response.json()) as { template?: Template; error?: string };
    if (!response.ok || !result.template) {
      toast.error(result.error || "Non sono riuscito a salvare il template");
      return;
    }
    setTemplates((prev) => [...prev, result.template!]);
    setTemplateNote(null);
    setTemplateName("");
  }

  // Drag handlers
  function handleDragStart(noteId: string) { dragNoteId.current = noteId; }
  function handleDragEnd() { dragNoteId.current = null; setDragOverNotebook(null); }
  function handleDropOnNotebook(notebookId: string | null) {
    if (dragNoteId.current) moveNoteToNotebook(dragNoteId.current, notebookId);
    setDragOverNotebook(null);
  }

  return (
    <div className="sb-page flex h-full max-w-5xl flex-col">
      {/* Header */}
      <div className="sb-hero sb-module-notes mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-4xl">Note</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--sb-muted)]">
            {notes.length} idee archiviate, {pinnedNotes.length} fissate in alto, {allTags.length} tag attivi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".md" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) importMarkdown(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileInputRef.current?.click()} className="sb-focus sb-row flex min-h-10 cursor-pointer items-center gap-2 border border-[var(--sb-border)] bg-[var(--sb-surface)] px-3 py-2 text-sm text-[var(--sb-muted)] transition-all hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]" title="Importa file .md">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importa</span>
          </button>
          {/* Templates dropdown */}
          <div className="relative">
            <button onClick={() => setShowTemplates(!showTemplates)} className="sb-focus sb-row flex min-h-10 cursor-pointer items-center gap-2 border border-[var(--sb-border)] bg-[var(--sb-surface)] px-3 py-2 text-sm text-[var(--sb-muted)] transition-all hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]" title="Template">
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">Template</span>
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-2 z-30 min-w-[200px]">
                <p className="px-3 py-1.5 text-[10px] text-[var(--sb-muted)] uppercase font-semibold">Crea da template</p>
                {templates.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--sb-muted)]">Nessun template. Salva una nota come template dalle azioni.</p>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => createNote(t.content, t.tags)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--sb-text)] hover:bg-[var(--sb-hover)] rounded-lg transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button onClick={() => createNote()} disabled={creating} className="sb-focus sb-row flex min-h-10 cursor-pointer items-center gap-2 border border-violet-400/40 bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow-[var(--sb-shadow-sm)] transition-all hover:bg-violet-400 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {creating ? "Creazione..." : "Nuova nota"}
          </button>
        </div>
      </div>

      {/* Quick Access (pinned) */}
      {pinnedNotes.length > 0 && !search && !activeTag && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-[var(--sb-muted)] uppercase mb-2 flex items-center gap-1.5">
            <Pin className="h-3 w-3 text-indigo-400" />
            Accesso rapido
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {pinnedNotes.slice(0, 4).map((note) => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                prefetch={false}
                className="group sb-panel cursor-pointer p-3 text-left transition-all hover:border-indigo-500/20 hover:bg-[var(--sb-hover)]"
              >
                <p className="text-sm text-[var(--sb-text)] font-medium truncate group-hover:text-indigo-400 transition-colors">
                  {note.title || "Senza titolo"}
                </p>
                <p className="text-[10px] text-[var(--sb-muted)] mt-1 line-clamp-1">
                  {note.content ? extractText(note.content, 60) : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Search + Sort */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--sb-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per titolo o contenuto... (⌘K)"
            className="sb-focus w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--sb-text)] placeholder-[var(--sb-muted)] transition-all focus:border-[var(--sb-accent)]"
          />
        </div>
        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="sb-focus flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] text-[var(--sb-muted)] transition-all hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
            title="Ordina"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-2 z-30 min-w-[180px]">
              <p className="px-3 py-1.5 text-[10px] text-[var(--sb-muted)] uppercase font-semibold">Ordina per</p>
              {([
                { key: "updated" as SortMode, label: "Ultima modifica" },
                { key: "created" as SortMode, label: "Data creazione" },
                { key: "title" as SortMode, label: "Titolo (A-Z)" },
                { key: "size" as SortMode, label: "Dimensione" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setSortMode(opt.key); setShowSortMenu(false); }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer",
                    sortMode === opt.key
                      ? "bg-[var(--sb-hover)] text-[var(--sb-text)] font-medium"
                      : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
                  )}
                >
                  {opt.label}
                  {sortMode === opt.key && <span className="ml-auto text-indigo-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notebooks */}
      <div className="mb-4">
        <button onClick={() => setShowNotebooks(!showNotebooks)} className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer mb-2">
          <ChevronDown className={cn("h-3 w-3 transition-transform", !showNotebooks && "-rotate-90")} />
          Notebook
        </button>
        {showNotebooks && (
          <div className="flex flex-col gap-1 mb-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveNotebook(null)}
                onDragOver={(e) => { e.preventDefault(); setDragOverNotebook("__all__"); }}
                onDragLeave={() => setDragOverNotebook(null)}
                onDrop={() => handleDropOnNotebook(null)}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer", dragOverNotebook === "__all__" && "ring-1 ring-indigo-400", activeNotebook === null ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "bg-[var(--sb-card)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
              >
                Tutte
              </button>
              {/* Render root notebooks */}
              {notebooks.filter((nb) => !nb.parent_id).map((nb) => {
                const children = notebooks.filter((c) => c.parent_id === nb.id);
                const isExpanded = expandedNotebooks.has(nb.id);
                return (
                  <div key={nb.id} className="group/nb relative" onDragOver={(e) => { e.preventDefault(); setDragOverNotebook(nb.id); }} onDragLeave={() => setDragOverNotebook(null)} onDrop={() => handleDropOnNotebook(nb.id)}>
                    <div className="flex items-center gap-0.5">
                      {children.length > 0 && (
                        <button
                          onClick={() => {
                            const next = new Set(expandedNotebooks);
                            if (isExpanded) {
                              next.delete(nb.id);
                            } else {
                              next.add(nb.id);
                            }
                            setExpandedNotebooks(next);
                          }}
                          className="p-0.5 text-[var(--sb-muted)] hover:text-[var(--sb-text)] cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => setActiveNotebook(activeNotebook === nb.id ? null : nb.id)}
                        className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer", dragOverNotebook === nb.id && "ring-1 ring-indigo-400 bg-indigo-500/10", activeNotebook === nb.id ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-[var(--sb-card)] text-[var(--sb-muted)] border border-transparent hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                      >
                        <Folder className="h-3 w-3" />
                        {nb.name}
                        {children.length > 0 && <span className="text-[10px] text-[var(--sb-muted)]">({children.length})</span>}
                      </button>
                    </div>
                    <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover/nb:opacity-100 transition-all">
                      <button onClick={() => { setNewSubNotebookParent(nb.id); setNewSubNotebookName(""); }} className="p-0.5 rounded-full bg-[var(--sb-surface)] text-[var(--sb-muted)] hover:text-indigo-400 cursor-pointer" title="Aggiungi sotto-notebook">
                        <FolderPlus className="h-2.5 w-2.5" />
                      </button>
                      <button onClick={() => deleteNotebook(nb.id)} className="p-0.5 rounded-full bg-[var(--sb-surface)] text-[var(--sb-muted)] hover:text-red-400 cursor-pointer">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    {/* Children */}
                    {isExpanded && children.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-4 mt-1">
                        {children.map((child) => (
                          <div key={child.id} className="group/child relative" onDragOver={(e) => { e.preventDefault(); setDragOverNotebook(child.id); }} onDragLeave={() => setDragOverNotebook(null)} onDrop={() => handleDropOnNotebook(child.id)}>
                            <button
                              onClick={() => setActiveNotebook(activeNotebook === child.id ? null : child.id)}
                              className={cn("flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] transition-all cursor-pointer", dragOverNotebook === child.id && "ring-1 ring-indigo-400 bg-indigo-500/10", activeNotebook === child.id ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-[var(--sb-card)] text-[var(--sb-muted)] border border-transparent hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                            >
                              <Folder className="h-2.5 w-2.5" />
                              {child.name}
                            </button>
                            <button onClick={() => deleteNotebook(child.id)} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-[var(--sb-surface)] text-[var(--sb-muted)] hover:text-red-400 opacity-0 group-hover/child:opacity-100 transition-all cursor-pointer">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* New sub-notebook inline form */}
                    {newSubNotebookParent === nb.id && (
                      <div className="flex items-center gap-1 ml-4 mt-1">
                        <input type="text" value={newSubNotebookName} onChange={(e) => setNewSubNotebookName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createNotebook(nb.id); if (e.key === "Escape") setNewSubNotebookParent(null); }} placeholder="Sotto-notebook..." autoFocus className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-card)] px-2 py-0.5 text-[11px] text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none w-28" />
                        <button onClick={() => createNotebook(nb.id)} className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer">OK</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {showNewNotebook ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={newNotebookName} onChange={(e) => setNewNotebookName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createNotebook(); if (e.key === "Escape") setShowNewNotebook(false); }} placeholder="Nome..." autoFocus className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-card)] px-2 py-1 text-xs text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none w-24" />
                  <button onClick={() => createNotebook()} className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer">OK</button>
                </div>
              ) : (
                <button onClick={() => setShowNewNotebook(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer">
                  <FolderPlus className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allTags.map((tag) => (
            <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-all cursor-pointer", activeTag === tag ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-[var(--sb-card)] text-[var(--sb-muted)] border border-transparent hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}>
              <Tag className="h-3 w-3" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Notes list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title={search || activeTag || activeNotebook ? "Nessuna nota trovata." : "Nessuna nota ancora. Creane una!"}
          className="flex-1"
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          {sorted.map((note) => {
            const notebook = notebooks.find((nb) => nb.id === note.notebook_id);
            const parentNotebook = notebook?.parent_id ? notebooks.find((nb) => nb.id === notebook.parent_id) : null;
            const notebookLabel = parentNotebook ? `${parentNotebook.name} › ${notebook?.name}` : notebook?.name;
            const preview = note.content ? extractText(note.content, 120) : "";
            return (
              <Link key={note.id} href={`/notes/${note.id}`} prefetch={false} draggable onDragStart={() => handleDragStart(note.id)} onDragEnd={handleDragEnd} className={cn("group relative flex items-start gap-2 rounded-lg px-2 py-3 hover:bg-[var(--sb-hover)] transition-all cursor-pointer border-l-[3px]", getNoteColorClass(note.color))}>
                <div className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-[var(--sb-muted)]">
                  <GripVertical className="h-4 w-4" />
                </div>
                {note.emoji ? (
                  <span className="text-base shrink-0 mt-0.5">{note.emoji}</span>
                ) : note.pinned ? (
                  <Pin className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                ) : (
                  <FileText className="h-4 w-4 text-[var(--sb-muted)] shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--sb-text)] truncate">
                    {highlightMatch(note.title || "Senza titolo", search)}
                  </p>
                  {preview && (
                    <p className="text-xs text-[var(--sb-muted)] mt-0.5 line-clamp-1">
                      {highlightMatch(preview, search)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {notebook && (
                      <span className="text-[10px] text-[var(--sb-muted)] flex items-center gap-0.5">
                        <Folder className="h-2.5 w-2.5" />{notebookLabel}
                      </span>
                    )}
                    {note.tags.length > 0 && (
                      <div className="flex gap-1">
                        {note.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-[var(--sb-muted)] bg-[var(--sb-card)] rounded px-1.5 py-0.5">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[var(--sb-muted)] shrink-0 hidden sm:block mt-0.5">
                  {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: it })}
                </span>
                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(note.id); }} className={cn("p-1.5 rounded-md transition-all cursor-pointer", note.pinned ? "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]")} title={note.pinned ? "Rimuovi pin" : "Fissa in alto"}>
                    {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMovePickerNoteId(note.id); }} className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer" title="Sposta in notebook">
                    <FolderInput className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); duplicateNote(note); }} className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer" title="Duplica nota">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTemplateNote(note); setTemplateName(note.title || ""); }} className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer" title="Salva come template">
                    <LayoutTemplate className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(note.id); }} className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer" title="Cestino">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Move to notebook picker */}
      {movePickerNoteId && (
        <ModalShell title="Sposta in notebook" onClose={() => setMovePickerNoteId(null)} className="max-w-xs">
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              <button onClick={() => moveNoteToNotebook(movePickerNoteId, null)} className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors cursor-pointer", notes.find((n) => n.id === movePickerNoteId)?.notebook_id === null ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}>
                Nessun notebook
              </button>
              {notebooks.filter((nb) => !nb.parent_id).map((nb) => {
                const children = notebooks.filter((c) => c.parent_id === nb.id);
                return (
                  <div key={nb.id}>
                    <button onClick={() => moveNoteToNotebook(movePickerNoteId, nb.id)} className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-2", notes.find((n) => n.id === movePickerNoteId)?.notebook_id === nb.id ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}>
                      <Folder className="h-3 w-3" />{nb.name}
                    </button>
                    {children.map((child) => (
                      <button key={child.id} onClick={() => moveNoteToNotebook(movePickerNoteId, child.id)} className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-2 pl-8", notes.find((n) => n.id === movePickerNoteId)?.notebook_id === child.id ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}>
                        <Folder className="h-2.5 w-2.5" />{child.name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setMovePickerNoteId(null)} className="mt-3 w-full px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-muted)] hover:bg-[var(--sb-border)] hover:text-[var(--sb-text)] transition-colors cursor-pointer">
              Annulla
            </button>
        </ModalShell>
      )}

      {/* Delete dialog (soft delete) */}
      {confirmDeleteId && (
        <ModalShell title="Spostare nel cestino?" onClose={() => setConfirmDeleteId(null)} className="max-w-sm">
            <p className="text-xs text-[var(--sb-muted)] mb-5 leading-relaxed">
              La nota verrà spostata nel cestino. Potrai ripristinarla entro 30 giorni.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer">
                Annulla
              </button>
              <button onClick={() => deleteNote(confirmDeleteId)} disabled={deleting} className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer">
                {deleting ? "Spostamento..." : "Sposta nel cestino"}
              </button>
            </div>
        </ModalShell>
      )}

      {/* Template name dialog */}
      {templateNote && (
        <ModalShell title="Salva come template" onClose={() => { setTemplateNote(null); setTemplateName(""); }} className="max-w-sm">
            <p className="text-xs text-[var(--sb-muted)] mb-4 leading-relaxed">
              Il contenuto e i tag della nota verranno salvati come template riutilizzabile.
            </p>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmSaveTemplate(); if (e.key === "Escape") { setTemplateNote(null); setTemplateName(""); } }}
              placeholder="Nome del template"
              autoFocus
              className="w-full bg-[var(--sb-bg)] border border-[var(--sb-border)] rounded-lg px-3 py-2 text-sm text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none focus:border-[var(--sb-accent)] transition-colors mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setTemplateNote(null); setTemplateName(""); }} className="px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer">
                Annulla
              </button>
              <button onClick={confirmSaveTemplate} disabled={!templateName.trim()} className="px-3 py-1.5 text-xs rounded-md bg-[var(--sb-accent)] text-white hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer">
                Salva template
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  );
}
