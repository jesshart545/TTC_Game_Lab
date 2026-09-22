"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteStoredAsset, hydrateProjectAssets, storeUploadedAsset } from "../../lib/asset-store";
import MediaEditor from "../../components/MediaEditor";
import { loadProjects, Project, ProjectAsset, replaceProjectAssets, saveProjectToServer, saveProjects } from "../../lib/project";

type LibraryAsset = ProjectAsset & { projectName: string; projectId: string; assetIndex: number };
type Filter = "all" | "image" | "video" | "audio";

function kind(asset: ProjectAsset): Exclude<Filter,"all"> | "other" {
  const t=(asset.type+" "+asset.name).toLowerCase();
  if(t.includes("image")||/\.(png|jpe?g|webp|gif)$/i.test(asset.name)) return "image";
  if(t.includes("video")||/\.(mp4|webm|mov|m4v)$/i.test(asset.name)) return "video";
  if(t.includes("audio")||/\.(mp3|wav|m4a|ogg)$/i.test(asset.name)||t.includes("voice")||t.includes("music")) return "audio";
  return "other";
}

export default function AssetLibraryPage() {
  const [assets,setAssets]=useState<LibraryAsset[]>([]);
  const [projects,setProjects]=useState<Project[]>([]);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("all");
  const [status,setStatus]=useState("");
  const [editing,setEditing]=useState<LibraryAsset|null>(null);

  async function refreshAssets() {
    const raw=loadProjects();
    const hydrated=await Promise.all(raw.map(project=>hydrateProjectAssets(project).catch(()=>project)));
    setProjects(hydrated);
    setAssets(hydrated.flatMap(project=>(project.assets||[]).map((asset,assetIndex)=>({...asset,projectName:project.name,projectId:project.id,assetIndex}))));
  }
  useEffect(()=>{void refreshAssets()},[]);

  async function persistProject(next:Project) {
    const all=loadProjects();
    saveProjects(all.map(p=>p.id===next.id?next:p));
    setProjects(v=>v.map(p=>p.id===next.id?next:p));
    await saveProjectToServer(next).catch(()=>{});
    await refreshAssets();
  }

  async function handleDelete(asset:LibraryAsset) {
    if(!window.confirm(`Delete "${asset.name}" from ${asset.projectName}?`)) return;
    if(asset.storageKey) try{await deleteStoredAsset(asset.storageKey)}catch{}
    const project=loadProjects().find(p=>p.id===asset.projectId); if(!project)return;
    replaceProjectAssets(project.id,project.assets.filter((_,i)=>i!==asset.assetIndex));
    await refreshAssets(); setStatus("Asset deleted.");
  }

  async function rename(asset:LibraryAsset) {
    const value=window.prompt("Rename asset",asset.name)?.trim(); if(!value||value===asset.name)return;
    const project=loadProjects().find(p=>p.id===asset.projectId); if(!project)return;
    const next={...project,assets:project.assets.map((a,i)=>i===asset.assetIndex?{...a,name:value}:a),updatedAt:"just now"};
    await persistProject(next); setStatus("Asset renamed.");
  }

  async function toggleInProject(asset:LibraryAsset) {
    const project=loadProjects().find(p=>p.id===asset.projectId); if(!project)return;
    const current=project.assets[asset.assetIndex]; const adding=!current.inProject;
    let role=current.role;
    if(adding&&!role){const k=kind(current);role=k==="image"?(project.assets.some(a=>a.inProject&&a.role==="background")?"layer":"background"):k==="video"?"video":"audio"}
    const next={...project,assets:project.assets.map((a,i)=>i===asset.assetIndex?{...a,inProject:adding,role}:a),updatedAt:"just now"};
    await persistProject(next); setStatus(adding?"Added to project preview.":"Removed from project preview.");
  }

  async function saveEdits(asset:LibraryAsset,nextAsset:ProjectAsset) {
    const project=loadProjects().find(p=>p.id===asset.projectId); if(!project)return;
    await persistProject({...project,assets:project.assets.map((a,i)=>i===asset.assetIndex?nextAsset:a),updatedAt:"just now"});
    setStatus("Asset edit settings saved.");
  }

  async function saveAsNew(asset:LibraryAsset,nextAsset:ProjectAsset) {
    if(!nextAsset.url)return;
    setStatus("Saving edited image…");
    const response=await fetch(nextAsset.url);
    if(!response.ok)throw new Error("Could not load edited image.");
    const blob=await response.blob();
    const file=new File([blob],nextAsset.name||"ai-edited-image.png",{type:blob.type||"image/png"});
    const stored=await storeUploadedAsset(asset.projectId,file);
    const project=loadProjects().find(p=>p.id===asset.projectId); if(!project)return;
    await persistProject({...project,assets:[...project.assets,{...stored,name:file.name}],updatedAt:"just now"});
    setStatus("Edited image saved as a new permanent asset.");
  }

  async function copyToProject(asset:LibraryAsset,targetId:string) {
    if(!targetId||targetId===asset.projectId)return;
    const target=loadProjects().find(p=>p.id===targetId); if(!target)return;
    const copy:ProjectAsset={name:asset.name,type:asset.type,url:asset.url,storageKey:asset.storageKey,edits:asset.edits,inProject:false,role:asset.role};
    await persistProject({...target,assets:[...target.assets,copy],updatedAt:"just now"});
    setStatus(`${asset.name} added to ${target.name} library.`);
  }

  const filtered=useMemo(()=>assets.filter(a=>{
    const q=query.trim().toLowerCase(); const matches=!q||(a.name+" "+a.type+" "+a.projectName).toLowerCase().includes(q);
    return matches&&(filter==="all"||kind(a)===filter);
  }),[assets,query,filter]);

  return <main className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><span>TT</span></div><div><strong>TTCGameLab</strong><small>LIVE CREATIVE STUDIO</small></div></div><Link href="/project/new" className="new-project"><span>＋</span> New Project</Link><nav><div className="nav-label">WORKSPACE</div><Link href="/" className="nav-item"><span>⌂</span> Home</Link><Link href="/projects" className="nav-item"><span>▣</span> My Projects</Link><Link href="/assets" className="nav-item active"><span>✦</span> Asset Library</Link></nav></aside>
  <section className="main"><header className="topbar"><div className="crumb"><span>Workspace</span><em>/</em><strong>Asset Library</strong></div></header><div className="content">
    <div className="section-head"><div><h2>Asset Library</h2><p>Manage generated and uploaded media across your projects.</p></div><input className="asset-library-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search assets or projects..." /></div>
    <div className="asset-library-toolbar"><div className="asset-filter-tabs">{(["all","image","video","audio"] as Filter[]).map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x==="all"?"All":x[0].toUpperCase()+x.slice(1)}</button>)}</div><span>{filtered.length} asset{filtered.length===1?"":"s"}</span></div>
    {status&&<div className="asset-library-status">{status}</div>}
    {filtered.length===0?<div className="asset-library-empty"><strong>No matching assets.</strong><span>Generate or upload media in a project and it will appear here.</span><Link href="/project/new" className="build-btn">Create a project →</Link></div>:
    <div className="asset-library-grid">{filtered.map(asset=><article className="library-card" key={asset.projectId+(asset.storageKey||asset.name)+asset.assetIndex}><div className="library-preview">
      {asset.url&&kind(asset)==="image"&&<img src={asset.url} alt={asset.name}/>}
      {asset.url&&kind(asset)==="video"&&<video src={asset.url} controls preload="metadata"/>}
      {asset.url&&kind(asset)==="audio"&&<audio src={asset.url} controls/>}
      {!asset.url&&<div className="library-no-preview">No preview</div>}</div>
      <div className="library-body"><strong>{asset.name}</strong><span>{kind(asset).toUpperCase()} · {asset.projectName}</span>
        <div className="library-action-grid"><button className="outline-btn" onClick={()=>void toggleInProject(asset)}>{asset.inProject?"✓ In Project":"+ Add to Project"}</button><button className="outline-btn" onClick={()=>void rename(asset)}>Rename</button>{kind(asset)==="image"&&<button className="outline-btn library-edit-btn" onClick={()=>setEditing(asset)}>✦ Edit / AI Edit</button>}</div>
        <select className="library-project-select" defaultValue="" onChange={e=>{void copyToProject(asset,e.target.value);e.currentTarget.value=""}}><option value="">Copy to another project…</option>{projects.filter(p=>p.id!==asset.projectId).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>
        <Link href={"/project/"+asset.projectId} className="outline-btn library-open-btn">{kind(asset)==="image"?"Open project to edit":"Open project"}</Link>
        <button type="button" className="danger-btn" onClick={()=>void handleDelete(asset)}>Delete asset</button>
      </div></article>)}</div>}
  </div></section>{editing&&<MediaEditor asset={editing} onClose={()=>setEditing(null)} onSave={next=>void saveEdits(editing,next)} onSaveAsNew={next=>saveAsNew(editing,next)}/>}</main>;
}
