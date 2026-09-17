"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";
import { createProject, loadProjects, ProjectAsset, saveProjects } from "../../../lib/project";
import { storeGeneratedAsset } from "../../../lib/asset-store";
import { waitForGeneratedVideo } from "../../../lib/video-generation";
import MediaEditor from "../../../components/MediaEditor";

const GENERATORS = [
  { type: "image", label: "Image", icon: "▣" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "voice", label: "Voice", icon: "◖" },
  { type: "music", label: "Music", icon: "♫" },
] as const;

type GeneratorType = (typeof GENERATORS)[number]["type"];

function isImage(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("image") || asset.name.toLowerCase().startsWith("image")));
}

function isVideo(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("video") || asset.name.toLowerCase().startsWith("video")));
}

function isAudio(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("audio") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music")));
}

export default function NewProject() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);

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

  async function generateAsset(type: GeneratorType) {
    if (type === "music") {
      setShowGenerator(false);
      setAssetStatus("Music generation is disabled until the self-hosted ACE-Step server is connected.");
      return;
    }
    const requested = window.prompt(`Describe the ${type} you want to generate`, prompt.trim() || `A neon futuristic ${type} for a TikTok LIVE experience`);
    if (!requested?.trim() || assetBusy) return;
    setShowGenerator(false);
    setAssetBusy(true);
    setAssetStatus(`Generating ${type}…`);
    try {
      const response = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: requested.trim(), type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${type} generation failed.`);

      let url = data.url || data.audio_url || data.audioUrl || data.output_url || "";
      if (type === "video" && data.videoId) {
        setAssetStatus("Video accepted. Generating frames… 0%");
        url = await waitForGeneratedVideo(data.videoId, data.model || "agnes-video-2.5-flash", progress => setAssetStatus(`Generating video… ${Math.round(progress)}%`));
      }
      if (!url) throw new Error(`${type} generation returned no asset output.`);

      const name = `${type[0].toUpperCase()}${type.slice(1)} ${assets.length + 1}`;
      let asset: ProjectAsset = { name, type: data.model || type, url };
      try {
        asset = await storeGeneratedAsset(`new-project-${Date.now()}`, asset);
      } catch {
        // Keep the direct URL as a fallback if browser storage cannot cache the generated result.
      }
      setAssets((current) => [...current, asset]);
      setAssetStatus(`${name} generated`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : `${type} generation failed.`);
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

  function renderAsset(asset: ProjectAsset, index: number) {
    if (!asset.url) return null;
    if (isImage(asset)) return <div className="editable-media-preview" style={asset.edits?.crop && asset.edits.crop !== "original" ? { aspectRatio: asset.edits.crop === "square" ? "1 / 1" : asset.edits.crop === "portrait" ? "9 / 16" : "16 / 9" } : undefined}><img src={asset.url} alt={asset.name} className="asset-thumb" style={{ objectFit: asset.edits?.crop === "original" ? "contain" : "cover" }} /><button type="button" className="media-edit-btn" onClick={() => setEditingAssetIndex(index)}>Edit / Crop</button></div>;
    if (isVideo(asset)) return <div className="editable-media-preview"><video src={asset.url} className="asset-thumb" controls preload="metadata" /><button type="button" className="media-edit-btn" onClick={() => setEditingAssetIndex(index)}>Edit / Crop / Trim</button></div>;
    if (isAudio(asset)) return <audio src={asset.url} controls />;
    return null;
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
          <div className="composer">
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe your livestream idea..."/>
            <div className="composer-bottom">
              <input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/>
              <button type="button" onClick={() => fileInputRef.current?.click()}>＋ Upload</button>
              <button type="button" onClick={() => setShowGenerator(v => !v)}>{assetBusy ? "Generating…" : "◈ Generate asset"}</button>
              <button className="send" type="button" onClick={build}>{building ? "Building…" : "Build experience →"}</button>
            </div>
            {showGenerator && <div className="idea-card"><span>GENERATE WITH AI</span>{GENERATORS.map((item) => <button key={item.type} type="button" onClick={() => generateAsset(item.type)}>{item.icon} {item.label} <b>→</b></button>)}</div>}
            {assetStatus&&<div className="asset-empty">{assetStatus}</div>}
          </div>
        </section>
        <section className="preview-panel"><div className="preview-head"><div><small>LIVE PREVIEW</small><h2>{building ? "Building your experience…" : "Your experience will appear here"}</h2></div></div><div className="stage"><div className="stage-scan"/><div className="stage-content"><div className="stage-live">● AI BUILD PIPELINE</div><div className="stage-title">YOUR<br/><span>LIVESTREAM</span></div><p>{building ? "Creating project state, host controls and overlay runtime." : "Start with an idea. The finished project becomes editable and publishable."}</p></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></div></section>
        <aside className="assets-panel"><div className="assets-head"><div><small>PROJECT ASSETS</small><h2>Assets</h2></div><button type="button" onClick={() => fileInputRef.current?.click()}>＋</button></div><div className="upload-box" onClick={() => fileInputRef.current?.click()}><div>↑</div><strong>Drop assets here</strong><span>Images, video, audio, logos</span></div>{assets.length>0 ? <div className="asset-empty">{assets.map((asset, index) => <div className="asset-card" key={asset.name + index}><div className="asset-card-title"><b>{asset.name}</b><em>{asset.type}</em></div>{renderAsset(asset,index)}</div>)}</div> : <div className="asset-empty">Your uploaded and generated assets will appear here.</div>}</aside>
      </div>
      {editingAssetIndex !== null && assets[editingAssetIndex] && <MediaEditor asset={assets[editingAssetIndex]} onClose={() => setEditingAssetIndex(null)} onSave={next => setAssets(current => current.map((asset, index) => index === editingAssetIndex ? next : asset))} />}
    </main>
  );
}
