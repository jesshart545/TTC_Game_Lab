"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProjects, Project } from "../../../lib/project";

export default function PublishedProject() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [flash, setFlash] = useState(false); const [spinning, setSpinning] = useState(false);
  useEffect(() => { const p = loadProjects().find(x => x.slug === slug) || loadProjects()[0]; setProject(p); if (!p) return; const bc = new BroadcastChannel(`ttc-project-${p.id}`); bc.onmessage = e => { if (e.data?.type === "PROJECT_EVENT") { setFlash(true); setTimeout(() => setFlash(false), 700); } if (e.data?.type === "WHEEL_SPIN") { setWheelVisible(true); setSpinning(true); setTimeout(() => setSpinning(false), 2200); setTimeout(() => setWheelVisible(false), 3200); } }; return () => bc.close(); }, [slug]);
  if (!project) return <div className="runtime-page">Project not found.</div>;
  return <main className={`runtime-page runtime-${project.theme}`}><div className="runtime-grid"/><div className="runtime-vignette"/><div className="runtime-top"><span>● LIVE</span><strong>{project.overlay.title}</strong><span>{project.overlay.subtitle}</span></div>{project.overlay.showCharacter && <div className={`runtime-character ${flash ? "flash" : ""}`}>◉</div>} {project.overlay.showAlerts && <div className={`runtime-alert ${flash ? "visible" : ""}`}>FOLLOW ALERT<span>Someone just joined the party!</span></div>} {project.wheel?.enabled && wheelVisible && <div className={`runtime-wheel ${spinning ? "spinning" : ""}`}><div className="runtime-wheel-pointer">▼</div><div className="runtime-wheel-inner"><strong>{project.wheel.title}</strong><div className="runtime-wheel-segments">{project.wheel.segments.map((segment,i)=><span key={i}>{segment}</span>)}</div></div><button className="runtime-wheel-spin" onClick={() => { setWheelVisible(true); setSpinning(true); const bc = new BroadcastChannel(`ttc-project-${project.id}`); bc.postMessage({type:"WHEEL_SPIN",at:Date.now()}); bc.close(); setTimeout(()=>setSpinning(false),2200); setTimeout(()=>setWheelVisible(false),3200); }}>SPIN</button></div>}{project.overlay.showChat && <div className="runtime-chat"><small>LIVE CHAT</small><span>Welcome to the stream 👋</span><span>Let&apos;s go!</span><span>This is insane 🔥</span></div>}<div className="runtime-brand">TTCGameLab <span>interactive experience</span></div></main>;
}
