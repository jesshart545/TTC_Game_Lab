"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameTool, Project } from '../lib/project';
import { bounded, cardDesign, cardPhase, linkedTimer, timerSeconds, type CardState } from '../lib/question-cards';
import './question-cards.css';
export function useCardClock(){const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),100);return()=>clearInterval(t);},[]);return now;}
export function FittedCard({project,tool,text,answer=false,phase='question',shownAt=Date.now()}: {project:Project;tool:GameTool;text:string;answer?:boolean;phase?:string;shownAt?:number}){
 const cfg=cardDesign(tool,answer),root=useRef<HTMLDivElement>(null),probe=useRef<HTMLDivElement>(null);
 const [box,setBox]=useState({x:5,y:20,width:90,height:30,font:28,padding:16});
 const [scale,setScale]=useState(1);
 useLayoutEffect(()=>{
  const host=root.current?.parentElement,p=probe.current;if(!host||!p)return;
  const fit=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
   const k=h/1080;setScale(k);
   const left=bounded(cfg.marginLeft,5,0,40)*w/100,right=bounded(cfg.marginRight,5,0,40)*w/100,top=bounded(cfg.marginTop,6,0,40)*h/100,bottom=bounded(cfg.marginBottom,6,0,40)*h/100;
   const maxW=Math.max(1,w-left-right),maxH=Math.max(1,h-top-bottom),pad=Math.min(bounded(cfg.padding,28,0,100)*k,maxW/6,maxH/6);
   let width=Math.min(maxW,bounded(cfg.width,65,1,100)*w/100),height=Math.min(maxH,bounded(cfg.height,25,1,100)*h/100),font=bounded(cfg.fontSize,48,12,160)*k;
   p.style.fontFamily=String(cfg.fontFamily||'Arial, sans-serif');
   const measure=(size:number,wide:number)=>{p.style.fontSize=size+'px';p.style.width=Math.max(1,wide-pad*2)+'px';return {height:p.scrollHeight+pad*2,width:p.scrollWidth+pad*2};};
   let needed=measure(font,width);
   // Grow only as much as this text requires; preserve whole words.
   if(needed.width>width){width=Math.min(maxW,needed.width);needed=measure(font,width);}
   while(needed.height>maxH&&width<maxW){width=Math.min(maxW,width+Math.max(1,w*.02));needed=measure(font,width);}
   height=Math.min(maxH,Math.max(height,needed.height));
   if(needed.height>maxH||needed.width>maxW){let lo=.05,hi=font;for(let n=0;n<24;n++){const mid=(lo+hi)/2,m=measure(mid,width);if(m.height<=height&&m.width<=width)lo=mid;else hi=mid;}font=lo;}
   const x=Math.max(left,Math.min(w-right-width,bounded(cfg.x,17.5,0,100)*w/100)),y=Math.max(top,Math.min(h-bottom-height,bounded(cfg.y,30,0,100)*h/100));
   setBox({x,y,width,height,font,padding:pad});
  };fit();const resize=new ResizeObserver(fit);resize.observe(host);let cancelled=false;void document.fonts.ready.then(()=>{if(!cancelled)fit();});return()=>{cancelled=true;resize.disconnect();};
 },[text,JSON.stringify(cfg)]);
 const asset=project.assets.find(a=>(a.storageKey||a.name)===cfg.backgroundKey);
 const duration=bounded(phase==='exit'?cfg.exitSeconds:cfg.entranceSeconds,.5,0,5),effect=String(phase==='exit'?cfg.exit:cfg.entrance||'fade');
 const delay=phase==='exit'?0:Math.max(0,bounded(cfg.delaySeconds,0,0,10)-(Date.now()-shownAt)/1000);
 const names:Record<string,string>={none:'',fade:'card-fade',left:'card-left',right:'card-right',top:'card-top',bottom:'card-bottom',zoom:'card-zoom',pop:'card-pop'};
 const style:CSSProperties={position:'absolute',left:box.x,top:box.y,width:box.width,height:box.height,padding:box.padding,boxSizing:'border-box',display:'flex',alignItems:cfg.vertical==='top'?'flex-start':cfg.vertical==='bottom'?'flex-end':'center',justifyContent:'center',color:String(cfg.textColor||'#ffffff'),backgroundColor:String(cfg.backgroundColor||'#101827'),backgroundImage:asset?.url?`url(${JSON.stringify(asset.url)})`:undefined,backgroundSize:'100% 100%',border:`${2*scale}px solid ${String(cfg.accentColor||'#20e8ff')}`,borderRadius:bounded(cfg.borderRadius,18,0,200)*scale,zIndex:50,fontFamily:String(cfg.fontFamily||'Arial, sans-serif'),fontSize:box.font,lineHeight:1.2,textAlign:(cfg.alignment||'center') as 'center',textShadow:Number(cfg.glow)?`0 0 ${Number(cfg.glow)*scale}px ${String(cfg.textColor||'#ffffff')}`:undefined,WebkitTextStroke:Number(cfg.outline)?`${Number(cfg.outline)*scale}px ${String(cfg.outlineColor||'#000000')}`:undefined,animation:names[effect]?`${names[effect]} ${duration}s ${delay}s both ${phase==='exit'?'reverse':'normal'}`:undefined};
 return <><div ref={probe} aria-hidden="true" className="card-measure">{text}</div><div ref={root} role="region" aria-label={answer?'Answer card':tool.type==='blank-card'?'Blank card':'Question card'} className="fitted-card" style={style}><div style={{width:'100%',whiteSpace:'pre-wrap',wordBreak:'normal',overflowWrap:'normal',hyphens:'none'}}>{text}</div></div></>;
}
export function StyledTimer({tool,remaining,total}:{tool:GameTool;remaining:number;total:number}){
 const a=(tool.config.appearance||{}) as Record<string,unknown>,p=(tool.config.placement||{x:15,y:78,width:20,height:12}) as Record<string,number>,mode=String(tool.config.display||'numbers');
 const fraction=Math.max(0,Math.min(1,remaining/total));
 return <section aria-label={String(tool.config.label||tool.name)} className="styled-timer" style={{left:bounded(p.x,15,0,95)+'%',top:bounded(p.y,78,0,95)+'%',width:bounded(p.width,20,1,100-bounded(p.x,15,0,95))+'%',height:bounded(p.height,12,1,100-bounded(p.y,78,0,95))+'%',color:String(a.textColor||'#ffffff'),background:String(a.backgroundColor||'#101827'),borderColor:String(a.accentColor||'#20e8ff'),borderRadius:bounded(a.borderRadius,12,0,200),fontFamily:String(a.fontFamily||'Arial, sans-serif')}}>
 <strong style={{fontSize:Math.max(4,Number(a.fontSize)||28)/28*16+"cqh"}}>{String(tool.config.label||tool.name)}</strong>{mode.includes('numbers')&&<span role="timer" style={{fontSize:Math.max(4,Number(a.fontSize)||28)/28*32+"cqh"}}>{Math.max(0,Math.ceil(remaining))}</span>}
 {mode.includes('bar')&&<div className="countdown-bar"><div style={{width:fraction*100+'%',background:String(a.accentColor||'#20e8ff')}}/></div>}
 {mode.includes('circle')&&<svg viewBox="0 0 100 100" aria-label={`${Math.ceil(remaining)} seconds remaining`}><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" opacity=".2" strokeWidth="8"/><circle cx="50" cy="50" r="40" fill="none" stroke={String(a.accentColor||'#20e8ff')} strokeWidth="8" strokeDasharray="251.33" strokeDashoffset={251.33*(1-fraction)} transform="rotate(-90 50 50)"/></svg>}
 </section>;
}
export default function QuestionCards({project,states}:{project:Project;states:Record<string,CardState>}){
 const now=useCardClock();return <>{project.gameTools.filter(t=>t.enabled&&t.inOverlayBuild&&(t.type==='question-card'||t.type==='blank-card')).map(tool=>{const state=states[tool.id];if(!state)return null;const phase=cardPhase(project,tool,state,now);if(phase==='hidden')return null;const answer=phase==='answer',turn=linkedTimer(project,tool),steal=linkedTimer(project,tool,true);
 return <div key={tool.id} style={{position:'absolute',inset:0,pointerEvents:'none'}}><FittedCard key={state.shownAt+'-'+phase} project={project} tool={tool} text={state.blankText||String(answer?state.question?.answer:state.question?.question)} answer={answer} phase={phase} shownAt={state.shownAt}/>{!answer&&tool.type==='question-card'&&<>{turn&&<StyledTimer tool={turn} total={timerSeconds(project,tool)} remaining={state.turnAt===null?timerSeconds(project,tool):Math.max(0,timerSeconds(project,tool)-(now-state.turnAt)/1000)}/>} {steal&&<StyledTimer tool={steal} total={timerSeconds(project,tool,true)} remaining={state.stealAt===null?timerSeconds(project,tool,true):Math.max(0,timerSeconds(project,tool,true)-(now-state.stealAt)/1000)}/>}</>}</div>;
 })}</>;
}
