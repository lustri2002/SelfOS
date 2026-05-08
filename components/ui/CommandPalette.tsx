"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Plus,
  Home,
  TrendingUp,
  Settings,
  Trash2,
  ArrowRight,
  Inbox,
  CheckSquare,
  Target,
  Activity,
  GraduationCap,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { createTiptapDoc } from "@/lib/tiptap/document";
import { getEnabledModules, isModuleEnabled, type AppModuleId } from "@/config/modules";

interface NoteResult {
  id: string;
  title: string;
}

interface StaticAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  group: "azioni";
}

const staticActions: StaticAction[] = [
  {
    id: "inbox",
    label: "Inbox universale",
    icon: <Inbox size={18} />,
    href: "__open_inbox__",
    group: "azioni",
  },
  {
    id: "home",
    label: "Home",
    icon: <Home size={18} />,
    href: "/home",
    group: "azioni",
  },
  {
    id: "impostazioni",
    label: "Impostazioni",
    icon: <Settings size={18} />,
    href: "/settings",
    group: "azioni",
  },
  {
    id: "cestino",
    label: "Cestino",
    icon: <Trash2 size={18} />,
    href: "/trash",
    group: "azioni",
  },
];

const moduleActionIcons = {
  notes: <FileText size={18} />,
  tasks: <CheckSquare size={18} />,
  goals: <Target size={18} />,
  finance: <TrendingUp size={18} />,
  fitness: <Activity size={18} />,
  education: <GraduationCap size={18} />,
  automation: <Zap size={18} />,
} satisfies Record<AppModuleId, React.ReactNode>;

const moduleActions: StaticAction[] = getEnabledModules().map((module) => ({
  id: module.id,
  label: module.label,
  icon: moduleActionIcons[module.id],
  href: module.href,
  group: "azioni",
}));

const noteActions: StaticAction[] = isModuleEnabled("notes")
  ? [
      {
        id: "new-note",
        label: "Nuova nota",
        icon: <Plus size={18} />,
        href: "__create_note__",
        group: "azioni",
      },
    ]
  : [];

const actions = [staticActions[0], ...noteActions, staticActions[1], ...moduleActions, ...staticActions.slice(2)];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [noteResults, setNoteResults] = useState<NoteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // All visible items: notes first, then static actions
  const filteredActions = query.trim()
    ? actions.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase())
      )
    : actions;

  const allItems: Array<
    | { type: "note"; data: NoteResult }
    | { type: "action"; data: StaticAction }
  > = [
    ...noteResults.map((n) => ({ type: "note" as const, data: n })),
    ...filteredActions.map((a) => ({ type: "action" as const, data: a })),
  ];

  // Search notes with debounce
  const searchNotes = useCallback(
    async (searchQuery: string) => {
      if (!isModuleEnabled("notes") || !searchQuery.trim()) {
        abortRef.current?.abort();
        setNoteResults([]);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;
      setLoading(true);
      try {
        const { data } = await supabase
          .from("notes")
          .select("id, title")
          .is("deleted_at", null)
          .ilike("title", `%${searchQuery}%`)
          .limit(8)
          .abortSignal(abortController.signal);

        if (abortController.signal.aborted) return;
        setNoteResults(data ?? []);
      } catch {
        if (abortController.signal.aborted) return;
        setNoteResults([]);
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    },
    [supabase]
  );

  // Handle query changes with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      searchNotes(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [query, searchNotes]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems.length]);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery("");
            setNoteResults([]);
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function close() {
    setOpen(false);
    setQuery("");
    setNoteResults([]);
  }

  async function selectItem(index: number) {
    const item = allItems[index];
    if (!item) return;

    if (item.type === "note") {
      router.push(`/notes/${item.data.id}`);
    } else if (item.data.href === "__open_inbox__") {
      window.dispatchEvent(new Event("sb:open-inbox"));
    } else if (item.data.href === "__create_note__") {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nuova nota", content: createTiptapDoc(), tags: [] }),
      });
      const result = (await response.json()) as { note?: { id: string } };
      if (response.ok && result.note) router.push(`/notes/${result.note.id}`);
    } else {
      router.push(item.data.href);
    }
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : allItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        selectItem(selectedIndex);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(5rem+env(safe-area-inset-top,0px))] md:pt-[18vh]"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.38)", backdropFilter: "blur(10px)" }}
      onClick={close}
    >
      <div
        className="sb-mobile-modal w-full max-w-lg overflow-hidden rounded-lg border shadow-[var(--sb-shadow-lg)]"
        style={{
          backgroundColor: "var(--sb-surface)",
          borderColor: "var(--sb-border)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--sb-border)" }}
        >
          <Search
            size={20}
            className="shrink-0"
            style={{ color: "var(--sb-muted)" }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cerca note, azioni..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-50 md:text-sm"
            style={{
              color: "var(--sb-text)",
            }}
          />
          <kbd
              className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:inline-block"
            style={{
              backgroundColor: "var(--sb-bg)",
              color: "var(--sb-muted)",
              border: "1px solid var(--sb-border)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-72 overflow-y-auto overscroll-contain p-2"
          role="listbox"
        >
          {loading && (
            <div
              className="px-3 py-2 text-xs"
              style={{ color: "var(--sb-muted)" }}
            >
              Ricerca in corso...
            </div>
          )}

          {/* Note results */}
          {noteResults.length > 0 && (
            <div>
              <div
                className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase"
                style={{ color: "var(--sb-muted)" }}
              >
                Note
              </div>
              {noteResults.map((note, i) => {
                const globalIndex = i;
                return (
                  <button
                    key={note.id}
                    data-selected={selectedIndex === globalIndex}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
                    )}
                    style={{
                      color: "var(--sb-text)",
                      backgroundColor:
                        selectedIndex === globalIndex
                          ? "var(--sb-hover)"
                          : "transparent",
                    }}
                    onClick={() => selectItem(globalIndex)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    role="option"
                    aria-selected={selectedIndex === globalIndex}
                  >
                    <FileText
                      size={16}
                      className="shrink-0"
                      style={{ color: "var(--sb-accent)" }}
                    />
                    <span className="truncate">{note.title}</span>
                    <ArrowRight
                      size={14}
                      className="ml-auto shrink-0 opacity-0 transition-opacity"
                      style={{
                        color: "var(--sb-muted)",
                        opacity: selectedIndex === globalIndex ? 1 : 0,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Static actions */}
          {filteredActions.length > 0 && (
            <div>
              <div
                className={cn(
                  "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase",
                  noteResults.length > 0 && "mt-1 border-t pt-3"
                )}
                style={{
                  color: "var(--sb-muted)",
                  borderColor: "var(--sb-border)",
                }}
              >
                Azioni
              </div>
              {filteredActions.map((action, i) => {
                const globalIndex = noteResults.length + i;
                return (
                  <button
                    key={action.id}
                    data-selected={selectedIndex === globalIndex}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
                    )}
                    style={{
                      color: "var(--sb-text)",
                      backgroundColor:
                        selectedIndex === globalIndex
                          ? "var(--sb-hover)"
                          : "transparent",
                    }}
                    onClick={() => selectItem(globalIndex)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    role="option"
                    aria-selected={selectedIndex === globalIndex}
                  >
                    <span
                      className="shrink-0"
                      style={{ color: "var(--sb-accent)" }}
                    >
                      {action.icon}
                    </span>
                    <span className="truncate">{action.label}</span>
                    <ArrowRight
                      size={14}
                      className="ml-auto shrink-0 transition-opacity"
                      style={{
                        color: "var(--sb-muted)",
                        opacity: selectedIndex === globalIndex ? 1 : 0,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && allItems.length === 0 && query.trim() && (
            <div
              className="px-3 py-6 text-center text-sm"
              style={{ color: "var(--sb-muted)" }}
            >
              Nessun risultato per &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
