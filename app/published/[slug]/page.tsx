"use client";

import YouTubeHostPanel from "../../../components/YouTubeHostPanel";
import { safeYoutubePlacement } from "../../../lib/youtube";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadPublishedProjectFromServer, Project, ProjectEvent } from "../../../lib/project";

export default function PublishedDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [showYoutube, setShowYoutube] = useState(false);
  const [status, setStatus] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [activeTrivia, setActiveTrivia] = useState<{categoryIndex:number;questionIndex:number} | null>(null);
  const [usedTrivia, setUsedTrivia] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    const queryKey = new URLSearchParams(window.location.search).get("key") || "";
    if (/^[a-f0-9]{64}$/.test(queryKey)) {
      window.localStorage.setItem(`ttc-live-host-${slug}`, queryKey);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setHostKey(window.localStorage.getItem(`ttc-live-host-${slug}`) || "");
    (async () => {
      let draft: Project | null = null;
      try { draft = await loadPublishedProjectFromServer(slug); } catch(error) { if(!cancelled)setLoadError(error instanceof Error?error.message:"Could not load the published experience."); } finally { if(!cancelled)setLoading(false); }
      if (!cancelled) { setProject(draft); setShowYoutube(Boolean(draft?.gameTools?.some(tool=>tool.type==="youtube" && tool.enabled)) || window.localStorage.getItem(`ttc-youtube-dashboard-${slug}`)==="1"); }
    })();
    return () => { cancelled = true; };
  }, [slug]);
  async function post(body: Record<string, unknown>) {
    if (!hostKey) throw new Error("Open the private dashboard link from your builder to enable controls.");
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json", "x-host-key": hostKey }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error((await response.json()).error || "Trigger failed.");
  }
  async function trigger(control: ProjectEvent) {
    if (!project) return;
    if (control.compositionId && !project.compositions?.some(c => c.id === control.compositionId && c.inProject)) { setStatus("This package is not in the published experience."); return; }
    try { await post({ controlId: control.id }); setStatus(`${control.label} sent to the overlay.`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Could not reach the live server."); }
  }
  async function triviaAction(action:"question"|"answer"|"close", categoryIndex?:number, questionIndex?:number) {
    if (!project) return;
    try {
      await post({ trivia: { action, categoryIndex, questionIndex } });
      if (action === "question" && categoryIndex !== undefined && questionIndex !== undefined) {
        setActiveTrivia({categoryIndex,questionIndex});
        setUsedTrivia(v => ({...v,[`${categoryIndex}:${questionIndex}`]:true}));
        setStatus("Question sent to the overlay.");
      } else if (action === "answer") setStatus("Answer revealed on the overlay.");
      else { setActiveTrivia(null); setStatus("Returned to the trivia board."); }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not reach the live server."); }
  }
  if (!project) return <main className="published-dashboard"><h1>{loading ? "Loading published experience…" : loadError || "Project not published."}</h1></main>;
  const projectHost = typeof window !== "undefined" && window.location.hostname === `${project.slug}.${process.env.NEXT_PUBLIC_PROJECT_BASE_DOMAIN}`;
  const overlayPath = projectHost ? "/overlay" : `/published/${project.slug}/overlay`;
  const trivia = (project.gameTools || []).find(tool => tool.type === "trivia-board" && tool.enabled && tool.inOverlayBuild);
  const categories = Array.isArray(trivia?.config?.categories) ? trivia.config.categories as any[] : [];
  return <main className={`published-dashboard runtime-${project.theme}`}><header><div><small>TTCGameLab · HOST DASHBOARD</small><h1>{project.name}</h1><p>Control the approved live experience.</p></div><a href={overlayPath} target="_blank" rel="noopener noreferrer">Open Overlay ↗</a></header><section><h2>Live controls</h2><div className="published-controls">{project.controls.map(control => <button type="button" key={control.id} onClick={() => trigger(control)}><strong>{control.label}</strong><span>{control.toolIds?.length ? control.toolIds.map(id=>project.gameTools.find(tool=>tool.id===id)?.name).filter(Boolean).join(" + ") : control.chain?.length ? control.chain.map(step=>step.label).join(" → ") : control.detail === "Unassigned dashboard button" ? "No action assigned" : control.detail}</span></button>)}</div>{!project.controls.length && !trivia && <p>No controls were published for this project.</p>}{status && <p role="status">{status}</p>}</section>{trivia && <section><h2>{trivia.name}</h2>{categories.length === 5 ? <><div className="published-trivia-grid">{categories.map((category:any, ci:number)=><div className="published-trivia-column" key={`${category.name}-${ci}`}><strong>{category.name}</strong>{(category.questions || []).slice(0,5).map((question:any, qi:number)=>{const key=`${ci}:${qi}`; const used=usedTrivia[key] || Boolean(question.used); return <button type="button" key={key} disabled={used} onClick={()=>triviaAction("question",ci,qi)}>{used ? "USED" : `$${question.value}`}</button>})}</div>)}</div><div className="published-controls"><button type="button" disabled={!activeTrivia} onClick={()=>activeTrivia && triviaAction("answer",activeTrivia.categoryIndex,activeTrivia.questionIndex)}><strong>SHOW ANSWER</strong><span>Reveal the current clue answer</span></button><button type="button" disabled={!activeTrivia} onClick={()=>triviaAction("close")}><strong>BACK TO BOARD</strong><span>Close the clue and continue the game</span></button></div></> : <p>Generate five trivia categories in the builder before publishing.</p>}</section>}<section><h2>Live YouTube player</h2>{showYoutube ? <><YouTubeHostPanel slug={slug} hostKey={hostKey} placement={safeYoutubePlacement(project.gameTools.find(tool=>tool.type==="youtube")?.config.placement)}/><button type="button" onClick={()=>{setShowYoutube(false);window.localStorage.removeItem(`ttc-youtube-dashboard-${slug}`);}}>Close dashboard panel</button><p>Closing this panel does not stop the overlay. Use Stop &amp; hide first to end playback.</p></> : <button type="button" onClick={()=>{setShowYoutube(true);window.localStorage.setItem(`ttc-youtube-dashboard-${slug}`,"1");}}>Add YouTube player to dashboard</button>}</section><section><h2>Overlay URL</h2><code>{typeof window !== "undefined" ? `${window.location.origin}${overlayPath}` : ""}</code><p>Use this URL as the browser source in your livestream software.</p></section></main>;
}
