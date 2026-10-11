"use client";
import { useEffect, useState } from "react";
import type { GameTool } from "../lib/project";
import { readCityCrimeSceneConfig, type CityCrimeSceneConfig } from "../lib/city-crime-scene";

type ActionKind = "briefing" | "investigate" | "revealClue" | "introduceSuspect" | "evidence" | "arrest" | "courtroom" | "unlockWitness" | "hide";

function useTimer() {
  const [seconds, setSeconds] = useState(120);
  const [left, setLeft] = useState(120);
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
      const labels: Record<string, string> = { briefing: "Case briefing is live.", investigate: "Location is live.", revealClue: "Clue revealed.", introduceSuspect: "Suspect introduced.", evidence: "Evidence board is live.", arrest: "Arrest made — dramatic moment live.", courtroom: "Courtroom phase is live.", unlockWitness: "Witness unlocked.", hide: "Overlay cleared." };
      setStatus(labels[kind] || "Sent.");
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
      <button type="button" disabled={busy} onClick={() => void act("briefing")}>1 · Show case briefing</button>
      <button type="button" disabled={busy} onClick={() => void act("evidence")}>Evidence board</button>
      <button type="button" disabled={busy} onClick={() => void act("hide")}>Hide / clear</button>
    </div>
      <h4>Investigation</h4>
      {cfg.locations.map(l => <div key={l.id} style={{ margin: "0.25rem 0" }}><strong>{l.name}</strong>{" "}
        <button type="button" disabled={busy} onClick={() => void act("investigate", { locationId: l.id })}>Show location</button>{" "}
        {cfg.clues.filter(c => c.locationId === l.id).map(c => <button key={c.id} type="button" disabled={busy} onClick={() => void act("revealClue", { clueId: c.id })} title={c.title}>Reveal: {c.title}</button>)}
      </div>)}
      <h4>Introduce suspects (as the investigation points at them)</h4>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{cfg.suspects.map(s => <button key={s.id} type="button" disabled={busy} onClick={() => void act("introduceSuspect", { suspectId: s.id })}>Introduce {s.name}</button>)}</div>
      <h4>Helper witnesses (detective sends a gift to unlock)</h4>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{cfg.helperWitnesses.map(w => <button key={w.id} type="button" disabled={busy} onClick={() => void act("unlockWitness", { witnessId: w.id })} title={w.info}>Unlock {w.name} ({w.giftToUnlock})</button>)}{!cfg.helperWitnesses.length && <span>No helper witnesses in this case.</span>}</div>
      <h4>Arrest</h4>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <select value={arrestId} onChange={e => setArrestId(e.target.value)} aria-label="Suspect to arrest"><option value="">Choose suspect…</option>{cfg.suspects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button type="button" disabled={busy || !arrestId} onClick={() => void act("arrest", { suspectId: arrestId })}>Make the arrest</button>
        {guilty && arrestId === guilty.id && <strong style={{ color: "#7dff9a" }}>✓ Correct — continue to trial.</strong>}
        {guilty && arrestId && arrestId !== guilty.id && <strong style={{ color: "#ff9a9a" }}>✗ Wrong suspect — the real culprit walks free (dramatic!).</strong>}
      </div>
      <h4>Courtroom</h4>
      <button type="button" disabled={busy} onClick={() => void act("courtroom", { suspectId: arrestId || guilty?.id || "" })}>Start trial phase</button>
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
      {cfg.suspects.map(s => <div key={s.id} style={{ border: "1px solid #444", borderRadius: 8, padding: "0.5rem", margin: "0.5rem 0" }}>
        <strong>{s.name}{s.isGuilty ? " 🔒 (guilty — brief stays innocent; inform by DM at game start)" : ""}</strong>
        <p><strong>Brief:</strong> {s.characterBrief}</p>
        <p><strong>Potential motive:</strong> {s.potentialMotive}</p>
        <p><strong>Alibi:</strong> {s.alibi}</p>
        <button type="button" className="outline-btn" onClick={() => void copy(`${s.name}\n\nCHARACTER BRIEF\n${s.characterBrief}\n\nPOTENTIAL MOTIVE\n${s.potentialMotive}\n\nALIBI\n${s.alibi}`, `${s.name}'s brief`)}>Copy brief</button>
      </div>)}
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
