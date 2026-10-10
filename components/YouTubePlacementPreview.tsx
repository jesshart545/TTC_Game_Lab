"use client";
import {useState} from 'react';
import type {YouTubePlacement,YouTubeVideo} from '../lib/youtube';
import YouTubePlacementEditor from './YouTubePlacementEditor';

export default function YouTubePlacementPreview({video,placement,onChange}:{video:YouTubeVideo;placement:YouTubePlacement;onChange:(value:YouTubePlacement)=>void}){
 const [dragPreview,setDragPreview]=useState<YouTubePlacement|null>(null);
 const shown=dragPreview||placement;
 return <section className="youtube-placement-preview" aria-label="Private video placement preview">
  <h4>Place your video before showing it</h4>
  <p>Drag the video to move it. Drag the bottom-right corner to resize it. This preview stays private.</p>
  <div className="youtube-placement-canvas" aria-label="1920 by 1080 overlay layout">
   <span className="youtube-placement-canvas-label">Overlay · 1920 × 1080</span>
   <div className="youtube-placement-thumbnail" style={{left:shown.x+'%',top:shown.y+'%',width:shown.width+'%',height:shown.height+'%'}}>
    <img src={video.thumbnail||`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt={video.title}/>
   </div>
   <YouTubePlacementEditor placement={placement} onChange={onChange} onPreviewChange={setDragPreview}/>
  </div>
  <p className="youtube-placement-dimensions">Position: {Math.round(shown.x*19.2)} px from left, {Math.round(shown.y*10.8)} px from top · Size: {Math.round(shown.width*19.2)} × {Math.round(shown.height*10.8)} px</p>
  <small>Placement applies the next time you press Play on overlay. You can adjust it again at any time before showing another clip.</small>
 </section>;
}
