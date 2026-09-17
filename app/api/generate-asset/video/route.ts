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
  );
}

function errorResponse(message: string, status = 502) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const token = process.env.AGNES_API_KEY;
  if (!token) return errorResponse("AGNES_API_KEY is not configured in Vercel.", 503);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const model = url.searchParams.get("model") || "agnes-video-2.5-flash";
  if (!id) return errorResponse("A video id is required.", 400);

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch(
      `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(id)}&model_name=${encodeURIComponent(model)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      return errorResponse(payload?.error || payload?.message || "Unable to check Agnes video status.", response.status);
    }

    const status = String(payload?.status || "").toLowerCase();
    const outputUrl = extractVideoUrl(payload);

    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      return errorResponse(payload?.error || "Agnes video generation failed.", 502);
    }

    if (["completed", "succeeded", "success", "done"].includes(status) && outputUrl) {
      const media = await fetch(outputUrl, { cache: "no-store" });
      if (!media.ok || !media.body) {
        return errorResponse("Agnes finished the video, but the video file could not be retrieved.", 502);
      }

      const headers = new Headers();
      headers.set("Content-Type", media.headers.get("content-type") || "video/mp4");
      headers.set("Cache-Control", "no-store, max-age=0");
      const length = media.headers.get("content-length");
      if (length) headers.set("Content-Length", length);
      return new Response(media.body, { status: 200, headers });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return errorResponse("Video generation is still in progress. Please retry the video asset once it finishes.", 202);
}
