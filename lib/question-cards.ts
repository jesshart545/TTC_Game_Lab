import type { GameTool, Project, ProjectEvent } from './project';
export type CardAction = 'show'|'turn'|'steal'|'reveal'|'clear'|'new-game'|'blank';
export type CardQuestion = {id:string;question:string;answer:string;category?:string};
export type CardState = {version:number;gameId:string;used:string[];question:CardQuestion|null;shownAt:number;turnAt:number|null;stealAt:number|null;revealAt:number|null;cleared:boolean;blankText?:string};
export const freshCardState = ():CardState => ({version:0,gameId:'game-'+Date.now(),used:[],question:null,shownAt:0,turnAt:null,stealAt:null,revealAt:null,cleared:true});
const record=(value:unknown):Record<string,unknown> => value && typeof value==='object' ? value as Record<string,unknown> : {};
export function bounded(value:unknown,fallback:number,min:number,max:number){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
export function cardDesign(tool:GameTool,answer=false){return record(tool.config[answer?'answerCard':'questionCard']);}
export function questionPool(project:Project,tool:GameTool):CardQuestion[]{
 const pool=project.gameTools.find(t=>t.id===tool.config.poolId&&t.enabled&&t.type==='trivia-list');
 const raw=Array.isArray(pool?.config.questions)?pool.config.questions:[];
 const seen=new Set<string>();
 return raw.flatMap((item:unknown)=>{const q=record(item),question=String(q.question||q.prompt||'').trim(),answer=String(q.answer||'').trim();const id=question.toLocaleLowerCase().replace(/\s+/g,' ');if(!question||!answer||seen.has(id))return [];seen.add(id);return [{id,question,answer,category:String(q.category||'')}];});
}
export function linkedTimer(project:Project,tool:GameTool,steal=false){return project.gameTools.find(t=>t.id===tool.config[steal?'stealTimerId':'turnTimerId']&&t.type==='countdown'&&t.enabled);}
export function timerSeconds(project:Project,tool:GameTool,steal=false){return bounded(linkedTimer(project,tool,steal)?.config.seconds,steal?10:30,1,86400);}
export function cardPhase(project:Project,tool:GameTool,state:CardState,now=Date.now()):'hidden'|'question'|'exit'|'answer'{
 if(state.cleared||(!state.question&&!state.blankText))return 'hidden';
 if(state.revealAt!==null&&now>=state.revealAt)return 'answer';
 if(state.stealAt!==null&&linkedTimer(project,tool,true)){const finish=state.stealAt+timerSeconds(project,tool,true)*1000;if(now>=finish){const design=cardDesign(tool);const exit=design.exit==='none'?0:bounded(design.exitSeconds,.5,0,5)*1000;return now>=finish+exit?'answer':'exit';}}
 return 'question';
}
export function cardTransition(project:Project,tool:GameTool,previous:CardState,action:CardAction,now=Date.now(),random=Math.random,text=''):CardState{
 const state={...previous,used:[...previous.used],version:previous.version+1};
 if(action==='new-game')return {...freshCardState(),version:state.version,gameId:'game-'+now};
 if(action==='clear')return {...state,cleared:true,turnAt:null,stealAt:null};
 if(action==='blank'){if(tool.type!=='blank-card')throw new Error('Choose a blank card.');if(!text.trim()||text.length>20000)throw new Error('Enter card text (up to 20,000 characters).');return {...state,blankText:text.trim(),question:null,shownAt:now,cleared:false,revealAt:null};}
 if(action==='show'){
  if(!state.cleared&&state.question&&cardPhase(project,tool,state,now)!=='answer')throw new Error('Finish or clear the current question before drawing another.');
  if(tool.type!=='question-card')throw new Error('Choose a question card system.');
  const available=questionPool(project,tool).filter(q=>!state.used.includes(q.id));
  if(!available.length)throw new Error('No unused questions remain. Start a new game explicitly to reset the question history.');
  const question=available[Math.min(available.length-1,Math.floor(Math.max(0,random())*available.length))];
  return {...state,used:[...state.used,question.id],question,blankText:undefined,shownAt:now,turnAt:null,stealAt:null,revealAt:null,cleared:false};
 }
 if(!state.question||state.cleared)throw new Error('Show a question first.');
 if(action==='reveal')return {...state,revealAt:now,turnAt:null,stealAt:null};
 if(cardPhase(project,tool,state,now)!=='question')throw new Error('This question has finished. Show the next unused question.');
 if(action==='turn'){if(!linkedTimer(project,tool))throw new Error('Connect an optional Player Turn timer first.');if(state.turnAt!==null)throw new Error('The Player Turn timer has already started.');return {...state,turnAt:now};}
 if(action==='steal'){if(!linkedTimer(project,tool,true))throw new Error('Connect an optional Steal timer first.');if(linkedTimer(project,tool)&&(state.turnAt===null||now<state.turnAt+timerSeconds(project,tool)*1000))throw new Error('Wait for the Player Turn timer to finish.');if(state.stealAt!==null)throw new Error('The Steal timer has already started.');return {...state,stealAt:now};}
 throw new Error('Invalid card action.');
}
export function publicCardState(project:Project,tool:GameTool,state:CardState,now=Date.now()):CardState{
 return {...state,used:[],question:state.question?{...state.question,answer:cardPhase(project,tool,state,now)==='answer'?state.question.answer:''}:null};
}
export function cardControl(action:string):{toolId:string;action:CardAction}|null{
 const m=action.match(/^cards\.(show|turn|steal|reveal|clear|new-game)\.(.+)$/);return m?{action:m[1] as CardAction,toolId:m[2]}:null;
}
export function createCardSystem(project:Project,backgroundKey?:string,kind:'question'|'answer'|'blank'='question'):Project{
 const id='card-'+crypto.randomUUID();
 const design={backgroundKey:backgroundKey||'',fontFamily:'Arial, sans-serif',fontSize:48,textColor:'#ffffff',backgroundColor:'#101827',accentColor:'#20e8ff',borderRadius:18,alignment:'center',vertical:'center',padding:28,width:65,height:25,x:17.5,y:30,marginTop:6,marginBottom:6,marginLeft:5,marginRight:5,entrance:'fade',exit:'fade',entranceSeconds:.5,exitSeconds:.5,delaySeconds:0,outline:0,glow:0};
 const tool:GameTool={id,type:kind==='blank'?'blank-card':'question-card',name:kind==='blank'?'Blank Card':'Question Cards',enabled:true,inToolbox:true,inOverlayBuild:true,config:{questionCard:{...design,...(kind==='answer'?{backgroundKey:''}:{})},answerCard:{...design,backgroundKey:kind==='answer'?backgroundKey||'':backgroundKey||''}}};
 const controls:ProjectEvent[]=kind==='blank'?[]:[{id:id+'-show',label:'Show Question',action:'cards.show.'+id,detail:'Random unused question',toolIds:[id]},{id:id+'-reveal',label:'Reveal Answer',action:'cards.reveal.'+id,detail:'Show the matching answer when ready',toolIds:[id]}];
 if(kind!=='blank')tool.config={...tool.config,poolId:project.gameTools.find(t=>t.type==='trivia-list'&&t.enabled)?.id||'',turnTimerId:'',stealTimerId:''};
 return {...project,gameTools:[...project.gameTools,tool],controls:[...project.controls,...controls]};
}
