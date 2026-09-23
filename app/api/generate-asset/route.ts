import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function readSecret(name: string) {
  const raw = process.env[name] || "";
  return raw.trim().replace(/^(['"])|(['"])$/g, "");
}

function extractImageUrl(payload: any) {
  const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) return String(item.url);
  if (payload?.url) return String(payload.url);
  return "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "image";
  if (!prompt) return jsonError("A prompt is required.", 400);

  if (type === "image") {
    const key = readSecret("AGNES_API_KEY");
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
    const runwayKey = readSecret("RUNWAYML_API_SECRET");
    if (!runwayKey) return jsonError("RUNWAYML_API_SECRET is not configured in Vercel.", 503);

    const model = "gen4.5";
    const response = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model,
        promptText: prompt,
        ratio: "1280:720",
        duration: 5,
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return jsonError(
        typeof payload?.error === "string" ? payload.error : payload?.error?.message || payload?.message || payload?.detail || (payload?.errors ? JSON.stringify(payload.errors) : "") || "Runway video generation failed.",
        response.status,
      );
    }

    const videoId = payload?.id || payload?.taskId || "";
    if (!videoId) return jsonError("Runway accepted the video request but returned no task id.", 502);

    const url = `/api/generate-asset/video?id=${encodeURIComponent(String(videoId))}&model=${encodeURIComponent(model)}&provider=runway`;
    return NextResponse.json({ type, status: "processing", videoId: String(videoId), url, model, provider: "runway" });
  }

  if (type === "voice") {
    const key = readSecret("ELEVENLABS_API_KEY");
    const voiceId = readSecret("ELEVENLABS_VOICE_ID");
    if (!key) return jsonError("ELEVENLABS_API_KEY is not configured in Vercel.", 503);
    if (!voiceId) return jsonError("ELEVENLABS_VOICE_ID is not configured in Vercel.", 503);
    const modelId = readSecret("ELEVENLABS_MODEL_ID") || "eleven_v3";
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
    const key = readSecret("GEMINI_API_KEY");
    if (!key) return jsonError("GEMINI_API_KEY is not configured in Vercel.", 503);

    const model = readSecret("LYRIA_MODEL") || "lyria-3-clip-preview";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        cache: "no-store",
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return jsonError(
        payload?.error?.message || payload?.message || "Google Lyria music generation failed.",
        response.status,
      );
    }

    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((part: any) => part?.inlineData?.data);
    if (!audioPart?.inlineData?.data) return jsonError("Lyria returned no audio output.", 502);

    const mimeType = audioPart.inlineData.mimeType || "audio/mpeg";
    const lyrics = parts
      .filter((part: any) => typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\\n")
      .trim();

    return NextResponse.json({
      type: "music",
      url: `data:${mimeType};base64,${audioPart.inlineData.data}`,
      model,
      lyrics,
    });
  }
  return jsonError("Unsupported asset type. Use image, video, voice, or music.", 400);
}
