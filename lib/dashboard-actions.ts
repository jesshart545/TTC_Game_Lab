import type {Project,ProjectEvent} from './project';
import {mediaKind} from './board-design';
export type DashboardAction={value:string;label:string;help:string};
export type DashboardTarget={id:string;name:string;group:string;actions:DashboardAction[]};
export function dashboardTargets(project:Project,controlId:string):DashboardTarget[]{
 const action=(value:string,label:string,help:string):DashboardAction=>({value,label,help});
 const hide=(primary:string)=>{const button=project.controls.find(c=>c.id!==controlId&&c.action===primary);return button?[action('result.hide.'+button.id,'Stop / hide','Stop this item and remove its result from the overlay.')]:[];};
 const tools=project.gameTools.filter(t=>t.enabled&&!['card-list','trivia-list','blank-board','trivia-board'].includes(t.type)).map(tool=>{
  const id=tool.id;let actions:DashboardAction[];
  if(tool.type==='countdown')actions=[action(`timer.show.${id}`,'Show without starting','Display the saved timer without starting or resetting it.'),action(`timer.toggle.${id}`,'Start / pause','Start counting down; press again to pause.'),action(`timer.reset.${id}`,'Reset duration','Restore the saved duration and stop counting.'),action(`timer.hide.${id}`,'Hide timer','Remove the timer and stop counting.')];
  else if(tool.type==='question-card')actions=[action(`cards.show.${id}`,'Show question','Draw an unused question from this card’s connected question pool.'),action(`cards.reveal.${id}`,'Reveal answer','Reveal the answer to the current question when the host is ready.'),action(`cards.clear.${id}`,'Remove card','Hide the current question or answer.')];
  else if(tool.type==='blank-card')actions=[action(`cards.blank.${id}`,'Show saved card text','Display the text saved in this card. The host can also enter live text in its card panel.'),action(`cards.clear.${id}`,'Remove card','Hide this card from the overlay.')];
  else if(tool.type==='random-picker')actions=[action(`cards.toggle.${id}`,'Draw random item / remove','First press draws one unused item from the connected pool. Next press removes it. No repeats during this game.')];
  else if(['scoreboard','prize-list','game-tool-list'].includes(tool.type))actions=[action(`cards.toggle.${id}`,'Show / remove','Press once to show this tool; press again to remove it. Its private host panel changes scores or entries.')];
  else if(tool.type==='youtube')actions=[action(`tool.${id}`,'Open private YouTube search','Open search on the dashboard. Search stays private; the host chooses a video and presses Play on overlay separately.')];
  else if(tool.type==='coin-toss')actions=[action(`coin.cycle.${id}`,'Show → flip → remove','First press shows the coin, second flips and reveals, third removes it.'),action(`tool.${id}`,'Flip and reveal','Flip the coin and reveal a random Heads or Tails result.'),...hide(`tool.${id}`)];
  else actions=[action(`tool.${id}`,tool.type==='wheel'?'Spin wheel':tool.type==='dice'?'Roll dice':'Show / trigger','Run this tool only when the host presses the button.'),...hide(`tool.${id}`)];
  return {id:'tool:'+id,name:tool.name,group:'Game tools',actions};
 });
 const assets=project.assets.filter(a=>a.url).map(asset=>{const key=asset.storageKey||asset.name,kind=mediaKind(asset),plays=kind==='audio'||kind==='video',value='asset.show.'+key;return {id:'asset:'+key,name:asset.name,group:'Media',actions:[action(value,plays?'Play media':'Show image',plays?'Play this saved media when pressed.':'Show this image as an overlay item.'),...hide(value),...(kind==='image'||kind==='video'?[action('background.show.'+key,'Use as background','Replace the current overlay background with this image or video.')]:[])]};});
 const scenes=(project.compositions||[]).map(scene=>({id:'scene:'+scene.id,name:scene.name,group:'Scenes',actions:[action('composition.play.'+scene.id,'Play scene','Play this saved scene and its connected effects.'),...hide('composition.play.'+scene.id)]}));
 return [...tools,...assets,...scenes];
}
export function currentDashboardTarget(targets:DashboardTarget[],control:ProjectEvent){return targets.find(t=>t.actions.some(a=>a.value===control.action))?.id||'';}
