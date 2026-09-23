import { NextResponse } from "next/server";

export const runtime = "nodejs";
const MODEL = "fal-ai/minimax-music/v2.6";

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
  const key = (process.env.FAL_KEY || "").trim().replace(/^(['"])|(['"])$/g, "");
  if (!key) return NextResponse.json({ error: "FAL_KEY is not configured." }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Valid music request ID required." }, { status: 400 });
  }

  const base = `https://queue.fal.run/${MODEL}/requests/${encodeURIComponent(id)}`;
  const query = new URL(request.url).searchParams;
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
