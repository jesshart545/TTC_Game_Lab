import { NextResponse } from "next/server";

function readSecret(name: string) {
  const raw = process.env[name] || "";
  return raw.trim().replace(/^(['"])|(['"])$/g, "");
}

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
  const token = readSecret("AGNES_API_KEY");
  if (!token) return NextResponse.json({ error: "AGNES_API_KEY is not configured in Vercel." }, { status: 503 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const model = url.searchParams.get("model") || "agnes-video-2.5-flash";
  if (!id) return NextResponse.json({ error: "A video id is required." }, { status: 400 });

  const response = await fetch(`https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(id)}&model_name=${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: payload?.error || payload?.message || "Unable to read video generation status." }, { status: response.status });

  const outputUrl = extractVideoUrl(payload);

  const rawStatus = String(payload?.status || payload?.data?.status || payload?.state || "").toLowerCase();
  const status = ["completed","complete","succeeded","success","finished","done"].includes(rawStatus) ? "completed"
    : ["failed","error","cancelled","canceled"].includes(rawStatus) ? "failed"
    : rawStatus || (outputUrl ? "completed" : "processing");
  const rawProgress = payload?.progress ?? payload?.data?.progress ?? 0;
  const progress = typeof rawProgress === "string" ? Number(rawProgress.replace("%","")) : Number(rawProgress || 0);

  return NextResponse.json({
    status,
    progress,
    url: outputUrl,
    error: payload?.error?.message || payload?.error || payload?.data?.error || null,
    videoId: payload?.video_id || id,
    model: payload?.model || model,
  });
}
