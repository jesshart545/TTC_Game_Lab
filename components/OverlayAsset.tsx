"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ProjectAsset } from "../lib/project";
export function overlayAssetStyle(asset: ProjectAsset, background=false): CSSProperties {
 const e=asset.edits || {}, placement=e.placement;
 return { ...(background ? {position:"absolute",left:0,top:0,width:"100%",height:"100%",pointerEvents:"none"} : {}), objectFit:e.fit || "contain", ...(placement ? {position:"absolute",left:placement.x+"%",top:placement.y+"%",width:placement.width+"%",height:placement.height+"%",maxWidth:"none",maxHeight:"none",right:"auto",bottom:"auto"} : {}), transform:`translate(${e.offsetX||0}px,${e.offsetY||0}px) scale(${e.zoom||1}) rotate(${e.rotation||0}deg) scaleX(${e.flipX?-1:1}) scaleY(${e.flipY?-1:1})`,opacity:e.opacity??1,filter:`brightness(${e.brightness??100}%) contrast(${e.contrast??100}%) saturate(${e.saturation??100}%) blur(${e.blur??0}px)` };
}
export default function OverlayAsset({asset,background=false,className,playing=false}:{asset:ProjectAsset;background?:boolean;className?:string;playing?:boolean}) {
 const [blocked,setBlocked]=useState(false),[failed,setFailed]=useState(false);
 const media=useRef<HTMLVideoElement & HTMLAudioElement>(null);
 const kind=(asset.type+" "+asset.name+" "+(asset.url||"").split("?")[0]).toLowerCase();
 const video=kind.includes("video") || /\.(mp4|webm|mov)(?:$|\s)/.test(kind),audio=kind.includes("audio") || /\.(mp3|wav|ogg)(?:$|\s)/.test(kind);
 const e=asset.edits||{};
 useEffect(()=>{
  const element=media.current;
  if(!element)return;
  element.volume=Math.max(0,Math.min(100,e.volume??80))/100;
  element.muted=!(e.sound??true);
  setFailed(false);
  if(playing){
   void element.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));
  }else{
   element.pause();
   try{element.currentTime=0;}catch{}
   setBlocked(false);
  }
 },[e.volume,e.sound,asset.url,playing]);
 const enable=()=>{void media.current?.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));};
 const notice=<>{playing&&blocked&&!failed&&<button type="button" onClick={enable} style={{position:'absolute',left:'35%',top:'85%',zIndex:60}}>Enable audio for {asset.name}</button>}{failed&&<p role="alert">Unable to load {asset.name}. Check this media in Workshop.</p>}</>;

 const style=overlayAssetStyle(asset,background);
 if(video)return <><video ref={media} aria-label={asset.name} src={asset.url} className={className} style={style} autoPlay={playing} playsInline loop={e.loop??background} muted={!(e.sound??true)} preload={playing?"auto":"metadata"} onError={()=>setFailed(true)}/>{notice}</>;
 if(audio)return <><audio ref={media} aria-label={asset.name} src={asset.url} autoPlay={playing} loop={e.loop??false} muted={!(e.sound??true)} preload={playing?"auto":"metadata"} onError={()=>setFailed(true)}/>{notice}</>;
 return <img src={asset.url} alt={asset.name} className={className} style={style}/>;
}
