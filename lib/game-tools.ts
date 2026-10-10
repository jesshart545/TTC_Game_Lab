import type {GameTool,GameToolType,ProjectEvent,Project} from './project';
import type {CardState} from './question-cards';
export type GameEntry={id:string;name:string;imageKey?:string;meaning?:string;score?:number};
export function strikeScoreboard(tool:GameTool){return tool.type==='scoreboard'&&tool.config.scoreMode==='strikes';}
export const infoTypes=['scoreboard','prize-list','game-tool-list'];
export function gameEntries(tool:GameTool):GameEntry[]{
 const entries=Array.isArray(tool.config.entries)?tool.config.entries:[];
 return entries.filter((e):e is GameEntry=>!!e&&typeof e==='object'&&typeof e.id==='string'&&typeof e.name==='string');
}
const neonLook={appearance:{backgroundColor:'#101827',textColor:'#ffffff',accentColor:'#20e8ff',fontFamily:'Arial, sans-serif',fontSize:28,borderRadius:14,shape:'rounded',showTitle:true,showBorder:true,transparentBackground:false}};
export function toolDefaults(type:GameToolType):Record<string,unknown>{
 const defaults:Partial<Record<GameToolType,Record<string,unknown>>>={
  wheel:{title:'Game Wheel',segments:['Prize','Challenge','Bonus','Mystery'],slotColor:'#154c69',alternateSlotColor:'#512b75',placement:{x:20,y:12,width:60,height:70},...neonLook},
  'random-picker':{source:'cards',listId:'',placement:{x:15,y:20,width:70,height:60},...neonLook},
  countdown:{seconds:30,display:'numbers',label:'Answer Timer',placement:{x:35,y:72,width:30,height:18},...neonLook},
  poll:{question:'Choose what happens next',options:['Option A','Option B','Option C'],placement:{x:15,y:20,width:70,height:55},...neonLook},
  dice:{sides:6,faceColor:'#f5faff',pipColor:'#102132',placement:{x:35,y:25,width:30,height:45},...neonLook},
  'coin-toss':{faceColor:'#ffd166',placement:{x:35,y:20,width:30,height:55},...neonLook},
  'blank-board':{title:'Custom Board',areas:[]},
  youtube:{placement:{x:15,y:15,width:70,height:70}},
  scoreboard:{scoreMode:'points',entries:[{id:crypto.randomUUID?.()||'team-a',name:'Team A',score:0},{id:crypto.randomUUID?.()||'team-b',name:'Team B',score:0}],placement:{x:10,y:15,width:80,height:50},...neonLook},
  'prize-list':{entries:[{id:crypto.randomUUID?.()||'prize-1',name:'Grand Prize'},{id:crypto.randomUUID?.()||'prize-2',name:'Runner-up'}],placement:{x:15,y:15,width:70,height:55},...neonLook},
  'game-tool-list':{entries:[{id:crypto.randomUUID?.()||'gift-1',name:'Rose',meaning:'Adds 1 point'},{id:crypto.randomUUID?.()||'gift-2',name:'Galaxy',meaning:'Extra spin'}],placement:{x:15,y:15,width:70,height:55},...neonLook},
 };
 return {...defaults[type]};
}
export function controlLabel(project:Project,control:ProjectEvent,states:Record<string,CardState>){
 const match=control.action.match(/^cards\.toggle\.(.+)$/);if(!match)return control.label;
 const tool=project.gameTools.find(t=>t.id===match[1]);if(!tool)return control.label;
 const visible=states[tool.id]&&!states[tool.id].cleared;
 const noun=tool.type==='random-picker'?(tool.config.source==='images'?'image':'card'):tool.name;
 return visible?`Remove ${noun}`:tool.type==='random-picker'&&/^Draw random (image|card):/.test(control.label)?`Draw random ${noun}: ${tool.name}`:control.label;
}
export function controlButtonStyle(control:ProjectEvent){return control.appearance||{};}
