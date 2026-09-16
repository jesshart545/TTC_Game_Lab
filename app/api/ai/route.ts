import { NextResponse } from "next/server";

const SYSTEM = `You are TTCGameLab AI, a creative director and application builder for interactive TikTok LIVE experiences. Do not merely return a specification. Interpret the creator's request and propose concrete changes to the project's dashboard, overlay, scenes, controls, assets, and interactions. Keep the existing project context intact and make incremental edits when the user asks for changes.`;

export async function POST(request: Request) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return NextResponse.json({ configured: false, error: "AGNES_API_KEY is not configured." }, { status: 503 });
  const body = await request.json();
  const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.AGNES_MODEL || "agnes-2.5-flash",
      messages: [{ role: "system", content: SYSTEM }, ...(Array.isArray(body.messages) ? body.messages : [])],
      temperature: 0.7,
    }),
  });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json({ configured: true, error: payload?.error?.message || "Agnes request failed.", details: payload }, { status: response.status });
  return NextResponse.json({ configured: true, message: payload?.choices?.[0]?.message?.content || "" });
}
