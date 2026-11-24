"use client";
import { useState } from "react";
import type { GameTool, Project } from "../lib/project";
import { freshSoundBoardState, soundPadsOf, type SoundBoardAction, type SoundBoardState } from "../lib/sound-board";
import "./audio-tools.css";

// The Sound Board's host panel (Jessica, 2026-11-23): a grid of
// pads, one per sound the creator loaded onto the board. Tapping a
// pad fires its sound; tapping a sounding pad stops it. This panel
// sends instructions only — every sound plays on the overlay page
// (components/SoundBoardPlayer), never from the dashboard, because
// the overlay page is where the audience's audio comes from.
export function SoundBoardHostPanel({ tool, project, state, onCommand }: { tool: GameTool; project: Project; state?: SoundBoardState | null; onCommand: (toolId: string, action: SoundBoardAction, padId?: string) => Promise<void> | void }) {
  const [message, setMessage] = useState("");
  const pads = soundPadsOf(tool.config);
  const shown = state || freshSoundBoardState();
  const soundName = (assetKey: string) => project.assets.find(a => (a.storageKey || a.name) === assetKey)?.name || "Missing sound";
  const run = async (padId: string, playing: boolean) => {
    try { await onCommand(tool.id, playing ? "stop-pad" : "play-pad", padId); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sound board action failed."); }
  };
  return <section className="card-host sound-host" aria-label={`${tool.name} host controls`}>
    <h3>{tool.name}</h3>
    {!pads.length
      ? <p>No sounds on this board yet. Ask Jewel to fill the pads from your sounds, or add them in the board&apos;s editor.</p>
      : <div className="sound-pads">
        {pads.map(pad => {
          const playing = Boolean(shown.pads[pad.id]?.playing);
          return <button type="button" key={pad.id} className={playing ? "playing" : ""} aria-pressed={playing} onClick={() => void run(pad.id, playing)}>
            <span className="pad-label">{playing ? "⏹ " : "▶ "}{pad.label || "Sound"}</span>
            <span className="pad-sound">{soundName(pad.assetKey)}</span>
          </button>;
        })}
      </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
