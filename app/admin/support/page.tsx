"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "./support.css";
type Report={id:string;email:string;category:string;subject:string;message:string;page:string;status:string;email_status:string;created_at:string};
type Inbox={messages:Report[];accountEmail:string;recipient:string;emailConfigured:boolean};
export default function SupportInbox() {
  const [data,setData]=useState<Inbox|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [filter,setFilter]=useState("all");
  const load=useCallback(async()=>{
    try {
      const response=await fetch("/api/support/admin",{cache:"no-store"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || "Could not load inbox.");
      setData(result);setError("");
    }catch(error){setError(error instanceof Error ? error.message : "Could not load inbox.");}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function update(body:Record<string,string>){
    setBusy(body.id || body.action);setError("");
    try{
      const response=await fetch("/api/support/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw new Error(result.error || "Could not update inbox.");
      await load();
    }catch(error){setError(error instanceof Error ? error.message : "Could not update inbox.");}
    finally{setBusy("");}
  }
  return <main className="support-inbox"><header><Link href="/">← TTCGameLab Home</Link><button onClick={()=>void load()}>Refresh inbox</button></header><small>PRIVATE · ADMIN ONLY</small><h1>Contact inbox</h1><p>Users' concerns, site issues, and recommendations.</p>
    {error ? <p role="alert">{error}</p> : null}
    {!data ? <p role="status">{error ? "Inbox unavailable." : "Loading inbox…"}</p> : <>
      <section className="support-delivery"><h2>Email notifications</h2><p>Destination: {data.recipient || "Not selected"}</p><p>{data.emailConfigured ? "Email delivery is connected." : "Reports are saved here. Email delivery needs a connected sending service."}</p>
      <button disabled={Boolean(busy)} onClick={()=>void update({action:"configure"})}>Use my account email ({data.accountEmail})</button></section>
      <label>Show messages <select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All</option><option value="new">New</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option></select></label>
      {data.messages.filter(report=>filter==="all" || report.status===filter).length===0 ? <p>No messages in this view.</p> : null}
      {data.messages.filter(report=>filter==="all" || report.status===filter).map(report=><article key={report.id}><div className="support-report-head"><small>{report.category.toUpperCase()} · {new Date(report.created_at).toLocaleString()}</small><span>{report.status}</span></div><h2>{report.subject}</h2><a href={"mailto:"+report.email}>{report.email}</a><p className="support-message">{report.message}</p><p className="support-page">Page: {report.page}</p><small>Reference: {report.id} · Email notification: {report.email_status}</small><div className="support-actions"><a className="support-reply" href={"mailto:"+report.email+"?subject="+encodeURIComponent("Re: "+report.subject)}>Reply by email</a><button disabled={Boolean(busy)} onClick={()=>void update({id:report.id,status:"reviewed"})}>Mark reviewed</button><button disabled={Boolean(busy)} onClick={()=>void update({id:report.id,status:report.status==="resolved"?"new":"resolved"})}>{report.status==="resolved"?"Reopen":"Mark resolved"}</button>{report.email_status!=="sent" && data.emailConfigured ? <button disabled={Boolean(busy)} onClick={()=>void update({id:report.id,action:"retry"})}>Retry email notification</button> : null}</div></article>)}
    </>}
  </main>;
}
