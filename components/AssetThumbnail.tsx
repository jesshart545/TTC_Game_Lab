"use client";
import {useState} from "react";
import type {ProjectAsset} from "../lib/project";

export default function AssetThumbnail({asset,kind}:{asset:ProjectAsset;kind:"image"|"video"|"audio"|"other"}) {
 const [failed,setFailed]=useState(false);
 const visual=kind==="image"||kind==="video";
 return <span className="workshop-asset-preview">
  {visual&&asset.url&&!failed ? kind==="image" ? <img src={asset.url} alt="" loading="lazy" onError={()=>setFailed(true)}/> : <><video src={asset.url} muted playsInline preload="metadata" aria-hidden="true" onLoadedMetadata={event=>{const video=event.currentTarget;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(.1,video.duration/2);}} onError={()=>setFailed(true)}/><span className="workshop-video-badge" aria-hidden="true">▶</span></> : visual ? <span className="workshop-preview-missing">{failed?"Preview unavailable":"Preview loading"}</span> : <span aria-hidden="true">{kind==="audio"?"♫":"▤"}</span>}
 </span>;
}
