import type {YouTubePlacement} from './youtube';
const bound=(value:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;
export function normalizePlacement(p:YouTubePlacement):YouTubePlacement{
 const width=bound(p.width,1,100),height=bound(p.height,1,100);
 return {width,height,x:bound(p.x,0,100-width),y:bound(p.y,0,100-height)};
}
export function movePlacement(p:YouTubePlacement,dx:number,dy:number){return normalizePlacement({...p,x:p.x+dx,y:p.y+dy});}
export function resizePlacement(p:YouTubePlacement,dx:number,dy:number){return {...p,width:bound(p.width+dx,1,100-p.x),height:bound(p.height+dy,1,100-p.y)};}
export function toolShapePlacement(p:YouTubePlacement,shape:string){
 if(shape!=='circle')return normalizePlacement(p);
 const width=Math.min(p.width,p.height*1080/1920,56.25);
 return normalizePlacement({...p,width,height:width*1920/1080});
}
