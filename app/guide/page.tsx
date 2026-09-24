"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./guide.css";

const steps = [
  { title: "Welcome to TTCGameLab", label: "START HERE", icon: "✦", narration: "Welcome to TTCGameLab. You can build a TikTok Live experience by describing what you want. This walkthrough shows you how to create a project, add assets, edit controls, and publish your overlay.", hint: "Your idea becomes a project with a host dashboard and an audience overlay.", action: "/project/new", actionLabel: "Create a project" },
  { title: "Describe your idea", label: "STEP 1 · CREATE", icon: "✎", narration: "From the home page, type your idea in everyday language and choose Build with AI. You can also select New Project. Give your project a name, describe the scene and interactions you want, then create it. You can come back to edit it later.", hint: "Try: Create a neon Finish the Lyrics game with a dramatic reveal and a button for the host.", action: "/project/new", actionLabel: "Open creator" },
  { title: "Add your media", label: "STEP 2 · ASSETS", icon: "◈", narration: "In your project, choose Upload to add your own images, video, or audio. Choose Generate asset to describe an image, video, voice, or music you want. Check that each asset appears in the project before you publish. The Asset Library lets you find saved media.", hint: "You can start without uploads, then return to add media when you are ready.", action: "/assets", actionLabel: "Open Asset Library" },
  { title: "Set up the live controls", label: "STEP 3 · EDIT", icon: "▣", narration: "Open your project from My Projects. Use the preview to switch between Audience Overlay and Host Dashboard. Dashboard buttons need an overlay result. Add a composition and assign it to a button, then test the trigger in the preview. A button without an assigned result may only show a placeholder action.", hint: "Test each dashboard button and watch the audience overlay preview before publishing.", action: "/projects", actionLabel: "Open My Projects" },
  { title: "Publish and copy your links", label: "STEP 4 · PUBLISH", icon: "↗", narration: "When your scene and controls look right, choose Publish Experience in the project editor. Open the private Host Dashboard link to operate your stream. Copy the Overlay URL from the published dashboard and add it as a browser source in your TikTok Live broadcasting software. Keep the private dashboard link to yourself.", hint: "Dashboard: host controls. Overlay: the visual scene your audience sees.", action: "/projects", actionLabel: "Go to projects" },
  { title: "Run your show", label: "STEP 5 · LIVE", icon: "●", narration: "Keep the host dashboard open while streaming. Press its buttons to send events to the overlay. If you make changes in the editor, choose Update Published Experience to publish the new version. You can always return to My Projects to reopen an earlier project or begin another one.", hint: "If a button shows only a prompt, return to the editor and assign its overlay result.", action: "/projects", actionLabel: "Open My Projects" },
] as const;

export default function GuidePage() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(16);
  const elapsed = useRef(0);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    setSpeechAvailable("speechSynthesis" in window);
    return () => stop();
  }, [stop]);

  const goTo = (next: number) => {
    stop();
    setPlaying(false);
    setIndex(Math.max(0, Math.min(steps.length - 1, next)));
    elapsed.current = 0;
    setProgress(0);
  };

  const pause = () => {
    elapsed.current = Math.min(duration, elapsed.current + (Date.now() - started.current) / 1000);
    stop();
    setPlaying(false);
  };

  const play = () => {
    if (playing) { pause(); return; }
    const step = steps[index];
    const seconds = Math.max(14, Math.ceil(step.narration.split(/\s+/).length / 2.5) + 3);
    setDuration(seconds);
    if (elapsed.current >= seconds) elapsed.current = 0;
    const currentRun = ++run.current;
    started.current = Date.now();
    setPlaying(true);
    if (!muted && "speechSynthesis" in window) {
      // Restart narration from the beginning of the current chapter after a pause.
      // Captions stay visible throughout and can be read with sound off.
      const utterance = new SpeechSynthesisUtterance(step.narration);
      utterance.rate = 0.95;
      utterance.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
    timer.current = setInterval(() => {
      if (currentRun !== run.current) return;
      const next = Math.min(seconds, elapsed.current + (Date.now() - started.current) / 1000);
      setProgress(next / seconds);
      if (next >= seconds) {
        stop();
        elapsed.current = 0;
        setPlaying(false);
        if (index < steps.length - 1) { setIndex(index + 1); setProgress(0); }
        else setProgress(1);
      }
    }, 100);
  };

  const step = steps[index];
  return <main className="guide-page">
    <header className="guide-header"><Link href="/" className="back">← TTCGameLab Home</Link><span>HOW TO USE TTCGAMELAB</span><Link href="/projects">My Projects →</Link></header>
    <div className="guide-layout">
      <div className="guide-intro"><span>✦ GUIDED TOUR</span><h1>Make your first <em>live experience.</em></h1><p>Follow along at your own pace. Play the narrated walkthrough, pause whenever you need to, or select a chapter below.</p></div>
      <div className="guide-player" aria-label="TTCGameLab narrated walkthrough">
        <div className="guide-stage"><div className="guide-orbit orbit-one"/><div className="guide-orbit orbit-two"/><div className="guide-stage-content" key={index}><small>{step.label}</small><div className="guide-symbol" aria-hidden="true">{step.icon}</div><h2>{step.title}</h2><p>{step.hint}</p></div><div className="guide-counter">{String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</div></div>
        <div className="guide-caption"><strong>ON SCREEN + SPOKEN INSTRUCTIONS</strong><p>{step.narration}</p></div>
        <div className="guide-track" role="progressbar" aria-label="Chapter progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }}/></div>
        <div className="guide-controls"><button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous chapter">⟵</button><button type="button" className="guide-play" onClick={play} aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}>{playing ? "Ⅱ Pause" : "▶ Play"}</button><button type="button" onClick={() => goTo(index + 1)} disabled={index === steps.length - 1} aria-label="Next chapter">⟶</button><span className="guide-spacer"/><button type="button" onClick={() => { if (!muted && "speechSynthesis" in window) window.speechSynthesis.cancel(); setMuted(!muted); }} aria-label={muted ? "Turn narration on" : "Mute narration"} title={muted ? "Turn narration on" : "Mute narration"}>{muted ? "🔇" : "🔊"}</button><span className="guide-time">{index + 1} of {steps.length}</span></div>
        {!speechAvailable && <p className="guide-audio-note">Spoken narration is unavailable in this browser. The full instructions are shown above.</p>}
      </div>
      <nav className="guide-chapters" aria-label="Walkthrough chapters"><h2>Chapters</h2>{steps.map((chapter, i) => <button type="button" key={chapter.title} className={i === index ? "selected" : ""} onClick={() => goTo(i)} aria-current={i === index ? "step" : undefined}><span>{String(i + 1).padStart(2, "0")}</span><strong>{chapter.title}</strong><span>→</span></button>)}<Link href={step.action} className="guide-cta">{step.actionLabel} →</Link></nav>
    </div>
  </main>;
}
