"use client";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {WheelDisplay,DiceDisplay} from "./ChanceTools";
import {CountdownDesignPreview} from "./QuestionCardEditor";
import type { Project } from "../lib/project";
import type { GameTool, ProjectAsset } from "../lib/project";

const fonts = ["Arial, sans-serif", "Georgia, serif", "Verdana, sans-serif", "Trebuchet MS, sans-serif", "monospace"];
export function toolStyle(tool: GameTool): CSSProperties {
  const a = (tool.config.appearance || {}) as Record<string, unknown>;
  return { color: String(a.textColor || "#ffffff"), backgroundColor: String(a.backgroundColor || "#101827"), border: "2px solid " + String(a.accentColor || "#20e8ff"), fontFamily: fonts.includes(String(a.fontFamily)) ? String(a.fontFamily) : fonts[0], fontSize: Math.max(12, Math.min(96, Number(a.fontSize) || 28)), borderRadius: Math.max(0, Math.min(64, Number(a.borderRadius) || 12)), padding: 16 };
}
export function overlayToolPlacement(tool:GameTool):CSSProperties {
 const p=tool.config.placement as {x:number;y:number;width:number;height:number}|undefined;
 return p?{position:"absolute",left:p.x+"%",top:p.y+"%",width:p.width+"%",height:p.height+"%",right:"auto",bottom:"auto",maxWidth:"none",maxHeight:"none"}:{};
}
export function ToolArtwork({tool, assets}: {tool:GameTool;assets:ProjectAsset[]}) {
  const a=(tool.config.appearance || {}) as Record<string,unknown>;
  const asset=assets.find(x=>(x.storageKey || x.name)===(a.imageKey || tool.config.backgroundAssetKey));
  return asset?.url ? <img src={asset.url} alt={asset.name} style={{width:"100%",maxHeight:140,objectFit:"contain"}}/> : null;
}
export default function GameToolEditor({tool,assets,onSave,project}: {tool:GameTool;assets:ProjectAsset[];project?:Project;onSave:(next:GameTool)=>void}) {
  const [draft,setDraft]=useState(tool);
  const [saved,setSaved]=useState(false);
  const cfg=draft.config;
  const a=(cfg.appearance || {}) as Record<string,unknown>;
  const update=(patch:Record<string,unknown>)=>{setDraft(x=>({...x,config:{...x.config,...patch}}));setSaved(false)};
  const appearance=(patch:Record<string,unknown>)=>update({appearance:{...a,...patch}});
  const list=(key:string,label:string,defaults:string[]) => <label>{label}<textarea value={(Array.isArray(cfg[key]) ? cfg[key] as string[] : defaults).join("\n")} onChange={e=>update({[key]:e.target.value.split("\n")})}/><small>One item per line.</small></label>;
  const images=assets.filter(x=>x.url && (x.type.toLowerCase().includes("image") || /\.(png|jpe?g|webp|gif|svg)$/i.test(x.name)));
  let content:ReactNode=draft.name;
  if(draft.type==="countdown") content=String(cfg.seconds ?? 10)+" seconds";
  if(draft.type==="dice") content=<DiceDisplay faceColor={String(cfg.faceColor||"#f5faff")} pipColor={String(cfg.pipColor||"#102132")} result={1} sides={Number(cfg.sides)||6} preview/>;
  if(draft.type==="wheel" || draft.type==="random-picker") content=(Array.isArray(cfg[draft.type==="wheel"?"segments":"items"]) ? cfg[draft.type==="wheel"?"segments":"items"] as string[] : []).join(" · ");
  if(draft.type==="wheel") content=<WheelDisplay colors={[String(cfg.slotColor||"#154c69"),String(cfg.alternateSlotColor||"#512b75")]} textColor={String(a.textColor||"#ffffff")} entries={(Array.isArray(cfg.segments)?cfg.segments:[]).map(String)} result="" preview/>;
  if(draft.type==="poll") content=<><strong>{String(cfg.question || "Live Poll")}</strong><div>{(Array.isArray(cfg.options)?cfg.options as string[]:[]).join(" · ")}</div></>;
  return <details style={{width:"100%",marginTop:8}}><summary style={{cursor:"pointer",color:"#20e8ff"}}>Edit appearance and settings</summary><div style={{display:"grid",gap:10,paddingTop:12}}>
    <label>Tool name<input value={draft.name} onChange={e=>{setDraft({...draft,name:e.target.value});setSaved(false)}}/></label>
    {(["backgroundColor","textColor","accentColor"] as const).map(key=><label key={key}>{key==="backgroundColor"?"Background color":key==="textColor"?"Text color":"Accent color"}<input type="color" value={String(a[key] || (key==="backgroundColor"?"#101827":key==="textColor"?"#ffffff":"#20e8ff"))} onChange={e=>appearance({[key]:e.target.value})}/></label>)}
    <label>Font<select value={String(a.fontFamily || fonts[0])} onChange={e=>appearance({fontFamily:e.target.value})}>{fonts.map(font=><option key={font} value={font}>{font.split(",")[0]}</option>)}</select></label>
    <label>Text size<input type="number" min={12} max={96} value={Number(a.fontSize)||28} onChange={e=>appearance({fontSize:Math.max(12,Math.min(96,+e.target.value))})}/></label>
    <label>Corner rounding<input type="number" min={0} max={64} value={Number(a.borderRadius)||0} onChange={e=>appearance({borderRadius:Math.max(0,Math.min(64,+e.target.value))})}/></label>
    <label>Tool image<select value={String(a.imageKey || "")} onChange={e=>appearance({imageKey:e.target.value})}><option value="">No image</option>{images.map((x,i)=><option key={(x.storageKey || x.name)+i} value={x.storageKey || x.name}>{x.name}</option>)}</select><small>Upload or generate an image in Workshop, then select it here.</small></label>
    {draft.type==="wheel"&&<>{["slotColor","alternateSlotColor"].map((key,i)=><label key={key}>{i?"Alternate slot color":"Slot color"}<input type="color" value={String(cfg[key]||["#154c69","#512b75"][i])} onChange={e=>update({[key]:e.target.value})}/></label>)}</>}
    {draft.type==="dice"&&<>{["faceColor","pipColor"].map((key,i)=><label key={key}>{i?"Dice pips / number color":"Dice face color"}<input type="color" value={String(cfg[key]||["#f5faff","#102132"][i])} onChange={e=>update({[key]:e.target.value})}/></label>)}</>}
    {draft.type==="wheel" && list("segments","Wheel segments",["Prize","Bonus"])}
    {draft.type==="random-picker" && list("items","Picker entries",["Player 1","Player 2"])}
    {draft.type==="poll" && <><label>Poll question<input value={String(cfg.question || "")} onChange={e=>update({question:e.target.value})}/></label>{list("options","Poll choices",["Option A","Option B"])}</>}
    {draft.type==="countdown" && <><label>Timer label<input value={String(cfg.label||draft.name)} onChange={e=>update({label:e.target.value})}/></label><label>Countdown display<select value={String(cfg.display||"numbers")} onChange={e=>update({display:e.target.value})}>{[["numbers","Numbers"],["bar","Draining bar"],["circle","Circular countdown"],["numbers-bar","Numbers and bar"],["numbers-circle","Numbers and circle"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Duration in seconds<input type="number" min={1} max={86400} value={Number(cfg.seconds)||10} onChange={e=>update({seconds:Math.max(1,Math.min(86400,+e.target.value))})}/></label><div style={{display:"grid",gap:8}}>{(["x","y","width","height"] as const).map((key,i)=><label key={key}>{["Left %","Top %","Width %","Height %"][i]}<input type="number" min={key==="width"||key==="height"?1:0} max={100} value={Number((cfg.placement as Record<string,number>|undefined)?.[key]??[15,78,20,12][i])} onChange={e=>update({placement:{...((cfg.placement as Record<string,number>)||{x:15,y:78,width:20,height:12}),[key]:Number(e.target.value)}})}/></label>)}</div>{project&&<CountdownDesignPreview project={project} tool={draft}/>}</>}
    {draft.type==="dice" && <label>Number of sides<input type="number" min={2} max={100} value={Number(cfg.sides)||6} onChange={e=>update({sides:Math.max(2,Math.min(100,+e.target.value))})}/></label>}
    <div aria-label="Tool appearance preview" style={toolStyle(draft)}><ToolArtwork tool={draft} assets={assets}/><strong>{draft.name}</strong><div>{content}</div></div>
    <small>Appearance preview. Save to store these settings in the toolbox; publish from Build Space to update the live tool.</small>
    <button type="button" className="build-btn" onClick={()=>{const clean={...draft,config:{...draft.config}};for(const key of ["segments","items","options"]){if(Array.isArray(clean.config[key]))clean.config[key]=(clean.config[key] as string[]).map(x=>x.trim()).filter(Boolean)}onSave({...clean,inToolbox:tool.type!=="trivia-board" && tool.type!=="blank-board"?true:tool.inToolbox});setSaved(true)}}>Save tool</button>{saved && <small role="status">Tool settings saved to draft.</small>}
  </div></details>;
}

