"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createProject, loadProjects, Project, ProjectAsset, saveProjects } from "../../../lib/project";

const GENERATORS = [
  { type: "image", label: "Image", icon: "▣" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "voice", label: "Voice", icon: "◖" },
  { type: "music", label: "Music", icon: "♫" },
] as const;

type GeneratorType = (typeof GENERATORS)[number]["type"];

function isImage(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("image") || asset.name.toLowerCase().startsWith("image")));
}

function isVideo(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("video") || asset.name.toLowerCase().startsWith("video")));
}

function isAudio(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("audio") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music")));
}

export default function ProjectWorkspace() {
  const params = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");

  useEffect(() => { const all = loadProjects(); const found = all.find(p => p.id === params.id) || all[0]; if (found) setProject(found); }, [params.id]);
  const projectUrl = useMemo(() => project ? `/published/${project.slug}` : "", [project]);

  function enableWheel() { if (!project) return; const wheel = project.wheel || { enabled:false,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false }; const next = { ...project, wheel: { ...wheel, enabled: true, visible: false }, controls: project.controls.some(c => c.action === "wheel.spin") ? project.controls : [...project.controls, { id:"wheel", label:"SPIN WHEEL", action:"wheel.spin", detail:"Show and spin the game wheel on the live overlay" }], updatedAt:"just now" }; persist(next); setAssetStatus("Game wheel added. It stays hidden until the host triggers it."); }\n\n  function updateWheelField(field: "title" | "segments", value: string) { if (!project) return; const wheel = project.wheel || { enabled:true,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false }; persist({ ...project, wheel: { ...wheel, [field]: field === "segments" ? value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12) : value }, updatedAt:"just now" }); }\n\n  function spinWheel() { if (!project?.wheel?.enabled || project.wheel.segments.length < 2) return; const latest = loadProjects().find(p=>p.id===project.id) || project; persist({ ...latest, wheel: { ...latest.wheel, spinning: true, visible: true }, updatedAt:"just now" }); const channel = new BroadcastChannel(`ttc-project-${project.id}`); channel.postMessage({ type:"WHEEL_SPIN", at:Date.now() }); channel.close(); setTimeout(()=>{ const current=loadProjects().find(p=>p.id===project.id); if(current) persist({ ...current, wheel:{...current.wheel, spinning:false, visible:false}, updatedAt:"just now" }); }, 3200); }\n\n  function persist(next: Project) { const all = loadProjects(); saveProjects(all.some(p => p.id === next.id) ? all.map(p => p.id === next.id ? next : p) : [next, ...all]); setProject(next); }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!project) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const latest = loadProjects().find(p => p.id === project.id) || project;
        const asset: ProjectAsset = { name: file.name, type: file.type || "File", url: String(reader.result) };
        persist({ ...latest, assets: [...latest.assets, asset], updatedAt: "just now" });
        setAssetStatus(`${file.name} added`);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  async function generateAsset(type: GeneratorType) {
    if (!project || assetBusy) return;
    if (type === "music") {
      setShowGenerator(false);
      setAssetStatus("Music generation is disabled until the self-hosted ACE-Step server is connected.");
      return;
    }
    const requested = window.prompt(`Describe the ${type} you want to generate`, project.prompt || `A neon futuristic ${type} for this TikTok LIVE experience`);
    if (!requested?.trim()) return;
    setShowGenerator(false); setAssetBusy(true); setAssetStatus(`Generating ${type}…`);
    try {
      const response = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: requested.trim(), type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${type} generation failed.`);
      const url = data.url || data.audio_url || data.audioUrl || data.output_url || "";
      if (!url) throw new Error(`${type} generation returned no asset URL.`);
      const name = `${type[0].toUpperCase()}${type.slice(1)} ${(loadProjects().find(p => p.id === project.id) || project).assets.length + 1}`;
      const latest = loadProjects().find(p => p.id === project.id) || project;
      const asset: ProjectAsset = { name, type: data.model || type, url };
      persist({ ...latest, assets: [...latest.assets, asset], updatedAt: "just now" });
      setAssetStatus(`${name} generated`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : `${type} generation failed.`);
    } finally { setAssetBusy(false); }
  }

  function renderAsset(asset: ProjectAsset) {
    if (!asset.url) return null;
    if (isImage(asset)) return <img src={asset.url} alt={asset.name} className="asset-thumb" />;
    if (isVideo(asset)) return <video src={asset.url} className="asset-thumb" controls preload="metadata" />;
    if (isAudio(asset)) return <audio src={asset.url} controls />;
    return null;
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!project || !draft.trim() || building) return;
    const text = draft.trim();
    const updated: Project = { ...project, updatedAt: "just now", messages: [...project.messages, { role: "user", text }] };
    setDraft(""); setBuilding(true);
    const wheelRequest = /game wheel|spin(ning)? wheel|wheel.*overlay|custom(ize|izable).*wheel/i.test(text);
    if (wheelRequest) {
      const latest = loadProjects().find(p => p.id === project.id) || project;
      const wheel = latest.wheel || { enabled:false,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false };
      const wheelProject: Project = { ...latest, updatedAt:"just now", wheel:{ ...wheel, enabled:true }, messages:[...latest.messages,{role:"user",text},{role:"assistant",text:"Added a customizable Game Wheel to the dashboard and live overlay. You can edit its title and segments in the dashboard, then spin it for viewers."}] };
      persist(wheelProject); setBuilding(false); return;
    }
    const updated: Project = { ...project, updatedAt: "just now", messages: [...project.messages, { role: "user", text }] };
    persist(updated);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: updated.messages }) });
      const data = await response.json();
      const reply = response.ok && data.message ? data.message : "I updated the project context and prepared the requested change. Add your Agnes API key in Vercel to turn on live AI generation.";
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: reply }] });
    } catch {
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: "Your change is saved locally. The AI gateway is not reachable right now." }] });
    } finally { setBuilding(false); }
  }

  function trigger(control: Project["controls"][number]) { if (!project) return; if (control.action === "wheel.spin") { spinWheel(); return; } setEventLog(v => [`${control.label} → ${control.detail}`, ...v].slice(0, 4)); const channel = new BroadcastChannel(`ttc-project-${project.id}`); channel.postMessage({ type: "PROJECT_EVENT", action: control.action, at: Date.now() }); channel.close(); }
  function publish() { if (project) persist({ ...project, status: "Published", updatedAt: "just now" }); }
  function beginBlank() { const p = createProject("Create a new interactive TikTok LIVE experience"); saveProjects([p, ...loadProjects().filter(x => x.id !== p.id)]); window.location.href = `/project/${p.id}`; }

  if (!project) return <main className="loading-page"><div className="ai-orb">✦</div><h1>Loading your project...</h1></main>;
  return <main className="workspace-page">
    <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">{project.name} <span>{project.status}</span></div><div className="workspace-actions"><Link href={projectUrl} className="preview-link">Preview</Link><button onClick={publish} className="publish-btn">Publish ↗</button></div></header>
    <div className="workspace-grid">
      <section className="chat-panel"><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Keep building it.</h1></div><div className="ai-orb">✦</div></div><div className="messages">{project.messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="message-icon">{m.role === "assistant" ? "✦" : "YOU"}</div><div><strong>{m.role === "assistant" ? "TTCGameLab AI" : "You"}</strong><p>{m.text}</p></div></div>)}{building&&<div className="build-activity"><span>✦</span><div><strong>Building your change...</strong><small>Sending project context to the AI engine</small></div></div>}<div className="idea-card"><span>QUICK ACTIONS</span><button onClick={()=>setDraft("Make the main character bigger and move it slightly left.")}>Make character bigger <b>→</b></button><button onClick={()=>setDraft("Add a follower alert with a dramatic entrance animation.")}>Add follower alert <b>→</b></button><button onClick={()=>setDraft("Give the whole experience a stronger neon glow.")}>Increase neon <b>→</b></button></div></div><form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Tell me what to change..."/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button type="button" onClick={() => fileInputRef.current?.click()}>＋ Upload</button><button type="button" onClick={() => setShowGenerator(v => !v)}>{assetBusy ? "Generating…" : "◈ Generate asset"}</button><button className="send" type="submit">{building ? "Building…" : "Update experience →"}</button></div>{showGenerator&&<div className="idea-card"><span>GENERATE WITH AI</span>{GENERATORS.map((item)=><button key={item.type} type="button" onClick={()=>generateAsset(item.type)}>{item.icon} {item.label} <b>→</b></button>)}</div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
      <section className="preview-panel"><div className="preview-head"><div><small>LIVE PROJECT</small><h2>{project.name}</h2></div><Link href={`${projectUrl}/overlay`} className="preview-link">Open overlay</Link></div><div className="stage"><div className="stage-scan"/><div className="overlay-demo"><div className="overlay-live">● LIVE</div><div className="overlay-headline">{project.overlay.title}</div><div className="overlay-sub">{project.overlay.subtitle}</div>{project.overlay.showCharacter&&<div className="demo-character">◉</div>}<div className="demo-alert">FOLLOW ALERT</div></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div><div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Events</span><span>{project.status} · {project.updatedAt}</span></div><div className="control-strip"><div><small>HOST CONTROLS</small><strong>Trigger your generated experience</strong></div><div className="control-buttons">{project.controls.map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div>{eventLog.length>0&&<div className="event-log">{eventLog.map((x,i)=><span key={i}>✓ {x}</span>)}</div>}</div></section>
      <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT</small><h2>Details</h2></div><button type="button" onClick={() => fileInputRef.current?.click()}>＋</button></div><div className="detail-block"><span>PROJECT URL</span><code>{projectUrl}</code><Link href={projectUrl}>Open project ↗</Link></div><div className="detail-block"><span>GAME WHEEL</span>{project.wheel?.enabled ? <><input className="wheel-input" value={project.wheel.title} onChange={e=>updateWheelField("title",e.target.value)} placeholder="Wheel title"/><input className="wheel-input" value={project.wheel.segments.join(", ")} onChange={e=>updateWheelField("segments",e.target.value)} placeholder="Prize, Challenge, Bonus"/><button className="outline-btn" onClick={spinWheel}>↻ Spin visible wheel</button></> : <button className="outline-btn" onClick={enableWheel}>＋ Add game wheel</button>}</div><div className="detail-block"><span>ASSETS</span>{project.assets.map(a=><div className="asset-card" key={a.name}><div className="asset-card-title"><b>{a.name}</b><em>{a.type}</em></div>{renderAsset(a)}</div>)}{project.assets.length===0&&<p className="empty-note">No assets yet. Upload or generate them from the conversation.</p>}</div><div className="detail-block"><span>NEW PROJECT</span><button className="outline-btn" onClick={beginBlank}>＋ Start fresh</button></div></aside>
    </div>
  </main>;
}
