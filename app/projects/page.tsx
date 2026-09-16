"use client";
import Link from "next/link";
import { loadProjects, Project } from "../../lib/project";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => setProjects(loadProjects()), []);
  return <main className="projects-page"><header className="projects-top"><Link href="/" className="back">← TTCGameLab</Link><div><small>PROJECT LIBRARY</small><h1>My Projects</h1></div><Link href="/project/new" className="build-btn">＋ New Project</Link></header><div className="project-library-grid">{projects.map(p => <Link key={p.id} href={`/project/${p.id}`} className="library-card"><div className={`library-preview ${p.theme}`}><span>{p.status.toUpperCase()}</span><strong>{p.overlay.title}</strong><em>{p.overlay.subtitle}</em></div><div className="library-info"><div><h2>{p.name}</h2><p>{p.description}</p></div><span>{p.updatedAt}</span></div></Link>)}</div></main>;
}
