"use client";

import { useState } from "react";
import { ProjectAsset } from "../lib/project";

function isVideo(asset: ProjectAsset) {
  return asset.type.toLowerCase().includes("video") || /\.(mp4|webm|mov|m4v)$/i.test(asset.name);
}

export default function MediaEditor({ asset, onSaveAsNew, onClose }: {
  asset: ProjectAsset;
  onSave: (asset: ProjectAsset) => void;
  onSaveAsNew?: (asset: ProjectAsset) => Promise<void>;
  onClose: () => void;
}) {
  const video = isVideo(asset);
  const [prompt, setPrompt] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function editMedia() {
    if (!asset.url || !prompt.trim() || working) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(video ? "/api/edit-video" : "/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(video ? { prompt: prompt.trim(), videoUrl: asset.url } : { prompt: prompt.trim(), imageUrl: asset.url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "I couldn't make that edit.");
      if (!data.url) throw new Error("The image editor returned no image.");
      const next: ProjectAsset = {
        ...asset,
        name: (asset.name.replace(/\.[^.]+$/, "") || (video ? "video" : "image")) + (video ? "-edited.mp4" : "-edited.png"),
        type: video ? "video/mp4" : "image/png",
        url: data.url,
        storageKey: undefined,
        edits: undefined,
      };
      if (!onSaveAsNew) throw new Error("This project cannot save edited assets yet.");
      await onSaveAsNew(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "I couldn't make that edit.");
    } finally {
      setWorking(false);
    }
  }

  return <div className="media-editor-backdrop" role="dialog" aria-modal="true">
    <div className="media-editor-modal">
      <div className="media-editor-head">
        <div><small>EDIT ASSET WITH AI</small><h2>Tell me what you want changed.</h2></div>
        <button className="media-editor-close" onClick={onClose}>×</button>
      </div>
      <div className="media-editor-preview-wrap">
        <div className="media-editor-preview">
          {video ? <video src={asset.url} controls /> : <img src={asset.url} alt={asset.name} />}
        </div>
      </div>
      <div className="media-editor-fields">
        <div className="media-editor-ai">
          <span>WHAT SHOULD I CHANGE?</span>
          <div>
            <input autoFocus value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder={video ? "Example: cut off the first 3 seconds" : "Example: make it darker, remove the text, and add pink neon around the edges"}
              onKeyDown={e=>{ if(e.key==="Enter") void editMedia(); }} />
            <button type="button" disabled={!prompt.trim() || working} onClick={()=>void editMedia()}>
              {working ? "Making your edit…" : "Make this change"}
            </button>
          </div>
          <small>Describe the change naturally. The edited result is saved as a new asset so your original stays safe.</small>
          {error && <small className="media-editor-error">{error}</small>}
        </div>
      </div>
      <div className="media-editor-actions"><button className="outline-btn" onClick={onClose}>Cancel</button></div>
    </div>
  </div>;
}
