"use client";

import Link from "next/link";
import { deleteProjectFromServer, Project } from "../../lib/project";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[retry,setRetry]=useState(0);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    setLoading(true);setLoadError("");
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load projects.");
        const data = await response.json();
        const serverProjects: Project[] = Array.isArray(data.projects)
          ? data.projects.map((row: any) => row.data as Project).filter(Boolean)
          : [];
        if (!cancelled) setProjects(serverProjects);
      } catch (error) {
        console.error("Project library load failed:", error);
        if (!cancelled) setLoadError("Your projects could not be loaded. Please try again.");
      } finally {if(!cancelled)setLoading(false);}
    })();
    return () => { cancelled = true; };
  }, [retry]);

  async function handleDelete(project: Project) {
    const confirmed = window.confirm(`Delete "${project.name}"? This permanently removes the saved project and its stored assets.`);
    if (!confirmed) return;
    try {
      await deleteProjectFromServer(project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
    } catch (error) {
      console.error("Project deletion failed:", error);
      window.alert("The project could not be deleted. Nothing was removed from the project library.");
    }
  }

  return (
    <main className="projects-page">
      <header className="projects-top">
        <Link href="/" className="back">← TTCGameLab</Link>
        <div><small>PROJECT LIBRARY</small><h1>My Projects</h1></div>
        <Link href="/project/new" className="build-btn">＋ New Project</Link>
      </header>
      {loading&&<p role="status">Loading your saved projects…</p>}{loadError&&<div role="alert"><p>{loadError}</p><button className="outline-btn" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}<div className="project-library-grid">
        <article className="library-card project-library-card">
          <Link href="/reference" className="project-library-link">
            <div className="library-preview purple"><span>SHARED · READ ONLY</span><strong>Verification Project</strong><em>A working reference for everyone</em></div>
            <div className="library-info"><div><h2>Verification Project</h2><p>Explore the tools, settings, and dashboard controls. Practice without changing the original.</p></div><span>Shared reference</span></div>
          </Link>
          <div className="project-card-actions"><Link href="/reference" className="outline-btn">Open reference</Link></div>
        </article>
        {projects.map(project => (
          <article key={project.id} className="library-card project-library-card">
            <Link href={`/project/${project.id}`} className="project-library-link">
              <div className={`library-preview ${project.theme}`}>
                <span>{project.status.toUpperCase()}</span>
                <strong>{project.overlay.title}</strong>
                <em>{project.overlay.subtitle}</em>
              </div>
              <div className="library-info">
                <div><h2>{project.name}</h2><p>{project.description}</p></div>
                <span>{project.updatedAt}</span>
              </div>
            </Link>
            <div className="project-card-actions">
              <Link href={`/project/${project.id}`} className="outline-btn">Open</Link>
              <button type="button" className="danger-btn" onClick={() => handleDelete(project)}>Delete</button>
            </div>
          </article>
        ))}
        {!loading&&!loadError&&projects.length === 0 && (
          <div className="asset-library-empty">
            <strong>No projects yet.</strong>
            <span>Create a new project to get started.</span>
            <Link href="/project/new" className="build-btn">Create a project →</Link>
          </div>
        )}
      </div>
    </main>
  );
}

