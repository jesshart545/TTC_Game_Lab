import { NextResponse } from "next/server";

const SYSTEM = `You are TTCGameLab AI, a creative director and application builder for interactive TikTok LIVE experiences. Do not merely return a specification. Interpret the creator's request and propose concrete changes to the project's dashboard, overlay, scenes, controls, assets, and interactions. Keep the existing project context intact and make incremental edits when the user asks for changes.`;
const DRAFT_SYSTEM = `You help edit a TTCGameLab DRAFT. Return only JSON: {"reply":string,"changes":object,"manualSteps":string[]}. Allowed changes: theme (cyan|purple|pink), overlay (title,subtitle,showChat,showAlerts,showCharacter), assets (array of existing storageKey plus inProject,role,edits), compositions (array of existing id plus name,inProject,clips array of existing id with start,duration,trimStart,loop,volume,fadeIn,fadeOut,playbackRate,text,effect), controls (array of existing id with label,compositionId,overlayResult). Change only fields the creator requested. Never invent IDs, asset URLs, media, successful generation, or published changes. For anything you cannot apply, explain why and give concise manualSteps based only on actual UI: Upload / Generate asset in Builder Chat; Details > Assets > Add to Project or Edit; Asset Composer > stack clips, Save Composition; saved composition > Add to Preview > Assign button; Dashboard preview > Edit Overlay Result > Test Trigger; Publish Experience when satisfied. If it cannot be done manually either, say so and leave manualSteps empty. If fully applied, manualSteps must be empty. Project context and recent conversation are provided.`;

export async function POST(request: Request) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return NextResponse.json({ configured: false, error: "AGNES_API_KEY is not configured." }, { status: 503 });
  const body = await request.json();
  const draftEdit = body.mode === "draft-edit";
  const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.AGNES_MODEL || "agnes-2.5-flash",
      messages: draftEdit ? [{ role: "system", content: DRAFT_SYSTEM }, { role: "user", content: JSON.stringify({ request: body.request, recentConversation: body.history, project: body.project }) }] : [{ role: "system", content: SYSTEM }, ...(Array.isArray(body.messages) ? body.messages : [])],
      temperature: draftEdit ? .2 : .7,
    }),
  });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json({ configured: true, error: payload?.error?.message || "Agnes request failed.", details: payload }, { status: response.status });
  const message = payload?.choices?.[0]?.message?.content || "";
  if (draftEdit) {
    try {
      const parsed = JSON.parse(message.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      if (!parsed || typeof parsed.reply !== "string" || !parsed.changes || typeof parsed.changes !== "object") throw new Error();
      return NextResponse.json({ configured: true, reply: parsed.reply, changes: parsed.changes, manualSteps: Array.isArray(parsed.manualSteps) ? parsed.manualSteps.filter((x: unknown) => typeof x === "string").slice(0, 6) : [] });
    } catch { return NextResponse.json({ error: "I could not interpret that edit. Please try describing it another way." }, { status: 502 }); }
  }
  return NextResponse.json({ configured: true, message });
}
