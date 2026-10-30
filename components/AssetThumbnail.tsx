"use client";
import {memo,useEffect,useRef,useState} from "react";
import type {ProjectAsset} from "../lib/project";
import type {AssetKind} from "../lib/asset-folders";

function AssetThumbnail({asset,kind}:{asset:ProjectAsset;kind:AssetKind}) {
 const [failed,setFailed]=useState(false);
 const frame=useRef<HTMLSpanElement>(null);
 const [videoVisible,setVideoVisible]=useState(false);
 useEffect(()=>{
  setFailed(false);
  setVideoVisible(false);
  const element=frame.current;
  if(kind!=="video"||!asset.url||!element)return;
  const Observer=element.ownerDocument.defaultView?.IntersectionObserver;
  if(!Observer){setVideoVisible(true);return;}
  const observer=new Observer(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVideoVisible(true);observer.disconnect();}},{rootMargin:"200px"});
  observer.observe(element);
  return()=>observer.disconnect();
 },[kind,asset.url]);
 const visual=kind==="image"||kind==="video";
 return <span ref={frame} className="workshop-asset-preview">
  {visual&&asset.url&&!failed&&(kind!=="video"||videoVisible) ? kind==="image" ? <img src={asset.url} alt="" loading="lazy" onError={()=>setFailed(true)}/> : <><video src={asset.url} muted playsInline preload="metadata" aria-hidden="true" onLoadedMetadata={event=>{const video=event.currentTarget;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(.1,video.duration/2);}} onError={()=>setFailed(true)}/><span className="workshop-video-badge" aria-hidden="true">▶</span></> : visual ? <span className="workshop-preview-missing">{failed?"Preview unavailable":"Preview loading"}</span> : <span aria-hidden="true">{kind==="audio"||kind==="music"||kind==="voice"||kind==="sfx"?"♫":"▤"}</span>}
 </span>;
}

export default memo(AssetThumbnail);
