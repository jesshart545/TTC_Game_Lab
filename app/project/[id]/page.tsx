"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createProject, loadProjects, Project, saveProjects } from "../../../lib/project";

export default function ProjectWorkspace() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);

  useEffect(() => {
    const all = loadProjects();
    let found = all.find(p => p.id === params.id);
    if (!found && params.id !== "new") {
      found = all[0];
    }
    if (found) setProject(found);
  }, [params.id]);

  const projectUrl = useMemo(() => project ? `/published/${project.slug}` : "", [project]);

  function persist(next: Project) {
    const all = loadProjects();
    saveProjects(all.some(p => p.id === next.id) ? all.map(p => p.id === next.id ? next : p) : [next, ...all]);
    setProject(next);
  }

  function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!project || !draft.trim() || building) return;
    const text = draft.trim();
    const updated: Project = { ...project, updatedAt: "just now", messages: [...project.messages, { role: "user", text }] };
    persist(updated); setDraft(""); setBuilding(true);
    setTimeout(() => {
      const latest = { ...updated, messages: [...updated.messages, { role: "assistant" as const, text: `I updated ${updated.name}. The change is reflected in the live project preview. The host controls and overlay stay synchronized.` }] };
      persist(latest); setBuilding(false);
    }, 850);
  }

  function trigger(control: Project["controls"][number]) {
    if (!project) return;
    const line = `${control.label} → ${control.detail}`;
    setEventLog(v => [line, ...v].slice(0, 4));
    const channel = new BroadcastChannel(`ttc-project-${project.id}`);
    channel.postMessage({ type: "PROJECT_EVENT", action: control.action, at: Date.now() });
    channel.close();
  }

  function publish() {
    if (!project) return;
    persist({ ...project, status: "Published", updatedAt: "just now" });
  }

  function beginBlank() {
    const p = createProject("Create a new interactive TikTok LIVE experience");
    saveProjects([p, ...loadProjects().filter(x => x.id !== p.id)]);
    window.location.href = `/project/${p.id}`;
  }

  if (!project) return <main className="loading-page"><div className="ai-orb">✦</div><h1>Loading your project...</h1></main>;

  return <main className="workspace-page">
    <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">{project.name} <span>{project.status}</span></div><div className="workspace-actions"><Link href={projectUrl} className="preview-link">Preview</Link><button onClick={publish} className="publish-btn">Publish ↗</button></div></header>
    <div className="workspace-grid">
      <section className="chat-panel">
        <div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Keep building it.</h1></div><div className="ai-orb">✦</div></div>
        <div className="messages">
          {project.messages.map((m, i) => <div key={i} className={`message ${m.role}`}><div className="message-icon">{m.role === "assistant" ? "✦" : "YOU"}</div><div><strong>{m.role === "assistant" ? "TTCGameLab AI" : "You"}</strong><p>{m.text}</p></div></div>)}
          {building && <div className="build-activity"><span>✦</span><div><strong>Building your change...</strong><small>Updating the project experience</small></div></div>}
          <div className="idea-card"><span>QUICK ACTIONS</span><button onClick={() => setDraft("Make the main character bigger and move it slightly left.")}>Make character bigger <b>→</b></button><button onClick={() => setDraft("Add a follower alert with a dramatic entrance animation.")}>Add follower alert <b>→</b></button><button onClick={() => setDraft("Give the whole experience a stronger neon glow.")}>Increase neon <b>→</b></button></div>
        </div>
        <form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Tell me what to change..."/><div className="composer-bottom"><button type="button">＋ Upload</button><button type="button">◈ Generate asset</button><button className="send" type="submit">Update experience →</button></div></form>
      </section>
      <section className="preview-panel">
        <div className="preview-head"><div><small>LIVE PROJECT</small><h2>{project.name}</h2></div><Link href={`${projectUrl}/overlay`} className="preview-link">Open overlay</Link></div>
        <div className="stage"><div className="stage-scan"/><div className="overlay-demo"><div className="overlay-live">● LIVE</div><div className="overlay-headline">{project.overlay.title}</div><div className="overlay-sub">{project.overlay.subtitle}</div>{project.overlay.showCharacter && <div className="demo-character">◉</div>}<div className="demo-alert">FOLLOW ALERT</div></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div>
        <div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Events</span><span>{project.status === "Published" ? "Published" : "Draft"} · {project.updatedAt}</span></div>
        <div className="control-strip"><div><small>HOST CONTROLS</small><strong>Trigger your generated experience</strong></div><div className="control-buttons">{project.controls.map(c => <button key={c.id} onClick={() => trigger(c)}>{c.label}</button>)}</div>{eventLog.length > 0 && <div className="event-log">{eventLog.map((x, i) => <span key={i}>✓ {x}</span>)}</div>}</div>
      </section>
      <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT</small><h2>Details</h2></div></div><div className="detail-block"><span>PROJECT URL</span><code>{projectUrl}</code><Link href={projectUrl}>Open project ↗</Link></div><div className="detail-block"><span>ASSETS</span>{project.assets.map(a => <div className="asset-row" key={a.name}><b>{a.name}</b><em>{a.type}</em></div>)}{project.assets.length === 0 && <p className="empty-note">No assets yet. Upload or generate them from the conversation.</p>}</div><div className="detail-block"><span>NEW PROJECT</span><button className="outline-btn" onClick={beginBlank}>＋ Start fresh</button></div></aside>
    </div>
  </main>;
}
