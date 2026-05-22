import type { AIProvider, ProviderConfig } from "./types";

// ── Provider registry ─────────────────────────────────────────────────────────
// Add a new provider here and it's automatically available to the router.
// No other file needs to change.

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    extraHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": process.env.GATEWAY_APP_TITLE || "AI Gateway",
    },
  },
  anthropic: {
    // Anthropic's API is OpenAI-compatible via /v1/messages but we call it
    // through the chat/completions shim for uniformity. If you need native
    // Anthropic features (extended thinking, vision, etc.) add a separate
    // executor strategy.
    baseURL: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    extraHeaders: {
      "anthropic-version": "2023-06-01",
    },
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GOOGLE_AI_API_KEY",
  },
  nvidia: {
    // NVIDIA NIM exposes an OpenAI-compatible endpoint
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKeyEnv: "NVIDIA_API_KEY",
  },
};

export function getProviderConfig(provider: AIProvider): ProviderConfig {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown AI provider: ${provider}`);
  return config;
}

export function getApiKey(provider: AIProvider): string {
  const config = getProviderConfig(provider);
  const key = process.env[config.apiKeyEnv];
  if (!key) throw new Error(`Missing env var ${config.apiKeyEnv} for provider ${provider}`);
  return key;
}
