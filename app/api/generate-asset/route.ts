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
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);
    const referenceImage = typeof body?.promptImage === "string" ? body.promptImage.trim() : "";
    if (referenceImage && !/^https:\/\//i.test(referenceImage) && !/^data:image\//i.test(referenceImage)) return jsonError("Image reference must be an HTTPS URL or image data URI.",400);
    const model = referenceImage ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2";
    const response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        ...(referenceImage ? { image_urls: [referenceImage] } : {}),
        num_images: 1,
        aspect_ratio: body?.aspectRatio || "auto",
        output_format: "png",
        resolution: body?.resolution || "1K",
        limit_generations: true,
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.detail || payload?.error || payload?.message || "Nano Banana 2 image generation failed.", response.status);
    const url = payload?.images?.[0]?.url || "";
    if (!url) return jsonError("Nano Banana 2 returned no image output.", 502);
    return NextResponse.json({ url, type: "image", model, provider: "fal" });
  }

  if (type === "video") {
    const promptImage = typeof body?.promptImage === "string" ? body.promptImage.trim() : "";
    if (promptImage && !/^https:\/\//i.test(promptImage) && !/^data:image\//i.test(promptImage)) {
      return jsonError("Video reference image must be an HTTPS URL or image data URI.", 400);
    }
    if (promptImage) {
      const key = readSecret("FAL_KEY");
      if (!key) return jsonError("Image animation is unavailable because fal.ai is not configured.", 503);
      const model = "fal-ai/wan/v2.2-a14b/image-to-video/turbo";
      const response = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: promptImage, prompt, resolution: "720p", aspect_ratio: "auto",
          enable_safety_checker: true, enable_output_safety_checker: true,
          enable_prompt_expansion: false,
        }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return jsonError(response.status === 402
        ? "fal.ai has insufficient credits for image animation. The site administrator needs to add fal.ai credits."
        : payload?.detail || payload?.error || payload?.message || "Image animation failed.", response.status);
      if (!payload?.request_id || !payload?.status_url || !payload?.response_url) return jsonError("The animation provider returned an incomplete task.", 502);
      const videoId = Buffer.from(JSON.stringify({
        id: payload.request_id, status: payload.status_url, result: payload.response_url,
      })).toString("base64url");
      return NextResponse.json({ type, status: "processing", videoId, model, provider: "fal" });
    }
    const runwayKey = readSecret("RUNWAYML_API_SECRET");
    if (!runwayKey) return jsonError("RUNWAYML_API_SECRET is not configured in Vercel.", 503);
    const model = "gen4.5";
    const response = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model,
        promptText: prompt,
        ...(promptImage ? { promptImage } : {}),
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
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const model = "fal-ai/elevenlabs/tts/eleven-v3";
    const voice = typeof body?.voice === "string" && body.voice.trim() ? body.voice.trim() : "Aria";
    const response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: prompt,
        voice,
        stability: typeof body?.stability === "number" ? body.stability : 0.4,
        language_code: "en",
        apply_text_normalization: "auto",
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.detail || payload?.error || payload?.message || "Eleven v3 voice generation through fal failed.", response.status);
    const url = payload?.audio?.url || "";
    if (!url) return jsonError("Eleven v3 returned no audio output.", 502);
    return NextResponse.json({ type, url, voice, model, provider: "fal-elevenlabs" });
  }

  if (type === "sfx") {
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const model = "fal-ai/elevenlabs/sound-effects/v2";
    const response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, duration_seconds: 5, prompt_influence: 0.4, output_format: "mp3_44100_128" }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.detail || payload?.error || payload?.message || "ElevenLabs sound-effect generation through fal failed.", response.status);
    const url = payload?.audio?.url || "";
    if (!url) return jsonError("ElevenLabs sound-effects returned no audio output.", 502);
    return NextResponse.json({ type: "sfx", url, model, provider: "fal-elevenlabs" });
  }

  if (type === "music") {
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim() : "";
    if (lyrics.length > 6000) return jsonError("Lyrics must be 6,000 characters or fewer.", 400);
    const durationMatch = prompt.match(/\b(\d{1,3})(?:\s*(?:to|[-–])\s*(\d{1,3}))?\s*[- ]?\s*(?:seconds?|secs?|s)\b/i);
    const duration = body?.durationSeconds === 0 ? null
      : body?.durationSeconds != null ? Number(body.durationSeconds)
      : durationMatch ? Number(durationMatch[2] || durationMatch[1]) : null;
    if (duration !== null && (!Number.isInteger(duration) || duration < 3 || duration > 120)) {
      return jsonError("Choose a short music length from 3 to 120 seconds, or choose Full song.", 400);
    }
    if (lyrics.split(/\r?\n/).some(line => line.length > 200)) return jsonError("Keep each lyric line to 200 characters or fewer.", 400);
    const model = duration !== null ? "fal-ai/elevenlabs/music" : "fal-ai/minimax-music/v2.6";
    const stylePrompt = prompt.length >= 10 ? prompt.slice(0, 2000) : `${prompt} cinematic music`;
    const instrumental = /instrumental|no vocals?|without vocals?|no singing|no voice/i.test(prompt);

    const submitResponse = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(duration !== null ? (lyrics && !instrumental ? {
          composition_plan: {
            positive_global_styles: [stylePrompt],
            negative_global_styles: ["extended instrumental intro", "extra verses"],
            sections: [{
              section_name: "Intro theme", positive_local_styles: ["complete ending"],
              negative_local_styles: [], duration_ms: duration * 1000,
              lines: lyrics.split(/\r?\n/).filter(line => line.trim()),
            }],
          },
          respect_sections_durations: true,
        } : {
          prompt: stylePrompt,
          music_length_ms: duration * 1000,
          force_instrumental: instrumental,
        }) : {
          prompt: stylePrompt, lyrics,
          lyrics_optimizer: !lyrics && !instrumental, is_instrumental: instrumental,
          audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" },
        }),
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

    return NextResponse.json({
      type: "music",
      status: "processing",
      requestId: String(requestId),
      statusUrl: submitPayload.status_url || "",
      responseUrl: submitPayload.response_url || "",
      model,
      provider: "fal",
    });
  }

  return jsonError("Unsupported asset type. Use image, video, voice, music, or sfx.", 400);
}
