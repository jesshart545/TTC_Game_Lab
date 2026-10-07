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
  return {control:target,delayMs:seconds*1000};
 });
}
export async function runSequence(project:Project,control:ProjectEvent,execute:(control:ProjectEvent)=>Promise<void>,signal:AbortSignal){
 for(const step of sequenceControls(project,control)){
  if(signal.aborted)return;
  if(step.delayMs)await new Promise<void>(resolve=>{
   const cancel=()=>{clearTimeout(timer);resolve();};
   const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},step.delayMs);
   signal.addEventListener('abort',cancel,{once:true});
  });
  if(signal.aborted)return;
  await execute(step.control);
 }
}
