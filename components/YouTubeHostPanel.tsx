"use client";
import { FormEvent, useEffect, useId, useState } from "react";
import { clipTime, safeYoutubePlacement, youtubeId, youtubePlacement } from "../lib/youtube";
import type { YouTubeState, YouTubeVideo, YouTubePlacement } from "../lib/youtube";
import "./youtube.css";

export default function YouTubeHostPanel({ slug, hostKey, placement: initialPlacement, onCommand }: {
  slug?: string; hostKey?: string; placement?: YouTubePlacement;
  onCommand?: (command: Record<string, unknown>) => Promise<YouTubeState>;
}) {
  const id = useId();
  const [query,setQuery] = useState(""), [link,setLink] = useState(""), [results,setResults] = useState<YouTubeVideo[]>([]);
  const [selected,setSelected] = useState<YouTubeVideo|null>(null), [start,setStart] = useState("0"), [end,setEnd] = useState("");
  const [volume,setVolume] = useState(80), [placement,setPlacement] = useState(safeYoutubePlacement(initialPlacement || youtubePlacement));
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [error,setError] = useState(""), [state,setState] = useState<YouTubeState|null>(null);
  const [feedback,setFeedback] = useState<{playbackId:string;status:string}|null>(null), [configured,setConfigured] = useState<boolean|null>(null);
  const endpoint = slug ? "/api/live/"+encodeURIComponent(slug)+"/youtube" : "/api/youtube";
  const headers: Record<string,string> = hostKey ? { "x-host-key":hostKey } : {};
  useEffect(() => {
    if (!slug || !hostKey) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(endpoint+"?mode=status", { headers: {"x-host-key":hostKey!}, cache:"no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to check the overlay player.");
        if (!cancelled) { setState(data.state); setFeedback(data.feedback); setConfigured(data.searchConfigured); }
      } catch(e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to check the overlay player."); }
      finally { if (!cancelled) timer=setTimeout(poll,1500); }
    }
    void poll(); return () => { cancelled=true; clearTimeout(timer); };
  }, [slug,hostKey,endpoint]);
  async function lookup(e: FormEvent, fromLink = false) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const value = fromLink ? youtubeId(link) : query.trim();
      if (!value) throw new Error(fromLink ? "Enter a valid YouTube link." : "Enter something to search for.");
      const params: Record<string,string> = fromLink ? {video:value} : {q:value};
      const response = await fetch(endpoint+"?"+new URLSearchParams(params), { headers,cache:"no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "YouTube request failed.");
      if (fromLink) { setSelected(data.video); setMessage("Video selected privately. Press Play on overlay when ready."); }
      else { setResults(data.videos || []); setMessage(data.videos?.length ? "Choose a video. Nothing will appear on the overlay yet." : "No playable videos found. Try another search."); }
    } catch(e) { setError(e instanceof Error ? e.message : "YouTube request failed."); }
    finally { setBusy(false); }
  }
  async function command(action: "play"|"pause"|"resume"|"stop") {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const begin = clipTime(start), finish = end.trim() ? clipTime(end) : null;
      if (action === "play" && (!selected || begin === null || end.trim() && finish === null || finish !== null && begin !== null && finish <= begin)) throw new Error("Choose a video and a valid start/end range.");
      const body = { action, ...(action === "play" ? { videoId:selected!.id,start:begin,end:finish,volume,placement } : {}) };
      let next: YouTubeState;
      if (onCommand) next = await onCommand(body);
      else {
        const response = await fetch("/api/live/"+encodeURIComponent(slug!), { method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify({youtube:body}) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not send the player command.");
        next = data.state;
      }
      setState(next); setFeedback(null);
      setMessage(action === "stop" ? "YouTube stopped and hidden on the overlay." : action === "play" ? "Play sent to the overlay. Waiting for the player…" : action === "pause" ? "Pause sent to the overlay." : "Resume sent to the overlay.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not send the player command."); }
    finally { setBusy(false); }
  }
  const active = state && state.action !== "stop";
  const playerStatus = feedback && state && feedback.playbackId === state.playbackId && active ? feedback.status : "";
  const statusText: Record<string,string> = {playing:"Playing on the overlay.",paused:"Paused on the overlay.",ended:"The clip has finished.",blocked:"The overlay browser blocked playback. Enable playback in the browser source, then press Resume.",error:"This video cannot play on the overlay. Choose another video."};
  return <section className="youtube-host-panel" aria-label="YouTube host controls">
    <h3>YouTube · Live clips</h3><p>Search and selection stay on this dashboard. The audience sees a video only after you press Play on overlay.</p>
    {configured === false && <p role="status">YouTube search needs the site's Google API connection. Checking and playing a YouTube link is available.</p>}
    <form onSubmit={e=>void lookup(e)} className="youtube-search"><label htmlFor={id+"-search"}>Search YouTube</label><div><input id={id+"-search"} value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Song, artist, video or topic"/><button disabled={busy || !query.trim() || configured === false}>Search</button></div></form>
    <form onSubmit={e=>void lookup(e,true)} className="youtube-search"><label htmlFor={id+"-link"}>Or paste a YouTube link</label><div><input id={id+"-link"} value={link} onChange={e=>setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/><button disabled={busy || !link.trim()}>Check link</button></div></form>
    <div className="youtube-results">{results.map(item=><button key={item.id} type="button" aria-pressed={selected?.id===item.id} disabled={busy} onClick={()=>{setSelected(item);setError("");setMessage("Video selected privately. Press Play on overlay when ready.");}}>{item.thumbnail&&<img src={item.thumbnail} alt=""/>}<span><strong>{item.title}</strong><small>{item.channel}</small></span></button>)}</div>
    {selected && <p><strong>Selected privately:</strong> {selected.title}</p>}
    <div className="youtube-clip-settings"><label>Start (seconds or m:ss)<input value={start} onChange={e=>setStart(e.target.value)}/></label><label>End (optional)<input value={end} onChange={e=>setEnd(e.target.value)} placeholder="Leave blank to play to the end"/></label><label>Volume<input type="range" min={0} max={100} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>{volume}%</label></div>
    <details><summary>Overlay screen size & position</summary><div className="youtube-clip-settings">{(["x","y","width","height"] as const).map(key=><label key={key}>{key === "x" ? "Left %" : key === "y" ? "Top %" : key === "width" ? "Width %" : "Height %"}<input type="number" min={key==="width" || key==="height" ? 20 : 0} max={100} value={placement[key]} onChange={e=>setPlacement(safeYoutubePlacement({...placement,[key]:Number(e.target.value)}))}/></label>)}</div><small>Position and volume apply when you press Play on overlay.</small></details>
    <div className="youtube-player-controls"><button type="button" disabled={busy || !selected || (!hostKey && !onCommand)} onClick={()=>void command("play")}>Play on overlay</button><button type="button" disabled={busy || !active} onClick={()=>void command("pause")}>Pause</button><button type="button" disabled={busy || !active} onClick={()=>void command("resume")}>Resume</button><button type="button" disabled={busy || !active} onClick={()=>void command("stop")}>Stop & hide</button></div>
    {busy && <p role="status">Working…</p>}{error && <p role="alert">{error}</p>}{!error && <p role="status">{statusText[playerStatus] || message}</p>}
  </section>;
}
