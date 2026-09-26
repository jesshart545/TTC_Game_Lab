"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";
import { createProject, Project, ProjectAsset, saveProjectToServer } from "../../../lib/project";
import { hydrateAsset, storeGeneratedAsset, storeUploadedAsset } from "../../../lib/asset-store";
import { waitForGeneratedVideo } from "../../../lib/video-generation";
import MediaEditor from "../../../components/MediaEditor";

const GENERATORS = [
  { type: "image", label: "Image · Nano Banana 2", icon: "▣" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "voice", label: "Voice", icon: "◖" },
  { type: "music", label: "Music", icon: "♫" },
  { type: "sfx", label: "Sound Effect", icon: "✦" },
] as const;

type GeneratorType = (typeof GENERATORS)[number]["type"];

function isImage(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("image") || asset.name.toLowerCase().startsWith("image")));
}

function isVideo(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("video") || asset.name.toLowerCase().startsWith("video")));
}

function isAudio(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("audio") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music") || asset.name.toLowerCase().startsWith("sfx")));
}

export default function NewProject() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [titleSaved, setTitleSaved] = useState(false);
  const draftProjectRef = useRef<Project | null>(null);
  function ensureDraftProject() {
    if (!draftProjectRef.current) draftProjectRef.current = createProject(prompt.trim() || "Untitled TikTok LIVE experience");
    return draftProjectRef.current;
  }
  const [building, setBuilding] = useState(false);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const draft = ensureDraftProject();
    setAssetStatus(files.length === 1 ? `Uploading ${files[0].name}…` : `Uploading ${files.length} files…`);
    try {
      const uploaded = await Promise.all(files.map(file => storeUploadedAsset(draft.id, file)));
      setAssets(current => [...current, ...uploaded]);
      setAssetStatus(uploaded.length === 1 ? `${uploaded[0].name} added` : `${uploaded.length} files added`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function generateAsset(type: GeneratorType) {
    if (assetBusy) return;
    let promptImage = "";
    if (type === "video") {
      const imageAssets = assets.filter(asset => {
        const typeName = (asset.type || "").toLowerCase();
        const name = (asset.name || "").toLowerCase();
        const url = (asset.url || "").toLowerCase().split("?")[0];
        return typeName.includes("image") || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(name) || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(url) || name.startsWith("image");
      });
      const images = (await Promise.all(imageAssets.map(async asset => {
        try { return await hydrateAsset(asset); } catch { return asset; }
      }))).filter(asset => Boolean(asset.url));
      if (images.length) {
        const choices = images.map((asset, index) => `${index + 1}. ${asset.name}`).join("\n");
        const selected = window.prompt(
          `Choose an image to use as the video's starting/reference frame.\n\n${choices}\n\nEnter its number, or leave blank for text-to-video.`,
          images.length === 1 ? "1" : "",
        );
        if (selected === null) return;
        if (selected.trim()) {
          const index = Number.parseInt(selected.trim(), 10) - 1;
          if (!Number.isInteger(index) || index < 0 || index >= images.length) {
            setAssetStatus("Choose a valid image number.");
            return;
          }
          promptImage = images[index].url || "";
        }
      }
    }
    const requested = window.prompt(`Describe the ${type} you want to generate`, prompt.trim() || `A neon futuristic ${type} for a TikTok LIVE experience`);
    if (!requested?.trim()) return;
    setShowGenerator(false);
    setAssetBusy(true);
    setAssetStatus(type === "video" && promptImage ? "Generating video from reference image…" : `Generating ${type}…`);
    try {
      const response = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: requested.trim(), type, ...(promptImage ? { promptImage } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${type} generation failed.`);

      let url = data.url || data.audio_url || data.audioUrl || data.output_url || "";
      if (type === "music" && data.requestId) {
        setAssetStatus("Music queued with fal.ai. Waiting for the finished song…");
        let completed = false;
        for (let attempt = 0; attempt < 300; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const statusResponse = await fetch(`/api/generate-asset/music-status?id=${encodeURIComponent(String(data.requestId))}&statusUrl=${encodeURIComponent(data.statusUrl || "")}&responseUrl=${encodeURIComponent(data.responseUrl || "")}`, { cache: "no-store" });
          const statusData = await statusResponse.json().catch(() => ({}));
          if (!statusResponse.ok) throw new Error(typeof statusData.error === "string" ? statusData.error : "Unable to check music generation status.");
          if (statusData.status === "failed") throw new Error(statusData.error || "Music generation failed.");
          if (statusData.status === "completed" && statusData.url) {
            url = String(statusData.url);
            completed = true;
            break;
          }
          if (attempt % 10 === 0) setAssetStatus(statusData.queuePosition != null ? `Music queued: ${statusData.queuePosition} ahead…` : "Music is still generating…");
        }
        if (!completed) throw new Error("Music is still processing on fal.ai. The request may complete later; please avoid submitting duplicate generations.");
      }
      if (type === "video" && data.videoId) {
        setAssetStatus("Video accepted. Generating frames… 0%");
        url = await waitForGeneratedVideo(data.videoId, data.model || "agnes-video-2.5-flash", progress => setAssetStatus(`Generating video… ${Math.round(progress)}%`));
      }
      if (!url) throw new Error(`${type} generation returned no asset output.`);

      const name = `${type[0].toUpperCase()}${type.slice(1)} ${assets.length + 1}`;
      const generatedAsset = { name, type: data.model || type, url };
      let asset: ProjectAsset = generatedAsset;
      try {
        asset = await storeGeneratedAsset(ensureDraftProject().id, generatedAsset);
      } catch {}
      setAssets(current => [...current, asset]);
      setAssetStatus(`${name} generated`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : `${type} generation failed.`);
    } finally {
      setAssetBusy(false);
    }
  }

  async function saveTitle() {
    const name = projectTitle.trim();
    if (!name) { setAssetStatus("Enter a project title first."); return; }
    const draft = ensureDraftProject();
    const next: Project = { ...draft, name, updatedAt: "just now" };
    draftProjectRef.current = next;
    try { await saveProjectToServer(next); setTitleSaved(true); setAssetStatus("Project title saved."); }
    catch (error) { setTitleSaved(false); setAssetStatus(error instanceof Error ? error.message : "Project title could not be saved."); }
  }

  async function build() {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    const existing = draftProjectRef.current;
    const generated = createProject(prompt.trim());
    const chosenName = projectTitle.trim();
    const project: Project = existing
      ? { ...generated, id: existing.id, slug: existing.slug, name: chosenName || generated.name, assets }
      : { ...generated, name: chosenName || generated.name, assets };
    draftProjectRef.current = project;
    try {
      await saveProjectToServer(project);
      router.push(`/project/${project.id}`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "Project could not be saved.");
      setBuilding(false);
    }
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
      <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">New Project <span>Draft</span></div><div className="save-state">● Saved to project storage</div></header>
      <div className="workspace-grid">
        <section className="chat-panel">
          <div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Let&apos;s build your LIVE.</h1></div><div className="ai-orb">✦</div></div>
          <div className="messages">
            <div className="message ai"><div className="message-icon">✦</div><div><strong>TTCGameLab AI</strong><p>Tell me what you want your TikTok LIVE experience to feel like. You can describe the idea, upload assets, or just give me a rough concept. I&apos;ll turn it into a working dashboard, overlay, interactions, and visuals.</p></div></div>
            <div className="idea-card"><span>QUICK START</span><button onClick={() => setPrompt("Create a spooky gaming stream where my character reacts dramatically whenever someone follows.")}>👻 Spooky gaming stream <b>→</b></button><button onClick={() => setPrompt("Create a futuristic space battle stream with interactive audience events and neon effects.")}>🚀 Interactive space battle <b>→</b></button><button onClick={() => setPrompt("Create a cyberpunk livestream with animated alerts, particles and a reactive character.")}>⚡ Neon cyberpunk <b>→</b></button></div>
          </div>
          <div className="composer">
            <label htmlFor="new-project-title" style={{ display: "block", marginBottom: 10, fontWeight: 600 }}>Project title</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}><input id="new-project-title" type="text" maxLength={100} value={projectTitle} onChange={event => { setProjectTitle(event.target.value); setTitleSaved(false); }} placeholder="Name your project" style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid #3ddde6", background: "#111827", color: "#fff", fontSize: 15 }} /><button type="button" onClick={saveTitle} disabled={!projectTitle.trim() || titleSaved} className="publish-btn">{titleSaved ? "✓ Saved" : "Save title"}</button></div>
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
