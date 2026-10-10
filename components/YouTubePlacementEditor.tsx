"use client";
import { useRef, useState, type PointerEvent } from "react";
import {normalizePlacement,movePlacement,resizePlacement} from '../lib/overlay-placement';
import { safeYoutubePlacement, type YouTubePlacement } from "../lib/youtube";
export default function YouTubePlacementEditor({placement,onChange,onPreviewChange,label="YouTube",top=8}:{placement:YouTubePlacement;onChange:(value:YouTubePlacement)=>void;onPreviewChange?:(value:YouTubePlacement|null)=>void;label?:string;top?:number}) {
  const [sizing,setSizing]=useState(false), [draft,setDraft]=useState<YouTubePlacement|null>(null);
  const drag=useRef<{x:number;y:number;width:number;height:number;placement:YouTubePlacement;resize:boolean}|null>(null);
  const pending=useRef<YouTubePlacement|null>(null);
  const value=draft || placement;
  const normalize=(next:YouTubePlacement)=>label==="YouTube"?safeYoutubePlacement(next):normalizePlacement(next);
  function start(event:PointerEvent<HTMLButtonElement>,resize:boolean) {
    const canvas=event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if(!canvas)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    pending.current=null;
    drag.current={x:event.clientX,y:event.clientY,width:canvas.width,height:canvas.height,placement:normalize(value),resize};
  }
  function move(event:PointerEvent<HTMLButtonElement>) {
    const current=drag.current;if(!current)return;
    const dx=(event.clientX-current.x)/current.width*100,dy=(event.clientY-current.y)/current.height*100;
    const next=normalize(current.resize?resizePlacement(current.placement,dx,dy):movePlacement(current.placement,dx,dy));
    pending.current=next;setDraft(next);onPreviewChange?.(next);
  }
  function finish(){if(drag.current){drag.current=null;const next=pending.current;pending.current=null;if(next)onChange(next);setDraft(null);onPreviewChange?.(null);}}
  function cancel(){drag.current=null;pending.current=null;setDraft(null);onPreviewChange?.(null);}

  const canvas={width:1920,height:1080};
  const setSize=(width:number,height:number)=>onChange(normalize({...value,width:width/canvas.width*100,height:height/canvas.height*100,x:(100-width/canvas.width*100)/2,y:(100-height/canvas.height*100)/2}));
  const setDimension=(key:"width"|"height",pixels:number)=>onChange(normalize({...value,[key]:pixels/(key==="width"?canvas.width:canvas.height)*100}));
  const sizes=[[480,270],[960,540],[1440,810],[1920,1080]];
  const labelSizes=["Small","Medium","Large","Fill overlay"];
  return <><button type="button" className="overlay-size-toggle" style={{position:"absolute",top,left:8,zIndex:102}} onClick={()=>setSizing(!sizing)}>{sizing?"Hide size options":"Size options (pixels & presets)"}</button>{sizing&&<div className="overlay-size-panel" style={{position:"absolute",top:typeof top==="number"?top+42:top,left:8,zIndex:101}}><strong>Size {label} for TikTok Studio</strong><small>Horizontal overlay · 16:9 · 1920 × 1080. Pictures keep their shape inside the selected size.</small><div className="overlay-size-presets">{sizes.map(([w,h],i)=><button type="button" key={labelSizes[i]} onClick={()=>setSize(w,h)}>{labelSizes[i]}<small>{w} × {h} px</small></button>)}</div><div className="overlay-size-custom"><label>Width (px)<input aria-label={`Width of ${label} in pixels`} type="number" min="1" max={canvas.width} step="10" value={Math.round(value.width*canvas.width/100)} onChange={e=>setDimension("width",Math.max(1,Math.min(canvas.width,Number(e.target.value)||1)))}/></label><label>Height (px)<input aria-label={`Height of ${label} in pixels`} type="number" min="1" max={canvas.height} step="10" value={Math.round(value.height*canvas.height/100)} onChange={e=>setDimension("height",Math.max(1,Math.min(canvas.height,Number(e.target.value)||1)))}/></label></div><small>Drag the box to move it, or drag ↘ to resize by eye.</small></div>}<div style={{position:"absolute",left:value.x+"%",top:value.y+"%",width:value.width+"%",height:value.height+"%",border:"2px solid #20e8ff",zIndex:99,pointerEvents:"none",boxSizing:"border-box"}}><button type="button" aria-label={`Move ${label}`} onPointerDown={e=>start(e,false)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={e=>{const delta=e.shiftKey?5:1;const changes:Record<string,YouTubePlacement>={ArrowLeft:{...value,x:value.x-delta},ArrowRight:{...value,x:value.x+delta},ArrowUp:{...value,y:value.y-delta},ArrowDown:{...value,y:value.y+delta}};if(changes[e.key]){e.preventDefault();onChange(normalize(changes[e.key]));}}} style={{position:"absolute",inset:0,pointerEvents:"auto",touchAction:"none",cursor:"move",background:"#20e8ff11",color:"white",border:0}}>{label} · drag to move</button><button type="button" aria-label={`Resize ${label}`} onPointerDown={e=>start(e,true)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={e=>{const delta=e.shiftKey?5:1;const changes:Record<string,YouTubePlacement>={ArrowLeft:{...value,width:value.width-delta},ArrowRight:{...value,width:value.width+delta},ArrowUp:{...value,height:value.height-delta},ArrowDown:{...value,height:value.height+delta}};if(changes[e.key]){e.preventDefault();onChange(normalize(changes[e.key]));}}} style={{position:"absolute",bottom:0,right:0,width:32,height:32,pointerEvents:"auto",touchAction:"none",cursor:"nwse-resize",background:"#20e8ff",color:"black",border:0}}>↘</button></div></>;
}

