"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../../lib/project";
import "./guide.css";
import { demoChapters } from "./demo";

type Chapter = { title: string; area: string; route: string; location: string; map: [string, string, string]; focus: number; actions: string[]; outcome: string; narration: string; link: string; linkLabel: string };

const chapters: Chapter[] = [
{"title": "Start or reopen a project", "area": "HOME", "route": "/", "location": "Home and My Projects", "map": ["Describe your game idea, then start a project.", "Use My Projects to reopen saved work.", "Use Help & contact whenever you need assistance."], "focus": 0, "actions": ["Describe your game idea, then start a project.", "Use My Projects to reopen saved work.", "Use Help & contact whenever you need assistance."], "outcome": "Your idea is kept in the new draft. You decide what to create next.", "narration": "Describe your game idea, then start a project. Use My Projects to reopen saved work. Use Help & contact whenever you need assistance. Your idea is kept in the new draft. You decide what to create next.", "link": "/", "linkLabel": "Open this screen"},
{"title": "Plan the game", "area": "GAME PLAN", "route": "/project/[id]", "location": "Project · Game Plan", "map": ["Name the game and describe what players will do.", "Choose the game features you need.", "Continue to Workshop when your plan is ready."], "focus": 0, "actions": ["Name the game and describe what players will do.", "Choose the game features you need.", "Continue to Workshop when your plan is ready."], "outcome": "The plan guides creation without forcing a particular trivia board format.", "narration": "Name the game and describe what players will do. Choose the game features you need. Continue to Workshop when your plan is ready. The plan guides creation without forcing a particular trivia board format.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Create your assets", "area": "WORKSHOP", "route": "/project/[id]", "location": "Project · Workshop", "map": ["Choose Generate Media, upload a file, or create a game tool.", "For trivia, choose the number of questions and topics.", "Review generated content before using it."], "focus": 0, "actions": ["Choose Generate Media, upload a file, or create a game tool.", "For trivia, choose the number of questions and topics.", "Review generated content before using it."], "outcome": "Assets and tools are saved in your project. Generation uses the options you choose.", "narration": "Choose Generate Media, upload a file, or create a game tool. For trivia, choose the number of questions and topics. Review generated content before using it. Assets and tools are saved in your project. Generation uses the options you choose.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Organize assets into pools", "area": "ASSET POOLS", "route": "/project/[id]", "location": "Workshop · asset thumbnails", "map": ["Click an asset thumbnail to choose what to do with it.", "Assign related assets to a named pool.", "Keep the main background separate from images drawn during play."], "focus": 0, "actions": ["Click an asset thumbnail to choose what to do with it.", "Assign related assets to a named pool.", "Keep the main background separate from images drawn during play."], "outcome": "Pools organize your assets. An image picker draws from the pool you connect.", "narration": "Click an asset thumbnail to choose what to do with it. Assign related assets to a named pool. Keep the main background separate from images drawn during play. Pools organize your assets. An image picker draws from the pool you connect.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Design cards simply", "area": "CARD DESIGN", "route": "/project/[id]", "location": "Workshop · card editor", "map": ["Create a question and answer card or a blank card.", "Choose a template, then adjust text, colors and optional background image.", "Connect question cards to a question pool."], "focus": 0, "actions": ["Create a question and answer card or a blank card.", "Choose a template, then adjust text, colors and optional background image.", "Connect question cards to a question pool."], "outcome": "Cards use manual host controls. They do not automatically start timers.", "narration": "Create a question and answer card or a blank card. Choose a template, then adjust text, colors and optional background image. Connect question cards to a question pool. Cards use manual host controls. They do not automatically start timers.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Ask Build Space AI for help", "area": "BUILD SPACE AI", "route": "/project/[id]", "location": "Project · Build Space chat", "map": ["Describe the change in everyday language: connect this image pool to one random draw button.", "Review the changed draft and test it.", "Use Undo AI change if you prefer the previous draft."], "focus": 0, "actions": ["Describe the change in everyday language: connect this image pool to one random draw button.", "Review the changed draft and test it.", "Use Undo AI change if you prefer the previous draft."], "outcome": "AI can configure draft layout, tools and dashboard connections. Publishing remains your choice.", "narration": "Describe the change in everyday language: connect this image pool to one random draw button. Review the changed draft and test it. Use Undo AI change if you prefer the previous draft. AI can configure draft layout, tools and dashboard connections. Publishing remains your choice.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Choose and customize controls", "area": "BUILD SPACE", "route": "/project/[id]", "location": "Build Space · Background, Add items, Customize", "map": ["Choose the main background for the 1920 × 1080 overlay.", "Add the items the host needs and select an item to customize.", "Use simple size, position, color and font settings."], "focus": 0, "actions": ["Choose the main background for the 1920 × 1080 overlay.", "Add the items the host needs and select an item to customize.", "Use simple size, position, color and font settings."], "outcome": "The host dashboard controls the audience overlay. Search and setup stay on the host side.", "narration": "Choose the main background for the 1920 × 1080 overlay. Add the items the host needs and select an item to customize. Use simple size, position, color and font settings. The host dashboard controls the audience overlay. Search and setup stay on the host side.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Draw random images and cards", "area": "RANDOM POOLS", "route": "/project/[id]", "location": "Build Space · Random Picker", "map": ["Choose Images or Cards, then connect a saved pool or card list.", "Press Draw random image or card to show one unused item.", "Press the same button to remove it. Draw again when you need another."], "focus": 0, "actions": ["Choose Images or Cards, then connect a saved pool or card list.", "Press Draw random image or card to show one unused item.", "Press the same button to remove it. Draw again when you need another."], "outcome": "Items do not repeat during the game, even after a reload. Start a new game explicitly resets the used history.", "narration": "Choose Images or Cards, then connect a saved pool or card list. Press Draw random image or card to show one unused item. Press the same button to remove it. Draw again when you need another. Items do not repeat during the game, even after a reload. Start a new game explicitly resets the used history.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Set up scores, prizes and gifts", "area": "GAME TOOLS", "route": "/project/[id]", "location": "Workshop or Build Space · game tools", "map": ["Add a Scoreboard and enter players or teams with their starting scores.", "Add a Prize List and enter prizes; optionally choose pictures.", "Add a TikTok Gift Guide and describe what each gift does in your game."], "focus": 0, "actions": ["Add a Scoreboard and enter players or teams with their starting scores.", "Add a Prize List and enter prizes; optionally choose pictures.", "Add a TikTok Gift Guide and describe what each gift does in your game."], "outcome": "The host adjusts scores and records prize winners. The gift guide explains your rules to viewers.", "narration": "Add a Scoreboard and enter players or teams with their starting scores. Add a Prize List and enter prizes; optionally choose pictures. Add a TikTok Gift Guide and describe what each gift does in your game. The host adjusts scores and records prize winners. The gift guide explains your rules to viewers.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Use videos and YouTube", "area": "MEDIA CONTROLS", "route": "/project/[id]", "location": "Build Space · media and YouTube tool", "map": ["Connect a video to a Play control and review its audio setting.", "For YouTube, search privately on the dashboard and choose a clip.", "Send playback to the overlay when ready, then stop it when finished."], "focus": 0, "actions": ["Connect a video to a Play control and review its audio setting.", "For YouTube, search privately on the dashboard and choose a clip.", "Send playback to the overlay when ready, then stop it when finished."], "outcome": "Viewers see playback. Dashboard searches stay private. YouTube may restrict individual videos.", "narration": "Connect a video to a Play control and review its audio setting. For YouTube, search privately on the dashboard and choose a clip. Send playback to the overlay when ready, then stop it when finished. Viewers see playback. Dashboard searches stay private. YouTube may restrict individual videos.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Rehearse before publishing", "area": "TEST", "route": "/project/[id]", "location": "Build Space · Test", "map": ["Use the dashboard buttons while watching the paired audience preview.", "Check image removal, answer reveal, media sound and tool placement.", "Resolve any setup messages before publishing."], "focus": 0, "actions": ["Use the dashboard buttons while watching the paired audience preview.", "Check image removal, answer reveal, media sound and tool placement.", "Resolve any setup messages before publishing."], "outcome": "Rehearsal lets you check the saved connections before taking them live.", "narration": "Use the dashboard buttons while watching the paired audience preview. Check image removal, answer reveal, media sound and tool placement. Resolve any setup messages before publishing. Rehearsal lets you check the saved connections before taking them live.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Publish and stream", "area": "PUBLISH", "route": "/project/[id]", "location": "Build Space · Publish", "map": ["Publish the tested draft and open the host dashboard.", "Copy the audience overlay URL into a TikTok Live Studio browser source.", "Set the browser source to 1920 × 1080 and test a host control."], "focus": 0, "actions": ["Publish the tested draft and open the host dashboard.", "Copy the audience overlay URL into a TikTok Live Studio browser source.", "Set the browser source to 1920 × 1080 and test a host control."], "outcome": "Publishing saves the live version. Later draft edits go live only when you publish the update.", "narration": "Publish the tested draft and open the host dashboard. Copy the audience overlay URL into a TikTok Live Studio browser source. Set the browser source to 1920 × 1080 and test a host control. Publishing saves the live version. Later draft edits go live only when you publish the update.", "link": "/projects", "linkLabel": "Open this screen"},
{"title": "Get help and send feedback", "area": "HELP", "route": "/help", "location": "Help & contact on each creator page", "map": ["Open Help & contact and choose the topic.", "Describe the issue or recommendation and submit it.", "Return here to see the status of your message."], "focus": 0, "actions": ["Open Help & contact and choose the topic.", "Describe the issue or recommendation and submit it.", "Return here to see the status of your message."], "outcome": "Your message is saved for the site administrator. Private dashboard keys are excluded from page details.", "narration": "Open Help & contact and choose the topic. Describe the issue or recommendation and submit it. Return here to see the status of your message. Your message is saved for the site administrator. Private dashboard keys are excluded from page details.", "link": "/help", "linkLabel": "Open this screen"}
];

export default function GuidePage() {
  const [mode, setMode] = useState<"demo" | "site">("site");
  const [demoIndex, setDemoIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [progress, setProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [publishedPath, setPublishedPath] = useState<string | null>(null);
  const [frameScale, setFrameScale] = useState(0.6);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const elapsed = useRef(0);
  const duration = useRef(1);
  const current = useRef(0);
  const active = useRef(false);
  const paused = useRef(false);
  const mutedRef = useRef(false);
  const indexRef = useRef(0);

  const stop = useCallback(() => {
    active.current = false;
    paused.current = false;
    current.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  useEffect(() => {
    setSpeechAvailable("speechSynthesis" in window);
    let cancelled = false;
    void fetch("/api/projects", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      const projects: Project[] = Array.isArray(data.projects) ? data.projects.map((row: any) => row.data as Project).filter(Boolean) : [];
      if (cancelled) return;
      const editable = projects[0];
      if (editable) setProjectPath(`/project/${editable.id}`);
      const published = projects.find(p => p.publishedSnapshot || p.status === "Published");
      if (published) setPublishedPath(`/published/${published.slug}`);
    }).catch(() => {});
    return () => { cancelled = true; stop(); };
  }, [stop]);
  useEffect(() => {
    if (!screenRef.current) return;
    const observer = new ResizeObserver(entries => setFrameScale(Math.max(0.2, Math.min(1, (entries[0].contentRect.width - 48) / 1200))));
    observer.observe(screenRef.current);
    return () => observer.disconnect();
  }, []);
  const goTo = (next: number) => { stop(); setPlaying(false); indexRef.current = Math.max(0, Math.min(chapters.length - 1, next)); setIndex(indexRef.current); elapsed.current = 0; setProgress(0); };
  const finish = (token: number) => {
    if (token !== current.current || !active.current) return;
    stop(); setPlaying(false); elapsed.current = 0;
    if (indexRef.current < chapters.length - 1) { indexRef.current++; setIndex(indexRef.current); setProgress(0); }
    else setProgress(1);
  };
  const play = () => {
    if (playing) {
      elapsed.current = Math.min(duration.current, elapsed.current + (Date.now() - started.current) / 1000);
      active.current = false;
      paused.current = true;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      if ("speechSynthesis" in window) window.speechSynthesis.pause();
      setPlaying(false); return;
    }
    if (elapsed.current >= duration.current) elapsed.current = 0;
    const resuming = paused.current;
    paused.current = false;
    const token = resuming ? current.current : ++current.current;
    const text = chapters[indexRef.current].narration;
    duration.current = Math.max(12, Math.ceil(text.split(/\s+/).length / 2.4));
    active.current = true;
    started.current = Date.now(); setPlaying(true);
    if (!mutedRef.current && "speechSynthesis" in window) {
      if (resuming) window.speechSynthesis.resume();
      else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US"; utterance.rate = 0.95;
        utterance.onend = () => finish(token);
        window.speechSynthesis.speak(utterance);
      }
    }
    timer.current = setInterval(() => {
      if (token !== current.current || !active.current) return;
      const next = Math.min(duration.current, elapsed.current + (Date.now() - started.current) / 1000);
      const spoken = !mutedRef.current && speechAvailable;
      setProgress(spoken ? Math.min(0.98, next / duration.current) : next / duration.current);
      if (next >= duration.current && !spoken) finish(token);
      if (spoken && elapsed.current + (Date.now() - started.current) / 1000 > duration.current * 2) finish(token);
    }, 100);
  };
  const toggleSound = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    mutedRef.current = !mutedRef.current; setMuted(mutedRef.current);
    if (playing || paused.current) goTo(indexRef.current);
  };
  const chapter = chapters[index];
  const screenPath = chapter.route.startsWith("/project/[id]") ? projectPath : chapter.route.startsWith("Published dashboard") ? publishedPath : chapter.route.startsWith("/project/new or") ? "/project/new" : chapter.route.startsWith("/project/[id] or") ? projectPath : chapter.route;
  const pageLink = chapter.route.startsWith("/project/[id]") ? projectPath : chapter.route.startsWith("Published dashboard") ? publishedPath : chapter.link;
  const highlight = [".sidebar", ".game-plan", ".workshop-tools", ".workshop-assets-toolbar", ".card-editor", ".build-space-chat", ".build-space", ".build-space", ".build-space", ".build-space", ".paired-canvases", ".workshop-publish-links", ".help-page"][index];
  const showControl = (frame: HTMLIFrameElement) => {
    // Orientation only: never click or change the embedded project.
    const doc = frame.contentDocument;
    if (!doc) return;
    const target = (doc.querySelector(highlight) || doc.querySelector("main")) as HTMLElement | null;
    if (target) { target.style.outline = "4px solid #20e8ff"; target.style.outlineOffset = "4px"; target.scrollIntoView({block:"center"}); }
  };
  const filtered = chapters.map((item, i) => ({ item, i })).filter(({ item }) => (item.title + item.area + item.location + item.actions.join(" ")).toLowerCase().includes(search.toLowerCase()));
  if (mode === "demo") {
    const demo = demoChapters[demoIndex];
    return <main className="guide-page"><header className="guide-header"><Link href="/" className="back">← TTCGameLab Home</Link><Link href="/reference" className="guide-mode-link">Interactive verification project →</Link><span>LEARN BEFORE YOU SIGN UP</span><button className="guide-mode-link" onClick={() => setMode("site")}>Current site reference →</button></header><div className="guide-layout"><div className="guide-intro"><span>✦ NO ACCOUNT REQUIRED</span><h1>Learn TTCGameLab <em>before you build.</em></h1><p>This fictional walkthrough demonstrates the complete creator journey without touching a real account or project. Use it before joining the private alpha, then return whenever you need a refresher.</p><div className="guide-demo-notice">DEMO MODE · Fictional creator and project · No real data is changed</div></div><div className="guide-player"><div className="guide-stage"><div className="guide-stage-head"><span>DEMO CREATOR · NOVA</span><span>{demo.area}</span></div><div className="guide-stage-title"><small>CHAPTER {String(demoIndex + 1).padStart(2, "0")}</small><h2>{demo.title}</h2><p>{demo.narration}</p></div><div className="guide-screen-map">{demo.steps.map((step, i) => <div key={step} className={i === 1 ? "focused" : ""}><span>{i + 1}</span><p>{step}</p></div>)}</div><div className="guide-counter">{String(demoIndex + 1).padStart(2, "0")} / {String(demoChapters.length).padStart(2, "0")}</div></div><div className="guide-caption"><strong>DEMO NARRATION</strong><p>{demo.narration}</p></div><div className="guide-controls"><button onClick={() => setDemoIndex(Math.max(0,demoIndex-1))} disabled={demoIndex===0}>⟵</button><button className="guide-play" onClick={() => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(demo.narration); u.lang="en-US"; u.rate=.95; window.speechSynthesis.speak(u); }}}>▶ Play narration</button><button onClick={() => setDemoIndex(Math.min(demoChapters.length-1,demoIndex+1))} disabled={demoIndex===demoChapters.length-1}>⟶</button><span className="guide-spacer"/><span className="guide-time">{demoIndex+1} of {demoChapters.length}</span></div><section className="guide-instructions"><h3>What this demonstrates</h3><ol>{demo.steps.map(step => <li key={step}>{step}</li>)}</ol><div className="guide-outcome"><b>EXPECTED RESULT</b><p>{demo.result}</p></div>{demoIndex===demoChapters.length-1 && <Link href="/project/new" className="guide-cta">Start building →</Link>}</section></div><nav className="guide-chapters"><h2>Demo walkthrough</h2>{demoChapters.map((item,i)=><button key={item.title} className={i===demoIndex?"selected":""} onClick={()=>setDemoIndex(i)}><span>{String(i+1).padStart(2,"0")}</span><strong>{item.title}</strong><span>→</span></button>)}</nav></div></main>;
  }
  return <main className="guide-page">
    <header className="guide-header"><Link href="/" className="back">← TTCGameLab Home</Link><Link href="/reference" className="guide-mode-link">Interactive verification project →</Link><span>HOW TO USE TTCGAMELAB</span><Link href="/projects">My Projects →</Link></header>
    <div className="guide-layout">
      <div className="guide-intro"><span>✦ COMPLETE SITE WALKTHROUGH</span><h1>See where everything is <em>and how it works.</em></h1><p>{chapters.length} narrated chapters cover the actual screens, from the home page through asset editing, game tools, publishing and your live host dashboard. Pause, replay or choose exactly the feature you need.</p></div>
      <div className="guide-player" ref={screenRef} aria-label="TTCGameLab narrated walkthrough">
        <div className="guide-stage" key={index}><div className="guide-stage-head"><span>TTCGAMELAB · {chapter.area}</span><span>{chapter.route}</span></div><div className="guide-stage-title"><small>CHAPTER {String(index + 1).padStart(2, "0")}</small><h2>{chapter.title}</h2><p>{chapter.location}</p></div><div className="guide-screen-label"><strong>ACTUAL SITE SCREEN</strong><span>The cyan outline points to the location described in this chapter.</span></div>{screenPath && screenPath.startsWith("/") ? <div className="guide-real-screen" style={{height:760*frameScale}}><iframe key={screenPath+index} src={screenPath} title={`Site view: ${chapter.title}`} onLoad={event => showControl(event.currentTarget)} style={{transform:`scale(${frameScale})`}} tabIndex={-1}/></div> : <div className="guide-screen-unavailable">Open or publish a project to show this screen with your own content.</div>}<div className="guide-screen-map">{chapter.map.map((label, i) => <div key={i} className={chapter.focus === i ? "focused" : ""}><span>{i + 1}</span><p>{label}</p></div>)}</div><div className="guide-counter">{String(index + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</div></div>
        <div className="guide-caption"><strong>VOICE + CAPTIONS</strong><p>{chapter.narration}</p></div>
        <div className="guide-track" role="progressbar" aria-label="Chapter progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }}/></div>
        <div className="guide-controls"><button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous chapter">⟵</button><button type="button" className="guide-play" onClick={play} aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}>{playing ? "Ⅱ Pause" : "▶ Play"}</button><button type="button" onClick={() => goTo(index + 1)} disabled={index === chapters.length - 1} aria-label="Next chapter">⟶</button><span className="guide-spacer"/><button type="button" onClick={toggleSound} aria-label={muted ? "Turn narration on" : "Mute narration"}>{muted ? "🔇" : "🔊"}</button><span className="guide-time">{index + 1} of {chapters.length}</span></div>
        {!speechAvailable && <p className="guide-audio-note">Spoken narration is unavailable in this browser. All instructions remain visible below.</p>}
        <section className="guide-instructions"><div className="guide-location"><span>WHERE TO FIND IT</span><strong>{chapter.location}</strong><code>{chapter.route}</code></div><h3>Do this</h3><ol>{chapter.actions.map(action => <li key={action}>{action}</li>)}</ol><div className="guide-outcome"><b>What happens</b><p>{chapter.outcome}</p></div><Link href={pageLink || chapter.link} className="guide-cta">Open this screen →</Link></section>
      </div>
      <nav className="guide-chapters" aria-label="Walkthrough chapters"><h2>All {chapters.length} chapters</h2><label htmlFor="guide-search">Find a feature</label><input id="guide-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search features…"/>{filtered.map(({ item, i }) => <button type="button" key={item.title} className={i === index ? "selected" : ""} onClick={() => goTo(i)} aria-current={i === index ? "step" : undefined}><span>{String(i + 1).padStart(2, "0")}</span><strong>{item.title}</strong><span>→</span></button>)}{filtered.length === 0 && <p className="guide-no-results">No matching chapter. Try a different term.</p>}</nav>
    </div>
  </main>;
}

