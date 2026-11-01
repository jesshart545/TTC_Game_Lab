import { NextResponse } from "next/server";
import { ACE_STEP_MODEL, pollAceStepMusic } from "../../../../lib/gradio-space";

export const runtime = "nodejs";
// A fallback music poll holds the Space's queue stream open until the job
// finishes (disconnecting mid-run destroys the session), so this route
// needs the same long ceiling as the asset routes.
export const maxDuration = 300;
const DEFAULT_MODEL = "fal-ai/minimax-music/v2.6";
const ALLOWED_MODELS = ["fal-ai/minimax-music/v2.6", "minimax/music-3", ACE_STEP_MODEL];

function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorText).join(" | ");
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (typeof item.message === "string") return item.message;
    if (typeof item.msg === "string") return item.msg;
    return JSON.stringify(value);
  }
  return String(value || "Unknown fal error");
}

export async function GET(request: Request) {
  // Fallback jobs (submitted when fal was down) live on the ACE-Step Space,
  // not fal: poll its queue instead. These need no FAL_KEY, so this branch
  // runs before the fal key check below.
  const params = new URL(request.url).searchParams;
  if ((params.get("model") || "") === ACE_STEP_MODEL) {
    const spaceId = params.get("id");
    if (!spaceId || !/^[\w-]+$/.test(spaceId)) {
      return NextResponse.json({ error: "Valid music request ID required." }, { status: 400 });
    }
    // Hold the job's stream until it finishes: 280s, just under
    // maxDuration. A short peek-and-reconnect poll can never see a song
    // complete — the first disconnect destroys the session.
    const result = await pollAceStepMusic(spaceId, 280000);
    if (result.state === "completed") return NextResponse.json({ status: "completed", url: result.url });
    if (result.state === "failed") return NextResponse.json({ status: "failed", error: result.error });
    if (result.state === "unreachable") return NextResponse.json({ error: "Unable to reach the fallback service. Please check again." }, { status: 502 });
    return NextResponse.json({ status: "processing", queuePosition: result.queuePosition });
  }

  const key = (process.env.FAL_KEY || "").trim().replace(/^(['"])|(['"])$/g, "");
  if (!key) return NextResponse.json({ error: "FAL_KEY is not configured." }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Valid music request ID required." }, { status: 400 });
  }

  const query = new URL(request.url).searchParams;
  const requestedModel = query.get("model") || "";
  const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;

  const base = `https://queue.fal.run/${model}/requests/${encodeURIComponent(id)}`;
  const safeQueueUrl = (provided: string | null, fallback: string) => {
    if (!provided) return fallback;
    try {
      const parsed = new URL(provided);
      if (parsed.protocol !== "https:" || parsed.hostname !== "queue.fal.run" || parsed.username || parsed.password ||
          !parsed.pathname.includes("/requests/" + id)) return fallback;
      return parsed.toString();
    } catch { return fallback; }
  };
  const statusUrl = safeQueueUrl(query.get("statusUrl"), base + "/status");
  const resultUrl = safeQueueUrl(query.get("responseUrl"), base);
  try {
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const rawStatus = await response.text();
    let payload: any = {};
    try { payload = JSON.parse(rawStatus); } catch {}
    if (!response.ok) return NextResponse.json({ error: `fal status HTTP ${response.status}: ${errorText(payload.detail || payload.error || payload.message || rawStatus.slice(0, 400) || "Empty response")}` }, { status: response.status });

    if (payload.status === "FAILED") {
      return NextResponse.json({ status: "failed", error: errorText(payload.error || payload.detail || "fal music generation failed.") });
    }
    if (payload.status !== "COMPLETED") {
      return NextResponse.json({ status: "processing", queuePosition: payload.queue_position ?? null });
    }

    const resultResponse = await fetch(resultUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });
    const rawResult = await resultResponse.text();
    let result: any = {};
    try { result = JSON.parse(rawResult); } catch {}
    if (!resultResponse.ok) return NextResponse.json({ error: `fal result HTTP ${resultResponse.status}: ${errorText(result.detail || result.error || rawResult.slice(0, 400) || "Empty response")}` }, { status: resultResponse.status });
    const audioUrl = result?.audio?.url;
    if (!audioUrl) return NextResponse.json({ status: "failed", error: "fal completed but returned no audio URL." });
    return NextResponse.json({ status: "completed", url: String(audioUrl) });
  } catch {
    return NextResponse.json({ error: "Unable to reach fal. Please check again." }, { status: 502 });
  }
}
