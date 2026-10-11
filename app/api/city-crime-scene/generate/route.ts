import { NextResponse } from "next/server";
import { assistantProvider } from "../../../../lib/assistant-provider";
import { validateCityCrimeScene, type CityCrimeSceneConfig, canUseCityCrimeScene } from "../../../../lib/city-crime-scene";
import { requireCreator } from "../../../../lib/auth/server";

export const maxDuration = 180;

const SYSTEM = `You are a Law & Order-style mystery writer for an interactive livestream improv game called City Crime Scene. The host gives you a premise; you return ONE complete, internally consistent mystery package as JSON.

Return ONLY a JSON object shaped exactly like this (no markdown fences, no commentary):
{"config":{"title":string,"premise":string,"detectiveCount":1|2,"suspectCount":number,"crime":string,"actualCrimeDetails":string,"victim":string,"backstory":string,"plot":string,"locations":[{"id":string,"name":string,"description":string,"imagePrompt":string}],"clues":[{"id":string,"title":string,"description":string,"locationId":string,"cutScenePrompt":string,"relatedSuspectIds":string[]}],"suspects":[{"id":string,"name":string,"characterBrief":string,"potentialMotive":string,"alibi":string,"demeanor":string,"tells":string,"extraInfo":string,"questions":string[],"guideVideoPrompt":string,"isGuilty":boolean}],"witnessStatements":string[],"helperWitnesses":[{"id":string,"name":string,"role":string,"description":string,"info":string,"giftToUnlock":string,"portraitPrompt":string}],"timeline":[{"id":string,"time":string,"event":string}],"twists":[{"id":string,"title":string,"description":string,"triggerMoment":string}],"caseInsightVideoPrompts":string[],"interrogationSeconds":number,"courtroomSeconds":number}}

HARD CORRELATION RULES — every element must tell the same story:
- Exactly the requested number of suspects, and EXACTLY ONE has isGuilty true. The guilty suspect's motive, means and opportunity must fit the timeline; every other suspect's alibi must genuinely hold up.
- Every clue's locationId must match a real location id, and every clue's relatedSuspectIds must be non-empty and reference real suspect ids. Every location must contain at least one clue.
- Clues, backstories, motives, alibis, witness statements and timeline must all agree with actualCrimeDetails (the host-only truth). No random disconnected content. Red herrings are allowed only if the truth explains them.
- Motives are framed as POTENTIAL: each suspect looks guilty for a real reason, but the brief never confirms guilt.
- Per suspect: 3-5 individualized interrogation questions drawn from their character info and the case details; demeanor (how they carry themselves), tells (what gives them away), extraInfo (background the suspect's own brief omits).
- 3-6 locations; 3-5 broad witness statements (static evidence for the opening briefing); 2-4 helper-witness concepts (optional, NOT critical to solving — just extra help); 5-8 timeline events; 2-3 pre-woven twists with trigger moments (surprises for the detective and suspects; the host deploys them); 2-3 cinematic case-insight video prompts.
- interrogationSeconds 90-180, courtroomSeconds 120-300.
- Public fields (crime, victim, backstory, plot, premise) must never name or hint at the guilty party. The truth lives ONLY in actualCrimeDetails, demeanor/tells/extraInfo, and twists.`;

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return a mystery package.");
  return candidate.slice(start, end + 1);
}

export async function POST(request: Request) {
  const me = await requireCreator();
  if (!canUseCityCrimeScene(me?.email)) return NextResponse.json({ error: "City Crime Scene is only available to select accounts." }, { status: 403 });
  const provider = assistantProvider();
  if (!provider.key) return NextResponse.json({ error: "AGNES_API_KEY is not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const premise = String(body.premise || "").trim();
  const detectiveCount = 1; // Detectives are never configured — always a single shared detective role.
  const suspectCount = Math.max(4, Math.min(7, Math.floor(Number(body.suspectCount) || 4)));
  const notes = String(body.notes || "").trim();
  if (!premise) return NextResponse.json({ error: "Describe your premise first." }, { status: 400 });

  const user = `Write a City Crime Scene mystery package.\nPremise: ${premise}\nCast: ${detectiveCount} detective(s), ${suspectCount} suspects (exactly one guilty).\n${notes ? `Host notes (the host's word is final — honor these exactly): ${notes}\n` : ""}Return only the JSON object.`;

  let lastError = "";
  for (const model of provider.models) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 16384,
        }),
        signal: AbortSignal.timeout(120000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = String(payload?.error?.message || payload?.message || `Provider error ${response.status}`);
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable) continue;
        return NextResponse.json({ error: lastError || "The mystery could not be generated." }, { status: 502 });
      }
      const text = String(payload?.choices?.[0]?.message?.content || "");
      let parsed: { config?: CityCrimeSceneConfig };
      try { parsed = JSON.parse(extractJson(text)); }
      catch { lastError = "The AI returned an unreadable package."; continue; }
      const config = parsed?.config;
      if (!config || !Array.isArray(config.suspects)) { lastError = "The AI returned an incomplete package."; continue; }
      config.detectiveCount = detectiveCount;
      config.suspectCount = suspectCount;
      const problems = validateCityCrimeScene(config);
      return NextResponse.json({ config, validation: problems });
    } catch {
      lastError = "Could not reach the AI service.";
    }
  }
  return NextResponse.json({ error: lastError || "The mystery could not be generated right now." }, { status: 502 });
}
