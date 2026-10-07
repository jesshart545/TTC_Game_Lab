import type { GameTool, ProjectAsset } from './project';
export type BoardArea={id:string;label:string;x:number;y:number;width:number;height:number;controlId?:string};
export function mediaKind(asset:ProjectAsset):'image'|'video'|'audio'|'unknown'{
 const value=(asset.type+' '+asset.name+' '+(asset.url||'').split('?')[0]).toLowerCase();
 if(value.includes('video')||/\.(mp4|webm|mov)(?:$|\s)/.test(value))return 'video';
 if(value.includes('image')||/\.(png|jpe?g|webp|gif|avif|svg)(?:$|\s)/.test(value))return 'image';
 if(value.includes('audio')||/\.(mp3|wav|ogg)(?:$|\s)/.test(value))return 'audio';
 return 'unknown';
}
export function boardAreas(tool:GameTool):BoardArea[]{
 if(!Array.isArray(tool.config.areas))return [];
 const bound=(value:unknown,fallback:number,min:number,max:number)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
 return tool.config.areas.map((a:any,i:number)=>{const x=bound(a.x,5,0,99),y=bound(a.y,5,0,99);return {id:String(a.id||'area-'+i),label:String(a.label||a.name||'Game space'),x,y,width:bound(a.width,20,1,100-x),height:bound(a.height,15,1,100-y),controlId:String(a.controlId||'')};});
}
