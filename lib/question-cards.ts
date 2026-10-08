import {gameEntries,infoTypes} from './game-tools';
import {pickerCards,randomFraction} from './card-lists';
import type { GameTool, Project, ProjectEvent } from './project';
export type CardAction = 'toggle'|'score'|'award'|'draw'|'show'|'reveal'|'clear'|'new-game'|'blank';
export type CardQuestion = {id:string;question:string;answer:string;category?:string};
export type CardState = {version:number;gameId:string;used:string[];question:CardQuestion|null;shownAt:number;revealAt:number|null;cleared:boolean;blankText?:string;selectedAssetKey?:string;scores?:Record<string,number>;awarded?:Record<string,string>;selectedDesign?:Record<string,unknown>};
export const freshCardState = ():CardState => ({version:0,gameId:'game-'+Date.now(),used:[],question:null,shownAt:0,revealAt:null,cleared:true});
const record=(value:unknown):Record<string,unknown> => value && typeof value==='object' ? value as Record<string,unknown> : {};
export function bounded(value:unknown,fallback:number,min:number,max:number){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
export function cardDesign(tool:GameTool,answer=false){return record(tool.config[answer?'answerCard':'questionCard']);}
export function questionPool(project:Project,tool:GameTool):CardQuestion[]{
 const pool=project.gameTools.find(t=>t.id===tool.config.poolId&&t.enabled&&t.type==='trivia-list');
 const raw=Array.isArray(pool?.config.questions)?pool.config.questions:[];
 const seen=new Set<string>();
 return raw.flatMap((item:unknown)=>{const q=record(item),question=String(q.question||q.prompt||'').trim(),answer=String(q.answer||'').trim();const id=question.toLocaleLowerCase().replace(/\s+/g,' ');if(!question||!answer||seen.has(id))return [];seen.add(id);return [{id,question,answer,category:String(q.category||'')}];});
}
export function cardPhase(project:Project,tool:GameTool,state:CardState,now=Date.now()):'hidden'|'question'|'exit'|'answer'{
 void project; void tool;
 if(state.cleared||(!state.question&&!state.blankText))return 'hidden';
 if(state.revealAt!==null&&now>=state.revealAt)return 'answer';
 return 'question';
}
export function cardTransition(project:Project,tool:GameTool,previous:CardState,action:CardAction,now=Date.now(),random=randomFraction,text=''):CardState{
 const state={...previous,used:[...previous.used],version:previous.version+1};
 if(action==='new-game')return {...freshCardState(),version:state.version,gameId:'game-'+now};
 if(infoTypes.includes(tool.type)){
  if(action==='clear')return {...state,cleared:true};
  if(action==='toggle')return {...state,cleared:!state.cleared,blankText:tool.name};
  const data=JSON.parse(text||'{}'),entry=gameEntries(tool).find(e=>e.id===data.id);
  if(!entry)throw new Error('Choose an entry from this tool first.');
  if(action==='score'&&tool.type==='scoreboard'){
   if(!Number.isSafeInteger(data.delta)||Math.abs(data.delta)>100000)throw new Error('Enter a whole number of points.');
   const sum=(state.scores?.[entry.id]??Number(entry.score||0))+data.delta;
   const value=tool.config.scoreMode==='strikes'?Math.max(0,sum):sum;
   if(!Number.isSafeInteger(value))throw new Error('That score is too large.');
   return {...state,scores:{...state.scores,[entry.id]:value}};
  }
  if(action==='award'&&tool.type==='prize-list'){
   if(state.awarded?.[entry.id])throw new Error('This prize has already been awarded in this game.');
   const recipient=String(data.recipient||'').trim();if(!recipient||recipient.length>120)throw new Error('Enter the winner’s name.');
   return {...state,awarded:{...state.awarded,[entry.id]:recipient}};
  }
  throw new Error('That action is unavailable for this tool.');
 }
 if(action==='toggle'){
  if(tool.type!=='random-picker')throw new Error('Choose an image or card picker.');
  if(!state.cleared)return {...state,cleared:true};
  action='draw';
 }
 if(action==='clear')return {...state,cleared:true};
 if(action==='blank'){if(tool.type!=='blank-card')throw new Error('Choose a blank card.');if(!text.trim()||text.length>20000)throw new Error('Enter card text (up to 20,000 characters).');return {...state,blankText:text.trim(),question:null,shownAt:now,cleared:false,revealAt:null};}
 if(action==='draw'){
  if(tool.type!=='random-picker')throw new Error('Choose a card picker.');
  const cards=pickerCards(project,tool);if(!cards.length)throw new Error(tool.config.source==='images'?'Choose an image pool containing saved images.':'Connect a saved card list in Build Space first.');
  if(!state.cleared)throw new Error('Remove the current item before drawing another.');
  const available=cards.filter(c=>!state.used.includes(c.id));if(!available.length)throw new Error('No unused '+(tool.config.source==='images'?'images':'cards')+' remain in this pool. Start a new game to use them again.');
  const chosen=available[Math.min(available.length-1,Math.floor(Math.max(0,random())*available.length))];
  return {...state,used:[...state.used,chosen.id],question:{id:chosen.id,question:chosen.text,answer:''},selectedDesign:{...chosen.design},selectedAssetKey:chosen.assetKey,blankText:undefined,shownAt:now,cleared:false,revealAt:null};
 }
 if(tool.type==='random-picker')throw new Error('Use Draw random card, Remove card, or Start new game.');
 if(action==='show'){
  if(!state.cleared&&state.question&&cardPhase(project,tool,state,now)!=='answer')throw new Error('Finish or clear the current question before drawing another.');
  if(tool.type!=='question-card')throw new Error('Choose a question card system.');
  const available=questionPool(project,tool).filter(q=>!state.used.includes(q.id));
  if(!available.length)throw new Error('No unused questions remain. Start a new game explicitly to reset the question history.');
  const question=available[Math.min(available.length-1,Math.floor(Math.max(0,random())*available.length))];
  return {...state,used:[...state.used,question.id],question,blankText:undefined,shownAt:now,revealAt:null,cleared:false};
 }
 if(!state.question||state.cleared)throw new Error('Show a question first.');
 if(action==='reveal')return {...state,revealAt:now};
 if(cardPhase(project,tool,state,now)!=='question')throw new Error('This question has finished. Show the next unused question.');
 throw new Error('Invalid card action.');
}
export function publicCardState(project:Project,tool:GameTool,state:CardState,now=Date.now()):CardState{
 return {...state,used:[],question:state.question?{...state.question,answer:cardPhase(project,tool,state,now)==='answer'?state.question.answer:''}:null};
}
export function cardControl(action:string):{toolId:string;action:CardAction}|null{
 const m=action.match(/^cards\.(toggle|score|award|draw|show|reveal|clear|new-game|blank)\.(.+)$/);return m?{action:m[1] as CardAction,toolId:m[2]}:null;
}
export function createCardSystem(project:Project,backgroundKey?:string,kind:'question'|'answer'|'blank'='question'):Project{
 const id='card-'+crypto.randomUUID();
 const design={backgroundKey:backgroundKey||'',fontFamily:'Arial, sans-serif',fontSize:48,textColor:'#ffffff',backgroundColor:'#101827',accentColor:'#20e8ff',borderRadius:18,alignment:'center',vertical:'center',padding:28,width:65,height:25,x:17.5,y:30,marginTop:6,marginBottom:6,marginLeft:5,marginRight:5,entrance:'fade',exit:'fade',entranceSeconds:.5,exitSeconds:.5,delaySeconds:0,outline:0,glow:0};
 const tool:GameTool={id,type:kind==='blank'?'blank-card':'question-card',name:kind==='blank'?'Blank Card':'Question Cards',enabled:true,inToolbox:true,inOverlayBuild:true,config:{questionCard:{...design,...(kind==='answer'?{backgroundKey:''}:{})},answerCard:{...design,backgroundKey:kind==='answer'?backgroundKey||'':backgroundKey||''}}};
 const controls:ProjectEvent[]=kind==='blank'?[]:[{id:id+'-show',label:'Show Question',action:'cards.show.'+id,detail:'Random unused question',toolIds:[id]},{id:id+'-reveal',label:'Reveal Answer',action:'cards.reveal.'+id,detail:'Show the matching answer when ready',toolIds:[id]}];
 if(kind!=='blank')tool.config={...tool.config,poolId:project.gameTools.find(t=>t.type==='trivia-list'&&t.enabled)?.id||''};
 return {...project,gameTools:[...project.gameTools,tool],controls:[...project.controls,...controls]};
}
