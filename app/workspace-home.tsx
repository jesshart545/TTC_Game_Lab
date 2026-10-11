"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "../lib/project";
import { GAME_TEMPLATES } from "../lib/game-templates";
import SignOutButton from "./sign-out-button";

export default function WorkspaceHome() {
  const [loadError,setLoadError]=useState("");
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    setLoading(true);setLoadError("");
    void fetch("/api/projects", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load projects.");
      const data = await response.json();
      setProjects(Array.isArray(data.projects) ? data.projects.map((row: any) => row.data as Project).filter(Boolean) : []);
    }).catch(() => setLoadError("Your saved projects could not be loaded. Please try again.")).finally(()=>setLoading(false));
  }, [retry]);
  return <main className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><span>TT</span></div><div><strong>TTCGameLab</strong><small>LIVE CREATIVE STUDIO</small></div></div><Link href="/project/new" className="new-project"><span>＋</span> New Project</Link><nav><div className="nav-label">WORKSPACE</div><Link href="/" className="nav-item active"><span>⌂</span> Home</Link><Link href="/projects" className="nav-item"><span>▣</span> My Projects {projects.length > 0 && <b>{projects.length}</b>}</Link><Link href="/assets" className="nav-item"><span>✦</span> Asset Library</Link><Link href="/reference" className="nav-item"><span>◫</span> Reference Project</Link></nav><div className="sidebar-bottom"><div className="status"><i /> Your private workspace</div><div className="profile"><div className="avatar">TT</div><div><strong>Creator</strong><small>Private workspace</small></div><SignOutButton /></div></div></aside>
    <section className="main"><header className="topbar"><div className="crumb"><span>Workspace</span><em>/</em><strong>Home</strong></div><div className="top-actions"><Link className="help" href="/tutorial" aria-label="How to use TTCGameLab" title="How to use TTCGameLab">?</Link></div></header><div className="content">
      <section className="hero"><div className="eyebrow"><span className="spark">✦</span> AI-POWERED LIVESTREAM CREATION</div><h1>What are we <span>creating?</span></h1><p>Describe your TikTok LIVE experience. TTCGameLab builds the working dashboard, overlay, interactions, and visuals.</p><div className="prompt-wrap"><textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder={"Tell me what you want to create... Try: Create a spooky gaming overlay where my character reacts when someone follows."}/><div className="prompt-footer"><small style={{color:"#8a96a8"}}>This opens a new project draft with your idea — edit everything before publishing.</small><Link href={query.trim() ? `/project/new?idea=${encodeURIComponent(query)}` : "/project/new"} className="build-btn">Build with AI <span>→</span></Link></div></div><div className="suggestions"><span>Try one of these:</span><button onClick={()=>setQuery("Create a futuristic space battle stream")}>🚀 Space battle</button><button onClick={()=>setQuery("Create a spooky horror gaming overlay")}>👻 Horror gaming</button><button onClick={()=>setQuery("Create a neon cyberpunk stream")}>⚡ Cyberpunk</button></div></section>
      <section className="projects-section"><div className="section-head"><div><h2>Start from a template</h2><p>Pick a ready-to-use game, then make it yours. Every template is fully customizable — edit anything yourself or with AI.</p></div></div><div className="project-grid">{GAME_TEMPLATES.map(t=><Link href={`/project/new?template=${t.id}`} className="project-card" key={t.id}><div className={`preview ${t.id.length % 3 === 0 ? "purple" : t.id.length % 3 === 1 ? "cyan" : "pink"}`}><div className="preview-grid"/><div className="preview-center"><span style={{fontSize:"2rem"}}>{t.icon}</span><strong>{t.name.toUpperCase()}</strong></div></div><div className="card-body"><div><h3>{t.icon} {t.name}</h3><p>{t.tagline}</p></div><small style={{color:"#8a96a8"}}>{t.category}</small></div><div className="card-meta"><span className="published"><i/> Template</span><span>✦ Edit with AI</span></div></Link>)}</div></section>
      <section className="projects-section"><div className="section-head"><div><h2>Shared reference project</h2><p>Try verified tools and dashboard controls while learning the workflow.</p></div><Link href="/reference">Explore reference project →</Link></div></section><section className="projects-section"><div className="section-head"><div><h2>Your projects</h2><p>Pick up where you left off.</p></div><Link href="/projects">View all <span>→</span></Link></div>{loading&&<p role="status">Loading your saved projects…</p>}{loadError&&<div role="alert"><p>{loadError}</p><button type="button" className="outline-btn" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}<div className="project-grid">{projects.map(p=><Link href={`/project/${p.id}`} className="project-card" key={p.id}><div className={`preview ${p.theme}`}><div className="preview-grid"/><div className="preview-title">{p.name}</div><div className="preview-center"><span>{p.status.toUpperCase()}</span><strong>{p.overlay?.title || p.name}</strong></div></div><div className="card-body"><div><h3>{p.name}</h3><p>{p.description}</p></div></div><div className="card-meta"><span className="published"><i/> {p.status}</span><span>{p.updatedAt}</span></div></Link>)}<Link href="/project/new" className="add-card"><div className="add-icon">＋</div><strong>Start blank</strong><span>Open an empty workshop and build from scratch</span></Link></div></section>
    </div></section>
  </main>;
}

