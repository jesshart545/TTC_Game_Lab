/**
 * Minimal Gradio queue client for Hugging Face Spaces — the free,
 * open-source fallback for media generation when the primary provider
 * (fal.ai) is down or locked (see app/api/generate-asset).
 *
 * A Space job is joined with a client-chosen session hash, which doubles as
 * the job id the rest of the app polls with. Progress is read from the
 * queue's SSE stream at /gradio_api/queue/data?session_hash=... The stream
 * stays open while a job runs, so reads are bounded: collect events for a
 * budget, then interpret what arrived. Anonymous calls work; when HF_TOKEN
 * is configured it is sent along for the higher ZeroGPU quota.
 */

export const ACE_STEP_HOST = "https://ace-step-ace-step-v1-5.hf.space";
export const ACE_STEP_MODEL = "ace-step/ace-step-v1.5";
export const KOKORO_HOST = "https://hexgrad-kokoro-tts.hf.space";
export const KOKORO_MODEL = "hexgrad/Kokoro-82M";

// Dependency indexes in each Space's /config, verified 2026-11-01:
// ACE-Step's generation_wrapper and Kokoro's "Generate" button handler.
const ACE_STEP_FN_INDEX = 77;
const KOKORO_FN_INDEX = 4;

function spaceHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = (process.env.HF_TOKEN || "").trim().replace(/^(['"])|(['"])$/g, "");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type SpaceJobResult =
  | { state: "processing"; queuePosition: number | null }
  | { state: "completed"; url: string }
  | { state: "failed"; error: string }
  | { state: "unreachable" };

export function newSpaceSessionHash(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Join a Space queue under a caller-chosen session hash. */
export async function joinSpaceQueue(host: string, fnIndex: number, data: unknown[], sessionHash: string): Promise<void> {
  const response = await fetch(`${host}/gradio_api/queue/join`, {
    method: "POST",
    headers: spaceHeaders(true),
    body: JSON.stringify({ data, fn_index: fnIndex, session_hash: sessionHash }),
    cache: "no-store",
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(payload?.detail || payload?.error || "").slice(0, 300);
    throw new Error(`Fallback service join failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`);
  }
  if (!payload?.event_id) throw new Error("Fallback service accepted the request but returned no job id.");
}

type SpaceRead = { events: any[]; httpStatus: number };

/**
 * Read a job's queue stream for up to budgetMs, collecting every event that
 * arrives (the stream is aborted at the budget; a still-running job simply
 * yields its progress events so far).
 */
export async function readSpaceQueue(host: string, sessionHash: string, budgetMs: number): Promise<SpaceRead> {
  const events: any[] = [];
  let httpStatus = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const response = await fetch(`${host}/gradio_api/queue/data?session_hash=${encodeURIComponent(sessionHash)}`, {
      headers: spaceHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });
    httpStatus = response.status;
    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      try { events.push(JSON.parse(trimmed.slice(5))); } catch { /* incomplete line */ }
    };
    const reader = typeof response.body?.getReader === "function" ? response.body.getReader() : null;
    if (reader) {
      let pending = Buffer.alloc(0);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          pending = Buffer.concat([pending, Buffer.from(value as Uint8Array)]);
          let newline = pending.indexOf(10);
          while (newline >= 0) {
            handleLine(pending.subarray(0, newline).toString("utf8"));
            pending = pending.subarray(newline + 1);
            newline = pending.indexOf(10);
          }
        }
      }
      if (pending.length) handleLine(pending.toString("utf8"));
    } else {
      const text = await response.text();
      for (const line of text.split("\n")) handleLine(line);
    }
  } catch {
    // Budget abort or connection failure: interpret whatever arrived.
  } finally {
    clearTimeout(timer);
  }
  return { events, httpStatus };
}

function spaceFileUrl(host: string, item: any): string {
  if (typeof item === "string") {
    if (/^https:\/\//i.test(item)) return item;
    if (item.startsWith("/")) return `${host}/gradio_api/file=${item}`;
    return "";
  }
  if (!item || typeof item !== "object") return "";
  if (typeof item.url === "string" && item.url) return item.url;
  if (typeof item.path === "string" && item.path) return `${host}/gradio_api/file=${item.path}`;
  return "";
}

function spaceErrorText(event: any): string {
  const raw = event?.error ?? event?.message ?? "";
  const text = typeof raw === "string" ? raw : String(raw?.message || raw?.detail || "");
  // Quota/billing detail from the fallback is an admin concern, mirroring
  // the primary provider's handling: creators get the generic message.
  if (/quota|zerogpu|gpu duration|insufficient|billing/i.test(text)) {
    return "This generation is temporarily unavailable. The site administrator has been notified.";
  }
  return text.slice(0, 300) || "The fallback generation failed.";
}

/** Interpret the events collected from one queue read. Null = nothing seen yet. */
export function interpretSpaceEvents(host: string, events: any[]): SpaceJobResult | null {
  let queuePosition: number | null = null;
  let sawProgress = false;
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    if (event.msg === "estimation") {
      sawProgress = true;
      if (typeof event.rank === "number") queuePosition = event.rank;
    } else if (event.msg === "process_starts" || event.msg === "process_generating") {
      sawProgress = true;
    } else if (event.msg === "process_completed") {
      if (event.success) {
        const data = Array.isArray(event.output?.data) ? event.output.data : [];
        for (const item of data) {
          const url = spaceFileUrl(host, item);
          if (url) return { state: "completed", url };
        }
        return { state: "failed", error: "The fallback service finished but returned no audio file." };
      }
      return { state: "failed", error: spaceErrorText(event) };
    } else if (event.msg === "queue_full") {
      return { state: "failed", error: "The fallback service is busy. Please try again shortly." };
    } else if (event.msg === "unexpected_error") {
      if ((event as any).session_not_found) return { state: "failed", error: "The fallback generation job could not be found." };
      return { state: "failed", error: spaceErrorText(event) };
    }
  }
  if (sawProgress) return { state: "processing", queuePosition };
  return null;
}

/**
 * The generation_wrapper inputs in /config order (verified 2026-11-01).
 * Every field sits at the Space UI's own default except: Prompt (the style
 * description), Lyrics, Vocal Language, Audio Duration, and batch size 1
 * (the UI default of 2 would generate — and bill quota for — two songs).
 */
export function aceStepInputs(prompt: string, lyrics: string, durationSeconds: number): unknown[] {
  return [
    "acestep-v15-xl-turbo", // models
    "custom", // mode
    "", // Song Description (sample mode only)
    "unknown", // Vocal Language (optional, sample mode)
    prompt, // Prompt — style/tags
    lyrics, // Lyrics ("[instrumental]" for instrumental requests)
    0, // BPM (0 = auto)
    "", // Key Signature
    "", // Time Signature
    "en", // Vocal Language
    8, // DiT Inference Steps
    7, // CFG scale
    true, // Random Seed
    "-1", // Seed
    null, // Reference Audio
    durationSeconds, // Audio Duration (seconds)
    1, // batch size
    null, // Source Audio
    "", // Audio Codes
    0, // Start (seconds)
    -1, // End (seconds)
    "Fill the audio semantic mask based on the given conditions:",
    1, // repaint strength
    "text2music", // task type
    false, 0, 1, // cover/lego toggles + sliders (UI defaults)
    3, // Shift
    "ode", // Inference Method
    "", // Custom Timesteps
    "mp3", // Audio Format
    0.85, // LM Temperature
    true, // Thinking
    2, // LM CFG Scale
    0, // LM Top-K
    0.9, // LM Top-P
    "NO USER INPUT", // LM Negative Prompt
    true, true, true, // CoT caption / language / metas
    null, // state
    false, true, // UI checkboxes (defaults)
    false, false, // Get Scores, Get LRC
    0.5, 8, // UI sliders (defaults)
    null, // stem dropdown
    [], // stem checkbox group
    false, // UI checkbox
    null, null, null, null, // state
  ];
}

/** Submit a song to the ACE-Step Space; resolves with the job's poll handle. */
export async function submitAceStepMusic(prompt: string, lyrics: string, durationSeconds: number): Promise<{ requestId: string; statusUrl: string }> {
  const sessionHash = newSpaceSessionHash("ttcmusic");
  await joinSpaceQueue(ACE_STEP_HOST, ACE_STEP_FN_INDEX, aceStepInputs(prompt, lyrics, durationSeconds), sessionHash);
  return { requestId: sessionHash, statusUrl: `${ACE_STEP_HOST}/gradio_api/queue/data?session_hash=${sessionHash}` };
}

/** One bounded poll of a fallback music job, in music-status route terms. */
export async function pollAceStepMusic(sessionHash: string, budgetMs: number): Promise<SpaceJobResult> {
  const { events, httpStatus } = await readSpaceQueue(ACE_STEP_HOST, sessionHash, budgetMs);
  const result = interpretSpaceEvents(ACE_STEP_HOST, events);
  if (result) return result;
  if (httpStatus === 0) return { state: "unreachable" };
  if (httpStatus < 200 || httpStatus >= 300) return { state: "failed", error: `The fallback service returned HTTP ${httpStatus}.` };
  return { state: "processing", queuePosition: null };
}

/**
 * Map one of the site's ElevenLabs voice names to a Kokoro voice. Names
 * Kokoro also offers map to the same-named voice; the rest (including the
 * site default, Aria) use Kokoro's flagship af_heart.
 */
export function kokoroVoice(requested: string): string {
  const byName: Record<string, string> = {
    sarah: "af_sarah",
    alice: "bf_alice",
    jessica: "af_jessica",
    george: "bm_george",
    liam: "am_liam",
  };
  return byName[String(requested || "").trim().toLowerCase()] || "af_heart";
}

/** Generate speech on the Kokoro Space, waiting (bounded) for the result. */
export async function generateKokoroVoice(text: string, requestedVoice: string, budgetMs: number): Promise<{ url: string; voice: string }> {
  const voice = kokoroVoice(requestedVoice);
  const sessionHash = newSpaceSessionHash("ttcvoice");
  await joinSpaceQueue(KOKORO_HOST, KOKORO_FN_INDEX, [text, voice, 1, true], sessionHash);
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Fallback voice generation timed out.");
    const { events, httpStatus } = await readSpaceQueue(KOKORO_HOST, sessionHash, Math.min(remaining, 30000));
    const result = interpretSpaceEvents(KOKORO_HOST, events);
    if (result?.state === "completed") return { url: result.url, voice };
    if (result?.state === "failed") throw new Error(result.error);
    if (!result && httpStatus === 0) throw new Error("Unable to reach the fallback voice service.");
    // Processing (or an empty read): reconnect and keep waiting.
  }
}
