/**
 * Agnes media generation (image + video) — the fallback behind fal in
 * app/api/generate-asset/route.ts, engaged when fal fails provider-side
 * (see the trigger discipline there and in lib/gradio-space.ts's callers).
 *
 * The connection settings are the site's existing Agnes ones, read exactly
 * as the original AI chat reads them (lib/assistant-provider.ts):
 * TTC_AI_API_KEY || AGNES_API_KEY against TTC_AI_BASE_URL ||
 * https://apihub.agnes-ai.com/v1. Media endpoints hang off that same base:
 * POST /v1/images/generations and POST /v1/videos.
 *
 * Model rules that matter:
 * - Image is agnes-image-2.5-flash; video is agnes-video-2.5-flash — the
 *   FLASH video model specifically. The non-Flash agnes-video-2.5 is paid
 *   per second and must never be substituted here.
 * - Flash video is 720P-only (any other size is an HTTP 400), takes its
 *   duration as a `seconds` string from "4" to "12", and requires a
 *   `mode`: "text", or "keyframe" with a publicly reachable first_frame
 *   URL (data/blob references cannot be fetched by Agnes, so a video
 *   whose reference is not an HTTPS URL does not engage this fallback
 *   rather than silently dropping the reference).
 */
import { assistantProvider } from "./assistant-provider";

export const AGNES_IMAGE_MODEL = "agnes-image-2.5-flash";
export const AGNES_VIDEO_MODEL = "agnes-video-2.5-flash";

function agnesBase(): string {
  try {
    return assistantProvider().url.replace(/\/chat\/completions$/, "");
  } catch {
    return "";
  }
}

function agnesKey(): string {
  try {
    return assistantProvider().key;
  } catch {
    return "";
  }
}

function providerMessage(payload: any): string {
  return String(payload?.error?.message || payload?.detail || payload?.error || payload?.message || "");
}

/** fal image resolutions mapped to the closest Agnes size tier at or above. */
const IMAGE_SIZE_BY_RESOLUTION: Record<string, string> = {
  "0.5K": "1K", "1K": "1K", "2K": "2K", "4K": "4K",
};
const AGNES_IMAGE_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"];

/**
 * One synchronous Agnes image generation. Resolves with the result image
 * as a hosted URL, or as a data URI when Agnes returns Base64 despite the
 * URL request. Throws on any failure — the caller surfaces the primary
 * provider's failure instead.
 */
export async function generateAgnesImage(input: {
  prompt: string;
  referenceImage?: string;
  resolution?: string;
  aspectRatio?: string;
}): Promise<{ url: string }> {
  const key = agnesKey();
  const base = agnesBase();
  if (!key || !base) throw new Error("Agnes media is not configured.");
  const ratio = AGNES_IMAGE_RATIOS.includes(String(input.aspectRatio || "")) ? String(input.aspectRatio) : "16:9";
  const size = IMAGE_SIZE_BY_RESOLUTION[String(input.resolution || "")] || "2K";
  const response = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AGNES_IMAGE_MODEL,
      prompt: input.prompt,
      size,
      ratio,
      ...(input.referenceImage ? { image: [input.referenceImage] } : {}),
      extra_body: { response_format: "url" },
    }),
    signal: AbortSignal.timeout(150000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(providerMessage(payload) || `Agnes image generation failed (HTTP ${response.status}).`);
  }
  const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (item?.url) return { url: String(item.url) };
  if (item?.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };
  if (payload?.url) return { url: String(payload.url) };
  throw new Error("Agnes image generation returned no image.");
}

/**
 * Agnes image results are synchronous, but the generate-asset clients poll
 * image-status by request id. The finished result URL therefore travels
 * as the request id (base64url), and the image-status route's Agnes
 * branch decodes it straight back into a completed result — the same
 * provider-branch pattern the music-status route uses for ACE-Step jobs.
 */
export function encodeAgnesImageResultId(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

export function decodeAgnesImageResultId(id: string): string {
  if (!id || !/^[\w-]+$/.test(id)) return "";
  try {
    const decoded = Buffer.from(id, "base64url").toString("utf8");
    return /^https:\/\//i.test(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

/**
 * Submit one Agnes Flash video task. Returns the task's video_id and the
 * duration actually submitted (clamped to the Flash "4"–"12" second
 * range — a shorter clip beats a failed generation while the primary
 * provider is down), or null when Agnes is unconfigured, unreachable, or
 * cannot take this request (including a reference image it cannot fetch).
 * Polling the task is the existing /api/generate-asset/status route's
 * Agnes branch, keyed by model exactly like its other Agnes jobs.
 */
export async function submitAgnesVideo(input: {
  prompt: string;
  promptImage?: string;
  durationSeconds: number;
}): Promise<{ videoId: string; durationSeconds: number } | null> {
  const key = agnesKey();
  const base = agnesBase();
  if (!key || !base) return null;
  const reference = String(input.promptImage || "");
  if (reference && !/^https:\/\//i.test(reference)) return null;
  const seconds = Math.min(12, Math.max(4, Math.round(input.durationSeconds)));
  try {
    const response = await fetch(`${base}/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AGNES_VIDEO_MODEL,
        prompt: input.prompt,
        mode: reference ? "keyframe" : "text",
        seconds: String(seconds),
        size: "720P",
        aspect_ratio: "16:9",
        n: 1,
        ...(reference ? { first_frame: reference } : {}),
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    const videoId = payload?.video_id || payload?.id || payload?.task_id;
    if (!videoId) return null;
    return { videoId: String(videoId), durationSeconds: seconds };
  } catch {
    return null;
  }
}
