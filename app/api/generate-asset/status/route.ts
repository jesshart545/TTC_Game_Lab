import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return NextResponse.json({ error: "REPLICATE_API_TOKEN is not configured in Vercel." }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "A prediction id is required." }, { status: 400 });

  const response = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: payload?.detail || payload?.error || "Unable to read prediction." }, { status: response.status });

  const output = Array.isArray(payload?.output) ? payload.output[0] : payload?.output;
  return NextResponse.json({ status: payload?.status, output: output || null, error: payload?.error || null });
}
