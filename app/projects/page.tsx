"use client";

import Link from "next/link";
import { deleteProjectFromServer, Project } from "../../lib/project";
import { deleteProjectStoredAssets } from "../../lib/asset-store";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
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
        if (!cancelled) setProjects([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(project: Project) {
    const confirmed = window.confirm(`Delete "${project.name}"? This permanently removes the saved project and its stored assets.`);
    if (!confirmed) return;
    try {
      await deleteProjectFromServer(project.id);
      await deleteProjectStoredAssets(project.id).catch(() => {});
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
      <div className="project-library-grid">
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
        {projects.length === 0 && (
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
