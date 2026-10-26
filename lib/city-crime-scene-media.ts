/**
 * Inline media generation for the City Crime Scene builder: one call runs a
 * single media slot end to end through the app's EXISTING generation stack —
 * POST /api/generate-asset, the hardened status pollers, and
 * storeGeneratedAsset into the project's media — and hands back the stored
 * asset so the caller can write its key onto the case item and register it in
 * the project. No parallel generation system: images poll through
 * lib/poll-generated-image.ts, videos through lib/video-generation.ts (the
 * same poller the project page's generate flow uses), and storage is the
 * same /api/assets path every generated asset takes.
 *
 * Failures throw with the provider's own message (credit problems are
 * already converted server-side into a plain "temporarily unavailable"
 * message with the admin notified — balances and top-ups are never part of
 * what this surfaces). Nothing is registered or attached on failure.
 */
import type { ProjectAsset } from "./project";
import { storeGeneratedAsset } from "./asset-store";
import { pollForGeneratedImageUrl } from "./poll-generated-image";
import { waitForGeneratedVideo } from "./video-generation";

export type CcssMediaContext = {
  projectId: string;
  /** Add a finished asset to the project and persist it (the host components' persist path). */
  registerAsset: (asset: ProjectAsset) => void;
  /** Resolve a saved asset key (e.g. a helper's uploaded reference) to a usable URL. */
  resolveAssetUrl: (key: string) => Promise<string | undefined>;
};

export type CcssInlineMediaKind = "image" | "video" | "sfx";

export interface CcssInlineMediaRequest {
  kind: CcssInlineMediaKind;
  prompt: string;
  /** Asset name for the stored result (shown in the project's media). */
  name: string;
  /** Saved asset key of a reference image (a helper's uploaded media). Used
   *  exactly as /api/generate-asset accepts it: image generation becomes a
   *  reference-based edit, video generation becomes image-to-video. */
  referenceKey?: string;
}

export async function generateCcssMedia(
  request: CcssInlineMediaRequest,
  context: CcssMediaContext,
  onStatus?: (text: string) => void,
): Promise<ProjectAsset> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error("Write the prompt for this media first.");
  let promptImage = "";
  if (request.referenceKey) {
    promptImage = (await context.resolveAssetUrl(request.referenceKey).catch(() => undefined)) || "";
    if (!promptImage) throw new Error("The reference media for this helper could not be loaded, so generation did not start. Check the uploaded media key, or clear it to generate without a reference.");
  }
  onStatus?.(request.kind === "image" ? "Submitting the image…" : request.kind === "video" ? "Submitting the video…" : "Generating the audio clip…");
  const response = await fetch("/api/generate-asset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(request.kind === "video" ? 60000 : 180000),
    body: JSON.stringify({
      prompt,
      type: request.kind,
      ...(promptImage ? { promptImage } : {}),
      ...(request.kind === "image" ? { aspectRatio: "16:9" } : {}),
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Generation failed.");

  let url = typeof data.url === "string" ? data.url : "";
  if (request.kind === "image") {
    if (!data.requestId) throw new Error("The image request was accepted but returned no tracking id.");
    url = await pollForGeneratedImageUrl(String(data.requestId), String(data.statusUrl || ""), String(data.responseUrl || ""), String(data.model || ""), {
      onProgress: queuePosition => onStatus?.(queuePosition != null ? `Image queued: ${queuePosition} ahead…` : "Image is generating…"),
    });
  } else if (request.kind === "video") {
    if (!data.videoId) throw new Error("The video request was accepted but returned no tracking id.");
    try {
      url = await waitForGeneratedVideo(String(data.videoId), String(data.model || ""), progress => onStatus?.(`Video generating… ${Math.round(progress)}%`));
    } catch (error) {
      // The shared video poller's deadline/unreachable messages point at the
      // project page's "Check video result" resume, which does not exist in
      // the builder. Translate exactly those into builder-truthful wording:
      // nothing was stored or attached, and retrying starts a new request.
      const message = error instanceof Error ? error.message : "Video generation failed.";
      if (/Check video result/.test(message)) throw new Error("The video's status could not be confirmed from the builder, so nothing was attached. The request may still finish with the provider — or press Generate again to start a new one.");
      throw error;
    }
  }
  if (!url) throw new Error("Generation finished without a usable result.");

  onStatus?.("Saving the finished media to this project…");
  const stored = await storeGeneratedAsset(context.projectId, { name: request.name, type: String(data.model || request.kind), url });
  context.registerAsset(stored);
  return stored;
}
