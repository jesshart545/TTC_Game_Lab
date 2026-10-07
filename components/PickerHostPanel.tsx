"use client";
import {useState} from 'react';
import type {GameTool,Project} from '../lib/project';
import {pickerCards} from '../lib/card-lists';
import {freshCardState,type CardState,type CardAction} from '../lib/question-cards';
export default function PickerHostPanel({project,tool,state,onCommand}:{project:Project;tool:GameTool;state?:CardState;onCommand:(id:string,action:CardAction)=>void|Promise<void>}){
 const noun=tool.config.source==='images'?'image':'card';
 const connected=project.controls.some(c=>c.action===`cards.toggle.${tool.id}`);
 const current=state||freshCardState(),remaining=pickerCards(project,tool).filter(c=>!current.used.includes(c.id)).length;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[reset,setReset]=useState(false);
 async function run(action:CardAction){setBusy(true);setError('');try{await onCommand(tool.id,action);setReset(false);}catch(e){setError(e instanceof Error?e.message:'Could not draw a card.');}finally{setBusy(false);}}
 return <section className="card-host" aria-label={`${tool.name} random draw controls`}><h3>{tool.name}</h3><p>{remaining} unused {noun}s remain. Used items stay unavailable for the rest of this game.</p>{!connected&&<button type="button" disabled={busy||(current.cleared&&!remaining)} onClick={()=>void run('toggle')}>{current.cleared?`Draw random ${noun}`:`Remove ${noun}`}</button>}<button type="button" disabled={busy} onClick={()=>setReset(true)}>Start new game</button>{reset&&<div role="alert"><p>Start a new game? All items in this picker will become available again.</p><button type="button" disabled={busy} onClick={()=>void run('new-game')}>Yes, start new game</button><button type="button" onClick={()=>setReset(false)}>Keep current game</button></div>}{error&&<p role="alert">{error}</p>}</section>;
}
