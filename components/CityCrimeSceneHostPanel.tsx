"use client";
import { useEffect, useState } from "react";
import type { GameTool } from "../lib/project";
import { readCityCrimeSceneConfig, generalizedKeyEvidence, type CityCrimeSceneConfig } from "../lib/city-crime-scene";

type ActionKind = "crimeIntro" | "suspectLineup" | "briefing" | "map" | "investigate" | "revealClue" | "introduceSuspect" | "questionSuspect" | "hearWitness" | "flashback" | "evidence" | "arrest" | "verdict" | "courtroom" | "unlockWitness" | "hide";

type CcssProgress = {
  clues: number; cluesTotal: number;
  introduced: number; suspectsTotal: number;
  questioned: number; questionedTotal: number;
  witnesses: number; witnessesTotal: number;
  helpers: number; helpersTotal: number;
  suspectsUnlocked: number; suspectsUnlockedTotal: number;
  helpersAvailable: number; helpersAvailableTotal: number;
  complete: boolean;
};

function useTimer() {
  const [seconds, setSeconds] = useState(300);
  const [left, setLeft] = useState(300);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    if (left <= 0) { setRunning(false); return; }
    const t = setTimeout(() => setLeft(l => Math.max(0, l - 1)), 1000);
    return () => clearTimeout(t);
  }, [running, left]);
  return { seconds, setSeconds: (s: number) => { setSeconds(s); setLeft(s); }, left, running, start: () => setRunning(true), pause: () => setRunning(false), reset: () => { setLeft(seconds); setRunning(false); } };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function CityCrimeSceneHostPanel({ tool, slug, hostKey }: { tool: GameTool; slug?: string; hostKey?: string }) {
  const [full, setFull] = useState<CityCrimeSceneConfig | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [arrestId, setArrestId] = useState("");
  const timer = useTimer();
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [progress, setProgress] = useState<CcssProgress | null>(null);
  const [liveIds, setLiveIds] = useState<{ unlockedSuspectIds: string[]; availableHelperIds: string[] }>({ unlockedSuspectIds: [], availableHelperIds: [] });
  const noteKey = `ttc-ccss-notes-${slug || "preview"}-${tool.id}`;

  useEffect(() => {
    try { const saved = window.localStorage.getItem(noteKey); if (saved) setNotes(JSON.parse(saved)); } catch {}
  }, [noteKey]);
  useEffect(() => {
    if (!slug || !hostKey) { setFull(readCityCrimeSceneConfig(tool.config)); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}?casefile=${encodeURIComponent(tool.id)}`, { headers: { "x-host-key": hostKey }, cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Case file unavailable.");
        if (!cancelled) setFull(readCityCrimeSceneConfig({ mystery: data.config }));
      } catch (e) { if (!cancelled) { setLoadError(e instanceof Error ? e.message : "Case file unavailable."); setFull(readCityCrimeSceneConfig(tool.config)); } }
    })();
    return () => { cancelled = true; };
  }, [slug, hostKey, tool.id]);

  const cfg = full || readCityCrimeSceneConfig(tool.config);
  const guilty = cfg.suspects.find(s => s.isGuilty);

  // Poll the live overlay state so the panel can show investigation progress
  // and keep the arrest locked until every clue is gathered and everyone has
  // spoken to the detective.
  useEffect(() => {
    if (!slug || !hostKey) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}?ccssState=${encodeURIComponent(tool.id)}`, { headers: { "x-host-key": hostKey }, cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setProgress((data.outcome?.progress as CcssProgress) || null);
          if (data.outcome) setLiveIds({ unlockedSuspectIds: data.outcome.unlockedSuspectIds || [], availableHelperIds: data.outcome.availableHelperIds || [] });
        }
      } catch {}
    };
    void load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [slug, hostKey, tool.id]);

  const logNote = (text: string) => {
    setNotes(prev => {
      const next = [...prev, text];
      try { window.localStorage.setItem(noteKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  async function act(kind: ActionKind, extra: Record<string, string> = {}) {
    if (!slug || !hostKey) { setStatus("Open the private host dashboard link from the builder to run live."); return; }
    setBusy(true); setStatus("");
    try {
      const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-host-key": hostKey },
        body: JSON.stringify({ cityCrimeSceneAction: { toolId: tool.id, kind, ...extra } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      const labels: Record<string, string> = { crimeIntro: "Crime introduction is live.", suspectLineup: "Suspect lineup is live.", briefing: "Case briefing is live.", map: "Game map is live — the detective chooses where to go.", investigate: "Location is live.", revealClue: "Clue revealed.", introduceSuspect: "Suspect introduced.", questionSuspect: "Interrogation marked complete.", hearWitness: "Witness statement is live.", flashback: "Flashback is playing.", evidence: "Evidence board is live.", arrest: "Arrest made — dramatic moment live.", verdict: "Verdict revealed to the audience.", courtroom: "Courtroom phase is live.", unlockWitness: "Helper witness unlocked.", hide: "Overlay cleared." };
      setStatus(labels[kind] || "Sent.");
      // The investigator's notebook builds itself: discoveries are logged automatically.
      if (kind === "revealClue" && extra.clueId) {
        const c = cfg.clues.find(x => x.id === extra.clueId);
        if (c) {
          logNote(`📌 Clue found: ${c.title}`);
          if (c.unlocksSuspectId) {
            const us = cfg.suspects.find(x => x.id === c.unlocksSuspectId);
            if (us) logNote(`🔓 Questioning unlocked: ${us.name} — the detective may call them in whenever they choose`);
          }
          if (c.unlocksHelperId) {
            const uh = cfg.helperWitnesses.find(x => x.id === c.unlocksHelperId);
            if (uh) logNote(`🔓 Clue helper available: ${uh.name} — the detective may use them if and when they choose`);
          }
        }
      } else if (kind === "introduceSuspect" && extra.suspectId) {
        const s = cfg.suspects.find(x => x.id === extra.suspectId);
        if (s) logNote(`🕵️ ${s.name} entered the investigation`);
      } else if (kind === "questionSuspect" && extra.suspectId) {
        const s = cfg.suspects.find(x => x.id === extra.suspectId);
        if (s) logNote(`✅ ${s.name} questioned — interrogation on the record`);
      } else if (kind === "hearWitness" && extra.witnessId) {
        const w = cfg.witnesses.find(x => x.id === extra.witnessId);
        if (w) logNote(`🎤 Witness heard: ${w.name}${w.role ? ` (${w.role})` : ""}`);
      } else if (kind === "unlockWitness" && extra.witnessId) {
        const w = cfg.helperWitnesses.find(x => x.id === extra.witnessId);
        if (w) logNote(`🔓 Helper unlocked: ${w.name} (${w.giftToUnlock})`);
      } else if (kind === "flashback" && extra.flashbackId) {
        const f = cfg.flashbacks.find(x => x.id === extra.flashbackId);
        if (f) logNote(`🎞️ Flashback uncovered: ${f.title}`);
      }
      if (data.outcome?.progress) setProgress(data.outcome.progress as CcssProgress);
      if (data.outcome) setLiveIds({ unlockedSuspectIds: data.outcome.unlockedSuspectIds || [], availableHelperIds: data.outcome.availableHelperIds || [] });
    } catch (e) { setStatus(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setStatus(`${label} copied.`); }
    catch { setStatus("Copy failed — select the text manually."); }
  };
  const addNote = () => {
    if (!noteDraft.trim()) return;
    const next = [...notes, noteDraft.trim()];
    setNotes(next); setNoteDraft("");
    try { window.localStorage.setItem(noteKey, JSON.stringify(next)); } catch {}
  };

  const lockStyle: React.CSSProperties = { background: "#2b1f0e", border: "1px solid #d6aa58", borderRadius: 8, padding: "0.75rem", margin: "0.5rem 0" };

  return <section aria-label={`${tool.name} host panel`} style={{ border: "1px solid #555", borderRadius: 12, padding: "1rem", margin: "1rem 0" }}>
    <h3>🔍 {tool.name} · host panel</h3>
    <p><strong>Private.</strong> Everything here stays on this dashboard — the audience only sees what you send to the overlay. Inform the guilty player of their guilt by DM, outside this tool.</p>
    {loadError && <p role="alert">{loadError} (showing the published case instead)</p>}

    <details open><summary><strong>Phase controls</strong></summary><div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
      <button type="button" disabled={busy} onClick={() => void act("crimeIntro")}>1 · Introduce the crime</button>
      <button type="button" disabled={busy} onClick={() => void act("suspectLineup")}>2 · Suspect lineup</button>
      <button type="button" disabled={busy} onClick={() => void act("map")}>🗺 Show the map</button>
      <button type="button" disabled={busy} onClick={() => void act("evidence")}>Evidence board</button>
      <button type="button" disabled={busy} onClick={() => void act("hide")}>Hide / clear</button>
    </div>
      {progress && <p role="status" style={{ background: "#1c2b1c", border: "1px solid #7dff9a", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
        <strong>Investigation progress:</strong> clues {progress.clues}/{progress.cluesTotal} · suspects introduced {progress.introduced}/{progress.suspectsTotal} · questioned {progress.questioned}/{progress.questionedTotal} · witnesses heard {progress.witnesses}/{progress.witnessesTotal}{progress.helpersTotal > 0 && ` · helpers unlocked ${progress.helpers}/${progress.helpersTotal} (optional)`}
        {progress.suspectsUnlockedTotal > 0 && ` · questioning unlocked ${progress.suspectsUnlocked}/${progress.suspectsUnlockedTotal}`}
        {progress.helpersAvailableTotal > 0 && ` · helpers available ${progress.helpersAvailable}/${progress.helpersAvailableTotal}`}
        {progress.complete ? " — ✅ investigation complete, the accusation is unlocked." : " — the arrest unlocks when every clue is found, every suspect is introduced and questioned, and every witness is heard."}
      </p>}
      <p style={{ opacity: 0.8, fontSize: "0.85rem" }}>You run the app; the detective directs you from the live panel. Where they go, what they open, when they question — their call, your hands. Finding a suspect&apos;s unlock evidence opens their questioning; the detective chooses when to use it.</p>
      <h4>Investigation</h4>
      {cfg.locations.map(l => <div key={l.id} style={{ margin: "0.25rem 0" }}><strong>{l.isCrimeScene ? "🚨 " : ""}{l.name}</strong>{" "}
        <button type="button" disabled={busy} onClick={() => void act("investigate", { locationId: l.id })}>Show location</button>{" "}
        {cfg.clues.filter(c => c.locationId === l.id).map(c => <button key={c.id} type="button" disabled={busy} onClick={() => void act("revealClue", { clueId: c.id })} title={`${c.title}${c.hotspot ? ` — bound to: ${c.hotspot}` : ""}`}>Reveal: {c.title}{c.unlocksSuspectId ? " 🔓" : ""}</button>)}
        {cfg.witnesses.filter(w => w.locationId === l.id).map(w => <button key={w.id} type="button" disabled={busy} onClick={() => void act("hearWitness", { witnessId: w.id })} title={w.statement}>🎤 Key witness here: {w.name}</button>)}
      </div>)}
      <h4>Suspects — introduce as the investigation points at them, then mark each interrogation complete</h4>
      {cfg.suspects.map(s => {
        const gated = cfg.clues.some(c => c.unlocksSuspectId === s.id);
        const unlocked = !gated || liveIds.unlockedSuspectIds.includes(s.id);
        return <div key={s.id} style={{ margin: "0.25rem 0" }}><strong>{s.name}</strong>{" "}
          <button type="button" disabled={busy} onClick={() => void act("introduceSuspect", { suspectId: s.id })}>Introduce</button>{" "}
          <button type="button" disabled={busy || !unlocked} onClick={() => void act("questionSuspect", { suspectId: s.id })} title={unlocked ? "The detective has finished interrogating this suspect (5-minute timer)" : "Locked — the detective must first find the map evidence that points to this suspect's connection"}>{unlocked ? "✓ Questioning complete" : "🔒 Questioning locked"}</button>
          {gated && !unlocked && <small> — unlock evidence not yet found</small>}
        </div>;
      })}
      <h4>Required witnesses — the detective must hear each one before the arrest</h4>
      {cfg.witnesses.map(w => <div key={w.id} style={{ margin: "0.25rem 0" }}><strong>{w.name}</strong>{w.role ? ` (${w.role})` : ""}{" "}
        <button type="button" disabled={busy} onClick={() => void act("hearWitness", { witnessId: w.id })} title={w.statement}>Hear witness</button>
      </div>)}
      {!cfg.witnesses.length && <p>No required witnesses in this case.</p>}
      <h4>Crime flashbacks (play at dramatic moments)</h4>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{cfg.flashbacks.map(f => <button key={f.id} type="button" disabled={busy} onClick={() => void act("flashback", { flashbackId: f.id })} title={f.description}>🎞️ {f.title}</button>)}{!cfg.flashbacks.length && <span>No flashbacks in this case.</span>}</div>
      <h4>Helper witnesses — clue helpers (optional — the detective sends a gift to unlock; never required for the arrest)</h4>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{cfg.helperWitnesses.map(w => {
        const gated = cfg.clues.some(c => c.unlocksHelperId === w.id);
        const available = !gated || liveIds.availableHelperIds.includes(w.id);
        return <button key={w.id} type="button" disabled={busy || !available} onClick={() => void act("unlockWitness", { witnessId: w.id })} title={available ? w.info : "Not yet discovered on the map"}>{available ? `Unlock ${w.name} (${w.giftToUnlock})` : `🔒 ${w.name} — not yet discovered`}</button>;
      })}{!cfg.helperWitnesses.length && <span>No helper witnesses in this case.</span>}</div>
      {cfg.helperWitnesses.map(w => <div key={w.id} style={{ border: "1px solid #444", borderRadius: 8, padding: "0.5rem", margin: "0.5rem 0" }}>
        <strong>ℹ️ {w.name}</strong>{w.role ? ` — ${w.role}` : ""} <small>(gift: {w.giftToUnlock}{w.mediaMode === "relay" ? " · you relay this one yourself" : ""}{w.mediaKey ? ` · your media: ${w.mediaKey}` : ""}{w.portraitKey ? ` · generated portrait: ${w.portraitKey}` : ""}{w.videoKey ? ` · generated video: ${w.videoKey}` : ""})</small>
        <p style={{ margin: "0.25rem 0" }}><strong>Character:</strong> {w.description}</p>
        <p style={{ margin: "0.25rem 0" }}><strong>What they can reveal:</strong> {w.info}</p>
        <p style={{ margin: "0.25rem 0" }}><strong>How it helps the detective:</strong> {w.howItHelps}</p>
      </div>)}
      <h4>Arrest — the detective&apos;s accusation</h4>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <select value={arrestId} onChange={e => setArrestId(e.target.value)} aria-label="Suspect the detective accuses"><option value="">Choose suspect…</option>{cfg.suspects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button type="button" disabled={busy || !arrestId || (progress ? !progress.complete : false)} onClick={() => void act("arrest", { suspectId: arrestId })}>Make the arrest</button>
        {progress && !progress.complete && <small>🔒 Locked — reveal every clue, introduce and question every suspect, and hear every witness first. Helper witnesses are optional.</small>}
        {guilty && arrestId === guilty.id && <strong style={{ color: "#7dff9a" }}>✓ Correct — reveal it, then continue to trial.</strong>}
        {guilty && arrestId && arrestId !== guilty.id && <strong style={{ color: "#ff9a9a" }}>✗ Wrong suspect — no trial; the real culprit walks free (dramatic!).</strong>}
      </div>
      <h4>Verdict — reveal whether the detective was right</h4>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={busy || !arrestId} onClick={() => void act("verdict", { suspectId: arrestId })}>Reveal verdict</button>
        <small>The server judges the accusation — the audience never learns who the real culprit is from a wrong verdict.</small>
      </div>
      <h4>Courtroom — only if the accusation was correct</h4>
      <button type="button" disabled={busy || !(guilty && arrestId === guilty.id)} onClick={() => void act("courtroom", { suspectId: arrestId || guilty?.id || "" })}>Start trial phase</button>
      {guilty && arrestId && arrestId !== guilty.id && <p><small>Trial is locked — the detective accused the wrong suspect.</small></p>}
      <p role="status">{status}</p>
    </details>

    <details><summary><strong>⏱ Timers</strong></summary><div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", margin: "0.5rem 0" }}>
      <label>Seconds <input type="number" min={15} max={3600} value={timer.seconds} onChange={e => timer.setSeconds(Math.max(15, +e.target.value || 60))} style={{ width: 80 }} /></label>
      <strong style={{ fontSize: "1.5rem" }} aria-live="polite">{fmt(timer.left)}</strong>
      {!timer.running ? <button type="button" onClick={timer.start}>Start</button> : <button type="button" onClick={timer.pause}>Pause</button>}
      <button type="button" onClick={timer.reset}>Reset</button>
      <button type="button" onClick={() => timer.setSeconds(cfg.interrogationSeconds)}>Use interrogation ({cfg.interrogationSeconds}s)</button>
      <button type="button" onClick={() => timer.setSeconds(cfg.courtroomSeconds)}>Use courtroom ({cfg.courtroomSeconds}s)</button>
    </div></details>

    <details><summary><strong>📓 Detective note log</strong></summary>
      <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
        <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="Important finding…" style={{ flex: 1 }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
        <button type="button" onClick={addNote}>Add note</button>
      </div>
      <ul>{notes.map((n, i) => <li key={i}>{n} <button type="button" className="outline-btn" onClick={() => { const next = notes.filter((_, j) => j !== i); setNotes(next); try { window.localStorage.setItem(noteKey, JSON.stringify(next)); } catch {} }}>✕</button></li>)}</ul>
      {!notes.length && <p>No notes yet.</p>}
    </details>

    <details><summary><strong>🔒 Host case file (never on overlay)</strong></summary>
      <div style={lockStyle}>
        <p><strong>Crime:</strong> {cfg.crime}</p>
        <p><strong>The truth:</strong> {cfg.actualCrimeDetails}</p>
        <p><strong>Guilty party:</strong> {guilty ? `${guilty.name} — DM them at game start. Nobody else is told.` : "⚠ No guilty suspect marked!"}</p>
        <h4>Pre-woven twists</h4>
        <ul>{cfg.twists.map(t => <li key={t.id}><strong>{t.title}</strong> — {t.description}<br /><em>Deploy: {t.triggerMoment}</em></li>)}</ul>
        <h4>Timeline</h4>
        <ul>{cfg.timeline.map(t => <li key={t.id}><strong>{t.time}</strong> — {t.event}</li>)}</ul>
      </div>
    </details>

    <details><summary><strong>Guest briefs (copy & send privately pre-game)</strong></summary>
      {cfg.suspects.map(s => {
        const cardLine = [s.age, s.gender, s.ethnicity].filter(x => String(x || "").trim()).join(" · ");
        const keyEv = generalizedKeyEvidence(cfg, s.id);
        return <div key={s.id} style={{ border: "1px solid #444", borderRadius: 8, padding: "0.5rem", margin: "0.5rem 0" }}>
        <strong>{s.name}{s.isGuilty ? " 🔒 (guilty — brief stays innocent; inform by DM at game start)" : ""}</strong>
        {cardLine && <p style={{ margin: "0.25rem 0", opacity: 0.85 }}>{cardLine}{s.occupation ? ` — ${s.occupation}` : ""}</p>}
        <p><strong>Brief:</strong> {s.characterBrief}</p>
        <p><strong>Potential motive:</strong> {s.potentialMotive}</p>
        <p><strong>Alibi:</strong> {s.alibi}</p>
        {!!keyEv.length && <p><strong>Key evidence (generalized — all the suspect ever sees):</strong></p>}
        {!!keyEv.length && <ul style={{ margin: "0.25rem 0" }}>{keyEv.map(k => <li key={k.clueId}><strong>{k.title}:</strong> {k.summary}</li>)}</ul>}
        <button type="button" className="outline-btn" onClick={() => void copy(`${s.name}${cardLine ? `\n${cardLine}` : ""}\n\nCHARACTER BRIEF\n${s.characterBrief}\n\nPOTENTIAL MOTIVE\n${s.potentialMotive}\n\nALIBI\n${s.alibi}${keyEv.length ? `\n\nKEY EVIDENCE (general outline only — you'll learn the details live, as the detective finds them)\n${keyEv.map(k => `- ${k.title}: ${k.summary}`).join("\n")}` : ""}`, `${s.name}'s brief`)}>Copy brief</button>
      </div>;
      })}
    </details>

    <details><summary><strong>🔒 Detective dossier (private)</strong></summary>
      <p>The detective's edge — demeanor, tells, extra intel, and optional suggested questions per suspect.</p>
      {cfg.suspects.map(s => <div key={s.id} style={{ border: "1px solid #444", borderRadius: 8, padding: "0.5rem", margin: "0.5rem 0" }}>
        <strong>{s.name}</strong>
        <p><strong>Demeanor:</strong> {s.demeanor}</p>
        <p><strong>Tells:</strong> {s.tells}</p>
        <p><strong>Extra info:</strong> {s.extraInfo}</p>
        <p><strong>Suggested questions:</strong></p>
        <ol>{s.questions.filter(q => q.trim()).map((q, i) => <li key={i}>{q}</li>)}</ol>
        <button type="button" className="outline-btn" onClick={() => void copy(`${s.name} — DETECTIVE DOSSIER\n\nDemeanor: ${s.demeanor}\nTells: ${s.tells}\nExtra: ${s.extraInfo}\n\nSuggested questions:\n${s.questions.filter(q => q.trim()).map((q, i) => `${i + 1}. ${q}`).join("\n")}`, `${s.name}'s dossier`)}>Copy dossier</button>
      </div>)}
    </details>
  </section>;
}
