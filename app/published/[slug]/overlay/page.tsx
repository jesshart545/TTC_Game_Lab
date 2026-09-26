"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { hydrateProjectAssets } from "../../../../lib/asset-store";
import CompositionPlayer from "../../../../components/CompositionPlayer";
import { loadProjectFromServer, Project, ProjectAsset, ProjectEvent } from "../../../../lib/project";

function assetEditStyle(asset: ProjectAsset) {
  const e=asset.edits||{};
  return { transform:`translate(${e.offsetX||0}px,${e.offsetY||0}px) scale(${e.zoom||1}) rotate(${e.rotation||0}deg) scaleX(${e.flipX?-1:1}) scaleY(${e.flipY?-1:1})`, opacity:e.opacity??1, filter:`brightness(${e.brightness??100}%) contrast(${e.contrast??100}%) saturate(${e.saturation??100}%) blur(${e.blur??0}px)` };
}

export default function PublishedProject() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [activePackage, setActivePackage] = useState<{ control: ProjectEvent; at: number } | null>(null);
  const [flash, setFlash] = useState(false); const [spinning, setSpinning] = useState(false); const [wheelVisible, setWheelVisible] = useState(false); const [activeTools, setActiveTools] = useState<any[]>([]); const [chainAsset, setChainAsset] = useState<ProjectAsset | null>(null); const [triviaQuestion, setTriviaQuestion] = useState<any>(null); const [triviaRevealed, setTriviaRevealed] = useState(false); const [triviaTool, setTriviaTool] = useState<any>(null); const [usedTrivia, setUsedTrivia] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      let draft: Project | null = null;
      try { draft = await loadProjectFromServer(slug); } catch {}
      const published = draft?.publishedSnapshot || (draft?.status === "Published" ? draft : null);
      if (cancelled) return;
      setProject(published || null);
      if (!published) return;
      void hydrateProjectAssets(published).then(value => { if (!cancelled) setProject(value); }).catch(() => {});
      setTriviaTool((published.gameTools || []).find(tool => tool.type === "trivia-board" && tool.enabled && tool.inOverlayBuild) || null);
      let cursor = 0;
      let initialized = false;
      const poll = async () => {
        try {
          const url = `/api/live/${encodeURIComponent(slug)}?${initialized ? `since=${cursor}` : "init=1"}`;
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error("Live event service unavailable.");
          const data = await response.json();
          if (cancelled) return;
          if (!initialized && Array.isArray(data.usedTrivia)) setUsedTrivia(Object.fromEntries(data.usedTrivia.map((key:string) => [key, true])));
          initialized = true;
          cursor = data.cursor;
          for (const event of data.events || []) {
            if (event.type === "trivia" && event.payload) {
              const payload = event.payload;
              if (payload.action === "question") {
                setTriviaQuestion(payload);
                setTriviaRevealed(false);
                if (Number.isInteger(payload.categoryIndex) && Number.isInteger(payload.questionIndex)) setUsedTrivia(prev => ({ ...prev, [`${payload.categoryIndex}:${payload.questionIndex}`]: true }));
              } else if (payload.action === "answer") {
                setTriviaQuestion((current:any) => current || payload);
                setTriviaRevealed(true);
              } else if (payload.action === "close") {
                setTriviaQuestion(null);
                setTriviaRevealed(false);
              }
              continue;
            }
            const control = published.controls.find(item => item.id === event.controlId);
            if (!control) continue;
            const tools = (control.toolIds || []).flatMap(id => { const tool = (published.gameTools || []).find(item => item.id === id && item.inToolbox); return tool ? [tool] : []; });
            if (tools.length) {
              setActiveTools(tools);
              for (const tool of tools) {
                if (tool.type === "wheel") {
                  setWheelVisible(true); setSpinning(true);
                  window.setTimeout(() => setSpinning(false), 2200);
                  window.setTimeout(() => setWheelVisible(false), 3200);
                }
              }
              window.setTimeout(() => setActiveTools([]), 10000);
            }
            for (const step of control.chain || []) {
              const delay = step.timing.mode === "delay" ? Math.max(0, Number(step.timing.seconds || 0)) * 1000 : 0;
              window.setTimeout(() => {
                if (step.kind === "composition") {
                  const composition = published.compositions?.find(comp => comp.id === step.refId && comp.inProject);
                  if (composition) setActivePackage({ control: { ...control, compositionId: composition.id }, at: Date.now() });
                } else if (step.kind === "asset") {
                  const asset = published.assets.find(item => item.storageKey === step.refId || item.name === step.refId);
                  if (asset) { setChainAsset(asset); window.setTimeout(() => setChainAsset(null), 8000); }
                } else if (step.kind === "animation") {
                  setFlash(true); window.setTimeout(() => setFlash(false), 700);
                }
              }, delay);
            }
            if (control.compositionId) {
              if (published.compositions?.some(comp => comp.id === control.compositionId && comp.inProject)) setActivePackage({ control, at: Date.now() });
            } else if (control.action === "wheel.spin") {
              setWheelVisible(true); setSpinning(true);
              window.setTimeout(() => setSpinning(false), 2200);
              window.setTimeout(() => setWheelVisible(false), 3200);
            } else {
              setFlash(true); window.setTimeout(() => setFlash(false), 700);
            }
          }
        } catch {} finally { if (!cancelled) timer = window.setTimeout(poll, 1000); }
      };
      void poll();
    })();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [slug]);
  if (!project) return <div className="runtime-page">Project not found.</div>;
  const placedAssets = (project.assets || []).filter(asset => asset.inProject && asset.url);
  const backgroundAsset = placedAssets.find(asset => asset.role === "background");
  const layerAssets = placedAssets.filter(asset => asset.role !== "background");
  return <main className={`runtime-page runtime-${project.theme}`} style={backgroundAsset ? { backgroundImage: `url("${backgroundAsset.url}")`, backgroundSize:"cover", backgroundPosition:"center", ...assetEditStyle(backgroundAsset) } : undefined}><div className="runtime-grid"/><div className="runtime-vignette"/><div className="runtime-top"><span>● LIVE</span><strong>{project.overlay.title}</strong><span>{project.overlay.subtitle}</span></div>{project.overlay.showCharacter && <div className={`runtime-character ${flash ? "flash" : ""}`}>◉</div>} {project.overlay.showAlerts && <div className={`runtime-alert ${flash ? "visible" : ""}`}>FOLLOW ALERT<span>Someone just joined the party!</span></div>} {!activeTools.some(tool => tool.type === "wheel") && project.wheel?.enabled && wheelVisible && <div className={`runtime-wheel ${spinning ? "spinning" : ""}`}><div className="runtime-wheel-pointer">▼</div><div className="runtime-wheel-inner"><strong>{project.wheel.title}</strong><div className="runtime-wheel-segments">{project.wheel.segments.map((segment,i)=><span key={i}>{segment}</span>)}</div></div><button className="runtime-wheel-spin" onClick={() => { setWheelVisible(true); setSpinning(true); const bc = new BroadcastChannel(`ttc-project-${project.id}`); bc.postMessage({type:"WHEEL_SPIN",at:Date.now()}); bc.close(); setTimeout(()=>setSpinning(false),2200); setTimeout(()=>setWheelVisible(false),3200); }}>SPIN</button></div>}{project.overlay.showChat && <div className="runtime-chat"><small>LIVE CHAT</small><span>Welcome to the stream 👋</span><span>Let&apos;s go!</span><span>This is insane 🔥</span></div>}<>{activeTools.filter(tool=>tool.type!=="wheel").map((activeTool:any)=><div key={activeTool.id} className={`runtime-game-tool runtime-tool-${activeTool.type}`}>{activeTool.type==="random-picker" && <><small>RANDOM PICKER</small><strong>{(activeTool.config?.items || ["Winner"])[0]}</strong></>}{activeTool.type==="countdown" && <><small>COUNTDOWN</small><strong>{activeTool.config?.seconds || 10}</strong></>}{activeTool.type==="poll" && <><small>{activeTool.config?.question || "LIVE POLL"}</small><div>{(activeTool.config?.options || []).map((x:any)=><span key={x}>{x}</span>)}</div></>}{activeTool.type==="dice" && <><small>DICE ROLL</small><strong>{Math.floor(Math.random()*(Number(activeTool.config?.sides||6)))+1}</strong></>}</div>)}</><>{triviaTool && !triviaQuestion && <div className="runtime-jeopardy"><div className="runtime-jeopardy-title">TTCGameLab TRIVIA</div><div className="runtime-jeopardy-grid">{(triviaTool.config?.categories || []).map((cat:any,ci:number)=><div className="runtime-jeopardy-column" key={`${cat.name}-${ci}`}><div className="runtime-jeopardy-category">{cat.name}</div>{(cat.questions || []).map((q:any,qi:number)=>{ const used=!!usedTrivia[`${ci}:${qi}`]; return <div className={`runtime-jeopardy-value ${used ? "used" : ""}`} key={`${q.value}-${qi}`} style={used ? { opacity:.28 } : undefined}>{used ? "USED" : `$${q.value}`}</div>; })}</div>)}</div><div className="runtime-jeopardy-help">Choose a clue in the host dashboard</div></div>}{triviaQuestion && <div className="runtime-trivia"><div className="runtime-trivia-board-label">TTCGameLab TRIVIA</div><div className="runtime-trivia-category">{triviaQuestion.category}</div><div className="runtime-trivia-value">${triviaQuestion.value}</div><div className="runtime-trivia-question">{triviaQuestion.prompt}</div>{triviaRevealed && <div className="runtime-trivia-answer"><span>ANSWER</span>{triviaQuestion.answer}</div>}{triviaQuestion.source && <div className="runtime-trivia-source">Source: {triviaQuestion.source}</div>}</div>}</>{chainAsset && (chainAsset.type.toLowerCase().includes("video") ? <video src={chainAsset.url} className="runtime-chain-asset" autoPlay playsInline onEnded={()=>setChainAsset(null)}/> : chainAsset.type.toLowerCase().includes("audio") ? <audio src={chainAsset.url} autoPlay onEnded={()=>setChainAsset(null)}/> : <img src={chainAsset.url} alt={chainAsset.name} className="runtime-chain-asset"/>)}<div className="runtime-project-assets">{layerAssets.map((asset:any, index:number) => asset.role === "video" ? <video key={(asset.storageKey || asset.name) + index} src={asset.url} className="runtime-project-media" style={assetEditStyle(asset)} autoPlay loop muted playsInline /> : asset.role === "audio" ? <audio key={(asset.storageKey || asset.name) + index} src={asset.url} autoPlay /> : <img key={(asset.storageKey || asset.name) + index} src={asset.url} alt={asset.name} className="runtime-project-media" style={assetEditStyle(asset)} />)}</div>{activePackage && (() => { const composition = project.compositions?.find(c => c.id === activePackage.control.compositionId); return composition ? <CompositionPlayer key={`${activePackage.control.id}-${activePackage.at}`} composition={composition} assets={project.assets} placement={activePackage.control.overlayResult} startedAt={activePackage.at} onEnd={() => setActivePackage(null)} /> : null; })()}<div className="runtime-brand">TTCGameLab <span>interactive experience</span></div></main>;
}
