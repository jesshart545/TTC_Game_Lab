"use client";

import Link from "next/link";
import { loadTrashedProjects, trashAction, TrashedProject } from "../../../lib/project";
import { useEffect, useState } from "react";

export default function TrashPage() {
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(""), [retry, setRetry] = useState(0);
  const [trashed, setTrashed] = useState<TrashedProject[]>([]);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    setLoading(true); setLoadError("");
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadTrashedProjects();
        if (!cancelled) setTrashed(rows);
      } catch (error) {
        console.error("Trash load failed:", error);
        if (!cancelled) setLoadError("Trash could not be loaded. Please try again.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [retry]);

  async function handleRestore(item: TrashedProject) {
    setBusyId(item.id);
    try {
      await trashAction(item.id, "restore");
      setTrashed(current => current.filter(entry => entry.id !== item.id));
    } catch (error) {
      console.error("Restore failed:", error);
      window.alert("The project could not be restored. It is still in Trash.");
    } finally { setBusyId(""); }
  }

  async function handleDeleteForever(item: TrashedProject) {
    const confirmed = window.confirm(`Delete "${item.name}" forever? This permanently removes the saved project and its stored assets. This cannot be undone.`);
    if (!confirmed) return;
    setBusyId(item.id);
    try {
      await trashAction(item.id, "delete-forever");
      setTrashed(current => current.filter(entry => entry.id !== item.id));
    } catch (error) {
      console.error("Delete forever failed:", error);
      window.alert("The project could not be deleted forever. It is still in Trash.");
    } finally { setBusyId(""); }
  }

  return (
    <main className="projects-page">
      <header className="projects-top">
        <Link href="/projects" className="back">← My Projects</Link>
        <div><small>PROJECT LIBRARY</small><h1>Trash</h1></div>
        <Link href="/project/new" className="build-btn">＋ New Project</Link>
      </header>
      <p>Projects you delete land here first. Restore one to bring it back to your library exactly as it was, or delete it forever to erase it and its stored assets for good.</p>
      {loading && <p role="status">Loading trash…</p>}
      {loadError && <div role="alert"><p>{loadError}</p><button className="outline-btn" onClick={() => setRetry(v => v + 1)}>Try again</button></div>}
      <div className="project-library-grid">
        {trashed.map(item => (
          <article key={item.id} className="library-card project-library-card">
            <div className={`library-preview ${item.project?.theme ?? "cyan"}`}>
              <span>IN TRASH</span>
              <strong>{item.project?.overlay?.title || item.name}</strong>
              <em>{item.project?.overlay?.subtitle || ""}</em>
            </div>
            <div className="library-info">
              <div><h2>{item.name}</h2><p>{item.project?.description || ""}</p></div>
              <span>{item.deletedAt ? `Deleted ${new Date(item.deletedAt).toLocaleString()}` : "Deleted"}{item.deletedBy ? ` by ${item.deletedBy}` : ""}</span>
            </div>
            <div className="project-card-actions">
              <button type="button" className="outline-btn" disabled={busyId === item.id} onClick={() => handleRestore(item)}>Restore</button>
              <button type="button" className="danger-btn" disabled={busyId === item.id} onClick={() => handleDeleteForever(item)}>Delete forever</button>
            </div>
          </article>
        ))}
        {!loading && !loadError && trashed.length === 0 && (
          <div className="asset-library-empty">
            <strong>Trash is empty.</strong>
            <span>Projects you delete will wait here until you restore them or delete them forever.</span>
            <Link href="/projects" className="build-btn">Back to My Projects →</Link>
          </div>
        )}
      </div>
    </main>
  );
}
