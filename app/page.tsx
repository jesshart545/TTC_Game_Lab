"use client";

import Link from "next/link";
import { useState } from "react";

const projects = [
  { id: "haunted-gaming", name: "Haunted Gaming", status: "Published", time: "12 min ago", icon: "👻", accent: "cyan", description: "Spooky alerts, reactive character and horror effects." },
  { id: "space-battle", name: "Space Battle", status: "Published", time: "Yesterday", icon: "🚀", accent: "purple", description: "Futuristic battles with interactive audience events." },
  { id: "christmas-giveaway", name: "Christmas Giveaway", status: "Draft", time: "Dec 18", icon: "🎄", accent: "pink", description: "Festive scenes, giveaways and animated alerts." },
];

export default function Home() {
  const [query, setQuery] = useState("");
  return <main className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><span>TT</span></div><div><strong>TTCGameLab</strong><small>LIVE CREATIVE STUDIO</small></div></div><Link href="/project/new" className="new-project"><span>＋</span> New Project</Link><nav><div className="nav-label">WORKSPACE</div><Link href="/" className="nav-item active"><span>⌂</span> Home</Link><Link href="/projects" className="nav-item"><span>▣</span> My Projects <b>3</b></Link><Link href="/assets" className="nav-item"><span>✦</span> Asset Library</Link></nav><div className="sidebar-bottom"><div className="status"><i /> AI Engine Ready</div><div className="profile"><div className="avatar">JT</div><div><strong>Creator</strong><small>Personal workspace</small></div><span>•••</span></div></div></aside>
    <section className="main"><header className="topbar"><div className="crumb"><span>Workspace</span><em>/</em><strong>Home</strong></div><div className="top-actions"><Link className="help" href="/guide" aria-label="How to use TTCGameLab" title="How to use TTCGameLab">?</Link><button className="profile-mini">JT</button></div></header><div className="content">
      <section className="hero"><div className="eyebrow"><span className="spark">✦</span> AI-POWERED LIVESTREAM CREATION</div><h1>What are we <span>creating?</span></h1><p>Describe your TikTok LIVE experience. TTCGameLab builds the working dashboard, overlay, interactions, and visuals.</p><div className="prompt-wrap"><textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder={'Tell me what you want to create...\n\nTry: “Create a spooky gaming overlay where my character reacts when someone follows.”'}/><div className="prompt-footer"><div className="prompt-tools"><button>＋ Upload</button><button>◈ Add assets</button></div><Link href={query.trim() ? `/project/new?idea=${encodeURIComponent(query)}` : "/project/new"} className="build-btn">Build with AI <span>→</span></Link></div></div><div className="suggestions"><span>Try one of these:</span><button onClick={()=>setQuery("Create a futuristic space battle stream")}>🚀 Space battle</button><button onClick={()=>setQuery("Create a spooky horror gaming overlay")}>👻 Horror gaming</button><button onClick={()=>setQuery("Create a neon cyberpunk stream")}>⚡ Cyberpunk</button></div></section>
      <Link href="/guide" className="guide-promo"><span className="guide-promo-icon">▶</span><span><strong>New here? Watch the walkthrough</strong><small>Follow the narrated guide at your own pace. Pause, replay, or jump to any step.</small></span><b>Watch guide →</b></Link>
      <section className="projects-section"><div className="section-head"><div><h2>Your projects</h2><p>Pick up where you left off.</p></div><Link href="/projects">View all <span>→</span></Link></div><div className="project-grid">{projects.map(p=><Link href={`/project/${p.id}`} className="project-card" key={p.id}><div className={`preview ${p.accent}`}><div className="preview-grid"/><div className="preview-title">{p.icon} {p.name}</div><div className="preview-center"><span>LIVE</span><strong>YOUR STREAM</strong></div><div className="preview-bar"><i/><i/><i/><i/></div></div><div className="card-body"><div><h3>{p.name}</h3><p>{p.description}</p></div><span className="dots">•••</span></div><div className="card-meta"><span className="published"><i/> {p.status}</span><span>{p.time}</span></div></Link>)}<Link href="/project/new" className="add-card"><div className="add-icon">＋</div><strong>Create a new project</strong><span>Start from a blank canvas</span></Link></div></section>
    </div></section>
  </main>;
}
