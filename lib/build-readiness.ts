import {gameEntries,infoTypes} from './game-tools';
import {pickerCards} from './card-lists';
import type { Project } from './project';
import { controlConnectionError } from './control-connections';
import { questionPool } from './question-cards';
import { timerAction } from './timer-controls';
export type BuildIssue = { id: string; message: string; kind: 'tool'|'control'|'asset'; targetId: string; fix?: 'connect'|'customize'|'background' };
export function buildReadiness(project: Project): BuildIssue[] {
 const issues:BuildIssue[]=[];
 for(const control of project.controls){
  const error=controlConnectionError(project,control);
  if(error)issues.push({id:'control-'+control.id,message:control.label+': '+error,kind:'control',targetId:control.id,fix:'customize'});
 }
 for(const tool of project.gameTools.filter(t=>t.enabled&&(t.inToolbox||t.inOverlayBuild))){
  if(infoTypes.includes(tool.type)&&(!gameEntries(tool).length||gameEntries(tool).some(e=>!e.name.trim()||(tool.type==='game-tool-list'&&!e.meaning?.trim()))))issues.push({id:'entries-'+tool.id,message:tool.name+': add named entries'+(tool.type==='game-tool-list'?' with their game actions':'')+'.',kind:'tool',targetId:tool.id,fix:'customize'});
  if(tool.type==='random-picker'&&!pickerCards(project,tool).length)issues.push({id:'list-'+tool.id,message:tool.name+': choose an image pool or card list containing saved items.',kind:'tool',targetId:tool.id,fix:'customize'});
  if(tool.type==='question-card'){
   if(!questionPool(project,tool).length)issues.push({id:'pool-'+tool.id,message:tool.name+': choose a question pool with questions and answers.',kind:'tool',targetId:tool.id,fix:'customize'});
   if(!tool.inOverlayBuild)issues.push({id:'overlay-'+tool.id,message:tool.name+': add the cards to the audience overlay.',kind:'tool',targetId:tool.id,fix:'connect'});
   if(!['show','reveal'].every(action=>project.controls.some(c=>c.action===`cards.${action}.${tool.id}`)))issues.push({id:'buttons-'+tool.id,message:tool.name+': connect Show Question and Reveal Answer controls.',kind:'tool',targetId:tool.id,fix:'connect'});
  }
  if(tool.type==='blank-card'&&!tool.inOverlayBuild)issues.push({id:'overlay-'+tool.id,message:tool.name+': add the blank card to the audience overlay.',kind:'tool',targetId:tool.id,fix:'connect'});
  if(tool.type==='countdown'){
   const ops=['show','toggle','hide'];
   const missing=ops.filter(op=>!project.controls.some(c=>{const t=timerAction(c.action||'');return t&&t.toolId===tool.id&&t.operation===op;}));
   if(missing.length)issues.push({id:'timer-controls-'+tool.id,message:tool.name+': connect Show, Start/pause, and Hide dashboard buttons so the timer can run live.',kind:'tool',targetId:tool.id,fix:'connect'});
  }
  // Interactive tools on the dashboard/overlay need at least one host control
  if(!['blank-board','trivia-board','card-list'].includes(tool.type)){
   const linked=project.controls.some(c=>{
    if(c.toolIds?.includes(tool.id))return true;
    if(c.action===`tool.${tool.id}`||c.action===`coin.cycle.${tool.id}`)return true;
    const timer=timerAction(c.action||'');if(timer&&timer.toolId===tool.id)return true;
    if(c.action?.startsWith('cards.')&&c.action.endsWith('.'+tool.id))return true;
    if(c.action==='sequence'&&c.chain?.some(s=>s.kind==='control'&&project.controls.some(x=>x.id===s.refId&&x.toolIds?.includes(tool.id))))return true;
    return false;
   });
   if((tool.inToolbox||tool.inOverlayBuild)&&!linked)issues.push({id:'controls-'+tool.id,message:tool.name+': add at least one dashboard button so the host can show or run it.',kind:'tool',targetId:tool.id,fix:'connect'});
  }
 }
 for(const asset of project.assets.filter(a=>a.inProject||project.controls.some(c=>c.action==='asset.show.'+(a.storageKey||a.name))||project.gameTools.some(t=>t.inOverlayBuild&&t.config.backgroundAssetKey===(a.storageKey||a.name)))){
  if(!asset.url||asset.url.startsWith('blob:')||asset.url.startsWith('data:'))issues.push({id:'asset-'+(asset.storageKey||asset.name),message:asset.name+': upload a saved media file in Workshop before publishing.',kind:'asset',targetId:asset.storageKey||asset.name,fix:'background'});
 }
 return issues;
}
