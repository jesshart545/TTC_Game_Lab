"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProjects, Project } from "../../../../../lib/project";

export default function OverlayRuntime() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [event, setEvent] = useState("");
  useEffect(() => { const p = loadProjects().find(x => x.slug === slug) || loadProjects()[0]; setProject(p); if (!p) return; const bc = new BroadcastChannel(`ttc-project-${p.id}`); bc.onmessage = e => { if (e.data?.type === "PROJECT_EVENT") { setEvent(e.data.action); setTimeout(() => setEvent(""), 900); } }; return () => bc.close(); }, [slug]);
  if (!project) return <div className="runtime-page">Project not found.</div>;
  return <main className={`overlay-runtime runtime-${project.theme}`}><div className="runtime-grid"/><div className={`overlay-pulse ${event ? "active" : ""}`}/><div className="overlay-safe"><div className="overlay-title">{project.overlay.title}</div><div className="overlay-subtitle">{project.overlay.subtitle}</div>{project.overlay.showCharacter && <div className={`overlay-avatar ${event ? "react" : ""}`}>◉</div>}{project.overlay.showAlerts && <div className={`overlay-alert ${event ? "on" : ""}`}>{event ? "INTERACTION" : "READY"}<span>{event ? event.replaceAll(".", " • ").toUpperCase() : "Audience effects enabled"}</span></div>} {project.overlay.showChat && <div className="overlay-chat"><b>LIVE CHAT</b><span>Welcome in!</span><span>🔥🔥🔥</span></div>}</div></main>;
}
