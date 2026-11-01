import type { Project, ProjectEvent, OverlayResult } from './project';
import { mediaKind } from './board-design';
import { connectQuestionCard } from './control-connections';
export const initialResult:OverlayResult={x:15,y:20,width:70,height:60,entrance:'none',exit:'none',entranceSeconds:0,exitSeconds:0,layer:20};
export function clarifyYoutubeSearch(project:Project):Project {
 const youtubeIds=new Set(project.gameTools.filter(t=>t.type==='youtube').map(t=>t.id));
 return {...project,gameTools:project.gameTools.map(t=>t.type==='youtube'&&['YouTube','YouTube Clip','YouTube clip'].includes(t.name)?{...t,name:'YouTube search'}:t),controls:project.controls.map(c=>youtubeIds.has(c.action.replace(/^tool\./,''))?{...c,label:['Open YouTube','Open YouTube Clip','Open YouTube clip','Open YouTube search'].includes(c.label)?'Open YouTube search':c.label,detail:'Open YouTube search in the host dashboard. Choose a video, then send it to the overlay when ready.'}:c)};
}
export function addCreationControl(project:Project,kind:'asset'|'tool'|'composition',id:string):{project:Project;controlId:string}{
 const hidden=project.controls.filter(c=>c.sequenceOnly);
 const result=addVisibleCreationControl({...project,controls:project.controls.filter(c=>!c.sequenceOnly)},kind,id);
 return {...result,project:{...result.project,controls:[...result.project.controls,...hidden]}};
}
function addVisibleCreationControl(project:Project,kind:'asset'|'tool'|'composition',id:string):{project:Project;controlId:string}{
 project=clarifyYoutubeSearch(project);
 let next=project;
 const asset=kind==='asset'?project.assets.find(a=>(a.storageKey||a.name)===id):undefined;
 const tool=kind==='tool'?project.gameTools.find(t=>t.id===id&&t.enabled):undefined;
 const composition=kind==='composition'?project.compositions?.find(c=>c.id===id):undefined;
 if(!asset&&!tool&&!composition)throw new Error('This creation is unavailable.');
 if(tool?.type==='youtube'){
  const existing=project.controls.find(c=>c.action===`tool.${id}`);
  const control:ProjectEvent=existing?{...existing,toolIds:[id]}:{id:crypto.randomUUID(),label:'Open YouTube search',action:`tool.${id}`,toolIds:[id],detail:'Open private YouTube search on the host dashboard. Videos appear on the overlay only after Play on overlay.'};
  return {project:{...project,controls:existing?project.controls.map(c=>c.id===existing.id?control:c):[...project.controls,control],gameTools:project.gameTools.map(t=>t.id===id?{...t,inToolbox:true,inOverlayBuild:false,config:{...t.config,triggerOnly:true}}:t)},controlId:control.id};
 }
 if(tool?.type==='countdown'){
  const controls=[...project.controls];
  for(const [operation,label,detail] of [
   ['show','Show','Show the timer without starting or resetting it.'],
   ['toggle','Start / pause','Start the countdown; press again to pause it.'],
   ['reset','Reset','Restore the saved duration and stop counting.'],
   ['hide','Hide','Remove the timer from the overlay and stop counting.'],
  ]){const action=`timer.${operation}.${id}`;if(!controls.some(c=>c.action===action))controls.push({id:crypto.randomUUID(),label:`${label} ${tool.name}`,action,detail,toolIds:[id]});}
  return {project:{...project,controls,gameTools:project.gameTools.map(t=>t.id===id?{...t,inToolbox:true,inOverlayBuild:true}:t)},controlId:controls.find(c=>c.action===`timer.show.${id}`)!.id};
 }
 if(tool?.type==='coin-toss'){const cycle=project.controls.find(control=>control.action===`coin.cycle.${id}`);if(cycle)return {project:{...project,gameTools:project.gameTools.map(item=>item.id===id?{...item,inToolbox:true,inOverlayBuild:true}:item)},controlId:cycle.id};}
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
 const verb=playsMedia?"Play ":tool?.type==="wheel"?"Spin ":tool?.type==="dice"?"Roll ":tool?.type==="coin-toss"?"Flip ":tool?.type==="plinko"?"Drop ":tool?.type==="prize-wheel"?"Spin ":"Show ";
 let control=project.controls.find(c=>c.action===action);
 if(!control)control={id:crypto.randomUUID(),label:verb+name,action,detail:playsMedia?`${verb}${name} — keeps playing until Stop is pressed`:`${verb}${name} — stays on the overlay until Hide is pressed`,toolIds:tool?[id]:[],compositionId:composition?.id,overlayResult:{...initialResult}};
 next={...project,assets:project.assets.map(a=>a===asset?{...a,inProject:false,edits:{...a.edits,loop:a.edits?.loop??false,sound:a.edits?.sound??['audio','video'].includes(mediaKind(a)),volume:a.edits?.volume??80}}:a),gameTools:project.gameTools.map(t=>t===tool?{...t,inToolbox:true,inOverlayBuild:true,config:{...t.config,triggerOnly:true}}:t),compositions:project.compositions?.map(c=>c===composition?{...c,inProject:true}:c),controls:project.controls.some(c=>c.id===control!.id)?project.controls:[...project.controls,control]};
 const hideAction=tool?.type==='blank-card'?`cards.clear.${id}`:`result.hide.${control.id}`;
 if(!next.controls.some(c=>c.action===hideAction))next={...next,controls:[...next.controls,{id:crypto.randomUUID(),label:(playsMedia?'Stop ':'Hide ')+name,action:hideAction,detail:playsMedia?'Stop playing '+name:'Remove '+name+' from the overlay',...(tool?.type==='blank-card'?{toolIds:[id]}:{})}]};
 return {project:next,controlId:control.id};
}
export type ButtonFacts={does:string;clicks:string;effect:boolean};
const factInfoTypes=['scoreboard','prize-list','game-tool-list'];
function factObject(label:string):string{return label.replace(/^(show|hide|stop|play|roll|spin|flip|drop|open|start|clear|draw|reveal)\s+/i,'');}
export function buttonFacts(control:ProjectEvent,project:Project):ButtonFacts{
 const action=control.action||'';
 const tool=control.toolIds?.length===1?project.gameTools.find(t=>t.id===control.toolIds![0]):undefined;
 const card=action.match(/^cards\.(toggle|score|award|draw|show|reveal|clear|new-game|blank)\.(.+)$/);
 if(action==='sequence')return {does:'Runs its steps',clicks:control.sequenceMode==='per-press'?'One step per click':'One click runs all its steps',effect:false};
 if(action.startsWith('result.hide.')){const stop=/^stop/i.test(control.label);return {does:(stop?'Stops: ':'Hides: ')+factObject(control.label),clicks:stop?'One click stops it':'One click hides it',effect:false};}
 if(action.startsWith('coin.cycle.'))return {does:'Coin: show, flip, hide',clicks:'One step per click',effect:false};
 if(action.startsWith('timer.')){const op=action.split('.')[1];return {does:op==='toggle'?'Starts / pauses the timer':op==='reset'?'Resets the timer':op==='hide'?'Hides the timer':'Shows the timer',clicks:op==='toggle'?'Click to start · click again to pause':op==='reset'?'One click resets it':op==='hide'?'One click hides it':'One click shows it',effect:false};}
 if(card){const kind=card[1];const name=tool?.name||factObject(control.label);
  if(kind==='toggle')return {does:'Shows: '+name,clicks:'Click to show · click again to hide',effect:false};
  if(kind==='draw')return {does:'Draws: '+name,clicks:'Click to draw · click again to remove',effect:false};
  if(kind==='reveal')return {does:'Reveals the answer',clicks:'One click reveals it',effect:false};
  if(kind==='clear')return {does:'Clears the card',clicks:'One click clears it',effect:false};
  if(kind==='new-game')return {does:'Starts a new game',clicks:'One click starts it',effect:false};
  if(kind==='score'||kind==='award')return {does:control.label,clicks:'One click does it',effect:false};
  return {does:'Shows the card',clicks:'One click shows it',effect:false};}
 if(action.startsWith('asset.show.')){const asset=project.assets.find(a=>(a.storageKey||a.name)===action.slice(11));const plays=!!asset&&['audio','video'].includes(mediaKind(asset));return {does:(plays?'Plays: ':'Shows: ')+(asset?.name||factObject(control.label)),clicks:plays?'One click plays it':'One click shows it',effect:!!asset&&mediaKind(asset)!=='audio'};}
 if(control.compositionId||action.startsWith('composition.play.')){const composition=project.compositions?.find(c=>c.id===control.compositionId||action===`composition.play.${c.id}`);return {does:'Plays: '+(composition?.name||factObject(control.label)),clicks:'One click plays it',effect:true};}
 if(action.startsWith('background.show.'))return {does:'Changes the background',clicks:'One click changes it',effect:false};
 if(action.startsWith('tool.')&&tool){
  if(tool.type==='youtube')return {does:'Opens YouTube search',clicks:'Search stays on the dashboard',effect:false};
  if(tool.type==='dice')return {does:'Rolls the dice',clicks:'Every click rolls again',effect:true};
  if(tool.type==='wheel'||tool.type==='prize-wheel')return {does:'Spins: '+tool.name,clicks:'Every click spins again',effect:true};
  if(tool.type==='coin-toss')return {does:'Flips the coin',clicks:'Every click flips again',effect:true};
  if(tool.type==='plinko')return {does:'Drops a ball',clicks:'Every click drops again',effect:true};
  if(tool.type==='trivia-list')return {does:'Next question, then its answer',clicks:'Every click: next one',effect:true};
  return {does:control.label,clicks:'Every click does it again',effect:!factInfoTypes.includes(tool.type)};}
 return {does:control.label||'Not set yet',clicks:'One click',effect:false};
}
export function controlEffectResult(control:ProjectEvent,project:Project,entrance:OverlayResult['entrance']):OverlayResult{
 const tool=control.toolIds?.length===1?project.gameTools.find(t=>t.id===control.toolIds![0]):undefined;
 const placed=tool?.config.placement as Partial<OverlayResult>|undefined;
 const base:OverlayResult=control.overlayResult?{...control.overlayResult}:tool?{...initialResult,x:placed?.x??initialResult.x,y:placed?.y??initialResult.y,width:placed?.width??initialResult.width,height:placed?.height??initialResult.height}:{x:0,y:0,width:100,height:100,entrance:'fade',exit:'fade',entranceSeconds:.3,exitSeconds:.3,layer:10};
 return {...base,entrance,entranceSeconds:entrance!=='none'&&!base.entranceSeconds?0.3:base.entranceSeconds};
}
