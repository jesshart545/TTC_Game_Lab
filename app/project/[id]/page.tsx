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

  function persist(next: Project) { const all = loadProjects(); saveProjects(all.some(p => p.id === next.id) ? all.map(p => p.id === next.id ? next : p) : [next, ...all]); setProject(next); }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!project) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const asset: ProjectAsset = { name: file.name, type: file.type || "File", url: String(reader.result) };
        const latest = loadProjects().find(p => p.id === project.id) || project;
        persist({ ...latest, assets: [...latest.assets, asset], updatedAt: "just now" });
        setAssetStatus(`${file.name} added`);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  async function pollMusic(taskId: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const response = await fetch(`/api/generate-music-status?taskId=${encodeURIComponent(taskId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Music generation failed.");
      if (data.status === "complete" && data.url) return data.url as string;
    }
    throw new Error("Music generation is taking longer than expected. The task may still be running.");
  }

  async function generateAsset(type: GeneratorType) {
    if (!project || assetBusy) return;
    const requested = window.prompt(`Describe the ${type} you want to generate`, project.prompt || `A neon futuristic ${type} for this TikTok LIVE experience`);
    if (!requested?.trim()) return;
    setShowGenerator(false); setAssetBusy(true); setAssetStatus(`Generating ${type}…`);
    try {
      const response = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: requested.trim(), type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${type} generation failed.`);
      let url = data.url || data.audio_url || data.audioUrl || data.output_url || "";
      const name = `${type[0].toUpperCase()}${type.slice(1)} ${project.assets.length + 1}`;
      if (type === "music" && data.taskId) {
        setAssetStatus(`${name} is being generated…`);
        url = await pollMusic(data.taskId);
      }
      if (!url && type !== "video") throw new Error(`${type} generation returned no asset URL.`);
      const latest = loadProjects().find(p => p.id === project.id) || project;
      const asset: ProjectAsset = { name, type: data.model || type, url };
      persist({ ...latest, assets: [...latest.assets, asset], updatedAt: "just now" });
      setAssetStatus(`${name} generated`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : `${type} generation failed.`);
    } finally { setAssetBusy(false); }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!project || !draft.trim() || building) return;
    const text = draft.trim();
    const updated: Project = { ...project, updatedAt: "just now", messages: [...project.messages, { role: "user", text }] };
    persist(updated); setDraft(""); setBuilding(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: updated.messages }) });
      const data = await response.json();
      const reply = response.ok && data.message ? data.message : "I updated the project context and prepared the requested change. Add your Agnes API key in Vercel to turn on live AI generation.";
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: reply }] });
    } catch {
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: "Your change is saved locally. The AI gateway is not reachable right now." }] });
    } finally { setBuilding(false); }
  }

  function trigger(control: Project["controls"][number]) { if (!project) return; setEventLog(v => [`${control.label} → ${control.detail}`, ...v].slice(0, 4)); const channel = new BroadcastChannel(`ttc-project-${project.id}`); channel.postMessage({ type: "PROJECT_EVENT", action: control.action, at: Date.now() }); channel.close(); }
  function publish() { if (project) persist({ ...project, status: "Published", updatedAt: "just now" }); }
  function beginBlank() { const p = createProject("Create a new interactive TikTok LIVE experience"); saveProjects([p, ...loadProjects().filter(x => x.id !== p.id)]); window.location.href = `/project/${p.id}`; }

  if (!project) return <main className="loading-page"><div className="ai-orb">✦</div><h1>Loading your project...</h1></main>;
  return <main className="workspace-page">
    <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">{project.name} <span>{project.status}</span></div><div className="workspace-actions"><Link href={projectUrl} className="preview-link">Preview</Link><button onClick={publish} className="publish-btn">Publish ↗</button></div></header>
    <div className="workspace-grid">
      <section className="chat-panel"><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Keep building it.</h1></div><div className="ai-orb">✦</div></div><div className="messages">{project.messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="message-icon">{m.role === "assistant" ? "✦" : "YOU"}</div><div><strong>{m.role === "assistant" ? "TTCGameLab AI" : "You"}</strong><p>{m.text}</p></div></div>)}{building&&<div className="build-activity"><span>✦</span><div><strong>Building your change...</strong><small>Sending project context to the AI engine</small></div></div>}<div className="idea-card"><span>QUICK ACTIONS</span><button onClick={()=>setDraft("Make the main character bigger and move it slightly left.")}>Make character bigger <b>→</b></button><button onClick={()=>setDraft("Add a follower alert with a dramatic entrance animation.")}>Add follower alert <b>→</b></button><button onClick={()=>setDraft("Give the whole experience a stronger neon glow.")}>Increase neon <b>→</b></button></div></div><form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Tell me what to change..."/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button type="button" onClick={() => fileInputRef.current?.click()}>＋ Upload</button><button type="button" onClick={() => setShowGenerator(v => !v)}>{assetBusy ? "Generating…" : "◈ Generate asset"}</button><button className="send" type="submit">{building ? "Building…" : "Update experience →"}</button></div>{showGenerator&&<div className="idea-card"><span>GENERATE WITH AI</span>{GENERATORS.map((item)=><button key={item.type} type="button" onClick={()=>generateAsset(item.type)}>{item.icon} {item.label} <b>→</b></button>)}</div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
      <section className="preview-panel"><div className="preview-head"><div><small>LIVE PROJECT</small><h2>{project.name}</h2></div><Link href={`${projectUrl}/overlay`} className="preview-link">Open overlay</Link></div><div className="stage"><div className="stage-scan"/><div className="overlay-demo"><div className="overlay-live">● LIVE</div><div className="overlay-headline">{project.overlay.title}</div><div className="overlay-sub">{project.overlay.subtitle}</div>{project.overlay.showCharacter&&<div className="demo-character">◉</div>}<div className="demo-alert">FOLLOW ALERT</div></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div><div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Events</span><span>{project.status} · {project.updatedAt}</span></div><div className="control-strip"><div><small>HOST CONTROLS</small><strong>Trigger your generated experience</strong></div><div className="control-buttons">{project.controls.map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div>{eventLog.length>0&&<div className="event-log">{eventLog.map((x,i)=><span key={i}>✓ {x}</span>)}</div>}</div></section>
      <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT</small><h2>Details</h2></div><button type="button" onClick={() => fileInputRef.current?.click()}>＋</button></div><div className="detail-block"><span>PROJECT URL</span><code>{projectUrl}</code><Link href={projectUrl}>Open project ↗</Link></div><div className="detail-block"><span>ASSETS</span>{project.assets.map(a=><div className="asset-row" key={a.name}><b>{a.name}</b><em>{a.type}</em></div>)}{project.assets.length===0&&<p className="empty-note">No assets yet. Upload or generate them from the conversation.</p>}</div><div className="detail-block"><span>NEW PROJECT</span><button className="outline-btn" onClick={beginBlank}>＋ Start fresh</button></div></aside>
    </div>
  </main>;
}
