import { NextResponse } from "next/server";

function extractVideoUrl(payload: any) {
  return String(
    payload?.metadata?.url ||
    payload?.url ||
    payload?.video_url ||
    payload?.output_url ||
    payload?.data?.metadata?.url ||
    payload?.data?.url ||
    "",
  ) || null;
}

export async function GET(request: Request) {
  const token = process.env.AGNES_API_KEY;
  if (!token) return NextResponse.json({ error: "AGNES_API_KEY is not configured in Vercel." }, { status: 503 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const model = url.searchParams.get("model") || "agnes-video-v2.0";
  if (!id) return NextResponse.json({ error: "A video id is required." }, { status: 400 });

  const response = await fetch(`https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(id)}&model_name=${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: payload?.error || payload?.message || "Unable to read video generation status." }, { status: response.status });

  const outputUrl = extractVideoUrl(payload);

  return NextResponse.json({
    status: payload?.status || "unknown",
    progress: Number(payload?.progress || 0),
    url: outputUrl,
    error: payload?.error || null,
    videoId: payload?.video_id || id,
    model: payload?.model || model,
  });
}
