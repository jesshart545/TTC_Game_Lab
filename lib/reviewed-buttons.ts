import type {Project,GameTool} from './project';
import {addCreationControl} from './build-controls';
export function addReviewedButtons(project:Project,kind:'asset'|'tool'|'composition',id:string,choices:{action:string;label:string}[],newTool?:GameTool){
 const base=newTool&&!project.gameTools.some(t=>t.id===newTool.id)?{...project,gameTools:[...project.gameTools,newTool]}:project;
 const result=addCreationControl(base,kind,id),existing=new Set(project.controls.map(c=>c.id));
 // IDs for automatically paired Hide controls may be regenerated at confirmation.
 // Match them to the original reviewed primary action rather than a stale UUID.
 const reviewed=new Map(choices.map(c=>[c.action,c.label]));
 const hideChoice=choices.find(c=>c.action.startsWith('result.hide.'));
 const controls=result.project.controls.filter(c=>existing.has(c.id)||reviewed.has(c.action)||!!hideChoice&&c.action.startsWith('result.hide.')&&result.project.controls.some(primary=>primary.id===c.action.slice(12)&&reviewed.has(primary.action))).map(c=>existing.has(c.id)?c:{...c,label:reviewed.get(c.action)||(c.action.startsWith('result.hide.')?hideChoice?.label:undefined)||c.label});
 return {...result,project:{...result.project,controls},controlId:controls.find(c=>c.id===result.controlId)?.id||controls.find(c=>!existing.has(c.id))?.id||result.controlId};
}
