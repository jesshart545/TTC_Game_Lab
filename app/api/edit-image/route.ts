import { NextResponse } from "next/server";

export const runtime = "nodejs";

function readSecret(name: string) {
  const raw = process.env[name] || "";
  return raw.trim().replace(/^(['"])|(['"])$/g, "");
}

function jsonError(message: unknown, status = 500) {
  const text = typeof message === "string" ? message : (() => { try { return JSON.stringify(message); } catch { return "AI image edit failed."; } })();
  return NextResponse.json({ error: text }, { status });
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

    const key = readSecret("FAL_KEY");
    if (!key) return jsonError("FAL_KEY is not configured in Vercel.", 503);

    const image = await imageAsDataUri(imageUrl);
    const model = "fal-ai/nano-banana-2/edit";
    const response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_urls: [image],
        num_images: 1,
        aspect_ratio: body?.aspectRatio || "auto",
        output_format: "png",
        resolution: body?.resolution || "1K",
        limit_generations: true,
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.detail || payload?.error || payload?.message || "Nano Banana 2 image edit failed.", response.status);
    const url = payload?.images?.[0]?.url || "";
    if (!url) return jsonError("Nano Banana 2 returned no edited image.", 502);
    return NextResponse.json({ url, type: "image", model, provider: "fal" });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "AI image edit failed.");
  }
}
