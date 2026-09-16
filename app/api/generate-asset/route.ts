import { NextResponse } from "next/server";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
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
        model: "agnes-image-2.1-flash",
        prompt,
        size: "1024x1024",
        n: 1,
        extra_body: { response_format: "url" },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.error?.message || payload?.message || "Agnes image generation failed.", response.status);
    const item = Array.isArray(payload?.data) ? payload.data[0] : null;
    const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
    if (!url) return jsonError("Agnes returned no image.", 502);
    return NextResponse.json({ url, type, model: "agnes-image-2.1-flash" });
  }

  if (type === "video") {
    const key = process.env.AGNES_API_KEY;
    if (!key) return jsonError("AGNES_API_KEY is not configured in Vercel.", 503);
    const response = await fetch("https://apihub.agnes-ai.com/v1/videos", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "agnes-video-v2.0", prompt, width: 1152, height: 768, num_frames: 121, frame_rate: 24 }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.error?.message || payload?.message || "Agnes video generation failed.", response.status);
    return NextResponse.json({ type, status: "pending", videoId: payload?.video_id || payload?.id || "", model: "agnes-video-v2.0" });
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

  if (type === "music") {
    const baseUrl = process.env.HEARTMULA_API_URL?.replace(/\/$/, "");
    if (!baseUrl) return jsonError("HEARTMULA_API_URL is not configured in Vercel.", 503);
    const response = await fetch(`${baseUrl}/generate/music`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lyrics: body?.lyrics || prompt,
        tags: body?.tags || "cinematic, energetic, electronic",
        max_length_ms: Number(body?.max_length_ms || 120000),
        temperature: Number(body?.temperature || 1),
        topk: Number(body?.topk || 50),
        cfg_scale: Number(body?.cfg_scale || 1.5),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.detail || payload?.error || "HeartMuLa music generation failed.", response.status);
    return NextResponse.json({ ...payload, type, model: "HeartMuLa" });
  }

  return jsonError("Unsupported asset type. Use image, video, voice, or music.", 400);
}
