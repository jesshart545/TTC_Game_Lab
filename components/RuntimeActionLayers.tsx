"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {overlayAssetStyle} from "./OverlayAsset";
import {runSequence} from "../lib/sequences";
import type { Project, ProjectEvent, GameTool, ProjectAsset } from "../lib/project";
import {controlConnectionError} from "../lib/control-connections";
import {mediaKind} from "../lib/board-design";
import {WheelDisplay,DiceDisplay} from "./ChanceTools";
import {BoardSurface} from "./BoardDesigner";
import QuestionCards from './QuestionCards';
import {cardControl,cardTransition,freshCardState,type CardState,type CardAction} from '../lib/question-cards';
import CompositionPlayer, { defaultOverlayResult } from "./CompositionPlayer";
import { toolStyle, ToolArtwork, overlayToolPlacement } from "./GameToolEditor";

type Run = { exitingAt?:number; id: number; at: number; control: ProjectEvent; tool?: GameTool; asset?: ProjectAsset; compositionId?: string; message?: string; result?: string; question?: Record<string, unknown>; reveal?: boolean };
export function useRuntimeActions(project: Project | null,onCardStates?:(states:Record<string,CardState>)=>void) {
  const savedCallback=useRef(onCardStates);savedCallback.current=onCardStates;
  const initialized=useRef<string|null>(null);
  const cardRef=useRef<Record<string,CardState>>({});
  const [cardStates,setCardStates]=useState<Record<string,CardState>>({});
  const cardCommand=useCallback((id:string,action:CardAction,text='')=>{const p=latest.current,tool=p?.gameTools.find(t=>t.id===id&&t.enabled);if(!p||!tool)throw new Error('Card system unavailable.');const next=cardTransition(p,tool,cardRef.current[id]||freshCardState(),action,Date.now(),undefined,text);cardRef.current={...cardRef.current,[id]:next};setCardStates(cardRef.current);savedCallback.current?.(cardRef.current);},[]);
  const latest = useRef(project); latest.current = project;
  useEffect(()=>{if(project&&initialized.current!==project.id){initialized.current=project.id;cardRef.current=project.cardPreviewStates||{};setCardStates(cardRef.current);}},[project?.id]);
  const sequence=useRef<AbortController|null>(null);
  const [sequenceRunning,setSequenceRunning]=useState(false),[sequenceError,setSequenceError]=useState("");
  const stopSequence=useCallback(()=>{sequence.current?.abort();setSequenceRunning(false);},[]);
  useEffect(()=>()=>sequence.current?.abort(),[]);
  const serial = useRef(0); const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trivia = useRef<Record<string, number>>({});
  const [runs, setRuns] = useState<Run[]>([]);
  const [backgroundKey, setBackgroundKey] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const remove = useCallback((id: number) => setRuns(items => items.filter(item => item.id !== id)), []);
  const fire = useCallback(function fire(control: ProjectEvent,outcomes?:Record<string,{result:string;segments?:string[]}>) {
    const p = latest.current; if (!p) return;
    if(control.action==='sequence'){
      const error=controlConnectionError(p,control);if(error)throw new Error(error);
      sequence.current?.abort();const controller=new AbortController();sequence.current=controller;setSequenceRunning(true);setSequenceError('');
      void runSequence(p,control,async target=>{fire(target);},controller.signal).catch(e=>setSequenceError(e instanceof Error?e.message:'Sequence stopped.')).finally(()=>{if(sequence.current===controller)setSequenceRunning(false);});return;
    }
    if(control.action.startsWith("result.hide.")){
      const target=control.action.slice(12);
      setRuns(items=>items.map(item=>item.control.id===target?{...item,exitingAt:Date.now()}:item));
      const shown=p.controls.find(c=>c.id===target),seconds=shown?.overlayResult?.exitSeconds||0;
      const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);setRuns(items=>items.filter(item=>item.control.id!==target||!item.exitingAt));},Math.max(0,Math.min(5,seconds))*1000);timers.current.push(timer);return;
    }
    const connectionError=controlConnectionError(p,control);if(connectionError)throw new Error(connectionError);
    const legacyPicker=p.gameTools.find(t=>t.type==='random-picker'&&control.action===`tool.${t.id}`);if(legacyPicker){cardCommand(legacyPicker.id,'draw');return;}
    const card=cardControl(control.action);if(card){cardCommand(card.toolId,card.action,String(p.gameTools.find(t=>t.id===card.toolId)?.config.text||""));return;}
    const later = (fn: () => void, ms: number) => { const timer = setTimeout(() => { timers.current = timers.current.filter(x => x !== timer); fn(); }, ms); timers.current.push(timer); };
    const add = (entry: Omit<Run, "id" | "at" | "control">, seconds: number) => {
      const id = ++serial.current;
      setRuns(items => [...items.filter(item => entry.tool ? item.tool?.id !== entry.tool.id : entry.asset ? (item.asset?.storageKey || item.asset?.name) !== (entry.asset.storageKey || entry.asset.name) : true), { ...entry, id, at: Date.now(), control }]);
      if(Number.isFinite(seconds))later(() => remove(id), Math.max(1, seconds) * 1000);
    };
    if(control.action.startsWith('asset.show.')){const asset=p.assets.find(a=>(a.storageKey||a.name)===control.action.slice(11));if(asset)add({asset},Infinity);return;}
    const playTool = (id: string) => {
      const storedTool = latest.current?.gameTools.find(t => t.id === id && t.enabled && t.inToolbox);
      if (!storedTool) return;
      const chosen=outcomes?.[id];
      const tool=chosen?.segments?{...storedTool,config:{...storedTool.config,segments:chosen.segments}}:storedTool;
      if(tool.type==='random-picker'){cardCommand(id,'draw');return;}
      const config = tool.config;
      const choices = (Array.isArray(config.segments) ? config.segments : Array.isArray(config.items) ? config.items : ["Winner"]).map(String);
      let result = "";
      if (tool.type === "wheel") { if(!choices.length)throw new Error("Add choices to "+tool.name+" in Workshop."); result = choices[Math.floor(Math.random() * choices.length)]; }
      if (tool.type === "dice") result = String(1 + Math.floor(Math.random() * Math.min(100,Math.max(2, Math.floor(Number(config.sides) || 6)))));
      if (tool.type === "trivia-list") {
        const questions = Array.isArray(config.questions) ? config.questions : [];
        const turn = trivia.current[id] || 0; trivia.current[id] = turn + 1;
        const question = questions[Math.floor(turn / 2) % Math.max(1, questions.length)];
        add({ tool, question, reveal: turn % 2 === 1 }, 60); return;
      }
      if(chosen)result=chosen.result;
      add({ tool, result }, tool.config.triggerOnly ? Infinity : tool.type === "countdown" ? Math.max(1, Number(config.seconds) || 10) + 3 : tool.type === "poll" ? 3600 : 12);
    };
    if (control.action.startsWith("background.show.")) { setBackgroundKey(control.action.slice("background.show.".length)); return; }
    if (control.action.startsWith("alert.") && p.overlay.showAlerts) add({ message: control.label }, 5);
    if (control.action === "wheel.spin" && p.wheel?.enabled) {
      const legacy: GameTool = { id: "legacy-wheel", type: "wheel", name: p.wheel.title, enabled: true, config: { title: p.wheel.title, segments: p.wheel.segments } };
      add({ tool: legacy, result: p.wheel.segments[Math.floor(Math.random() * p.wheel.segments.length)] }, 12);
    }
    (control.toolIds || []).forEach(playTool);
    if (control.compositionId && p.compositions?.some(c => c.id === control.compositionId && c.inProject)) {
      add({ compositionId: control.compositionId }, p.compositions.find(c => c.id === control.compositionId)!.duration + 1);
    }
    let elapsed = 0;
    for (const step of control.buttonMode === "chain" ? control.chain || [] : []) {
      elapsed += step.timing.mode === "delay" ? Math.max(0, Number(step.timing.seconds) || 0) * 1000 : 0;
      const execute = () => {
        const current = latest.current; if (!current) return;
        if (step.kind === "tool") playTool(step.refId);
        if (step.kind === "asset") {
          const asset = current.assets.find(a => a.inProject && (a.storageKey === step.refId || a.name === step.refId));
          if (asset) add({ asset }, Math.max(8, Number(asset.edits?.trimEnd) || 60));
        }
        if (step.kind === "composition") {
          const composition = current.compositions?.find(c => c.id === step.refId && c.inProject);
          if (composition) add({ compositionId: composition.id }, composition.duration + 1);
        }
        if (step.kind === "animation") { setFlash(true); later(() => setFlash(false), 700); }
      };
      if (elapsed) later(execute, elapsed); else execute();
    }
    if (!control.toolIds?.length && !control.compositionId && !control.chain?.length) { setFlash(true); later(() => setFlash(false), 700); }
  }, [remove,cardCommand]);
  return { runs, backgroundKey, flash, fire, remove,cardStates,cardCommand,sequenceRunning,sequenceError,stopSequence };
}


function PollRun({tool,controlId,slug,live}:{tool:GameTool;controlId:string;slug:string;live:boolean}) {
 const options=Array.isArray(tool.config.options)?tool.config.options.map(String):[];
 const [counts,setCounts]=useState<number[]>(options.map(()=>0));
 const [voted,setVoted]=useState<number|null>(null);
 const [eventId,setEventId]=useState<number|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const endpoint=`/api/live/${encodeURIComponent(slug)}/poll/${encodeURIComponent(tool.id)}?control=${encodeURIComponent(controlId)}`;
 const apply=useCallback((data:{eventId:number;counts:{option:number;votes:number}[];voted:number|null})=>{
   setCounts(options.map((_,i)=>data.counts.find(row=>row.option===i)?.votes || 0));setVoted(data.voted);setEventId(data.eventId);setError("");
 },[options.length]);
 useEffect(()=>{
   if(!live)return;
   let cancelled=false;let timer:ReturnType<typeof setTimeout>;
   const refresh=async()=>{try{const response=await fetch(endpoint,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error || "Unable to load votes.");if(!cancelled)apply(data);}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Unable to load votes.");}finally{if(!cancelled)timer=setTimeout(refresh,1000);}};
   void refresh();return()=>{cancelled=true;clearTimeout(timer);};
 },[live,endpoint,apply]);
 async function vote(option:number) {
   if(voted!==null || busy)return;
   if(!live){setCounts(values=>values.map((n,i)=>i===option?n+1:n));setVoted(option);return;}
   setBusy(true);
   try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({option,eventId})});const data=await response.json();if(!response.ok)throw new Error(data.error || "Vote failed.");apply(data);}catch(e){setError(e instanceof Error?e.message:"Vote failed.");}finally{setBusy(false);}
 }
 return <><strong>{String(tool.config.question || tool.name)}</strong><div>{options.map((option,i)=><button key={i} disabled={busy || voted!==null || (live && eventId===null)} onClick={()=>void vote(i)} style={{display:"block",width:"100%",marginTop:8,padding:8,color:"inherit",background:"transparent",border:"1px solid currentColor"}}>{option} · {counts[i]} votes{voted===i?" ✓":""}</button>)}</div>{voted!==null && <p role="status">Vote recorded</p>}{error && <p role="alert">{error}</p>}</>;
}

function ToolRun({ run, assets, index, count, live, slug }: { run: Run; assets: ProjectAsset[]; index: number; count: number; live: boolean; slug: string }) {
  const tool = run.tool!; const [now, setNow] = useState(run.at);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  const config = tool.config; const remaining = Math.max(0, Math.ceil((Number(config.seconds) || 10) - (now - run.at) / 1000));
  const placement=run.control.overlayResult;
  const revealResult = now - run.at >= 1800;
  return <section aria-label={tool.name} style={{ position:"absolute", left:"20%", top:`${12 + index * (76 / Math.max(1,count))}%`, width:"60%", padding:"1rem", zIndex:30, ...toolStyle(tool), maxHeight:`${76 / Math.max(1,count) - 3}%`, overflow:"auto", ...overlayToolPlacement(tool), ...(placement?{left:placement.x+"%",top:placement.y+"%",width:placement.width+"%",height:placement.height+"%",maxHeight:"none",zIndex:placement.layer}: {}) }}>
    <ToolArtwork tool={tool} assets={assets}/><h3>{String(config.title || tool.name)}</h3>
    {tool.type === "wheel" && <WheelDisplay colors={[String(config.slotColor||"#154c69"),String(config.alternateSlotColor||"#512b75")]} textColor={String((config.appearance as Record<string,unknown>)?.textColor||"#ffffff")} entries={(Array.isArray(config.segments)?config.segments:[]).map(String)} result={run.result||""} elapsed={now-run.at} preview={run.id===0}/>}
    {tool.type === "random-picker" && <><div>{(Array.isArray(config.segments) ? config.segments : Array.isArray(config.items) ? config.items : []).map(String).join(" · ")}</div><strong role="status">{revealResult ? run.result : "Choosing…"}</strong></>}
    {tool.type === "countdown" && <strong role="timer">{remaining === 0 ? "Time's up!" : remaining}</strong>}
    {tool.type === "dice" && <DiceDisplay faceColor={String(config.faceColor||"#f5faff")} pipColor={String(config.pipColor||"#102132")} result={Number(run.result)||1} sides={Math.min(100,Math.max(2,Math.floor(Number(config.sides)||6)))} elapsed={now-run.at} preview={run.id===0}/>}
    {tool.type === "poll" && <PollRun tool={tool} controlId={run.control.id} slug={slug} live={live}/>}
    {tool.type === "trivia-board" && <div className="runtime-jeopardy-grid">{(Array.isArray(config.categories)?config.categories:[]).map((category:any,i:number)=><div key={i}><strong>{String(category.name)}</strong>{(Array.isArray(category.questions)?category.questions:[]).map((q:any,j:number)=><p key={j}>{q.used?'USED':String(q.value)}</p>)}</div>)}</div>}
    {tool.type === "trivia-list" && <><p>{String(run.question?.question || run.question?.prompt || "No questions saved")}</p>{run.reveal && <strong>Answer: {String(run.question?.answer || "")}</strong>}</>}
  </section>;
}

export function ControlAppearancePreview({control,project}:{control:ProjectEvent;project:Project}) {
 const tool=project.gameTools.find(t=>control.toolIds?.includes(t.id)&&t.type!=="youtube");
 const asset=control.action.startsWith('asset.show.')?project.assets.find(a=>(a.storageKey||a.name)===control.action.slice(11)):undefined;
 if(asset){const r=control.overlayResult||defaultOverlayResult;return <div aria-label="Appearance preview only" style={{position:'absolute',left:r.x+'%',top:r.y+'%',width:r.width+'%',height:r.height+'%',pointerEvents:'none'}}>{mediaKind(asset)==='video'?<video src={asset.url} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/>:mediaKind(asset)==='audio'?<p>{asset.name} · audio</p>:<img src={asset.url} alt={asset.name} style={{width:'100%',height:'100%',objectFit:'contain'}}/>}</div>;}
 if(!tool)return null;
 const questions=Array.isArray(tool.config.questions)?tool.config.questions:[];
 const run:Run={id:0,at:Date.now(),control,tool,question:questions[0],reveal:false,result:String((Array.isArray(tool.config.items)?tool.config.items[0]:null)||"Preview")};
 return <div style={{position:"absolute",inset:0,pointerEvents:"none"}}><ToolRun run={run} assets={project.assets} index={0} count={1} live={false} slug={project.slug}/></div>;
}


function MediaRun({asset,onEnd}:{asset:ProjectAsset;onEnd:()=>void}) {
  const media=useRef<HTMLMediaElement|null>(null);
  const [blocked,setBlocked]=useState(false);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{const element=media.current;if(element){element.volume=Math.max(0,Math.min(1,(asset.edits?.volume??80)/100));element.muted=!(asset.edits?.sound??["audio","video"].includes(mediaKind(asset)));element.loop=asset.edits?.loop??false;void element.play().catch(()=>setBlocked(true));}},[asset.edits?.volume,asset.edits?.sound,asset.edits?.loop]);
  const start=()=>{void media.current?.play().then(()=>setBlocked(false)).catch(()=>setFailed(true));};
  return <>{mediaKind(asset)==="video" ? <video ref={media as import("react").Ref<HTMLVideoElement>} aria-label={asset.name} src={asset.url} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"contain"}} onEnded={onEnd} onError={()=>setFailed(true)}/> : <audio ref={media as import("react").Ref<HTMLAudioElement>} aria-label={asset.name} src={asset.url} autoPlay onEnded={onEnd} onError={()=>setFailed(true)}/>}
    {blocked && !failed && <button onClick={start} style={{position:"absolute",left:"30%",top:"80%",zIndex:60}}>Enable audio</button>}
    {failed && <p role="alert">Unable to play {asset.name}. Reload the overlay to refresh its media.</p>}
  </>;
}

function motionStyle(run:Run):import("react").CSSProperties{
 const result=run.control.overlayResult,exit=!!run.exitingAt,mode=exit?result?.exit:result?.entrance,seconds=exit?result?.exitSeconds:result?.entranceSeconds;
 if(!mode||mode==='none'||!seconds)return {};
 return {animation:`overlay-${mode} ${Math.min(5,seconds)}s ${exit?'reverse':'normal'} both`};
}

export default function RuntimeActionLayers({ runtime, project, live = false }: { runtime: ReturnType<typeof useRuntimeActions>; project: Project; live?: boolean }) {
  const toolRuns=runtime.runs.filter(run=>run.tool);
  return <><QuestionCards project={project} states={runtime.cardStates}/>{toolRuns.map((run,index)=><ToolRun key={run.id} run={run} assets={project.assets} index={index} count={toolRuns.length} live={live} slug={project.slug}/>)}{runtime.runs.filter(run=>run.message).map(run=><div key={run.id} role="status" style={{position:"absolute",left:"20%",top:"10%",width:"60%",zIndex:40,padding:"1rem",background:"#101b32",color:"white",textAlign:"center"}}>{run.message}</div>)}{runtime.flash && <div aria-label="Triggered effect" style={{position:"absolute",inset:0,background:"#20e8ff44",zIndex:50,pointerEvents:"none"}}/>}
    {project.gameTools.filter(t=>t.enabled&&t.inOverlayBuild&&t.type==='blank-board'&&!t.config.triggerOnly).map(tool=><section key={tool.id} aria-label={tool.name} style={{position:'absolute',inset:0,zIndex:5}}><BoardSurface tool={tool} project={project}/></section>)}
    {runtime.runs.map(run => run.tool ? null : run.compositionId ? (() => {
      const composition = project.compositions?.find(c => c.id === run.compositionId);
      return composition ? <CompositionPlayer key={run.id} composition={composition} assets={project.assets} placement={run.control.overlayResult || defaultOverlayResult} startedAt={run.at} onEnd={() => runtime.remove(run.id)}/> : null;
    })() : run.asset ? <div key={run.id} style={{position:"absolute",...(run.control.overlayResult?{left:run.control.overlayResult.x+"%",top:run.control.overlayResult.y+"%",width:run.control.overlayResult.width+"%",height:run.control.overlayResult.height+"%"}:{inset:0}),zIndex:run.control.overlayResult?.layer??20,...motionStyle(run)}}>{["video","audio"].includes(mediaKind(run.asset)) ? <MediaRun asset={run.asset} onEnd={()=>runtime.remove(run.id)}/> : <img src={run.asset.url} alt={run.asset.name} style={{width:"100%",height:"100%",objectFit:"contain",...overlayAssetStyle({...run.asset,edits:{...run.asset.edits,placement:undefined}})}}/>}</div> : null)}
  </>;
}


