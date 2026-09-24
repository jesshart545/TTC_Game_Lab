"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProjectFromServer, loadProjects, Project, ProjectEvent } from "../../../lib/project";

export default function PublishedDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState("");
  const [hostKey, setHostKey] = useState("");
  useEffect(() => {
    let cancelled = false;
    const queryKey = new URLSearchParams(window.location.search).get("key") || "";
    if (/^[a-f0-9]{64}$/.test(queryKey)) {
      window.localStorage.setItem(`ttc-live-host-${slug}`, queryKey);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setHostKey(window.localStorage.getItem(`ttc-live-host-${slug}`) || "");
    (async () => {
      const local = loadProjects().find(p => p.slug === slug);
      let draft = local;
      try { draft = (await loadProjectFromServer(slug)) || local; } catch {}
      if (!cancelled) setProject(draft?.publishedSnapshot || (draft?.status === "Published" ? draft : null) || null);
    })();
    return () => { cancelled = true; };
  }, [slug]);
  async function trigger(control: ProjectEvent) {
    if (!project) return;
    if (!hostKey) { setStatus("Open the private dashboard link from your builder to enable controls."); return; }
    if (control.compositionId && !project.compositions?.some(c => c.id === control.compositionId && c.inProject)) {
      setStatus("This package is not in the published experience."); return;
    }
    try {
      const response = await fetch(`/api/live/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json", "x-host-key": hostKey }, body: JSON.stringify({ controlId: control.id }) });
      if (!response.ok) throw new Error((await response.json()).error || "Trigger failed.");
      setStatus(`${control.label} sent to the overlay.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not reach the live server."); }
  }
  if (!project) return <main className="published-dashboard"><h1>Project not published.</h1></main>;
  const projectHost = typeof window !== "undefined" && window.location.hostname === `${project.slug}.${process.env.NEXT_PUBLIC_PROJECT_BASE_DOMAIN}`;
  const overlayPath = projectHost ? "/overlay" : `/published/${project.slug}/overlay`;
  return <main className={`published-dashboard runtime-${project.theme}`}><header><div><small>TTCGameLab · HOST DASHBOARD</small><h1>{project.name}</h1><p>Control the approved live experience.</p></div><a href={overlayPath} target="_blank" rel="noopener noreferrer">Open Overlay ↗</a></header><section><h2>Live controls</h2><div className="published-controls">{project.controls.map(control => <button type="button" key={control.id} onClick={() => trigger(control)}><strong>{control.label}</strong><span>{control.detail}</span></button>)}</div>{!project.controls.length && <p>No controls were published for this project.</p>}{status && <p role="status">{status}</p>}</section><section><h2>Overlay URL</h2><code>{typeof window !== "undefined" ? `${window.location.origin}${overlayPath}` : ""}</code><p>Use this URL as the browser source in your livestream software.</p></section></main>;
}
