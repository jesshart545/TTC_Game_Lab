"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectAsset, ProjectAssetEdits } from "../lib/project";

const CROP_OPTIONS: Array<{ id: NonNullable<ProjectAssetEdits["crop"]>; label: string; ratio?: string }> = [
  { id: "original", label: "Original" }, { id: "square", label: "Square", ratio: "1:1" },
  { id: "landscape", label: "Landscape", ratio: "16:9" }, { id: "portrait", label: "Portrait", ratio: "9:16" },
];

function isVideo(asset: ProjectAsset) { return asset.type.toLowerCase().includes("video") || /\.(mp4|webm|mov|m4v)$/i.test(asset.name); }
function ratioStyle(crop: ProjectAssetEdits["crop"]) {
  return { aspectRatio: crop === "square" ? "1 / 1" : crop === "portrait" ? "9 / 16" : "16 / 9" };
}

export default function MediaEditor({asset,onSave,onSaveAsNew,onClose}:{asset:ProjectAsset;onSave:(asset:ProjectAsset)=>void;onSaveAsNew?:(asset:ProjectAsset)=>Promise<void>;onClose:()=>void}) {
  const videoRef=useRef<HTMLVideoElement>(null), video=isVideo(asset);
  const [name,setName]=useState(asset.name), [crop,setCrop]=useState<NonNullable<ProjectAssetEdits["crop"]>>(asset.edits?.crop||"original");
  const [trimStart,setTrimStart]=useState(Number(asset.edits?.trimStart||0)), [trimEnd,setTrimEnd]=useState(Number(asset.edits?.trimEnd||0));
  const [duration,setDuration]=useState(0), [currentTime,setCurrentTime]=useState(0);
  const [zoom,setZoom]=useState(asset.edits?.zoom||1), [rotation,setRotation]=useState(asset.edits?.rotation||0);
  const [flipX,setFlipX]=useState(Boolean(asset.edits?.flipX)), [flipY,setFlipY]=useState(Boolean(asset.edits?.flipY));
  const [opacity,setOpacity]=useState(asset.edits?.opacity??1), [brightness,setBrightness]=useState(asset.edits?.brightness??100);
  const [contrast,setContrast]=useState(asset.edits?.contrast??100), [saturation,setSaturation]=useState(asset.edits?.saturation??100);
  const [blur,setBlur]=useState(asset.edits?.blur??0), [width,setWidth]=useState(asset.edits?.width||0), [height,setHeight]=useState(asset.edits?.height||0);
  const [offsetX,setOffsetX]=useState(asset.edits?.offsetX||0), [offsetY,setOffsetY]=useState(asset.edits?.offsetY||0);
  const [aiPrompt,setAiPrompt]=useState("");
  const [aiEditing,setAiEditing]=useState(false);
  const [aiError,setAiError]=useState("");
  const [savingNew,setSavingNew]=useState(false);

  const effectiveEnd=useMemo(()=>!video||!duration?0:(trimEnd>0?Math.min(trimEnd,duration):duration),[duration,trimEnd,video]);
  useEffect(()=>{if(!video||!videoRef.current||effectiveEnd<=trimStart)return;const p=videoRef.current,t=currentTime<trimStart||currentTime>effectiveEnd?trimStart:currentTime;if(Math.abs(p.currentTime-t)>.15)p.currentTime=t;},[trimStart,effectiveEnd,currentTime,video]);

  const transform=`translate(${offsetX}px,${offsetY}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipX?-1:1}) scaleY(${flipY?-1:1})`;
  const mediaStyle={transform,opacity,filter:`brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`};

  function reset(){setCrop("original");setZoom(1);setRotation(0);setFlipX(false);setFlipY(false);setOpacity(1);setBrightness(100);setContrast(100);setSaturation(100);setBlur(0);setWidth(0);setHeight(0);setOffsetX(0);setOffsetY(0);}
  function editedAsset(): ProjectAsset {
    const edits: ProjectAssetEdits = { crop, zoom, rotation, flipX, flipY, opacity, brightness, contrast, saturation, blur, width: width || undefined, height: height || undefined, offsetX, offsetY };
    if (video) {
      edits.trimStart = Math.max(0, Math.min(trimStart, Math.max(0, duration - .05)));
      if (effectiveEnd > edits.trimStart + .05 && effectiveEnd < duration - .05) edits.trimEnd = effectiveEnd;
    }
    return { ...asset, name: name.trim() || asset.name, edits };
  }
  function apply() {
    onSave(editedAsset());
    onClose();
  }
  async function runAiEdit() {
    if (!asset.url || !aiPrompt.trim() || aiEditing) return;
    setAiEditing(true);
    setAiError("");
    try {
      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim(), imageUrl: asset.url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI image edit failed.");
      if (!data.url) throw new Error("Agnes returned no edited image.");
      const next: ProjectAsset = {
        ...asset,
        name: (name.replace(/\.[^.]+$/, "") || "image") + "-ai-edit.png",
        type: "image/png",
        url: data.url,
        storageKey: undefined,
        edits: undefined,
      };
      if (onSaveAsNew) await onSaveAsNew(next);
      else onSave(next);
      onClose();
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI image edit failed.");
    } finally {
      setAiEditing(false);
    }
  }

  return <div className="media-editor-backdrop" role="dialog" aria-modal="true"><div className="media-editor-modal">
    <div className="media-editor-head"><div><small>MEDIA EDITOR</small><h2>Edit asset</h2></div><button className="media-editor-close" onClick={onClose}>×</button></div>
    <div className="media-editor-preview-wrap"><div className={`media-editor-preview crop-${crop}`} style={crop==="original"?undefined:ratioStyle(crop)}>
      {video?<video ref={videoRef} src={asset.url} controls style={mediaStyle} onLoadedMetadata={e=>{const d=e.currentTarget.duration;setDuration(Number.isFinite(d)?d:0);if(!trimEnd||trimEnd>d)setTrimEnd(d)}} onTimeUpdate={e=>{const t=e.currentTarget.currentTime;setCurrentTime(t);if(effectiveEnd&&t>=effectiveEnd){e.currentTarget.currentTime=trimStart;e.currentTarget.pause()}}}/>:<img src={asset.url} alt={asset.name} style={mediaStyle}/>}
    </div></div>
    <div className="media-editor-fields">
      <label><span>ASSET NAME</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
      <div className="media-editor-field"><span>CROP / ASPECT</span><div className="media-editor-options">{CROP_OPTIONS.map(o=><button key={o.id} type="button" className={crop===o.id?"selected":""} onClick={()=>setCrop(o.id)}>{o.label}{o.ratio&&<small>{o.ratio}</small>}</button>)}</div></div>
      {!video&&<><div className="media-editor-control-grid">
        <label><span>Zoom {zoom.toFixed(2)}×</span><input type="range" min=".25" max="3" step=".05" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label>
        <label><span>Rotate {rotation}°</span><input type="range" min="-180" max="180" step="1" value={rotation} onChange={e=>setRotation(+e.target.value)}/></label>
        <label><span>Horizontal position</span><input type="range" min="-300" max="300" value={offsetX} onChange={e=>setOffsetX(+e.target.value)}/></label>
        <label><span>Vertical position</span><input type="range" min="-300" max="300" value={offsetY} onChange={e=>setOffsetY(+e.target.value)}/></label>
        <label><span>Opacity {Math.round(opacity*100)}%</span><input type="range" min="0" max="1" step=".01" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label>
        <label><span>Brightness {brightness}%</span><input type="range" min="0" max="200" value={brightness} onChange={e=>setBrightness(+e.target.value)}/></label>
        <label><span>Contrast {contrast}%</span><input type="range" min="0" max="200" value={contrast} onChange={e=>setContrast(+e.target.value)}/></label>
        <label><span>Saturation {saturation}%</span><input type="range" min="0" max="200" value={saturation} onChange={e=>setSaturation(+e.target.value)}/></label>
        <label><span>Blur {blur}px</span><input type="range" min="0" max="20" step=".5" value={blur} onChange={e=>setBlur(+e.target.value)}/></label>
      </div><div className="media-editor-inline-actions"><button className="outline-btn" onClick={()=>setRotation(v=>v-90)}>↶ Rotate 90°</button><button className="outline-btn" onClick={()=>setRotation(v=>v+90)}>↷ Rotate 90°</button><button className="outline-btn" onClick={()=>setFlipX(v=>!v)}>↔ Flip</button><button className="outline-btn" onClick={()=>setFlipY(v=>!v)}>↕ Flip</button></div>
      <div className="media-editor-size"><label><span>Width px</span><input type="number" min="0" value={width||""} placeholder="Auto" onChange={e=>setWidth(+e.target.value)}/></label><label><span>Height px</span><input type="number" min="0" value={height||""} placeholder="Auto" onChange={e=>setHeight(+e.target.value)}/></label></div>
      <div className="media-editor-ai"><span>AI EDIT</span><div><input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Remove background, make it haunted, change shirt color…" onKeyDown={e=>{if(e.key==="Enter")void runAiEdit()}}/><button type="button" disabled={!aiPrompt.trim()||aiEditing} onClick={()=>void runAiEdit()}>{aiEditing?"Editing…":"AI Edit"}</button></div><small>Uses Agnes Image 2.5 Flash image-to-image and saves the result as a new asset.</small>{aiError&&<small className="media-editor-error">{aiError}</small>}</div></>}
      {video&&<div className="media-editor-field"><span>TRIM VIDEO</span><div className="media-editor-trim"><label>Start<input type="number" min="0" step=".1" value={trimStart} onChange={e=>setTrimStart(+e.target.value)}/></label><label>End<input type="number" min=".1" step=".1" value={effectiveEnd||trimEnd||0} onChange={e=>setTrimEnd(+e.target.value)}/></label><span>{duration?duration.toFixed(1)+"s total":"Loading…"}</span></div></div>}
    </div>
    <div className="media-editor-actions"><button className="outline-btn" onClick={reset}>Reset</button><button className="outline-btn" onClick={onClose}>Cancel</button>{!video&&onSaveAsNew&&<button className="outline-btn" disabled={savingNew} onClick={async()=>{setSavingNew(true);try{await onSaveAsNew(editedAsset());onClose();}finally{setSavingNew(false)}}}>{savingNew?"Rendering…":"Save as New Asset"}</button>}<button className="build-btn" onClick={apply}>Replace Asset</button></div>
  </div></div>;
}
