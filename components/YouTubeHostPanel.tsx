"use client";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { clipTime, formatYoutubeDuration, safeYoutubePlacement, youtubeId, youtubePlacement } from "../lib/youtube";
import type { YouTubeState, YouTubeVideo, YouTubePlacement } from "../lib/youtube";
import type { PrivatePlaybackControls } from "./YouTubeOverlayPlayer";
import YouTubeOverlayPlayer from "./YouTubeOverlayPlayer";
import "./youtube.css";
const countryNames = new Intl.DisplayNames(["en"], {type:"region"});
const playbackCountries = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ").map(code=>({code,name:countryNames.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,"en"));

export default function YouTubeHostPanel({ slug, hostKey, placement: initialPlacement, onCommand, previewState, previewFeedback }: {
  slug?: string; hostKey?: string; placement?: YouTubePlacement;
  previewState?: YouTubeState | null; previewFeedback?: {playbackId:string;status:string;errorCode?:number}|null;
  onCommand?: (command: Record<string, unknown>) => Promise<YouTubeState>;
}) {
  const id = useId();
  const privateControls=useRef<PrivatePlaybackControls|null>(null);
  const [privateReady,setPrivateReady]=useState(false), [privateStatus,setPrivateStatus]=useState("");
  const [region,setRegion] = useState("US");
  const rejected = useRef(new Set<string>());
  const [query,setQuery] = useState(""), [link,setLink] = useState(""), [results,setResults] = useState<YouTubeVideo[]>([]);
  const [selected,setSelected] = useState<YouTubeVideo|null>(null), [start,setStart] = useState("0"), [end,setEnd] = useState("");
  const [volume,setVolume] = useState(80), [placement,setPlacement] = useState(safeYoutubePlacement(initialPlacement || youtubePlacement));
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(""), [error,setError] = useState(""), [state,setState] = useState<YouTubeState|null>(null);
  const [feedback,setFeedback] = useState<{playbackId:string;status:string;errorCode?:number}|null>(null), [configured,setConfigured] = useState<boolean|null>(null);
  useEffect(()=>{setPlacement(safeYoutubePlacement(initialPlacement || youtubePlacement));},[initialPlacement?.x,initialPlacement?.y,initialPlacement?.width,initialPlacement?.height]);
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
      const params: Record<string,string> = fromLink ? {video:value,region} : {q:value,region};
      const response = await fetch(endpoint+"?"+new URLSearchParams(params), { headers,cache:"no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "YouTube request failed.");
      if (fromLink) { if(rejected.current.has(data.video.id)) throw new Error("YouTube rejected this video during playback. Choose another video."); setSelected(data.video); setMessage("Video selected privately. Press Play on overlay when ready."); }
      else { const videos=(data.videos || []).filter((video:YouTubeVideo)=>!rejected.current.has(video.id)); setResults(videos); setMessage(videos.length ? "Choose a video. Nothing will appear on the overlay yet." : "No playable videos found. Try another search."); }
    } catch(e) { setError(e instanceof Error ? e.message : "YouTube request failed."); }
    finally { setBusy(false); }
  }
  async function command(action: "play"|"pause"|"resume"|"stop") {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const begin = clipTime(start), finish = end.trim() ? clipTime(end) : null;
      if (action === "play" && (!selected || begin === null || end.trim() && finish === null || finish !== null && begin !== null && finish <= begin)) throw new Error("Choose a video and a valid start/end range.");
      if (action === "play" && selected?.durationSeconds && (begin! >= selected.durationSeconds || finish !== null && finish > selected.durationSeconds + 1)) throw new Error("Choose clip times within the video's length ("+formatYoutubeDuration(selected.durationSeconds)+").");
      const body = { action, ...(action === "play" ? { videoId:selected!.id,region,startMuted:false,start:begin,end:finish,volume,placement } : {}) };
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
  const currentState = onCommand ? previewState ?? state : state;
  const currentFeedback = onCommand ? previewFeedback : feedback;
  useEffect(()=>{
    if (!currentState || !currentFeedback || currentFeedback.playbackId !== currentState.playbackId || ![100,101,150].includes(currentFeedback.errorCode || 0)) return;
    const videoId=currentState.videoId;
    rejected.current.add(videoId);
    setResults(previous=>previous.filter(video=>video.id!==videoId));
    setSelected(previous=>previous?.id===videoId ? null : previous);
  },[currentState?.playbackId,currentState?.videoId,currentFeedback?.playbackId,currentFeedback?.errorCode]);
  const active = currentState && currentState.action !== "stop" && !["error","timeout","ended"].includes(currentFeedback?.playbackId===currentState.playbackId ? currentFeedback.status : "");
  const playerStatus = currentFeedback && currentState && currentFeedback.playbackId === currentState.playbackId ? currentFeedback.status : "";
  const statusText: Record<string,string> = {loading:"YouTube is loading the video…",stalled:"YouTube has not made playback progress. The player remains available; retry or choose another video when ready.",buffering:"YouTube is buffering the video…",timeout:"The video did not start or stopped buffering. It has been hidden; retry or choose another video.","playing-muted":"The browser source reports muted playback. Press Play on overlay again to restart with the selected volume.",playing:"Playing on the overlay.",paused:"Paused on the overlay.",ended:"The clip has finished.",blocked:"The streaming browser source blocked playback. Audio is enabled by the site. Check the browser source playback permission, then retry from this dashboard.",error:"This video cannot play on the overlay. Choose another video."};
  // The private player never consumes broadcast state or sends overlay commands.
  const monitorState = useMemo<YouTubeState|null>(()=>{
    if (!selected) return null;
    return {action:"pause",videoId:selected.id,title:selected.title,start:0,end:null,position:0,at:0,volume,startMuted:false,durationSeconds:selected.durationSeconds,placement:{x:0,y:0,width:100,height:100},playbackId:"dashboard-selected-"+selected.id};
  },[selected?.id,selected?.durationSeconds,volume]);
  return <section className="youtube-host-panel" aria-label="YouTube host controls">
    <h3>YouTube · Live clips</h3><p>Search and selection stay on this dashboard. The audience sees a video only after you press Play on overlay.</p>
    {configured === false && <p role="status">YouTube search needs the site's Google API connection. Checking and playing a YouTube link is available.</p>}
    <label htmlFor={id+"-country"}>Playback country<select id={id+"-country"} value={region} onChange={e=>{setRegion(e.target.value);setResults([]);setSelected(null);rejected.current.clear();setMessage("Search again to check videos for this country.");}}>{playbackCountries.map(country=><option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
    <form onSubmit={e=>void lookup(e)} className="youtube-search"><label htmlFor={id+"-search"}>Search YouTube</label><div><input id={id+"-search"} value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Song, artist, video or topic"/><button disabled={busy || !query.trim() || configured === false}>Search</button></div></form>
    <form onSubmit={e=>void lookup(e,true)} className="youtube-search"><label htmlFor={id+"-link"}>Or paste a YouTube link</label><div><input id={id+"-link"} value={link} onChange={e=>setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/><button disabled={busy || !link.trim()}>Check link</button></div></form>
    <div className="youtube-results">{results.map(item=><button key={item.id} type="button" aria-pressed={selected?.id===item.id} disabled={busy} onClick={()=>{setSelected(item);setError("");setMessage("Video selected privately. Press Play on overlay when ready.");}}>{item.thumbnail&&<img src={item.thumbnail} alt=""/>}<span><strong>{item.title}</strong><small>{item.channel} · {item.live ? "Live" : formatYoutubeDuration(item.durationSeconds)}</small></span></button>)}</div>
    {selected && <p><strong>Selected privately:</strong> {selected.title} · {selected.live ? "Live" : formatYoutubeDuration(selected.durationSeconds)}</p>}
    <div className="youtube-clip-settings"><label>Start (seconds or m:ss)<input value={start} onChange={e=>setStart(e.target.value)}/></label><label>End (optional)<input value={end} onChange={e=>setEnd(e.target.value)} placeholder="Leave blank to play to the end"/></label><label>Volume<input type="range" min={0} max={100} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>{volume}%</label></div>
    <details><summary>Overlay screen size & position</summary><div className="youtube-clip-settings">{(["x","y","width","height"] as const).map(key=><label key={key}>{key === "x" ? "Left %" : key === "y" ? "Top %" : key === "width" ? "Width %" : "Height %"}<input type="number" min={key==="width" || key==="height" ? 20 : 0} max={100} value={placement[key]} onChange={e=>setPlacement(safeYoutubePlacement({...placement,[key]:Number(e.target.value)}))}/></label>)}</div><small>Position and volume apply when you press Play on overlay.</small></details>
    {monitorState && <div className="youtube-dashboard-monitor"><YouTubeOverlayPlayer state={monitorState} monitor onPrivateControls={controls=>{privateControls.current=controls;setPrivateReady(Boolean(controls));}} onStatus={feedback=>setPrivateStatus(feedback.status)}/><span className="youtube-monitor-label">Private player · play and hear this video here. Only Play on overlay sends it to the audience.</span></div>}
    {selected && <div className="youtube-player-controls" aria-label="Private playback controls"><button type="button" disabled={!privateReady} onClick={()=>privateControls.current?.play(volume)}>Play privately with sound</button><button type="button" disabled={!privateReady} onClick={()=>privateControls.current?.pause()}>Pause private player</button><span role="status">{privateStatus === "playing" ? "Private player is playing with sound enabled." : privateStatus === "playing-muted" ? "Private player is muted. Press Play privately with sound." : privateStatus === "buffering" ? "Private video is buffering." : privateStatus === "blocked" ? "Private playback was blocked. Click the video's own Play button." : privateStatus === "error" ? "YouTube could not play the private video." : "Private playback does not change the overlay."}</span></div>}
    <div className="youtube-player-controls"><button type="button" disabled={busy || !selected || (!hostKey && !onCommand)} onClick={()=>void command("play")}>Play on overlay</button><button type="button" disabled={busy || !active} onClick={()=>void command("pause")}>Pause</button><button type="button" disabled={busy || !active} onClick={()=>void command("resume")}>Resume</button><button type="button" disabled={busy || !active} onClick={()=>void command("stop")}>Stop & hide</button></div>
    {busy && <p role="status">Working…</p>}{error && <p role="alert">{error}</p>}{!error && <p role="status">{statusText[playerStatus] || message}</p>}
  </section>;
}
