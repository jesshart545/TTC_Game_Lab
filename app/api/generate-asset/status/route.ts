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
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const model = url.searchParams.get("model") || "agnes-video-2.5-flash";
  const provider = url.searchParams.get("provider") || "agnes";
  if (!id) return NextResponse.json({ error: "A video id is required." }, { status: 400 });

  if (provider === "fal") {
    const key = readSecret("FAL_KEY");
    if (!key) return NextResponse.json({ error: "fal.ai is not configured." }, { status: 503 });
    let task: { id: string; status: string; result: string };
    try {
      if (id.length > 4000) throw new Error();
      task = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
      if (!/^[a-zA-Z0-9-]+$/.test(task.id)) throw new Error();
      for (const value of [task.status, task.result]) {
        const endpoint = new URL(value);
        if (endpoint.origin !== "https://queue.fal.run" || endpoint.username || endpoint.password
          || !endpoint.pathname.startsWith("/fal-ai/wan/")
          || !endpoint.pathname.includes(`/requests/${task.id}`)) throw new Error();
      }
    } catch { return NextResponse.json({ error: "Invalid animation task." }, { status: 400 }); }
    const headers = { Authorization: `Key ${key}` };
    const response = await fetch(task.status, { headers, cache: "no-store", redirect: "error" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: payload?.detail || payload?.error || "Unable to check animation progress." }, { status: response.status });
    if (payload?.error || ["FAILED", "CANCELED", "CANCELLED"].includes(payload?.status)) {
      return NextResponse.json({ status: "failed", error: payload.error || "Image animation failed." });
    }
    if (payload?.status !== "COMPLETED") return NextResponse.json({ status: "processing", progress: payload?.status === "IN_PROGRESS" ? 50 : 0 });
    const result = await fetch(task.result, { headers, cache: "no-store", redirect: "error" });
    const output = await result.json().catch(() => ({}));
    if (!result.ok || !output?.video?.url) return NextResponse.json({ status: "failed", error: output?.detail || output?.error || "Animation finished without a video." });
    return NextResponse.json({ status: "completed", progress: 100, url: output.video.url, model, provider: "fal" });
  }

  if (provider === "runway") {
    const runwayKey = readSecret("RUNWAYML_API_SECRET");
    if (!runwayKey) return NextResponse.json({ error: "RUNWAYML_API_SECRET is not configured in Vercel." }, { status: 503 });
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        "X-Runway-Version": "2024-11-06",
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: payload?.error || payload?.message || "Unable to read Runway video status." }, { status: response.status });
    const rawStatus = String(payload?.status || "").toUpperCase();
    const status = rawStatus === "SUCCEEDED" ? "completed"
      : ["FAILED","CANCELED","CANCELLED"].includes(rawStatus) ? "failed"
      : "processing";
    const output = Array.isArray(payload?.output) ? payload.output[0] : payload?.output;
    return NextResponse.json({
      status,
      progress: status === "completed" ? 100 : Number(payload?.progress || 0),
      url: output || null,
      error: payload?.failure || payload?.failureCode || null,
      videoId: id,
      model,
      provider: "runway",
    });
  }

  const token = readSecret("AGNES_API_KEY");
  if (!token) return NextResponse.json({ error: "AGNES_API_KEY is not configured in Vercel." }, { status: 503 });

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
