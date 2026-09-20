"use client";

import Link from "next/link";
import { loadProjects, deleteProject, Project } from "../../lib/project";
import { deleteProjectStoredAssets } from "../../lib/asset-store";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => setProjects(loadProjects()), []);

  async function handleDelete(project: Project) {
    const confirmed = window.confirm(`Delete "${project.name}"? This will remove the project and its saved assets from this browser.`);
    if (!confirmed) return;
    try {
      await deleteProjectStoredAssets(project.id);
    } catch {
      // Continue removing the project record even if a browser-storage cleanup fails.
    }
    deleteProject(project.id);
    setProjects(current => current.filter(item => item.id !== project.id));
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
