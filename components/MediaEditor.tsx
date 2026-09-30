"use client";

import { useState } from "react";
import { ProjectAsset, ProjectAssetEdits } from "../lib/project";

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
  const [edits, setEdits] = useState<ProjectAssetEdits>(asset.edits || {});
  const [duration,setDuration] = useState(0);
  const update=(patch:Partial<ProjectAssetEdits>)=>setEdits(value=>({...value,...patch}));
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

  async function saveCopy() {
    if(working || !onSaveAsNew)return;
    setWorking(true);setError("");
    try {await onSaveAsNew({...asset,edits});onClose();}catch(e){setError(e instanceof Error?e.message:"Could not save the edited copy.");}finally{setWorking(false);}
  }
  const style={transform:`translate(${edits.offsetX || 0}px,${edits.offsetY || 0}px) scale(${edits.zoom || 1}) rotate(${edits.rotation || 0}deg) scaleX(${edits.flipX?-1:1}) scaleY(${edits.flipY?-1:1})`,opacity:edits.opacity??1,filter:`brightness(${edits.brightness??100}%) contrast(${edits.contrast??100}%) saturate(${edits.saturation??100}%)`};
  return <div className="media-editor-backdrop" role="dialog" aria-modal="true">
    <div className="media-editor-modal">
      <div className="media-editor-head">
        <div><small>EDIT ASSET</small><h2>Crop, adjust or request an AI edit.</h2></div>
        <button className="media-editor-close" onClick={onClose}>×</button>
      </div>
      <div className="media-editor-preview-wrap">
        <div className="media-editor-preview" style={{overflow:"hidden",aspectRatio:edits.crop==="square"?"1":edits.crop==="portrait"?"9/16":edits.crop==="landscape"?"16/9":undefined}}>
          {video ? <video src={asset.url} controls style={style} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onPlay={e=>{if(e.currentTarget.currentTime<(edits.trimStart || 0))e.currentTarget.currentTime=edits.trimStart || 0;}} onTimeUpdate={e=>{if(edits.trimEnd && e.currentTarget.currentTime>=edits.trimEnd)e.currentTarget.pause();}} /> : <img src={asset.url} alt={asset.name} style={style}/>}
        </div>
      </div>
      <div className="media-editor-fields">
        <fieldset disabled={working} style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,padding:16}}>
          <legend>Direct edits · save as a new copy</legend>
          {video ? <>
            <label>Trim start (seconds)<input type="number" min="0" max={duration || undefined} step=".1" value={edits.trimStart || 0} onChange={e=>update({trimStart:Math.max(0,Number(e.target.value))})}/></label>
            <label>Trim end (seconds)<input type="number" min=".1" max={duration || undefined} step=".1" value={edits.trimEnd || duration || ""} onChange={e=>update({trimEnd:Number(e.target.value)})}/></label>
          </> : <>
            <label>Crop shape<select value={edits.crop || "original"} onChange={e=>update({crop:e.target.value as ProjectAssetEdits["crop"]})}><option value="original">Original</option><option value="square">Square</option><option value="landscape">Landscape · 16:9</option><option value="portrait">Portrait · 9:16</option></select></label>
            <label>Zoom<input type="number" min=".1" max="4" step=".1" value={edits.zoom || 1} onChange={e=>update({zoom:Math.max(.1,Math.min(4,Number(e.target.value)))})}/></label>
            <label>Rotation<input type="number" min="-360" max="360" value={edits.rotation || 0} onChange={e=>update({rotation:Number(e.target.value)})}/></label>
            <label>Brightness (%)<input type="number" min="0" max="200" value={edits.brightness ?? 100} onChange={e=>update({brightness:Number(e.target.value)})}/></label>
            <label>Contrast (%)<input type="number" min="0" max="200" value={edits.contrast ?? 100} onChange={e=>update({contrast:Number(e.target.value)})}/></label>
            <label>Color saturation (%)<input type="number" min="0" max="200" value={edits.saturation ?? 100} onChange={e=>update({saturation:Number(e.target.value)})}/></label>
            <label>Horizontal position<input type="number" value={edits.offsetX || 0} onChange={e=>update({offsetX:Number(e.target.value)})}/></label>
            <label>Vertical position<input type="number" value={edits.offsetY || 0} onChange={e=>update({offsetY:Number(e.target.value)})}/></label>
            <label><input type="checkbox" checked={Boolean(edits.flipX)} onChange={e=>update({flipX:e.target.checked})}/>Flip horizontally</label>
            <label><input type="checkbox" checked={Boolean(edits.flipY)} onChange={e=>update({flipY:e.target.checked})}/>Flip vertically</label>
          </>}
          <button type="button" disabled={working} onClick={()=>void saveCopy()}>{working?"Saving edit…":"Save edited copy"}</button>
        </fieldset>
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
