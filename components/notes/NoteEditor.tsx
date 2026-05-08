"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import {
  useEditor,
  useEditorState,
  EditorContent,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { ImageBlock } from "@/lib/tiptap/image-block";
import NoteLink from "@/lib/tiptap/note-link";
import { SmartBlock, type SmartBlockKind } from "@/lib/tiptap/smart-block";
import {
  ArrowLeft, Trash2, X,
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Undo2, Redo2,
  Folder, ChevronDown, Share2, History, Link2 as Link2Icon, Unlink, Clock,
  Table as TableIcon, ImagePlus, Download, FileDown, FileText,
  PanelRight, Maximize2, Minimize2, Search, Type, CornerDownLeft,
  Sparkles, Brain, Lightbulb, Scale, HelpCircle, AlertTriangle, Target,
  CalendarDays, BookOpen, ClipboardCheck, Bell, Wand2,
} from "lucide-react";
import PomodoroTimer from "@/components/notes/PomodoroTimer";
import ReminderButton from "@/components/notes/ReminderButton";
import NoteColorPicker from "@/components/notes/NoteColorPicker";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { createTiptapDoc, isTiptapDoc } from "@/lib/tiptap/document";
import { toast } from "sonner";
import type { Database, Json } from "@/types/database";

type Note = Database["public"]["Tables"]["notes"]["Row"];
type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];

interface NoteLinkRef {
  id: string;
  title: string;
}

interface HeadingRef {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface LinkSuggestionState {
  query: string;
  from: number;
  to: number;
  activeIndex: number;
}

interface SlashMenuState {
  query: string;
  from: number;
  to: number;
  activeIndex: number;
}

interface SmartBlockDefinition {
  kind: SmartBlockKind;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

interface ContextAction {
  id: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
}

/* ── Toolbar Button ────────────────────────────────────────── */

function ToolbarButton({
  onClick,
  active,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded transition-all duration-150 cursor-pointer",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "bg-[var(--sb-hover)] text-[var(--sb-text)] shadow-sm"
          : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-[var(--sb-border)] mx-1" />;
}

function safeFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return normalized || "nota";
}

function getHeadings(editor: Editor | null): HeadingRef[] {
  if (!editor) return [];
  const headings: HeadingRef[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (!text) return;
    headings.push({
      id: `${pos}-${text}`,
      level: Number(node.attrs.level) || 1,
      text,
      pos,
    });
  });
  return headings;
}

function getSelectedText(editor: Editor | null) {
  if (!editor) return "";
  const { from, to, empty } = editor.state.selection;
  if (empty) return "";
  return editor.state.doc.textBetween(from, to, "\n").trim();
}

const SMART_BLOCKS: SmartBlockDefinition[] = [
  { kind: "idea", label: "Idea", hint: "Intuizione da sviluppare", icon: Lightbulb },
  { kind: "decision", label: "Decisione", hint: "Scelta presa o da validare", icon: Scale },
  { kind: "action", label: "Azione", hint: "Prossimo passo operativo", icon: ClipboardCheck },
  { kind: "question", label: "Domanda", hint: "Nodo aperto da chiarire", icon: HelpCircle },
  { kind: "risk", label: "Rischio", hint: "Problema o attenzione", icon: AlertTriangle },
  { kind: "goal", label: "Obiettivo", hint: "Risultato desiderato", icon: Target },
  { kind: "meeting", label: "Meeting", hint: "Appunti e follow-up", icon: CalendarDays },
  { kind: "resource", label: "Risorsa", hint: "Link, fonte o materiale", icon: BookOpen },
];

const SMART_BLOCK_BY_KIND = Object.fromEntries(
  SMART_BLOCKS.map((block) => [block.kind, block])
) as Record<SmartBlockKind, SmartBlockDefinition>;

/* ── Editor Toolbar ────────────────────────────────────────── */

function EditorToolbar({
  editor,
  onInsertImage,
  compact,
}: {
  editor: Editor;
  onInsertImage: () => void;
  compact?: boolean;
}) {
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive("bold"),
      isItalic: ctx.editor.isActive("italic"),
      isStrike: ctx.editor.isActive("strike"),
      isCode: ctx.editor.isActive("code"),
      isH1: ctx.editor.isActive("heading", { level: 1 }),
      isH2: ctx.editor.isActive("heading", { level: 2 }),
      isH3: ctx.editor.isActive("heading", { level: 3 }),
      isBulletList: ctx.editor.isActive("bulletList"),
      isOrderedList: ctx.editor.isActive("orderedList"),
      isTaskList: ctx.editor.isActive("taskList"),
      isBlockquote: ctx.editor.isActive("blockquote"),
      canUndo: ctx.editor.can().undo(),
      canRedo: ctx.editor.can().redo(),
    }),
  });

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-[var(--sb-border)] bg-[var(--sb-surface)] sticky top-[53px] z-10 backdrop-blur-sm overflow-x-auto">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} title="Annulla (⌘Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} title="Ripeti (⌘⇧Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => { const c = editor.chain().focus(); if (state.isCode) c.unsetCode(); c.toggleBold().run(); }} active={state.isBold} title="Grassetto (⌘B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => { const c = editor.chain().focus(); if (state.isCode) c.unsetCode(); c.toggleItalic().run(); }} active={state.isItalic} title="Corsivo (⌘I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={state.isTaskList} title="Checklist">
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={onInsertImage} title="Inserisci immagine">
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-4 py-1.5 border-b border-[var(--sb-border)] bg-[var(--sb-surface)] sticky top-[53px] z-10 backdrop-blur-sm">
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} title="Annulla (⌘Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} title="Ripeti (⌘⇧Z)">
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => { const c = editor.chain().focus(); if (state.isCode) c.unsetCode(); c.toggleBold().run(); }}
        active={state.isBold} title="Grassetto (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => { const c = editor.chain().focus(); if (state.isCode) c.unsetCode(); c.toggleItalic().run(); }}
        active={state.isItalic} title="Corsivo (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => { const c = editor.chain().focus(); if (state.isCode) c.unsetCode(); c.toggleStrike().run(); }}
        active={state.isStrike} title="Barrato (⌘⇧S)"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => { const c = editor.chain().focus(); if (!state.isCode) c.unsetBold().unsetItalic().unsetStrike(); c.toggleCode().run(); }}
        active={state.isCode} title="Codice inline (⌘E)"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={state.isH1} title="Titolo 1">
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={state.isH2} title="Titolo 2">
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={state.isH3} title="Titolo 3">
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={state.isBulletList} title="Elenco puntato">
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={state.isOrderedList} title="Elenco numerato">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={state.isTaskList} title="Checklist">
        <CheckSquare className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={state.isBlockquote} title="Citazione">
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separatore">
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Inserisci tabella"
      >
        <TableIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={onInsertImage} title="Inserisci immagine">
        <ImagePlus className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

/* ── Word Count ────────────────────────────────────────────── */

function WordCount({ editor }: { editor: Editor }) {
  const counts = useEditorState({
    editor,
    selector: (ctx) => ({
      chars: ctx.editor.storage.characterCount?.characters() ?? 0,
      words: ctx.editor.storage.characterCount?.words() ?? 0,
    }),
  });

  return (
    <div className="fixed bottom-0 right-0 px-3 py-1.5 text-[12px] text-[var(--sb-muted)] flex gap-2 z-10">
      <span>{counts.words} parole</span>
      <span>&middot;</span>
      <span>{counts.chars} caratteri</span>
    </div>
  );
}

function SelectionBubble({
  editor,
  actions,
  onOpenCommandCenter,
}: {
  editor: Editor;
  actions: ContextAction[];
  onOpenCommandCenter: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const { from, to, empty } = ctx.editor.state.selection;
      return {
        visible: !empty && ctx.editor.isEditable,
        selectedChars: Math.max(0, to - from),
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isCode: ctx.editor.isActive("code"),
      };
    },
  });

  if (!state.visible) return null;

  return (
    <div className="fixed left-1/2 top-[106px] z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] px-1.5 py-1 shadow-2xl">
      <span className="px-2 text-[10px] text-[var(--sb-muted)]">{state.selectedChars} car.</span>
      <Divider />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={state.isBold} title="Grassetto">
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={state.isItalic} title="Corsivo">
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={state.isCode} title="Codice inline">
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titolo 2">
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Divider />
      {actions.slice(0, 3).map((action) => {
        const Icon = action.icon;
        return (
          <ToolbarButton key={action.id} onClick={action.run} title={`${action.label} - ${action.hint}`}>
            <Icon className="h-3.5 w-3.5" />
          </ToolbarButton>
        );
      })}
      <ToolbarButton onClick={onOpenCommandCenter} title="Command Center contestuale">
        <Brain className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

function OutlinePanel({
  editor,
  headings,
}: {
  editor: Editor;
  headings: HeadingRef[];
}) {
  return (
    <aside className="hidden xl:block w-64 shrink-0 border-l border-[var(--sb-border)] bg-[var(--sb-bg)] px-4 py-5 overflow-y-auto">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--sb-muted)]">
        <PanelRight className="h-3.5 w-3.5" />
        Indice
      </div>
      {headings.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--sb-muted)]">
          Usa i titoli per creare una mappa rapida della nota.
        </p>
      ) : (
        <nav className="space-y-1">
          {headings.map((heading) => (
            <button
              key={heading.id}
              type="button"
              onClick={() => editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run()}
              className={cn(
                "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
                heading.level === 2 && "pl-5",
                heading.level === 3 && "pl-8"
              )}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}

function CommandCenter({
  open,
  selectedText,
  actions,
  onClose,
  onInsertSmartBlock,
}: {
  open: boolean;
  selectedText: string;
  actions: ContextAction[];
  onClose: () => void;
  onInsertSmartBlock: (block: SmartBlockDefinition) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--sb-border)] bg-[var(--sb-bg)] shadow-2xl"
        data-editor-popover
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--sb-border)] bg-[var(--sb-surface)] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-400/10 text-indigo-300">
                <Brain className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--sb-text)]">Command Center</h2>
                <p className="text-xs text-[var(--sb-muted)]">Trasforma pensiero, testo e contesto in oggetti del tuo sistema.</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedText && (
            <div className="mt-4 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] px-3 py-2 text-xs leading-relaxed text-[var(--sb-muted)]">
              <span className="font-medium text-[var(--sb-text)]">Selezione:</span>{" "}
              {selectedText.length > 220 ? `${selectedText.slice(0, 220)}...` : selectedText}
            </div>
          )}
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_1fr]">
          <section className="border-b border-[var(--sb-border)] p-4 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--sb-muted)]">
              <Wand2 className="h-3.5 w-3.5" />
              Trasforma in oggetto
            </div>
            <div className="space-y-1">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.run();
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--sb-hover)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--sb-text)]">{action.label}</span>
                      <span className="block truncate text-xs text-[var(--sb-muted)]">{action.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--sb-muted)]">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Blocks
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SMART_BLOCKS.map((block) => {
                const Icon = block.icon;
                return (
                  <button
                    key={block.kind}
                    onClick={() => {
                      onInsertSmartBlock(block);
                      onClose();
                    }}
                    className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3 text-left transition-colors hover:border-indigo-400/40 hover:bg-[var(--sb-hover)]"
                  >
                    <Icon className="mb-2 h-4 w-4 text-indigo-300" />
                    <span className="block text-xs font-semibold text-[var(--sb-text)]">{block.label}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-[var(--sb-muted)]">{block.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── TipTap JSON to Markdown ───────────────────────────────── */

function tipTapToMarkdown(node: Record<string, unknown>, depth = 0): string {
  if (!node) return "";
  const type = node.type as string;
  const content = node.content as Record<string, unknown>[] | undefined;
  const attrs = node.attrs as Record<string, unknown> | undefined;
  const children = content ? content.map((c) => tipTapToMarkdown(c, depth)).join("") : "";

  if (node.text) {
    let text = node.text as string;
    const marks = node.marks as { type: string }[] | undefined;
    if (marks) {
      for (const m of marks) {
        if (m.type === "bold") text = `**${text}**`;
        if (m.type === "italic") text = `*${text}*`;
        if (m.type === "strike") text = `~~${text}~~`;
        if (m.type === "code") text = `\`${text}\``;
        if (m.type === "noteLink") text = `[[${text}]]`;
      }
    }
    return text;
  }

  switch (type) {
    case "doc": return children;
    case "paragraph": return children + "\n\n";
    case "heading": return "#".repeat((attrs?.level as number) ?? 1) + " " + children + "\n\n";
    case "bulletList": return content ? content.map((c) => "- " + tipTapToMarkdown(c, depth + 1)).join("") : "";
    case "orderedList": return content ? content.map((c, i) => `${i + 1}. ` + tipTapToMarkdown(c, depth + 1)).join("") : "";
    case "listItem": return children.replace(/\n\n$/, "\n");
    case "taskList": return content ? content.map((c) => {
      const checked = (c.attrs as Record<string, unknown>)?.checked ? "x" : " ";
      return `- [${checked}] ` + tipTapToMarkdown(c, depth + 1);
    }).join("") : "";
    case "taskItem": return children.replace(/\n\n$/, "\n");
    case "blockquote": return children.split("\n").filter(Boolean).map((l) => "> " + l).join("\n") + "\n\n";
    case "smartBlock": return `> [!${(attrs?.label as string) || "Smart Block"}]\n` + children.split("\n").filter(Boolean).map((l) => `> ${l}`).join("\n") + "\n\n";
    case "codeBlock": return "```\n" + children + "```\n\n";
    case "horizontalRule": return "---\n\n";
    case "hardBreak": return "\n";
    case "image": return `![${(attrs?.alt as string) || ""}](${attrs?.src})\n\n`;
    case "table": return children + "\n";
    case "tableRow": {
      const cells = content ? content.map((c) => tipTapToMarkdown(c, depth)).join("") : "";
      return "| " + cells + "\n";
    }
    case "tableHeader": return children.replace(/\n/g, "").trim() + " | ";
    case "tableCell": return children.replace(/\n/g, "").trim() + " | ";
    default: return children;
  }
}

const SLASH_COMMANDS = [
  ...SMART_BLOCKS.map((block) => ({
    id: `smart-${block.kind}`,
    label: block.label,
    hint: block.hint,
    icon: block.icon,
    run: (editor: Editor) => editor.chain().focus().setSmartBlock({ kind: block.kind, label: block.label }).run(),
  })),
  {
    id: "h1",
    label: "Titolo 1",
    hint: "Sezione principale",
    icon: Heading1,
    run: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Titolo 2",
    hint: "Sottosezione",
    icon: Heading2,
    run: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "todo",
    label: "Checklist",
    hint: "Lista con checkbox",
    icon: CheckSquare,
    run: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "bullet",
    label: "Elenco puntato",
    hint: "Lista veloce",
    icon: List,
    run: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "quote",
    label: "Citazione",
    hint: "Nota in evidenza",
    icon: Quote,
    run: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Blocco codice",
    hint: "Snippet multi-riga",
    icon: Code,
    run: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "table",
    label: "Tabella",
    hint: "Griglia 3x3",
    icon: TableIcon,
    run: (editor: Editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "divider",
    label: "Separatore",
    hint: "Linea orizzontale",
    icon: Minus,
    run: (editor: Editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

/* ── Main Editor ───────────────────────────────────────────── */

interface Project {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

const PROJECT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500", red: "bg-red-500", orange: "bg-orange-500",
  amber: "bg-amber-500", green: "bg-emerald-500", blue: "bg-blue-500",
  purple: "bg-purple-500", pink: "bg-pink-500", teal: "bg-teal-500",
};

export default function NoteEditor({ note, notebooks, projects = [] }: { note: Note; notebooks: Notebook[]; projects?: Project[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagInput, setTagInput] = useState("");
  const [notebookId, setNotebookId] = useState<string | null>(note.notebook_id);
  const [projectId, setProjectId] = useState<string | null>(note.project_id);
  const [showNotebookPicker, setShowNotebookPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [noteColor, setNoteColor] = useState<string | null>(note.color);
  const [noteEmoji, setNoteEmoji] = useState<string | null>(note.emoji);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);

  // Share
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Version history
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<{ id: string; title: string; content: Json; created_at: string }[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const lastVersionRef = useRef<number>(0);

  // Export
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Backlinks
  const [backlinks, setBacklinks] = useState<{ id: string; title: string }[]>([]);
  const [noteLinks, setNoteLinks] = useState<NoteLinkRef[]>([]);
  const [headings, setHeadings] = useState<HeadingRef[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [linkSuggestion, setLinkSuggestion] = useState<LinkSuggestionState | null>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<(options?: { notify?: boolean; background?: boolean; snapshot?: Partial<Note> & { content?: Json } }) => Promise<void>>(undefined);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const didMountMetadataRef = useRef(false);
  const saveSequenceRef = useRef(0);
  const saveIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateEditorAssistants = useCallback((currentEditor: Editor) => {
    setHeadings(getHeadings(currentEditor));
    setSelectedText(getSelectedText(currentEditor));

    const { selection } = currentEditor.state;
    if (!selection.empty) {
      setLinkSuggestion(null);
      setSlashMenu(null);
      return;
    }

    const $from = selection.$from;
    const beforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const absoluteLineStart = selection.from - beforeCursor.length;
    const linkMatch = beforeCursor.match(/\[\[([^\]\n]{0,80})$/);
    const slashMatch = beforeCursor.match(/(?:^|\s)\/([\wÀ-ÿ-]{0,40})$/);

    if (linkMatch) {
      setLinkSuggestion((prev) => ({
        query: linkMatch[1].toLowerCase(),
        from: selection.from - linkMatch[0].length,
        to: selection.from,
        activeIndex: prev?.query === linkMatch[1].toLowerCase() ? prev.activeIndex : 0,
      }));
      setSlashMenu(null);
      return;
    }

    setLinkSuggestion(null);

    if (slashMatch) {
      const slashText = slashMatch[0].trimStart();
      setSlashMenu((prev) => ({
        query: slashMatch[1].toLowerCase(),
        from: absoluteLineStart + beforeCursor.lastIndexOf(slashText),
        to: selection.from,
        activeIndex: prev?.query === slashMatch[1].toLowerCase() ? prev.activeIndex : 0,
      }));
      return;
    }

    setSlashMenu(null);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Typography,
      Placeholder.configure({ placeholder: "Inizia a scrivere... Usa [[nome nota]] per creare un link" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ImageBlock,
      NoteLink,
      SmartBlock,
    ],
    immediatelyRender: false,
    content: isTiptapDoc(note.content) ? note.content : createTiptapDoc(),
    editorProps: {
      attributes: {
        class: "prose-editor focus:outline-none min-h-[60vh] px-8 md:px-12 py-4",
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            uploadAndInsertImage(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) uploadAndInsertImage(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      updateEditorAssistants(currentEditor);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveRef.current?.({ notify: false });
      }, 1500);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      updateEditorAssistants(currentEditor);
    },
  });

  useEffect(() => {
    if (editor) setHeadings(getHeadings(editor));
  }, [editor]);

  useEffect(() => {
    let cancelled = false;
    async function loadNoteLinks() {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (!cancelled && !error) {
        setNoteLinks((data ?? []).filter((n) => n.id !== note.id && n.title.trim()) as NoteLinkRef[]);
      }
    }
    loadNoteLinks();
    return () => { cancelled = true; };
  }, [note.id, supabase]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-editor-popover]")) {
        setShowExportMenu(false);
        setShowShareMenu(false);
        setShowNotebookPicker(false);
        setShowProjectPicker(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowExportMenu(false);
        setShowShareMenu(false);
        setShowNotebookPicker(false);
        setShowProjectPicker(false);
        setLinkSuggestion(null);
        setSlashMenu(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Handle click on [[note links]]
  useEffect(() => {
    if (!editor) return;
    const el = editor.options.element;
    if (!el || typeof el === "function" || !("addEventListener" in el)) return;
    const dom = el as HTMLElement;
    function handleClick(e: Event) {
      const target = (e as MouseEvent).target as HTMLElement;
      const link = target.closest(".note-link");
      if (link) {
        e.preventDefault();
        const noteTitle = link.getAttribute("data-note-link");
        if (noteTitle) {
          const cached = noteLinks.find((item) => item.title.toLowerCase() === noteTitle.toLowerCase());
          if (cached) {
            router.push(`/notes/${cached.id}`);
            return;
          }
          supabase
            .from("notes")
            .select("id")
            .eq("title", noteTitle)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
              if (data) router.push(`/notes/${data.id}`);
              else toast.info("Nota collegata non trovata");
            });
        }
      }
    }
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor, noteLinks, supabase, router]);

  // Load backlinks on mount — scoped to current user
  useEffect(() => {
    async function loadBacklinks() {
      const response = await fetch(`/api/notes/${note.id}/backlinks`);
      const result = (await response.json()) as { backlinks?: { id: string; title: string }[] };
      if (response.ok && result.backlinks) setBacklinks(result.backlinks);
    }
    loadBacklinks();
  }, [note.id]);

  const save = useCallback(async (options: { notify?: boolean; background?: boolean; snapshot?: Partial<Note> & { content?: Json } } = {}) => {
    if (!editor) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (saveIdleTimerRef.current) clearTimeout(saveIdleTimerRef.current);
    const sequence = ++saveSequenceRef.current;
    const snapshot = {
      title,
      content: editor.getJSON() as Json,
      tags,
      notebook_id: notebookId,
      project_id: projectId,
      color: noteColor,
      emoji: noteEmoji,
      ...options.snapshot,
    };
    if (!options.background) {
      setSaveStatus("saving");
      setSaveError(null);
    }
    const now = Date.now();
    const createVersion = now - lastVersionRef.current > 5 * 60 * 1000;
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: snapshot.title,
          content: snapshot.content,
          tags: snapshot.tags,
          notebook_id: snapshot.notebook_id,
          project_id: snapshot.project_id,
          color: snapshot.color,
          emoji: snapshot.emoji,
          create_version: createVersion,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "Save failed");
      }
    } catch (error) {
      if (!options.background && sequence === saveSequenceRef.current) {
        setSaveStatus("idle");
        setSaveError(error instanceof Error ? error.message : "Non sono riuscito a salvare la nota");
      }
      if (options.notify) {
        toast.error(
          error instanceof Error ? error.message : "Non sono riuscito a salvare la nota",
          { id: "note-save-error" },
        );
      }
      return;
    }

    if (createVersion) {
      lastVersionRef.current = now;
    }
    if (!options.background && sequence === saveSequenceRef.current) {
      setSaveStatus("saved");
      saveIdleTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [editor, title, tags, notebookId, projectId, noteColor, noteEmoji, note.id]);

  useEffect(() => { saveRef.current = save; }, [save]);

  useEffect(() => {
    if (!didMountMetadataRef.current) {
      didMountMetadataRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { saveRef.current?.({ notify: false }); }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, tags, notebookId, projectId, noteColor, noteEmoji]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        saveRef.current?.({ notify: false, background: true });
      }
      if (saveIdleTimerRef.current) clearTimeout(saveIdleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const flushPendingSave = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        saveRef.current?.({ notify: false, background: true });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingSave();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPendingSave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPendingSave);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save({ notify: true });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [save]);

  // Soft delete
  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      router.push("/notes");
      router.refresh();
    } catch {
      toast.error("Non sono riuscito a spostare la nota nel cestino");
      setDeleting(false);
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  // Share
  useEffect(() => {
    fetch(`/api/notes/${note.id}/share`)
      .then((response) => response.json())
      .then((data: { token?: string | null }) => { if (data.token) setShareToken(data.token); });
  }, [note.id]);

  async function createShareLink() {
    setShareLoading(true);
    const response = await fetch(`/api/notes/${note.id}/share`, { method: "POST" });
    const result = (await response.json()) as { token?: string; error?: string };
    if (response.ok && result.token) setShareToken(result.token);
    else toast.error(result.error || "Non sono riuscito a creare il link");
    setShareLoading(false);
  }

  async function revokeShareLink() {
    const response = await fetch(`/api/notes/${note.id}/share`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Non sono riuscito a revocare il link");
      return;
    }
    setShareToken(null);
    setCopied(false);
  }

  function copyShareLink() {
    if (!shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function loadVersions() {
    setLoadingVersions(true);
    const { data } = await supabase
      .from("note_versions").select("id, title, content, created_at")
      .eq("note_id", note.id).order("created_at", { ascending: false }).limit(20);
    setVersions(data ?? []);
    setLoadingVersions(false);
  }

  function restoreVersion(version: { title: string; content: Json }) {
    setTitle(version.title);
    editor?.commands.setContent(version.content as object);
    setShowHistory(false);
    save({ notify: true, snapshot: { title: version.title, content: version.content } });
  }

  // Image upload
  async function uploadAndInsertImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Puoi inserire solo file immagine");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Immagine troppo grande: massimo 8 MB");
      return;
    }

    setImageUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `notes/${note.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("images").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        // Fallback: keep the note usable even when storage is not configured.
        const reader = new FileReader();
        reader.onload = () => {
          editor?.chain().focus().setImage({ src: reader.result as string, alt: file.name }).run();
          setImageUploading(false);
          toast.info("Immagine inserita localmente nella nota");
        };
        reader.onerror = () => {
          setImageUploading(false);
          toast.error("Non sono riuscito a inserire l'immagine");
        };
        reader.readAsDataURL(file);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path);
      editor?.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
    } finally {
      setImageUploading(false);
    }
  }

  function handleImageInput() {
    imageInputRef.current?.click();
  }

  // Export
  function exportMarkdown() {
    if (!editor) return;
    const json = editor.getJSON() as Record<string, unknown>;
    const md = `# ${title}\n\n` + tipTapToMarkdown(json);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }

  function exportPdf() {
    if (!editor) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Sanitize all user-controlled data before injecting into HTML
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const safeTitle = esc(title || "Senza titolo");
    const safeTags = tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");

    // Use DOM APIs instead of raw HTML injection for the content
    const doc = printWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><title>${safeTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1e293b; line-height: 1.7; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.4rem; }
  h3 { font-size: 1.1rem; }
  code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #6366f1; padding-left: 1rem; color: #64748b; margin: 1rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  img { max-width: 100%; border-radius: 8px; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  .tags { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tag { background: #f1f5f9; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #64748b; }
</style>
</head><body>
<h1>${safeTitle}</h1>
${tags.length > 0 ? `<div class="tags">${safeTags}</div>` : ""}
<div id="content"></div>
</body></html>`);
    doc.close();

    // Inject editor HTML via DOM to avoid script execution
    const contentDiv = doc.getElementById("content");
    if (contentDiv) {
      contentDiv.innerHTML = editor.getHTML();
      // Strip any script tags that might be in the HTML
      contentDiv.querySelectorAll("script").forEach((s) => s.remove());
      // Remove dangerous event handlers
      contentDiv.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
        }
      });
    }

    setTimeout(() => { printWindow.print(); }, 300);
    setShowExportMenu(false);
  }

  const insertSmartBlock = useCallback((block: SmartBlockDefinition, text = selectedText) => {
    if (!editor) return;
    editor.chain().focus().setSmartBlock({ kind: block.kind, label: block.label, text }).run();
    setSlashMenu(null);
  }, [editor, selectedText]);

  const createTaskFromSelection = useCallback(async () => {
    if (!editor) return;
    const text = getSelectedText(editor);
    if (!text) {
      toast.info("Seleziona un testo da trasformare in task");
      return;
    }

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: text.slice(0, 140),
        description: `Creato dalla nota "${title || "Senza titolo"}".`,
        note_id: note.id,
        project_id: projectId,
        tags,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Non sono riuscito a creare il task");
      return;
    }

    insertSmartBlock(SMART_BLOCK_BY_KIND.action, text);
    toast.success("Task creato e collegato alla nota");
  }, [editor, insertSmartBlock, note.id, projectId, tags, title]);

  const createNoteFromSelection = useCallback(async () => {
    if (!editor) return;
    const text = getSelectedText(editor);
    if (!text) {
      toast.info("Seleziona un testo da trasformare in nota");
      return;
    }

    const noteTitle = text.split("\n")[0].trim().slice(0, 80) || "Nuova nota";
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: noteTitle,
        content: createTiptapDoc(text),
        tags,
        notebook_id: notebookId,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { note?: NoteLinkRef; error?: string };
    if (!response.ok || !result.note) {
      toast.error(result.error || "Non sono riuscito a creare la nota");
      return;
    }

    setNoteLinks((prev) => [{ id: result.note!.id, title: result.note!.title }, ...prev]);
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "text",
          text: result.note.title,
          marks: [{ type: "noteLink", attrs: { href: result.note.title } }],
        },
        { type: "text", text: " " },
      ])
      .run();
    toast.success("Nota collegata creata");
  }, [editor, notebookId, tags]);

  const createReminderFromSelection = useCallback(async () => {
    if (!editor) return;
    const text = getSelectedText(editor);
    const remindAt = new Date();
    remindAt.setDate(remindAt.getDate() + 1);
    remindAt.setHours(9, 0, 0, 0);

    const response = await fetch("/api/note-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: note.id, remind_at: remindAt.toISOString() }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      toast.error(result.error || "Non sono riuscito a creare il promemoria");
      return;
    }

    if (text) insertSmartBlock(SMART_BLOCK_BY_KIND.question, `Promemoria domani 09:00: ${text}`);
    toast.success("Promemoria impostato per domani alle 09:00");
  }, [editor, insertSmartBlock, note.id]);

  const contextActions = useMemo<ContextAction[]>(() => [
    {
      id: "task",
      label: "Crea task",
      hint: "Trasforma la selezione in un task collegato",
      icon: ClipboardCheck,
      run: createTaskFromSelection,
    },
    {
      id: "note",
      label: "Crea nota collegata",
      hint: "Estrae il testo in una nuova nota con link interno",
      icon: FileText,
      run: createNoteFromSelection,
    },
    {
      id: "reminder",
      label: "Imposta promemoria",
      hint: "Richiama questa nota domani mattina",
      icon: Bell,
      run: createReminderFromSelection,
    },
    {
      id: "decision",
      label: "Blocca come decisione",
      hint: "Converte la selezione in Smart Block Decisione",
      icon: Scale,
      run: () => insertSmartBlock(SMART_BLOCK_BY_KIND.decision),
    },
    {
      id: "risk",
      label: "Segna rischio",
      hint: "Converte la selezione in Smart Block Rischio",
      icon: AlertTriangle,
      run: () => insertSmartBlock(SMART_BLOCK_BY_KIND.risk),
    },
  ], [createNoteFromSelection, createReminderFromSelection, createTaskFromSelection, insertSmartBlock]);

  const filteredLinkSuggestions = useMemo(() => {
    if (!linkSuggestion) return [];
    const query = linkSuggestion.query.trim().toLowerCase();
    return noteLinks
      .filter((item) => !query || item.title.toLowerCase().includes(query))
      .slice(0, 6);
  }, [linkSuggestion, noteLinks]);

  const filteredSlashCommands = useMemo(() => {
    if (!slashMenu) return [];
    const query = slashMenu.query.trim().toLowerCase();
    return SLASH_COMMANDS
      .filter((command) => {
        const haystack = `${command.label} ${command.hint} ${command.id}`.toLowerCase();
        return !query || haystack.includes(query);
      })
      .slice(0, 8);
  }, [slashMenu]);

  const insertNoteLink = useCallback((target: NoteLinkRef) => {
    if (!editor || !linkSuggestion) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: linkSuggestion.from, to: linkSuggestion.to })
      .insertContent([
        {
          type: "text",
          text: target.title,
          marks: [{ type: "noteLink", attrs: { href: target.title } }],
        },
        { type: "text", text: " " },
      ])
      .run();
    setLinkSuggestion(null);
  }, [editor, linkSuggestion]);

  const runSlashCommand = useCallback((command: (typeof SLASH_COMMANDS)[number]) => {
    if (!editor || !slashMenu) return;
    editor.chain().focus().deleteRange({ from: slashMenu.from, to: slashMenu.to }).run();
    command.run(editor);
    setSlashMenu(null);
  }, [editor, slashMenu]);

  useEffect(() => {
    if (!editor) return;
    function onKeyDown(event: KeyboardEvent) {
      if (linkSuggestion && filteredLinkSuggestions.length > 0) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setLinkSuggestion((prev) => prev && {
            ...prev,
            activeIndex:
              event.key === "ArrowDown"
                ? (prev.activeIndex + 1) % filteredLinkSuggestions.length
                : (prev.activeIndex - 1 + filteredLinkSuggestions.length) % filteredLinkSuggestions.length,
          });
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          insertNoteLink(filteredLinkSuggestions[linkSuggestion.activeIndex] ?? filteredLinkSuggestions[0]);
          return;
        }
      }

      if (slashMenu && filteredSlashCommands.length > 0) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setSlashMenu((prev) => prev && {
            ...prev,
            activeIndex:
              event.key === "ArrowDown"
                ? (prev.activeIndex + 1) % filteredSlashCommands.length
                : (prev.activeIndex - 1 + filteredSlashCommands.length) % filteredSlashCommands.length,
          });
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          runSlashCommand(filteredSlashCommands[slashMenu.activeIndex] ?? filteredSlashCommands[0]);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editor, filteredLinkSuggestions, filteredSlashCommands, insertNoteLink, linkSuggestion, runSlashCommand, slashMenu]);

  return (
    <div className={cn("flex flex-col h-full pb-20 md:pb-0", focusMode && "bg-[var(--sb-bg)]")}>
      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadAndInsertImage(file);
          e.target.value = "";
        }}
      />

      {/* Top bar */}
      <div className={cn("flex items-center justify-between px-4 py-3 border-b border-[var(--sb-border)] bg-[var(--sb-surface)] backdrop-blur-sm sticky top-0 z-20", focusMode && "opacity-95")}>
        <button
          onClick={() => router.push("/notes")}
          className="flex items-center gap-1.5 text-sm text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Note</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs transition-opacity duration-300 mr-1",
              saveStatus === "idle" && "opacity-0",
              saveStatus === "saving" && "text-[var(--sb-muted)] opacity-100",
              saveStatus === "saved" && "text-emerald-500 opacity-100",
              saveError && "text-red-400 opacity-100"
            )}
            title={saveError ?? undefined}
          >
            {saveError ? "Errore salvataggio" : saveStatus === "saving" ? "Salvataggio..." : "Salvato"}
          </span>
          <button onClick={() => save({ notify: true })} className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-all cursor-pointer">
            Salva
          </button>
          <button
            onClick={() => setFocusMode((value) => !value)}
            className={cn("p-1.5 rounded-md transition-all cursor-pointer", focusMode ? "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]")}
            title={focusMode ? "Disattiva focus" : "Modalità focus"}
          >
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowCommandCenter(true)}
            className={cn("p-1.5 rounded-md transition-all cursor-pointer", showCommandCenter ? "text-indigo-400 bg-indigo-400/10" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]")}
            title="Command Center"
          >
            <Brain className="h-4 w-4" />
          </button>

          {/* Pomodoro */}
          <PomodoroTimer />

          {/* Reminder */}
          <ReminderButton noteId={note.id} />

          {/* Export */}
          <div className="relative" data-editor-popover>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-all cursor-pointer"
              title="Esporta"
            >
              <Download className="h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-2 z-30 min-w-[160px]">
                <button
                  onClick={exportMarkdown}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--sb-text)] hover:bg-[var(--sb-hover)] rounded-lg transition-colors cursor-pointer"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Esporta come .md
                </button>
                <button
                  onClick={exportPdf}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--sb-text)] hover:bg-[var(--sb-hover)] rounded-lg transition-colors cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Esporta come PDF
                </button>
              </div>
            )}
          </div>

          {/* Share */}
          <div className="relative" data-editor-popover>
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                shareToken ? "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
              )}
              title="Condividi"
            >
              <Share2 className="h-4 w-4" />
            </button>
            {showShareMenu && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl shadow-2xl p-4 z-30">
                <h3 className="text-xs font-semibold text-[var(--sb-text)] mb-2">Condividi nota</h3>
                {shareToken ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 rounded-md bg-[var(--sb-card)] border border-[var(--sb-border)] px-2.5 py-2 text-xs text-[var(--sb-muted)] overflow-hidden">
                      <Link2Icon className="h-3 w-3 shrink-0 text-indigo-400" />
                      <span className="truncate">{`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}`}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={copyShareLink} className="flex-1 px-2.5 py-1.5 text-xs rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors cursor-pointer">
                        {copied ? "Copiato!" : "Copia link"}
                      </button>
                      <button onClick={revokeShareLink} className="px-2.5 py-1.5 text-xs rounded-md text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer flex items-center gap-1">
                        <Unlink className="h-3 w-3" />
                        Revoca
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--sb-muted)]">Il link scade dopo 7 giorni.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--sb-muted)]">Crea un link pubblico in sola lettura. Scade dopo 7 giorni.</p>
                    <button onClick={createShareLink} disabled={shareLoading} className="w-full px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer">
                      {shareLoading ? "Creazione..." : "Crea link di condivisione"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History */}
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadVersions(); }}
            className={cn("p-1.5 rounded-md transition-all cursor-pointer", showHistory ? "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10" : "text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]")}
            title="Cronologia versioni"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
            title="Sposta nel cestino"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {editor && !focusMode && <EditorToolbar editor={editor} onInsertImage={handleImageInput} />}
      {editor && focusMode && <EditorToolbar editor={editor} onInsertImage={handleImageInput} compact />}
      {editor && (
        <SelectionBubble
          editor={editor}
          actions={contextActions}
          onOpenCommandCenter={() => setShowCommandCenter(true)}
        />
      )}
      <CommandCenter
        open={showCommandCenter}
        selectedText={selectedText}
        actions={contextActions}
        onClose={() => setShowCommandCenter(false)}
        onInsertSmartBlock={insertSmartBlock}
      />

      <div className="flex-1 min-h-0 flex">
      <div className="flex-1 overflow-y-auto">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="sb-note-title-input w-full bg-transparent px-8 md:px-12 pt-8 pb-1 text-3xl font-bold text-[var(--sb-text)] placeholder-[var(--sb-muted)] focus:outline-none"
          placeholder="Senza titolo"
        />

        {/* Notebook picker + Color/Emoji */}
        {!focusMode && (
        <div className="px-8 md:px-12 pt-2 pb-1 flex items-center gap-2">
          <div className="relative inline-block" data-editor-popover>
            <button
              onClick={() => setShowNotebookPicker(!showNotebookPicker)}
              className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--sb-hover)]"
            >
              <Folder className="h-3 w-3" />
              {notebookId ? notebooks.find((nb) => nb.id === notebookId)?.name ?? "Notebook" : "Nessun notebook"}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showNotebookPicker && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-lg shadow-xl z-20 min-w-[160px] py-1">
                <button
                  onClick={() => { setNotebookId(null); setShowNotebookPicker(false); }}
                  className={cn("w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer", notebookId === null ? "text-[var(--sb-text)] bg-[var(--sb-hover)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                >
                  Nessun notebook
                </button>
                {notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    onClick={() => { setNotebookId(nb.id); setShowNotebookPicker(false); }}
                    className={cn("w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer flex items-center gap-1.5", notebookId === nb.id ? "text-[var(--sb-text)] bg-[var(--sb-hover)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                  >
                    <Folder className="h-3 w-3" />
                    {nb.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Project picker */}
          {projects.length > 0 && (
            <div className="relative inline-block" data-editor-popover>
              <button
                onClick={() => setShowProjectPicker(!showProjectPicker)}
                className="flex items-center gap-1.5 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--sb-hover)]"
              >
                {projectId ? (
                  <>
                    <span className={cn("w-2 h-2 rounded-full", PROJECT_COLORS[projects.find((p) => p.id === projectId)?.color || "indigo"] || "bg-indigo-500")} />
                    {projects.find((p) => p.id === projectId)?.emoji && <span className="text-xs">{projects.find((p) => p.id === projectId)?.emoji}</span>}
                    {projects.find((p) => p.id === projectId)?.name ?? "Progetto"}
                  </>
                ) : (
                  <>
                    <Folder className="h-3 w-3" />
                    Nessun progetto
                  </>
                )}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showProjectPicker && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-lg shadow-xl z-20 min-w-[160px] py-1">
                  <button
                    onClick={() => { setProjectId(null); setShowProjectPicker(false); }}
                    className={cn("w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer", projectId === null ? "text-[var(--sb-text)] bg-[var(--sb-hover)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                  >
                    Nessun progetto
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setProjectId(p.id); setShowProjectPicker(false); }}
                      className={cn("w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer flex items-center gap-1.5", projectId === p.id ? "text-[var(--sb-text)] bg-[var(--sb-hover)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]")}
                    >
                      {p.emoji && <span className="text-xs">{p.emoji}</span>}
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <NoteColorPicker
            color={noteColor}
            emoji={noteEmoji}
            onChange={(c, e) => { setNoteColor(c); setNoteEmoji(e); }}
          />
        </div>
        )}

        {/* Tags */}
        {!focusMode && (
        <div className="flex flex-wrap items-center gap-1.5 px-8 md:px-12 py-3">
          {tags.map((tag) => (
            <span key={tag} className="group/tag flex items-center gap-1 rounded-md bg-[var(--sb-card)] border border-[var(--sb-border)] px-2 py-0.5 text-xs text-[var(--sb-muted)]">
              {tag}
              <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-[var(--sb-muted)] hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover/tag:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
            placeholder="+ aggiungi tag"
            className="bg-transparent text-xs text-[var(--sb-muted)] placeholder-[var(--sb-muted)] focus:outline-none w-24"
          />
        </div>
        )}

        {/* Editor */}
        {imageUploading && (
          <div className="mx-8 md:mx-12 mb-2 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300">
            Caricamento immagine...
          </div>
        )}
        {linkSuggestion && (
          <div className="mx-8 md:mx-12 mb-2 max-w-md rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-1 shadow-xl" data-editor-popover>
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase text-[var(--sb-muted)]">
              <Search className="h-3 w-3" />
              Link a nota
            </div>
            {filteredLinkSuggestions.length > 0 ? filteredLinkSuggestions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertNoteLink(item);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                  index === linkSuggestion.activeIndex ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <span className="truncate">{item.title}</span>
                {index === linkSuggestion.activeIndex && <CornerDownLeft className="ml-auto h-3 w-3" />}
              </button>
            )) : (
              <p className="px-2 py-2 text-xs text-[var(--sb-muted)]">Nessuna nota trovata.</p>
            )}
          </div>
        )}
        {slashMenu && (
          <div className="mx-8 md:mx-12 mb-2 max-w-md rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-1 shadow-xl" data-editor-popover>
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase text-[var(--sb-muted)]">
              <Type className="h-3 w-3" />
              Inserisci blocco
            </div>
            {filteredSlashCommands.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    runSlashCommand(command);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                    index === slashMenu.activeIndex ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span>{command.label}</span>
                  <span className="ml-auto text-[10px] text-[var(--sb-muted)]">{command.hint}</span>
                </button>
              );
            })}
          </div>
        )}
        <EditorContent editor={editor} />

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div className="px-8 md:px-12 py-4 mt-4 border-t border-[var(--sb-border)]">
            <h3 className="text-xs font-semibold text-[var(--sb-muted)] uppercase mb-2">
              Citata in {backlinks.length} {backlinks.length === 1 ? "nota" : "note"}
            </h3>
            <div className="flex flex-col gap-1">
              {backlinks.map((bl) => (
                <button
                  key={bl.id}
                  onClick={() => router.push(`/notes/${bl.id}`)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-[var(--sb-hover)] rounded-md transition-colors cursor-pointer text-left"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  {bl.title || "Senza titolo"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Word/character count */}
        {editor && <WordCount editor={editor} />}
      </div>
      {editor && !focusMode && <OutlinePanel editor={editor} headings={headings} />}
      </div>

      {/* Version history panel */}
      {showHistory && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--sb-bg)] border-l border-[var(--sb-border)] z-40 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sb-border)]">
            <h3 className="text-sm font-semibold text-[var(--sb-text)] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              Cronologia
            </h3>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingVersions ? (
              <p className="text-xs text-[var(--sb-muted)] p-4">Caricamento...</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-[var(--sb-muted)] p-4">Nessuna versione salvata.</p>
            ) : (
              <div className="flex flex-col">
                {versions.map((v) => (
                  <div key={v.id} className="px-4 py-3 border-b border-[var(--sb-border)] hover:bg-[var(--sb-hover)] transition-colors">
                    <p className="text-xs text-[var(--sb-text)] truncate">{v.title || "Senza titolo"}</p>
                    <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">
                      {new Date(v.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <button onClick={() => restoreVersion(v)} className="mt-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                      Ripristina questa versione
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete dialog (soft delete) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-[var(--sb-text)] mb-2">Spostare nel cestino?</h2>
            <p className="text-xs text-[var(--sb-muted)] mb-5 leading-relaxed">
              La nota verrà spostata nel cestino. Potrai ripristinarla entro 30 giorni.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs rounded-md bg-[var(--sb-hover)] text-[var(--sb-text)] hover:bg-[var(--sb-border)] transition-colors cursor-pointer">
                Annulla
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer">
                {deleting ? "Spostamento..." : "Sposta nel cestino"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
