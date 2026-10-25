import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function secret() { return (process.env.FAL_KEY || "").trim().replace(/^(['"])|(['"])$/g, ""); }
function error(message: unknown, status=500) { return NextResponse.json({ error: typeof message === "string" ? message : "AI video edit failed." }, { status }); }

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    if (!prompt) return error("Tell me what you want changed.", 400);
    if (!videoUrl) return error("A source video is required.", 400);
    const key = secret();
    if (!key) return error("FAL_KEY is not configured in Vercel.", 503);

    const model = "fal-ai/wan-vace-apps/video-edit";
    const response = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, video_url: videoUrl }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return error(payload?.detail || payload?.error || payload?.message || "AI video edit failed.", response.status);
    if (!payload?.request_id || !payload?.status_url || !payload?.response_url) return error("The video editor returned an incomplete task.", 502);
    const videoId = Buffer.from(JSON.stringify({
      id: payload.request_id, status: payload.status_url, result: payload.response_url,
    })).toString("base64url");
    return NextResponse.json({ status: "processing", videoId, type: "video/mp4", model, provider: "fal" });
  } catch (e) {
    return error(e instanceof Error ? e.message : "AI video edit failed.");
  }
}
