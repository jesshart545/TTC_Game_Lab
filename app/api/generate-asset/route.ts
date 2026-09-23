import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonError(message: unknown, status = 500) {
  const format = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(format).filter(Boolean).join(" | ");
    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const location = Array.isArray(item.loc) ? item.loc.join(".") : "";
      const detail = typeof item.msg === "string" ? item.msg : typeof item.message === "string" ? item.message : "";
      if (detail) return location ? `${location}: ${detail}` : detail;
      try { return JSON.stringify(value); } catch { return "Unknown API error"; }
    }
    return String(value ?? "Unknown API error");
  };
  return NextResponse.json({ error: format(message) }, { status });
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
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const model = "fal-ai/minimax-music/v2.6";
    const stylePrompt = prompt.length >= 10 ? prompt.slice(0, 2000) : `${prompt} cinematic music`;

    const submitResponse = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: stylePrompt,
        lyrics: "",
        lyrics_optimizer: true,
        is_instrumental: false,
        audio_setting: { sample_rate: "44100", bitrate: "256000", format: "mp3" },
      }),
      cache: "no-store",
    });

    const submitPayload = await submitResponse.json().catch(() => ({}));
    if (!submitResponse.ok) {
      const falError =
        typeof submitPayload?.detail === "string"
          ? submitPayload.detail
          : typeof submitPayload?.message === "string"
            ? submitPayload.message
            : typeof submitPayload?.error === "string"
              ? submitPayload.error
              : submitPayload?.detail || submitPayload?.error
                ? JSON.stringify(submitPayload.detail || submitPayload.error)
                : "fal music generation failed.";
      return jsonError(falError, submitResponse.status);
    }

    const requestId = submitPayload?.request_id;
    if (!requestId) return jsonError("fal accepted the music request but returned no request id.", 502);

    const resultUrl = submitPayload?.response_url || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}`;
    const statusUrl = submitPayload?.status_url || `https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}/status`;

    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await fetch(statusUrl, {
        headers: { Authorization: `Key ${key}` },
        cache: "no-store",
      });
      const statusPayload = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) {
        return jsonError(statusPayload?.detail || statusPayload?.message || "Unable to check fal music status.", statusResponse.status);
      }
      if (statusPayload?.status === "COMPLETED") {
        const resultResponse = await fetch(resultUrl, {
          headers: { Authorization: `Key ${key}` },
          cache: "no-store",
        });
        const resultPayload = await resultResponse.json().catch(() => ({}));
        if (!resultResponse.ok) {
          return jsonError(resultPayload?.detail || resultPayload?.message || "Unable to retrieve fal music result.", resultResponse.status);
        }
        const audioUrl = resultPayload?.audio?.url;
        if (!audioUrl) return jsonError("fal completed the song but returned no audio URL.", 502);
        return NextResponse.json({ type: "music", url: String(audioUrl), model, provider: "fal" });
      }
      if (statusPayload?.status === "FAILED") {
        return jsonError(statusPayload?.error || "fal music generation failed.", 502);
      }
    }

    return jsonError("fal music generation is taking longer than expected. Please try again.", 504);
  }

  return jsonError("Unsupported asset type. Use image, video, voice, or music.", 400);
}
