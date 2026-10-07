import type { Project, ProjectEvent, OverlayResult } from './project';
import { mediaKind } from './board-design';
import { connectQuestionCard } from './control-connections';
export const initialResult:OverlayResult={x:15,y:20,width:70,height:60,entrance:'none',exit:'none',entranceSeconds:0,exitSeconds:0,layer:20};
export function addCreationControl(project:Project,kind:'asset'|'tool'|'composition',id:string):{project:Project;controlId:string}{
 let next=project;
 const asset=kind==='asset'?project.assets.find(a=>(a.storageKey||a.name)===id):undefined;
 const tool=kind==='tool'?project.gameTools.find(t=>t.id===id&&t.enabled):undefined;
 const composition=kind==='composition'?project.compositions?.find(c=>c.id===id):undefined;
 if(!asset&&!tool&&!composition)throw new Error('This creation is unavailable.');
 if(tool?.type==='random-picker'){
  let controls=project.controls.map(c=>c.action===`tool.${id}`?{...c,action:`cards.draw.${id}`,toolIds:[id],detail:'Draw one unused card from the connected list'}:c);
  for(const [action,label] of [['draw','Pick next card'],['clear','Hide picked card']])if(!controls.some(c=>c.action===`cards.${action}.${id}`))controls.push({id:crypto.randomUUID(),label:`${label}: ${tool.name}`,action:`cards.${action}.${id}`,detail:action==='draw'?'Draw one unused card; no repeats this game':'Hide the current card without resetting the history',toolIds:[id]});
  return {project:{...project,controls,gameTools:project.gameTools.map(t=>t.id===id?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t)},controlId:controls.find(c=>c.action===`cards.draw.${id}`)!.id};
 }
 if(tool?.type==='question-card'){
  next=connectQuestionCard(project,id);
  if(!next.controls.some(c=>c.action===`cards.clear.${id}`))next={...next,controls:[...next.controls,{id:crypto.randomUUID(),label:'Clear '+tool.name,action:`cards.clear.${id}`,detail:'Hide the question or answer card',toolIds:[id]}]};
  return {project:next,controlId:next.controls.find(c=>c.action===`cards.show.${id}`)!.id};
 }
 const action=asset?`asset.show.${id}`:composition?`composition.play.${id}`:tool?.type==='blank-card'?`cards.blank.${id}`:`tool.${id}`;
 const name=(asset||tool||composition)!.name;
 const playsMedia=!!composition||!!asset&&["audio","video"].includes(mediaKind(asset));
 const verb=playsMedia?"Play ":tool?.type==="wheel"?"Spin ":tool?.type==="dice"?"Roll ":tool?.type==="countdown"?"Start ":"Show ";
 let control=project.controls.find(c=>c.action===action);
 if(!control)control={id:crypto.randomUUID(),label:(tool?.type==='youtube'?'Open ':verb)+name,action,detail:tool?.type==='youtube'?'Open private search; send to overlay when ready':`${verb}${name} only when pressed`,toolIds:tool?[id]:[],compositionId:composition?.id,overlayResult:{...initialResult}};
 next={...project,assets:project.assets.map(a=>a===asset?{...a,inProject:false,edits:{...a.edits,loop:a.edits?.loop??false,sound:a.edits?.sound??mediaKind(a)==='audio',volume:a.edits?.volume??80}}:a),gameTools:project.gameTools.map(t=>t===tool?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t),compositions:project.compositions?.map(c=>c===composition?{...c,inProject:true}:c),controls:project.controls.some(c=>c.id===control!.id)?project.controls:[...project.controls,control]};
 const hideAction=tool?.type==='blank-card'?`cards.clear.${id}`:`result.hide.${control.id}`;
 if(tool?.type!=='youtube'&&!next.controls.some(c=>c.action===hideAction))next={...next,controls:[...next.controls,{id:crypto.randomUUID(),label:(playsMedia?'Stop ':'Hide ')+name,action:hideAction,detail:'Remove '+name+' from the overlay',...(tool?.type==='blank-card'?{toolIds:[id]}:{})}]};
 return {project:next,controlId:control.id};
}
