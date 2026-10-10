import type {Project} from './project';
export type TimerState={visible:boolean;running:boolean;remaining:number;at:number};
export function timerAction(action:string){const match=/^timer\.(show|toggle|reset|hide)\.(.+)$/.exec(action);return match?{operation:match[1],toolId:match[2]}:null;}
export function timerTransition(previous:TimerState|undefined,operation:string,seconds:number,at:number):TimerState{
 const state=previous||{visible:false,running:false,remaining:seconds,at};
 const remaining=state.running?Math.max(0,state.remaining-(at-state.at)/1000):state.remaining;
 if(operation==='show')return {...state,visible:true,remaining,at};
 if(operation==='hide')return {...state,visible:false,running:false,remaining,at};
 if(operation==='reset')return {visible:state.visible,running:false,remaining:seconds,at};
 // toggle: show and start, or pause; restart from full duration when remaining is zero
 return {visible:true,running:!state.running,remaining:remaining>0?remaining:seconds,at};
}
export function timerShowOnlyIntent(text:string){
 return /\b(?:timer|countdown)\b/i.test(text)&&/\b(?:add|show|display|place|put)\b/i.test(text)&&/\b(?:overlay|screen|button)\b/i.test(text)&&(/\b(?:only|just)\b/i.test(text)||/\b(?:don.t|do not|without|shouldn.t|mustn.t|not)\b[^.\n]{0,35}\bstart/i.test(text)||/\b(?:separate|another|different)\s+button\b[^.\n]{0,40}\bstart/i.test(text));
}
/** Start + auto-hide (or streamline start/removal) without inventing sequence IDs. */
export function timerLifecycleIntent(text:string){
 if(timerShowOnlyIntent(text))return false;
 const mentionsTimer=/\b(?:timer|countdown|answer\s*timer)\b/i.test(text);
 if(!mentionsTimer)return false;
 const wantsStart=/\b(?:start|begin|run|trigger|press)\b/i.test(text)||/\bstreamline\b/i.test(text);
 const wantsHide=/\b(?:hide|remove|clear|dismiss|auto[- ]?hide|disappear)\b/i.test(text)||/\bwhen\b[^.\n]{0,80}\b(?:ends?|finishes?|expires?|zero|0)\b/i.test(text)||/\bafter\b[^.\n]{0,40}\b(?:seconds?|countdown|timer)\b/i.test(text)||/\bstreamline\b/i.test(text);
 return wantsStart&&wantsHide;
}
export function timerControlRequest(request:string,history:unknown,project:Project,selection?:{kind?:string;id?:string}|null){
 const recent=Array.isArray(history)?history.filter(item=>item?.role==='user').slice(-3).map(item=>String(item.text||'')).join('\n'):'';
 const correction=/^(?:no\b|that isn't|that isnt)/i.test(request.trim());
 const specific=/\b(?:timer|countdown)\b/i.test(request)&&/\b(?:add|show|display|place|put|start|stop|reset|update|change)\b/i.test(request);
 const text=correction&&!specific?recent.split('\n').reverse().find(line=>/\b(?:timer|countdown)\b/i.test(line))||request:request;
 if(timerLifecycleIntent(text)){
  const tools=project.gameTools.filter(t=>t.type==='countdown'&&t.enabled),selected=project.controls.find(c=>selection?.kind==='control'&&c.id===selection.id);
  const tool=tools.find(t=>selection?.kind==='tool'&&t.id===selection.id||selected?.toolIds?.includes(t.id))||(tools.length===1?tools[0]:undefined);
  if(!tool)return {reply:'Which timer should start and then hide when it ends? Select the timer in Build Space, or name it, then ask again.',changes:{},manualSteps:[],action:null};
  const seconds=Math.max(1,Math.min(86400,Number(tool.config.seconds)||10));
  return {reply:`Prepared a Start control for ${tool.name} that begins the ${seconds}s countdown, plus an automatic hide when time reaches zero. Manual Show, Pause, Reset and Hide buttons stay available.`,changes:{timerLifecycle:[{toolId:tool.id,autoHide:true}]},manualSteps:[],action:null};
 }
 if(!timerShowOnlyIntent(text))return null;
 const tools=project.gameTools.filter(t=>t.type==='countdown'&&t.enabled),selected=project.controls.find(c=>selection?.kind==='control'&&c.id===selection.id);
 const tool=tools.find(t=>selection?.kind==='tool'&&t.id===selection.id||selected?.toolIds?.includes(t.id))||(tools.length===1?tools[0]:undefined);
 if(!tool)return {reply:'Which timer should this button show? Select the timer in Build Space, then ask again.',changes:{},manualSteps:[],action:null};
 return {reply:'The Show Timer button will display the timer without starting or resetting it. A separate Start / Stop Timer button controls the countdown. Your saved duration stays unchanged.',changes:{timerControls:[{toolId:tool.id,...(selected?.toolIds?.includes(tool.id)?{controlId:selected.id}:{})}]},manualSteps:[],action:null};
}
