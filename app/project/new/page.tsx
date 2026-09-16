"use client";

import Link from "next/link";
import { useState } from "react";

export default function NewProject() {
  const [prompt, setPrompt] = useState("");
  return (
    <main className="workspace-page">
      <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">New Project <span>Draft</span></div><div className="save-state">● Saved</div></header>
      <div className="workspace-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Let&apos;s build your LIVE.</h1></div><div className="ai-orb">✦</div></div>
          <div className="messages">
            <div className="message ai"><div className="message-icon">✦</div><div><strong>TTCGameLab AI</strong><p>Tell me what you want your TikTok LIVE experience to feel like. You can describe the idea, upload assets, or just give me a rough concept. I&apos;ll turn it into a working dashboard, overlay, interactions, and visuals.</p></div></div>
            <div className="idea-card"><span>QUICK START</span><button onClick={() => setPrompt("Create a spooky gaming stream where my character reacts dramatically whenever someone follows.")}>👻 Spooky gaming stream <b>→</b></button><button onClick={() => setPrompt("Create a futuristic space battle stream with interactive audience events and neon effects.")}>🚀 Interactive space battle <b>→</b></button><button onClick={() => setPrompt("Create a cyberpunk livestream with animated alerts, particles and a reactive character.")}>⚡ Neon cyberpunk <b>→</b></button></div>
          </div>
          <div className="composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe your livestream idea..."/><div className="composer-bottom"><button>＋ Upload</button><button>◈ Generate asset</button><button className="send">Build experience →</button></div></div>
        </section>
        <section className="preview-panel"><div className="preview-head"><div><small>LIVE PREVIEW</small><h2>Your experience will appear here</h2></div><button>↗ Fullscreen</button></div><div className="stage"><div className="stage-scan"/><div className="stage-content"><div className="stage-live">● LIVE PREVIEW</div><div className="stage-title">YOUR<br/><span>LIVESTREAM</span></div><p>Build something in the conversation<br/>to see your generated experience.</p></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div><div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Interactions</span><span>Preview updates as you build</span></div></section>
        <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT ASSETS</small><h2>Assets</h2></div><button>＋</button></div><div className="upload-box"><div>↑</div><strong>Drop assets here</strong><span>Images, video, audio, logos</span></div><div className="asset-empty">Your uploaded and AI-generated assets will show up here.</div></aside>
      </div>
    </main>
  );
}
