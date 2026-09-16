import { NextResponse } from "next/server";

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId")?.trim();
  if (!taskId) return errorResponse("taskId is required.", 400);

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return errorResponse("REPLICATE_API_TOKEN is not configured in Vercel.", 503);

  const response = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return errorResponse(payload?.detail || payload?.error || "Unable to check music generation.", response.status);

  const status = payload?.status;
  const output = Array.isArray(payload?.output) ? payload.output[0] : payload?.output;
  if (status === "succeeded" && output) return NextResponse.json({ status: "complete", url: String(output) });
  if (status === "failed" || status === "canceled") return errorResponse(payload?.error || "ACE-Step music generation failed.", 502);
  return NextResponse.json({ status: status || "processing", taskId });
}
