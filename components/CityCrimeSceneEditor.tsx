"use client";
import { useState } from "react";
import type { GameTool } from "../lib/project";
import {
  readCityCrimeSceneConfig, validateCityCrimeScene,
  type CityCrimeSceneConfig, type CityCrimeSceneSuspect, type CityCrimeSceneClue,
  type CityCrimeSceneLocation, type CityCrimeSceneHelperWitness, type CityCrimeSceneTimelineEvent, type CityCrimeSceneTwist,
} from "../lib/city-crime-scene";

const uid = () => Math.random().toString(36).slice(2, 10);
const lockNote: React.CSSProperties = { background: "#3a2b10", border: "1px solid #d6aa58", color: "#ffe9bd", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.85rem" };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label style={{ display: "block", margin: "0.5rem 0" }}><span style={{ fontWeight: 600 }}>{label}</span>{children}{hint && <small style={{ display: "block", opacity: 0.75 }}>{hint}</small>}</label>;
}
const TA = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} style={{ width: "100%", minHeight: 64, ...(props.style || {}) }} />;
const IN = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} style={{ width: "100%", ...(props.style || {}) }} />;

export default function CityCrimeSceneEditor({ tool, onSave }: { tool: GameTool; onSave: (t: GameTool) => void }) {
  const [m, setM] = useState<CityCrimeSceneConfig>(() => readCityCrimeSceneConfig(tool.config));
  const [saved, setSaved] = useState(false);
  const [premise, setPremise] = useState(m.premise);
  const [notes, setNotes] = useState("");
  const [genSuspects, setGenSuspects] = useState(m.suspectCount);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const save = (next: CityCrimeSceneConfig) => { setM(next); setSaved(true); onSave({ ...tool, config: { ...tool.config, mystery: next } }); };
  const patch = (p: Partial<CityCrimeSceneConfig>) => save({ ...m, ...p });
  const problems = validateCityCrimeScene(m);

  async function generate() {
    if (!premise.trim()) { setStatus("Describe your premise first."); return; }
    if (m.suspects.some(s => s.name.trim() || s.characterBrief.trim()) && !window.confirm("Replace the current case with a newly generated one? Your edits will be lost.")) return;
    setBusy(true); setStatus("Drafting your case…");
    try {
      const res = await fetch("/api/city-crime-scene/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ premise, notes, suspectCount: genSuspects }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      save(readCityCrimeSceneConfig({ mystery: data.config }));
      const v = validateCityCrimeScene(readCityCrimeSceneConfig({ mystery: data.config }));
      setStatus(v.length ? `Case drafted with ${v.length} issue(s) to review below.` : "Case drafted. Rewrite anything — every field is yours.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Generation failed."); }
    finally { setBusy(false); }
  }

  const listOf = <T,>(items: T[], set: (v: T[]) => void, render: (item: T, i: number, setItem: (v: T) => void, remove: () => void) => React.ReactNode, add: () => T, addLabel: string, legend: (item: T, i: number) => string) => (
    <div>{items.map((item, i) => {
      const setItem = (v: T) => set(items.map((x, j) => (j === i ? v : x)));
      const remove = () => set(items.filter((_, j) => j !== i));
      return <fieldset key={i} style={{ margin: "0.5rem 0", padding: "0.5rem", border: "1px solid #444" }}><legend>{legend(item, i)}</legend>{render(item, i, setItem, remove)}<button type="button" className="outline-btn" onClick={remove}>Remove</button></fieldset>;
    })}<button type="button" className="outline-btn" onClick={() => set([...items, add()])}>{addLabel}</button></div>
  );

  const newSuspect = (): CityCrimeSceneSuspect => ({ id: `sus-${uid()}`, name: "", characterBrief: "", potentialMotive: "", alibi: "", demeanor: "", tells: "", extraInfo: "", questions: ["", "", ""], guideVideoPrompt: "", isGuilty: false });
  const newClue = (): CityCrimeSceneClue => ({ id: `clue-${uid()}`, title: "", description: "", locationId: m.locations[0]?.id || "", cutScenePrompt: "", relatedSuspectIds: [] });
  const newLocation = (): CityCrimeSceneLocation => ({ id: `loc-${uid()}`, name: "", description: "", imagePrompt: "" });
  const newWitness = (): CityCrimeSceneHelperWitness => ({ id: `wit-${uid()}`, name: "", role: "", description: "", info: "", giftToUnlock: "", portraitPrompt: "", videoPrompt: "", voice: "" });
  const newTimeline = (): CityCrimeSceneTimelineEvent => ({ id: `t-${uid()}`, time: "", event: "" });
  const newTwist = (): CityCrimeSceneTwist => ({ id: `tw-${uid()}`, title: "", description: "", triggerMoment: "" });

  return <section className="card-editor card-host" aria-label="City Crime Scene setup" style={{ maxWidth: 860 }}>
    <h4>City Crime Scene</h4>
    <p>An improv whodunnit in the spirit of Law &amp; Order. AI drafts the case — <strong>you have full creative liberty: rewrite anything.</strong> Sections marked 🔒 never appear on the audience overlay.</p>

    <details open><summary><strong>✦ Generate with AI</strong></summary><div style={{ padding: "0.5rem 0" }}>
      <p style={{ opacity: 0.75, fontSize: "0.85rem" }}>Describe what you want — the AI drafts the full case below, which you can then rewrite freely.</p>
      <Field label="Premise for the AI to build on"><TA value={premise} onChange={e => setPremise(e.target.value)} placeholder="e.g. A jazz club owner is found dead in his locked office after closing…" /></Field>
      <Field label="Notes for the AI (optional)" hint="Your word is final — the AI must honor these."><TA value={notes} onChange={e => setNotes(e.target.value)} placeholder="Names to use, setting details, things to avoid…" /></Field>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Field label="Suspects to generate"><select value={genSuspects} onChange={e => setGenSuspects(Number(e.target.value))}>{[4, 5, 6, 7].map(n => <option key={n} value={n}>{n} suspects</option>)}</select></Field>
      </div>
      <button type="button" className="build-btn" disabled={busy} onClick={() => void generate()}>{busy ? "Drafting…" : "Generate case with AI"}</button>
      {status && <p role="status">{status}</p>}
    </div></details>

    {problems.length > 0 && <div role="alert" style={{ ...lockNote, background: "#3a1414", borderColor: "#d66" }}><strong>Case issues to fix:</strong><ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}

    <details open><summary><strong>The case</strong></summary>
      <Field label="Case title"><IN value={m.title} onChange={e => patch({ title: e.target.value })} /></Field>
      <Field label="Premise"><TA value={m.premise} onChange={e => patch({ premise: e.target.value })} /></Field>
      <Field label="The crime (shown in the briefing)"><TA value={m.crime} onChange={e => patch({ crime: e.target.value })} /></Field>
      <Field label="The victim"><TA value={m.victim} onChange={e => patch({ victim: e.target.value })} /></Field>
      <Field label="Backstory"><TA value={m.backstory} onChange={e => patch({ backstory: e.target.value })} /></Field>
      <Field label="Plot"><TA value={m.plot} onChange={e => patch({ plot: e.target.value })} /></Field>
      <div style={{ ...lockNote, margin: "0.5rem 0" }}>🔒 <strong>HOST ONLY — never shown on the overlay.</strong></div>
      <Field label="Actual crime details (the truth — host only)"><TA value={m.actualCrimeDetails} onChange={e => patch({ actualCrimeDetails: e.target.value })} style={{ minHeight: 100 }} /></Field>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Field label="Suspects"><select value={m.suspectCount} onChange={e => patch({ suspectCount: Number(e.target.value) })}>{[4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
        <Field label="Interrogation timer (sec)"><IN type="number" min={15} max={3600} value={m.interrogationSeconds} onChange={e => patch({ interrogationSeconds: Math.max(15, +e.target.value || 120) })} /></Field>
        <Field label="Courtroom timer (sec)"><IN type="number" min={15} max={3600} value={m.courtroomSeconds} onChange={e => patch({ courtroomSeconds: Math.max(15, +e.target.value || 180) })} /></Field>
      </div>
    </details>

    <details><summary><strong>Locations</strong> ({m.locations.length})</summary>
      {listOf(m.locations, v => patch({ locations: v }), (l, _i, setL) => <>
        <Field label="Name"><IN value={l.name} onChange={e => setL({ ...l, name: e.target.value })} /></Field>
        <Field label="Description"><TA value={l.description} onChange={e => setL({ ...l, description: e.target.value })} /></Field>
        <Field label="Image prompt (for the site's image generator)" hint="Describe the noir establishing shot for this location."><TA value={l.imagePrompt || ""} onChange={e => setL({ ...l, imagePrompt: e.target.value })} /></Field>
      </>, newLocation, "Add location", (l, i) => `Location ${i + 1}${l.name ? `: ${l.name}` : ""}`)}
    </details>

    <details><summary><strong>Clues</strong> ({m.clues.length})</summary>
      {listOf(m.clues, v => patch({ clues: v }), (c, _i, setC) => <>
        <Field label="Title"><IN value={c.title} onChange={e => setC({ ...c, title: e.target.value })} /></Field>
        <Field label="Description"><TA value={c.description} onChange={e => setC({ ...c, description: e.target.value })} /></Field>
        <Field label="Location"><select value={c.locationId} onChange={e => setC({ ...c, locationId: e.target.value })}>{m.locations.map(l => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}</select></Field>
        <Field label="Cut-scene prompt (cinematic clue reveal)"><TA value={c.cutScenePrompt} onChange={e => setC({ ...c, cutScenePrompt: e.target.value })} /></Field>
        <Field label="Implicates which suspects?">{m.suspects.map(s => <label key={s.id} style={{ display: "inline-block", marginRight: "0.75rem", fontWeight: 400 }}><input type="checkbox" checked={c.relatedSuspectIds.includes(s.id)} onChange={e => setC({ ...c, relatedSuspectIds: e.target.checked ? [...c.relatedSuspectIds, s.id] : c.relatedSuspectIds.filter(x => x !== s.id) })} /> {s.name || s.id}</label>)}</Field>
      </>, newClue, "Add clue", (c, i) => `Clue ${i + 1}${c.title ? `: ${c.title}` : ""}`)}
    </details>

    <details><summary><strong>Suspects</strong> ({m.suspects.length})</summary>
      <p style={lockNote}>🔒 Parts of each suspect card are <strong>HOST ONLY</strong> — the audience overlay never sees them.</p>
      {listOf(m.suspects, v => patch({ suspects: v }), (s, _i, setS) => <>
        <Field label="Name"><IN value={s.name} onChange={e => setS({ ...s, name: e.target.value })} /></Field>
        <label style={{ display: "block", margin: "0.5rem 0" }}><input type="checkbox" checked={s.isGuilty} onChange={e => { const next = m.suspects.map(x => ({ ...x, isGuilty: x.id === s.id ? e.target.checked : e.target.checked ? false : x.isGuilty })); save({ ...m, suspects: next }); }} /> <strong>🔒 This suspect is the guilty party</strong> (only one may be guilty)</label>
        <Field label="Character brief (given to the player pre-game)"><TA value={s.characterBrief} onChange={e => setS({ ...s, characterBrief: e.target.value })} /></Field>
        <Field label="Potential motive (they look guilty — guilt not confirmed to them)"><TA value={s.potentialMotive} onChange={e => setS({ ...s, potentialMotive: e.target.value })} /></Field>
        <Field label="Alibi"><TA value={s.alibi} onChange={e => setS({ ...s, alibi: e.target.value })} /></Field>
        <div style={{ ...lockNote, margin: "0.5rem 0" }}>🔒 Detective dossier — private. Never on the overlay.</div>
        <Field label="Demeanor 🔒"><TA value={s.demeanor} onChange={e => setS({ ...s, demeanor: e.target.value })} /></Field>
        <Field label="Tells 🔒"><TA value={s.tells} onChange={e => setS({ ...s, tells: e.target.value })} /></Field>
        <Field label="Extra info (not in the player's brief) 🔒"><TA value={s.extraInfo} onChange={e => setS({ ...s, extraInfo: e.target.value })} /></Field>
        <Field label="Suggested interrogation questions (optional for the detective) 🔒">{s.questions.map((q, qi) => <IN key={qi} value={q} onChange={e => setS({ ...s, questions: s.questions.map((x, j) => (j === qi ? e.target.value : x)) })} placeholder={`Question ${qi + 1}`} />)}<button type="button" className="outline-btn" onClick={() => setS({ ...s, questions: [...s.questions, ""] })}>Add question</button></Field>
        <Field label="Character guide video prompt (for the site's video generator)" hint="Plays center-focused during gameplay when the investigation turns to this suspect."><TA value={s.guideVideoPrompt} onChange={e => setS({ ...s, guideVideoPrompt: e.target.value })} /></Field>
      </>, newSuspect, "Add suspect", (s, i) => `Suspect ${i + 1}${s.name ? `: ${s.name}` : ""}${s.isGuilty ? " 🔒 GUILTY" : ""}`)}
    </details>

    <details><summary><strong>Witness statements</strong> ({m.witnessStatements.length})</summary>
      <p>Static evidence shown in the opening briefing.</p>
      {m.witnessStatements.map((w, i) => <Field key={i} label={`Statement ${i + 1}`}><TA value={w} onChange={e => patch({ witnessStatements: m.witnessStatements.map((x, j) => (j === i ? e.target.value : x)) })} /><button type="button" className="outline-btn" onClick={() => patch({ witnessStatements: m.witnessStatements.filter((_, j) => j !== i) })}>Remove</button></Field>)}
      <button type="button" className="outline-btn" onClick={() => patch({ witnessStatements: [...m.witnessStatements, ""] })}>Add statement</button>
    </details>

    <details><summary><strong>Helper witnesses</strong> ({m.helperWitnesses.length}) — optional</summary>
      <p>Unlockable by gift. Not critical to solving the case — just extra help for a stuck detective. Design them here; generate portraits/video/voice with the site's tools using these prompts.</p>
      {listOf(m.helperWitnesses, v => patch({ helperWitnesses: v }), (w, _i, setW) => <>
        <Field label="Name"><IN value={w.name} onChange={e => setW({ ...w, name: e.target.value })} /></Field>
        <Field label="Role"><IN value={w.role} onChange={e => setW({ ...w, role: e.target.value })} /></Field>
        <Field label="Description"><TA value={w.description} onChange={e => setW({ ...w, description: e.target.value })} /></Field>
        <Field label="What they reveal when unlocked"><TA value={w.info} onChange={e => setW({ ...w, info: e.target.value })} /></Field>
        <Field label="Gift that unlocks them"><IN value={w.giftToUnlock} onChange={e => setW({ ...w, giftToUnlock: e.target.value })} placeholder="e.g. Coffee" /></Field>
        <Field label="Portrait prompt"><TA value={w.portraitPrompt || ""} onChange={e => setW({ ...w, portraitPrompt: e.target.value })} /></Field>
        <Field label="Intro video prompt"><TA value={w.videoPrompt || ""} onChange={e => setW({ ...w, videoPrompt: e.target.value })} /></Field>
        <Field label="Voice"><select value={w.voice || ""} onChange={e => setW({ ...w, voice: e.target.value })}><option value="">No voice</option><option value="Aria">Aria (female)</option><option value="Roger">Roger (male)</option></select></Field>
      </>, newWitness, "Add helper witness", (w, i) => `Witness ${i + 1}${w.name ? `: ${w.name}` : ""}`)}
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

    <details><summary><strong>Case-insight video prompts</strong> ({m.caseInsightVideoPrompts.length})</summary>
      <p>Cinematic cut-scene prompts for the site's video generator.</p>
      {m.caseInsightVideoPrompts.map((p, i) => <Field key={i} label={`Prompt ${i + 1}`}><TA value={p} onChange={e => patch({ caseInsightVideoPrompts: m.caseInsightVideoPrompts.map((x, j) => (j === i ? e.target.value : x)) })} /><button type="button" className="outline-btn" onClick={() => patch({ caseInsightVideoPrompts: m.caseInsightVideoPrompts.filter((_, j) => j !== i) })}>Remove</button></Field>)}
      <button type="button" className="outline-btn" onClick={() => patch({ caseInsightVideoPrompts: [...m.caseInsightVideoPrompts, ""] })}>Add prompt</button>
    </details>

    {saved && <p role="status">Saved. Your changes are in this project draft.</p>}
  </section>;
}
