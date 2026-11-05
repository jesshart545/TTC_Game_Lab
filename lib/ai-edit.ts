import { pollImageGeneration } from "./poll-image-generation";
import { pollForEditedVideoUrl } from "./video-edit-poll";

/**
 * AI edits of EXISTING media — the same pipeline Jewel's own media edits
 * run through, shared so the media editor's AI Edit section (restored to
 * the dialog at Jessica's direction, 2026-11-04: "I would rather it offer
 * the AI edit in there also, since the AI is the main editing tool") is
 * not a second implementation:
 *
 * - Images: POST /api/generate-asset with the source as promptImage —
 *   the exact call the project page's generateAsset funnel makes for one
 *   of Jewel's image actions carrying a sourceKey (server-side that
 *   selects fal-ai/nano-banana-2/edit) — then the shared
 *   pollImageGeneration until the finished URL lands. aspectRatio
 *   "auto" keeps the source's own shape, the edit model's default.
 * - Video: POST /api/edit-video {prompt, videoUrl}, then the shared
 *   pollForEditedVideoUrl — the same two steps one layer of Jewel's
 *   layered video edits runs (see runLayer in the project page).
 *
 * Both resolve with the finished media URL and throw an Error carrying
 * the provider's message on failure. Storing and naming the result is
 * the caller's save-as-new path, never done here. There is no AI
 * editing for audio — the same limit Jewel's pipeline states.
 */
export async function aiEditImage(sourceUrl: string, prompt: string, onStatus: (text: string) => void = () => {}): Promise<string> {
  const response = await fetch("/api/generate-asset", {
    signal: AbortSignal.timeout(180000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.trim(), type: "image", promptImage: sourceUrl, aspectRatio: "auto" }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI image edit failed.");
  if (data.url) return String(data.url);
  if (data.requestId) return pollImageGeneration(String(data.requestId), String(data.statusUrl || ""), String(data.responseUrl || ""), String(data.model || ""), onStatus);
  throw new Error("AI image edit returned no result.");
}

export async function aiEditVideo(sourceUrl: string, prompt: string): Promise<string> {
  const response = await fetch("/api/edit-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.trim(), videoUrl: sourceUrl }),
  });
  const output = await response.json().catch(() => ({}));
  if (!response.ok || !output.videoId) throw new Error(output.error || "Video editing returned no output.");
  return pollForEditedVideoUrl(String(output.videoId), String(output.model || "fal-ai/wan-vace-apps/video-edit"));
}
