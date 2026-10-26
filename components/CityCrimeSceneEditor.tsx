"use client";
import { useEffect, useRef, useState } from "react";
import type { GameTool } from "../lib/project";
import { generateCcssMedia, type CcssMediaContext } from "../lib/city-crime-scene-media";
import {
  readCityCrimeSceneConfig, validateCityCrimeScene, validateCityCrimeSceneStandards, suggestEvidenceForLocation,
  suggestEvidenceForItem, ccssItemNamesMatch,
  type CityCrimeSceneConfig, type CityCrimeSceneSuspect, type CityCrimeSceneClue,
  type CityCrimeSceneFlashback, type CityCrimeSceneWitness,
  type CityCrimeSceneLocation, type CityCrimeSceneSceneItem, type CityCrimeSceneHelperWitness, type CityCrimeSceneTimelineEvent, type CityCrimeSceneTwist,
} from "../lib/city-crime-scene";

const uid = () => Math.random().toString(36).slice(2, 10);
const lockNote: React.CSSProperties = { background: "#3a2b10", border: "1px solid #d6aa58", color: "#ffe9bd", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem" };

type Pipeline = { storylineApproved: boolean; locationApprovals: Record<string, boolean> };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label style={{ display: "block", margin: "0.5rem 0" }}><span style={{ fontWeight: 600 }}>{label}</span>{children}{hint && <small style={{ display: "block", opacity: 0.75 }}>{hint}</small>}</label>;
}
const TA = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} style={{ width: "100%", minHeight: 64, ...(props.style || {}) }} />;
const IN = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} style={{ width: "100%", ...(props.style || {}) }} />;

export default function CityCrimeSceneEditor({ tool, onSave, media }: { tool: GameTool; onSave: (t: GameTool) => void; media?: CcssMediaContext }) {
  const [m, setM] = useState<CityCrimeSceneConfig>(() => readCityCrimeSceneConfig(tool.config));
  // Cases saved before the staged pipeline existed are not re-gated: their
  // build already happened. New AI drafts start unapproved at the read gate.
  const [pipeline, setPipeline] = useState<Pipeline>(() => {
    const p = (tool.config as Record<string, unknown>).pipeline as Pipeline | undefined;
    return p && typeof p === "object"
      ? { storylineApproved: p.storylineApproved === true, locationApprovals: p.locationApprovals || {} }
      // No stored pipeline = a case built before the staged flow existed; its
      // locations were already built and approved in their own time.
      : { storylineApproved: true, locationApprovals: Object.fromEntries(m.locations.map(l => [l.id, true])) };
  });
  const [saved, setSaved] = useState(false);
  const [premise, setPremise] = useState(m.premise);
  const [pitchMode, setPitchMode] = useState<"pitch" | "formulate">("pitch");
  const [pitch, setPitch] = useState("");
  const [notes, setNotes] = useState("");
  const [genSuspects, setGenSuspects] = useState(m.suspectCount);
  const [genDetectives, setGenDetectives] = useState<1 | 2>(m.detectiveCount);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [walkIdx, setWalkIdx] = useState(0);
  // ---- Scene-item layout (guided walk): the host marks the visible things
  // of a place directly on its picture — drag a rectangle over the object, or
  // click to place a default-sized area. Drag state lives at the top level
  // (hooks cannot run inside the walk's render branch).
  const [markRect, setMarkRect] = useState<{ locId: string; x: number; y: number; w: number; h: number } | null>(null);
  const [markName, setMarkName] = useState("");
  const [itemDrag, setItemDrag] = useState<{ locId: string; itemId: string; dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ px: number; py: number; mode: "mark" | "move"; itemId?: string } | null>(null);
  const [sceneImg, setSceneImg] = useState<{ locId: string; url: string }>({ locId: "", url: "" });
  // Inline media generation (per slot). A generation can run for minutes, so
  // completions apply against the LATEST case state via mRef — never against
  // the render-time snapshot an item's form controls captured.
  const mRef = useRef(m);
  mRef.current = m;
  const [slotBusy, setSlotBusy] = useState<Record<string, boolean>>({});
  const [slotError, setSlotError] = useState<Record<string, string>>({});
  const [slotNote, setSlotNote] = useState<Record<string, string>>({});

  const save = (next: CityCrimeSceneConfig, nextPipeline: Pipeline = pipeline) => {
    setM(next); setPipeline(nextPipeline); setSaved(true);
    onSave({ ...tool, config: { ...tool.config, mystery: next, pipeline: nextPipeline } });
  };
  const patch = (p: Partial<CityCrimeSceneConfig>) => save({ ...m, ...p });
  const problems = validateCityCrimeScene(m);
  const standards = validateCityCrimeSceneStandards(m);
  const allLocationsApproved = m.locations.length > 0 && m.locations.every(l => pipeline.locationApprovals[l.id]);

  const patchLatest = (p: Partial<CityCrimeSceneConfig>) => save({ ...mRef.current, ...p });
  /** Run one media slot end to end: generate through the app's existing
   *  stack, store into the project, then write the asset key onto the item.
   *  A failure lands only in this slot's error line — the case is untouched
   *  and no other slot is affected. */
  const runMedia = async (slot: string, kind: "image" | "video" | "sfx", prompt: string, name: string, apply: (key: string) => void, referenceKey?: string) => {
    if (!media) return;
    setSlotBusy(b => ({ ...b, [slot]: true }));
    setSlotError(e => ({ ...e, [slot]: "" }));
    setSlotNote(n => ({ ...n, [slot]: "Starting generation…" }));
    try {
      const asset = await generateCcssMedia({ kind, prompt, name, referenceKey }, media, text => setSlotNote(n => ({ ...n, [slot]: text })));
      apply(asset.storageKey || asset.name);
      setSlotNote(n => ({ ...n, [slot]: `Saved ✓ — “${asset.name}” is attached to this item.` }));
    } catch (err) {
      setSlotError(e => ({ ...e, [slot]: err instanceof Error ? err.message : "Generation failed." }));
      setSlotNote(n => ({ ...n, [slot]: "" }));
    } finally {
      setSlotBusy(b => ({ ...b, [slot]: false }));
    }
  };
  /** The per-slot Generate control. Renders only when the host supplied a
   *  media context; with no prompt yet it shows as a disabled button with the
   *  reason, never a dead control. */
  const genBtn = (slot: string, label: string, onClick: (() => void) | null, reason?: string) => {
    if (!media) return null;
    const busyNow = !!slotBusy[slot];
    return <div style={{ margin: "0.25rem 0" }}>
      <button type="button" className="build-btn" disabled={busyNow || !onClick} onClick={() => onClick?.()}>{busyNow ? "Generating…" : slotError[slot] ? `Retry — ${label}` : label}</button>
      {!onClick && reason && <small style={{ display: "block", opacity: 0.75 }}>{reason}</small>}
      {slotNote[slot] && <small style={{ display: "block", opacity: 0.85 }}>{slotNote[slot]}</small>}
      {slotError[slot] && <small role="alert" style={{ display: "block", color: "#ff9a9a" }}>{slotError[slot]}</small>}
    </div>;
  };

  // The scene picture for the walk's current location (resolved from its
  // asset key when a media context is available).
  const walkLoc = m.locations.length ? m.locations[Math.min(walkIdx, m.locations.length - 1)] : undefined;
  useEffect(() => {
    let live = true;
    const key = walkLoc?.imageKey;
    if (!media || !key) { setSceneImg({ locId: walkLoc?.id || "", url: "" }); return; }
    media.resolveAssetUrl(key)
      .then(url => { if (live) setSceneImg({ locId: walkLoc?.id || "", url: url || "" }); })
      .catch(() => { if (live) setSceneImg({ locId: walkLoc?.id || "", url: "" }); });
    return () => { live = false; };
  }, [media, walkLoc?.id, walkLoc?.imageKey]);

  /** Write a location's scene items (and, when given, the clue follow-ups —
   *  renames and unbindings — in the SAME save, so items and their bound
   *  clues never disagree). */
  const commitItems = (locId: string, items: CityCrimeSceneSceneItem[], cluePatches?: (clues: CityCrimeSceneClue[]) => CityCrimeSceneClue[]) => {
    patch({
      locations: m.locations.map(l => (l.id === locId ? { ...l, items } : l)),
      ...(cluePatches ? { clues: cluePatches(m.clues) } : {}),
    });
  };
  const framePct = (e: React.PointerEvent, rect: DOMRect) => ({
    x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
  });
  const onFrameDown = (e: React.PointerEvent<HTMLDivElement>, loc: CityCrimeSceneLocation) => {
    const p = framePct(e, e.currentTarget.getBoundingClientRect());
    dragStart.current = { px: p.x, py: p.y, mode: "mark" };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setMarkRect({ locId: loc.id, x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onItemDown = (e: React.PointerEvent<HTMLDivElement>, loc: CityCrimeSceneLocation, item: CityCrimeSceneSceneItem) => {
    e.stopPropagation();
    const frame = e.currentTarget.parentElement;
    if (!frame) return;
    const p = framePct(e, frame.getBoundingClientRect());
    dragStart.current = { px: p.x, py: p.y, mode: "move", itemId: item.id };
    frame.setPointerCapture?.(e.pointerId);
    setItemDrag({ locId: loc.id, itemId: item.id, dx: 0, dy: 0 });
  };
  const onFrameMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStart.current;
    if (!ds) return;
    const p = framePct(e, e.currentTarget.getBoundingClientRect());
    if (ds.mode === "mark")
      setMarkRect(prev => (prev ? { ...prev, x: Math.min(ds.px, p.x), y: Math.min(ds.py, p.y), w: Math.abs(p.x - ds.px), h: Math.abs(p.y - ds.py) } : prev));
    else
      setItemDrag(prev => (prev ? { ...prev, dx: p.x - ds.px, dy: p.y - ds.py } : prev));
  };
  const onFrameUp = (loc: CityCrimeSceneLocation) => {
    const ds = dragStart.current;
    dragStart.current = null;
    if (!ds) return;
    if (ds.mode === "move" && ds.itemId && itemDrag) {
      const item = (loc.items || []).find(it => it.id === ds.itemId);
      if (item) {
        const nx = Math.max(0, Math.min(100 - item.w, item.x + itemDrag.dx));
        const ny = Math.max(0, Math.min(100 - item.h, item.y + itemDrag.dy));
        commitItems(loc.id, (loc.items || []).map(it => (it.id === item.id ? { ...it, x: Math.round(nx), y: Math.round(ny) } : it)));
      }
      setItemDrag(null);
    }
    if (ds.mode === "mark") {
      setMarkRect(prev => {
        if (!prev) return prev;
        // A plain click (no real drag) places a default-sized area centered
        // on the click — either way the host is marking THE OBJECT.
        if (prev.w < 3 && prev.h < 3) {
          const w = 24, h = 24;
          return { ...prev, x: Math.round(Math.max(0, Math.min(100 - w, prev.x - w / 2))), y: Math.round(Math.max(0, Math.min(100 - h, prev.y - h / 2))), w, h };
        }
        return { ...prev, x: Math.round(prev.x), y: Math.round(prev.y), w: Math.round(prev.w), h: Math.round(prev.h) };
      });
    }
  };

  async function generate() {
    if (pitchMode === "pitch" && !pitch.trim() && !premise.trim()) { setStatus("Pitch your ideas first — plots, characters, a storyline framework — or switch to letting the builder formulate one."); return; }
    if (pitchMode === "formulate" && premise.trim() && pitch.trim()) { setStatus("Formulate mode ignores the pitch — clear it or switch back to building from your pitch."); return; }
    if (m.suspects.some(s => s.name.trim() || s.characterBrief.trim()) && !window.confirm("Replace the current case with a newly generated one? Your edits will be lost.")) return;
    setBusy(true); setStatus("Drafting your case…");
    try {
      const res = await fetch("/api/city-crime-scene/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ premise, pitch: pitchMode === "pitch" ? pitch : "", notes, suspectCount: genSuspects, detectiveCount: genDetectives }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      // New draft: the pipeline restarts at the read-and-approve gate. Map and
      // media work stays locked until the host reads and saves the storyline.
      save(readCityCrimeSceneConfig({ mystery: data.config }), { storylineApproved: false, locationApprovals: {} });
      setWalkIdx(0);
      const v = (data.validation || []).length + (data.standards || []).length;
      setStatus(v ? `Case drafted with ${v} issue(s) to review below. Read the storyline and characters in full, edit anything, then approve to unlock the map.` : "Case drafted. Read the storyline and characters in full, edit anything, then approve to unlock the map.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Generation failed."); }
    finally { setBusy(false); }
  }

  const approveStoryline = () => {
    save(m, { ...pipeline, storylineApproved: true });
    setStatus("Storyline and characters approved and saved. The map stage is open — walk each location below.");
  };

  const listOf = <T,>(items: T[], set: (v: T[]) => void, render: (item: T, i: number, setItem: (v: T) => void, remove: () => void) => React.ReactNode, add: () => T, addLabel: string, legend: (item: T, i: number) => React.ReactNode) => (
    <div>{items.map((item, i) => {
      const setItem = (v: T) => set(items.map((x, j) => (j === i ? v : x)));
      const remove = () => set(items.filter((_, j) => j !== i));
      return <fieldset key={i} style={{ margin: "0.5rem 0", padding: "0.5rem", border: "1px solid #444" }}><legend>{legend(item, i)}</legend>{render(item, i, setItem, remove)}<button type="button" className="outline-btn" onClick={remove}>Remove</button></fieldset>;
    })}<button type="button" className="outline-btn" onClick={() => set([...items, add()])}>{addLabel}</button></div>
  );

  const newSuspect = (): CityCrimeSceneSuspect => ({ id: `sus-${uid()}`, name: "", occupation: "", age: "", knownFor: "", personality: "", quote: "", gender: "", ethnicity: "", characterBrief: "", potentialMotive: "", alibi: "", demeanor: "", tells: "", extraInfo: "", questions: ["", "", ""], guideVideoPrompt: "", isGuilty: false });
  const newWitness = (): CityCrimeSceneWitness => ({ id: `wit-${uid()}`, name: "", role: "", statement: "" });
  const newClue = (): CityCrimeSceneClue => ({ id: `clue-${uid()}`, title: "", description: "", summary: "", locationId: m.locations[0]?.id || "", cutScenePrompt: "", cutSceneVideoKey: "", hotspot: "", relatedSuspectIds: [] });
  const newFlashback = (): CityCrimeSceneFlashback => ({ id: `fb-${uid()}`, title: "", description: "", videoPrompt: "", videoKey: "", relatedSuspectIds: [] });
  const newLocation = (): CityCrimeSceneLocation => ({ id: `loc-${uid()}`, name: "", description: "", imagePrompt: "", items: [] });
  const newHelper = (): CityCrimeSceneHelperWitness => ({ id: `wit-${uid()}`, name: "", role: "", description: "", info: "", giftToUnlock: "", howItHelps: "", mediaMode: "generate", portraitPrompt: "", videoPrompt: "", voice: "" });
  const newTimeline = (): CityCrimeSceneTimelineEvent => ({ id: `t-${uid()}`, time: "", event: "" });
  const newTwist = (): CityCrimeSceneTwist => ({ id: `tw-${uid()}`, title: "", description: "", triggerMoment: "" });

  // ---- Cast roles are fixed by the case file: a character is a suspect, a
  // required witness, or an optional helper, and stays that way — live
  // performers improvise the role the case assigns them.
  const roleBadge = (role: string) => <span style={{ display: "inline-block", background: "#1c2b1c", border: "1px solid #7dff9a", borderRadius: 4, padding: "0 0.4rem", fontSize: "0.75rem", marginLeft: "0.5rem" }}>{role}</span>;

  const gateNotice = (what: string) => <div style={{ ...lockNote, margin: "0.5rem 0" }}>
    🔒 <strong>{what} waits at the gate.</strong> Read the storyline and every character file in full above, edit anything you intend to change, then approve — the map and media are built only from the approved storyline, so nothing is generated from text you are about to rewrite.
    <div style={{ marginTop: "0.5rem" }}><button type="button" className="build-btn" onClick={approveStoryline}>I&apos;ve read the storyline &amp; characters — approve and unlock</button></div>
  </div>;

  const stageState = (done: boolean, active: boolean) => done ? "✅" : active ? "▶" : "·";

  return <section className="card-editor card-host" aria-label="City Crime Scene setup" style={{ maxWidth: 860 }}>
    <h4>City Crime Scene</h4>
    <p>An improv whodunnit in the spirit of Law &amp; Order. AI drafts the case — <strong>you have full creative liberty: rewrite anything.</strong> Sections marked 🔒 never appear on the audience overlay.</p>

    <div style={{ border: "1px solid #555", borderRadius: 8, padding: "0.5rem 0.75rem", margin: "0.5rem 0" }} aria-label="Build pipeline">
      <strong>Build pipeline</strong>
      <ol style={{ margin: "0.25rem 0", paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
        <li>{stageState(pipeline.storylineApproved, true)} <strong>Pitch &amp; story</strong> — your ideas first; the builder formulates only if you ask it to.</li>
        <li>{stageState(pipeline.storylineApproved, pipeline.storylineApproved)} <strong>Read &amp; approve</strong> — read the storyline and character files entirely, edit, save. The map and media do not begin until you approve.</li>
        <li>{stageState(allLocationsApproved, pipeline.storylineApproved && !allLocationsApproved)} <strong>Guided map walk</strong> — location by location: layout, evidence choices, binding, media, approval. Only the next location&apos;s media is made as you go.</li>
        <li>{stageState(false, allLocationsApproved)} <strong>Open map</strong> — once every location is approved, revisit any location freely and add media tie-ins.</li>
        <li>{stageState(false, allLocationsApproved)} <strong>Clue helpers</strong> — describe each gift-triggered helper; the builder creates what they can reveal.</li>
      </ol>
    </div>

    <details open><summary><strong>✦ Step 0 — your pitch, then generate</strong></summary><div style={{ padding: "0.5rem 0" }}>
      <p style={{ opacity: 0.75, fontSize: "0.85rem" }}>The builder never throws out a random crime first. Pitch anything you have — ideas, plots, characters, a storyline framework — and the case is built from it. Have nothing? Let the builder formulate one instead.</p>
      <Field label="How should this case start?"><select value={pitchMode} onChange={e => setPitchMode(e.target.value as "pitch" | "formulate")}>
        <option value="pitch">Build from my pitch — my ideas come first</option>
        <option value="formulate">Let the builder formulate a storyline</option>
      </select></Field>
      {pitchMode === "pitch" && <Field label="Your pitch — ideas, plots, characters, storyline framework" hint="The deciding factor. The builder works from this, not around it."><TA value={pitch} onChange={e => setPitch(e.target.value)} placeholder="e.g. 1920s Harlem jazz club. The owner is found dead after the last set. I want a singer, a bartender, a bookkeeper, and the rival owner across town — and the money angle matters more than the romance angle…" style={{ minHeight: 90 }} /></Field>}
      <Field label="Premise (short logline)"><TA value={premise} onChange={e => setPremise(e.target.value)} placeholder="e.g. A jazz club owner is found dead in his locked office after closing…" /></Field>
      <Field label="Notes for the AI (optional)" hint="Your word is final — the AI must honor these."><TA value={notes} onChange={e => setNotes(e.target.value)} placeholder="Names to use, setting details, things to avoid…" /></Field>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Field label="Suspects to generate"><select value={genSuspects} onChange={e => setGenSuspects(Number(e.target.value))}>{[4, 5, 6, 7].map(n => <option key={n} value={n}>{n} suspects</option>)}</select></Field>
        <Field label="Detectives"><select value={genDetectives} onChange={e => setGenDetectives(Number(e.target.value) as 1 | 2)}><option value={1}>1 detective</option><option value={2}>2 detectives</option></select></Field>
      </div>
      <button type="button" className="build-btn" disabled={busy} onClick={() => void generate()}>{busy ? "Drafting…" : "Generate case with AI"}</button>
      {status && <p role="status">{status}</p>}
    </div></details>

    {problems.length > 0 && <div role="alert" style={{ ...lockNote, background: "#3a1414", borderColor: "#d66" }}><strong>Case issues to fix:</strong><ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
    {standards.length > 0 && <div role="alert" style={{ ...lockNote, background: "#2b2410", borderColor: "#d6aa58" }}><strong>Case standards not yet met ({standards.length}):</strong><ul>{standards.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
    {standards.length === 0 && <p style={{ background: "#1c2b1c", border: "1px solid #7dff9a", borderRadius: 8, padding: "0.5rem 0.75rem" }}>✅ This case meets every City Crime Scene design standard.</p>}

    <details open><summary><strong>The case</strong> — read it entirely, edit anything, then approve</summary>
      <Field label="Case title"><IN value={m.title} onChange={e => patch({ title: e.target.value })} /></Field>
      <Field label="Premise"><TA value={m.premise} onChange={e => patch({ premise: e.target.value })} /></Field>
      <Field label="📋 Audience case brief document — the typed document on screen during the opening" hint="The official-document version: a typed SUMMARY of the pertinent info in your host script below (victim, scene, found how/where/when, discovered by, the discoverer's statement in summary, the one noted discrepancy). This is what the audience screen shows — filed away with the character cards, and referenceable all game. Your full read-aloud script is the host-only field further down."><TA value={m.briefDocument} onChange={e => patch({ briefDocument: e.target.value })} style={{ minHeight: 110 }} /></Field>
      <Field label="The crime (shown in the briefing)"><TA value={m.crime} onChange={e => patch({ crime: e.target.value })} /></Field>
      <Field label="The victim"><TA value={m.victim} onChange={e => patch({ victim: e.target.value })} /></Field>
      <Field label="Backstory"><TA value={m.backstory} onChange={e => patch({ backstory: e.target.value })} /></Field>
      <Field label="Plot"><TA value={m.plot} onChange={e => patch({ plot: e.target.value })} /></Field>
      <div style={{ ...lockNote, margin: "0.5rem 0" }}>🔒 <strong>HOST ONLY — never shown on the overlay.</strong></div>
      <Field label="📜 Host's brief script 🔒 — the FULL narrative you read aloud to open the game" hint="Your dashboard script, host-side only — it is stripped before publish; the audience sees only the typed brief document above. Beats: the victim and who they were; the place; how the body/situation was found and where; who discovered it and when; the discoverer's statement; then ONE initial observed discrepancy — the first analytical thread you hand the detective, drawn only from what was observed, never from the master truth."><TA value={m.briefNarration} onChange={e => patch({ briefNarration: e.target.value })} style={{ minHeight: 130 }} /></Field>
      <Field label="Actual crime details (the truth — host only)"><TA value={m.actualCrimeDetails} onChange={e => patch({ actualCrimeDetails: e.target.value })} style={{ minHeight: 100 }} /></Field>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Field label="Suspects"><select value={m.suspectCount} onChange={e => patch({ suspectCount: Number(e.target.value) })}>{[4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
        <Field label="Detectives" hint="Your choice — a detective has no character description; they're simply the player solving the mystery."><select value={m.detectiveCount} onChange={e => patch({ detectiveCount: Number(e.target.value) as 1 | 2 })}><option value={1}>1 detective</option><option value={2}>2 detectives</option></select></Field>
        <Field label="Interrogation timer (sec)" hint="Questioning runs on a 5-minute timer per suspect — 300 is the standard."><IN type="number" min={15} max={3600} value={m.interrogationSeconds} onChange={e => patch({ interrogationSeconds: Math.max(15, +e.target.value || 300) })} /></Field>
        <Field label="Courtroom timer (sec)"><IN type="number" min={15} max={3600} value={m.courtroomSeconds} onChange={e => patch({ courtroomSeconds: Math.max(15, +e.target.value || 180) })} /></Field>
      </div>
      {!pipeline.storylineApproved
        ? <div style={{ ...lockNote, margin: "0.5rem 0" }}>📖 <strong>Stage 2 gate:</strong> when you have read the storyline and every character file and saved the edits you intend to make, approve here — only then do the map and media stages open.
          <div style={{ marginTop: "0.5rem" }}><button type="button" className="build-btn" onClick={approveStoryline}>Approve storyline &amp; characters — unlock the map</button></div></div>
        : <p style={{ background: "#1c2b1c", border: "1px solid #7dff9a", borderRadius: 8, padding: "0.5rem 0.75rem" }}>✅ Storyline &amp; characters approved — the map and media stages are built from this version. <button type="button" className="outline-btn" onClick={() => save(m, { ...pipeline, storylineApproved: false })}>Re-open the gate (re-review storyline)</button></p>}
    </details>

    <details open={pipeline.storylineApproved}><summary><strong>Locations</strong> ({m.locations.length}){!pipeline.storylineApproved ? " — locked at the storyline gate" : ""}</summary>
      {!pipeline.storylineApproved ? gateNotice("The map") : listOf(m.locations, v => patch({ locations: v }), (l, _i, setL) => <>
        <Field label="Name"><IN value={l.name} onChange={e => setL({ ...l, name: e.target.value })} /></Field>
        <label style={{ display: "block", margin: "0.5rem 0" }}><input type="checkbox" checked={!!l.isCrimeScene} onChange={e => patch({ locations: m.locations.map(x => ({ ...x, isCrimeScene: x.id === l.id ? e.target.checked : e.target.checked ? undefined : x.isCrimeScene })) })} /> <strong>🚨 This location is the crime scene itself</strong> (exactly one per case)</label>
        <Field label="Description"><TA value={l.description} onChange={e => setL({ ...l, description: e.target.value })} /></Field>
        <Field label="Image prompt (for the site's image generator)" hint="Describe the noir establishing shot for this location, as the approved story establishes the place. When the location has scene items (laid out in the guided walk), their names are appended to this prompt at generation time so the picture actually contains them."><TA value={l.imagePrompt || ""} onChange={e => setL({ ...l, imagePrompt: e.target.value })} /></Field>
        <Field label="Scene image asset key (optional)" hint="Generate it right here with the button below, or paste a key from this project's media — it becomes the scene the detective searches."><IN value={l.imageKey || ""} onChange={e => setL({ ...l, imageKey: e.target.value })} placeholder="e.g. reed-office-scene.jpg" /></Field>
        {genBtn(`loc-img-${l.id}`, "✦ Generate this scene image", l.imagePrompt?.trim() ? () => void runMedia(`loc-img-${l.id}`, "image", `${l.imagePrompt || ""}${(l.items || []).length ? ` The scene visibly contains: ${(l.items || []).map(it => it.name).join(", ")}.` : ""}`, `CCS location — ${l.name || l.id}`, key => patchLatest({ locations: mRef.current.locations.map(x => x.id === l.id ? { ...x, imageKey: key } : x) })) : null, "Write the image prompt first — the scene image is generated from it.")}
      </>, newLocation, "Add location", (l, i) => `Location ${i + 1}${l.name ? `: ${l.name}` : ""}${l.isCrimeScene ? " 🚨 CRIME SCENE" : ""}`)}
    </details>

    {pipeline.storylineApproved && <details open><summary><strong>🧭 Guided map walk</strong> — location by location ({m.locations.filter(l => pipeline.locationApprovals[l.id]).length}/{m.locations.length} approved)</summary>
      <p style={{ opacity: 0.85, fontSize: "0.9rem" }}>Work the map the way the detective will — one location at a time. For each: lay out the place&apos;s visible items on its picture, choose the evidence from the list that fits <em>this story and this place</em> — the list is grouped by those items — bind each piece to its item, finish its media, then approve. Only the next location&apos;s media is made as you go — nothing is rendered ahead of approval. After every location is approved, the whole map opens for extra tie-ins.</p>
      {m.locations.length > 0 && (() => {
        const loc = m.locations[Math.min(walkIdx, m.locations.length - 1)];
        const locClues = m.clues.filter(c => c.locationId === loc.id);
        const suggestions = suggestEvidenceForLocation(m, loc.id);
        const setClue = (c: CityCrimeSceneClue) => patch({ clues: m.clues.map(x => (x.id === c.id ? c : x)) });
        return <fieldset style={{ margin: "0.5rem 0", padding: "0.75rem", border: "1px solid #d6aa58" }}>
          <legend><strong>{loc.name || loc.id}</strong>{loc.isCrimeScene ? " 🚨 CRIME SCENE" : ""} — location {Math.min(walkIdx, m.locations.length - 1) + 1} of {m.locations.length} {pipeline.locationApprovals[loc.id] ? "✅ approved" : ""}</legend>
          <p style={{ fontStyle: "italic", opacity: 0.85 }}>{loc.description}</p>
          <Field label="Scene items — the visible things in this place" hint="A location is a place, not necessarily a room — a back alley, a dock, a parked car. Its items are whatever would really be there, as the approved story establishes it: name each visible thing and mark ITS area in the picture. In play, the spyglass highlights exactly these areas — and only for the items that carry evidence you chose. Everything else stays scenery.">
            <div
              onPointerDown={e => onFrameDown(e, loc)}
              onPointerMove={onFrameMove}
              onPointerUp={() => onFrameUp(loc)}
              style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", border: "1px solid #666", borderRadius: 8, overflow: "hidden", touchAction: "none", cursor: "crosshair", background: sceneImg.locId === loc.id && sceneImg.url ? `center / cover no-repeat url("${sceneImg.url}")` : "linear-gradient(135deg,#20222e,#3a2c14)" }}>
              {!(sceneImg.locId === loc.id && sceneImg.url) && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.75, padding: "1rem", textAlign: "center", pointerEvents: "none" }}>No scene image yet — generate it in the Locations section above, or lay the items out on this frame and match them to the picture once it exists.</span>}
              {(loc.items || []).map(it => {
                const dragging = itemDrag?.locId === loc.id && itemDrag?.itemId === it.id;
                const boundCount = locClues.filter(c => c.itemId === it.id).length;
                return <div key={it.id}
                  onPointerDown={e => onItemDown(e, loc, it)}
                  style={{ position: "absolute", left: `${it.x + (dragging ? itemDrag.dx : 0)}%`, top: `${it.y + (dragging ? itemDrag.dy : 0)}%`, width: `${it.w}%`, height: `${it.h}%`, border: `2px solid ${boundCount ? "#ffd76a" : "#9db2ce"}`, background: boundCount ? "rgba(255,215,106,0.10)" : "rgba(157,178,206,0.08)", borderRadius: 6, cursor: "move" }}>
                  <span style={{ position: "absolute", left: 2, bottom: 2, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: "0.7rem", padding: "0 0.3rem", borderRadius: 3, pointerEvents: "none" }}>{it.name}{boundCount ? ` · ${boundCount} evidence` : ""}</span>
                </div>;
              })}
              {markRect && markRect.locId === loc.id && <div style={{ position: "absolute", left: `${markRect.x}%`, top: `${markRect.y}%`, width: `${markRect.w}%`, height: `${markRect.h}%`, border: "2px dashed #7dff9a", background: "rgba(125,255,154,0.10)", borderRadius: 6, pointerEvents: "none" }} />}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.4rem" }}>
              <IN style={{ flex: "1 1 12rem", width: "auto" }} value={markRect?.locId === loc.id ? markName : ""} onChange={e => setMarkName(e.target.value)} placeholder="Name the thing you marked — e.g. the drawer, the employees-only staircase, the dumpster" disabled={!(markRect && markRect.locId === loc.id)} />
              <button type="button" className="build-btn" disabled={!(markRect && markRect.locId === loc.id && markName.trim())} onClick={() => {
                if (!markRect || markRect.locId !== loc.id || !markName.trim()) return;
                commitItems(loc.id, [...(loc.items || []), { id: `item-${uid()}`, name: markName.trim(), x: markRect.x, y: markRect.y, w: markRect.w, h: markRect.h }]);
                setMarkRect(null); setMarkName("");
              }}>Add scene item</button>
              <small style={{ opacity: 0.8 }}>Drag a rectangle over the thing itself (or click to place an area, then drag it into place). Drag an item to move it.</small>
            </div>
            {(loc.items || []).map(it => {
              const boundCount = locClues.filter(c => c.itemId === it.id).length;
              return <div key={it.id} style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", margin: "0.3rem 0" }}>
                <IN style={{ flex: "1 1 10rem", width: "auto" }} value={it.name} onChange={e => commitItems(loc.id, (loc.items || []).map(x => (x.id === it.id ? { ...x, name: e.target.value } : x)), clues => clues.map(c => (c.locationId === loc.id && c.itemId === it.id ? { ...c, hotspot: e.target.value } : c)))} />
                {(["x", "y", "w", "h"] as const).map(k => <label key={k} style={{ fontSize: "0.8rem" }}>{k.toUpperCase()} <IN type="number" min={0} max={100} style={{ width: "4rem" }} value={Math.round(it[k])} onChange={e => commitItems(loc.id, (loc.items || []).map(x => (x.id === it.id ? { ...x, [k]: Math.max(0, Math.min(100, +e.target.value || 0)) } : x)))} /></label>)}
                <small>{boundCount ? `${boundCount} evidence bound — highlights in play` : "scenery — no evidence bound"}</small>
                <button type="button" className="outline-btn" onClick={() => commitItems(loc.id, (loc.items || []).filter(x => x.id !== it.id), clues => clues.map(c => (c.itemId === it.id ? { ...c, itemId: undefined } : c)))}>Remove item</button>
              </div>;
            })}
            {!(loc.items || []).length && <small style={{ display: "block", marginTop: "0.3rem" }}>No items laid out yet. A place with no items is not a dead end — its clues still work with the older spot positions — but laying out the visible things is what lets the spyglass highlight the objects themselves.</small>}
          </Field>
          <Field label="Character revealed in this location (their unlock discovery)" hint="Discovering this location's unlock evidence opens the detective's ability to question that suspect. Detective decides when to use it.">
            <select value={locClues.find(c => c.unlocksSuspectId)?.unlocksSuspectId || ""} onChange={e => {
              const sid = e.target.value;
              // Clear any unlock assigned within THIS location, then assign the
              // chosen suspect's unlock to the location clue that already
              // implicates them (or the first clue here), tying them in.
              const cleared = m.clues.map(c => (c.locationId === loc.id && c.unlocksSuspectId ? { ...c, unlocksSuspectId: undefined } : c));
              if (!sid) { patch({ clues: cleared }); return; }
              const target = cleared.find(c => c.locationId === loc.id && (c.relatedSuspectIds || []).includes(sid)) || cleared.find(c => c.locationId === loc.id);
              if (!target) { patch({ clues: cleared }); return; }
              patch({ clues: cleared.map(c => (c.id === target.id ? { ...c, unlocksSuspectId: sid, relatedSuspectIds: [...new Set([...(c.relatedSuspectIds || []), sid])] } : c)) });
            }}>
              <option value="">— no suspect unlocked here —</option>
              {m.suspects.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
            </select></Field>
          <p><strong>Evidence in this location ({locClues.length})</strong> — bind each piece to its clickable item; finish its cut-scene and audio prompts here.</p>
          {locClues.map(c => <div key={c.id} style={{ border: "1px solid #444", borderRadius: 8, padding: "0.5rem", margin: "0.5rem 0" }}>
            <strong>{c.title || c.id}</strong>{c.unlocksSuspectId ? ` — 🔓 unlocks ${m.suspects.find(s => s.id === c.unlocksSuspectId)?.name || c.unlocksSuspectId}` : ""}{c.turningPoint ? " — 🔀 turning point" : ""}
            <Field label="Found on — the scene item this evidence pertains to" hint="In play, the spyglass highlights that item's whole area in the picture, and clicking it reveals this evidence.">
              <select value={c.itemId || ""} onChange={e => {
                const itemId = e.target.value || undefined;
                const item = (loc.items || []).find(it => it.id === itemId);
                setClue({ ...c, itemId, hotspot: item ? item.name : c.hotspot });
              }}>
                <option value="">— no scene item (legacy spot position below) —</option>
                {(loc.items || []).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select></Field>
            {c.itemId
              ? <p style={{ fontSize: "0.85rem", opacity: 0.9, margin: "0.25rem 0" }}>🎯 Bound to <strong>{(loc.items || []).find(it => it.id === c.itemId)?.name || "a scene item"}</strong> — its highlight area is the item&apos;s area as laid out above; no separate spot position applies.</p>
              : <>
                <Field label="Bound-item text (the spot's label)"><IN value={c.hotspot} onChange={e => setClue({ ...c, hotspot: e.target.value })} placeholder="e.g. The decanter on the desk" /></Field>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Field label="Spot position X % (on the scene visual)"><IN type="number" min={0} max={100} value={c.hotspotX ?? ""} onChange={e => setClue({ ...c, hotspotX: e.target.value === "" ? undefined : Math.max(0, Math.min(100, +e.target.value)) })} /></Field>
                  <Field label="Spot position Y %"><IN type="number" min={0} max={100} value={c.hotspotY ?? ""} onChange={e => setClue({ ...c, hotspotY: e.target.value === "" ? undefined : Math.max(0, Math.min(100, +e.target.value)) })} /></Field>
                </div>
              </>}
            <Field label="Story significance 🔒 — the approved story (host only)" hint="This evidence's importance and relevance — to the characters and to the crime. Part of the master truth; never shown to the audience."><TA value={c.storySignificance || ""} onChange={e => setClue({ ...c, storySignificance: e.target.value })} /></Field>
            <label style={{ display: "block", margin: "0.5rem 0" }}><input type="checkbox" checked={!!c.initiallyPresent} onChange={e => setClue({ ...c, initiallyPresent: e.target.checked || undefined })} /> <strong>📋 In the detective&apos;s opening brief</strong> — initially present when the game opens. Everything not flagged is discovered through play only.</label>
            <Field label="Cut-scene prompt (cinematic reveal video)"><TA value={c.cutScenePrompt} onChange={e => setClue({ ...c, cutScenePrompt: e.target.value })} /></Field>
            <Field label="Audio evidence prompt (optional clip)"><TA value={c.audioPrompt || ""} onChange={e => setClue({ ...c, audioPrompt: e.target.value })} placeholder="e.g. A muffled argument through the office door, a glass set down hard…" /></Field>
            <p style={{ fontSize: "0.85rem", opacity: 0.9, margin: "0.25rem 0" }}>{c.cutSceneVideoKey ? `🎬 Cut scene saved: ${c.cutSceneVideoKey}` : "🎬 No cut scene yet."} · {c.audioKey ? `🔊 Audio saved: ${c.audioKey}` : "🔊 No audio clip yet."}</p>
            {genBtn(`walk-cut-${c.id}`, "✦ Generate cut scene", c.cutScenePrompt.trim() ? () => void runMedia(`walk-cut-${c.id}`, "video", c.cutScenePrompt, `CCS clue — ${c.title || c.id} (cut scene)`, key => patchLatest({ clues: mRef.current.clues.map(x => x.id === c.id ? { ...x, cutSceneVideoKey: key } : x) })) : null, "Write the cut-scene prompt first.")}
            {genBtn(`walk-aud-${c.id}`, "✦ Generate audio clip", c.audioPrompt?.trim() ? () => void runMedia(`walk-aud-${c.id}`, "sfx", c.audioPrompt || "", `CCS clue — ${c.title || c.id} (audio)`, key => patchLatest({ clues: mRef.current.clues.map(x => x.id === c.id ? { ...x, audioKey: key } : x) })) : null, "Write the audio prompt first.")}
          </div>)}
          {!locClues.length && <p role="alert" style={lockNote}>This location has no evidence yet — choose from the list below or add a custom clue.</p>}
          <Field label={`Evidence that fits this story and this location (${suggestions.length})`} hint="The list is filtered twice: only evidence that works for the overall storyline AND belongs in this place appears — and every possibility pertains to a visible thing in the picture, grouped by that thing. Tire tracks will never be offered for an upstairs bedroom.">
            {(() => {
              const choose = (s: (typeof suggestions)[number], item?: CityCrimeSceneSceneItem) => {
                let items = loc.items || [];
                let bound = item || items.find(it => ccssItemNamesMatch(it.name, s.itemName));
                if (!bound) {
                  // Choosing evidence on a thing that is not laid out yet adds
                  // the item to the scene; the host then drags its area onto
                  // the thing itself in the layout above.
                  bound = { id: `item-${uid()}`, name: s.itemName, x: 38, y: 34, w: 24, h: 24 };
                  items = [...items, bound];
                }
                patch({
                  locations: m.locations.map(l => (l.id === loc.id ? { ...l, items } : l)),
                  clues: [...m.clues, { id: `clue-${uid()}`, title: s.label, description: s.detail, summary: s.summary, locationId: loc.id, cutScenePrompt: "", hotspot: bound.name, itemId: bound.id, relatedSuspectIds: [] }],
                });
              };
              const grouped = (loc.items || []).map(it => ({ item: it, list: suggestEvidenceForItem(m, loc.id, it.id) }));
              const groupedIds = new Set(grouped.flatMap(g => g.list.map(s => s.archetypeId)));
              const ungrouped = suggestions.filter(s => !groupedIds.has(s.archetypeId));
              return <div>
                {grouped.map(({ item, list }) => list.length > 0 && <div key={item.id} style={{ margin: "0.4rem 0" }}>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>On <strong>{item.name}</strong>:</div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{list.map(s => <button key={s.archetypeId} type="button" className="outline-btn" title={s.detail} onClick={() => choose(s, item)}>＋ {s.label}</button>)}</div>
                </div>)}
                {ungrouped.length > 0 && <div style={{ margin: "0.4rem 0" }}>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>On a visible thing not laid out yet — choosing one adds that item to the scene (drag its area onto the thing itself above):</div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{ungrouped.map(s => <button key={s.archetypeId} type="button" className="outline-btn" title={s.detail} onClick={() => choose(s)}>＋ {s.label} <small>({s.itemName})</small></button>)}</div>
                </div>}
                {!suggestions.length && <span>No catalog evidence fits this location and story — add a custom clue below or in the Clues section.</span>}
              </div>;
            })()}
          </Field>
          <button type="button" className="outline-btn" onClick={() => patch({ clues: [...m.clues, newClue()] })}>Add a blank clue (placed in the first location — move it in the Clues section)</button>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.75rem" }}>
            <button type="button" className="outline-btn" disabled={walkIdx <= 0} onClick={() => setWalkIdx(i => Math.max(0, i - 1))}>← Previous location</button>
            <label><input type="checkbox" checked={!!pipeline.locationApprovals[loc.id]} onChange={e => save(m, { ...pipeline, locationApprovals: { ...pipeline.locationApprovals, [loc.id]: e.target.checked } })} /> <strong>Media for this location edited &amp; approved</strong></label>
            <button type="button" className="outline-btn" disabled={walkIdx >= m.locations.length - 1} onClick={() => setWalkIdx(i => Math.min(m.locations.length - 1, i + 1))}>Next location →</button>
          </div>
        </fieldset>;
      })()}
      {allLocationsApproved && <p style={{ background: "#1c2b1c", border: "1px solid #7dff9a", borderRadius: 8, padding: "0.5rem 0.75rem" }}>✅ <strong>Every location is approved — the open map is yours.</strong> Revisit any location above and add media tie-ins beyond the initial generation, then finish the clue helpers below.</p>}
    </details>}

    <details><summary><strong>Clues</strong> ({m.clues.length}){!pipeline.storylineApproved ? " — locked at the storyline gate" : ""}</summary>
      {!pipeline.storylineApproved ? gateNotice("Clues and their media") : listOf(m.clues, v => patch({ clues: v }), (c, _i, setC) => <>
        <Field label="Title"><IN value={c.title} onChange={e => setC({ ...c, title: e.target.value })} /></Field>
        <Field label="Description — the SPECIFIC detail (revealed only during play)"><TA value={c.description} onChange={e => setC({ ...c, description: e.target.value })} /></Field>
        <Field label="Generalized summary — the ONLY version suspects ever see" hint="Rundowns and clue cards generalize evidence so performers learn the specifics live, at the same moment the detective discovers them."><TA value={c.summary} onChange={e => setC({ ...c, summary: e.target.value })} /></Field>
        <Field label="Location"><select value={c.locationId} onChange={e => setC({ ...c, locationId: e.target.value, itemId: undefined })}>{m.locations.map(l => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}</select></Field>
        <Field label="Bound to clickable item / area in that place"><IN value={c.hotspot} onChange={e => setC({ ...c, hotspot: e.target.value })} placeholder="e.g. The ledger books on the desk" /></Field>
        <Field label="Scene item of that location (its area is the highlight in play)"><select value={c.itemId || ""} onChange={e => { const item = (m.locations.find(l => l.id === c.locationId)?.items || []).find(it => it.id === e.target.value); setC({ ...c, itemId: e.target.value || undefined, hotspot: item ? item.name : c.hotspot }); }}><option value="">— no scene item (legacy spot) —</option>{(m.locations.find(l => l.id === c.locationId)?.items || []).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select></Field>
        <Field label="Story significance 🔒 — the approved story (host only)" hint="This evidence's importance and relevance — to the characters and to the crime. Never shown to the audience."><TA value={c.storySignificance || ""} onChange={e => setC({ ...c, storySignificance: e.target.value })} /></Field>
        <label style={{ display: "block", margin: "0.5rem 0" }}><input type="checkbox" checked={!!c.initiallyPresent} onChange={e => setC({ ...c, initiallyPresent: e.target.checked || undefined })} /> <strong>📋 In the detective&apos;s opening brief</strong> — initially present when the game opens; everything else is discovered through play only</label>
        <Field label="Cut-scene prompt (cinematic clue reveal)"><TA value={c.cutScenePrompt} onChange={e => setC({ ...c, cutScenePrompt: e.target.value })} /></Field>
        <Field label="Cut-scene video asset key (optional)" hint="Generate it right here with the button below, or paste a key from this project's media — it plays on the overlay when the clue is revealed."><IN value={c.cutSceneVideoKey || ""} onChange={e => setC({ ...c, cutSceneVideoKey: e.target.value })} placeholder="e.g. clue-decanter-reveal.mp4" /></Field>
        {genBtn(`clue-cut-${c.id}`, "✦ Generate cut scene", c.cutScenePrompt.trim() ? () => void runMedia(`clue-cut-${c.id}`, "video", c.cutScenePrompt, `CCS clue — ${c.title || c.id} (cut scene)`, key => patchLatest({ clues: mRef.current.clues.map(x => x.id === c.id ? { ...x, cutSceneVideoKey: key } : x) })) : null, "Write the cut-scene prompt first.")}
        <Field label="Audio evidence prompt (optional)"><TA value={c.audioPrompt || ""} onChange={e => setC({ ...c, audioPrompt: e.target.value })} /></Field>
        <Field label="Audio clip asset key (optional)"><IN value={c.audioKey || ""} onChange={e => setC({ ...c, audioKey: e.target.value })} placeholder="e.g. clue-door-argument.mp3" /></Field>
        {genBtn(`clue-aud-${c.id}`, "✦ Generate audio clip", c.audioPrompt?.trim() ? () => void runMedia(`clue-aud-${c.id}`, "sfx", c.audioPrompt || "", `CCS clue — ${c.title || c.id} (audio)`, key => patchLatest({ clues: mRef.current.clues.map(x => x.id === c.id ? { ...x, audioKey: key } : x) })) : null, "Write the audio prompt first.")}
        <Field label="Unlocks questioning of (map discovery → initial ability)"><select value={c.unlocksSuspectId || ""} onChange={e => setC({ ...c, unlocksSuspectId: e.target.value || undefined })}><option value="">— unlocks nobody —</option>{m.suspects.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}</select></Field>
        <Field label="Makes clue helper available"><select value={c.unlocksHelperId || ""} onChange={e => setC({ ...c, unlocksHelperId: e.target.value || undefined })}><option value="">— no helper —</option>{m.helperWitnesses.map(h => <option key={h.id} value={h.id}>{h.name || h.id}</option>)}</select></Field>
        <label style={{ display: "block", margin: "0.5rem 0" }}><input type="checkbox" checked={!!c.turningPoint} onChange={e => setC({ ...c, turningPoint: e.target.checked || undefined })} /> <strong>🔀 Turning point</strong> — new, previously-unknown information that can change the investigation&apos;s trajectory</label>
        <Field label="Implicates which suspects?">{m.suspects.map(s => <label key={s.id} style={{ display: "inline-block", marginRight: "0.75rem", fontWeight: 400 }}><input type="checkbox" checked={c.relatedSuspectIds.includes(s.id)} onChange={e => setC({ ...c, relatedSuspectIds: e.target.checked ? [...c.relatedSuspectIds, s.id] : c.relatedSuspectIds.filter(x => x !== s.id) })} /> {s.name || s.id}</label>)}</Field>
      </>, newClue, "Add clue", (c, i) => `Clue ${i + 1}${c.title ? `: ${c.title}` : ""}`)}
    </details>

    <details><summary><strong>Crime flashbacks</strong> ({m.flashbacks.length}){!pipeline.storylineApproved ? " — locked at the storyline gate" : ""}</summary>
      {!pipeline.storylineApproved ? gateNotice("Flashback media") : <>
      <p>Short cinematic snippets uncovering fragments of the crime — played by the host at dramatic moments. <strong>Fairness rule:</strong> every suspect must be implicated by at least one clue or flashback, and no single suspect may dominate — the snippets must never telegraph the culprit.</p>
      {listOf(m.flashbacks, v => patch({ flashbacks: v }), (f, _i, setF) => <>
        <Field label="Title"><IN value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. 11:02 PM — The Side Door" /></Field>
        <Field label="What the audience sees"><TA value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Video prompt (for the site's video generator)"><TA value={f.videoPrompt} onChange={e => setF({ ...f, videoPrompt: e.target.value })} /></Field>
        <Field label="Video asset key (optional)" hint="Generate it right here with the button below, or paste a key from this project's media."><IN value={f.videoKey || ""} onChange={e => setF({ ...f, videoKey: e.target.value })} placeholder="e.g. flashback-sidedoor.mp4" /></Field>
        {genBtn(`fb-vid-${f.id}`, "✦ Generate this flashback video", f.videoPrompt?.trim() ? () => void runMedia(`fb-vid-${f.id}`, "video", f.videoPrompt || "", `CCS flashback — ${f.title || f.id}`, key => patchLatest({ flashbacks: mRef.current.flashbacks.map(x => x.id === f.id ? { ...x, videoKey: key } : x) })) : null, "Write the video prompt first.")}
        <Field label="Implicates which suspects?">{m.suspects.map(s => <label key={s.id} style={{ display: "inline-block", marginRight: "0.75rem", fontWeight: 400 }}><input type="checkbox" checked={f.relatedSuspectIds.includes(s.id)} onChange={e => setF({ ...f, relatedSuspectIds: e.target.checked ? [...f.relatedSuspectIds, s.id] : f.relatedSuspectIds.filter(x => x !== s.id) })} /> {s.name || s.id}</label>)}</Field>
      </>, newFlashback, "Add flashback", (f, i) => `Flashback ${i + 1}${f.title ? `: ${f.title}` : ""}`)}
      </>}
    </details>

    <details><summary><strong>Suspects</strong> ({m.suspects.length})</summary>
      <p style={lockNote}>🔒 Parts of each suspect card are <strong>HOST ONLY</strong> — the audience overlay never sees them.</p>
      <p style={{ opacity: 0.75, fontSize: "0.85rem" }}><strong>You decide the cast:</strong> who is a suspect, who is a required witness, who is an optional helper — the AI only drafts. Roles are set here in the case file and stay fixed for the show; the live performers improvise the character they're given.</p>
      {listOf(m.suspects, v => patch({ suspects: v }), (s, _i, setS) => <>
        <Field label="Name"><IN value={s.name} onChange={e => setS({ ...s, name: e.target.value })} /></Field>
        <Field label="Occupation — what they do (shown on the opening character card)"><IN value={s.occupation} onChange={e => setS({ ...s, occupation: e.target.value })} placeholder="e.g. Bartender at The Velvet Note" /></Field>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Field label="Age (clue card)"><IN value={s.age} onChange={e => setS({ ...s, age: e.target.value })} placeholder="e.g. Late 20s" /></Field>
          <Field label="Gender" hint="Adjusted only to fit the live performer."><IN value={s.gender} onChange={e => setS({ ...s, gender: e.target.value })} /></Field>
          <Field label="Ethnicity" hint="Adjusted only to fit the live performer."><IN value={s.ethnicity} onChange={e => setS({ ...s, ethnicity: e.target.value })} /></Field>
        </div>
        <Field label="Known for (clue card)"><TA value={s.knownFor} onChange={e => setS({ ...s, knownFor: e.target.value })} placeholder="e.g. Always on the floor — sees and hears everything." /></Field>
        <Field label="Personality (clue card — public wording, not the host-only demeanor)"><TA value={s.personality} onChange={e => setS({ ...s, personality: e.target.value })} /></Field>
        <Field label="Signature quote (clue card — in their voice)"><IN value={s.quote} onChange={e => setS({ ...s, quote: e.target.value })} placeholder="e.g. “Men come to the club to be seen… I remember everything.”" /></Field>
        <label style={{ display: "block", margin: "0.5rem 0" }}><input type="checkbox" checked={s.isGuilty} onChange={e => { const next = m.suspects.map(x => ({ ...x, isGuilty: x.id === s.id ? e.target.checked : e.target.checked ? false : x.isGuilty })); save({ ...m, suspects: next }); }} /> <strong>🔒 This suspect is the guilty party</strong> (only one may be guilty)</label>
        <Field label="Character brief (given to the player pre-game)"><TA value={s.characterBrief} onChange={e => setS({ ...s, characterBrief: e.target.value })} /></Field>
        <Field label="Potential motive (they look guilty — guilt not confirmed to them)"><TA value={s.potentialMotive} onChange={e => setS({ ...s, potentialMotive: e.target.value })} /></Field>
        <Field label="Alibi — the claim in their basic character file"><TA value={s.alibi} onChange={e => setS({ ...s, alibi: e.target.value })} /></Field>
        <div style={{ ...lockNote, margin: "0.5rem 0" }}>🔒 Detective dossier — private. Never on the overlay.</div>
        <Field label="True role in the crime 🔒 — the approved story" hint="What this character ACTUALLY played in the crime — the master truth. Host only, never published."><TA value={s.trueRole || ""} onChange={e => setS({ ...s, trueRole: e.target.value })} /></Field>
        <Field label="Alibi reality 🔒 — the approved story" hint="Whether the alibi above holds, and how it actually took place. Host only, never published."><TA value={s.alibiReality || ""} onChange={e => setS({ ...s, alibiReality: e.target.value })} /></Field>
        <Field label="Demeanor 🔒"><TA value={s.demeanor} onChange={e => setS({ ...s, demeanor: e.target.value })} /></Field>
        <Field label="Tells 🔒"><TA value={s.tells} onChange={e => setS({ ...s, tells: e.target.value })} /></Field>
        <Field label="Extra info (not in the player's brief) 🔒"><TA value={s.extraInfo} onChange={e => setS({ ...s, extraInfo: e.target.value })} /></Field>
        <Field label="Suggested interrogation questions (optional for the detective) 🔒">{s.questions.map((q, qi) => <IN key={qi} value={q} onChange={e => setS({ ...s, questions: s.questions.map((x, j) => (j === qi ? e.target.value : x)) })} placeholder={`Question ${qi + 1}`} />)}<button type="button" className="outline-btn" onClick={() => setS({ ...s, questions: [...s.questions, ""] })}>Add question</button></Field>
        <Field label="Character guide video prompt (for the site's video generator)" hint="Plays center-focused during gameplay when the investigation turns to this suspect."><TA value={s.guideVideoPrompt} onChange={e => setS({ ...s, guideVideoPrompt: e.target.value })} /></Field>
        <Field label="Character guide video asset key (optional)" hint="Generate it right here with the button below, or paste a key from this project's media — it plays full-screen when the suspect is introduced."><IN value={s.guideVideoKey || ""} onChange={e => setS({ ...s, guideVideoKey: e.target.value })} placeholder="e.g. elena-intro.mp4" /></Field>
        {media && (pipeline.storylineApproved
          ? genBtn(`sus-vid-${s.id}`, "✦ Generate guide video", s.guideVideoPrompt.trim() ? () => void runMedia(`sus-vid-${s.id}`, "video", s.guideVideoPrompt, `CCS suspect — ${s.name || s.id} (guide video)`, key => patchLatest({ suspects: mRef.current.suspects.map(x => x.id === s.id ? { ...x, guideVideoKey: key } : x) })) : null, "Write the guide video prompt first.")
          : <small style={{ display: "block", opacity: 0.75, margin: "0.25rem 0" }}>Guide-video generation opens once the storyline is approved above — nothing is rendered from unapproved text.</small>)}
      </>, newSuspect, "Add suspect", (s, i) => <>Suspect {i + 1}{s.name ? `: ${s.name}` : ""}{s.isGuilty ? " 🔒 GUILTY" : ""}{roleBadge("SUSPECT")}</>)}
    </details>

    <details><summary><strong>Witnesses</strong> ({m.witnesses.length}) — required</summary>
      <p>Real characters with statements the detective <strong>must hear before the arrest</strong> — the host plays each statement on the overlay during the investigation. Unlike helper witnesses below, these gate the accusation. A witness assigned to a location becomes that location&apos;s key evidence — their account is discovered there.</p>
      {listOf(m.witnesses, v => patch({ witnesses: v }), (w, _i, setW) => <>
        <Field label="Name"><IN value={w.name} onChange={e => setW({ ...w, name: e.target.value })} /></Field>
        <Field label="Role — who they are"><IN value={w.role} onChange={e => setW({ ...w, role: e.target.value })} placeholder="e.g. Doorman" /></Field>
        <Field label="Statement — what the detective hears"><TA value={w.statement} onChange={e => setW({ ...w, statement: e.target.value })} /></Field>
        <Field label="Key evidence of location (optional)"><select value={w.locationId || ""} onChange={e => setW({ ...w, locationId: e.target.value || undefined })}><option value="">— not tied to a location —</option>{m.locations.map(l => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}</select></Field>
      </>, newWitness, "Add witness", (w, i) => <>Witness {i + 1}{w.name ? `: ${w.name}` : ""}{roleBadge("WITNESS · REQUIRED")}</>)}
    </details>

    <details open={allLocationsApproved}><summary><strong>Helper witnesses — clue helpers</strong> ({m.helperWitnesses.length}) — optional{!allLocationsApproved ? " — after the map walk" : ""}</summary>
      {!allLocationsApproved && pipeline.storylineApproved
        ? <p style={{ ...lockNote, margin: "0.5rem 0" }}>🧭 Clue helpers come after the map: finish the guided walk and approve every location above, then describe each helper and the builder creates what they can reveal.</p>
        : <>
      <p>Unlockable by gift. Not critical to solving the case — just extra help for a stuck detective. <strong>They never block the arrest.</strong> Start from YOUR character description; the builder shapes what they can reveal and how it helps. Then choose: generate media for them, or relay their information yourself when one is triggered.</p>
      {listOf(m.helperWitnesses, v => patch({ helperWitnesses: v }), (w, _i, setW) => <>
        <Field label="Character description — YOUR description comes first" hint="Describe the helper as you picture them. The builder creates their information from this."><TA value={w.description} onChange={e => setW({ ...w, description: e.target.value })} style={{ minHeight: 80 }} /></Field>
        <Field label="Name"><IN value={w.name} onChange={e => setW({ ...w, name: e.target.value })} /></Field>
        <Field label="Role"><IN value={w.role} onChange={e => setW({ ...w, role: e.target.value })} /></Field>
        <Field label="What they can reveal (info card)"><TA value={w.info} onChange={e => setW({ ...w, info: e.target.value })} /></Field>
        <Field label="How it helps the detective (info card)"><TA value={w.howItHelps} onChange={e => setW({ ...w, howItHelps: e.target.value })} placeholder="e.g. Confirms the bookkeeper returned after she claimed to leave — the detective can press her on the timeline." /></Field>
        <Field label="Gift that unlocks them"><IN value={w.giftToUnlock} onChange={e => setW({ ...w, giftToUnlock: e.target.value })} placeholder="e.g. Coffee" /></Field>
        <Field label="When triggered, present this helper by…"><select value={w.mediaMode || "generate"} onChange={e => setW({ ...w, mediaMode: e.target.value as "generate" | "relay" })}><option value="generate">Generated media (portrait / video)</option><option value="relay">I'll relay their information myself</option></select></Field>
        <Field label="Your uploaded media — asset key (optional)" hint="Upload your pre-created photo/media for this helper in the project's media and paste its key here. It feeds the helper's info card and is the REFERENCE BASE for any further image/video generation of this helper."><IN value={w.mediaKey || ""} onChange={e => setW({ ...w, mediaKey: e.target.value })} placeholder="e.g. old-tommy-photo.jpg" /></Field>
        {(w.mediaMode || "generate") === "generate" && <>
          <Field label="Portrait prompt" hint={w.mediaKey ? "Generation starts from your uploaded media above, so the helper stays recognizably the same person." : undefined}><TA value={w.portraitPrompt || ""} onChange={e => setW({ ...w, portraitPrompt: e.target.value })} /></Field>
          <Field label="Generated portrait asset key (optional)" hint="Filled automatically when you generate the portrait below. This is the generated media — your uploaded reference above stays untouched."><IN value={w.portraitKey || ""} onChange={e => setW({ ...w, portraitKey: e.target.value })} placeholder="Set automatically on generation" /></Field>
          {genBtn(`help-img-${w.id}`, "✦ Generate portrait", w.portraitPrompt?.trim() ? () => void runMedia(`help-img-${w.id}`, "image", w.portraitPrompt || "", `CCS helper — ${w.name || w.id} (portrait)`, key => patchLatest({ helperWitnesses: mRef.current.helperWitnesses.map(x => x.id === w.id ? { ...x, portraitKey: key } : x) }), w.mediaKey || undefined) : null, "Write the portrait prompt first.")}
          <Field label="Intro video prompt"><TA value={w.videoPrompt || ""} onChange={e => setW({ ...w, videoPrompt: e.target.value })} /></Field>
          <Field label="Generated intro video asset key (optional)" hint="Filled automatically when you generate the intro video below."><IN value={w.videoKey || ""} onChange={e => setW({ ...w, videoKey: e.target.value })} placeholder="Set automatically on generation" /></Field>
          {genBtn(`help-vid-${w.id}`, "✦ Generate intro video", w.videoPrompt?.trim() ? () => void runMedia(`help-vid-${w.id}`, "video", w.videoPrompt || "", `CCS helper — ${w.name || w.id} (intro video)`, key => patchLatest({ helperWitnesses: mRef.current.helperWitnesses.map(x => x.id === w.id ? { ...x, videoKey: key } : x) }), w.mediaKey || undefined) : null, "Write the intro video prompt first.")}
          {media && w.mediaKey && <small style={{ display: "block", opacity: 0.8, margin: "0.25rem 0" }}>Your uploaded reference ({w.mediaKey}) is used as the visual base for this helper's generated portrait and video.</small>}
          <Field label="Voice"><select value={w.voice || ""} onChange={e => setW({ ...w, voice: e.target.value })}><option value="">No voice</option><option value="Aria">Aria (female)</option><option value="Roger">Roger (male)</option></select></Field>
        </>}
      </>, newHelper, "Add helper witness", (w, i) => <>Helper {i + 1}{w.name ? `: ${w.name}` : ""}{roleBadge("HELPER · OPTIONAL")}</>)}
      </>}
    </details>

    <details><summary><strong>Timeline</strong> ({m.timeline.length})</summary>
      {listOf(m.timeline, v => patch({ timeline: v }), (t, _i, setT) => <div style={{ display: "flex", gap: "0.5rem" }}>
        <Field label="Time"><IN value={t.time} onChange={e => setT({ ...t, time: e.target.value })} placeholder="11:40 PM" /></Field>
        <Field label="Event"><IN value={t.event} onChange={e => setT({ ...t, event: e.target.value })} /></Field>
      </div>, newTimeline, "Add timeline event", (t, i) => `Event ${i + 1}${t.time ? ` — ${t.time}` : ""}`)}
    </details>

    <details><summary><strong>Twists</strong> ({m.twists.length}) 🔒</summary>
      <p style={lockNote}>🔒 <strong>HOST ONLY — pre-woven surprises.</strong> The host knows them from the case file and deploys them at the right moment. Never on the overlay.</p>
      {listOf(m.twists, v => patch({ twists: v }), (t, _i, setT) => <>
        <Field label="Title"><IN value={t.title} onChange={e => setT({ ...t, title: e.target.value })} /></Field>
        <Field label="Description"><TA value={t.description} onChange={e => setT({ ...t, description: e.target.value })} /></Field>
        <Field label="Trigger moment (when the host deploys it)"><TA value={t.triggerMoment} onChange={e => setT({ ...t, triggerMoment: e.target.value })} /></Field>
      </>, newTwist, "Add twist", (t, i) => `Twist ${i + 1}${t.title ? `: ${t.title}` : ""}`)}
    </details>

    <details><summary><strong>Case-insight video prompts</strong> ({m.caseInsightVideoPrompts.length}){!pipeline.storylineApproved ? " — locked at the storyline gate" : ""}</summary>
      {!pipeline.storylineApproved ? gateNotice("Media prompts") : <>
      <p>Cinematic cut-scene prompts for the site's video generator.</p>
      {m.caseInsightVideoPrompts.map((p, i) => <Field key={i} label={`Prompt ${i + 1}`}><TA value={p} onChange={e => patch({ caseInsightVideoPrompts: m.caseInsightVideoPrompts.map((x, j) => (j === i ? e.target.value : x)) })} /><button type="button" className="outline-btn" onClick={() => patch({ caseInsightVideoPrompts: m.caseInsightVideoPrompts.filter((_, j) => j !== i) })}>Remove</button></Field>)}
      <button type="button" className="outline-btn" onClick={() => patch({ caseInsightVideoPrompts: [...m.caseInsightVideoPrompts, ""] })}>Add prompt</button>
      </>}
    </details>

    {saved && <p role="status">Saved. Your changes are in this project draft.</p>}
  </section>;
}
