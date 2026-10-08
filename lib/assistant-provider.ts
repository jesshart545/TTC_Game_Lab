/** Server-only language-model configuration; existing Agnes settings remain the default. */
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
      : Array.from(new Set(["agnes-2.5-flash", configuredModel].filter(model => model && !model.startsWith("cpk-")))),
  };
}
