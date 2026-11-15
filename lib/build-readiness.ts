import {gameEntries,infoTypes} from './game-tools';
import {pickerCards} from './card-lists';
import {bingoConfigFromSnapshot} from './bingo';
import {quizConfigFromSnapshot} from './quiz-board';
import {surveyConfigFromSnapshot} from './survey-showdown';
import {perfectMatchConfigFromSnapshot} from './perfect-match';
import {wordChainConfigFromSnapshot} from './word-chain';
import {drawGuessConfigFromSnapshot} from './draw-guess';
import {assetPlaced} from './asset-filing';
import type { Project } from './project';
import { controlConnectionError } from './control-connections';
import { questionPool } from './question-cards';
import { timerAction } from './timer-controls';
export type BuildIssue = { id: string; message: string; kind: 'tool'|'control'|'asset'; targetId: string; fix?: 'connect'|'customize'|'background' };
export type PublishReviewSummary = { titleOk: boolean; dashboardRow: boolean; checksOut: boolean };
// The publish-review panel's summary state, kept pure so it is testable. A
// game night has no host and no host-run dashboard, so its panel never shows
// the dashboard-buttons row and dashboard controls never gate its "Everything
// checks out" line: a multiplayer project checks out when its title is set
// and buildReadiness is clean. Every other kind keeps the long-standing
// summary exactly — dashboard row shown, and checking out also requires at
// least one dashboard button.
export function publishReviewSummary(project: Project, issues: BuildIssue[]): PublishReviewSummary {
 const titleOk=!!project.name.trim()&&!["New Project","New LIVE Experience"].includes(project.name.trim())&&!["","YOUR LIVESTREAM","YOUR LIVE EXPERIENCE"].includes((project.overlay.title||"").trim().toUpperCase());
 const dashboardRow=project.kind!=='multiplayer';
 const dashboardOk=!dashboardRow||project.controls.length>0;
 return {titleOk,dashboardRow,checksOut:titleOk&&dashboardOk&&issues.length===0};
}
export function buildReadiness(project: Project): BuildIssue[] {
 const issues:BuildIssue[]=[];
 // Off-Stream Multiplayer Game Night has no host and no host-run dashboard —
 // the game runs itself from the share link — so none of the dashboard-wiring
 // checks below apply to it. A game night is ready when it holds a playable
 // game: bingo (a card list the bingo extraction can play), Quiz Board (a
 // trivia board / categorized trivia list the quiz extraction can play),
 // Survey Showdown (a survey-shaped trivia board the survey extraction can
 // play), Perfect Match (a prompt card list and an answer card list the
 // perfect-match extraction can play), Word Chain (a word-named card
 // list of starter words the word-chain extraction can play) or Draw &
 // Guess (a draw-named card list of words to draw the draw-guess
 // extraction can play), judged by
 // the very extractions the game-room share route runs (lib/bingo.ts /
 // lib/quiz-board.ts / lib/survey-showdown.ts / lib/perfect-match.ts /
 // lib/word-chain.ts / lib/draw-guess.ts on the published snapshot), so
 // "ready to publish" and "ready to share" can never disagree. The asset checks at the
 // bottom still run for every kind: they only fire for assets actually
 // placed, so a game night with no assets is never blocked on asset
 // grounds.
 const multiplayer=project.kind==='multiplayer';
 if(multiplayer&&'error' in bingoConfigFromSnapshot(project)&&'error' in quizConfigFromSnapshot(project)&&'error' in surveyConfigFromSnapshot(project)&&'error' in perfectMatchConfigFromSnapshot(project)&&'error' in wordChainConfigFromSnapshot(project)&&'error' in drawGuessConfigFromSnapshot(project)){
  const target=project.gameTools.find(t=>t.type==='card-list')||project.gameTools.find(t=>t.type==='trivia-board')||project.gameTools.find(t=>t.type==='trivia-list');
  issues.push({id:'playable-game',message:'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, a prompt card list and an answer card list for a matching game, a word list with at least 10 starter words for a word chain game, or a draw list with at least 12 words to draw for a drawing game — ask Jewel to build one for you.',kind:'tool',targetId:target?target.id:'',fix:'customize'});
 }
 if(!multiplayer){
 for(const control of project.controls){
  const error=controlConnectionError(project,control);
  if(error)issues.push({id:'control-'+control.id,message:control.label+': '+error,kind:'control',targetId:control.id,fix:'customize'});
 }
 for(const tool of project.gameTools.filter(t=>t.enabled&&(t.inToolbox||t.inOverlayBuild))){
  // Is this tool connected to the dashboard at all? A tool with no
  // dashboard connection is simply not a feature of the game yet
  // (Jessica, 2026-11-14: tools "are simply an option" until the
  // creator adds them as a feature), so it never blocks publishing on
  // wiring grounds — there is no generic "add a dashboard button"
  // demand. The one check that consults this is the countdown's: its
  // specific-button rule applies only once the timer is connected.
  const linked=project.controls.some(c=>{
   if(c.toolIds?.includes(tool.id))return true;
   if(c.action===`tool.${tool.id}`||c.action===`coin.cycle.${tool.id}`)return true;
   const timer=timerAction(c.action||'');if(timer&&timer.toolId===tool.id)return true;
   if(c.action?.startsWith('cards.')&&c.action.endsWith('.'+tool.id))return true;
   if(c.action==='sequence'&&c.chain?.some(s=>s.kind==='control'&&project.controls.some(x=>x.id===s.refId&&x.toolIds?.includes(tool.id))))return true;
   return false;
  });
  if(infoTypes.includes(tool.type)&&(!gameEntries(tool).length||gameEntries(tool).some(e=>!e.name.trim()||(tool.type==='game-tool-list'&&!e.meaning?.trim()))))issues.push({id:'entries-'+tool.id,message:tool.name+': add named entries'+(tool.type==='game-tool-list'?' with their game actions':'')+'.',kind:'tool',targetId:tool.id,fix:'customize'});
  if(tool.type==='random-picker'&&!pickerCards(project,tool).length)issues.push({id:'list-'+tool.id,message:tool.name+': choose an image pool or card list containing saved items.',kind:'tool',targetId:tool.id,fix:'customize'});
  if(tool.type==='question-card'){
   if(!questionPool(project,tool).length)issues.push({id:'pool-'+tool.id,message:tool.name+': choose a question pool with questions and answers.',kind:'tool',targetId:tool.id,fix:'customize'});
   if(!tool.inOverlayBuild)issues.push({id:'overlay-'+tool.id,message:tool.name+': add the cards to the audience overlay.',kind:'tool',targetId:tool.id,fix:'connect'});
   if(!(project.controls.some(c=>c.action===`cards.toggle.${tool.id}`)||['show','reveal'].every(action=>project.controls.some(c=>c.action===`cards.${action}.${tool.id}`))))issues.push({id:'buttons-'+tool.id,message:tool.name+': connect the Question Card button (one button draws, reveals, then clears), or Show Question and Reveal Answer controls.',kind:'tool',targetId:tool.id,fix:'connect'});
  }
  if(tool.type==='blank-card'&&!tool.inOverlayBuild)issues.push({id:'overlay-'+tool.id,message:tool.name+': add the blank card to the audience overlay.',kind:'tool',targetId:tool.id,fix:'connect'});
  if(tool.type==='countdown'&&linked){
   const ops=['show','toggle','hide'];
   const missing=ops.filter(op=>!project.controls.some(c=>{const t=timerAction(c.action||'');return t&&t.toolId===tool.id&&t.operation===op;}));
   if(missing.length)issues.push({id:'timer-controls-'+tool.id,message:tool.name+': connect Show, Start/pause, and Hide dashboard buttons so the timer can run live.',kind:'tool',targetId:tool.id,fix:'connect'});
  }
 }
 }
 for(const asset of project.assets.filter(a=>assetPlaced(a)||project.controls.some(c=>c.action==='asset.show.'+(a.storageKey||a.name))||project.gameTools.some(t=>t.inOverlayBuild&&t.config.backgroundAssetKey===(a.storageKey||a.name)))){
  if(!asset.url||asset.url.startsWith('blob:')||asset.url.startsWith('data:'))issues.push({id:'asset-'+(asset.storageKey||asset.name),message:asset.name+': upload a saved media file in Workshop before publishing.',kind:'asset',targetId:asset.storageKey||asset.name,fix:'background'});
 }
 for(const asset of project.assets.filter(a=>assetPlaced(a)||project.controls.some(c=>c.action==='background.show.'+(a.storageKey||a.name)))){
  const assetKey=asset.storageKey||asset.name;
  if(asset.storageKey&&!asset.storageKey.startsWith('projects/')&&!issues.some(i=>i.id==='asset-'+assetKey))issues.push({id:'cloud-'+assetKey,message:asset.name+': this file is saved only in your browser. Re-upload it in Workshop before publishing.',kind:'asset',targetId:assetKey,fix:'background'});
 }
 return issues;
}
