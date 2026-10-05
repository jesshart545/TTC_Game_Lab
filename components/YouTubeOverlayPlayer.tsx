"use client";
import { useEffect, useRef, useState } from "react";
import { formatYoutubeDuration, youtubePosition } from "../lib/youtube";
import type { YouTubeState } from "../lib/youtube";

type Player = { destroy(): void; playVideo(): void; pauseVideo(): void; stopVideo(): void; mute(): void; unMute(): void; isMuted(): boolean; setVolume(n: number): void; getCurrentTime(): number; getPlayerState(): number; seekTo(n: number, allow: boolean): void; loadVideoById(options: Record<string, unknown>): void; cueVideoById(options: Record<string, unknown>): void };
export type PrivatePlaybackControls = { play(volume:number):void; pause():void };
type PlayerWindow = Window & { YT?: { Player: new (element: HTMLElement, options: Record<string, unknown>) => Player } };
let apiPromise: Promise<void> | null = null;
function loadPlayerApi() {
  if ((window as PlayerWindow).YT?.Player) return Promise.resolve();
  if (!apiPromise) apiPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById("ttc-youtube-api") as HTMLScriptElement | null;
    if (!script) { script = document.createElement("script"); script.id = "ttc-youtube-api"; script.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(script); }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if ((window as PlayerWindow).YT?.Player) { clearInterval(timer); resolve(); }
      else if (Date.now()-started > 20000) { clearInterval(timer); apiPromise = null; reject(new Error("YouTube player did not load.")); }
    }, 100);
  });
  return apiPromise;
}
export default function YouTubeOverlayPlayer({ state, slug, onStatus, monitor = false, interactive = false, onPrivateControls }: { state: YouTubeState | null; slug?: string; monitor?: boolean; interactive?: boolean; onPrivateControls?: (controls:PrivatePlaybackControls|null)=>void; onStatus?: (feedback: {playbackId:string;status:string;position:number;errorCode?:number}) => void }) {
  const root = useRef<HTMLDivElement>(null), player = useRef<Player | null>(null);
  const latest = useRef(state); latest.current = state;
  const privateCallback = useRef(onPrivateControls); privateCallback.current = onPrivateControls;
  const statusCallback = useRef(onStatus); statusCallback.current = onStatus;
  const [ready, setReady] = useState(false), [hidden, setHidden] = useState(false), [error, setError] = useState("");
  const soundMuted = useRef(true), autoplayBlocked = useRef(false), failed = useRef(false);
  const active = Boolean(state && state.action !== "stop" && (state.end === null || state.position < state.end));
  const playbackId = active ? state?.playbackId : undefined;
  const report = (status: string, errorCode?: number) => {
    const current = latest.current;
    if (!current) return;
    const position = Math.max(current.start, player.current?.getCurrentTime() ?? current.position);
    statusCallback.current?.({playbackId:current.playbackId,status,position,errorCode});
    if (!slug) return;
    void fetch("/api/live/" + encodeURIComponent(slug) + "/youtube", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playbackId: current.playbackId, status, position, errorCode }) }).catch(() => {});
  };
  useEffect(() => {
    if (!playbackId || !root.current) { player.current?.destroy(); player.current = null; setReady(false); return; }
    let cancelled = false;
    setReady(false); setHidden(false); setError(""); loadedId.current = ""; failed.current=false; autoplayBlocked.current=false;
    const waitingSince=Date.now();
    const readinessTimer=window.setInterval(()=>{
      if (Date.now()-waitingSince>=20000) {clearInterval(readinessTimer);if (!cancelled) report("stalled");}
    },1000);
    const element = document.createElement("div"); root.current.replaceChildren(element);
    void loadPlayerApi().then(() => {
      if (cancelled || failed.current) return;
      const api = (window as PlayerWindow).YT!;
      player.current = new api.Player(element, {
        width: "100%", height: "100%", videoId: latest.current?.videoId,
        playerVars: { autoplay: 0, mute: latest.current?.startMuted === true ? 1 : 0, start: latest.current?.position ?? 0, ...(latest.current?.end != null ? {end:latest.current.end} : {}), playsinline: 1, controls: monitor || interactive ? 1 : 0, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => { clearInterval(readinessTimer);if (!cancelled && !failed.current) { setReady(true); if (monitor && player.current) {const p=player.current;privateCallback.current?.({play:(volume)=>{p.setVolume(volume);p.unMute();p.playVideo();},pause:()=>p.pauseVideo()});} } },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            if (failed.current) return;
            if (event.data === 1) { autoplayBlocked.current=false; soundMuted.current=player.current?.isMuted() ?? true;  report(soundMuted.current ? "playing-muted" : "playing"); }
            if (event.data === 3) report("buffering");
            if (event.data === 2) report("paused");
            if (event.data === 0) { if (!monitor) setHidden(true); report("ended"); }
          },
          onAutoplayBlocked: () => { if (!cancelled && !failed.current) { autoplayBlocked.current=true; report("blocked"); } },
          onError: (event: {data:number}) => { clearInterval(readinessTimer);if (!cancelled) { failed.current=true; setHidden(!monitor); setError([100,101,150].includes(event.data) ? "YouTube does not allow this video to play here. Choose another video in the host dashboard." : "The YouTube player could not play this video. Check the browser playback settings or choose another video."); report("error",event.data); } },
        },
      });
    }).catch(() => { clearInterval(readinessTimer);if (!cancelled && !failed.current) { failed.current=true; setHidden(!monitor); setError("YouTube player could not load."); report("error"); } });
    return () => { cancelled = true; if(monitor)privateCallback.current?.(null); clearInterval(readinessTimer);player.current?.destroy(); player.current = null; };
  }, [playbackId]);
  const loadedId = useRef("");
  useEffect(() => {
    const p = player.current;
    if (!p || !ready || !state || !active) return;
    setHidden(false);
    p.setVolume(state.volume);
    if (loadedId.current !== state.playbackId) {
      loadedId.current = state.playbackId;
      if (state.startMuted === true) p.mute(); else p.unMute();
      soundMuted.current=p.isMuted(); 
      if (state.action === "pause") p.pauseVideo(); else p.playVideo();
    } else if (state.action === "pause") p.pauseVideo();
    else if (state.action === "resume" || state.action === "play") { p.seekTo(youtubePosition(state), true); p.playVideo(); }
    let lastPosition=p.getCurrentTime(), lastProgress=Date.now(), stalled=false;
    const timer = window.setInterval(() => {
      if (failed.current) { clearInterval(timer); return; }
      if (p.getPlayerState() === 0) { clearInterval(timer); return; }
      const position=p.getCurrentTime(), playerState=p.getPlayerState();
      if (position !== lastPosition || playerState === 2 || state.action === "pause" || autoplayBlocked.current) {lastPosition=position;lastProgress=Date.now();stalled=false;}
      if (Date.now()-lastProgress >= 15000 && state.action !== "pause" && !autoplayBlocked.current && !stalled) { stalled=true; report("stalled"); }
      if (playerState === 1 && soundMuted.current !== p.isMuted()) {soundMuted.current=p.isMuted();report(soundMuted.current ? "playing-muted" : "playing");}
      if (latest.current && (playerState === 1 || playerState === 2)) statusCallback.current?.({playbackId:latest.current.playbackId,status:playerState === 1 ? p.isMuted() ? "playing-muted" : "playing" : "paused",position:Math.max(latest.current.start,position)});
      if (state.end !== null && p.getCurrentTime() >= state.end) { clearInterval(timer); p.stopVideo(); setHidden(true); report("ended"); }
    }, 200);
    return () => clearInterval(timer);
  }, [ready, state?.playbackId, state?.action, state?.at, active]);
  useEffect(()=>{if (ready && player.current && state) {player.current.setVolume(state.volume);if(state.startMuted === true)player.current.mute();else player.current.unMute();}},[ready,state?.volume,state?.startMuted]);
  if (!active || !state) return null;
  return <section aria-label={monitor ? "YouTube dashboard monitor" : "YouTube overlay player"} style={{ position: "absolute", left: state.placement.x+"%", top: state.placement.y+"%", width: state.placement.width+"%", height: state.placement.height+"%",  zIndex: 80, background: "#000", display: hidden ? "none" : "block" }}>
    {state.durationSeconds != null && <span style={{position:"absolute",top:-24,right:0,color:"white",background:"#101827",padding:"2px 6px",fontSize:12}}>Video length: {formatYoutubeDuration(state.durationSeconds)}</span>}
    <div ref={root} style={{ width: "100%", height: "100%" }}/>
    {error && <p role="alert" style={{ position:"absolute",inset:0,padding:24,background:"#101827",color:"white" }}>{error}</p>}
  </section>;
}
