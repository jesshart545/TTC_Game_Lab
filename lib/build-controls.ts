import type { Project, ProjectEvent, OverlayResult } from './project';
import { mediaKind } from './board-design';
import { connectQuestionCard } from './control-connections';
export const initialResult:OverlayResult={x:15,y:20,width:70,height:60,entrance:'none',exit:'none',entranceSeconds:0,exitSeconds:0,layer:20};
export function clarifyYoutubeSearch(project:Project):Project {
 const youtubeIds=new Set(project.gameTools.filter(t=>t.type==='youtube').map(t=>t.id));
 return {...project,gameTools:project.gameTools.map(t=>t.type==='youtube'&&['YouTube','YouTube Clip','YouTube clip'].includes(t.name)?{...t,name:'YouTube search'}:t),controls:project.controls.map(c=>youtubeIds.has(c.action.replace(/^tool\./,''))?{...c,label:['Open YouTube','Open YouTube Clip','Open YouTube clip','Open YouTube search'].includes(c.label)?'Open YouTube search':c.label,detail:'Open YouTube search in the host dashboard. Choose a video, then send it to the overlay when ready.'}:c)};
}
export function addCreationControl(project:Project,kind:'asset'|'tool'|'composition',id:string):{project:Project;controlId:string}{
 project=clarifyYoutubeSearch(project);
 let next=project;
 const asset=kind==='asset'?project.assets.find(a=>(a.storageKey||a.name)===id):undefined;
 const tool=kind==='tool'?project.gameTools.find(t=>t.id===id&&t.enabled):undefined;
 const composition=kind==='composition'?project.compositions?.find(c=>c.id===id):undefined;
 if(!asset&&!tool&&!composition)throw new Error('This creation is unavailable.');
 if(tool&&(tool.type==='random-picker'||['scoreboard','prize-list','game-tool-list'].includes(tool.type))){
  const action=`cards.toggle.${id}`,noun=tool.type==='random-picker'?(tool.config.source==='images'?'image':'card'):tool.name;
  let controls=project.controls.filter(c=>!(tool.type==='random-picker'&&c.action===`cards.clear.${id}`)).map(c=>c.action===`cards.draw.${id}`||c.action===`tool.${id}`?{...c,action,toolIds:[id],label:tool.type==='random-picker'?`Draw random ${noun}: ${tool.name}`:`Show ${tool.name}`,detail:'Press once to show; press the same button again to remove'}:c);
  if(!controls.some(c=>c.action===action))controls.push({id:crypto.randomUUID(),label:tool.type==='random-picker'?`Draw random ${noun}: ${tool.name}`:`Show ${tool.name}`,action,detail:tool.type==='random-picker'?'Draw an unused item randomly; press again to remove. No repeats this game.':'Show or remove '+tool.name,toolIds:[id]});
  return {project:{...project,controls,gameTools:project.gameTools.map(t=>t.id===id?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t)},controlId:controls.find(c=>c.action===action)!.id};
 }
 if(tool?.type==='question-card'){
  next=connectQuestionCard(project,id);
  if(!next.controls.some(c=>c.action===`cards.clear.${id}`))next={...next,controls:[...next.controls,{id:crypto.randomUUID(),label:'Clear '+tool.name,action:`cards.clear.${id}`,detail:'Hide the question or answer card',toolIds:[id]}]};
  return {project:next,controlId:next.controls.find(c=>c.action===`cards.show.${id}`)!.id};
 }
 const action=asset?`asset.show.${id}`:composition?`composition.play.${id}`:tool?.type==='blank-card'?`cards.blank.${id}`:`tool.${id}`;
 const name=(asset||tool||composition)!.name;
 const playsMedia=!!composition||!!asset&&["audio","video"].includes(mediaKind(asset));
 const verb=playsMedia?"Play ":tool?.type==="wheel"?"Spin ":tool?.type==="dice"?"Roll ":tool?.type==="coin-toss"?"Flip ":tool?.type==="countdown"?"Start ":"Show ";
 let control=project.controls.find(c=>c.action===action);
 if(!control)control={id:crypto.randomUUID(),label:tool?.type==='youtube'?'Open YouTube search':verb+name,action,detail:tool?.type==='youtube'?'Open YouTube search in the host dashboard. Choose a video, then send it to the overlay when ready.':`${verb}${name} only when pressed`,toolIds:tool?[id]:[],compositionId:composition?.id,overlayResult:{...initialResult}};
 next={...project,assets:project.assets.map(a=>a===asset?{...a,inProject:false,edits:{...a.edits,loop:a.edits?.loop??false,sound:a.edits?.sound??['audio','video'].includes(mediaKind(a)),volume:a.edits?.volume??80}}:a),gameTools:project.gameTools.map(t=>t===tool?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t),compositions:project.compositions?.map(c=>c===composition?{...c,inProject:true}:c),controls:project.controls.some(c=>c.id===control!.id)?project.controls:[...project.controls,control]};
 const hideAction=tool?.type==='blank-card'?`cards.clear.${id}`:`result.hide.${control.id}`;
 if(tool?.type!=='youtube'&&!next.controls.some(c=>c.action===hideAction))next={...next,controls:[...next.controls,{id:crypto.randomUUID(),label:(playsMedia?'Stop ':'Hide ')+name,action:hideAction,detail:'Remove '+name+' from the overlay',...(tool?.type==='blank-card'?{toolIds:[id]}:{})}]};
 return {project:next,controlId:control.id};
}
