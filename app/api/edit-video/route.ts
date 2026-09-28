import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, video_url: videoUrl }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return error(payload?.detail || payload?.error || payload?.message || "AI video edit failed.", response.status);
    const url = payload?.video?.url || payload?.url || payload?.video_url || "";
    if (!url) return error("The video editor returned no edited video.", 502);
    return NextResponse.json({ url, type: "video/mp4", model, provider: "fal" });
  } catch (e) {
    return error(e instanceof Error ? e.message : "AI video edit failed.");
  }
}
