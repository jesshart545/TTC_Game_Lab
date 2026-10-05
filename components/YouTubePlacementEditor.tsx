"use client";
import { useRef, useState, type PointerEvent } from "react";
import { safeYoutubePlacement, type YouTubePlacement } from "../lib/youtube";
export default function YouTubePlacementEditor({placement,onChange,label="YouTube",top=8}:{placement:YouTubePlacement;onChange:(value:YouTubePlacement)=>void;label?:string;top?:number}) {
  const [editing,setEditing]=useState(false), [draft,setDraft]=useState<YouTubePlacement|null>(null);
  const drag=useRef<{x:number;y:number;width:number;height:number;placement:YouTubePlacement;resize:boolean}|null>(null);
  const value=draft || placement;
  function start(event:PointerEvent<HTMLButtonElement>,resize:boolean) {
    const canvas=event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if(!canvas)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={x:event.clientX,y:event.clientY,width:canvas.width,height:canvas.height,placement:value,resize};
  }
  function move(event:PointerEvent<HTMLButtonElement>) {
    const current=drag.current;if(!current)return;
    const dx=(event.clientX-current.x)/current.width*100,dy=(event.clientY-current.y)/current.height*100;
    const next=current.resize?{...current.placement,width:Math.min(100-current.placement.x,current.placement.width+dx),height:Math.min(100-current.placement.y,current.placement.height+dy)}:{...current.placement,x:current.placement.x+dx,y:current.placement.y+dy};
    setDraft(safeYoutubePlacement(next));
  }
  function finish(){if(drag.current){drag.current=null;if(draft)onChange(draft);setDraft(null);}}
  return <><button type="button" style={{position:"absolute",top,left:8,zIndex:100}} onClick={()=>setEditing(!editing)}>{editing?`Done positioning ${label}`:`Position / resize ${label}`}</button>{editing&&<div style={{position:"absolute",left:value.x+"%",top:value.y+"%",width:value.width+"%",height:value.height+"%",border:"2px solid #20e8ff",zIndex:99,pointerEvents:"none",boxSizing:"border-box"}}><button type="button" aria-label={`Move ${label}`} onPointerDown={e=>start(e,false)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={e=>{const delta=e.shiftKey?5:1;const changes:Record<string,YouTubePlacement>={ArrowLeft:{...value,x:value.x-delta},ArrowRight:{...value,x:value.x+delta},ArrowUp:{...value,y:value.y-delta},ArrowDown:{...value,y:value.y+delta}};if(changes[e.key]){e.preventDefault();onChange(safeYoutubePlacement(changes[e.key]));}}} style={{position:"absolute",inset:0,pointerEvents:"auto",touchAction:"none",cursor:"move",background:"#20e8ff11",color:"white",border:0}}>{label} · drag to move</button><button type="button" aria-label={`Resize ${label}`} onPointerDown={e=>start(e,true)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={e=>{const delta=e.shiftKey?5:1;const changes:Record<string,YouTubePlacement>={ArrowLeft:{...value,width:value.width-delta},ArrowRight:{...value,width:value.width+delta},ArrowUp:{...value,height:value.height-delta},ArrowDown:{...value,height:value.height+delta}};if(changes[e.key]){e.preventDefault();onChange(safeYoutubePlacement(changes[e.key]));}}} style={{position:"absolute",bottom:0,right:0,width:32,height:32,pointerEvents:"auto",touchAction:"none",cursor:"nwse-resize",background:"#20e8ff",color:"black",border:0}}>↘</button></div>}</>;
}
