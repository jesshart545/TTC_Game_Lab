"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { ProjectAsset } from "../lib/project";
export function overlayAssetStyle(asset: ProjectAsset): CSSProperties {
 const e=asset.edits || {}, placement=e.placement;
 return { ...(placement ? {position:"absolute",left:placement.x+"%",top:placement.y+"%",width:placement.width+"%",height:placement.height+"%",maxWidth:"none",maxHeight:"none",right:"auto",bottom:"auto"} : {}), transform:`translate(${e.offsetX||0}px,${e.offsetY||0}px) scale(${e.zoom||1}) rotate(${e.rotation||0}deg) scaleX(${e.flipX?-1:1}) scaleY(${e.flipY?-1:1})`,opacity:e.opacity??1,filter:`brightness(${e.brightness??100}%) contrast(${e.contrast??100}%) saturate(${e.saturation??100}%) blur(${e.blur??0}px)` };
}
export default function OverlayAsset({asset,background=false,className}:{asset:ProjectAsset;background?:boolean;className?:string}) {
 const media=useRef<HTMLVideoElement & HTMLAudioElement>(null);
 const kind=(asset.type+" "+asset.name+" "+(asset.url||"").split("?")[0]).toLowerCase();
 const video=kind.includes("video") || /\.(mp4|webm|mov)(?:$|\s)/.test(kind),audio=kind.includes("audio") || /\.(mp3|wav|ogg)(?:$|\s)/.test(kind);
 const e=asset.edits||{};
 useEffect(()=>{if(media.current)media.current.volume=Math.max(0,Math.min(100,e.volume??80))/100;},[e.volume,asset.url]);
 const style:CSSProperties={...overlayAssetStyle(asset),...(background?{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none"}:{objectFit:"contain"})};
 if(video)return <video ref={media} aria-label={asset.name} src={asset.url} className={className} style={style} autoPlay playsInline loop={e.loop??true} muted={!(e.sound??false)}/>;
 if(audio)return <audio ref={media} aria-label={asset.name} src={asset.url} autoPlay loop={e.loop??false} muted={!(e.sound??true)}/>;
 return <img src={asset.url} alt={asset.name} className={className} style={style}/>;
}
