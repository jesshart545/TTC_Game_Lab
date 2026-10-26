import {timerAction} from '../../../../lib/timer-controls';
import {coinOutcome} from "../../../../lib/coin-toss";
import {controlConnectionError} from "../../../../lib/control-connections";
import {changeCard} from "../../../../lib/card-server";
import {cardControl} from "../../../../lib/question-cards";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import type { Project, GameTool } from "../../../../lib/project";
import { createHash, timingSafeEqual } from "node:crypto";
import { randomUUID, randomInt } from "node:crypto";
import { readCityCrimeSceneConfig, sanitizeCityCrimeSceneForOverlay, accusationVerdict, readCityCrimeSceneLiveState, ccssProgress, ccssUnlocksForRevealedClues, ccssQuestioningOpen, ccssHelperAvailable, generalizedKeyEvidence } from "../../../../lib/city-crime-scene";
import { verifyYoutube } from "../../../../lib/youtube-server";
import { youtubeId, youtubePosition, safeYoutubePlacement } from "../../../../lib/youtube";
import type { YouTubeState } from "../../../../lib/youtube";

type Context = { params: Promise<{ slug: string }> };

async function published(slug: string) {
  const db = getDb();
  if (!db) return null;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  const rows = await db`SELECT data FROM projects WHERE slug = ${slug} AND deleted_at IS NULL LIMIT 1`;
  const project = rows[0]?.data as Project | undefined;
  return project?.publishedSnapshot ? { db, project: project.publishedSnapshot } : null;
}

async function ensureLiveEvents(db: ReturnType<typeof getDb>) {
  if (!db) return;
  await db`CREATE TABLE IF NOT EXISTS live_events (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, control_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE live_events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'control'`;
  await db`ALTER TABLE live_events ADD COLUMN IF NOT EXISTS payload JSONB`;
}

async function hostKeyValid(db: ReturnType<typeof getDb>, projectId: string, key: string) {
  if (!db || !/^[a-f0-9]{64}$/.test(key)) return false;
  await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
  const hosts = await db`SELECT token_hash FROM live_hosts WHERE project_id = ${projectId}`;
  const expected = String(hosts[0]?.token_hash || "");
  const actual = createHash("sha256").update(key).digest("hex");
  return /^[a-f0-9]{64}$/.test(expected) && timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

type CcssAction = { toolId: string; kind: string; locationId?: string; clueId?: string; suspectId?: string; witnessId?: string; flashbackId?: string };

/**
 * Build a City Crime Scene overlay outcome from PUBLIC fields only.
 * The snapshot config is sanitized at publish; sanitize again here defensively.
 * Guilt, case truth, twists, detective intel never leave this function.
 *
 * Investigation progress (revealed clues, introduced suspects, unlocked
 * witnesses) rides along in every outcome so the host panel can show it and
 * the arrest stays locked until the investigation is complete.
 */
function ccssOutcome(tool: GameTool, action: CcssAction, prev: any) {
  const cfg = sanitizeCityCrimeSceneForOverlay(readCityCrimeSceneConfig(tool.config as Record<string, unknown>));
  const state = readCityCrimeSceneLiveState(prev);
  const title = String(cfg.title || "City Crime Scene");
  const kind = String(action.kind || "");
  const progress = () => ccssProgress(cfg, state);
  const derivedUnlocks = () => ccssUnlocksForRevealedClues(cfg, state.revealedClueIds);
  const withTrack = (o: Record<string, unknown>) => {
    const d = derivedUnlocks();
    return {
      ...o,
      revealedClueIds: state.revealedClueIds,
      introducedSuspectIds: state.introducedSuspectIds,
      questionedSuspectIds: state.questionedSuspectIds,
      heardWitnessIds: state.heardWitnessIds,
      unlockedHelperIds: state.unlockedHelperIds,
      unlockedSuspectIds: [...new Set([...state.unlockedSuspectIds, ...d.unlockedSuspectIds])],
      availableHelperIds: [...new Set([...state.availableHelperIds, ...d.availableHelperIds])],
      // Legacy key kept for older host panels.
      unlockedWitnessIds: state.unlockedHelperIds,
      progress: progress(),
    };
  };
  const publicSuspect = (s: (typeof cfg.suspects)[number]) => ({
    id: s.id, name: s.name, occupation: s.occupation,
    age: s.age, gender: s.gender, ethnicity: s.ethnicity,
    knownFor: s.knownFor, personality: s.personality, quote: s.quote,
    characterBrief: s.characterBrief,
    potentialMotive: s.potentialMotive, alibi: s.alibi, guideVideoKey: s.guideVideoKey,
  });
  const publicWitness = (w: (typeof cfg.witnesses)[number]) => ({ id: w.id, name: w.name, role: w.role, statement: w.statement });
  // Opening beat 1: the crime itself.
  if (kind === "crimeIntro") return withTrack({ kind, title, premise: cfg.premise, crime: cfg.crime, victim: cfg.victim });
  // Opening beat 2: a character card for every suspect, plus the required witness statements.
  if (kind === "suspectLineup") return withTrack({ kind, title, suspects: cfg.suspects.map(publicSuspect), witnesses: cfg.witnesses.map(publicWitness) });
  // Legacy combined briefing (kept for older live events).
  if (kind === "briefing") return withTrack({ kind, title, premise: cfg.premise, crime: cfg.crime, victim: cfg.victim, witnessStatements: cfg.witnesses.map(w => `${w.name}${w.role ? ` (${w.role})` : ""}: ${w.statement}`), locations: cfg.locations.map(l => ({ id: l.id, name: l.name, description: l.description })), suspects: cfg.suspects.map(publicSuspect) });
  // The map: every location, free-roam — the detective chooses where to go.
  if (kind === "map") {
    return withTrack({ kind: "map", title, locations: cfg.locations.map(l => ({
      id: l.id, name: l.name, description: l.description, imageKey: l.imageKey, imagePrompt: l.imagePrompt,
      isCrimeScene: !!l.isCrimeScene,
      cluesFound: cfg.clues.filter(c => c.locationId === l.id && state.revealedClueIds.includes(c.id)).length,
      cluesTotal: cfg.clues.filter(c => c.locationId === l.id).length,
    })) });
  }
  if (kind === "investigate") {
    const location = cfg.locations.find(l => l.id === action.locationId) || cfg.locations[0];
    if (!location) return { error: "Add locations to City Crime Scene first." };
    const keyWitness = cfg.witnesses.find(w => w.locationId === location.id);
    return withTrack({ kind: "location", location: { id: location.id, name: location.name, description: location.description, imageKey: location.imageKey, imagePrompt: location.imagePrompt, isCrimeScene: !!location.isCrimeScene }, keyWitness: keyWitness ? { id: keyWitness.id, name: keyWitness.name, role: keyWitness.role } : undefined, clues: cfg.clues.filter(c => c.locationId === location.id).map(c => ({ id: c.id, title: c.title, hotspot: c.hotspot, hotspotX: c.hotspotX, hotspotY: c.hotspotY, revealed: state.revealedClueIds.includes(c.id), unlocksSuspect: !!c.unlocksSuspectId })) });
  }
  if (kind === "revealClue") {
    const clue = cfg.clues.find(c => c.id === action.clueId);
    if (!clue) return { error: "Clue not found." };
    if (!state.revealedClueIds.includes(clue.id)) state.revealedClueIds.push(clue.id);
    // A map discovery may unlock the INITIAL ability to question a suspect or
    // use a clue helper — record it so the host panel reflects the unlock.
    const d = derivedUnlocks();
    state.unlockedSuspectIds = [...new Set([...state.unlockedSuspectIds, ...d.unlockedSuspectIds])];
    state.availableHelperIds = [...new Set([...state.availableHelperIds, ...d.availableHelperIds])];
    return withTrack({ kind: "clue", clue: { id: clue.id, title: clue.title, description: clue.description, cutSceneVideoKey: clue.cutSceneVideoKey, audioKey: clue.audioKey, hotspot: clue.hotspot } });
  }
  if (kind === "introduceSuspect") {
    const s = cfg.suspects.find(x => x.id === action.suspectId);
    if (!s) return { error: "Suspect not found." };
    if (!state.introducedSuspectIds.includes(s.id)) state.introducedSuspectIds.push(s.id);
    // The suspect's card shows key evidence GENERALIZED only — specifics are
    // expounded in play, never on suspect-facing materials.
    return withTrack({ kind: "suspect", suspect: publicSuspect(s), keyEvidence: generalizedKeyEvidence(cfg, s.id) });
  }
  if (kind === "questionSuspect") {
    const s = cfg.suspects.find(x => x.id === action.suspectId);
    if (!s) return { error: "Suspect not found." };
    if (!ccssQuestioningOpen(cfg, state, s.id))
      return { error: `${s.name} can't be questioned yet — the detective must first discover the map evidence that points to their connection to the crime.` };
    if (!state.introducedSuspectIds.includes(s.id)) state.introducedSuspectIds.push(s.id);
    if (!state.questionedSuspectIds.includes(s.id)) state.questionedSuspectIds.push(s.id);
    return withTrack({ kind: "questioned", suspect: { id: s.id, name: s.name } });
  }
  if (kind === "hearWitness") {
    const w = cfg.witnesses.find(x => x.id === action.witnessId);
    if (!w) return { error: "Witness not found." };
    if (!state.heardWitnessIds.includes(w.id)) state.heardWitnessIds.push(w.id);
    return withTrack({ kind: "witnessHeard", witness: publicWitness(w) });
  }
  if (kind === "flashback") {
    const fb = cfg.flashbacks.find(x => x.id === action.flashbackId);
    if (!fb) return { error: "Flashback not found." };
    return withTrack({ kind: "flashback", flashback: { id: fb.id, title: fb.title, description: fb.description, videoKey: fb.videoKey } });
  }
  if (kind === "evidence") return withTrack({ kind: "evidence", title, clues: cfg.clues.filter(c => state.revealedClueIds.includes(c.id)).map(c => ({ id: c.id, title: c.title, description: c.description, locationName: cfg.locations.find(l => l.id === c.locationId)?.name || "" })) });
  if (kind === "arrest") {
    if (!progress().complete)
      return { error: "The investigation isn't complete yet — reveal every clue, introduce and question every suspect, and hear every witness before the arrest. (Helper witnesses are optional and never block the arrest.)" };
    const s = cfg.suspects.find(x => x.id === action.suspectId);
    if (!s) return { error: "Choose a suspect to arrest." };
    return withTrack({ kind: "arrest", suspect: { id: s.id, name: s.name, characterBrief: s.characterBrief } });
  }
  if (kind === "verdict") {
    const s = cfg.suspects.find(x => x.id === action.suspectId);
    if (!s) return { error: "Choose a suspect for the verdict." };
    return withTrack({ kind: "verdict", suspect: { id: s.id, name: s.name }, correct: !!(action as CcssAction & { correct?: boolean }).correct });
  }
  if (kind === "courtroom") {
    const defendant = cfg.suspects.find(x => x.id === action.suspectId) || cfg.suspects[0];
    if (!defendant) return { error: "Add suspects to City Crime Scene first." };
    const shown = cfg.clues.filter(c => state.revealedClueIds.includes(c.id)).map(c => ({ id: c.id, title: c.title, description: c.description, defendant: c.relatedSuspectIds.includes(defendant.id) }));
    return withTrack({ kind: "courtroom", defendant: { id: defendant.id, name: defendant.name }, pointingAt: shown.filter(c => c.defendant), pointedElsewhere: shown.filter(c => !c.defendant), witnessStatements: cfg.witnesses.map(w => `${w.name}${w.role ? ` (${w.role})` : ""}: ${w.statement}`), courtroomSeconds: cfg.courtroomSeconds });
  }
  if (kind === "unlockWitness") {
    const w = cfg.helperWitnesses.find(x => x.id === action.witnessId);
    if (!w) return { error: "Witness not found." };
    if (!ccssHelperAvailable(cfg, state, w.id))
      return { error: `${w.name} hasn't been discovered on the map yet — the detective must find the evidence that makes this helper available first.` };
    if (!state.unlockedHelperIds.includes(w.id)) state.unlockedHelperIds.push(w.id);
    return withTrack({ kind: "witness", witness: { id: w.id, name: w.name, role: w.role, description: w.description, info: w.info, mediaKey: w.mediaKey, portraitKey: w.portraitKey, videoKey: w.videoKey } });
  }
  if (kind === "hide") return withTrack({ kind: "hide" });
  return { error: "Unknown City Crime Scene action." };
}

async function ccssAct(db: ReturnType<typeof getDb>, projectId: string, tool: GameTool, action: CcssAction) {
  const last = await db!`SELECT payload FROM live_events WHERE project_id=${projectId} AND control_id=${tool.id} AND event_type='control' ORDER BY id DESC LIMIT 1`;
  let prev: any = {};
  try { prev = JSON.parse(String(last[0]?.payload?.outcomes?.[tool.id]?.result || "{}")); } catch {}
  if (action.kind === "verdict") {
    // The detective's accusation is judged server-side against the full draft config
    // (the published snapshot is sanitized and has no isGuilty). Only correct/wrong
    // leaves the server — never the guilty party's identity.
    const rows = await db!`SELECT data FROM projects WHERE id=${projectId} LIMIT 1`;
    const draft = rows[0]?.data as { gameTools?: Array<{ id?: string; type?: string; config?: Record<string, unknown> }> } | undefined;
    const draftTool = draft?.gameTools?.find(t => t.id === tool.id && t.type === "city-crime-scene");
    const full = readCityCrimeSceneConfig((draftTool?.config as Record<string, unknown>) || {});
    const v = accusationVerdict(full, String(action.suspectId || ""));
    if ("error" in v) return { error: v.error };
    (action as CcssAction & { correct?: boolean }).correct = v.correct;
  }
  const outcome = ccssOutcome(tool, action, prev) as { error?: string };
  if (outcome.error) return { error: outcome.error };
  const payload = JSON.stringify({ outcomes: { [tool.id]: { result: JSON.stringify(outcome) } } });
  const rows = await db!`INSERT INTO live_events(project_id,control_id,event_type,payload) VALUES(${projectId},${tool.id},'control',${payload}::jsonb) RETURNING id`;
  return { id: Number(rows[0].id), outcome };
}

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const live = await published(slug);
  if (!live) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
  await ensureLiveEvents(live.db);

  // ---- City Crime Scene: host-only full case file (host key required) ----
  const casefileId = new URL(request.url).searchParams.get("casefile");
  if (casefileId) {
    const key = request.headers.get("x-host-key") || "";
    if (!await hostKeyValid(live.db, live.project.id, key)) return NextResponse.json({ error: "Host access required. Open the dashboard from the builder." }, { status: 403 });
    const rows = await live.db`SELECT data FROM projects WHERE slug = ${slug} LIMIT 1`;
    const draft = rows[0]?.data as Project | undefined;
    const tool = draft?.gameTools?.find(t => t.id === casefileId && t.type === "city-crime-scene");
    if (!tool) return NextResponse.json({ error: "City Crime Scene tool not found." }, { status: 404 });
    return NextResponse.json({ config: (tool.config as Record<string, unknown>)?.mystery || null }, { headers: { "Cache-Control": "no-store" } });
  }

  // ---- City Crime Scene: latest overlay outcome (host panel progress polling) ----
  const ccssStateId = new URL(request.url).searchParams.get("ccssState");
  if (ccssStateId) {
    const key = request.headers.get("x-host-key") || "";
    if (!await hostKeyValid(live.db, live.project.id, key)) return NextResponse.json({ error: "Host access required. Open the dashboard from the builder." }, { status: 403 });
    const rows0 = await live.db`SELECT data FROM projects WHERE slug = ${slug} LIMIT 1`;
    const draft0 = rows0[0]?.data as Project | undefined;
    const tool0 = draft0?.gameTools?.find(t => t.id === ccssStateId && t.type === "city-crime-scene");
    if (!tool0) return NextResponse.json({ error: "City Crime Scene tool not found." }, { status: 404 });
    const rows = await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND control_id=${tool0.id} AND event_type='control' ORDER BY id DESC LIMIT 1`;
    let outcome: unknown = null;
    try { outcome = JSON.parse(String(rows[0]?.payload?.outcomes?.[tool0.id]?.result || "null")); } catch {}
    return NextResponse.json({ outcome }, { headers: { "Cache-Control": "no-store" } });
  }

  const wheelId=new URL(request.url).searchParams.get("wheelSlots");
  if(wheelId){
    const tool=live.project.gameTools.find(t=>t.id===wheelId&&t.type==="wheel"&&t.enabled);
    if(!tool)return NextResponse.json({error:"Wheel not found."},{status:404});
    const rows=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND event_type='wheel-slots' AND control_id=${wheelId} ORDER BY id DESC LIMIT 1`;
    return NextResponse.json({segments:rows[0]?.payload?.segments||tool.config.segments||[]},{headers:{"Cache-Control":"no-store"}});
  }
  const since = Number(new URL(request.url).searchParams.get("since") || 0);
  if (!Number.isSafeInteger(since) || since < 0) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  if (new URL(request.url).searchParams.has("init")) {
    const rows = await live.db`SELECT COALESCE(MAX(id), 0) AS cursor FROM live_events WHERE project_id = ${live.project.id}`;
    const usedRows = await live.db`SELECT payload FROM live_events WHERE project_id = ${live.project.id} AND event_type = 'trivia' AND payload->>'action' = 'question' ORDER BY id ASC`;
    const usedTrivia = usedRows.map(row => {
      const payload = row.payload as { categoryIndex?: number; questionIndex?: number } | null;
      return Number.isInteger(payload?.categoryIndex) && Number.isInteger(payload?.questionIndex) ? `${payload!.categoryIndex}:${payload!.questionIndex}` : null;
    }).filter(Boolean);
    const pollControls=live.project.controls.filter(control=>control.toolIds?.some(id=>live.project.gameTools.some(tool=>tool.id===id && tool.enabled && tool.inToolbox && tool.type==="poll")));
    const activePolls=(await Promise.all(pollControls.map(async control=>{
      const latest=await live.db`SELECT id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND control_id=${control.id} AND event_type='control' AND created_at > NOW() - INTERVAL '1 hour' ORDER BY id DESC LIMIT 1`;
      return latest[0];
    }))).filter(Boolean);
    const latestTrivia=await live.db`SELECT id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND event_type='trivia' ORDER BY id DESC LIMIT 1`;
    const activeTrivia=latestTrivia[0]?.payload?.action !== "close" ? latestTrivia.filter(Boolean) : [];
    const youtube = await live.db`SELECT id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND event_type='youtube' AND created_at > NOW() - INTERVAL '4 hours' ORDER BY id DESC LIMIT 1`;
    if (youtube[0]?.payload) {
      const state=youtube[0].payload as YouTubeState;
      const reports=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND event_type='youtube-feedback' AND payload->>'playbackId'=${state.playbackId} ORDER BY id DESC LIMIT 1`;
      const report=reports[0]?.payload;
      if (state.action === "stop" || report?.playbackId===state.playbackId && ["ended","error","timeout"].includes(report.status)) youtube.splice(0);
      else {
        const reported=report?.playbackId===state.playbackId && Number.isFinite(report.position) && report.at>=state.at;
        const position=reported ? Math.max(state.start,report.position + (["playing","playing-muted"].includes(report.status) ? Math.max(0,Date.now()-report.at)/1000 : 0)) : youtubePosition(state);
        const end=state.end ?? state.durationSeconds;
        if (end != null && position>=end) youtube.splice(0);
        else youtube[0].payload={...state,position,at:Date.now(),action:reported && report.status==="paused" ? "pause" : state.action};
      }
    }
    const background=await live.db`SELECT id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND event_type='control' AND control_id=ANY(${live.project.controls.filter(c=>c.action.startsWith("background.show.")).map(c=>c.id)}) ORDER BY id DESC LIMIT 1`;
    const coinControlIds=live.project.controls.filter(control=>control.action.startsWith('coin.cycle.')).map(control=>control.id);
    const coinEvents=coinControlIds.length?await live.db`SELECT DISTINCT ON(control_id) id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND event_type='control' AND control_id=ANY(${coinControlIds}) ORDER BY control_id,id DESC`:[];
    const activeCoins=coinEvents.filter(event=>Object.values(event.payload?.outcomes||{}).some((outcome:any)=>outcome.phase==='show'||outcome.phase==='flip'));
    const timerIds=live.project.controls.filter(c=>timerAction(c.action)).map(c=>c.id);
    const activeTimers=timerIds.length?await live.db`SELECT DISTINCT ON(payload->>'timerId') id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND event_type='control' AND control_id=ANY(${timerIds}) ORDER BY payload->>'timerId',id DESC`:[];
    const ccssToolIds=live.project.gameTools.filter(t=>t.type==='city-crime-scene'&&t.enabled).map(t=>t.id);
    const ccssEvents=ccssToolIds.length?await live.db`SELECT DISTINCT ON(control_id) id,control_id,event_type,payload FROM live_events WHERE project_id=${live.project.id} AND event_type='control' AND control_id=ANY(${ccssToolIds}) ORDER BY control_id,id DESC`:[];
    const activeCcss=ccssEvents.filter(event=>{try{return JSON.parse(String(event.payload?.outcomes?.[event.control_id]?.result||'{}')).kind!=='hide';}catch{return true;}});
    const events=[...activeTimers,...activeCcss,...background,...activePolls,...activeTrivia,...youtube,...activeCoins].sort((a,b)=>Number(a.id)-Number(b.id)).map(row=>({id:Number(row.id),controlId:row.control_id,type:row.event_type,payload:row.payload}));
    return NextResponse.json({ cursor: Number(rows[0].cursor), events, usedTrivia }, { headers: { "Cache-Control": "no-store" } });
  }
  const rows = await live.db`SELECT id, control_id, event_type, payload FROM live_events WHERE project_id = ${live.project.id} AND id > ${since} ORDER BY id ASC LIMIT 100`;
  return NextResponse.json({ cursor: rows.length ? Number(rows[rows.length - 1].id) : since, events: rows.map(row => ({ id: Number(row.id), controlId: row.control_id, type: row.event_type, payload: row.payload })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: Context) {
  const { slug } = await context.params;
  const live = await published(slug);
  if (!live) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const key = request.headers.get("x-host-key") || "";
  if (!/^[a-f0-9]{64}$/.test(key)) return NextResponse.json({ error: "Open the private host dashboard link from the builder." }, { status: 403 });
  await live.db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
  const hosts = await live.db`SELECT token_hash FROM live_hosts WHERE project_id = ${live.project.id}`;
  const expected = String(hosts[0]?.token_hash || "");
  const actual = createHash("sha256").update(key).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))) {
    return NextResponse.json({ error: "Host access has expired. Open the dashboard from the builder again." }, { status: 403 });
  }

  await ensureLiveEvents(live.db);

  if(body.wheelSlots){
    const tool=live.project.gameTools.find(t=>t.id===body.wheelSlots.toolId&&t.type==="wheel"&&t.enabled&&t.inToolbox);
    const entries=body.wheelSlots.segments;
    if(!tool||!Array.isArray(entries)||entries.length<2||entries.length>100||entries.some(x=>typeof x!=="string"||!x.trim()||x.length>200))return NextResponse.json({error:"Use 2–100 nonempty wheel slots, up to 200 characters each."},{status:400});
    const segments=entries.map(x=>x.trim());
    const payload=JSON.stringify({segments});
    await live.db`INSERT INTO live_events(project_id,control_id,event_type,payload) VALUES(${live.project.id},${tool.id},'wheel-slots',${payload}::jsonb)`;
    return NextResponse.json({ok:true,segments});
  }

  // ---- Cliffhanger: price guess from host panel (no controlId, like wheelSlots) ----
  if(body.cliffGuess){
    const toolId=String(body.cliffGuess.toolId||'');
    const tool=live.project.gameTools.find(t=>t.id===toolId&&t.type==='cliffhanger'&&t.enabled&&t.inToolbox);
    const guess=Math.max(0,Math.round(Number(body.cliffGuess.guess)));
    if(!tool||!Number.isFinite(guess))return NextResponse.json({error:"Enter a valid price guess."},{status:400});
    const items=(Array.isArray(tool.config.items)?tool.config.items:[]).map((c:any)=>({label:String(c?.label??''),price:Math.max(0,Math.round(Number(c?.price)||0))})).filter(c=>c.label);
    if(!items.length)return NextResponse.json({error:"Add items with prices to Cliffhanger first."},{status:400});
    const stepsToFall=Math.max(5,Math.min(100,Math.floor(Number(tool.config.stepsToFall)||25)));
    const dollarsPerStep=Math.max(1,Number(tool.config.dollarsPerStep)||1);
    const last=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND control_id=${tool.id} AND event_type='control' ORDER BY id DESC LIMIT 1`;
    let prev:any={};try{prev=JSON.parse(String(last[0]?.payload?.outcomes?.[tool.id]?.result||'{}'));}catch{}
    const itemIndex=Number.isInteger(prev.itemIndex)&&prev.itemIndex>=0?prev.itemIndex:0;
    const item=items[itemIndex%items.length];
    const position=Number(prev.position)||0;
    const diff=Math.abs(guess-item.price);
    const steps=Math.round(diff/dollarsPerStep);
    const newPosition=position+steps;
    const fell=newPosition>=stepsToFall;
    const outcome={phase:'guess',item,itemIndex,guess,price:item.price,diff,steps,position:newPosition,fell,stepsToFall,dollarsPerStep};
    const payload=JSON.stringify({outcomes:{[tool.id]:{result:JSON.stringify(outcome)}}});
    const rows=await live.db`INSERT INTO live_events(project_id,control_id,event_type,payload) VALUES(${live.project.id},${tool.id},'control',${payload}::jsonb) RETURNING id`;
    return NextResponse.json({ok:true,id:Number(rows[0].id),outcome});
  }

  // ---- City Crime Scene: phase actions from the host panel (no controlId, like cliffGuess) ----
  if(body.cityCrimeSceneAction){
    const action=body.cityCrimeSceneAction as CcssAction;
    const tool=live.project.gameTools.find(t=>t.id===String(action.toolId||'')&&t.type==='city-crime-scene'&&t.enabled);
    if(!tool)return NextResponse.json({error:"City Crime Scene tool not found."},{status:400});
    const done=await ccssAct(live.db,live.project.id,tool,action);
    if((done as {error?:string}).error)return NextResponse.json({error:(done as {error:string}).error},{status:400});
    return NextResponse.json({ok:true,...done});
  }

  if (body.youtube) {
    try {
      const action = body.youtube.action;
      if (!["play","pause","resume","stop"].includes(action)) return NextResponse.json({ error: "Invalid YouTube action." }, { status: 400 });
      const latest = await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND event_type='youtube' AND created_at > NOW() - INTERVAL '4 hours' ORDER BY id DESC LIMIT 1`;
      const previous = latest[0]?.payload as YouTubeState | undefined;
      let state: YouTubeState;
      if (action === "play") {
        const id = youtubeId(body.youtube.videoId);
        const start = Number(body.youtube.start ?? 0);
        const end = body.youtube.end == null ? null : Number(body.youtube.end);
        const volume = Number(body.youtube.volume ?? 80);
        if (!id || !Number.isFinite(start) || start < 0 || start > 86400 || end !== null && (!Number.isFinite(end) || end <= start || end > 86400) || !Number.isFinite(volume) || volume < 0 || volume > 100) return NextResponse.json({ error: "Choose a valid video, clip range and volume." }, { status: 400 });
        const region = /^[A-Z]{2}$/.test(body.youtube.region || "") ? body.youtube.region : "US";
        const verified = await verifyYoutube(id, region);
        if (verified.durationSeconds && (start >= verified.durationSeconds || end !== null && end > verified.durationSeconds + 1)) return NextResponse.json({error:"Choose clip times within the video's length."},{status:400});
        state = { action, videoId: id, title: verified.title, durationSeconds: verified.durationSeconds, startMuted: false, start, end, position: start, at: Date.now(), volume, placement: safeYoutubePlacement(body.youtube.placement), playbackId: randomUUID() };
      } else {
        if (!previous || previous.action === "stop") return NextResponse.json({ error: "No YouTube clip is active on the overlay." }, { status: 400 });
        const reports = await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND event_type='youtube-feedback' AND payload->>'playbackId'=${previous.playbackId} ORDER BY id DESC LIMIT 1`;
        const report = reports[0]?.payload;
        const position = report && Number.isFinite(report.position) && report.at >= previous.at
          ? Math.max(previous.start, Math.min(previous.end ?? 86400, report.position + ((report.status === "playing" || report.status === "playing-muted") ? Math.max(0, Date.now()-report.at)/1000 : 0)))
          : youtubePosition(previous);
        if (action === "resume" && previous.end !== null && position >= previous.end) return NextResponse.json({ error: "This clip has finished. Press Play on overlay to restart it." }, { status: 400 });
        state = { ...previous, action, position, at: Date.now() };
      }
      const payload = JSON.stringify(state);
      const rows = await live.db`INSERT INTO live_events (project_id,control_id,event_type,payload) VALUES (${live.project.id},'youtube','youtube',${payload}::jsonb) RETURNING id`;
      return NextResponse.json({ ok: true, id: Number(rows[0].id), state });
    } catch(error) { return NextResponse.json({ error: error instanceof Error ? error.message : "YouTube playback could not be started." }, { status: 502 }); }
  }

  if (body.trivia) {
    const triviaTool = (live.project.gameTools || []).find(tool => tool.type === "trivia-board" && tool.enabled);
    if (!triviaTool) return NextResponse.json({ error: "Trivia Board is not enabled in this published experience." }, { status: 400 });
    const action = String(body.trivia.action || "");
    if (!['question', 'answer', 'close'].includes(action)) return NextResponse.json({ error: "Invalid trivia action." }, { status: 400 });

    let payload: Record<string, unknown> = { action };
    if (action !== "close") {
      const categoryIndex = Number(body.trivia.categoryIndex);
      const questionIndex = Number(body.trivia.questionIndex);
      const categories = Array.isArray(triviaTool.config.categories) ? triviaTool.config.categories as Array<{ name?: string; questions?: Array<{ value?: number; prompt?: string; answer?: string; source?: string; sourceUrl?: string }> }> : [];
      const category = categories[categoryIndex];
      const question = category?.questions?.[questionIndex];
      if (!Number.isInteger(categoryIndex) || !Number.isInteger(questionIndex) || !category || !question) {
        return NextResponse.json({ error: "Trivia question is not in the published board." }, { status: 400 });
      }
      payload = { action, categoryIndex, questionIndex, category: category.name || "Trivia", value: question.value || 0, prompt: question.prompt || "", answer: question.answer || "", source: question.source || "", sourceUrl: question.sourceUrl || "" };
    }
    const payloadJson = JSON.stringify(payload);
    const rows = await live.db`INSERT INTO live_events (project_id, control_id, event_type, payload) VALUES (${live.project.id}, ${"trivia"}, ${"trivia"}, ${payloadJson}::jsonb) RETURNING id`;
    return NextResponse.json({ ok: true, id: Number(rows[0].id) });
  }

  const control = live.project.controls.find(item => item.id === body.controlId);
  if (!control || (control.compositionId && !live.project.compositions?.some(comp => comp.id === control.compositionId && comp.inProject))) {
    return NextResponse.json({ error: "Control is not in the published experience." }, { status: 400 });
  }
  const connectionError=controlConnectionError(live.project,control);if(connectionError)return NextResponse.json({error:connectionError},{status:409});
  const legacyPicker=live.project.gameTools.find(t=>t.type==='random-picker'&&control.action===`tool.${t.id}`);
  const card=legacyPicker?{toolId:legacyPicker.id,action:'draw' as const}:cardControl(control.action);if(card){try{return NextResponse.json({ok:true,state:await changeCard(live.db,live.project,card.toolId,card.action,undefined,String(live.project.gameTools.find(t=>t.id===card.toolId)?.config.text||""))});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Card action failed."},{status:409});}}
  const timer=timerAction(control.action);
  if(timer){
    const seconds=Math.max(1,Math.min(86400,Number(live.project.gameTools.find(t=>t.id===timer.toolId)!.config.seconds)||10)),at=Date.now(),operation=timer.operation;
    await live.db`CREATE TABLE IF NOT EXISTS live_timer_states (project_id TEXT NOT NULL,tool_id TEXT NOT NULL,visible BOOLEAN NOT NULL,running BOOLEAN NOT NULL,remaining DOUBLE PRECISION NOT NULL,at DOUBLE PRECISION NOT NULL,PRIMARY KEY(project_id,tool_id))`;
    const rows=await live.db`WITH next_timer AS (
      INSERT INTO live_timer_states(project_id,tool_id,visible,running,remaining,at) VALUES(${live.project.id},${timer.toolId},${operation==='show'||operation==='toggle'},${operation==='toggle'},${seconds},${at})
      ON CONFLICT(project_id,tool_id) DO UPDATE SET
        visible=CASE WHEN ${operation}='hide' THEN FALSE WHEN ${operation} IN ('show','toggle') THEN TRUE ELSE live_timer_states.visible END,
        running=CASE WHEN ${operation}='toggle' THEN NOT live_timer_states.running WHEN ${operation} IN ('reset','hide') THEN FALSE ELSE live_timer_states.running END,
        remaining=CASE WHEN ${operation}='reset' THEN ${seconds}
          WHEN ${operation}='toggle' AND GREATEST(0,live_timer_states.remaining-CASE WHEN live_timer_states.running THEN (${at}-live_timer_states.at)/1000 ELSE 0 END)<=0 THEN ${seconds}
          ELSE GREATEST(0,live_timer_states.remaining-CASE WHEN live_timer_states.running THEN (${at}-live_timer_states.at)/1000 ELSE 0 END) END,at=${at}
      RETURNING visible,running,remaining,at
    ) INSERT INTO live_events(project_id,control_id,event_type,payload) SELECT ${live.project.id},${control.id},'control',jsonb_build_object('timerId',${timer.toolId}::text,'outcomes',jsonb_build_object(${timer.toolId}::text,jsonb_build_object('result','','timer',jsonb_build_object('visible',visible,'running',running,'remaining',remaining,'at',at)))) FROM next_timer RETURNING id`;
    return NextResponse.json({ok:true,id:Number(rows[0].id)});
  }
  if(control.action.startsWith('coin.cycle.')){
    const toolId=control.action.slice(11),result=coinOutcome(randomInt(2));
    await live.db`CREATE TABLE IF NOT EXISTS live_coin_states (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, phase INTEGER NOT NULL, result TEXT NOT NULL DEFAULT '', PRIMARY KEY(project_id,tool_id))`;
    const rows=await live.db`WITH next_coin AS (
      INSERT INTO live_coin_states(project_id,tool_id,phase,result) VALUES(${live.project.id},${toolId},1,'')
      ON CONFLICT(project_id,tool_id) DO UPDATE SET phase=(live_coin_states.phase+1)%3,result=CASE WHEN live_coin_states.phase=1 THEN ${result} ELSE '' END
      RETURNING phase,result
    ) INSERT INTO live_events(project_id,control_id,event_type,payload)
      SELECT ${live.project.id},${control.id},'control',jsonb_build_object('outcomes',jsonb_build_object(${toolId}::text,jsonb_build_object('phase',CASE phase WHEN 1 THEN 'show' WHEN 2 THEN 'flip' ELSE 'hide' END,'result',result))) FROM next_coin RETURNING id`;
    return NextResponse.json({ok:true,id:Number(rows[0].id)});
  }
  // ---- Higher or Lower ----
  if(control.action.startsWith('hl.')){
    const rest=control.action.slice(3),op=rest.split('.')[0],toolId=rest.slice(op.length+1);
    const tool=live.project.gameTools.find(t=>t.id===toolId&&t.type==='higher-lower'&&t.enabled);
    if(!tool)return NextResponse.json({error:"Higher or Lower tool not found."},{status:400});
    const cards=(Array.isArray(tool.config.cards)?tool.config.cards:[]).map((c:any)=>({label:String(c?.label??''),value:Number(c?.value)||0})).filter(c=>c.label);
    if(cards.length<2)return NextResponse.json({error:"Add at least 2 cards to Higher or Lower first."},{status:400});
    let outcome:any;
    if(op==='draw'){
      outcome={phase:'draw',card:cards[randomInt(cards.length)]};
    }else if(op==='higher'||op==='lower'){
      const last=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND control_id=${tool.id} AND event_type='control' ORDER BY id DESC LIMIT 1`;
      let prev:any=null;
      try{prev=JSON.parse(String(last[0]?.payload?.outcomes?.[tool.id]?.result||'')).card||null;}catch{}
      if(!prev||typeof prev.value!=='number')return NextResponse.json({error:"Draw a card first."},{status:400});
      const next=cards[randomInt(cards.length)];
      const correct=op==='higher'?next.value>prev.value:next.value<prev.value;
      outcome={phase:'reveal',prev,next,guess:op,correct};
    }else return NextResponse.json({error:"Unknown Higher or Lower action."},{status:400});
    const payload=JSON.stringify({outcomes:{[tool.id]:{result:JSON.stringify(outcome)}}});
    const rows=await live.db`INSERT INTO live_events(project_id,control_id,event_type,payload) VALUES(${live.project.id},${control.id},'control',${payload}::jsonb) RETURNING id`;
    return NextResponse.json({ok:true,id:Number(rows[0].id)});
  }
  // ---- Cliffhanger: next item / reset ----
  if(control.action.startsWith('cliff.')){
    const rest=control.action.slice(6),op=rest.split('.')[0],toolId=rest.slice(op.length+1);
    const tool=live.project.gameTools.find(t=>t.id===toolId&&t.type==='cliffhanger'&&t.enabled);
    if(!tool)return NextResponse.json({error:"Cliffhanger tool not found."},{status:400});
    const items=(Array.isArray(tool.config.items)?tool.config.items:[]).map((c:any)=>({label:String(c?.label??''),price:Math.max(0,Math.round(Number(c?.price)||0))})).filter(c=>c.label);
    if(!items.length)return NextResponse.json({error:"Add items with prices to Cliffhanger first."},{status:400});
    const stepsToFall=Math.max(5,Math.min(100,Math.floor(Number(tool.config.stepsToFall)||25)));
    const dollarsPerStep=Math.max(1,Number(tool.config.dollarsPerStep)||1);
    const last=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND control_id=${tool.id} AND event_type='control' ORDER BY id DESC LIMIT 1`;
    let prev:any={};try{prev=JSON.parse(String(last[0]?.payload?.outcomes?.[tool.id]?.result||'{}'));}catch{}
    let outcome:any;
    if(op==='next'){
      const itemIndex=((Number(prev.itemIndex)??-1)+1)%items.length;
      outcome={phase:'item',item:items[itemIndex],itemIndex,position:Number(prev.position)||0,stepsToFall,dollarsPerStep};
    }else if(op==='reset'){
      outcome={phase:'reset',itemIndex:-1,position:0,stepsToFall,dollarsPerStep};
    }else return NextResponse.json({error:"Unknown Cliffhanger action."},{status:400});
    const payload=JSON.stringify({outcomes:{[tool.id]:{result:JSON.stringify(outcome)}}});
    const rows=await live.db`INSERT INTO live_events(project_id,control_id,event_type,payload) VALUES(${live.project.id},${control.id},'control',${payload}::jsonb) RETURNING id`;
    return NextResponse.json({ok:true,id:Number(rows[0].id)});
  }
  // ---- Prize wheel: next player resets the total ----
  if(control.action.startsWith('prizewheel.')){
    const rest=control.action.slice(11),op=rest.split('.')[0],toolId=rest.slice(op.length+1);
    const tool=live.project.gameTools.find(t=>t.id===toolId&&t.type==='prize-wheel'&&t.enabled);
    if(!tool||op!=='nextplayer')return NextResponse.json({error:"Big Wheel tool not found."},{status:400});
    const outcome={phase:'nextplayer',total:0};
    const payload=JSON.stringify({outcomes:{[tool.id]:{result:JSON.stringify(outcome)}}});
    const rows=await live.db`INSERT INTO live_events(project_id,control_id,event_type,payload) VALUES(${live.project.id},${control.id},'control',${payload}::jsonb) RETURNING id`;
    return NextResponse.json({ok:true,id:Number(rows[0].id)});
  }
  // ---- City Crime Scene: dashboard buttons (crime intro / lineup / evidence / hide) ----
  if(control.action.startsWith('ccss.')){
    const rest=control.action.slice(5),op=rest.split('.')[0],toolId=rest.slice(op.length+1);
    const tool=live.project.gameTools.find(t=>t.id===toolId&&t.type==='city-crime-scene'&&t.enabled);
    const kind={crimeIntro:'crimeIntro',suspectLineup:'suspectLineup',briefing:'briefing',evidence:'evidence',hide:'hide'}[op];
    if(!tool||!kind)return NextResponse.json({error:"City Crime Scene action not found."},{status:400});
    const done=await ccssAct(live.db,live.project.id,tool,{toolId:tool.id,kind});
    if((done as {error?:string}).error)return NextResponse.json({error:(done as {error:string}).error},{status:400});
    return NextResponse.json({ok:true,...done});
  }
  if(control.action==='sequence')return NextResponse.json({error:"Run this sequence from the host dashboard."},{status:400});
  const outcomes:Record<string,{result:string;segments?:string[]}>= {};
  for(const tool of live.project.gameTools.filter(t=>t.enabled&&control.toolIds?.includes(t.id))){
    if(tool.type==="wheel"){
      let entries=tool.type==="wheel"?tool.config.segments:tool.config.items;
      if(tool.type==="wheel"){
        const saved=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND event_type='wheel-slots' AND control_id=${tool.id} ORDER BY id DESC LIMIT 1`;
        entries=saved[0]?.payload?.segments||entries;
      }
      if(!Array.isArray(entries)||!entries.length)return NextResponse.json({error:"Add choices before spinning or picking."},{status:400});
      const slots=entries.map(String);outcomes[tool.id]={result:slots[randomInt(slots.length)],...(tool.type==="wheel"?{segments:slots}:{})};
    }
    if(tool.type==="coin-toss")outcomes[tool.id]={result:coinOutcome(randomInt(2))};
    if(tool.type==="dice")outcomes[tool.id]={result:String(1+randomInt(Math.min(100,Math.max(2,Math.floor(Number(tool.config.sides)||6)))))};
    if(tool.type==="plinko"){
      const slots=(Array.isArray(tool.config.slots)?tool.config.slots:[]).map(String).filter(Boolean);
      if(!slots.length)return NextResponse.json({error:"Add prize slots to the Plinko board first."},{status:400});
      outcomes[tool.id]={result:JSON.stringify({winner:randomInt(slots.length),slots})};
    }
    if(tool.type==="prize-wheel"){
      const values=(Array.isArray(tool.config.values)?tool.config.values:[]).map(String).filter(Boolean);
      if(!values.length)return NextResponse.json({error:"Add values to the Big Wheel first."},{status:400});
      const winner=randomInt(values.length);
      const cents=(label:string)=>{const c=label.match(/(\d+)\s*¢/);if(c)return parseInt(c[1],10);const d=label.match(/\$\s*(\d+(?:\.\d{1,2})?)/);if(d)return Math.round(parseFloat(d[1])*100);const n=label.match(/(\d+(?:\.\d{1,2})?)/);return n?Math.round(parseFloat(n[1])*100):0;};
      const last=await live.db`SELECT payload FROM live_events WHERE project_id=${live.project.id} AND control_id=${tool.id} AND event_type='control' ORDER BY id DESC LIMIT 1`;
      let prevTotal=0;try{prevTotal=Number(JSON.parse(String(last[0]?.payload?.outcomes?.[tool.id]?.result||'{}')).total)||0;}catch{}
      const total=prevTotal+cents(values[winner]);
      outcomes[tool.id]={result:JSON.stringify({winner,values,total,busted:total>100})};
    }
  }
  const payload=JSON.stringify({outcomes});
  const rows = await live.db`INSERT INTO live_events (project_id, control_id, event_type,payload) VALUES (${live.project.id}, ${control.id}, ${"control"},${payload}::jsonb) RETURNING id`;
  return NextResponse.json({ ok: true, id: Number(rows[0].id) });
}


