"use client";

import { useRef, useState } from "react";
import { ProjectAsset, ProjectAssetEdits } from "../lib/project";
import { imageLayout, imageAspectRatio } from "../lib/image-layout";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [edits, setEdits] = useState<ProjectAssetEdits>(asset.edits || {});
  const [duration,setDuration] = useState(0);
  const [originalRatio,setOriginalRatio] = useState(16/9);
  const [sourceSize,setSourceSize] = useState({width:1920,height:1080});
  const layout=imageLayout(sourceSize.width,sourceSize.height,edits);
  const update=(patch:Partial<ProjectAssetEdits>)=>{setShowFullImage(false);setEdits(value=>({...value,...patch}));};
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
        body: JSON.stringify(video ? { prompt: prompt.trim(), videoUrl: asset.url } : { prompt: prompt.trim(), imageUrl: asset.url, aspectRatio: imageAspectRatio(edits) }),
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
        edits: video ? undefined : {width:layout.width,height:layout.height,fit:layout.fit},
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
  const previewRatio=showFullImage||video?originalRatio:layout.ratio;
  const cropped=!showFullImage&&layout.fit==="cover";
  const style={transform:`translate(${edits.offsetX || 0}px,${edits.offsetY || 0}px) scale(${edits.zoom || 1}) rotate(${edits.rotation || 0}deg) scaleX(${edits.flipX?-1:1}) scaleY(${edits.flipY?-1:1})`,opacity:edits.opacity??1,filter:`brightness(${edits.brightness??100}%) contrast(${edits.contrast??100}%) saturate(${edits.saturation??100}%)`};
  return <div className="media-editor-backdrop" role="dialog" aria-modal="true">
    <div className="media-editor-modal" ref={modalRef}>
      <div className="media-editor-head">
        <div><small>EDIT ASSET</small><h2>Crop, adjust or request an AI edit.</h2></div>
        <button className="media-editor-close" onClick={onClose}>×</button>
      </div>
      <div className="media-editor-preview-wrap">
        <div className={`media-editor-preview ${cropped?"crop-selected":"crop-original"}`} style={{aspectRatio:previewRatio,width:`min(100%, ${previewRatio*48}vh)`}}>
          {video ? <video src={asset.url} controls style={style} onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);if(e.currentTarget.videoWidth&&e.currentTarget.videoHeight)setOriginalRatio(e.currentTarget.videoWidth/e.currentTarget.videoHeight);}} onPlay={e=>{if(e.currentTarget.currentTime<(edits.trimStart || 0))e.currentTarget.currentTime=edits.trimStart || 0;}} onTimeUpdate={e=>{if(edits.trimEnd && e.currentTarget.currentTime>=edits.trimEnd)e.currentTarget.pause();}} /> : <img src={asset.url} alt={asset.name} style={showFullImage ? undefined : {...style,objectFit:layout.fit,transform:`translate(${(edits.offsetX||0)/layout.width*100}%,${(edits.offsetY||0)/layout.height*100}%) scale(${edits.zoom||1}) rotate(${edits.rotation||0}deg) scaleX(${edits.flipX?-1:1}) scaleY(${edits.flipY?-1:1})`}} onLoad={event=>{const image=event.currentTarget;if(image.naturalWidth&&image.naturalHeight){setOriginalRatio(image.naturalWidth/image.naturalHeight);setSourceSize({width:image.naturalWidth,height:image.naturalHeight});}}}/>}
        </div>
      </div>
      {!video&&<div className="media-editor-view-options"><button type="button" disabled={working} aria-pressed={showFullImage} onClick={()=>{setShowFullImage(value=>!value);modalRef.current?.scrollTo({top:0,behavior:"instant"});}}>{showFullImage?"Return to edit preview":"Show full image"}</button><p>{showFullImage?"Full original image. Your edits are preserved; return to the edit preview to see them.":cropped?"Crop preview: parts outside this shape will be removed in the edited copy.":"Fit preview: the whole image keeps its proportions inside the output size. Empty space is transparent in the saved PNG. Zoom and position can move parts outside it."}</p></div>}
      <div className="media-editor-fields">
        <fieldset disabled={working} style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,padding:16}}>
          <legend>Direct edits · save as a new copy</legend>
          {video ? <>
            <label>Trim start (seconds)<input type="number" min="0" max={duration || undefined} step=".1" value={edits.trimStart || 0} onChange={e=>update({trimStart:Math.max(0,Number(e.target.value))})}/></label>
            <label>Trim end (seconds)<input type="number" min=".1" max={duration || undefined} step=".1" value={edits.trimEnd || duration || ""} onChange={e=>update({trimEnd:Number(e.target.value)})}/></label>
          </> : <>
            <label>Output shape<select value={edits.crop || "original"} onChange={e=>update({crop:e.target.value as ProjectAssetEdits["crop"],width:undefined,height:undefined})}><option value="original">Original</option><option value="square">Square</option><option value="landscape">Landscape · 16:9</option><option value="portrait">Portrait · 9:16</option></select></label>
            <label>Width (pixels)<input aria-label="Image output width" type="number" min="1" max="4096" step="1" value={layout.width} onChange={e=>update({width:Math.max(1,Math.min(4096,Math.round(Number(e.target.value)||1)))})}/></label>
            <label>Height (pixels)<input aria-label="Image output height" type="number" min="1" max="4096" step="1" value={layout.height} onChange={e=>update({height:Math.max(1,Math.min(4096,Math.round(Number(e.target.value)||1)))})}/></label>
            <label>Image fitting<select aria-label="Image fitting" value={layout.fit} onChange={e=>update({fit:e.target.value as ProjectAssetEdits["fit"]})}><option value="contain">Fit whole image · preserve proportions</option><option value="cover">Fill area · crop edges</option><option value="fill">Stretch to size</option></select></label>
            <button type="button" onClick={()=>update({width:1920,height:1080,crop:"landscape",fit:"contain",zoom:1,offsetX:0,offsetY:0})}>Full overlay · 1920 × 1080</button>
            {asset.edits?.placement&&<button type="button" onClick={()=>update({width:Math.round(asset.edits!.placement!.width*19.2),height:Math.round(asset.edits!.placement!.height*10.8),fit:"contain",zoom:1,offsetX:0,offsetY:0})}>Use this image’s overlay area</button>}
            <small>{layout.width} × {layout.height} pixel copy. Fit keeps all content with transparent space; fill crops edges. AI edits use the selected shape, then save at these dimensions.</small>
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
          {!video&&<button type="button" disabled={working} onClick={()=>{update({width:1920,height:1080,crop:"landscape",fit:"contain",zoom:1,offsetX:0,offsetY:0});setPrompt("Adapt this artwork for a horizontal 16:9 livestream overlay. Extend or recompose the background naturally to fill the widescreen scene. Preserve the original subjects, identity, important details and exact text. Do not stretch the subjects or crop important content. Keep text readable and away from the outer edges.");}}>Adapt artwork for full overlay</button>}
          <div>
            <input value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder={video ? "Example: cut off the first 3 seconds" : "Example: make it darker, remove the text, and add pink neon around the edges"}
              onKeyDown={e=>{ if(e.key==="Enter") void editMedia(); }} />
            <button type="button" disabled={!prompt.trim() || working} onClick={()=>void editMedia()}>
              {working ? "Making your edit…" : "Make this change"}
            </button>
          </div>
          <small>For layout changes, describe what to preserve and where to leave space. “Adapt artwork” prepares an AI request to extend or recompose the scene; review the result before using it. The edited result is saved as a new asset so your original stays safe.</small>
          {error && <small className="media-editor-error">{error}</small>}
        </div>
      </div>
      <div className="media-editor-actions"><button className="outline-btn" onClick={onClose}>Cancel</button></div>
    </div>
  </div>;
}

