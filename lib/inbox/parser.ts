import { createTiptapDoc } from "@/lib/tiptap/document";

export type InboxKind = "note" | "task" | "workout" | "income" | "exam";

export interface InboxDraft {
  kind: InboxKind;
  title: string;
  body: string;
  amount: number | null;
  date: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  tags: string[];
  workoutType: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  cfu: number | null;
}

const KIND_PREFIXES: Array<[InboxKind, RegExp]> = [
  ["task", /^(task|todo|da fare|ricordami|promemoria)\s*[:\-]?\s*/i],
  ["note", /^(nota|note|appunto)\s*[:\-]?\s*/i],
  ["workout", /^(workout|allenamento|corsa|run|palestra|camminata|bici)\s*[:\-]?\s*/i],
  ["income", /^(entrata|income|stipendio|incasso|ricavo|finanza)\s*[:\-]?\s*/i],
  ["exam", /^(esame|universita|università)\s*[:\-]?\s*/i],
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function inferDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const italian = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](20\d{2}))?\b/);
  if (italian) {
    const year = italian[3] ?? String(new Date().getFullYear());
    return `${year}-${italian[2].padStart(2, "0")}-${italian[1].padStart(2, "0")}`;
  }

  if (/\b(oggi|today)\b/i.test(text)) return today();
  if (/\b(domani|tomorrow)\b/i.test(text)) return addDays(1);
  if (/\b(dopodomani)\b/i.test(text)) return addDays(2);
  return null;
}

function inferKind(raw: string): { kind: InboxKind; text: string } {
  for (const [kind, re] of KIND_PREFIXES) {
    if (re.test(raw)) return { kind, text: raw.replace(re, "").trim() };
  }

  if (/\b(esame|cfu|voto|universit[àa])\b/i.test(raw)) return { kind: "exam", text: raw };
  if (/\b(km|corsa|run|allenamento|palestra|bici|camminata)\b/i.test(raw)) return { kind: "workout", text: raw };
  if (/\b(€|eur|euro|stipendio|entrata|incasso)\b/i.test(raw)) return { kind: "income", text: raw };
  if (/\b(ricordami|devo|comprare|pagare|chiamare|inviare)\b/i.test(raw)) return { kind: "task", text: raw };

  return { kind: "note", text: raw };
}

function inferPriority(text: string): InboxDraft["priority"] {
  if (/\b(urgente|subito|asap|critico)\b/i.test(text)) return "urgent";
  if (/\b(importante|alta)\b/i.test(text)) return "high";
  if (/\b(bassa|quando puoi)\b/i.test(text)) return "low";
  return "medium";
}

function stripMeta(text: string) {
  return text
    .replace(/\b(oggi|domani|dopodomani|today|tomorrow)\b/gi, "")
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
    .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]20\d{2})?\b/g, "")
    .replace(/#([\p{L}\d_-]+)/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTags(text: string) {
  return Array.from(text.matchAll(/#([\p{L}\d_-]+)/gu)).map((m) => m[1].toLowerCase());
}

function extractAmount(text: string) {
  const match = text.match(/(?:€|eur|euro)?\s*(-?\d+(?:[,.]\d{1,2})?)\s*(?:€|eur|euro)?/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function extractDistance(text: string) {
  const match = text.match(/\b(\d+(?:[,.]\d+)?)\s*km\b/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function extractDuration(text: string) {
  const minutes = text.match(/\b(\d+)\s*(?:min|m)\b/i);
  if (minutes) return Number(minutes[1]);

  const hours = text.match(/\b(\d+(?:[,.]\d+)?)\s*(?:h|ore?)\b/i);
  return hours ? Math.round(Number(hours[1].replace(",", ".")) * 60) : null;
}

function extractCfu(text: string) {
  const match = text.match(/\b(\d{1,2})\s*cfu\b/i);
  return match ? Number(match[1]) : null;
}

function inferWorkoutType(text: string) {
  if (/\b(palestra|gym|forza)\b/i.test(text)) return "strength";
  if (/\b(bici|bike|cycling)\b/i.test(text)) return "cycling";
  if (/\b(camminata|walk)\b/i.test(text)) return "walk";
  return "run";
}

export function parseInboxText(raw: string): InboxDraft {
  const trimmed = raw.trim();
  const { kind, text } = inferKind(trimmed);
  const cleanTitle = stripMeta(text) || trimmed || "Elemento inbox";

  return {
    kind,
    title: cleanTitle,
    body: trimmed,
    amount: extractAmount(trimmed),
    date: inferDate(trimmed),
    priority: inferPriority(trimmed),
    tags: extractTags(trimmed),
    workoutType: inferWorkoutType(trimmed),
    distanceKm: extractDistance(trimmed),
    durationMinutes: extractDuration(trimmed),
    cfu: extractCfu(trimmed),
  };
}

export function toTiptapDoc(text: string) {
  return createTiptapDoc(text);
}
