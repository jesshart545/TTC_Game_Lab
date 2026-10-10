export async function waitForGeneratedVideo(
  videoId: string,
  model: string,
  onProgress?: (progress: number) => void,
  maxAttempts = 300,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`/api/generate-asset/status?id=${encodeURIComponent(videoId)}&model=${encodeURIComponent(model)}&provider=${encodeURIComponent((model.startsWith("fal-ai/wan/") || model.startsWith("alibaba/wan-3.0/")) ? "fal" : model === "gen4.5" ? "runway" : "agnes")}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    } catch {
      throw new Error("Video status could not be checked. Use Check video result to resume the saved request; do not generate another copy.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Unable to check video generation status.");

    const progress = Number(payload?.progress || 0);
    onProgress?.(progress);

    if (payload?.status === "completed" && payload?.url) return String(payload.url);
    if (payload?.status === "completed") throw new Error("The provider finished without a video URL. Use Check video result to retry retrieval.");
    if (payload?.status === "failed" || payload?.status === "error") {
      throw new Error(payload?.error || "Video generation failed.");
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error("The video is still processing. Use Check video result to resume the saved request; do not generate another copy.");
}
