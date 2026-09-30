"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type Project, type ProjectEvent } from "../../lib/project";
import RuntimeActionLayers, { useRuntimeActions } from "../../components/RuntimeActionLayers";
import "./reference.css";

function PracticePreview({project}:{project:Project}) {
  const runtime=useRuntimeActions(project);
  const background=project.assets.find(a=>runtime.backgroundKey ? (a.storageKey || a.name)===runtime.backgroundKey : a.role==="background");
  const tools=project.gameTools.filter(tool=>tool.enabled && tool.inToolbox);
  function tryTool(id:string,name:string) {
    const control:ProjectEvent={id:"reference-"+id,label:name,detail:"Preview "+name,action:"tool."+id,toolIds:[id]};
    runtime.fire(control);
  }
  return <div className="reference-workbench">
    <section aria-label="Practice controls" className="reference-controls">
      <h2>Dashboard buttons</h2><p>Try the saved assignments.</p>
      {project.controls.map(control=><button key={control.id} onClick={()=>runtime.fire(control)}>{control.label}<small>{control.toolIds?.map(id=>tools.find(t=>t.id===id)?.name).filter(Boolean).join(" + ") || control.detail}</small></button>)}
      <h2>Toolbox</h2><p>Try each tool individually. Trigger trivia again to reveal its answer.</p>
      {tools.map(tool=><button key={tool.id} onClick={()=>tryTool(tool.id,tool.name)}>{tool.name}<small>{tool.type.replaceAll("-"," ")}</small></button>)}
    </section>
    <section className="reference-preview" aria-label="Audience practice preview">
      {background?.url && <img className="reference-background" src={background.url} alt={background.name}/>}
      <span className="reference-preview-label">PRACTICE PREVIEW</span>
      <RuntimeActionLayers runtime={runtime} project={project}/>
    </section>
  </div>;
}
export default function ReferenceProject() {
  const [project,setProject]=useState<Project|null>(null);
  const [error,setError]=useState("");
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    void fetch("/api/reference", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load the reference project.");
      return (await response.json()).project as Project;
    }).then(value=>{
      if(cancelled)return;
      if(!value)setError("The reference project is temporarily unavailable.");else setProject(value);
    }).catch(()=>{if(!cancelled)setError("Could not load the reference project. Please reload to try again.");});
    return()=>{cancelled=true;};
  },[]);
  return <main className="reference-page">
    <header><Link href="/">← TTCGameLab Home</Link><Link href="/guide">How to use TTCGameLab</Link></header>
    <div className="reference-intro"><small>SHARED · READ ONLY · AVAILABLE TO EVERYONE</small><h1>Verification project</h1><p>Explore a working example of game tools, dashboard assignments and an audience overlay. Use it as a reference while creating your own project.</p><p className="reference-notice">Interactive practice · these controls affect your preview only.</p></div>
    {!project ? <p role="status">{error || "Loading reference project…"}</p> : <>
      <div className="reference-section-head"><h2>Try the project</h2><button onClick={()=>setVersion(v=>v+1)}>Reset practice preview</button></div>
      <PracticePreview key={version} project={project}/>
      <section className="reference-settings"><h2>How this project is configured</h2><p>Workshop creates the assets and tools. Build Space connects tools to dashboard buttons. Publishing makes the approved overlay available for a livestream.</p><div>{project.gameTools.filter(t=>t.enabled).map(tool=><details key={tool.id}><summary>{tool.name}</summary><dl><dt>Tool type</dt><dd>{tool.type.replaceAll("-"," ")}</dd><dt>Used in</dt><dd>{tool.inToolbox?"Dashboard toolbox":"Audience overlay"}</dd>{tool.type==="countdown" && <><dt>Duration</dt><dd>{String(tool.config.seconds)} seconds</dd></>}{["wheel","random-picker"].includes(tool.type) && <><dt>Choices</dt><dd>{(Array.isArray(tool.config.segments)?tool.config.segments:Array.isArray(tool.config.items)?tool.config.items:[]).map(String).join(" · ")}</dd></>}{tool.type==="dice" && <><dt>Dice sides</dt><dd>{String(tool.config.sides)}</dd></>}</dl></details>)}</div></section>
    </>}
  </main>;
}
