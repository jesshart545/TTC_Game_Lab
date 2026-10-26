"use client";
import type { CSSProperties } from "react";
import type { GameTool, ProjectAsset } from "../lib/project";

/**
 * Public overlay for City Crime Scene. Renders ONLY from the live-event outcome
 * JSON plus the sanitized public tool config. It must never read isGuilty,
 * actualCrimeDetails, twists, demeanor, tells, extraInfo, or question lists —
 * those fields are stripped before this component ever sees them.
 */

type SuspectView = { id: string; name: string; occupation?: string; age?: string; gender?: string; ethnicity?: string; knownFor?: string; personality?: string; quote?: string; characterBrief?: string; potentialMotive?: string; alibi?: string; guideVideoPrompt?: string; guideVideoKey?: string };

type Outcome = {
  kind: "briefing" | "crimeIntro" | "suspectLineup" | "map" | "location" | "clue" | "suspect" | "questioned" | "evidence" | "arrest" | "verdict" | "courtroom" | "witness" | "witnessHeard" | "flashback" | "hide";
  title?: string; premise?: string; crime?: string; victim?: string;
  witnessStatements?: string[];
  witnesses?: { id: string; name: string; role?: string; statement?: string }[];
  suspects?: SuspectView[];
  locations?: { id: string; name: string; description: string; imageKey?: string; imagePrompt?: string; isCrimeScene?: boolean; cluesFound?: number; cluesTotal?: number }[];
  location?: { id: string; name: string; description: string; imagePrompt?: string; imageKey?: string; isCrimeScene?: boolean };
  keyWitness?: { id: string; name: string; role?: string };
  clues?: { id: string; title: string; revealed?: boolean; description?: string; locationName?: string; hotspot?: string; hotspotX?: number; hotspotY?: number; unlocksSuspect?: boolean }[];
  clue?: { id: string; title: string; description: string; cutScenePrompt?: string; cutSceneVideoKey?: string; audioKey?: string; hotspot?: string };
  suspect?: SuspectView;
  keyEvidence?: { clueId: string; title: string; summary: string }[];
  flashback?: { id: string; title: string; description?: string; videoKey?: string };
  witness?: { id: string; name: string; role?: string; description?: string; info?: string; statement?: string; mediaKey?: string; portraitKey?: string; videoKey?: string };
  defendant?: { id: string; name: string };
  correct?: boolean;
  pointingAt?: { id: string; title: string; description?: string }[];
  pointedElsewhere?: { id: string; title: string; description?: string }[];
  courtroomSeconds?: number;
  revealedClueIds?: string[];
};

const noir: CSSProperties = {
  background: "linear-gradient(160deg,#0c0c12 0%,#141420 60%,#0c0c12 100%)",
  color: "#f2e8d5", border: "2px solid #d6aa58", borderRadius: 10,
  padding: "1.25rem 1.5rem", fontFamily: "Georgia, 'Times New Roman', serif",
  boxShadow: "0 0 40px rgba(214,170,88,.25), inset 0 0 60px rgba(0,0,0,.6)",
  maxWidth: "100%", maxHeight: "100%", overflow: "auto",
};
const tape: CSSProperties = {
  background: "repeating-linear-gradient(45deg,#d6aa58 0 18px,#141420 18px 36px)",
  color: "#141420", fontWeight: 800, letterSpacing: 4, textAlign: "center",
  padding: "0.3rem", fontFamily: "monospace", fontSize: "0.85rem",
};
const stamp: CSSProperties = {
  display: "inline-block", border: "2px solid #c0392b", color: "#c0392b",
  fontFamily: "monospace", fontWeight: 800, letterSpacing: 3, padding: "0.2rem 0.6rem",
  transform: "rotate(-4deg)", marginBottom: "0.5rem",
};
const typewriter: CSSProperties = { fontFamily: "'Courier New', monospace" };

function Frame({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return <div style={noir}>
    <style>{`@keyframes ccss-reveal{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:none}}`}</style>
    <div style={tape}>{kicker}</div>
    <h2 style={{ ...typewriter, letterSpacing: 2, margin: "0.75rem 0", color: "#ffd98a" }}>{title}</h2>
    <div style={{ animation: "ccss-reveal .8s ease-out" }}>{children}</div>
  </div>;
}

function SuspectCard({ s }: { s: SuspectView }) {
  const cardLine = [s.age, s.gender, s.ethnicity].filter(x => String(x || "").trim()).join(" · ");
  return <div style={{ background: "#f5ecd7", color: "#2a2118", padding: "0.75rem", borderRadius: 4, boxShadow: "0 4px 10px rgba(0,0,0,.5)" }}>
    <div style={{ ...typewriter, fontWeight: 800, fontSize: "1.05rem", color: "#7a1f1f" }}>{s.name}</div>
    {s.occupation && <div style={{ ...typewriter, fontSize: "0.8rem", opacity: 0.75 }}>{s.occupation}</div>}
    {cardLine && <div style={{ ...typewriter, fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.4rem" }}>{cardLine}</div>}
    {s.knownFor && <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}><strong>Known for:</strong> {s.knownFor}</p>}
    {s.personality && <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}><strong>Personality:</strong> {s.personality}</p>}
    {s.characterBrief && <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}>{s.characterBrief}</p>}
    {s.quote && <p style={{ fontSize: "0.85rem", margin: "0.4rem 0", fontStyle: "italic" }}>“{s.quote}”</p>}
    {s.potentialMotive && <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}><strong>Why they look guilty:</strong> {s.potentialMotive}</p>}
    {s.alibi && <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}><strong>Alibi:</strong> {s.alibi}</p>}
  </div>;
}

/** The spyglass: the only cursor the audience ever sees over a scene. */
const spyglassCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><circle cx='12' cy='12' r='8' fill='none' stroke='%23ffd98a' stroke-width='3'/><line x1='18' y1='18' x2='27' y2='27' stroke='%23ffd98a' stroke-width='4' stroke-linecap='round'/></svg>") 12 12, zoom-in`;

export default function CityCrimeSceneOverlay({ tool, result, assets = [] }: { tool: GameTool; result?: string; assets?: ProjectAsset[] }) {
  let o: Outcome | null = null;
  try { o = JSON.parse(String(result || "null")); } catch { o = null; }
  if (!o || o.kind === "hide") return null;
  const title = String(o.title || (tool.config as Record<string, unknown>).title || tool.name || "City Crime Scene");

  if (o.kind === "briefing") return <Frame kicker="CASE FILE · OPENING BRIEFING" title={title}>
    <p style={{ fontStyle: "italic", opacity: 0.9 }}>{o.premise}</p>
    <p><strong style={{ color: "#ffd98a" }}>THE CRIME</strong><br />{o.crime}</p>
    <p><strong style={{ color: "#ffd98a" }}>VICTIM</strong><br />{o.victim}</p>
    <div style={stamp}>WITNESS STATEMENTS</div>
    <ul style={typewriter}>{(o.witnessStatements || []).map((w, i) => <li key={i} style={{ margin: "0.4rem 0" }}>{w}</li>)}</ul>
    {!!(o.suspects || []).length && <>
      <div style={{ ...stamp, marginTop: "1rem" }}>THE SUSPECTS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.75rem", marginTop: "0.5rem" }}>
        {(o.suspects || []).map(s => <SuspectCard key={s.id} s={s} />)}
      </div>
    </>}
  </Frame>;

  // Opening beat 1: the crime, on its own.
  if (o.kind === "crimeIntro") return <Frame kicker="CASE FILE · THE CRIME" title={title}>
    <p style={{ fontStyle: "italic", opacity: 0.9 }}>{o.premise}</p>
    <p><strong style={{ color: "#ffd98a" }}>THE CRIME</strong><br />{o.crime}</p>
    <p><strong style={{ color: "#ffd98a" }}>VICTIM</strong><br />{o.victim}</p>
  </Frame>;

  // Opening beat 2: a character card for every suspect, then the required witnesses.
  if (o.kind === "suspectLineup") return <Frame kicker="CASE FILE · PERSONS OF INTEREST" title={title}>
    <div style={stamp}>THE SUSPECTS</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.75rem", marginTop: "0.5rem" }}>
      {(o.suspects || []).map(s => <SuspectCard key={s.id} s={s} />)}
    </div>
    {!!(o.witnesses || []).length && <>
      <div style={{ ...stamp, marginTop: "1rem" }}>WITNESSES</div>
      <ul style={typewriter}>{(o.witnesses || []).map(w => <li key={w.id} style={{ margin: "0.4rem 0" }}><strong>{w.name}</strong>{w.role ? ` — ${w.role}` : ""}<br />{w.statement}</li>)}</ul>
    </>}
  </Frame>;

  // The map: every location, presented as a place to enter — no directions,
  // no order. The detective (through the host) chooses freely.
  if (o.kind === "map") return <div style={noir}>
    <style>{`@keyframes ccss-reveal{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:none}}.ccss-place{transition:box-shadow .25s ease,transform .25s ease}.ccss-place:hover{box-shadow:0 0 0 3px #ffd98a,0 0 34px rgba(255,217,138,.45);transform:translateY(-2px)}`}</style>
    <div style={tape}>THE CITY · CHOOSE WHERE TO LOOK</div>
    <h2 style={{ ...typewriter, letterSpacing: 2, margin: "0.75rem 0", color: "#ffd98a" }}>{title}</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: "0.9rem", animation: "ccss-reveal .8s ease-out" }}>
      {(o.locations || []).map(l => {
        const img = l.imageKey ? assets.find(a => (a.storageKey || a.name) === l.imageKey && a.url) : undefined;
        return <div key={l.id} className="ccss-place" style={{ border: "2px solid #d6aa58", borderRadius: 10, overflow: "hidden", background: "#141420" }}>
          <div style={{ height: 120, background: img ? `center/cover url(${img.url})` : "linear-gradient(150deg,#241b33,#141420 70%)", display: "flex", alignItems: "flex-end", padding: "0.4rem 0.6rem" }}>
            {l.isCrimeScene ? <span style={{ ...stamp, margin: 0, fontSize: "0.7rem", background: "rgba(12,12,18,.8)" }}>🚨 CRIME SCENE</span> : null}
          </div>
          <div style={{ padding: "0.55rem 0.7rem" }}>
            <div style={{ ...typewriter, fontWeight: 800, color: "#ffd98a", letterSpacing: 1 }}>{l.name}</div>
            <p style={{ fontSize: "0.8rem", fontStyle: "italic", opacity: 0.85, margin: "0.25rem 0" }}>{l.description}</p>
            <small style={typewriter}>{l.cluesTotal ? `Evidence found: ${l.cluesFound || 0} of ${l.cluesTotal}` : "Nothing to find here"}</small>
          </div>
        </div>;
      })}
    </div>
  </div>;

  // Inside a location: the scene itself fills the view. No dashboards, no
  // lists — a spyglass cursor, and the room's clickable items glow under it.
  if (o.kind === "location") {
    const loc = o.location!;
    const img = loc.imageKey ? assets.find(a => (a.storageKey || a.name) === loc.imageKey && a.url) : undefined;
    const clues = o.clues || [];
    return <div style={{ ...noir, padding: 0, overflow: "hidden" }}>
      <style>{`@keyframes ccss-reveal{from{opacity:0}to{opacity:1}}.ccss-spot{transition:box-shadow .2s ease,background .2s ease}.ccss-spot:hover{box-shadow:0 0 0 3px #ffd98a,0 0 26px rgba(255,217,138,.8);background:rgba(255,217,138,.28)}.ccss-spot .ccss-spot-label{opacity:0;transition:opacity .2s ease}.ccss-spot:hover .ccss-spot-label{opacity:1}`}</style>
      <div style={{ position: "relative", minHeight: 380, cursor: spyglassCursor, background: img ? `center/cover url(${img.url})` : "linear-gradient(160deg,#191324 0%,#0c0c12 70%)", animation: "ccss-reveal .8s ease-out" }}>
        {clues.map((c, i) => {
          const x = typeof c.hotspotX === "number" ? c.hotspotX : 12 + ((i * 29) % 72);
          const y = typeof c.hotspotY === "number" ? c.hotspotY : 26 + ((i * 19) % 48);
          return <div key={c.id} className="ccss-spot" title={c.hotspot || c.title} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", width: 54, height: 54, borderRadius: "50%", border: c.revealed ? "2px solid #ffd98a" : "2px dashed rgba(255,217,138,.65)", background: c.revealed ? "rgba(214,170,88,.35)" : "rgba(20,20,32,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "1.3rem" }}>{c.revealed ? "📌" : "🔍"}</span>
            <span className="ccss-spot-label" style={{ position: "absolute", top: "110%", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "rgba(12,12,18,.92)", border: "1px solid #d6aa58", borderRadius: 6, padding: "0.15rem 0.5rem", ...typewriter, fontSize: "0.75rem", color: "#ffd98a" }}>{c.revealed ? c.title : (c.hotspot || "Something to examine")}</span>
          </div>;
        })}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(transparent,rgba(12,12,18,.94) 45%)", padding: "2.2rem 1.25rem 0.9rem" }}>
          <div style={{ ...typewriter, letterSpacing: 2, color: "#ffd98a", fontSize: "1.25rem", fontWeight: 800 }}>{loc.name}{loc.isCrimeScene ? " 🚨" : ""}</div>
          <p style={{ fontStyle: "italic", opacity: 0.9, margin: "0.25rem 0" }}>{loc.description}</p>
          {o.keyWitness && <p style={{ ...typewriter, fontSize: "0.8rem", opacity: 0.85, margin: "0.25rem 0" }}>🎤 {o.keyWitness.name}{o.keyWitness.role ? ` — ${o.keyWitness.role}` : ""} was here. Their account matters.</p>}
        </div>
      </div>
    </div>;
  }

  if (o.kind === "clue") {
    const videoKey = o.clue?.cutSceneVideoKey;
    const video = videoKey ? assets.find(a => (a.storageKey || a.name) === videoKey && a.url) : undefined;
    const audio = o.clue?.audioKey ? assets.find(a => (a.storageKey || a.name) === o.clue!.audioKey && a.url) : undefined;
    return <Frame kicker="★ CLUE DISCOVERED ★" title={o.clue?.title || "Clue"}>
      {video && <div style={{ margin: "0 0 0.75rem", border: "2px solid #d6aa58", borderRadius: 8, overflow: "hidden", background: "#000" }}>
        <video src={video.url} autoPlay muted playsInline style={{ width: "100%", display: "block" }} />
      </div>}
      {o.clue?.hotspot && <p style={{ ...typewriter, opacity: 0.8, fontSize: "0.85rem" }}>Found: {o.clue.hotspot}</p>}
      <p style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>{o.clue?.description}</p>
      {audio && <audio src={audio.url} controls autoPlay style={{ width: "100%", marginTop: "0.5rem" }} />}
      <p style={{ ...typewriter, opacity: 0.7, fontSize: "0.8rem" }}>Logged to the detective's case notes.</p>
    </Frame>;
  }

  if (o.kind === "flashback") {
    const fb = o.flashback!;
    const video = fb.videoKey ? assets.find(a => (a.storageKey || a.name) === fb.videoKey && a.url) : undefined;
    return <div style={{ ...noir, textAlign: "center" }}>
      <div style={tape}>◉ CRIME FLASHBACK ◉</div>
      <div style={{ width: "min(72%,720px)", margin: "1rem auto", border: "3px solid #d6aa58", borderRadius: 8, overflow: "hidden", background: "#000", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {video ? <video src={video.url} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
          <div><div style={{ fontSize: "3rem" }}>🎞️</div><div style={{ ...typewriter, letterSpacing: 3, color: "#ffd98a" }}>{fb.title.toUpperCase()}</div><small style={{ opacity: 0.6 }}>(flashback video plays here)</small></div>}
      </div>
      <h2 style={{ ...typewriter, letterSpacing: 2, color: "#ffd98a" }}>{fb.title}</h2>
      {fb.description && <p style={{ fontStyle: "italic", maxWidth: 640, margin: "0.5rem auto", lineHeight: 1.6 }}>{fb.description}</p>}
    </div>;
  }

  if (o.kind === "suspect") {
    const s = o.suspect!;
    const video = s.guideVideoKey ? assets.find(a => (a.storageKey || a.name) === s.guideVideoKey && a.url) : undefined;
    return <div style={{ ...noir, textAlign: "center" }}>
      <div style={tape}>SUSPECT FILE · NOW ENTERING THE INVESTIGATION</div>
      <div style={{ width: "min(56%,520px)", margin: "1rem auto", border: "3px solid #d6aa58", borderRadius: 8, overflow: "hidden", background: "#000", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {video ? <video src={video.url} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
          <div><div style={{ fontSize: "3rem" }}>🕵️</div><div style={{ ...typewriter, letterSpacing: 3, color: "#ffd98a" }}>{s.name.toUpperCase()}</div><small style={{ opacity: 0.6 }}>(character guide video plays here)</small></div>}
      </div>
      <div style={{ ...typewriter, textAlign: "left", borderTop: "1px solid #d6aa58", paddingTop: "0.75rem" }}>
        <p><strong style={{ color: "#ffd98a" }}>SUBJECT:</strong> {s.name}{s.occupation ? ` — ${s.occupation}` : ""}</p>
        {[s.age, s.gender, s.ethnicity].filter(x => String(x || "").trim()).length > 0 && <p><strong style={{ color: "#ffd98a" }}>DESCRIPTION:</strong> {[s.age, s.gender, s.ethnicity].filter(x => String(x || "").trim()).join(" · ")}</p>}
        {s.knownFor && <p><strong style={{ color: "#ffd98a" }}>KNOWN FOR:</strong> {s.knownFor}</p>}
        {s.personality && <p><strong style={{ color: "#ffd98a" }}>PERSONALITY:</strong> {s.personality}</p>}
        <p><strong style={{ color: "#ffd98a" }}>PROFILE:</strong> {s.characterBrief}</p>
        {s.quote && <p style={{ fontStyle: "italic" }}>“{s.quote}”</p>}
        <p><strong style={{ color: "#ffd98a" }}>WHY THEY LOOK GUILTY:</strong> {s.potentialMotive}</p>
        <p><strong style={{ color: "#ffd98a" }}>ALIBI:</strong> {s.alibi}</p>
        {!!(o.keyEvidence || []).length && <>
          <p><strong style={{ color: "#ffd98a" }}>KEY EVIDENCE:</strong></p>
          <ul>{(o.keyEvidence || []).map(k => <li key={k.clueId} style={{ margin: "0.3rem 0" }}><strong>{k.title}:</strong> {k.summary}</li>)}</ul>
        </>}
      </div>
    </div>;
  }

  if (o.kind === "questioned") return <Frame kicker="INTERROGATION COMPLETE" title={o.suspect?.name || "Suspect"}>
    <div style={{ ...stamp, borderColor: "#7dff9a", color: "#7dff9a" }}>ON THE RECORD</div>
    <p style={{ ...typewriter, fontSize: "1.1rem" }}>{o.suspect?.name}&apos;s interrogation is complete — their statement is logged in the detective&apos;s case notes.</p>
  </Frame>;

  if (o.kind === "witnessHeard") return <Frame kicker="🎤 WITNESS STATEMENT" title={o.witness?.name || "Witness"}>
    <p style={typewriter}>{o.witness?.role}</p>
    <div style={stamp}>WHAT THEY SAW</div>
    <p style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>{o.witness?.statement}</p>
  </Frame>;

  if (o.kind === "evidence") return <Frame kicker="EVIDENCE BOARD" title="What the detective has found">
    {!(o.clues || []).length && <p style={typewriter}>No clues revealed yet.</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0.75rem" }}>
      {(o.clues || []).map(c => <div key={c.id} style={{ background: "#f5ecd7", color: "#2a2118", padding: "0.75rem", borderRadius: 4, transform: `rotate(${(c.id.length % 5) - 2}deg)`, boxShadow: "0 4px 10px rgba(0,0,0,.5)" }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#c0392b", margin: "0 auto 0.4rem" }} />
        <strong style={typewriter}>{c.title}</strong>
        <p style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}>{c.description}</p>
        {c.locationName && <small style={typewriter}>📍 {c.locationName}</small>}
      </div>)}
    </div>
  </Frame>;

  if (o.kind === "arrest") return <Frame kicker="🚨 ARREST 🚨" title="The detective makes the call">
    <div style={{ ...stamp, fontSize: "1.4rem" }}>UNDER ARREST</div>
    <p style={{ fontSize: "1.6rem", ...typewriter, color: "#ffd98a" }}>{o.suspect?.name}</p>
    <p style={{ fontStyle: "italic" }}>{o.suspect?.characterBrief}</p>
  </Frame>;

  if (o.kind === "verdict") return <Frame kicker={o.correct ? "✅ VERDICT" : "❌ VERDICT"} title={`The accusation: ${o.suspect?.name || "the accused"}`}>
    {o.correct
      ? <><div style={{ ...stamp, borderColor: "#7dff9a", color: "#7dff9a", fontSize: "1.5rem" }}>CORRECT</div><p style={{ ...typewriter, fontSize: "1.1rem" }}>The evidence holds. This case goes to trial.</p></>
      : <><div style={{ ...stamp, fontSize: "1.5rem" }}>WRONG SUSPECT</div><p style={{ ...typewriter, fontSize: "1.1rem" }}>The evidence falls apart. The real culprit walks free… this time.</p></>}
  </Frame>;

  if (o.kind === "courtroom") return <Frame kicker="COURT IS IN SESSION" title={`The People vs. ${o.defendant?.name || "the accused"}`}>
    <p style={typewriter}>The host presides as judge. The audience is the jury — vote in the TikTok poll.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <div><div style={stamp}>PROSECUTION</div><ul style={typewriter}>{(o.pointingAt || []).map(c => <li key={c.id} style={{ margin: "0.4rem 0" }}><strong>{c.title}</strong><br /><small>{c.description}</small></li>)}</ul>{!(o.pointingAt || []).length && <p style={typewriter}>—</p>}</div>
      <div><div style={{ ...stamp, borderColor: "#2980b9", color: "#2980b9" }}>DEFENSE</div><ul style={typewriter}>{(o.pointedElsewhere || []).map(c => <li key={c.id} style={{ margin: "0.4rem 0" }}><strong>{c.title}</strong><br /><small>{c.description}</small></li>)}</ul>{!(o.pointedElsewhere || []).length && <p style={typewriter}>—</p>}</div>
    </div>
    {o.courtroomSeconds ? <p style={{ ...typewriter, textAlign: "center" }}>⏱ Each side has {Math.floor(o.courtroomSeconds / 60)}:{String(o.courtroomSeconds % 60).padStart(2, "0")} to argue.</p> : null}
  </Frame>;

  if (o.kind === "witness") {
    // Generated media wins over the host's uploaded reference: the intro
    // video first, then the generated portrait, then the uploaded media.
    const mediaKey = [o.witness?.videoKey, o.witness?.portraitKey, o.witness?.mediaKey].find(k => k && assets.some(a => (a.storageKey || a.name) === k && a.url));
    const media = mediaKey ? assets.find(a => (a.storageKey || a.name) === mediaKey && a.url) : undefined;
    const looksVideo = !!media && /video|\.mp4|\.webm|\.mov|\.m4v/i.test(`${media.type} ${media.name}`);
    return <Frame kicker="🔓 WITNESS UNLOCKED" title={o.witness?.name || "Witness"}>
      <p style={typewriter}>{o.witness?.role}</p>
      {media && (looksVideo
        ? <video src={media.url} autoPlay muted playsInline style={{ width: "min(100%,520px)", display: "block", margin: "0.5rem auto", border: "2px solid #d6aa58", borderRadius: 8 }} />
        : <img src={media.url} alt={o.witness?.name || "Witness"} style={{ width: "min(100%,520px)", display: "block", margin: "0.5rem auto", border: "2px solid #d6aa58", borderRadius: 8 }} />)}
      <p style={{ fontStyle: "italic" }}>{o.witness?.description}</p>
      <div style={stamp}>WHAT THEY SAW</div>
      <p style={{ fontSize: "1.1rem" }}>{o.witness?.info}</p>
    </Frame>;
  }

  return null;
}
