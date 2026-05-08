/**
 * AI configuration. Change this file to switch provider or model.
 *
 * Each use case defines:
 *  - provider:   "anthropic" | "openai"
 *  - model:      provider model name
 *  - apiKeyEnv:  environment variable containing the API key
 *  - baseUrl:    API base URL, customizable for proxies or gateways
 *  - maxTokens:  maximum response tokens
 *  - apiVersion: API version, Anthropic only
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
  /** Screenshot analysis. Requires vision support. */
  analyze: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 1024,
    apiVersion: "2023-06-01",
  },

  /** AI Coach. Generates weekly training plans. */
  coach: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 4096,
    apiVersion: "2023-06-01",
  },

  /** AI Review. Short coach feedback for a single workout, using
   *  recent history as context. Haiku keeps frequent calls cheaper. */
  review: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    maxTokens: 700,
    apiVersion: "2023-06-01",
  },
};
