/**
 * Utility per chiamare le AI API in modo provider-agnostico.
 * Legge la configurazione da config/ai.ts.
 */

import type { AIUseCaseConfig } from "@/config/ai";

/** Errori specifici per crediti esauriti */
const CREDIT_ERROR_PATTERNS = [
  "credit",
  "insufficient_quota",
  "rate_limit",
  "billing",
  "exceeded your current quota",
  "overloaded",
  "insufficient_funds",
];

export function isCreditExhaustedError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return CREDIT_ERROR_PATTERNS.some((p) => lower.includes(p));
}

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string | AIContentBlock[];
}

export interface AIContentBlock {
  type: "text" | "image";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export interface AICallResult {
  text: string;
  error?: string;
  isCreditError?: boolean;
}

/**
 * Chiama il provider AI configurato per un dato use case.
 */
export async function callAI(
  config: AIUseCaseConfig,
  messages: AIMessage[],
  systemPrompt?: string,
): Promise<AICallResult> {
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    return {
      text: "",
      error: `${config.apiKeyEnv} non configurata. Aggiungi la chiave API nel file .env.local`,
    };
  }

  try {
    if (config.provider === "anthropic") {
      return await callAnthropic(config, apiKey, messages, systemPrompt);
    } else if (config.provider === "openai") {
      return await callOpenAI(config, apiKey, messages, systemPrompt);
    } else {
      return { text: "", error: `Provider "${config.provider}" non supportato` };
    }
  } catch (err) {
    console.error("[AI]", err instanceof Error ? err.message : "unknown error");
    return { text: "", error: "Errore di connessione al provider AI" };
  }
}

/* ── Anthropic ────────────────────────────────────────────── */

async function callAnthropic(
  config: AIUseCaseConfig,
  apiKey: string,
  messages: AIMessage[],
  systemPrompt?: string,
): Promise<AICallResult> {
  // Convert messages to Anthropic format (filter out system role)
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    messages: anthropicMessages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": config.apiVersion || "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const rawMsg = errorBody?.error?.message || `Status ${response.status}`;
    // Log details server-side only — never forward raw provider messages to the client
    console.error("[Anthropic]", response.status, rawMsg);

    const creditError = isCreditExhaustedError(rawMsg);
    return {
      text: "",
      error: creditError
        ? "Crediti API esauriti"
        : "Errore di comunicazione con il provider AI",
      isCreditError: creditError,
    };
  }

  const result = await response.json();
  const textContent = result.content?.[0]?.text;

  if (!textContent) {
    return { text: "", error: "Nessuna risposta dal modello" };
  }

  return { text: textContent };
}

/* ── OpenAI ───────────────────────────────────────────────── */

async function callOpenAI(
  config: AIUseCaseConfig,
  apiKey: string,
  messages: AIMessage[],
  systemPrompt?: string,
): Promise<AICallResult> {
  const openaiMessages: { role: string; content: unknown }[] = [];

  if (systemPrompt) {
    openaiMessages.push({ role: "system", content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === "system") continue;

    if (typeof m.content === "string") {
      openaiMessages.push({ role: m.role, content: m.content });
    } else {
      // Convert content blocks to OpenAI format
      const parts = (m.content as AIContentBlock[]).map((block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text };
        } else if (block.type === "image" && block.source) {
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
            },
          };
        }
        return { type: "text" as const, text: "" };
      });
      openaiMessages.push({ role: m.role, content: parts });
    }
  }

  const baseUrl = config.baseUrl || "https://api.openai.com";

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: openaiMessages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const rawMsg = errorBody?.error?.message || `Status ${response.status}`;
    // Log details server-side only — never forward raw provider messages to the client
    console.error("[OpenAI]", response.status, rawMsg);

    const creditError = isCreditExhaustedError(rawMsg);
    return {
      text: "",
      error: creditError
        ? "Crediti API esauriti"
        : "Errore di comunicazione con il provider AI",
      isCreditError: creditError,
    };
  }

  const result = await response.json();
  const textContent = result.choices?.[0]?.message?.content;

  if (!textContent) {
    return { text: "", error: "Nessuna risposta dal modello" };
  }

  return { text: textContent };
}
