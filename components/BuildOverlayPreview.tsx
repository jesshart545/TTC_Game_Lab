"use client";
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

export default function BuildOverlayPreview({children}:{children:ReactNode}){
 const frame=useRef<HTMLDivElement>(null),[width,setWidth]=useState(0);
 useLayoutEffect(()=>{
  const element=frame.current;if(!element)return;
  const measure=()=>setWidth(element.getBoundingClientRect().width);
  measure();const Observer=element.ownerDocument.defaultView?.ResizeObserver;
  if(!Observer)return;
  const observer=new Observer(measure);observer.observe(element);return()=>observer.disconnect();
 },[]);
 return <div ref={frame} className="build-overlay-preview-frame" aria-label="1920 by 1080 overlay preview"><div className="build-overlay-preview-native" style={{transform:`scale(${width/1920})`,visibility:width?'visible':'hidden'}}>{children}</div></div>;
}
