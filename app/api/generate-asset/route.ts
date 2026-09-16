import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const key = process.env.AGNES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "AGNES_API_KEY is not configured in Vercel." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "A prompt is required." }, { status: 400 });

  const response = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "agnes-image-2.1-flash",
      prompt,
      size: "1024x1024",
      n: 1,
      extra_body: { response_format: "url" },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error?.message || payload?.message || "Agnes image generation failed." },
      { status: response.status },
    );
  }

  const item = Array.isArray(payload?.data) ? payload.data[0] : null;
  const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
  if (!url) return NextResponse.json({ error: "Agnes returned no image." }, { status: 502 });

  return NextResponse.json({ url, model: "agnes-image-2.1-flash" });
}
