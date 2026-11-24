"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameTool, Project } from "../lib/project";
import { freshSoundBoardState, soundPadsOf, type SoundBoardState } from "../lib/sound-board";
import "./audio-tools.css";

// The Sound Board's overlay side. The ENGINE plays the pads' sounds
// from THIS page — the overlay page is where the audience's audio
// comes from; the dashboard only sends the fire/stop instructions
// through the shared state (lib/sound-board.ts). Every pad gets its
// own audio element, so pads can sound together. The engine runs
// whether or not the board's face was placed on the overlay; the
// FACE (SoundBoardVisual) is the separate, optional visual showing
// the pad labels when the creator placed the board.

export function SoundBoardVisual({ tool, state, preview = false }: { tool: GameTool; state?: SoundBoardState | null; preview?: boolean }) {
  const pads = soundPadsOf(tool.config);
  const title = String(tool.config.title || tool.name || "Sound Board");
  const accent = String((tool.config.appearance as Record<string, unknown> | undefined)?.accentColor || "#f5c542");
  const shown = state || freshSoundBoardState();
  return <div className="sound-face" style={{ border: `2px solid ${accent}` }}>
    <div className="sound-face-title" style={{ color: accent }}>{title}</div>
    {pads.length
      ? <div className="sound-face-pads">{pads.map(pad => <span key={pad.id} className={"sound-face-pad" + (!preview && shown.pads[pad.id]?.playing ? " playing" : "")}>{pad.label || "Sound"}</span>)}</div>
      : <div className="dj-face-status">Add sounds to the pads</div>}
  </div>;
}

export function SoundBoardEngine({ project, tool, state }: { project: Project; tool: GameTool; state?: SoundBoardState | null }) {
  const pads = useMemo(() => soundPadsOf(tool.config), [tool.config]);
  const assetsByKey = useMemo(() => {
    const map = new Map<string, Project["assets"][number]>();
    for (const asset of project.assets || []) {
      const key = asset.storageKey || asset.name;
      if (!map.has(key)) map.set(key, asset);
    }
    return map;
  }, [project.assets]);
  const elements = useRef(new Map<string, HTMLAudioElement>());
  const lastNonce = useRef<Record<string, number>>({});
  const [blocked, setBlocked] = useState(false);
  const shown = state || freshSoundBoardState();

  useEffect(() => {
    for (const pad of pads) {
      const el = elements.current.get(pad.id);
      if (!el) continue;
      const padState = shown.pads[pad.id];
      const nonce = padState?.nonce ?? 0;
      if (lastNonce.current[pad.id] === nonce) continue;
      lastNonce.current[pad.id] = nonce;
      if (padState?.playing) {
        el.currentTime = 0;
        void el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      } else {
        el.pause();
        el.currentTime = 0;
      }
    }
  }, [shown, pads]);

  const enableAudio = () => {
    for (const pad of pads) {
      if (!shown.pads[pad.id]?.playing) continue;
      const el = elements.current.get(pad.id);
      if (el) void el.play().then(() => setBlocked(false)).catch(() => {});
    }
  };
  return <>
    {pads.map(pad => {
      const asset = assetsByKey.get(pad.assetKey);
      if (!asset?.url) return null;
      return <audio key={pad.id} ref={el => { if (el) elements.current.set(pad.id, el); else elements.current.delete(pad.id); }} src={asset.url} preload="auto" loop={asset.edits?.loop ?? false} />;
    })}
    {blocked && <button type="button" onClick={enableAudio} style={{ position: "absolute", left: "30%", top: "80%", zIndex: 60 }}>Enable audio</button>}
  </>;
}
