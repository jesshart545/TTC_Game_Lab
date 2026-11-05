"use client";

import { useRef, useState } from "react";
import { BackdropTextSpec, ProjectAsset, ProjectAssetEdits } from "../lib/project";
import { imageLayout } from "../lib/image-layout";
import { assetBackdropText } from "../lib/backdrop-text";
import { aiEditImage, aiEditVideo } from "../lib/ai-edit";
import FontPicker from "./FontPicker";

/** A stored spec color (#rgb or #rrggbb) as the #rrggbb a color input needs. */
function hexForColorInput(value: string): string {
  const short = /^#([0-9a-fA-F]{3})$/.exec(value.trim());
  if (short) return "#" + short[1].split("").map(c => c + c).join("");
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#ffffff";
}

function isAudioAsset(asset: ProjectAsset) {
  const name = asset.name.toLowerCase();
  return asset.type.toLowerCase().includes("audio") || name.startsWith("voice") || name.startsWith("music") || name.startsWith("sfx") || /\.(mp3|wav|m4a|oga|flac)$/i.test(asset.name);
}

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
  const audio = !video && isAudioAsset(asset);
  const modalRef = useRef<HTMLDivElement>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [edits, setEdits] = useState<ProjectAssetEdits>(asset.edits || {});
  const [duration,setDuration] = useState(0);
  const [originalRatio,setOriginalRatio] = useState(16/9);
  const [sourceSize,setSourceSize] = useState({width:1920,height:1080});
  const layout=imageLayout(sourceSize.width,sourceSize.height,edits);
  const update=(patch:Partial<ProjectAssetEdits>)=>{setShowFullImage(false);setEdits(value=>({...value,...patch}));};
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  // AI Edit (Jessica, 2026-11-04): the dialog offers the AI edit itself,
  // on the same pipeline Jewel's media edits use (lib/ai-edit) — the AI
  // is the main editing tool, so it sits here as a first-class section,
  // not as a pointer to somewhere else.
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiWorking, setAiWorking] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [aiError, setAiError] = useState("");
  // The asset's lettering layer (backdrop-text spec), when it carries
  // one: font and colors are editable here through the same spec the
  // workshop preview and the published overlay render. Assets without
  // a text layer show no Text section — adding new text is Jewel's work.
  const [textSpec, setTextSpec] = useState<BackdropTextSpec | null>(() => assetBackdropText(asset));
  const textCarry = textSpec ? { textOverlay: textSpec } : {};

  async function saveCopy() {
    if(working || !onSaveAsNew)return;
    setWorking(true);setError("");
    if (video) {
      // A video save renders at page level and asks the user to press
      // "Start video trim" on the banner there. Close this editor first so
      // the banner is actually reachable; progress and any failure are
      // reported in the page's status line.
      const pending = onSaveAsNew({...asset,edits,...textCarry});
      onClose();
      pending.catch(()=>{});
      return;
    }
    try {await onSaveAsNew({...asset,edits,...textCarry});onClose();}catch(e){setError(e instanceof Error?e.message:"Could not save the edited copy.");}finally{setWorking(false);}
  }

  async function applyAiEdit() {
    if (aiWorking || working || !onSaveAsNew) return;
    const prompt = aiPrompt.trim();
    if (!prompt) { setAiError("Describe the change you want first."); return; }
    if (!asset.url) { setAiError("This asset's media is unavailable, so it can't be edited with AI."); return; }
    setAiWorking(true); setAiError("");
    setAiStatus(video ? "Editing your video with AI — this can take a few minutes…" : "AI is making your edit…");
    try {
      const url = video ? await aiEditVideo(asset.url, prompt) : await aiEditImage(asset.url, prompt, setAiStatus);
      // The result saves as a NEW copy through this dialog's save-as-new
      // path, exactly like every other edit here: the host stores it
      // under the next name in this asset's edit line ("Name (edit N)",
      // lib/asset-filing) and files the copy into this project with
      // this asset's role (fileEditedCopy — filed even if this asset
      // was not; the copy itself is not placed on the overlay).
      // edits: undefined keeps the host on its
      // store-the-result branch: the AI result is finished media, not a
      // manual render. The original is never touched, and a failure
      // above saves nothing and says so.
      await onSaveAsNew({ ...asset, ...(video ? { type: "video/mp4", storageKey: undefined } : {}), url, edits: undefined, ...textCarry });
      onClose();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "The AI edit could not be completed. Nothing was saved.");
    } finally { setAiWorking(false); setAiStatus(""); }
  }
  const previewRatio=showFullImage||video?originalRatio:layout.ratio;
  const cropped=!showFullImage&&layout.fit==="cover";
  const style={transform:`translate(${edits.offsetX || 0}px,${edits.offsetY || 0}px) scale(${edits.zoom || 1}) rotate(${edits.rotation || 0}deg) scaleX(${edits.flipX?-1:1}) scaleY(${edits.flipY?-1:1})`,opacity:edits.opacity??1,filter:`brightness(${edits.brightness??100}%) contrast(${edits.contrast??100}%) saturate(${edits.saturation??100}%)`};
  return <div className="media-editor-backdrop" role="dialog" aria-modal="true">
    <div className="media-editor-modal" ref={modalRef}>
      {/* The sticky actions bar is constrained to its containing block, so it must live inside this full-content-height wrapper: as a direct child of the scrolling modal its containing block was only the modal's own visible box, the bar's natural position sat outside it, and sticky could never pull the bar into view. */}
      <div className="media-editor-scroll-content">
      <div className="media-editor-head">
        <div><small>EDIT ASSET</small><h2>{audio ? "Trim your audio clip." : video ? "Trim your video clip." : "Resize and adjust your image."}</h2></div>
        <button className="media-editor-close" onClick={onClose}>×</button>
      </div>
      <div className="media-editor-preview-wrap">
        <div className={`media-editor-preview ${cropped?"crop-selected":"crop-original"}`} style={{aspectRatio:previewRatio,width:`min(100%, ${previewRatio*48}vh)`}}>
          {video ? <video src={asset.url} controls style={style} onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);if(e.currentTarget.videoWidth&&e.currentTarget.videoHeight)setOriginalRatio(e.currentTarget.videoWidth/e.currentTarget.videoHeight);}} onPlay={e=>{if(e.currentTarget.currentTime<(edits.trimStart || 0))e.currentTarget.currentTime=edits.trimStart || 0;}} onTimeUpdate={e=>{if(edits.trimEnd && e.currentTarget.currentTime>=edits.trimEnd)e.currentTarget.pause();}} /> : audio ? <audio src={asset.url} controls style={{width:"100%"}} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onPlay={e=>{if(e.currentTarget.currentTime<(edits.trimStart || 0))e.currentTarget.currentTime=edits.trimStart || 0;}} onTimeUpdate={e=>{if(edits.trimEnd && e.currentTarget.currentTime>=edits.trimEnd)e.currentTarget.pause();}} /> : <img src={asset.url} alt={asset.name} style={showFullImage ? undefined : {...style,objectFit:layout.fit,transform:`translate(${(edits.offsetX||0)/layout.width*100}%,${(edits.offsetY||0)/layout.height*100}%) scale(${edits.zoom||1}) rotate(${edits.rotation||0}deg) scaleX(${edits.flipX?-1:1}) scaleY(${edits.flipY?-1:1})`}} onLoad={event=>{const image=event.currentTarget;if(image.naturalWidth&&image.naturalHeight){setOriginalRatio(image.naturalWidth/image.naturalHeight);setSourceSize({width:image.naturalWidth,height:image.naturalHeight});}}}/>}
        </div>
      </div>
      {!video&&!audio&&<div className="media-editor-view-options"><button type="button" disabled={working} aria-pressed={showFullImage} onClick={()=>{setShowFullImage(value=>!value);modalRef.current?.scrollTo({top:0,behavior:"instant"});}}>{showFullImage?"Return to edit preview":"Show full image"}</button><p>{showFullImage?"Full original image. Your edits are preserved; return to the edit preview to see them.":cropped?"Crop preview: parts outside this shape will be removed in the edited copy.":"Fit preview: the whole image keeps its proportions inside the output size. Empty space is transparent in the saved PNG. Zoom and position can move parts outside it."}</p></div>}
      <div className="media-editor-fields">
        {!audio && <div className="media-editor-ai">
          <span>AI EDIT</span>
          <div>
            <input aria-label="Describe the AI edit" type="text" value={aiPrompt} disabled={aiWorking || working || !onSaveAsNew} placeholder="Describe the change — e.g. make the sky a sunset" onChange={e=>setAiPrompt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void applyAiEdit();}}} />
            <button type="button" disabled={aiWorking || working || !onSaveAsNew || !aiPrompt.trim()} onClick={()=>void applyAiEdit()}>{aiWorking ? "AI is editing…" : "Apply AI edit"}</button>
          </div>
          {aiWorking && aiStatus ? <small role="status">{aiStatus}</small> : <small>The AI editor makes your change as a new copy — your original stays untouched. It is the same AI editing Jewel uses.</small>}
          {!onSaveAsNew && <small>AI editing isn't available in this view — open this asset inside its project to edit it with AI.</small>}
          {aiError && <small className="media-editor-error">{aiError}</small>}
        </div>}
        <fieldset disabled={working} style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,padding:16}}>
          <legend>Direct edits · save as a new copy</legend>
          {video || audio ? <>
            <label>Trim start (seconds)<input type="number" min="0" max={duration || undefined} step=".1" value={edits.trimStart || 0} onChange={e=>update({trimStart:Math.max(0,Number(e.target.value))})}/></label>
            <label>Trim end (seconds)<input type="number" min=".1" max={duration || undefined} step=".1" value={edits.trimEnd || duration || ""} onChange={e=>update({trimEnd:Number(e.target.value)})}/></label>
          </> : <>
            <label>Output shape<select value={edits.crop || "original"} onChange={e=>update({crop:e.target.value as ProjectAssetEdits["crop"],width:undefined,height:undefined})}><option value="original">Original</option><option value="square">Square</option><option value="landscape">Landscape · 16:9</option><option value="portrait">Portrait · 9:16</option></select></label>
            <label>Width (pixels)<input aria-label="Image output width" type="number" min="1" max="4096" step="1" value={layout.width} onChange={e=>update({width:Math.max(1,Math.min(4096,Math.round(Number(e.target.value)||1)))})}/></label>
            <label>Height (pixels)<input aria-label="Image output height" type="number" min="1" max="4096" step="1" value={layout.height} onChange={e=>update({height:Math.max(1,Math.min(4096,Math.round(Number(e.target.value)||1)))})}/></label>
            <label>Image fitting<select aria-label="Image fitting" value={layout.fit} onChange={e=>update({fit:e.target.value as ProjectAssetEdits["fit"]})}><option value="contain">Fit whole image · preserve proportions</option><option value="cover">Fill area · crop edges</option><option value="fill">Stretch to size</option></select></label>
            <button type="button" onClick={()=>update({width:1920,height:1080,crop:"landscape",fit:"contain",zoom:1,offsetX:0,offsetY:0})}>Full overlay · 1920 × 1080</button>
            {asset.edits?.placement&&<button type="button" onClick={()=>update({width:Math.round(asset.edits!.placement!.width*19.2),height:Math.round(asset.edits!.placement!.height*10.8),fit:"contain",zoom:1,offsetX:0,offsetY:0})}>Use this image’s overlay area</button>}
            <small>{layout.width} × {layout.height} pixel copy. Fit keeps all content with transparent space; fill crops edges.</small>
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
        </fieldset>
        {textSpec && <fieldset disabled={working || aiWorking} style={{display:"grid",gap:12,padding:16}}>
          <legend>Text on this {video ? "video" : "image"} · its lettering layer</legend>
          <FontPicker label="Text font" value={textSpec.fontFamily} onChange={family=>setTextSpec(spec=>spec?{...spec,fontFamily:family}:spec)} />
          <label>Text color<span style={{display:"flex",alignItems:"center",gap:8}}><input aria-label="Text color" type="color" value={hexForColorInput(textSpec.textColor)} onChange={e=>setTextSpec(spec=>spec?{...spec,textColor:e.target.value}:spec)} /><span>{textSpec.textColor}</span></span></label>
          {textSpec.accentColor !== undefined && <label>Accent color<span style={{display:"flex",alignItems:"center",gap:8}}><input aria-label="Accent color" type="color" value={hexForColorInput(textSpec.accentColor)} onChange={e=>setTextSpec(spec=>spec?{...spec,accentColor:e.target.value}:spec)} /><span>{textSpec.accentColor}</span></span></label>}
          <small>The font and colors save with the edited copy below, and the lettering renders the same in the workshop and on your published overlay.</small>
        </fieldset>}
        {audio && <div className="media-editor-ai">
          <span>AUDIO EDITING</span>
          <small>Trimming is saved as a new copy, so your original stays safe. AI editing is not available for audio.</small>
          {error && <small className="media-editor-error">{error}</small>}
        </div>}
        {!audio && error && <small className="media-editor-error">{error}</small>}
      </div>
      <div className="media-editor-actions"><button type="button" disabled={working || aiWorking} onClick={()=>void saveCopy()}>{working?"Saving edit…":"Save edited copy"}</button><button className="outline-btn" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  </div>;
}

