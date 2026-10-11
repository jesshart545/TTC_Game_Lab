"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';

type Message={id:number;email?:string;topic:string;message:string;page?:string;status:string};

export default function AdminMailbox(){
 const [admin,setAdmin]=useState<boolean|null>(null);
 const [messages,setMessages]=useState<Message[]>([]);
 const [error,setError]=useState(''),[status,setStatus]=useState('');
 async function refresh(){
  const r=await fetch('/api/help',{cache:'no-store'});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'Mailbox could not be loaded.');
  setAdmin(!!data.admin);setMessages(data.messages||[]);
 }
 useEffect(()=>{let cancelled=false;void (async()=>{try{await refresh();}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Mailbox could not be loaded.');}})();return()=>{cancelled=true;};},[]);
 async function setReviewStatus(id:number,newStatus:string){
  setStatus('');try{
   const r=await fetch('/api/help',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:newStatus})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'Status could not be saved.');
   await refresh();
  }catch(e){setStatus(e instanceof Error?e.message:'Update failed.');}
 }
 return <main className="help-page"><Link href="/admin">← Admin dashboard</Link><h1>Support mailbox</h1>
 {error&&<p role="alert">{error}</p>}
 {admin===false&&<p role="alert">Admin access required.</p>}
 {admin===true&&<>
  {!messages.length?<p>No messages.</p>:messages.map(m=><article key={m.id}><strong>{m.topic} · {m.status}</strong>{m.email&&<p>{m.email}</p>}<p style={{whiteSpace:'pre-wrap'}}>{m.message}</p>{m.page&&<small>{m.page}</small>}<label>Review status<select value={m.status} onChange={e=>void setReviewStatus(m.id,e.target.value)}>{['New','Reviewed','Resolved'].map(s=><option key={s}>{s}</option>)}</select></label></article>)}
  {status&&<p role="status">{status}</p>}
 </>}
 </main>;
}
