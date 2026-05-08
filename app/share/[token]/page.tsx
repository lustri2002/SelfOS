import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import DOMPurify from "isomorphic-dompurify";

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SharedNotePage({ params }: Props) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/i.test(token)) notFound();

  const supabase = createAdminClient();

  // Public access is scoped strictly by the opaque token. The admin client is
  // server-only and lets this page work without broad anon RLS policies.
  const { data: share } = await supabase
    .from("shared_notes")
    .select("note_id, user_id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!share) notFound();

  // Defense in depth: the shared row must point to a note owned by the same
  // user who created the share link. This prevents cross-note exposure even if
  // a malformed row exists.
  const { data: note } = await supabase
    .from("notes")
    .select("title, content, tags, updated_at")
    .eq("id", share.note_id)
    .eq("user_id", share.user_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!note) notFound();

  // Sanitize the rendered HTML to prevent XSS
  const rawHtml = renderTipTapContent(note.content);
  const safeHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "s", "u", "code", "pre",
      "ul", "ol", "li", "blockquote", "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
      "input", "label", "div", "span",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "class", "data-type",
      "type", "disabled", "checked",
      "colspan", "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <main className="min-h-screen bg-[var(--sb-bg)] text-[var(--sb-text)]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-[var(--sb-muted)] bg-[var(--sb-surface)] border border-[var(--sb-border)] rounded-md px-2 py-0.5">
              Condiviso · Sola lettura
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-3">{note.title || "Senza titolo"}</h1>
          {note.tags.length > 0 && (
            <div className="flex gap-1.5">
              {note.tags.map((tag: string) => (
                <span key={tag} className="text-xs text-[var(--sb-muted)] bg-[var(--sb-surface)] rounded-md px-2 py-0.5 border border-[var(--sb-border)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="ProseMirror"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />

        <div className="mt-12 pt-4 border-t border-[var(--sb-border)] text-xs text-[var(--sb-muted)]">
          SelfOS · Nota condivisa
        </div>
      </div>
    </main>
  );
}

// Simple TipTap JSON to HTML renderer for read-only view
function renderTipTapContent(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  return renderNode(content as TipTapNode);
}

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function renderNode(node: TipTapNode): string {
  if (node.text) {
    let text = escapeHtml(node.text);
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case "bold": text = `<strong>${text}</strong>`; break;
          case "italic": text = `<em>${text}</em>`; break;
          case "strike": text = `<s>${text}</s>`; break;
          case "code": text = `<code>${text}</code>`; break;
        }
      }
    }
    return text;
  }

  const children = (node.content ?? []).map(renderNode).join("");

  switch (node.type) {
    case "doc": return children;
    case "paragraph": return `<p>${children}</p>`;
    case "heading": {
      const level = Number(node.attrs?.level) || 1;
      const safeLevel = Math.max(1, Math.min(6, level));
      return `<h${safeLevel}>${children}</h${safeLevel}>`;
    }
    case "bulletList": return `<ul>${children}</ul>`;
    case "orderedList": return `<ol>${children}</ol>`;
    case "listItem": return `<li>${children}</li>`;
    case "taskList": return `<ul data-type="taskList">${children}</ul>`;
    case "taskItem": {
      const checked = node.attrs?.checked ? "checked" : "";
      return `<li><label><input type="checkbox" disabled ${checked}></label><div>${children}</div></li>`;
    }
    case "blockquote": return `<blockquote>${children}</blockquote>`;
    case "codeBlock": return `<pre><code>${children}</code></pre>`;
    case "horizontalRule": return `<hr>`;
    case "hardBreak": return `<br>`;
    default: return children;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
