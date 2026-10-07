import {controlConnectionError} from './control-connections';
import type {ProjectEvent} from './project';
import type {Project,GameToolType} from './project';
import {applyDraftChanges} from './draft-edit';
import {addCreationControl} from './build-controls';
import {toolDefaults} from './game-tools';
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export const creatableTools:GameToolType[]=['wheel','random-picker','countdown','poll','dice','blank-board','youtube','scoreboard','prize-list','game-tool-list','card-list'];
export function applyBuildChanges(project:Project,input:unknown){
 const changes=record(input),warnings:string[]=[];let extra=0;
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
 const result=applyDraftChanges(next,changes);next={...result.project,assetPools:next.assetPools};
 for(const item of [...created.map(id=>({kind:'tool',id})),...(Array.isArray(changes.connections)?changes.connections:[])]){
  if(!['asset','tool','composition'].includes(item?.kind)||typeof item?.id!=='string'){warnings.push('A requested connection was missing its saved item.');continue;}
  try{const linked=addCreationControl(next,item.kind,item.id);next={...linked.project,assetPools:next.assetPools};if(typeof item.label==='string'&&item.label.trim())next.controls=next.controls.map(c=>c.id===linked.controlId?{...c,label:item.label.trim().slice(0,80)}:c);extra++;}catch{warnings.push('A requested item could not be connected because it is unavailable.');}
 }
 for(const raw of Array.isArray(changes.sequences)?changes.sequences:[]){
  const item=record(raw),old=next.controls.find(c=>c.id===item.id&&c.action==='sequence');
  if(item.id&&!old){warnings.push('The sequence could not be found.');continue;}
  let candidate:Project={...next,controls:[...next.controls]};
  let steps:NonNullable<ProjectEvent['chain']>;
  try{steps=(Array.isArray(item.steps)?item.steps:[]).map((raw:any)=>{
    const s=record(raw);if(s.operation&&!['show','play','hide','stop','reveal','clear'].includes(s.operation))throw new Error('Choose Show, Play, Hide, Stop, Reveal or Clear for each sequence action.');let target=candidate.controls.find(c=>c.id===s.controlId);
    if(!target&&['asset','tool','composition'].includes(s.kind)&&typeof s.refId==='string'){
      const linked=addCreationControl(candidate,s.kind,s.refId);candidate=linked.project;
      target=candidate.controls.find(c=>c.id===linked.controlId);
      if(['hide','stop','clear'].includes(s.operation))target=candidate.controls.find(c=>c.action===`result.hide.${linked.controlId}`||c.action===`cards.clear.${s.refId}`)||target;
      if(s.operation==='reveal')target=candidate.controls.find(c=>c.action===`cards.reveal.${s.refId}`);
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
