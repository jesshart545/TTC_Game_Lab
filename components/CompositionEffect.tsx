"use client";
import { useEffect,useRef } from "react";
import { drawCompositionEffect } from "../lib/composition-effects";
export default function CompositionEffect({name,time,opacity=1}:{name:string;time:number;opacity?:number}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const el=canvas.current;if(!el)return;const rect=el.getBoundingClientRect();el.width=Math.max(1,Math.round(rect.width));el.height=Math.max(1,Math.round(rect.height));const ctx=el.getContext("2d");if(!ctx)return;ctx.clearRect(0,0,el.width,el.height);drawCompositionEffect(ctx,name,time,el.width,el.height);},[name,time]);
 return <canvas ref={canvas} aria-label={name+" animated effect"} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",opacity}}/>;
}