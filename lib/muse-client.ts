/**
 * Minimal client for the Meta Model API (Muse Spark), used by the Jewel
 * agent route. The API is OpenAI-compatible and the model returns text only.
 * The key is read from META_API_KEY (MODEL_API_KEY is accepted as a fallback
 * name) and is never logged or returned anywhere.
 */

export class MuseApiError extends Error {
  status?: number;
  providerMessage: string;
  constructor(message: string, status?: number, providerMessage = "") {
    super(message);
    this.name = "MuseApiError";
    this.status = status;
    this.providerMessage = providerMessage;
  }
}

export class MuseConnectionError extends Error {
  constructor(message = "The Muse service did not respond.") {
    super(message);
    this.name = "MuseConnectionError";
  }
}

function readKey(): string {
  const raw = process.env.META_API_KEY || process.env.MODEL_API_KEY || "";
  return raw.trim().replace(/^(['"])|(['"])$/g, "");
}

export function museConfigured(): boolean {
  return readKey().length > 0;
}

export type MuseMessage = { role: "system" | "user" | "assistant"; content: string };

export async function museChatCompletion(
  messages: MuseMessage[],
  options: { temperature?: number; maxTokens?: number; jsonObject?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const key = readKey();
  if (!key) throw new MuseApiError("META_API_KEY is not configured.", 503);
  let response: Response;
  try {
    response = await fetch("https://api.meta.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Standard tier only: the -contributor variant trains on user data.
        model: "muse-spark-1.3",
        messages,
        temperature: options.temperature ?? 0.3,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.jsonObject ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 90000),
      cache: "no-store",
    });
  } catch (error) {
    throw new MuseConnectionError(error instanceof Error ? error.message : undefined);
  }
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = String(payload?.error?.message || payload?.message || "");
    throw new MuseApiError(providerMessage || `Muse request failed (HTTP ${response.status}).`, response.status, providerMessage);
  }
  return String(payload?.choices?.[0]?.message?.content || "");
}
