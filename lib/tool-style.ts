import {resolveFont} from './fonts';
import type {CSSProperties} from "react";
import type {GameTool} from "./project";
export function toolTitle(tool:GameTool){return String((tool.type==='countdown'?tool.config.label:tool.config.title)??tool.name);}
export function toolShowsTitle(tool:GameTool){return (tool.config.appearance as Record<string,unknown>|undefined)?.showTitle!==false&&tool.config.showTitle!==false&&toolTitle(tool).trim()!=='';}
export function toolStyle(tool:GameTool):CSSProperties {const a=(tool.config.appearance||{}) as Record<string,unknown>;return {boxSizing:"border-box",color:String(a.textColor||"#ffffff"),backgroundColor:a.transparentBackground===true?"transparent":String(a.backgroundColor||"#101827"),border:a.showBorder===false?"none":"2px solid "+String(a.accentColor||"#20e8ff"),fontFamily:resolveFont(a.fontFamily),fontSize:Math.max(12,Math.min(96,Number(a.fontSize)||28)),borderRadius:a.shape==='rectangle'?0:a.shape==='circle'||a.shape==='oval'?'50%':Math.max(0,Math.min(64,Number.isFinite(Number(a.borderRadius))?Number(a.borderRadius):12)),padding:16};}
export function overlayToolPlacement(tool:GameTool):CSSProperties {
 const p=tool.config.placement as Record<string,unknown>|undefined;if(!p)return {};
 const bound=(v:unknown,d:number,min:number,max:number)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
 const x=bound(p.x,15,0,99),y=bound(p.y,15,0,99),width=bound(p.width,70,1,100-x),height=bound(p.height,60,1,100-y);
 return {position:"absolute",left:x+"%",top:y+"%",width:width+"%",height:height+"%",right:"auto",bottom:"auto",maxWidth:"none",maxHeight:"none"};
}
