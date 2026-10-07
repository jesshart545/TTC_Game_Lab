import {gameEntries,infoTypes} from './game-tools';
import {pickerCards} from './card-lists';
import type { Project } from './project';
import { controlConnectionError } from './control-connections';
import { questionPool } from './question-cards';
export type BuildIssue = { id: string; message: string; kind: 'tool'|'control'|'asset'; targetId: string };
export function buildReadiness(project: Project): BuildIssue[] {
 const issues:BuildIssue[]=[];
 for(const control of project.controls){
  const error=controlConnectionError(project,control);
  if(error)issues.push({id:'control-'+control.id,message:control.label+': '+error,kind:'control',targetId:control.id});
 }
 for(const tool of project.gameTools.filter(t=>t.enabled&&(t.inToolbox||t.inOverlayBuild))){
  if(infoTypes.includes(tool.type)&&(!gameEntries(tool).length||gameEntries(tool).some(e=>!e.name.trim()||(tool.type==='game-tool-list'&&!e.meaning?.trim()))))issues.push({id:'entries-'+tool.id,message:tool.name+': add named entries'+(tool.type==='game-tool-list'?' with their game actions':'')+'.',kind:'tool',targetId:tool.id});
  if(tool.type==='random-picker'&&!pickerCards(project,tool).length)issues.push({id:'list-'+tool.id,message:tool.name+': choose an image pool or card list containing saved items.',kind:'tool',targetId:tool.id});
  if(tool.type==='question-card'){
   if(!questionPool(project,tool).length)issues.push({id:'pool-'+tool.id,message:tool.name+': choose a question pool with questions and answers.',kind:'tool',targetId:tool.id});
   if(!tool.inOverlayBuild)issues.push({id:'overlay-'+tool.id,message:tool.name+': add the cards to the audience overlay.',kind:'tool',targetId:tool.id});
   if(!['show','reveal'].every(action=>project.controls.some(c=>c.action===`cards.${action}.${tool.id}`)))issues.push({id:'buttons-'+tool.id,message:tool.name+': connect Show Question and Reveal Answer controls.',kind:'tool',targetId:tool.id});
  }
  if(tool.type==='blank-card'&&!tool.inOverlayBuild)issues.push({id:'overlay-'+tool.id,message:tool.name+': add the blank card to the audience overlay.',kind:'tool',targetId:tool.id});
 }
 for(const asset of project.assets.filter(a=>a.inProject||project.controls.some(c=>c.action==='asset.show.'+(a.storageKey||a.name))||project.gameTools.some(t=>t.inOverlayBuild&&t.config.backgroundAssetKey===(a.storageKey||a.name)))){
  if(!asset.url||asset.url.startsWith('blob:')||asset.url.startsWith('data:'))issues.push({id:'asset-'+(asset.storageKey||asset.name),message:asset.name+': upload a saved media file in Workshop before publishing.',kind:'asset',targetId:asset.storageKey||asset.name});
 }
 return issues;
}
