import type {Project,ProjectEvent} from './project';
export function sequenceControls(project:Project,control:ProjectEvent){
 if(control.action!=='sequence'||!control.chain?.length)throw new Error('This sequence has no connected actions.');
 if(control.chain.length>30)throw new Error('Use at most 30 actions in a sequence.');
 let total=0;
 return control.chain.map(step=>{
  const target=project.controls.find(c=>c.id===step.refId);
  if(step.kind!=='control'||!target||target.id===control.id||target.buttonMode==='chain'||target.action==='sequence')throw new Error('Choose an existing single-action button for each sequence step.');
  const seconds=step.timing.mode==='delay'?Number(step.timing.seconds||0):0;
  if(!Number.isFinite(seconds)||seconds<0||seconds>300||(total+=seconds)>300)throw new Error('Keep the complete sequence within five minutes.');
  let action=target;
  if(step.cardAction){const match=target.action.match(/^cards\.(?:toggle|show|draw|reveal|clear)\.(.+)$/);if(!match||!['clear','reveal'].includes(step.cardAction))throw new Error('Choose a card control for this sequence action.');action={...target,action:`cards.${step.cardAction}.${match[1]}`,label:step.label};}
  return {control:action,delayMs:seconds*1000};
 });
}
export type SequenceProgress = Record<string,{signature:string;next:number}>;
export async function runSequence(project:Project,control:ProjectEvent,execute:(control:ProjectEvent)=>Promise<void>,signal:AbortSignal,progress:SequenceProgress={}){
 const steps=sequenceControls(project,control),signature=JSON.stringify([project.id,control.chain]);
 const saved=progress[control.id],index=saved?.signature===signature?saved.next:0;
 for(const step of control.sequenceMode==='per-press'?[steps[index%steps.length]]:steps){
  if(signal.aborted)return;
  if(step.delayMs)await new Promise<void>(resolve=>{
   const cancel=()=>{clearTimeout(timer);resolve();};
   const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},step.delayMs);
   signal.addEventListener('abort',cancel,{once:true});
  });
  if(signal.aborted)return;
  await execute(step.control);
  if(control.sequenceMode==='per-press'&&!signal.aborted)progress[control.id]={signature,next:(index+1)%steps.length};
 }
}
