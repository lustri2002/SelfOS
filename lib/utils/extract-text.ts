/**
 * Extracts plain text from TipTap JSON content.
 * Used for search and content preview.
 */

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

export function extractText(content: unknown, maxLength?: number): string {
  if (!content || typeof content !== "object") return "";

  const parts: string[] = [];

  function walk(node: TipTapNode) {
    if (maxLength && parts.join(" ").length >= maxLength) return;
    if (node.text) {
      parts.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(content as TipTapNode);

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return maxLength ? text.slice(0, maxLength) : text;
}
