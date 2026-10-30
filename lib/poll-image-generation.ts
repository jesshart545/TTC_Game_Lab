// Polls fal.ai queue for a submitted image generation until it completes,
// fails, or times out. Calls onStatus for progress updates.
export async function pollImageGeneration(
  requestId: string,
  statusUrl: string,
  responseUrl: string,
  model: string,
  onStatus: (text: string) => void,
): Promise<string> {
  onStatus("Image queued with fal.ai. Waiting for the finished image…");
  const startedAt = Date.now();
  const elapsed = () => { const s = Math.floor((Date.now() - startedAt) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} elapsed`; };
  let completed = false;
  let url = "";
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`/api/generate-asset/image-status?id=${encodeURIComponent(requestId)}&statusUrl=${encodeURIComponent(statusUrl)}&responseUrl=${encodeURIComponent(responseUrl)}&model=${encodeURIComponent(model)}`, { cache: "no-store" });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) throw new Error(typeof statusData.error === "string" ? statusData.error : "Unable to check image generation status.");
    if (statusData.status === "failed") throw new Error(statusData.error || "Image generation failed.");
    if (statusData.status === "completed" && statusData.url) {
      url = String(statusData.url);
      completed = true;
      break;
    }
    if (attempt % 10 === 0) onStatus(statusData.queuePosition != null ? `Image queued: ${statusData.queuePosition} ahead… ${elapsed()}.` : `Image is still generating… ${elapsed()}.`);
  }
  if (!completed) throw new Error("Image is still processing on fal.ai. The request may complete later; please avoid submitting duplicate generations.");
  return url;
}
