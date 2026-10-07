"use client";
import { useRef, useState } from "react";
import type { WebResult } from "../lib/web-search";

export default function GoogleSearch({slug,hostKey,onSavePool}:{slug?:string;hostKey?:string;onSavePool?:(name:string,results:WebResult[])=>void}) {
  const [selected,setSelected]=useState<string[]>([]),[poolName,setPoolName]=useState(""),[saved,setSaved]=useState("");
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<WebResult[]>([]);
  const [searched,setSearched]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const active=useRef<AbortController|null>(null);
  async function search(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const q=query.trim();if(!q)return;
    active.current?.abort();const controller=new AbortController();active.current=controller;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/web-search",{method:"POST",headers:{"Content-Type":"application/json",...(hostKey?{"x-host-key":hostKey}:{})},body:JSON.stringify({q,slug}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Search is temporarily unavailable.");
      if(active.current!==controller)return;
      setResults(data.results);setSearched(q);setSelected([]);setSaved("");
      if(!data.results.length)setError("No results found. Try a different search.");
    } catch(e) {if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Search is temporarily unavailable.");}
    finally {if(active.current===controller)setBusy(false);}
  }
  return <section className="card-host" aria-label="Private web search"><h3>Web Search</h3>
    <form onSubmit={search}><label>Search the web<input value={query} onChange={e=>setQuery(e.target.value)} required maxLength={200} placeholder="Search for information during the game"/></label><button type="submit" disabled={busy}>{busy?"Searching…":"Search"}</button></form>
    <small>Results and summaries stay here. Open a website in a separate tab when needed. Search never appears on the overlay.</small>
    {busy&&<p role="status">Searching the web…</p>}{error&&<p role="alert">{error}</p>}
    {searched&&<div aria-label="Search results" style={{maxHeight:420,overflowY:"auto"}}><p>Results for “{searched}”</p>{results.map(result=><article key={result.url} style={{padding:"12px 0",borderBottom:"1px solid #334155"}}><>{onSavePool&&<label><input type="checkbox" checked={selected.includes(result.url)} onChange={e=>setSelected(items=>e.target.checked?[...items,result.url]:items.filter(url=>url!==result.url))}/>Select this result for a pool</label>}</><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a><small style={{display:"block"}}>{new URL(result.url).hostname}</small><p>{result.summary}</p></article>)}</div>}
    {onSavePool&&results.length>0&&<section aria-label="Save search results as pool"><label>Pool name<input value={poolName} onChange={e=>setPoolName(e.target.value)} placeholder="Name your pool" maxLength={100}/></label><button type="button" disabled={!selected.length||!poolName.trim()} onClick={()=>{onSavePool(poolName.trim(),results.filter(result=>selected.includes(result.url)));setSaved('Pool saved. Open it in Workshop to create cards when ready.');setSelected([]);}}>Save selected results as pool</button><p>Saving a pool does not create cards or show anything on your overlay.</p><p role="status">{saved}</p></section>}
    <small>Powered by <a href="https://github.com/searxng/searxng" target="_blank" rel="noopener noreferrer">SearXNG</a>.</small>
  </section>;
}
