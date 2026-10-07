"use client";
import {useEffect,useState} from 'react';
import type {GameTool} from '../lib/project';
export default function WheelHostPanel({tool,slug,hostKey,onSave}:{tool:GameTool;slug?:string;hostKey?:string;onSave?:(segments:string[])=>void}){
 const [text,setText]=useState((Array.isArray(tool.config.segments)?tool.config.segments:[]).join('\n'));
 const [loading,setLoading]=useState(!!slug),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{if(!slug)return;let cancelled=false;void (async()=>{try{const response=await fetch(`/api/live/${encodeURIComponent(slug)}?wheelSlots=${encodeURIComponent(tool.id)}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load wheel slots.');if(!cancelled)setText(data.segments.join('\n'));}catch(e){if(!cancelled)setStatus(e instanceof Error?e.message:'Could not load slots.');}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[slug,tool.id]);
 async function save(){
  const segments=text.split('\n').map(x=>x.trim()).filter(Boolean);
  if(segments.length<2||segments.length>100||segments.some(x=>x.length>200)){setStatus('Enter 2–100 slots, up to 200 characters each.');return;}
  setBusy(true);setStatus('');try{
   if(slug){const response=await fetch(`/api/live/${encodeURIComponent(slug)}`,{method:'POST',headers:{'Content-Type':'application/json','x-host-key':hostKey||''},body:JSON.stringify({wheelSlots:{toolId:tool.id,segments}})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Slots could not be saved.');}
   else onSave?.(segments);
   setStatus('Slots saved. They will be used on the next spin.');
  }catch(e){setStatus(e instanceof Error?e.message:'Slots could not be saved.');}finally{setBusy(false);}
 }
 return <section aria-label={`${tool.name} host settings`}><h3>{tool.name} · wheel slots</h3><label>Slots — one per line<textarea value={text} disabled={loading||busy} onChange={e=>setText(e.target.value)} rows={6} style={{display:'block',width:'100%',boxSizing:'border-box'}}/></label><p>Add, remove, rename, or reorder entries here. Saving does not spin the wheel or change a result already on screen.</p><button type="button" disabled={loading||busy||!!slug&&!hostKey} onClick={()=>void save()}>{loading?'Loading slots…':busy?'Saving…':'Save wheel slots'}</button><p role="status">{status}</p></section>;
}
