import type {GameTool,Project} from './project';
export type ListCard={id:string;text:string;design:Record<string,unknown>};
export function listCards(tool:GameTool|undefined):ListCard[]{
 const raw=tool?.config.cards;if(!Array.isArray(raw))return [];
 return raw.filter((c):c is ListCard=>!!c&&typeof c==='object'&&typeof c.id==='string'&&typeof c.text==='string'&&!!c.text.trim()).map(c=>({...c,design:c.design&&typeof c.design==='object'?c.design:{}}));
}
export function pickerCards(project:Project,picker:GameTool):ListCard[]{return listCards(project.gameTools.find(t=>t.type==='card-list'&&t.enabled&&t.id===picker.config.listId));}
export function createCardList():GameTool{return {id:'list-'+crypto.randomUUID(),type:'card-list',name:'New card list',enabled:true,inToolbox:false,inOverlayBuild:false,config:{cards:[]}};}
export function randomFraction(){const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]/0x100000000;}
