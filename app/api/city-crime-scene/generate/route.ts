import { NextResponse } from "next/server";
import { assistantProvider } from "../../../../lib/assistant-provider";
import { validateCityCrimeScene, validateCityCrimeSceneStandards, readCityCrimeSceneConfig, type CityCrimeSceneConfig, canUseCityCrimeScene } from "../../../../lib/city-crime-scene";
import { requireCreator } from "../../../../lib/auth/server";

export const maxDuration = 180;

const SYSTEM = `You are a Law & Order-style mystery writer for an interactive livestream improv game called City Crime Scene. The host gives you a premise — often their own pitched ideas, plots, characters, or storyline framework — and you return ONE complete, internally consistent mystery package as JSON. The host's creative input is the deciding factor: build FROM it, never around it.

Return ONLY a JSON object shaped exactly like this (no markdown fences, no commentary):
{"config":{"title":string,"premise":string,"briefNarration":string,"briefDocument":string,"detectiveCount":1|2,"suspectCount":number,"crime":string,"actualCrimeDetails":string,"victim":string,"backstory":string,"plot":string,"locations":[{"id":string,"name":string,"description":string,"imagePrompt":string,"isCrimeScene":boolean,"items":[{"id":string,"name":string,"x":number,"y":number,"w":number,"h":number}]}],"clues":[{"id":string,"title":string,"description":string,"summary":string,"locationId":string,"cutScenePrompt":string,"audioPrompt":string,"cardPhotoPrompt":string,"cardCaption":string,"hotspot":string,"itemId":string,"storySignificance":string,"initiallyPresent":boolean,"unlocksSuspectId":string,"turningPoint":boolean,"relatedSuspectIds":string[]}],"flashbacks":[{"id":string,"title":string,"description":string,"videoPrompt":string,"relatedSuspectIds":string[]}],"suspects":[{"id":string,"name":string,"occupation":string,"age":string,"knownFor":string,"personality":string,"quote":string,"gender":string,"ethnicity":string,"characterBrief":string,"potentialMotive":string,"alibi":string,"demeanor":string,"tells":string,"extraInfo":string,"questions":string[],"guideVideoPrompt":string,"portraitPrompt":string,"trueRole":string,"alibiReality":string,"isGuilty":boolean}],"witnesses":[{"id":string,"name":string,"role":string,"statement":string,"locationId":string}],"helperWitnesses":[{"id":string,"name":string,"role":string,"description":string,"info":string,"howItHelps":string,"giftToUnlock":string,"portraitPrompt":string}],"timeline":[{"id":string,"time":string,"event":string}],"twists":[{"id":string,"title":string,"description":string,"triggerMoment":string}],"caseInsightVideoPrompts":string[],"interrogationSeconds":number,"courtroomSeconds":number}}

Leave unlocksSuspectId as "" on clues that unlock nobody, and turningPoint false except where specified below. Leave a witness's locationId as "" unless that witness's account is a location's key evidence (below).

HARD CORRELATION RULES — every element must tell the same story:
- Exactly the requested number of suspects, and EXACTLY ONE has isGuilty true. The guilty party is fixed in the storyline at build time. The guilty suspect's motive, means and opportunity must fit the timeline; every other suspect's alibi must genuinely hold up.
- HEADLINE STANDARD: EVERY suspect has a PROMINENT motive and connection to the crime, SUPPORTED BY EVIDENCE IN THE GAME — not merely asserted in text. Each suspect is genuinely plausible; the detective must need analysis and critical thinking to separate them, because the evidence is NOT cut and dry: nothing on the surface hands over the answer, yet the full evidence trail coheres and points to the one true guilty party.
- Clues, backstories, motives, alibis, witness statements and timeline must all agree with actualCrimeDetails (the host-only truth). No random disconnected content. Red herrings are allowed only if the truth explains them.
- Motives are framed as POTENTIAL: each suspect looks guilty for a real reason, but no public field ever confirms guilt. Public fields (crime, victim, backstory, plot, premise) must never name or hint at the guilty party. The truth lives ONLY in the host-only master-truth layer: actualCrimeDetails, each clue's storySignificance, each suspect's trueRole/alibiReality and demeanor/tells/extraInfo, and twists.
- SUSPECT CLUE CARD per suspect: occupation (what they do), age, knownFor (what everyone there knows them for), personality (public trait line — different words from the host-only demeanor), quote (a signature in-character line, in their voice), gender and ethnicity (character attributes the host may adjust to fit the live performer). Plus: 3-5 individualized interrogation questions drawn from their character info and the case details; demeanor (how they carry themselves — host only), tells (what gives them away — host only), extraInfo (background the suspect's own brief omits — host only).
- CHARACTER PHOTOS: every character file carries IMAGES, like a real suspect clue card. Each suspect gets a portraitPrompt — the prompt for THIS game's photo of that character, derived from the character's OWN description (their occupation, age, knownFor, personality, and signature quote) set in the case's era and setting: a cinematic character portrait that could only be this person in this story. Photos are generated fresh for every game from these descriptions — never generic, never reused across games. Each clue ALSO gets a cardPhotoPrompt and a cardCaption: the photo of that evidence as it appears on a suspect's character card, and the caption under it tying the evidence to the suspect(s) it points to. Both are built ONLY from the clue's generalized summary and the visible item it is found on — NEVER from the clue's specific description: no method, no figures, no forensic conclusions, nothing legible that gives the detail away. The card stays at preview level; specifics are expounded in play.
- Detectives: exactly the requested detectiveCount (1, or 2 when the host chooses a second). Detectives are NOT characters — never write detective character descriptions, names, or briefs. A detective is simply the person playing to solve the mystery.
- THE MAP: 6 locations pertinent to the storyline (5 minimum, 7 maximum). EXACTLY ONE location has isCrimeScene true — the crime scene itself. EVERY location holds AT LEAST 4 clues (evidence pieces) for the detective to discover. Every clue has: title; description = the SPECIFIC evidence detail revealed only during play; summary = a GENERALIZED one-line version for suspect-facing materials (rundowns and clue cards) that never reveals the specific detail, figures, or forensic conclusions; hotspot = the clickable item or area in that place the evidence is bound to (e.g. "The decanter on the desk"); itemId = the id of that place's scene item (below) the evidence pertains to.
- LOCATIONS ARE PLACES, NOT NECESSARILY ROOMS: any place the story needs — interior or exterior: a back alley, a dock, a parked car, a rooftop, a train platform. STRICT STORY ADHERENCE: every location is a place THIS story establishes, and it must carry a storyline role (the crime scene, a suspect's unlock discovery, a witness account, or turning-point information) — no filler locations, no generic stock places.
- SCENE ITEMS: for each location, list its items — the named things, objects, and areas ACTUALLY VISIBLE in that place's picture, exactly as the story establishes the place (its setting, era, and state in the story — a 1920s club office holds a decanter and ledger books, never a laptop; a dock holds a mooring post and crates). Each item: id (unique within the location), name (the visible thing, e.g. "The decanter on the desk", "The dumpster", "The fire escape"), and x/y/w/h = the percentage region of the scene image that IS that thing's area. Every clue's itemId MUST name the scene item of its location that the evidence pertains to — the evidence is found ON that visible thing, and in play the audience's spyglass highlights that item's area. An item the story makes irrelevant is scenery: list it if the place really contains it, but bind no evidence to it.
- THE TWO LAYERS: (1) THE APPROVED STORY is the FULL master truth, host-only: actualCrimeDetails (the reality of what happened), every clue's storySignificance (that evidence's importance and relevance to the characters and to the crime), and every suspect's trueRole (what role they ACTUALLY played) and alibiReality (whether their alibi holds and how it actually took place). Write these completely and truthfully against the one real story — they are the standard everything else must cohere with. (2) THE DETECTIVE'S CASE BRIEF is the distinct opening layer the published game opens with, under the game's title (based on the crime). It has TWO artifacts: briefNarration — the HOST'S FULL SCRIPT, the complete narrative the host reads aloud from their dashboard (host-side only; it is stripped from the audience payload) — write it in this exact shape: the victim and who they were; the place; how the body/situation was found and where; who discovered it and when; the discoverer's statement, in their voice, in quotes; and ONE initial observed discrepancy that hands the detective a first analytical thread (an observed fact that does not sit right — drawn ONLY from what was observed at the scene, never from the master truth: no true roles, no alibi realities, no significance, no hint of the guilty party). And briefDocument — the AUDIENCE document: a typed, official case-brief document SUMMARIZING the script's pertinent info (labeled lines: VICTIM / SCENE / FOUND / DISCOVERED BY / DISCOVERER'S STATEMENT (summary) / NOTED AT THE SCENE) — the summary version of the same beats, not the full script. The brief completes with the suspects' basic character files (the public card fields + their CLAIMED alibi) and the few pieces of evidence flagged initiallyPresent true — the evidence initially present at the opening (the first-glance evidence where the crime was discovered). Keep initiallyPresent RARE (1-3 pieces across the case); everything else is initiallyPresent false and is discovered through play only.
- SUSPECT UNLOCKS: for each suspect, exactly ONE clue has unlocksSuspectId set to that suspect's id — the map discovery that points to that suspect's connection and unlocks the detective's ability to question them. At least 4 locations each hold one suspect's unlock discovery. Every unlock clue's cutScenePrompt must describe a CINEMATIC VIDEO CUT SCENE showing the evidence and how it ties that suspect to the crime, and its relatedSuspectIds must include that suspect.
- THE OTHER LOCATIONS (the ones holding no unlock — typically 2): their key evidence is EITHER a relevant witness account (assign one required witness's locationId to that location — the account is discovered there) OR a clue with turningPoint true carrying new, previously-unknown information that can change the trajectory of the investigation.
- MEDIA IS THE SUBSTANCE: every clue gets a cinematic cutScenePrompt (the evidence reveal video) and most get an audioPrompt (a short audio evidence clip: a recorded message, a sound from that night, a statement fragment — write it as a vivid production prompt). Every location gets a cinematic imagePrompt (its scene visual). Every suspect gets a guideVideoPrompt. Write ALL media prompts for high-end cinematic output: specify cinematic lighting, rich detail, film-still composition, and mood (noir, suspenseful). Prompts are sent to the generator exactly as written (no auto-enhancement), so the quality lives in your wording.
- 2-4 crime flashbacks: short cinematic snippets uncovering fragments of what happened (each with a videoPrompt and 1+ relatedSuspectIds). FLASHBACK FAIRNESS RULE: every suspect must be implicated by at least one clue or flashback, and no single suspect may dominate the flashbacks — the snippets must never telegraph the culprit, or the audience solves it by screen time.
- 3-5 required witnesses (id, name, role, statement — static authored accounts; the detective must hear every one before the accusation). 2-4 helper witnesses (gift-triggered clue helpers — static authored content): description FIRST (the character the host described), then info (what they can reveal) and howItHelps (how that information helps the detective move forward). Helpers are optional extra help — never critical to solving, never required for the arrest.
- 5-8 timeline events; 2-3 pre-woven twists with trigger moments (surprises for the detective and suspects; the host deploys them); 2-3 cinematic case-insight video prompts.
- interrogationSeconds must be 300 (questioning runs on a 5-minute timer per suspect). courtroomSeconds 120-300.`;

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
  // Step 0 — the host pitches first. Their ideas/plots/characters/framework are
  // the foundation; only when the host pitches nothing does the builder formulate.
  const premise = String(body.premise || "").trim();
  const pitch = String(body.pitch || "").trim();
  const detectiveCount: 1 | 2 = Number(body.detectiveCount) === 2 ? 2 : 1;
  const suspectCount = Math.max(4, Math.min(7, Math.floor(Number(body.suspectCount) || 4)));
  const notes = String(body.notes || "").trim();
  if (!premise && !pitch) return NextResponse.json({ error: "Pitch your idea first — or add a premise for the builder to formulate from." }, { status: 400 });

  const user = `Write a City Crime Scene mystery package.\n${pitch ? `THE HOST'S PITCH — build the case from this; the host's creative input is the deciding factor:\n${pitch}\n` : ""}${premise ? `Premise: ${premise}\n` : "The host has pitched nothing — formulate an original storyline, characters, and crime yourself.\n"}Cast: ${detectiveCount} detective(s), ${suspectCount} suspects (exactly one guilty), around 6 map locations with at least 4 evidence pieces each.\n${notes ? `Host notes (the host's word is final — honor these exactly): ${notes}\n` : ""}Return only the JSON object.`;

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
      // Questioning runs on a 5-minute timer per suspect — not the model's choice.
      config.interrogationSeconds = 300;
      // Merge over defaults so legacy shapes migrate before validation.
      const merged = readCityCrimeSceneConfig({ mystery: config });
      const problems = validateCityCrimeScene(merged);
      const standards = validateCityCrimeSceneStandards(merged);
      return NextResponse.json({ config: merged, validation: problems, standards });
    } catch {
      lastError = "Could not reach the AI service.";
    }
  }
  return NextResponse.json({ error: lastError || "The mystery could not be generated right now." }, { status: 502 });
}
