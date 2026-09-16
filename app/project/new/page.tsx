"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";
import { createProject, loadProjects, ProjectAsset, saveProjects } from "../../../lib/project";

export default function NewProject() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAssets((current) => [...current, { name: file.name, type: file.type || "File", url: String(reader.result) }]);
        setAssetStatus(`${file.name} added`);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  async function generateAsset() {
    const requested = window.prompt("Describe the asset you want to generate", prompt.trim() || "A neon futuristic livestream character asset");
    if (!requested?.trim() || assetBusy) return;
    setAssetBusy(true);
    setAssetStatus("Generating with Agnes…");
    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: requested.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Asset generation failed.");
      const asset = { name: `Generated ${assets.length + 1}`, type: "Generated", url: data.url };
      setAssets((current) => [...current, asset]);
      setAssetStatus("Asset generated");
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "Asset generation failed.");
    } finally {
      setAssetBusy(false);
    }
  }

  function build() {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    const project = createProject(prompt.trim());
    project.assets = assets;
    saveProjects([project, ...loadProjects().filter(p => p.id !== project.id)]);
    setTimeout(() => router.push(`/project/${project.id}`), 500);
  }

  return (
    <main className="workspace-page">
      <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">New Project <span>Draft</span></div><div className="save-state">● Saved locally</div></header>
      <div className="workspace-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Let&apos;s build your LIVE.</h1></div><div className="ai-orb">✦</div></div>
          <div className="messages">
            <div className="message ai"><div className="message-icon">✦</div><div><strong>TTCGameLab AI</strong><p>Tell me what you want your TikTok LIVE experience to feel like. You can describe the idea, upload assets, or just give me a rough concept. I&apos;ll turn it into a working dashboard, overlay, interactions, and visuals.</p></div></div>
            <div className="idea-card"><span>QUICK START</span><button onClick={() => setPrompt("Create a spooky gaming stream where my character reacts dramatically whenever someone follows.")}>👻 Spooky gaming stream <b>→</b></button><button onClick={() => setPrompt("Create a futuristic space battle stream with interactive audience events and neon effects.")}>🚀 Interactive space battle <b>→</b></button><button onClick={() => setPrompt("Create a cyberpunk livestream with animated alerts, particles and a reactive character.")}>⚡ Neon cyberpunk <b>→</b></button></div>
          </div>
          <div className="composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe your livestream idea..."/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button type="button" onClick={() => fileInputRef.current?.click()}>＋ Upload</button><button type="button" onClick={generateAsset}>{assetBusy ? "Generating…" : "◈ Generate asset"}</button><button className="send" type="button" onClick={build}>{building ? "Building…" : "Build experience →"}</button></div>{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</div>
        </section>
        <section className="preview-panel"><div className="preview-head"><div><small>LIVE PREVIEW</small><h2>{building ? "Building your experience…" : "Your experience will appear here"}</h2></div></div><div className="stage"><div className="stage-scan"/><div className="stage-content"><div className="stage-live">● AI BUILD PIPELINE</div><div className="stage-title">YOUR<br/><span>LIVESTREAM</span></div><p>{building ? "Creating project state, host controls and overlay runtime." : "Start with an idea. The finished project becomes editable and publishable."}</p></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div></section>
        <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT ASSETS</small><h2>Assets</h2></div><button type="button" onClick={() => fileInputRef.current?.click()}>＋</button></div><div className="upload-box" onClick={() => fileInputRef.current?.click()}><div>↑</div><strong>Drop assets here</strong><span>Images, video, audio, logos</span></div>{assets.length>0 ? <div className="asset-empty">{assets.map((asset) => <div key={asset.name}>{asset.name} · {asset.type}</div>)}</div> : <div className="asset-empty">Your uploaded and generated assets will appear here.</div>}</aside>
      </div>
    </main>
  );
}
