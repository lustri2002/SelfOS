/**
 * Configurazione AI — modifica SOLO questo file per cambiare provider/modello.
 *
 * Ogni "use case" ha:
 *  - provider:   "anthropic" | "openai"  (espandibile)
 *  - model:      nome del modello da invocare
 *  - apiKeyEnv:  nome della variabile d'ambiente che contiene la API key
 *  - baseUrl:    URL base dell'API (cambialo per proxy/gateway)
 *  - maxTokens:  token massimi per la risposta
 *  - apiVersion: versione API (solo Anthropic)
 */

export type AIProvider = "anthropic" | "openai";

export interface AIUseCaseConfig {
  provider: AIProvider;
  model: string;
  apiKeyEnv: string;
  baseUrl: string;
  maxTokens: number;
  apiVersion?: string;
}

export const aiConfig: Record<string, AIUseCaseConfig> = {
  /** Analisi screenshot (Vision) — richiede supporto immagini */
  analyze: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 1024,
    apiVersion: "2023-06-01",
  },

  /** Coach AI — generazione piani di allenamento */
  coach: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 4096,
    apiVersion: "2023-06-01",
  },

  /** Review AI — parere del Coach sul singolo allenamento appena salvato,
   *  con contesto degli ultimi 30 allenamenti per valutare i progressi.
   *  Uso Haiku: risposta breve, costo basso, chiamata frequente. */
  review: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 700,
    apiVersion: "2023-06-01",
  },
};
