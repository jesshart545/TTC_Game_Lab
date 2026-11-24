"use client";
import { useEffect, useMemo, useState } from "react";
import type { GameTool, Project } from "../lib/project";
import { clampDjCrossfadeSeconds, deckTracks, freshDjState, walkDjPlayback, type DjAction, type DjState } from "../lib/dj-deck";
import { useDjDurations } from "./DjDeckPlayer";
import "./audio-tools.css";

// The DJ Deck's host panel (Jessica, 2026-11-23): the host runs the
// show's music from here — play, pause, previous, next, tap any song
// to play it, and MERGE to blend the song playing into the next one
// over the deck's crossfade. This panel sends instructions only:
// every sound plays on the overlay page (components/DjDeckPlayer),
// never from the dashboard. The now-playing readout walks the shared
// state across the songs' measured lengths, so it follows the show
// as songs end and the next ones begin.
export function DjDeckHostPanel({ tool, project, state, onCommand }: { tool: GameTool; project: Project; state?: DjState | null; onCommand: (toolId: string, action: DjAction, arg?: string) => Promise<void> | void }) {
  const tracks = useMemo(() => deckTracks(project, tool), [project, tool]);
  const { durations } = useDjDurations(tracks);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const shown = state || freshDjState();
  const playing = shown.status === "playing";
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [playing]);
  const walk = walkDjPlayback(shown, tracks.map(t => ({ key: t.key, duration: durations[t.key] })), now);
  const current = walk.index >= 0 ? tracks[walk.index] : undefined;
  const fadeSeconds = clampDjCrossfadeSeconds(tool.config.crossfadeSeconds);
  const run = async (action: DjAction, arg?: string) => {
    try { await onCommand(tool.id, action, arg); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Deck action failed."); }
  };
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  return <section className="card-host dj-host" aria-label={`${tool.name} host controls`}>
    <h3>{tool.name}</h3>
    {!tracks.length
      ? <p>No songs on this deck yet. Ask Jewel to build the deck from your music, or add songs in the deck&apos;s editor.</p>
      : <>
        <div className="dj-now">
          <span>On the deck <strong>{current ? current.name : "—"}</strong></span>
          <span>{walk.status === "ended" ? "Finished" : shown.status === "playing" ? (shown.fade ? "Merging" : "Playing") : shown.status === "paused" ? "Paused" : "Stopped"}</span>
          {current && durations[current.key] ? <span>{clock(walk.position)} / {clock(durations[current.key])}</span> : null}
        </div>
        <div className="dj-transport">
          <button type="button" onClick={() => void run("previous")} aria-label="Previous song">⏮ Prev</button>
          {shown.status === "playing"
            ? <button type="button" onClick={() => void run("pause")}>⏸ Pause</button>
            : <button type="button" onClick={() => void run("play")}>▶ Play</button>}
          <button type="button" onClick={() => void run("next")} aria-label="Next song">Next ⏭</button>
          <button type="button" onClick={() => void run("merge")} aria-label={`Merge into the next song over ${fadeSeconds} seconds`}>Merge ⤵ {fadeSeconds}s</button>
          <button type="button" onClick={() => void run("stop")} aria-label="Stop the deck">⏹ Stop</button>
        </div>
        <ol className="dj-tracks">
          {tracks.map((track, i) => <li key={track.key}><button type="button" className={i === walk.index ? "current" : ""} aria-current={i === walk.index || undefined} onClick={() => void run("play-track", track.key)}>{i + 1}. {track.name}{i === walk.index ? " · on the deck" : ""}</button></li>)}
        </ol>
      </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
