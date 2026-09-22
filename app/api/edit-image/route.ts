import { NextResponse } from "next/server";

function readSecret(name: string) {
  const raw = process.env[name] || "";
  return raw.trim().replace(/^(['"])|(['"])$/g, "");
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function extractImageUrl(payload: any) {
  const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) return String(item.url);
  return "";
}

async function imageAsDataUri(source: string) {
  if (source.startsWith("data:image/")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error("Could not load the source image for AI editing.");
  const type = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${type};base64,${bytes.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!prompt) return jsonError("An edit instruction is required.", 400);
    if (!imageUrl) return jsonError("A source image is required.", 400);

    const key = readSecret("AGNES_API_KEY");
    if (!key) return jsonError("AGNES_API_KEY is not configured in Vercel.", 503);

    const image = await imageAsDataUri(imageUrl);
    const response = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "agnes-image-2.5-flash",
        prompt,
        size: "1024x768",
        extra_body: {
          image: [image],
          response_format: "b64_json",
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.error?.message || payload?.message || "Agnes image edit failed.", response.status);
    const url = extractImageUrl(payload);
    if (!url) return jsonError("Agnes returned no edited image.", 502);
    return NextResponse.json({ url, type: "image", model: "agnes-image-2.5-flash" });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "AI image edit failed.");
  }
}
