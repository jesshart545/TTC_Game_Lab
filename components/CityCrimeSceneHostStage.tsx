"use client";
import { useEffect, useRef, useState } from "react";
import type { GameTool, ProjectAsset } from "../lib/project";
import CityCrimeSceneOverlay from "./CityCrimeSceneOverlay";
import {
  ccssStagePostBody, ccssStageMapAction, ccssStageHideAction, ccssStageInvestigateAction,
  latestCcssStageResult, ccssStageLocationIdFromResult, ccssStageKindFromResult,
  type CcssStageAction,
} from "../lib/city-crime-scene-stage";

/**
 * The HOST STAGE: the presented City Crime Scene scene, on the host's own
 * dashboard, in the host's own hands.
 *
 * It renders the exact component the audience overlay renders, fed by the
 * exact live-event feed the audience overlay consumes (init, then
 * since-cursor polling), so the host sees the identical picture the
 * audience sees, in lockstep. The one difference: in stage mode the map's
 * location cards and the scene's hotspots are real controls. The host
 * points the spyglass at the item the detective names and clicks the item
 * itself; the click POSTs the same cityCrimeSceneAction body, with the
 * same x-host-key header, that the host panel's labeled buttons send —
 * one server, one set of gates, two surfaces.
 *
 * The detective never touches this. The audience surface stays
 * display-only: this component exists solely behind the host key.
 */
export default function CityCrimeSceneHostStage({ tool, slug, hostKey, assets = [] }: { tool: GameTool; slug?: string; hostKey?: string; assets?: ProjectAsset[] }) {
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastLocationId, setLastLocationId] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Consume the same live feed the audience overlay consumes, and keep the
  // newest outcome for this tool — the stage transitions when the overlay
  // transitions, including transitions the host fires from the panel.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    let timer: number | undefined;
    let cursor = 0;
    let initialized = false;
    const apply = (next: string | null) => {
      if (!next) return;
      setResult(next);
      const locId = ccssStageLocationIdFromResult(next);
      if (locId) setLastLocationId(locId);
    };
    const poll = async () => {
      try {
        const url = `/api/live/${encodeURIComponent(slug)}?${initialized ? `since=${cursor}` : "init=1"}`;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Live event service unavailable.");
        const data = await response.json();
        if (cancelled) return;
        initialized = true;
        cursor = data.cursor;
        apply(latestCcssStageResult(data.events || [], tool.id));
      } catch { /* the next poll retries; a quiet stage is better than a noisy one */ }
      finally { if (!cancelled) timer = window.setTimeout(poll, 1000); }
    };
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [slug, tool.id]);

  async function fire(action: CcssStageAction) {
    if (busyRef.current) return;
    if (!slug || !hostKey) { setStatus("Open the private host dashboard link from the builder to work the stage."); return; }
    busyRef.current = true;
    setBusy(true); setStatus("");
    try {
      const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-host-key": hostKey },
        body: JSON.stringify(ccssStagePostBody(tool.id, action)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      // Apply the outcome at once; the feed delivers the same event a
      // moment later and the stage simply stays where it already is.
      if (data.outcome) {
        const next = JSON.stringify(data.outcome);
        setResult(next);
        const locId = ccssStageLocationIdFromResult(next);
        if (locId) setLastLocationId(locId);
      }
      const labels: Record<string, string> = { map: "Game map is live — the detective chooses where to go.", investigate: "Location is live — point the spyglass where the detective directs.", revealClue: "Clue revealed.", hide: "Overlay cleared." };
      setStatus(labels[action.kind] || "Sent.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Action failed."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const kind = ccssStageKindFromResult(result);
  const inLocation = kind === "location";

  return <section aria-label={`${tool.name} host stage`} style={{ border: "1px solid #555", borderRadius: 12, padding: "1rem", margin: "1rem 0" }}>
    <h3>🎭 {tool.name} · host stage</h3>
    <p><strong>The presented scene, in your hands.</strong> This is the picture your audience watches, live. The detective directs you out loud — you move the spyglass. Click a place on the map to enter it; inside a scene, click the glowing item itself to reveal its clue. Your host panel below remains available for everything else.</p>
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
      <button type="button" disabled={busy} onClick={() => void fire(ccssStageMapAction())}>🗺 Show the map</button>
      {lastLocationId && !inLocation && <button type="button" disabled={busy} onClick={() => void fire(ccssStageInvestigateAction(lastLocationId))}>↩ Back to the scene</button>}
      <button type="button" disabled={busy} onClick={() => void fire(ccssStageHideAction())}>Hide / clear</button>
    </div>
    {result
      ? <CityCrimeSceneOverlay tool={tool} result={result} assets={assets} interactive onStageAction={action => void fire(action)} />
      : <p style={{ opacity: 0.8 }}>Nothing is on the overlay yet. Send the map from here or from the host panel, then work the scene itself.</p>}
    {status && <p role="status">{status}</p>}
  </section>;
}
