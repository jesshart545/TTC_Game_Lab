export async function waitForGeneratedVideo(
  videoId: string,
  model: string,
  onProgress?: (progress: number) => void,
  maxAttempts = 90,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`/api/generate-asset/status?id=${encodeURIComponent(videoId)}&model=${encodeURIComponent(model)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Unable to check video generation status.");

    const progress = Number(payload?.progress || 0);
    onProgress?.(progress);

    if (payload?.status === "completed" && payload?.url) return String(payload.url);
    if (payload?.status === "failed" || payload?.status === "error") {
      throw new Error(payload?.error || "Agnes video generation failed.");
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error("Video generation is taking longer than expected. Please try again.");
}
