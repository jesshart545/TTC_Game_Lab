import type {Project} from './project';
export type CoinPhase='show'|'flip'|'hide';
export function nextCoinPhase(previous?:CoinPhase):CoinPhase{return previous==='show'?'flip':previous==='flip'?'hide':'show';}
export function coinCycleRequest(request:string,history:unknown,project:Project,selection?:{kind?:string;id?:string}|null){
 const recent=Array.isArray(history)?history.filter(item=>item?.role==='user').slice(-3).map(item=>String(item.text||'')).join('\n'):'';
 const text=/\b(?:each|every)\s+press\b/i.test(request)?recent+'\n'+request:request;
 if(!/\bcoin\b/i.test(text)||!/\b(?:press|pressed|click|clicked)\b/i.test(text)||!(/\b(?:third|3rd|three|3)\b/i.test(text)&&/\b(?:flip|toss)\b/i.test(text)&&/\b(?:remove|hide|clear)\b/i.test(text)))return null;
 const coins=project.gameTools.filter(tool=>tool.enabled&&tool.type==='coin-toss');
 const selectedControl=project.controls.find(control=>selection?.kind==='control'&&control.id===selection.id);
 const coin=coins.find(tool=>selection?.kind==='tool'&&tool.id===selection.id||selectedControl?.toolIds?.includes(tool.id)||selectedControl?.action===`tool.${tool.id}`||selectedControl?.action===`coin.cycle.${tool.id}`)|| (coins.length===1?coins[0]:undefined);
 if(!coin)return {reply:coins.length?'Which coin should use the three-press button? Select it in Build Space, then ask again.':'Add a Coin Toss tool first, then I can connect its three-press button.',changes:{},manualSteps:[],action:null};
 return {reply:'I connected one coin button: first press shows the coin, second press flips and reveals it, third press removes it. The next press starts again.',changes:{coinCycles:[{toolId:coin.id,...(selectedControl&&(selectedControl.toolIds?.includes(coin.id)||selectedControl.action===`tool.${coin.id}`||selectedControl.action===`coin.cycle.${coin.id}`)?{controlId:selectedControl.id}:{})}]},manualSteps:[],action:null};
}
