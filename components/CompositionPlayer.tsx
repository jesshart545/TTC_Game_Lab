"use client";

import { useEffect, useRef, useState } from "react";
import { AssetComposition, CompositionClip, OverlayResult, ProjectAsset } from "../lib/project";

export const defaultOverlayResult: OverlayResult = {
  x: 0, y: 0, width: 100, height: 100,
  entrance: "fade", exit: "fade", entranceSeconds: .3, exitSeconds: .3, layer: 10,
};

export default function CompositionPlayer({ composition, assets, startedAt, placement = defaultOverlayResult, onEnd }: {
  composition: AssetComposition; assets: ProjectAsset[]; startedAt: number;
  placement?: OverlayResult; onEnd: () => void;
}) {
  const [time, setTime] = useState(0);
  const media = useRef<Record<string, HTMLMediaElement | null>>({});
  useEffect(() => {
    const tick = () => setTime(Math.max(0, (Date.now() - startedAt) / 1000));
    tick(); const timer = window.setInterval(tick, 50);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  useEffect(() => { if (time >= composition.duration) onEnd(); }, [time, composition.duration, onEnd]);
  useEffect(() => {
    for (const clip of composition.clips) {
      const element = media.current[clip.id]; if (!element) continue;
      const active = time >= clip.start && time < clip.start + clip.duration;
      if (!active) { element.pause(); continue; }
      const progress = (time - clip.start) * (clip.playbackRate || 1);
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      const offset = (clip.trimStart || 0) + (clip.loop && duration > 0 ? progress % Math.max(.1, duration - (clip.trimStart || 0)) : progress);
      if (Math.abs(element.currentTime - offset) > .3) { try { element.currentTime = offset; } catch {} }
      const fadeIn = clip.fadeIn ? Math.min(1, (time - clip.start) / clip.fadeIn) : 1;
      const fadeOut = clip.fadeOut ? Math.min(1, (clip.start + clip.duration - time) / clip.fadeOut) : 1;
      element.volume = Math.max(0, Math.min(1, (clip.volume ?? 1) * fadeIn * fadeOut));
      element.playbackRate = clip.playbackRate || 1;
      if (element.paused) void element.play().catch(() => {});
    }
  }, [time, composition]);
  const source = (clip: CompositionClip) => assets.find(a => a.storageKey && a.storageKey === clip.storageKey)?.url || clip.url;
  const remaining = Math.max(0, composition.duration - time);
  const enter = Math.min(1, time / Math.max(.01, placement.entranceSeconds));
  const leave = Math.min(1, remaining / Math.max(.01, placement.exitSeconds));
  const entering = time < placement.entranceSeconds;
  const exiting = remaining < placement.exitSeconds;
  const mode = exiting ? placement.exit : entering ? placement.entrance : "none";
  const progress = exiting ? leave : enter;
  return <div className="composition-player" aria-label={composition.name} style={{ left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.width}%`, height: `${placement.height}%`, zIndex: placement.layer, opacity: mode === "fade" ? progress : 1, transform: mode === "zoom" ? `scale(${.6 + .4 * progress})` : mode === "slide" ? `translateY(${(1 - progress) * 100}%)` : undefined }}>
    {composition.clips.map(clip => {
      const url = source(clip); const active = time >= clip.start && time < clip.start + clip.duration;
      if (["voice", "music", "sfx"].includes(clip.track)) return url ? <audio key={clip.id} ref={el => { media.current[clip.id] = el; }} src={url} preload="auto" /> : null;
      if (clip.track === "video") return url ? <video key={clip.id} ref={el => { media.current[clip.id] = el; }} src={url} preload="auto" playsInline style={{ display: active ? "block" : "none" }} /> : null;
      if (!active) return null;
      if (clip.track === "visual") return url ? <img key={clip.id} src={url} alt={clip.assetName} /> : null;
      if (clip.track === "text") return <strong key={clip.id}>{clip.text}</strong>;
      if (clip.track === "effect") return <div key={clip.id} className="composition-effect">✦ {clip.effect}</div>;
      return null;
    })}
  </div>;
}
