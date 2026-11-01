import { videoDuration } from "../../../lib/video-duration";
import { musicDuration } from "../../../lib/music-duration";
import { isCreditError, notifyAdminOfCreditIssue } from "../../../lib/admin-alerts";
import { ACE_STEP_MODEL, KOKORO_MODEL, generateKokoroVoice, submitAceStepMusic } from "../../../lib/gradio-space";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function providerMessage(payload: any): string {
  return String(payload?.detail || payload?.error || payload?.message || "");
}

/**
 * fal.ai failures: credit/quota problems go to the admin only. The creator
 * sees a generic message and is never told about balances or top-ups.
 */
async function falError(source: string, status: number, payload: any, fallback: string) {
  const message = providerMessage(payload);
  if (isCreditError(status, message)) {
    await notifyAdminOfCreditIssue(`generate-asset/${source}`, `fal.ai request failed (HTTP ${status}): ${message || "no detail"}`);
    return jsonError("This generation is temporarily unavailable. The site administrator has been notified.", 502);
  }
  return jsonError(message || fallback, status);
}

/**
 * Provider-side failures that justify switching a generation to the free
 * fallback: payment/lock/quota responses and provider 5xx (callers add
 * connection failures, where fetch itself throws). Input problems
 * (400/422), unknown models (404), and bad keys (401) are NOT outages —
 * they stay on the primary path and surface exactly as before.
 */
function isProviderOutage(status: number, message: string): boolean {
  if (status === 402 || status === 403 || status === 429 || status >= 500) return true;
  return isCreditError(status, message);
}

/** Account-lock failures (e.g. fal's "User is locked. Reason: TOP_UP"). */
function isLockError(message: string): boolean {
  return /lock|top.?up/i.test(message);
}

function jsonError(message: unknown, status = 500) {
  const format = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(format).filter(Boolean).join(" | ");
    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const location = Array.isArray(item.loc) ? item.loc.join(".") : Array.isArray(item.path) ? item.path.join(".") : "";
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
    // Queue the request instead of waiting synchronously: image jobs can run for
    // minutes, and a synchronous wait hangs the UI with no progress or errors.
    // Caliber: 2K default so full-bleed overlay art stays sharp on the 1920×1080 canvas.
    const allowedResolutions = ["0.5K", "1K", "2K", "4K"];
    const resolution = allowedResolutions.includes(String(body?.resolution)) ? String(body.resolution) : "2K";
    const submitResponse = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        ...(referenceImage ? { image_urls: [referenceImage] } : {}),
        num_images: 1,
        aspect_ratio: body?.aspectRatio || "16:9",
        output_format: "png",
        resolution,
        limit_generations: true,
      }),
      cache: "no-store",
    });
    const submitPayload = await submitResponse.json().catch(() => ({}));
    if (!submitResponse.ok) return falError("image", submitResponse.status, submitPayload, "Nano Banana 2 image generation failed.");
    const requestId = submitPayload?.request_id;
    if (!requestId) return jsonError("fal accepted the image request but returned no request id.", 502);
    return NextResponse.json({
      type: "image",
      status: "processing",
      requestId: String(requestId),
      statusUrl: submitPayload.status_url || "",
      responseUrl: submitPayload.response_url || "",
      model,
      provider: "fal",
    });
  }

  if (type === "video") {
    const promptImage = typeof body?.promptImage === "string" ? body.promptImage.trim() : "";
    if (promptImage && !/^https:\/\//i.test(promptImage) && !/^data:image\//i.test(promptImage)) {
      return jsonError("Video reference image must be an HTTPS URL or image data URI.", 400);
    }
    let durationSeconds: number;
    try { durationSeconds = videoDuration(prompt, body?.durationSeconds); }
    catch (error) { return jsonError(error instanceof Error ? error.message : "Invalid video length.", 400); }
    async function submitFalVideo() {
      const key = readSecret("FAL_KEY");
      if (!key) return jsonError("Video generation at this length is unavailable because fal.ai is not configured.", 503);
      const turbo = Boolean(promptImage) && durationSeconds === 5;
      const model = turbo ? "fal-ai/wan/v2.2-a14b/image-to-video/turbo"
        : `alibaba/wan-3.0/${promptImage ? "image-to-video" : "text-to-video"}`;
      if (!turbo && prompt.length > 5000) return jsonError("Keep the video description to 5,000 characters or fewer.", 400);
      const response = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          // Caliber: full 1080p on wan-3.0 so clips match the 1920×1080 overlay; turbo tops out at 720p, so push its quality to maximum instead.
          ...(promptImage ? turbo ? { image_url: promptImage } : { start_image_url: promptImage } : {}), prompt, resolution: turbo ? "720p" : "1080p",
          aspect_ratio: "16:9",
          ...(turbo ? { enable_output_safety_checker: true, video_quality: "maximum" } : { duration: durationSeconds, audio: false }),
          enable_safety_checker: true,
          enable_prompt_expansion: false,
        }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const providerMessage = String(payload?.detail || payload?.error || payload?.message || "");
        if (isCreditError(response.status, providerMessage)) {
          await notifyAdminOfCreditIssue("generate-asset/video", `fal.ai request failed (HTTP ${response.status}): ${providerMessage || "no detail"}`);
          return jsonError("Video generation is temporarily unavailable. The site administrator has been notified.", 502);
        }
        return jsonError(payload?.detail || payload?.error || payload?.message || "Image animation failed.", response.status);
      }
      if (!payload?.request_id || !payload?.status_url || !payload?.response_url) return jsonError("The animation provider returned an incomplete task.", 502);
      const videoId = Buffer.from(JSON.stringify({
        id: payload.request_id, status: payload.status_url, result: payload.response_url,
      })).toString("base64url");
      return NextResponse.json({ type, status: "processing", videoId, model, provider: "fal", durationSeconds });
    }
    if (promptImage || durationSeconds > 10) return submitFalVideo();
    const runwayKey = readSecret("RUNWAYML_API_SECRET");
    if (!runwayKey && readSecret("FAL_KEY")) return submitFalVideo();
    if (!runwayKey) return jsonError("RUNWAYML_API_SECRET is not configured in Vercel.", 503);
    if (prompt.length > 1000) return jsonError("Keep the short text-to-video description to 1,000 characters or fewer.", 400);
    const model = "gen4.5";
    // Text-only requests must use text_to_video; image_to_video requires promptImage.
    const runwayEndpoint = promptImage ? "image_to_video" : "text_to_video";
    const response = await fetch(`https://api.dev.runwayml.com/v1/${runwayEndpoint}`, {
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
        duration: durationSeconds,
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerError = String(payload?.error?.message || payload?.error || payload?.message || "");
      if ((response.status === 402 || /(?:not have enough|insufficient|not enough) credits/i.test(providerError)) && readSecret("FAL_KEY")) {
        return submitFalVideo();
      }
      return jsonError(
        payload?.issues || payload?.errors || payload?.detail || (typeof payload?.error === "string" ? payload.error : payload?.error?.message || payload?.message) || "Runway video generation failed.",
        response.status,
      );
    }

    const videoId = payload?.id || payload?.taskId || "";
    if (!videoId) return jsonError("Runway accepted the video request but returned no task id.", 502);

    const url = `/api/generate-asset/video?id=${encodeURIComponent(String(videoId))}&model=${encodeURIComponent(model)}&provider=runway`;
    return NextResponse.json({ type, status: "processing", videoId: String(videoId), url, model, provider: "runway", durationSeconds });
  }

  if (type === "voice") {
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const model = "fal-ai/elevenlabs/tts/eleven-v3";
    const voice = typeof body?.voice === "string" && body.voice.trim() ? body.voice.trim() : "Aria";
    let response: Response | null = null;
    let payload: any = {};
    let connectionFailed = false;
    try {
      response = await fetch(`https://fal.run/${model}`, {
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
      payload = await response.json().catch(() => ({}));
    } catch { connectionFailed = true; }
    if (connectionFailed || !response || !response.ok) {
      const status = response?.status ?? 0;
      const message = providerMessage(payload);
      // Credit and account-lock failures are billing events: the admin is
      // alerted once (here, not again in falError), and the creator is
      // served by the free Kokoro fallback when it can answer.
      const billingFailure = isCreditError(status, message) || isLockError(message);
      if (connectionFailed || isProviderOutage(status, message)) {
        if (billingFailure) {
          await notifyAdminOfCreditIssue("generate-asset/voice", `fal.ai request failed (HTTP ${status}): ${message || "no detail"}`);
        }
        try {
          const fallback = await generateKokoroVoice(prompt, voice, 150000);
          return NextResponse.json({ type, url: fallback.url, voice: fallback.voice, model: KOKORO_MODEL, provider: "huggingface-kokoro" });
        } catch { /* the primary failure below is the honest answer */ }
        if (connectionFailed || billingFailure) {
          return jsonError("This generation is temporarily unavailable. The site administrator has been notified.", 502);
        }
      }
      return falError("voice", status, payload, "Eleven v3 voice generation through fal failed.");
    }
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
      body: JSON.stringify({ text: prompt, duration_seconds: Math.max(1, Math.min(30, Number(body?.durationSeconds) || 5)), prompt_influence: 0.4, output_format: "mp3_44100_128" }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return falError("sfx", response.status, payload, "ElevenLabs sound-effect generation through fal failed.");
    const url = payload?.audio?.url || "";
    if (!url) return jsonError("ElevenLabs sound-effects returned no audio output.", 502);
    return NextResponse.json({ type: "sfx", url, model, provider: "fal-elevenlabs" });
  }

  if (type === "music") {
    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const lyrics: string = typeof body?.lyrics === "string" ? body.lyrics.trim() : "";
    if (lyrics.length > 3500) return jsonError("Lyrics must be 3,500 characters or fewer.", 400);
    const duration = musicDuration(prompt, body?.durationSeconds);
    if (duration !== null && (!Number.isInteger(duration) || duration < 3 || duration > 120)) {
      return jsonError("Choose a short music length from 3 to 120 seconds, or choose Full song.", 400);
    }
    if (lyrics.split(/\r?\n/).some(line => line.length > 200)) return jsonError("Keep each lyric line to 200 characters or fewer.", 400);
    const model = duration !== null ? "minimax/music-3" : "fal-ai/minimax-music/v2.6";
    const stylePrompt = prompt.length >= 10 ? prompt.slice(0, 2000) : `${prompt} cinematic music`;
    const instrumental = body?.instrumental === true || /instrumental|no vocals?|without vocals?|no singing|no voice/i.test(prompt);

    if (duration !== null && !instrumental && !lyrics) return jsonError("Paste the lyrics for your short song into the Lyrics field, or request instrumental music.", 400);

    let submitResponse: Response | null = null;
    let submitPayload: any = {};
    let connectionFailed = false;
    try {
      submitResponse = await fetch(`https://queue.fal.run/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(duration !== null ? {
            prompt: `${stylePrompt}. Create a complete short intro of no more than ${duration} seconds, with a concise ending.`,
            lyrics: instrumental ? "[instrumental]" : lyrics,
            duration,
          } : {
            prompt: stylePrompt, lyrics,
            lyrics_optimizer: !lyrics && !instrumental, is_instrumental: instrumental,
            audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" },
          }),
        }),
        cache: "no-store",
      });
      submitPayload = await submitResponse.json().catch(() => ({}));
    } catch { connectionFailed = true; }

    if (connectionFailed || !submitResponse || !submitResponse.ok) {
      const status = submitResponse?.status ?? 0;
      const message = providerMessage(submitPayload);
      // Credit and account-lock failures are billing events: the admin is
      // alerted once (here, not again in falError), and the creator is
      // served by the free ACE-Step fallback when it can answer. Polling a
      // fallback job works exactly like a fal job — the music-status route
      // recognizes the fallback model id.
      const billingFailure = isCreditError(status, message) || isLockError(message);
      if (connectionFailed || isProviderOutage(status, message)) {
        if (billingFailure) {
          await notifyAdminOfCreditIssue("generate-asset/music", `fal.ai request failed (HTTP ${status}): ${message || "no detail"}`);
        }
        try {
          const fallback = await submitAceStepMusic(
            stylePrompt,
            instrumental ? "[instrumental]" : lyrics,
            duration !== null ? Math.min(duration, 240) : 240,
          );
          return NextResponse.json({
            type: "music",
            status: "processing",
            requestId: fallback.requestId,
            statusUrl: fallback.statusUrl,
            responseUrl: "",
            model: ACE_STEP_MODEL,
            provider: "huggingface",
            durationSeconds: duration,
          });
        } catch { /* the primary failure below is the honest answer */ }
        if (connectionFailed || billingFailure) {
          return jsonError("This generation is temporarily unavailable. The site administrator has been notified.", 502);
        }
      }
      return falError("music", status, submitPayload, "fal music generation failed.");
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
      durationSeconds: duration,
    });
  }

  return jsonError("Unsupported asset type. Use image, video, voice, music, or sfx.", 400);
}
