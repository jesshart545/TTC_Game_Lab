"use client";
import {useState} from 'react';
import type {GameTool} from '../lib/project';

// Private host panel: enter the player's price guess for the item on screen.
// The server moves the climber up for every dollar off.
export default function CliffhangerHostPanel({tool,slug,hostKey}:{tool:GameTool;slug?:string;hostKey?:string}){
 const [guess,setGuess]=useState('');
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 async function submit(){
  const value=Math.max(0,Math.round(Number(guess)));
  if(!Number.isFinite(value)||guess.trim()===''){setStatus('Enter the price guess in dollars.');return;}
  setBusy(true);setStatus('');
  try{
   if(slug){
    const response=await fetch(`/api/live/${encodeURIComponent(slug)}`,{method:'POST',headers:{'Content-Type':'application/json','x-host-key':hostKey||''},body:JSON.stringify({cliffGuess:{toolId:tool.id,guess:value}})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Guess could not be sent.');
    const o=data.outcome||{};
    setStatus(o.fell?`Off by $${o.diff} — he climbs ${o.steps} steps and FALLS!`:`Off by $${o.diff} — he climbs ${o.steps} ${o.steps===1?'step':'steps'}.`);
    setGuess('');
   }
  }catch(e){setStatus(e instanceof Error?e.message:'Guess could not be sent.');}
  finally{setBusy(false);}
 }
 return <section aria-label={`${tool.name} price guess`}><h3>{tool.name} · price guess</h3>
  <p>Show an item with the Next item button, then enter the player's price guess here. Keep it private — the overlay only shows how far off the guess was.</p>
  <label>Player's guess ($)<input type="number" min={0} value={guess} disabled={busy} onChange={e=>setGuess(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void submit();}}}/></label>
  <button type="button" disabled={busy||!slug||!hostKey} onClick={()=>void submit()}>{busy?'Sending…':'Submit guess'}</button>
  <p role="status">{status}</p>
 </section>;
}
