"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameTool, Project } from "../lib/project";
import { deckTracks, freshDjState, walkDjPlayback, type DjState, type DjTrack } from "../lib/dj-deck";
import "./audio-tools.css";

// The DJ Deck's overlay side. The ENGINE is the show's music player:
// it follows the shared deck state (lib/dj-deck.ts) — the dashboard
// only sends commands — and plays the project's own songs from THIS
// page, because the overlay page is where the audience's audio comes
// from. Two audio elements carry a merge: the incoming track fades
// up while the outgoing one fades down. The engine runs whether or
// not the deck's face was placed on the overlay; the FACE
// (DjDeckVisual) is the separate, optional visual that shows the
// current track's name when the creator placed the deck.

/** Measure the deck tracks' durations from their files' metadata,
 *  so positions can walk across track ends (see walkDjPlayback). A
 *  duration the real audio corrects at its end (metadata can
 *  overstate) is replaced through correctDuration. */
export function useDjDurations(tracks: DjTrack[]) {
  const [durations, setDurations] = useState<Record<string, number>>({});
  const attempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    for (const track of tracks) {
      if (attempted.current.has(track.key)) continue;
      attempted.current.add(track.key);
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = track.url;
      probe.onloadedmetadata = () => {
        if (!cancelled && Number.isFinite(probe.duration) && probe.duration > 0) {
          setDurations(d => (d[track.key] != null ? d : { ...d, [track.key]: probe.duration }));
        }
      };
    }
    return () => { cancelled = true; };
  }, [tracks]);
  const correctDuration = useCallback((key: string, seconds: number) => {
    if (seconds > 0) setDurations(d => (d[key] === seconds ? d : { ...d, [key]: seconds }));
  }, []);
  return { durations, correctDuration };
}

export function DjDeckVisual({ tool, project, state, preview = false }: { tool: GameTool; project?: Project; state?: DjState | null; preview?: boolean }) {
  const tracks = useMemo(() => (project ? deckTracks(project, tool) : []), [project, tool]);
  const title = String(tool.config.title || tool.name || "DJ Deck");
  const accent = String((tool.config.appearance as Record<string, unknown> | undefined)?.accentColor || "#f5c542");
  const shown = state || freshDjState();
  const current = preview
    ? tracks[0]
    : tracks.find(t => t.key === shown.trackKey) || tracks[0];
  const status = preview
    ? "Your music, played live"
    : shown.fade && shown.status === "playing"
      ? "Merging"
      : shown.status === "playing"
        ? "Now playing"
        : shown.status === "paused"
          ? "Paused"
          : "Ready";
  return <div className="dj-face" style={{ border: `2px solid ${accent}` }}>
    <div className="dj-face-title" style={{ color: accent }}>{title}</div>
    <div className="dj-face-track">{current ? current.name : "No songs on the deck yet"}</div>
    <div className="dj-face-status">{status}</div>
  </div>;
}

export function DjDeckEngine({ project, tool, state }: { project: Project; tool: GameTool; state?: DjState | null }) {
  const tracks = useMemo(() => deckTracks(project, tool), [project, tool]);
  const { durations, correctDuration } = useDjDurations(tracks);
  const stateRef = useRef(state || freshDjState());
  stateRef.current = state || freshDjState();
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;
  const mainRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<HTMLAudioElement | null>(null);
  const loadedKey = useRef<string | null>(null);
  const fadeLoadedKey = useRef<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const sync = () => {
      const main = mainRef.current;
      const fadeEl = fadeRef.current;
      if (!main) return;
      const st = stateRef.current;
      const list = tracksRef.current;
      if (!list.length) {
        if (!main.paused) main.pause();
        if (fadeEl && !fadeEl.paused) fadeEl.pause();
        return;
      }
      const target = walkDjPlayback(st, list.map(t => ({ key: t.key, duration: durationsRef.current[t.key] })), Date.now());
      if (target.status === "stopped" || target.status === "ended" || target.index < 0) {
        if (!main.paused) main.pause();
        if (fadeEl && !fadeEl.paused) fadeEl.pause();
        if (target.status === "stopped") {
          // Cue the deck's chosen track at zero, paused, so Play
          // starts instantly.
          const cue = list.find(t => t.key === st.trackKey) || list[0];
          if (cue && loadedKey.current !== cue.key) { main.src = cue.url; loadedKey.current = cue.key; }
          if (loadedKey.current === cue?.key && main.currentTime > 0.05 && !main.seeking) { try { main.currentTime = 0; } catch { /* not ready */ } }
        }
        return;
      }
      const current = list[target.index];
      if (loadedKey.current !== current.key) {
        main.src = current.url;
        loadedKey.current = current.key;
        try { main.currentTime = target.position; } catch { /* not ready */ }
        if (target.status === "playing") void main.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      } else {
        if (Math.abs(main.currentTime - target.position) > 2.5 && !main.seeking) { try { main.currentTime = target.position; } catch { /* not ready */ } }
        if (target.status === "playing" && main.paused) void main.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
        if (target.status === "paused" && !main.paused) main.pause();
      }
      if (target.fade && fadeEl) {
        const from = list[target.fade.fromIndex];
        main.volume = target.fade.progress;
        if (from) {
          if (fadeLoadedKey.current !== from.key) {
            fadeEl.src = from.url;
            fadeLoadedKey.current = from.key;
            try { fadeEl.currentTime = target.fade.fromPosition; } catch { /* not ready */ }
            if (fadeEl.paused) void fadeEl.play().catch(() => {});
          } else if (Math.abs(fadeEl.currentTime - target.fade.fromPosition) > 2.5 && !fadeEl.seeking) {
            try { fadeEl.currentTime = target.fade.fromPosition; } catch { /* not ready */ }
          }
          fadeEl.volume = 1 - target.fade.progress;
        }
      } else {
        main.volume = 1;
        if (fadeEl && !fadeEl.paused) fadeEl.pause();
        fadeLoadedKey.current = null;
      }
    };
    sync();
    const timer = setInterval(sync, 250);
    return () => clearInterval(timer);
  }, []);

  const handleEnded = () => {
    // The track ended before the walk expected it (its metadata
    // overstated the length): correct the duration so the walk —
    // and every view — moves the show to the next song now.
    const key = loadedKey.current;
    const el = mainRef.current;
    if (key && el && el.currentTime > 0) correctDuration(key, el.currentTime);
  };
  const enableAudio = () => {
    const st = stateRef.current;
    if (st.status === "playing") {
      void mainRef.current?.play().then(() => setBlocked(false)).catch(() => {});
      if (st.fade) void fadeRef.current?.play().catch(() => {});
    }
  };
  return <>
    <audio ref={mainRef} preload="auto" onEnded={handleEnded} />
    <audio ref={fadeRef} preload="auto" />
    {blocked && <button type="button" onClick={enableAudio} style={{ position: "absolute", left: "30%", top: "80%", zIndex: 60 }}>Enable audio</button>}
  </>;
}
