"use client";
import type { CSSProperties } from "react";
import type { GameTool, ProjectAsset } from "../lib/project";

/**
 * Public overlay for City Crime Scene. Renders ONLY from the live-event outcome
 * JSON plus the sanitized public tool config. It must never read isGuilty,
 * actualCrimeDetails, twists, demeanor, tells, extraInfo, or question lists —
 * those fields are stripped before this component ever sees them.
 */

type Outcome = {
  kind: "briefing" | "location" | "clue" | "suspect" | "evidence" | "arrest" | "courtroom" | "witness" | "hide";
  title?: string; premise?: string; crime?: string; victim?: string;
  witnessStatements?: string[];
  location?: { id: string; name: string; description: string; imagePrompt?: string };
  clues?: { id: string; title: string; revealed?: boolean; description?: string; locationName?: string }[];
  clue?: { id: string; title: string; description: string; cutScenePrompt?: string };
  suspect?: { id: string; name: string; characterBrief?: string; potentialMotive?: string; alibi?: string; guideVideoPrompt?: string; guideVideoKey?: string };
  witness?: { id: string; name: string; role?: string; description?: string; info?: string };
  defendant?: { id: string; name: string };
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
  </Frame>;

  if (o.kind === "location") return <Frame kicker="INVESTIGATION" title={o.location?.name || "Location"}>
    <p style={{ fontStyle: "italic" }}>{o.location?.description}</p>
    <div style={stamp}>CLUES AT THIS SCENE</div>
    <ul style={{ listStyle: "none", padding: 0 }}>{(o.clues || []).map(c => <li key={c.id} style={{ ...typewriter, margin: "0.5rem 0", padding: "0.5rem", border: "1px dashed #d6aa58", opacity: c.revealed ? 1 : 0.55 }}>{c.revealed ? `📌 ${c.title}` : "❓ Undiscovered clue"}</li>)}</ul>
  </Frame>;

  if (o.kind === "clue") return <Frame kicker="★ CLUE DISCOVERED ★" title={o.clue?.title || "Clue"}>
    <p style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>{o.clue?.description}</p>
    <p style={{ ...typewriter, opacity: 0.7, fontSize: "0.8rem" }}>Logged to the detective's case notes.</p>
  </Frame>;

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
        <p><strong style={{ color: "#ffd98a" }}>SUBJECT:</strong> {s.name}</p>
        <p><strong style={{ color: "#ffd98a" }}>PROFILE:</strong> {s.characterBrief}</p>
        <p><strong style={{ color: "#ffd98a" }}>WHY THEY LOOK GUILTY:</strong> {s.potentialMotive}</p>
        <p><strong style={{ color: "#ffd98a" }}>ALIBI:</strong> {s.alibi}</p>
      </div>
    </div>;
  }

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

  if (o.kind === "courtroom") return <Frame kicker="COURT IS IN SESSION" title={`The People vs. ${o.defendant?.name || "the accused"}`}>
    <p style={typewriter}>The host presides as judge. The audience is the jury — vote in the TikTok poll.</p>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      <div><div style={stamp}>PROSECUTION</div><ul style={typewriter}>{(o.pointingAt || []).map(c => <li key={c.id} style={{ margin: "0.4rem 0" }}><strong>{c.title}</strong><br /><small>{c.description}</small></li>)}</ul>{!(o.pointingAt || []).length && <p style={typewriter}>—</p>}</div>
      <div><div style={{ ...stamp, borderColor: "#2980b9", color: "#2980b9" }}>DEFENSE</div><ul style={typewriter}>{(o.pointedElsewhere || []).map(c => <li key={c.id} style={{ margin: "0.4rem 0" }}><strong>{c.title}</strong><br /><small>{c.description}</small></li>)}</ul>{!(o.pointedElsewhere || []).length && <p style={typewriter}>—</p>}</div>
    </div>
    {o.courtroomSeconds ? <p style={{ ...typewriter, textAlign: "center" }}>⏱ Each side has {Math.floor(o.courtroomSeconds / 60)}:{String(o.courtroomSeconds % 60).padStart(2, "0")} to argue.</p> : null}
  </Frame>;

  if (o.kind === "witness") return <Frame kicker="🔓 WITNESS UNLOCKED" title={o.witness?.name || "Witness"}>
    <p style={typewriter}>{o.witness?.role}</p>
    <p style={{ fontStyle: "italic" }}>{o.witness?.description}</p>
    <div style={stamp}>WHAT THEY SAW</div>
    <p style={{ fontSize: "1.1rem" }}>{o.witness?.info}</p>
  </Frame>;

  return null;
}
