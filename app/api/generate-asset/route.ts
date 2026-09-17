import { NextResponse } from "next/server";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function extractImageUrl(payload: any) {
  const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) return String(item.url);
  if (payload?.url) return String(payload.url);
  return "";
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
  );
}

async function waitForAgnesVideo(token: string, videoId: string, model: string, maxAttempts = 90) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(
      `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(model)}`,
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
      throw new Error(payload?.error || payload?.message || "Unable to check Agnes video status.");
    }

    const status = String(payload?.status || "").toLowerCase();
    const outputUrl = extractVideoUrl(payload);

    if (["completed", "succeeded", "success", "done"].includes(status) && outputUrl) {
      return outputUrl;
    }

    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(payload?.error || "Agnes video generation failed.");
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error("Agnes video generation is taking longer than expected. Please try again.");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "image";
  if (!prompt) return jsonError("A prompt is required.", 400);

  if (type === "image") {
    const key = process.env.AGNES_API_KEY;
    if (!key) return jsonError("AGNES_API_KEY is not configured in Vercel.", 503);
    const response = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "agnes-image-2.5-flash",
        prompt,
        size: "1024x768",
        n: 1,
        return_base64: true,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.error?.message || payload?.message || "Agnes image generation failed.", response.status);
    const url = extractImageUrl(payload);
    if (!url) return jsonError("Agnes returned no image output.", 502);
    return NextResponse.json({ url, type: "image", model: "agnes-image-2.5-flash" });
  }

  if (type === "video") {
    const key = process.env.AGNES_API_KEY;
    if (!key) return jsonError("AGNES_API_KEY is not configured in Vercel.", 503);

    const model = "agnes-video-2.5-flash";
    const response = await fetch("https://apihub.agnes-ai.com/v1/videos", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        mode: "text",
        seconds: 5,
        size: "720P",
        aspect_ratio: "16:9",
        n: 1,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.error?.message || payload?.message || "Agnes video generation failed.", response.status);

    const videoId = payload?.video_id || payload?.id || payload?.data?.video_id || payload?.data?.id || "";
    if (!videoId) return jsonError("Agnes accepted the video request but returned no video id.", 502);

    try {
      const url = await waitForAgnesVideo(key, String(videoId), model);
      return NextResponse.json({ type, status: "completed", videoId, url, model });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Agnes video generation failed.", 502);
    }
  }

  if (type === "voice") {
    const key = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!key) return jsonError("ELEVENLABS_API_KEY is not configured in Vercel.", 503);
    if (!voiceId) return jsonError("ELEVENLABS_VOICE_ID is not configured in Vercel.", 503);
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, model_id: modelId }),
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return jsonError(message || "ElevenLabs voice generation failed.", response.status);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const audioBase64 = Buffer.from(bytes).toString("base64");
    return NextResponse.json({ type, url: `data:audio/mpeg;base64,${audioBase64}`, model: modelId });
  }

  if (type === "music") return jsonError("Music generation is temporarily disabled. Connect a self-hosted ACE-Step 1.5 server to enable it.", 503);
  return jsonError("Unsupported asset type. Use image, video, voice, or music.", 400);
}
