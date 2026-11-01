/**
 * Server-only language-model configuration; existing Agnes settings remain the default.
 * This module also carries the chat-completion helper for the original AI
 * provider, mirroring lib/muse-client.ts so routes can fall back to it when
 * their primary provider cannot produce a message.
 */
export function assistantProvider() {
  const base = (process.env.TTC_AI_BASE_URL || "https://apihub.agnes-ai.com/v1").trim().replace(/\/+$/, "");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Configure a secure AI base URL without credentials or query parameters.");
  const key = (process.env.TTC_AI_API_KEY || process.env.AGNES_API_KEY || "").trim();
  const configuredModel = (process.env.TTC_AI_MODEL || process.env.AGNES_MODEL || "").trim();
  return {
    url: `${base}/chat/completions`, key,
    models: process.env.TTC_AI_BASE_URL || process.env.TTC_AI_MODEL
      ? [configuredModel || "agnes-2.5-flash"]
      : Array.from(new Set([configuredModel, "agnes-2.5-flash"].filter(model => model && !model.startsWith("cpk-")))),
  };
}

export function assistantConfigured(): boolean {
  try {
    return assistantProvider().key.length > 0;
  } catch {
    return false;
  }
}

export class AssistantApiError extends Error {
  status?: number;
  providerMessage: string;
  constructor(message: string, status?: number, providerMessage = "") {
    super(message);
    this.name = "AssistantApiError";
    this.status = status;
    this.providerMessage = providerMessage;
  }
}

export class AssistantConnectionError extends Error {
  constructor(message = "The AI service did not respond.") {
    super(message);
    this.name = "AssistantConnectionError";
  }
}

export type AssistantMessage = { role: string; content: string };

/**
 * One chat completion against the original AI provider, iterating its
 * configured models exactly like /api/ai does: an unavailable-model reply, a
 * 429, or a 5xx moves on to the next model; each attempt times out at 60s.
 * Returns the reply text; throws AssistantApiError on an HTTP failure or
 * AssistantConnectionError when no attempt produced a response.
 */
export async function assistantChatCompletion(
  messages: AssistantMessage[],
  options: { temperature?: number; maxTokens?: number; jsonObject?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const provider = assistantProvider();
  const key = provider.key;
  if (!key) throw new AssistantApiError("AGNES_API_KEY is not configured.", 503);
  let response: Response | null = null;
  let payload: any = null;
  let connectionFailed = false;
  for (const model of provider.models) {
    try {
      response = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          ...(options.jsonObject ? { response_format: { type: "json_object" } } : {}),
          temperature: options.temperature ?? 0.3,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60000),
        cache: "no-store",
      });
      payload = await response.json().catch(() => ({}));
      if (response.ok) return String(payload?.choices?.[0]?.message?.content || "");
      const providerMessage = String(payload?.error?.message || payload?.message || "");
      const unavailableModel = /no available channel|model.*not.*available|unsupported model/i.test(providerMessage);
      const retryable = unavailableModel || response.status === 429 || response.status >= 500;
      if (!retryable) break;
    } catch {
      response = null;
      connectionFailed = true;
    }
  }
  if (connectionFailed && !response) throw new AssistantConnectionError();
  const providerMessage = String(payload?.error?.message || payload?.message || "");
  throw new AssistantApiError(providerMessage || `AI request failed (HTTP ${response?.status ?? "unknown"}).`, response?.status, providerMessage);
}
