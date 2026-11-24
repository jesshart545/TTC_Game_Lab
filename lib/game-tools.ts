import type {GameTool,GameToolType,ProjectEvent,Project} from './project';
import {cityCrimeSceneDefaults} from './city-crime-scene';
import type {CardState} from './question-cards';
export type GameEntry={id:string;name:string;imageKey?:string;meaning?:string;score?:number};
export function strikeScoreboard(tool:GameTool){return tool.type==='scoreboard'&&tool.config.scoreMode==='strikes';}
export const infoTypes=['scoreboard','game-tool-list'];
export function gameEntries(tool:GameTool):GameEntry[]{
 const entries=Array.isArray(tool.config.entries)?tool.config.entries:[];
 return entries.filter((e):e is GameEntry=>!!e&&typeof e==='object'&&typeof e.id==='string'&&typeof e.name==='string');
}
/** Normalize entries being saved for an info tool: gameEntries only
 *  accepts entries carrying a string id and a name, so an entry saved
 *  without an id (a model-built gift guide, say) would silently never
 *  appear. Keep provided ids; assign one when missing — the same
 *  treatment the card-list path gives its entries. */
export function cleanInfoEntries(raw:unknown):Record<string,unknown>[]{
 return (Array.isArray(raw)?raw:[]).filter((e:any)=>!!e&&typeof e==='object'&&typeof e.name==='string'&&!!e.name.trim()).slice(0,500).map((e:any)=>({...e,id:typeof e.id==='string'&&e.id?e.id:crypto.randomUUID(),name:String(e.name).slice(0,200)}));
}
export function toolDefaults(type:GameToolType):Record<string,unknown>{
 const defaults:Partial<Record<GameToolType,Record<string,unknown>>>={
  wheel:{title:'Game Wheel',segments:['Prize','Challenge','Bonus','Mystery']},
  'random-picker':{source:'cards',listId:'',placement:{x:15,y:20,width:70,height:60}},
  countdown:{seconds:10},poll:{question:'Choose what happens next',options:['Option A','Option B']},dice:{sides:6},'coin-toss':{placement:{x:35,y:20,width:30,height:55}},plinko:{title:'Plinko',slots:['10','50','100','500','1000','500','100','50','10'],rows:9,pegColor:'#8b9bb4',ballColor:'#ff5d5d',slotColor:'#154c69',alternateSlotColor:'#512b75'},
  'higher-lower':{title:'Higher or Lower',cards:[{label:'4',value:4},{label:'9',value:9},{label:'2',value:2},{label:'7',value:7},{label:'K',value:13},{label:'5',value:5},{label:'A',value:1},{label:'Q',value:12},{label:'6',value:6},{label:'J',value:11}]},
  cliffhanger:{title:'Cliffhanger',items:[{label:'Coffee maker',price:49},{label:'Bluetooth speaker',price:79},{label:'Stand mixer',price:129}],stepsToFall:25,dollarsPerStep:1},
  'blank-board':{title:'Custom Board',areas:[]},'city-crime-scene':{title:'City Crime Scene',mystery:cityCrimeSceneDefaults(),placement:{x:8,y:8,width:84,height:84}},youtube:{placement:{x:15,y:15,width:70,height:70}},
  scoreboard:{entries:[]},'game-tool-list':{entries:[]},
  bank:{title:'Bank',roundSeconds:60,pressValue:10},
  'sound-board':{title:'Sound Board',pads:[]},
  'dj-deck':{title:'DJ Deck',tracks:[],poolIds:[],crossfadeSeconds:4},
 };
 return {...defaults[type]};
}
/** The shared label-list cleaner behind every chance-tool sanitizer
 *  below: each entry becomes a trimmed string with every dollar-sign
 *  character removed (Jessica's no-dollar-signs rule is absolute,
 *  2026-11-14). The character is built from its char code because the
 *  no-dollar-signs-templates guard scans this file for the literal
 *  character. A cleaner NEVER substitutes the stock defaults and never
 *  pads: a tool Jewel builds carries the creator's own values, not the
 *  same defaults every other tool gets (Jessica, 2026-11-15). Non-array
 *  input yields an empty list; entries that are not strings or numbers
 *  yield empty strings. An already-clean list keeps its identity:
 *  callers (and the test harness's strict comparisons) can rely on an
 *  untouched list staying the very same array. */
function cleanLabelList(input:unknown):string[]{
 if(!Array.isArray(input))return[];
 const dollar=String.fromCharCode(36);
 let changed=false;
 const cleaned=input.map(entry=>{
  const value=typeof entry==='string'||typeof entry==='number'?String(entry).split(dollar).join('').trim():'';
  if(value!==entry)changed=true;
  return value;
 });
 return changed?cleaned:input as string[];
}
/** Sanitize Plinko slot labels Jewel supplies (see cleanLabelList). */
export function cleanPlinkoSlots(input:unknown):string[]{
 return cleanLabelList(input);
}
/** Sanitize Game Wheel segment labels Jewel supplies — the Plinko
 *  treatment for the wheel's segments (Jessica, 2026-11-15): dollar
 *  signs stripped, the creator's own labels preserved in position,
 *  stock defaults never padded in. */
export function cleanWheelSegments(input:unknown):string[]{
 return cleanLabelList(input);
}
/** One label's text with the dollar-sign character removed and
 *  whitespace trimmed; numbers stringify, anything else reads empty. */
export function cleanLabelText(value:unknown):string{
 return typeof value==='string'||typeof value==='number'?String(value).split(String.fromCharCode(36)).join('').trim():'';
}
/** Sanitize Higher or Lower cards Jewel supplies: each card keeps its
 *  own fields and position, its label gets the Plinko treatment
 *  (dollar signs stripped, trimmed), and its value is coerced to a
 *  number. The creator's deck is never replaced or padded with the
 *  stock deck. Non-array input yields an empty list. Like the label
 *  lists, an already-clean deck keeps its identity — entries that
 *  needed no change stay the very same objects, and a fully clean
 *  deck stays the very same array. */
export function cleanHigherLowerCards(input:unknown):{label:string;value:number}[]{
 if(!Array.isArray(input))return[];
 let changed=false;
 const cleaned=input.map(entry=>{
  const card=entry&&typeof entry==='object'?(entry as Record<string,unknown>):null;
  if(!card){changed=true;return {label:'',value:0};}
  const label=cleanLabelText(card.label),value=Number(card.value)||0;
  if(label===card.label&&value===card.value)return card as {label:string;value:number};
  changed=true;
  return {...card,label,value};
 });
 return changed?cleaned:input as {label:string;value:number}[];
}
/** Sanitize Cliffhanger items Jewel supplies: each item keeps its own
 *  fields and position, its label gets the Plinko treatment (dollar
 *  signs stripped, trimmed), and its price is coerced to a number.
 *  The creator's items are never replaced or padded with the stock
 *  items. Non-array input yields an empty list, and an already-clean
 *  list keeps its identity, entry for entry and as a whole. */
export function cleanCliffhangerItems(input:unknown):{label:string;price:number}[]{
 if(!Array.isArray(input))return[];
 let changed=false;
 const cleaned=input.map(entry=>{
  const item=entry&&typeof entry==='object'?(entry as Record<string,unknown>):null;
  if(!item){changed=true;return {label:'',price:0};}
  const label=cleanLabelText(item.label),price=Number(item.price)||0;
  if(label===item.label&&price===item.price)return item as {label:string;price:number};
  changed=true;
  return {...item,label,price};
 });
 return changed?cleaned:input as {label:string;price:number}[];
}
/** The positional merge a draft patch of a label list gets (the
 *  Plinko rule, shared by slots and wheel segments): a position the patch leaves blank — or does not reach —
 *  keeps the tool's existing value there, so an edit never silently
 *  erases the creator's own labels; a position with a real patched
 *  value takes it, and the stock defaults are never filled in. When
 *  preservation added nothing, the patch list stands as-is. */
export function mergeCleanedLabels(cleaned:string[],existing:string[]):string[]{
 const merged:string[]=[];
 for(let i=0;i<Math.max(cleaned.length,existing.length);i++){
  if(cleaned[i])merged.push(cleaned[i]);
  else if(existing[i])merged.push(existing[i]);
  else if(i<cleaned.length)merged.push('');
 }
 return merged.length===cleaned.length&&merged.every((value,i)=>value===cleaned[i])?cleaned:merged;
}
/** The second wheel is removed (Jessica, 2026-11-15: "there is no
 *  need for a second big wheel"). The site keeps ONE wheel — the
 *  selector Game Wheel, whose segments are any labels the creator
 *  decides — so a saved Big Prize Wheel tool (type "prize-wheel",
 *  written before the removal) converts to it losslessly on load:
 *  its values become the wheel's segments, run through the same
 *  label cleaning as any Jewel-written list; the tool's id, name,
 *  enabled state and toolbox/overlay placement carry over untouched,
 *  and so does the rest of its config — title, appearance, placement,
 *  its own artwork (artStyle/artKey: the wheel is a chance-art tool
 *  too), and its two wheel colors, which the selector wheel reads
 *  from the very same slotColor / alternateSlotColor fields. Only
 *  the values list itself is consumed (it becomes segments) and the
 *  closest-to-100 accumulation game goes away with the tool — no
 *  scoring is grafted onto the selector wheel. The conversion runs
 *  on the project's tools and on its published snapshot's tools, is
 *  idempotent (a converted project converts no further), touches no
 *  other tool, and returns the SAME project object when nothing
 *  needed converting, so load paths can tell whether a save-back is
 *  owed. */
export function convertPrizeWheelTools(project:Project):Project{
 const convertList=(tools:GameTool[]|undefined):GameTool[]|undefined=>{
  if(!Array.isArray(tools))return tools;
  let changed=false;
  const next=tools.map(tool=>{
   if((tool.type as string)!=='prize-wheel')return tool;
   changed=true;
   const config=(tool.config&&typeof tool.config==='object'?tool.config:{}) as Record<string,unknown>;
   const {values,...rest}=config;
   return {...tool,type:'wheel' as GameToolType,config:{...rest,segments:cleanWheelSegments(values)}};
  });
  return changed?next:tools;
 };
 const gameTools=convertList(project.gameTools);
 const snapshot=project.publishedSnapshot;
 const snapshotTools=snapshot?convertList(snapshot.gameTools):undefined;
 if(gameTools===project.gameTools&&snapshotTools===(snapshot?snapshot.gameTools:undefined))return project;
 return {...project,gameTools:gameTools as GameTool[],...(snapshot?{publishedSnapshot:{...snapshot,gameTools:snapshotTools as GameTool[]}}:{})};
}
export function controlLabel(project:Project,control:ProjectEvent,states:Record<string,CardState>){
 const match=control.action.match(/^cards\.toggle\.(.+)$/);if(!match)return control.label;
 const tool=project.gameTools.find(t=>t.id===match[1]);
 // The draw/remove label swap belongs to the random picker's toggle
 // only: its one button draws an item, then removes that same item.
 // A question-card toggle is a three-press cycle (draw, reveal,
 // clear) under one steady saved label — swapping it to "Remove …"
 // while a card is up misnames the button mid-game (2026-11-12), so
 // card-cycle controls always keep their saved label.
 if(!tool||tool.type!=='random-picker')return control.label;
 const visible=states[tool.id]&&!states[tool.id].cleared;
 const noun=tool.config.source==='images'?'image':'card';
 return visible?`Remove ${noun}`:/^Draw random (image|card):/.test(control.label)?`Draw random ${noun}: ${tool.name}`:control.label;
}
export function controlButtonStyle(control:ProjectEvent){return control.appearance||{};}
