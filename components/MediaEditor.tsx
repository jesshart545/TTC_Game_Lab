"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectAsset, ProjectAssetEdits } from "../lib/project";

const CROP_OPTIONS: Array<{ id: NonNullable<ProjectAssetEdits["crop"]>; label: string; ratio?: string }> = [
  { id: "original", label: "Original" },
  { id: "square", label: "Square", ratio: "1:1" },
  { id: "landscape", label: "Landscape", ratio: "16:9" },
  { id: "portrait", label: "Portrait", ratio: "9:16" },
];

function isVideo(asset: ProjectAsset) {
  const type = asset.type.toLowerCase();
  return type.includes("video") || type.includes("mp4") || asset.name.toLowerCase().match(/\.(mp4|webm|mov|m4v)$/i);
}

function ratioStyle(crop: ProjectAssetEdits["crop"]) {
  if (crop === "square") return { aspectRatio: "1 / 1" };
  if (crop === "landscape") return { aspectRatio: "16 / 9" };
  if (crop === "portrait") return { aspectRatio: "9 / 16" };
  return { aspectRatio: "16 / 9" };
}

export default function MediaEditor({
  asset,
  onSave,
  onClose,
}: {
  asset: ProjectAsset;
  onSave: (asset: ProjectAsset) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = isVideo(asset);
  const [name, setName] = useState(asset.name);
  const [crop, setCrop] = useState<NonNullable<ProjectAssetEdits["crop"]>>(asset.edits?.crop || "original");
  const [trimStart, setTrimStart] = useState(Math.max(0, Number(asset.edits?.trimStart || 0)));
  const [trimEnd, setTrimEnd] = useState(Number(asset.edits?.trimEnd || 0));
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const effectiveEnd = useMemo(() => {
    if (!video || !duration) return 0;
    const requested = Number(trimEnd);
    return requested > 0 ? Math.min(requested, duration) : duration;
  }, [duration, trimEnd, video]);

  useEffect(() => {
    if (!video || !videoRef.current || effectiveEnd <= trimStart) return;
    const player = videoRef.current;
    const target = currentTime < trimStart || currentTime > effectiveEnd ? trimStart : currentTime;
    if (Math.abs(player.currentTime - target) > 0.15) player.currentTime = target;
  }, [trimStart, effectiveEnd, currentTime, video]);

  function apply() {
    const edits: ProjectAssetEdits = { crop };
    if (video) {
      edits.trimStart = Math.max(0, Math.min(trimStart, Math.max(0, duration - 0.05)));
      if (effectiveEnd > edits.trimStart + 0.05 && effectiveEnd < duration - 0.05) edits.trimEnd = effectiveEnd;
      else if (effectiveEnd >= duration - 0.05) edits.trimEnd = undefined;
    }
    onSave({ ...asset, name: name.trim() || asset.name, edits });
    onClose();
  }

  return (
    <div className="media-editor-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${asset.name}`}>
      <div className="media-editor-modal">
        <div className="media-editor-head">
          <div><small>MEDIA EDITOR</small><h2>Edit asset</h2></div>
          <button className="media-editor-close" onClick={onClose} aria-label="Close editor">×</button>
        </div>

        <div className="media-editor-preview-wrap">
          <div className={`media-editor-preview crop-${crop}`} style={crop === "original" ? undefined : ratioStyle(crop)}>
            {video ? (
              <video
                ref={videoRef}
                src={asset.url}
                controls
                onLoadedMetadata={e => {
                  const d = e.currentTarget.duration;
                  setDuration(Number.isFinite(d) ? d : 0);
                  if (!trimEnd || trimEnd > d) setTrimEnd(d);
                }}
                onTimeUpdate={e => {
                  const t = e.currentTarget.currentTime;
                  setCurrentTime(t);
                  if (effectiveEnd && t >= effectiveEnd) {
                    e.currentTarget.currentTime = trimStart;
                    e.currentTarget.pause();
                  }
                  if (t < trimStart) e.currentTarget.currentTime = trimStart;
                }}
              />
            ) : (
              <img src={asset.url} alt={asset.name} />
            )}
          </div>
          <p className="media-editor-note">Crop is applied to how the asset is displayed in TTCGameLab. Video trim controls the playback segment.</p>
        </div>

        <div className="media-editor-fields">
          <label><span>Asset name</span><input value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="media-editor-field"><span>CROP / ASPECT</span><div className="media-editor-options">{CROP_OPTIONS.map(option => <button key={option.id} type="button" className={crop === option.id ? "selected" : ""} onClick={() => setCrop(option.id)}>{option.label}{option.ratio ? <small>{option.ratio}</small> : null}</button>)}</div></div>
          {video && <div className="media-editor-field"><span>TRIM VIDEO</span><div className="media-editor-trim"><label>Start<input type="number" min="0" max={Math.max(0, duration)} step="0.1" value={trimStart} onChange={e => setTrimStart(Number(e.target.value || 0))} /></label><label>End<input type="number" min="0.1" max={Math.max(0.1, duration)} step="0.1" value={effectiveEnd || trimEnd || 0} onChange={e => setTrimEnd(Number(e.target.value || 0))} /></label><span>{duration ? `${duration.toFixed(1)}s total` : "Loading duration…"}</span></div></div>}
        </div>

        <div className="media-editor-actions"><button className="outline-btn" onClick={onClose}>Cancel</button><button className="build-btn" onClick={apply}>Save edits</button></div>
      </div>
    </div>
  );
}
