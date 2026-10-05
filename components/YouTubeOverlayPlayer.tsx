"use client";
import { useEffect, useRef, useState } from "react";
import { youtubePosition } from "../lib/youtube";
import type { YouTubeState } from "../lib/youtube";

type Player = { destroy(): void; playVideo(): void; pauseVideo(): void; stopVideo(): void; setVolume(n: number): void; getCurrentTime(): number; getPlayerState(): number; seekTo(n: number, allow: boolean): void; loadVideoById(options: Record<string, unknown>): void; cueVideoById(options: Record<string, unknown>): void };
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
export default function YouTubeOverlayPlayer({ state, slug }: { state: YouTubeState | null; slug?: string }) {
  const root = useRef<HTMLDivElement>(null), player = useRef<Player | null>(null);
  const latest = useRef(state); latest.current = state;
  const [ready, setReady] = useState(false), [hidden, setHidden] = useState(false), [blocked, setBlocked] = useState(false), [error, setError] = useState("");
  const active = Boolean(state && state.action !== "stop" && (state.end === null || youtubePosition(state) < state.end));
  const playbackId = active ? state?.playbackId : undefined;
  const report = (status: string) => {
    const current = latest.current;
    if (!slug || !current) return;
    void fetch("/api/live/" + encodeURIComponent(slug) + "/youtube", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playbackId: current.playbackId, status, position: player.current?.getCurrentTime() }) }).catch(() => {});
  };
  useEffect(() => {
    if (!playbackId || !root.current) { player.current?.destroy(); player.current = null; setReady(false); return; }
    let cancelled = false;
    setReady(false); setHidden(false); setBlocked(false); setError(""); loadedId.current = "";
    const element = document.createElement("div"); root.current.replaceChildren(element);
    void loadPlayerApi().then(() => {
      if (cancelled) return;
      const api = (window as PlayerWindow).YT!;
      player.current = new api.Player(element, {
        width: "100%", height: "100%",
        playerVars: { playsinline: 1, controls: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            if (event.data === 1) { setBlocked(false); report("playing"); }
            if (event.data === 2) report("paused");
            if (event.data === 0) { setHidden(true); report("ended"); }
          },
          onAutoplayBlocked: () => { if (!cancelled) { setBlocked(true); report("blocked"); } },
          onError: () => { if (!cancelled) { setError("This YouTube video cannot play here. Choose another video in the host dashboard."); report("error"); } },
        },
      });
    }).catch(() => { if (!cancelled) { setError("YouTube player could not load."); report("error"); } });
    return () => { cancelled = true; player.current?.destroy(); player.current = null; };
  }, [playbackId]);
  const loadedId = useRef("");
  useEffect(() => {
    const p = player.current;
    if (!p || !ready || !state || !active) return;
    setHidden(false);
    p.setVolume(state.volume);
    const options = { videoId: state.videoId, startSeconds: Date.now()-state.at < 5000 ? state.position : youtubePosition(state), ...(state.end !== null ? { endSeconds: state.end } : {}) };
    if (loadedId.current !== state.playbackId) {
      loadedId.current = state.playbackId;
      if (state.action === "pause") p.cueVideoById(options); else p.loadVideoById(options);
    } else if (state.action === "pause") p.pauseVideo();
    else if (state.action === "resume" || state.action === "play") { p.seekTo(youtubePosition(state), true); p.playVideo(); }
    const timer = window.setInterval(() => {
      if (p.getPlayerState() === 0) { clearInterval(timer); return; }
      if (state.end !== null && p.getCurrentTime() >= state.end) { clearInterval(timer); p.stopVideo(); setHidden(true); report("ended"); }
    }, 200);
    return () => clearInterval(timer);
  }, [ready, state, active]);
  if (!active || !state) return null;
  return <section aria-label="YouTube overlay player" style={{ position: "absolute", left: state.placement.x+"%", top: state.placement.y+"%", width: state.placement.width+"%", height: state.placement.height+"%", minWidth: 200, minHeight: 200, zIndex: 80, background: "#000", display: hidden ? "none" : "block" }}>
    <div ref={root} style={{ width: "100%", height: "100%" }}/>
    {error && <p role="alert" style={{ position:"absolute",inset:0,padding:24,background:"#101827",color:"white" }}>{error}</p>}
    {blocked && !error && <button type="button" onClick={() => { player.current?.playVideo(); }} style={{ position:"absolute",left:"25%",bottom:12,zIndex:81 }}>Enable YouTube playback</button>}
  </section>;
}
