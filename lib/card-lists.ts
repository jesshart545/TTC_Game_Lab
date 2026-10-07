import type {GameTool,Project} from './project';
export type ListCard={id:string;text:string;assetKey?:string;sourceUrl?:string;sourceTitle?:string;design:Record<string,unknown>};
export function listCards(tool:GameTool|undefined):ListCard[]{
 const raw=tool?.config.cards;if(!Array.isArray(raw))return [];
 return raw.filter((c):c is ListCard=>!!c&&typeof c==='object'&&typeof c.id==='string'&&typeof c.text==='string'&&!!c.text.trim()).map(c=>({...c,design:c.design&&typeof c.design==='object'?c.design:{}}));
}
export function pickerCards(project:Project,picker:GameTool):ListCard[]{if(picker.config.source==='images'){
 const pool=project.assetPools?.find(p=>p.id===picker.config.assetPoolId);
 return project.assets.filter(a=>pool?.assetKeys.includes(a.storageKey||a.name)&&a.url&&(a.type.toLowerCase().includes('image')||/\.(png|jpe?g|webp|gif|svg)$/i.test(a.name))).map(a=>({id:a.storageKey||a.name,text:a.name,assetKey:a.storageKey||a.name,design:{...(picker.config.placement as Record<string,unknown>||{})}}));
 }return listCards(project.gameTools.find(t=>t.type==='card-list'&&t.enabled&&t.id===picker.config.listId));}
export function createCardList():GameTool{return {id:'list-'+crypto.randomUUID(),type:'card-list',name:'New card list',enabled:true,inToolbox:false,inOverlayBuild:false,config:{cards:[]}};}
export function randomFraction(){const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]/0x100000000;}
