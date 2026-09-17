"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadProjects, ProjectAsset } from "../../lib/project";
import { hydrateProjectAssets } from "../../lib/asset-store";

type LibraryAsset = ProjectAsset & { projectName: string; projectId: string };

function isImage(asset: LibraryAsset) {
  const t = asset.type.toLowerCase();
  return t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("webp") || asset.name.toLowerCase().startsWith("image");
}

function isVideo(asset: LibraryAsset) {
  const t = asset.type.toLowerCase();
  return t.includes("video") || t.includes("mp4") || asset.name.toLowerCase().startsWith("video");
}

function isAudio(asset: LibraryAsset) {
  const t = asset.type.toLowerCase();
  return t.includes("audio") || t.includes("mp3") || t.includes("wav") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music");
}

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const projects = await Promise.all(loadProjects().map(project => hydrateProjectAssets(project)));
      if (cancelled) return;
      setAssets(
        projects.flatMap(project =>
          (project.assets || []).map(asset => ({
            ...asset,
            projectName: project.name,
            projectId: project.id,
          }))
        )
      );
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? assets.filter(a => (a.name + " " + a.type + " " + a.projectName).toLowerCase().includes(q))
      : assets;
  }, [assets, query]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span>TT</span></div><div><strong>TTCGameLab</strong><small>LIVE CREATIVE STUDIO</small></div></div>
        <Link href="/project/new" className="new-project"><span>＋</span> New Project</Link>
        <nav>
          <div className="nav-label">WORKSPACE</div>
          <Link href="/" className="nav-item"><span>⌂</span> Home</Link>
          <Link href="/projects" className="nav-item"><span>▣</span> My Projects</Link>
          <Link href="/assets" className="nav-item active"><span>✦</span> Asset Library</Link>
        </nav>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="crumb"><span>Workspace</span><em>/</em><strong>Asset Library</strong></div>
        </header>

        <div className="content">
          <div className="section-head">
            <div><h2>Asset Library</h2><p>Assets generated or uploaded across your TTCGameLab projects.</p></div>
            <input className="asset-library-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search assets..." />
          </div>

          {filtered.length === 0 ? (
            <div className="asset-library-empty">
              <strong>No assets yet.</strong>
              <span>Upload or generate images, video, and audio from a project and they will appear here.</span>
              <Link href="/project/new" className="build-btn">Create a project →</Link>
            </div>
          ) : (
            <div className="asset-library-grid">
              {filtered.map((asset, index) => (
                <article className="library-card" key={asset.projectId + asset.name + index}>
                  <div className="library-preview">
                    {asset.url && isImage(asset) && <img src={asset.url} alt={asset.name} />}
                    {asset.url && isVideo(asset) && <video src={asset.url} controls preload="metadata" />}
                    {asset.url && isAudio(asset) && <audio src={asset.url} controls />}
                    {!asset.url && <div className="library-no-preview">No preview</div>}
                  </div>
                  <div className="library-body">
                    <strong>{asset.name}</strong>
                    <span>{asset.type}</span>
                    <Link href={'/project/' + asset.projectId}>Open project →</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
