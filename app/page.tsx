"use client";

import { useState } from "react";

const projects = [
  { name: "Haunted Gaming", status: "Published", time: "12 min ago", icon: "👻", accent: "cyan", description: "Spooky alerts, reactive character and horror effects." },
  { name: "Space Battle", status: "Published", time: "Yesterday", icon: "🚀", accent: "purple", description: "Futuristic battles with interactive audience events." },
  { name: "Christmas Giveaway", status: "Draft", time: "Dec 18", icon: "🎄", accent: "pink", description: "Festive scenes, giveaways and animated alerts." },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("Haunted Gaming");

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>TT</span></div>
          <div><strong>TTCGameLab</strong><small>LIVE CREATIVE STUDIO</small></div>
        </div>

        <button className="new-project" onClick={() => setSelected("New Project")}>
          <span>＋</span> New Project
        </button>

        <nav>
          <div className="nav-label">WORKSPACE</div>
          <button className="nav-item active"><span>⌂</span> Home</button>
          <button className="nav-item"><span>▣</span> My Projects <b>3</b></button>
          <button className="nav-item"><span>✦</span> Asset Library</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="status"><i /> AI Engine Ready</div>
          <div className="profile"><div className="avatar">JT</div><div><strong>Creator</strong><small>Personal workspace</small></div><span>•••</span></div>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="crumb"><span>Workspace</span><em>/</em><strong>{selected}</strong></div>
          <div className="top-actions"><button className="icon-btn">⌕</button><button className="help">?</button><button className="profile-mini">JT</button></div>
        </header>

        <div className="content">
          <section className="hero">
            <div className="eyebrow"><span className="spark">✦</span> AI-POWERED LIVESTREAM CREATION</div>
            <h1>What are we <span>creating?</span></h1>
            <p>Describe your TikTok LIVE experience. I&apos;ll build the dashboard, overlay, interactions, and visuals for you.</p>

            <div className="prompt-wrap">
              <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Tell me what you want to create...\n\nTry: &quot;Create a spooky gaming overlay where my character reacts when someone follows.&quot;" />
              <div className="prompt-footer"><div className="prompt-tools"><button>＋ Upload</button><button>◈ Add assets</button></div><button className="build-btn" onClick={() => setSelected("New Project")}>Build with AI <span>→</span></button></div>
            </div>

            <div className="suggestions"><span>Try one of these:</span><button onClick={() => setQuery("Create a futuristic space battle stream")}>🚀 Space battle</button><button onClick={() => setQuery("Create a spooky horror gaming overlay")}>👻 Horror gaming</button><button onClick={() => setQuery("Create a neon cyberpunk stream")}>⚡ Cyberpunk</button></div>
          </section>

          <section className="projects-section">
            <div className="section-head"><div><h2>Your projects</h2><p>Pick up where you left off.</p></div><button>View all <span>→</span></button></div>
            <div className="project-grid">
              {projects.map(project => <article className={`project-card ${selected === project.name ? "selected" : ""}`} key={project.name} onClick={() => setSelected(project.name)}>
                <div className={`preview ${project.accent}`}><div className="preview-grid" /><div className="preview-title">{project.icon} {project.name}</div><div className="preview-center"><span>LIVE</span><strong>YOUR STREAM</strong></div><div className="preview-bar"><i /><i /><i /><i /></div></div>
                <div className="card-body"><div><h3>{project.name}</h3><p>{project.description}</p></div><button className="dots">•••</button></div>
                <div className="card-meta"><span className={project.status === "Published" ? "published" : "draft"}><i /> {project.status}</span><span>{project.time}</span></div>
              </article>)}
              <button className="add-card" onClick={() => setSelected("New Project")}><div className="add-icon">＋</div><strong>Create a new project</strong><span>Start from a blank canvas</span></button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
