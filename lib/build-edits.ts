import {controlConnectionError} from './control-connections';
import type {ProjectEvent} from './project';
import type {Project,GameToolType} from './project';
import {applyDraftChanges,normalizeDraftChanges} from './draft-edit';
import {addCreationControl} from './build-controls';
import {toolDefaults} from './game-tools';
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export const creatableTools:GameToolType[]=['wheel','random-picker','countdown','poll','dice','coin-toss','blank-board','youtube','scoreboard','prize-list','game-tool-list','card-list'];
export function applyBuildChanges(project:Project,input:unknown){
 const changes=normalizeDraftChanges(input),warnings:string[]=[];let extra=0;
 let next={...project,gameTools:[...project.gameTools],assetPools:(project.assetPools||[]).map(p=>({...p,assetKeys:[...p.assetKeys]}))};
 const created:string[]=[];
 for(const raw of Array.isArray(changes.newTools)?changes.newTools:[]){
  const item=record(raw);if(!creatableTools.includes(item.type)){warnings.push('That tool type is unavailable.');continue;}
  const id=crypto.randomUUID();next.gameTools.push({id,type:item.type,name:String(item.name||item.type).slice(0,80),enabled:true,inToolbox:item.type!=='card-list',config:{...toolDefaults(item.type),...record(item.config),...(item.type==='card-list'?{entries:(Array.isArray(item.config?.entries)?item.config.entries:[]).filter((e:any)=>typeof e?.text==='string'&&e.text.trim()).map((e:any)=>({...e,id:crypto.randomUUID()})),cards:(Array.isArray(item.config?.cards)?item.config.cards:[]).filter((c:any)=>typeof c?.text==='string'&&c.text.trim()).slice(0,100).map((c:any)=>({...c,id:crypto.randomUUID(),design:record(c.design)}))}:{})}});extra++;if(item.connect===true)created.push(id);
 }
 for(const raw of Array.isArray(changes.assetPools)?changes.assetPools:[]){
  const item=record(raw),keys=Array.isArray(item.assetKeys)?item.assetKeys.filter((key:unknown)=>typeof key==='string'&&next.assets.some(a=>(a.storageKey||a.name)===key)):null;
  const pool=next.assetPools.find(p=>p.id===item.id);
  if(pool){if(typeof item.name==='string'&&item.name.trim())pool.name=item.name.trim().slice(0,80);if(keys)pool.assetKeys=[...new Set<string>(keys)];extra++;}
  else if(!item.id&&typeof item.name==='string'&&item.name.trim()){next.assetPools.push({id:crypto.randomUUID(),name:item.name.trim().slice(0,80),assetKeys:[...new Set<string>(keys||[])]});extra++;}
  else warnings.push('The requested asset pool could not be found.');
 }
 for(const raw of Array.isArray(changes.coinCycles)?changes.coinCycles:[]){
  const item=record(raw),coin=next.gameTools.find(tool=>tool.id===item.toolId&&tool.type==='coin-toss'&&tool.enabled);
  if(!coin){warnings.push('Choose an existing Coin Toss tool for this three-press button.');continue;}
  const existing=item.controlId?next.controls.find(control=>control.id===item.controlId):next.controls.find(control=>control.action===`tool.${coin.id}`||control.action===`coin.cycle.${coin.id}`);
  if(item.controlId&&!existing){warnings.push('The coin button could not be found.');continue;}
  const linked=existing?{project:{...next,gameTools:next.gameTools.map(tool=>tool.id===coin.id?{...tool,inToolbox:true,inOverlayBuild:true,config:{...tool.config,triggerOnly:true}}:tool)},controlId:existing.id}:addCreationControl(next,'tool',coin.id);next={...linked.project,assetPools:next.assetPools};
  const target=existing||next.controls.find(control=>control.id===linked.controlId)!;
  const cycle={...target,action:`coin.cycle.${coin.id}`,toolIds:[coin.id],buttonMode:'single' as const,chain:undefined,compositionId:undefined,label:typeof item.label==='string'?item.label.slice(0,80):target.label===`Flip ${coin.name}`?coin.name:target.label,detail:'Press once to show the coin; again to flip and reveal; a third time to remove. Then repeat.'};
  next.controls=next.controls.map(control=>control.id===target.id?cycle:control).filter(control=>{
   if(control.action!==`result.hide.${target.id}`&&!(target.id!==linked.controlId&&control.id===linked.controlId))return true;
   return next.controls.some(other=>other.chain?.some(step=>step.refId===control.id));
  });extra++;
 }
 for(const raw of Array.isArray(changes.timerControls)?changes.timerControls:[]){
  const item=record(raw),tool=next.gameTools.find(t=>t.id===item.toolId&&t.type==='countdown'&&t.enabled);
  if(!tool){warnings.push('Choose an existing countdown timer.');continue;}
  const target=item.controlId?next.controls.find(c=>c.id===item.controlId):next.controls.find(c=>c.action===`timer.show.${tool.id}`||c.action===`tool.${tool.id}`);
  if(item.controlId&&(!target||!target.toolIds?.includes(tool.id))){warnings.push('The selected button is not connected to this timer.');continue;}
  const show={...target,id:target?.id||crypto.randomUUID(),label:'Show Timer',action:`timer.show.${tool.id}`,toolIds:[tool.id],buttonMode:'single' as const,chain:undefined,compositionId:undefined,detail:'Show the timer without starting, resetting, or changing its duration.'};
  next.controls=target?next.controls.map(c=>c.id===target.id?show:c):[...next.controls,show];
  const start=next.controls.find(c=>c.id!==show.id&&(c.action===`tool.${tool.id}`||c.action===`timer.toggle.${tool.id}`));
  const toggle={...start,id:start?.id||crypto.randomUUID(),label:'Start / Stop Timer',action:`timer.toggle.${tool.id}`,toolIds:[tool.id],buttonMode:'single' as const,chain:undefined,compositionId:undefined,detail:'Start the countdown or pause it at its remaining time.'};
  next.controls=start?next.controls.map(c=>c.id===start.id?toggle:c):[...next.controls,toggle];
  next.gameTools=next.gameTools.map(t=>t.id===tool.id?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t);extra++;
 }
 // Start + optional auto-hide at zero using real control IDs (never invent sequence.ID actions)
 for(const raw of Array.isArray(changes.timerLifecycle)?changes.timerLifecycle:[]){
  const item=record(raw),tool=next.gameTools.find(t=>t.id===item.toolId&&t.type==='countdown'&&t.enabled);
  if(!tool){warnings.push('Choose an existing countdown timer for start and hide.');continue;}
  try{
   const linked=addCreationControl(next,'tool',tool.id);
   next={...linked.project,assetPools:next.assetPools};
  }catch{warnings.push('Timer controls could not be created for this countdown.');continue;}
  const seconds=Math.max(1,Math.min(86400,Number(tool.config.seconds)||10));
  const startCtrl=next.controls.find(c=>c.action===`timer.toggle.${tool.id}`)||next.controls.find(c=>c.action===`tool.${tool.id}`);
  const hideCtrl=next.controls.find(c=>c.action===`timer.hide.${tool.id}`);
  if(!startCtrl||!hideCtrl){warnings.push('Start and Hide controls are required for this timer lifecycle.');continue;}
  const startLabel=typeof item.startLabel==='string'&&item.startLabel.trim()?item.startLabel.trim().slice(0,80):`Start ${tool.name}`;
  next.controls=next.controls.map(c=>c.id===startCtrl.id?{...c,label:startLabel,action:`timer.toggle.${tool.id}`,toolIds:[tool.id],detail:'Start the countdown from the saved duration; press again to pause.'}:c);
  next.gameTools=next.gameTools.map(t=>t.id===tool.id?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t);
  if(item.autoHide!==false){
   const existingSeq=next.controls.find(c=>c.action==='sequence'&&c.chain?.some(s=>s.refId===startCtrl.id)&&c.chain?.some(s=>s.refId===hideCtrl.id));
   const steps:NonNullable<ProjectEvent['chain']>=[
    {id:crypto.randomUUID(),kind:'control',refId:startCtrl.id,label:startLabel,timing:{mode:'immediate',seconds:0}},
    {id:crypto.randomUUID(),kind:'control',refId:hideCtrl.id,label:hideCtrl.label,timing:{mode:'delay',seconds}},
   ];
   const seq:ProjectEvent={id:existingSeq?.id||crypto.randomUUID(),label:typeof item.sequenceLabel==='string'&&item.sequenceLabel.trim()?item.sequenceLabel.trim().slice(0,80):`Start ${tool.name}`,action:'sequence',detail:`Start the countdown and hide it after ${seconds}s`,buttonMode:'chain',chain:steps,toolIds:[tool.id]};
   const error=controlConnectionError(next,seq);if(error){warnings.push(error);continue;}
   next.controls=existingSeq?next.controls.map(c=>c.id===existingSeq.id?seq:c):[...next.controls,seq];
  }
  extra++;
 }
 const result=applyDraftChanges(next,changes);next={...result.project,assetPools:next.assetPools};
 for(const item of [...created.map(id=>({kind:'tool',id})),...(Array.isArray(changes.connections)?changes.connections:[])]){
  if(!['asset','tool','composition'].includes(item?.kind)||typeof item?.id!=='string'){warnings.push('A requested connection was missing its saved item.');continue;}
  try{const linked=addCreationControl(next,item.kind,item.id);next={...linked.project,assetPools:next.assetPools};if(typeof item.label==='string'&&item.label.trim())next.controls=next.controls.map(c=>c.id===linked.controlId?{...c,label:item.label.trim().slice(0,80)}:c);extra++;}catch{warnings.push('A requested item could not be connected because it is unavailable.');}
 }
 for(const raw of Array.isArray(changes.sequences)?changes.sequences:[]){
  const item=record(raw),old=next.controls.find(c=>c.id===item.id&&c.action==='sequence');
  if(item.id&&!old){warnings.push('The supplied id is not a saved sequence. Omit id for a new sequence; only reuse an existing sequence ID when editing.');continue;}
  let candidate:Project={...next,controls:[...next.controls]};
  let steps:NonNullable<ProjectEvent['chain']>;
  try{steps=(Array.isArray(item.steps)?item.steps:[]).map((raw:any)=>{
    const s=record(raw);if(s.operation&&!['show','play','hide','stop','reveal','clear'].includes(s.operation))throw new Error('Choose Show, Play, Hide, Stop, Reveal or Clear for each sequence action.');let target=candidate.controls.find(c=>c.id===s.controlId);
    if(!target&&['asset','tool','composition'].includes(s.kind)&&typeof s.refId==='string'){
      const linked=addCreationControl(candidate,s.kind,s.refId);candidate=linked.project;
      target=candidate.controls.find(c=>c.id===linked.controlId);
      if(['hide','stop','clear'].includes(s.operation))target=candidate.controls.find(c=>c.action===`result.hide.${linked.controlId}`||c.action===`cards.clear.${s.refId}`||c.action===`timer.hide.${s.refId}`)||target;
      if(s.operation==='reveal')target=candidate.controls.find(c=>c.action===`cards.reveal.${s.refId}`);
      if(s.operation==='show'||s.operation==='play')target=candidate.controls.find(c=>c.action===`timer.toggle.${s.refId}`||c.action===`timer.show.${s.refId}`||c.action===`tool.${s.refId}`)||target;
    }
    if(!target)throw new Error('Choose an available item or button for each sequence step.');
    return {id:crypto.randomUUID(),kind:'control' as const,refId:target.id,label:s.operation?`${s.operation}: ${target.label}`:target.label,...(/^cards\./.test(target.action)&&['clear','hide','stop','reveal'].includes(s.operation)?{cardAction:s.operation==='reveal'?'reveal' as const:'clear' as const}:{}),timing:{mode:s.delaySeconds?'delay' as const:'immediate' as const,seconds:Number(s.delaySeconds||0)}};
  });}catch(error){warnings.push(error instanceof Error?error.message:'The sequence could not be connected.');continue;}
  const control:ProjectEvent={id:old?.id||crypto.randomUUID(),label:String(item.name||old?.label||'Run sequence').slice(0,80),action:'sequence',detail:'Run the connected actions in order',buttonMode:'chain',chain:steps};
  const error=controlConnectionError(candidate,control);if(error){warnings.push(error);continue;}
  next={...candidate,assetPools:next.assetPools};
  next.controls=old?next.controls.map(c=>c.id===old.id?control:c):[...next.controls,control];extra++;
 }
 if(Array.isArray(changes.controlOrder)){const order=changes.controlOrder;next.controls=[...next.controls].sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length:ai)-(bi<0?order.length:bi);});extra++;}
 if(Array.isArray(changes.removeControls)){const ids=new Set(changes.removeControls);const count=next.controls.length;next.controls=next.controls.filter(c=>!ids.has(c.id));extra+=count-next.controls.length;}
 return {project:next,applied:result.applied+extra,warnings};
}
