"use client";

import Link from "next/link";
import { deleteProjectFromServer, saveProjectToServer, Project } from "../../lib/project";
import { formatUpdatedAt } from "../../lib/relative-time";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useEffect, useState } from "react";

type LibraryAsset = Project["assets"][number];

function isLibraryImage(asset: LibraryAsset) {
  return !!asset.url && !asset.url.startsWith("blob:") && (asset.type || "").toLowerCase().includes("image");
}

function projectThumbnail(project: Project): LibraryAsset | undefined {
  return project.assets?.find(asset => asset.role === "background" && isLibraryImage(asset))
    || project.assets?.find(isLibraryImage);
}

export default function ProjectsPage() {
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[retry,setRetry]=useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [confirming, setConfirming] = useState<Project | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");
  const [duplicatingId, setDuplicatingId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled && typeof data?.email === "string") setAccountEmail(data.email);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
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

  async function doDelete(project: Project) {
    try {
      await deleteProjectFromServer(project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
    } catch (error) {
      console.error("Project deletion failed:", error);
      setNotice("The project could not be moved to Trash. Nothing was removed from your library.");
    }
  }

  async function duplicateProject(project: Project) {
    if (duplicatingId) return;
    setDuplicatingId(project.id);
    try {
      const clone: Project = JSON.parse(JSON.stringify(project));
      clone.id = `project-${Date.now()}`;
      clone.name = `${project.name} copy`.slice(0, 100);
      clone.slug = `${clone.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
      clone.status = "Draft";
      clone.updatedAt = new Date().toISOString();
      await saveProjectToServer(clone);
      setProjects(current => [clone, ...current]);
      setNotice(`Duplicated as "${clone.name}" — a fresh draft at the top of your library.`);
    } catch (error) {
      console.error("Duplicate failed:", error);
      setNotice("The project could not be duplicated. Nothing was changed.");
    } finally { setDuplicatingId(""); }
  }

  const visible = projects.filter(project => {
    const text = query.trim().toLowerCase();
    return !text || `${project.name} ${project.description}`.toLowerCase().includes(text);
  });
  const sorted = [...visible].sort((a, b) => sortMode === "name"
    ? a.name.localeCompare(b.name)
    : (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));

  return (
    <main className="projects-page">
      <header className="projects-top">
        <Link href="/" className="back">← TTCGameLab</Link>
        <div><small>PROJECT LIBRARY</small><h1>My Projects</h1>{accountEmail && <p style={{ margin: "4px 0 0", color: "#9aa7ba", fontSize: 12 }}>Signed in as {accountEmail}</p>}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/projects/trash" className="outline-btn">Trash</Link>
          <Link href="/project/new" className="build-btn">＋ New Project</Link>
        </div>
      </header>
      {notice && <p role="status" className="library-notice">{notice}</p>}
      <div className="asset-library-toolbar">
        <input className="asset-library-search" type="search" aria-label="Search projects" placeholder="Search projects…" value={query} onChange={event => setQuery(event.target.value)} />
        <label>Sort <select aria-label="Sort projects" value={sortMode} onChange={event => setSortMode(event.target.value as "recent" | "name")} style={{ background: "#0b0d12", border: "1px solid #252a34", color: "#e5eaf2", borderRadius: 8, padding: "8px 10px" }}><option value="recent">Recently edited</option><option value="name">Name A–Z</option></select></label>
      </div>
      {loading&&<p role="status">Loading your saved projects…</p>}{loadError&&<div role="alert"><p>{loadError}</p><button className="outline-btn" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}<div className="project-library-grid">
        <article className="library-card project-library-card">
          <Link href="/reference" className="project-library-link">
            <div className="library-preview purple"><div className="library-preview-text"><span>SHARED · READ ONLY</span><strong>Verification Project</strong><em>A working reference for everyone</em></div></div>
            <div className="library-info"><div><h2>Verification Project</h2><p>Explore the tools, settings, and dashboard controls. Practice without changing the original.</p></div><span>Shared reference</span></div>
          </Link>
          <div className="project-card-actions"><Link href="/reference" className="outline-btn">Open reference</Link></div>
        </article>
        {sorted.map(project => {
          const thumb = projectThumbnail(project);
          return (
          <article key={project.id} className="library-card project-library-card">
            <Link href={`/project/${project.id}`} className="project-library-link">
              <div className={`library-preview ${project.theme}${thumb ? " has-thumb" : ""}`}>
                {thumb && <img src={thumb.url} alt="" onError={event => { event.currentTarget.style.display = "none"; }} />}
                <div className="library-preview-text">
                  <span>{project.status.toUpperCase()}</span>
                  <strong>{project.overlay.title}</strong>
                  <em>{project.overlay.subtitle}</em>
                </div>
              </div>
              <div className="library-info">
                <div><h2>{project.name}</h2><p>{project.description}</p></div>
                <span>{formatUpdatedAt(project.updatedAt, project.id)}</span>
              </div>
            </Link>
            <div className="project-card-actions">
              <Link href={`/project/${project.id}`} className="outline-btn">Open</Link>
              <button type="button" className="outline-btn" disabled={duplicatingId === project.id} onClick={() => void duplicateProject(project)}>{duplicatingId === project.id ? "Duplicating…" : "Duplicate"}</button>
              <button type="button" className="danger-btn" onClick={() => setConfirming(project)}>Delete</button>
            </div>
          </article>
          );
        })}
        {!loading&&!loadError&&projects.length > 0 && visible.length === 0 && (
          <div className="asset-library-empty">
            <strong>No projects match "{query}".</strong>
            <span>Try a different search.</span>
          </div>
        )}
        {!loading&&!loadError&&projects.length === 0 && (
          <div className="asset-library-empty">
            <strong>No projects yet.</strong>
            <span>Create a new project to get started.</span>
            <Link href="/project/new" className="build-btn">Create a project →</Link>
          </div>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title="Move project to Trash?"
          message={`Move "${confirming.name}" to Trash? It disappears from your library and stops publishing, but nothing is erased — you can restore it from Trash, or delete it forever there.`}
          confirmLabel="Move to Trash"
          danger
          onConfirm={() => { const project = confirming; setConfirming(null); void doDelete(project); }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </main>
  );
}
