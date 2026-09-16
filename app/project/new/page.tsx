"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProject, loadProjects, saveProjects } from "../../../lib/project";

export default function NewProject() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);

  function build() {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    const project = createProject(prompt.trim());
    saveProjects([project, ...loadProjects().filter(p => p.id !== project.id)]);
    setTimeout(() => router.push(`/project/${project.id}`), 500);
  }

  return (
    <main className="workspace-page">
      <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">New Project <span>Draft</span></div><div className="save-state">● Saved locally</div></header>
      <div className="workspace-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Let&apos;s build your LIVE.</h1></div><div className="ai-orb">✦</div></div>
          <div className="messages">
            <div className="message ai"><div className="message-icon">✦</div><div><strong>TTCGameLab AI</strong><p>Tell me what you want your TikTok LIVE experience to feel like. You can describe the idea, upload assets, or just give me a rough concept. I&apos;ll turn it into a working dashboard, overlay, interactions, and visuals.</p></div></div>
            <div className="idea-card"><span>QUICK START</span><button onClick={() => setPrompt("Create a spooky gaming stream where my character reacts dramatically whenever someone follows.")}>👻 Spooky gaming stream <b>→</b></button><button onClick={() => setPrompt("Create a futuristic space battle stream with interactive audience events and neon effects.")}>🚀 Interactive space battle <b>→</b></button><button onClick={() => setPrompt("Create a cyberpunk livestream with animated alerts, particles and a reactive character.")}>⚡ Neon cyberpunk <b>→</b></button></div>
          </div>
          <div className="composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe your livestream idea..."/><div className="composer-bottom"><button type="button">＋ Upload</button><button type="button">◈ Generate asset</button><button className="send" type="button" onClick={build}>{building ? "Building…" : "Build experience →"}</button></div></div>
        </section>
        <section className="preview-panel"><div className="preview-head"><div><small>LIVE PREVIEW</small><h2>{building ? "Building your experience…" : "Your experience will appear here"}</h2></div></div><div className="stage"><div className="stage-scan"/><div className="stage-content"><div className="stage-live">● AI BUILD PIPELINE</div><div className="stage-title">YOUR<br/><span>LIVESTREAM</span></div><p>{building ? "Creating project state, host controls and overlay runtime." : "Start with an idea. The finished project becomes editable and publishable."}</p></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div></section>
        <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT ASSETS</small><h2>Assets</h2></div><button>＋</button></div><div className="upload-box"><div>↑</div><strong>Drop assets here</strong><span>Images, video, audio, logos</span></div><div className="asset-empty">Upload handling and AI asset generation are ready for the project asset layer.</div></aside>
      </div>
    </main>
  );
}
