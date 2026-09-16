import { NextResponse } from "next/server";

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId")?.trim();
  if (!taskId) return errorResponse("taskId is required.", 400);

  const baseUrl = process.env.ACE_STEP_API_URL?.replace(/\/$/, "");
  if (!baseUrl) return errorResponse("ACE_STEP_API_URL is not configured in Vercel.", 503);

  const apiKey = process.env.ACE_STEP_API_KEY;
  const response = await fetch(`${baseUrl}/query_result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ task_id_list: [taskId] }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return errorResponse(payload?.error || payload?.message || "ACE-Step status request failed.", response.status);

  const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  const status = Number(item?.status);
  if (status === 0) return NextResponse.json({ status: "pending", taskId });
  if (status === 2) return errorResponse(item?.error || "ACE-Step music generation failed.", 502);

  let result: unknown = item?.result;
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch { /* leave as string */ }
  }

  const first = Array.isArray(result) ? result[0] : result;
  const file = typeof first?.file === "string" ? first.file : "";
  if (!file) return errorResponse("ACE-Step finished without an audio file.", 502);

  const url = file.startsWith("http://") || file.startsWith("https://") ? file : `${baseUrl}${file.startsWith("/") ? "" : "/"}${file}`;
  return NextResponse.json({ status: "complete", taskId, url, model: process.env.ACE_STEP_MODEL || "acestep-v15-turbo" });
}
