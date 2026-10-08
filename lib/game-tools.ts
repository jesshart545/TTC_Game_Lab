import type {GameTool,GameToolType,ProjectEvent,Project} from './project';
import type {CardState} from './question-cards';
export type GameEntry={id:string;name:string;imageKey?:string;meaning?:string;score?:number};
export function strikeScoreboard(tool:GameTool){return tool.type==='scoreboard'&&tool.config.scoreMode==='strikes';}
export const infoTypes=['scoreboard','prize-list','game-tool-list'];
export function gameEntries(tool:GameTool):GameEntry[]{
 const entries=Array.isArray(tool.config.entries)?tool.config.entries:[];
 return entries.filter((e):e is GameEntry=>!!e&&typeof e==='object'&&typeof e.id==='string'&&typeof e.name==='string');
}
export function toolDefaults(type:GameToolType):Record<string,unknown>{
 const defaults:Partial<Record<GameToolType,Record<string,unknown>>>={
  wheel:{title:'Game Wheel',segments:['Prize','Challenge','Bonus','Mystery']},
  'random-picker':{source:'cards',listId:'',placement:{x:15,y:20,width:70,height:60}},
  countdown:{seconds:10},poll:{question:'Choose what happens next',options:['Option A','Option B']},dice:{sides:6},'coin-toss':{placement:{x:35,y:20,width:30,height:55}},
  'blank-board':{title:'Custom Board',areas:[]},youtube:{placement:{x:15,y:15,width:70,height:70}},
  scoreboard:{entries:[]},'prize-list':{entries:[]},'game-tool-list':{entries:[]},
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
