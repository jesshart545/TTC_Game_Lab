"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createProject, deleteProject, loadProjects, Project, ProjectAsset, replaceProjectAssets, saveProjects, saveProjectToServer, loadProjectFromServer, GameTool, GameToolType } from "../../../lib/project";
import { deleteProjectStoredAssets, deleteStoredAsset, hydrateAsset, hydrateProjectAssets, storeGeneratedAsset, storeUploadedAsset } from "../../../lib/asset-store";
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

function assetEditStyle(asset: ProjectAsset) {
  const e=asset.edits||{};
  return { transform:`translate(${e.offsetX||0}px,${e.offsetY||0}px) scale(${e.zoom||1}) rotate(${e.rotation||0}deg) scaleX(${e.flipX?-1:1}) scaleY(${e.flipY?-1:1})`, opacity:e.opacity??1, filter:`brightness(${e.brightness??100}%) contrast(${e.contrast??100}%) saturate(${e.saturation??100}%) blur(${e.blur??0}px)` };
}


export default function ProjectWorkspace() {
  const params = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [draft, setDraft] = useState("");
  const [renamingProject, setRenamingProject] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");
  const [triviaConfig, setTriviaConfig] = useState<any>(null);
  const [triviaBusy, setTriviaBusy] = useState(false);
  const [triviaTopics, setTriviaTopics] = useState<string[]>([]);
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = loadProjects();
      let found = all.find(p => p.id === params.id) || all[0];
      try { found = (await loadProjectFromServer(params.id)) || found; } catch {}
      if (!found) return;
      let hydrated = found;
      try {
        hydrated = await hydrateProjectAssets(found);
      } catch {
        hydrated = found;
      }
      if (cancelled) return;
      setProject(hydrated);
      const tool = (found.gameTools || []).find(t => t.name === "Trivia Board");
      setTriviaConfig(tool?.config || null);
      setTriviaTopics(Array.isArray(tool?.config?.categories) ? tool.config.categories.map((c:any)=>String(c.name)) : []);
    })();
    return () => { cancelled = true; };
  }, [params.id]);
  const projectUrl = useMemo(() => project ? `/published/${project.slug}` : "", [project]);

  const TOOL_LIBRARY: { type: GameToolType; name: string; description: string }[] = [
    { type:"trivia-board", name:"Trivia Board", description:"Jeopardy-style 5×5 board with host-selected questions." },
    { type:"wheel", name:"Game Wheel", description:"Spin configurable segments on the live overlay." },
    { type:"random-picker", name:"Random Picker", description:"Pick one name or item from a list." },
    { type:"countdown", name:"Countdown", description:"Show a host-triggered countdown timer." },
    { type:"poll", name:"Live Poll", description:"Show choices and a live audience poll." },
    { type:"dice", name:"Dice Roll", description:"Roll animated dice for a quick game." },
  ];
  const TRIVIA_CONFIG = { categories: [] as any[] };
  function triggerTriviaQuestion(categoryIndex:number, questionIndex:number) {
    if (!project) return;
    const config = triviaConfig || TRIVIA_CONFIG;
    const category = config.categories[categoryIndex];
    const question = category.questions[questionIndex];
    if (question.used) return;
    const nextConfig = {
      ...config,
      categories: config.categories.map((c:any, ci:number) =>
        ci === categoryIndex
          ? { ...c, questions: c.questions.map((q:any, qi:number) => qi === questionIndex ? { ...q, used:true } : q) }
          : c
      )
    };
    setTriviaConfig(nextConfig);
    const latest = loadProjects().find(p => p.id === project.id) || project;
    const trivia = (latest.gameTools || []).find(t => t.name === "Trivia Board");
    if (trivia) {
      persist({
        ...latest,
        gameTools: (latest.gameTools || []).map(t => t.id === trivia.id ? { ...t, config: nextConfig } : t),
        updatedAt: "just now"
      });
    }
    const channel = new BroadcastChannel(`ttc-project-${project.id}`);
    channel.postMessage({ type:"TRIVIA_QUESTION", category:category.name, value:question.value, prompt:question.prompt, answer:question.answer, source:question.source, sourceUrl:question.sourceUrl });
    channel.close();
    setEventLog(v => [`${category.name} ${question.value} → question shown and consumed`, ...v].slice(0,4));
  }

  function revealTriviaAnswer(categoryIndex:number, questionIndex:number) {
    if (!project) return;
    const config = triviaConfig || TRIVIA_CONFIG;
    const category = config.categories[categoryIndex];
    const question = category.questions[questionIndex];
    const channel = new BroadcastChannel(`ttc-project-${project.id}`);
    channel.postMessage({ type:"TRIVIA_ANSWER", category:category.name, value:question.value, prompt:question.prompt, answer:question.answer, source:question.source, sourceUrl:question.sourceUrl });
    channel.close();
    setEventLog(v => [`${category.name} ${question.value} → answer revealed`, ...v].slice(0,4));
  }

  function closeTriviaQuestion() {
    if (!project) return;
    const channel = new BroadcastChannel(`ttc-project-${project.id}`);
    channel.postMessage({ type:"TRIVIA_CLOSE" });
    channel.close();
    setEventLog(v => ["Trivia clue closed", ...v].slice(0,4));
  }

  async function regenerateTrivia(mode:"generate"|"source", categoryName?:string) {
    if (!project || triviaBusy) return;
    setTriviaBusy(true); setAssetStatus(categoryName ? `Finding sourced ${categoryName} questions…` : "Finding sourced trivia…");
    try {
      const current = triviaConfig || TRIVIA_CONFIG;
      const categories = triviaTopics.length===5 ? triviaTopics : current.categories.map((c:any)=>c.name);
      const response = await fetch("/api/trivia",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,categories,category:categoryName || ""})});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Trivia generation failed.");
      const nextConfig = categoryName
        ? { ...current, categories: current.categories.map((c:any)=> data.categories?.[0]?.name===c.name ? data.categories[0] : c) }
        : { categories: data.categories || current.categories };
      const latest = loadProjects().find(p=>p.id===project.id) || project;
      const tools = latest.gameTools || [];
      const trivia = tools.find(t=>t.name==="Trivia Board");
      if(trivia) {
        const updatedTool = { ...trivia, config:nextConfig };
        persist({ ...latest, gameTools:tools.map(t=>t.id===trivia.id?updatedTool:t), updatedAt:"just now" });
      }
      setTriviaConfig(nextConfig);
      setAssetStatus(categoryName ? `${categoryName} regenerated.` : "Trivia board regenerated.");
    } catch(error) {
      setAssetStatus(error instanceof Error ? error.message : "Trivia generation failed.");
    } finally { setTriviaBusy(false); }
  }

  function addGameTool(type: GameToolType) {
    if (!project) return;
    const latest = loadProjects().find(p=>p.id===project.id) || project;
    const existing = latest.gameTools || [];
    if (existing.some(t=>t.type===type && t.enabled)) { setAssetStatus("That game tool is already added."); return; }
    const info = TOOL_LIBRARY.find(t=>t.type===type)!;
    const tool: GameTool = { id: `${type}-${Date.now()}`, type, name: info.name, enabled:true, config: info.name==="Trivia Board" ? TRIVIA_CONFIG : type==="wheel" ? { title:"Game Wheel", segments:["Prize","Challenge","Bonus","Mystery"] } : type==="random-picker" ? { items:["Player 1","Player 2","Player 3"] } : type==="countdown" ? { seconds:10 } : type==="trivia-board" ? TRIVIA_CONFIG : type==="poll" ? { question:"Choose what happens next", options:["Option A","Option B"] } : { sides:6 } };
    const next = { ...latest, gameTools:[...existing,tool], updatedAt:"just now" };
    if (type==="wheel") next.wheel = { ...(latest.wheel || { enabled:false,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false }), enabled:true, visible:false };
    persist(next); setAssetStatus(`${info.name} added to your game tools.`);
  }
  function triggerGameTool(tool: GameTool) {
    if (!project) return;
    const channel = new BroadcastChannel(`ttc-project-${project.id}`);
    channel.postMessage({ type:"GAME_TOOL_TRIGGER", tool });
    channel.close();
    setEventLog(v => [`${tool.name} → triggered on overlay`, ...v].slice(0,4));
  }

  function enableWheel() { if (!project) return; const wheel = project.wheel || { enabled:false,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false }; const next = { ...project, wheel: { ...wheel, enabled: true, visible: false }, controls: project.controls.some(c => c.action === "wheel.spin") ? project.controls : [...project.controls, { id:"wheel", label:"SPIN WHEEL", action:"wheel.spin", detail:"Show and spin the game wheel on the live overlay" }], updatedAt:"just now" }; persist(next); setAssetStatus("Game wheel added. It stays hidden until the host triggers it."); }

  function updateWheelField(field: "title" | "segments", value: string) { if (!project) return; const wheel = project.wheel || { enabled:true,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false }; persist({ ...project, wheel: { ...wheel, [field]: field === "segments" ? value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12) : value }, updatedAt:"just now" }); }

  function spinWheel() { if (!project?.wheel?.enabled || project.wheel.segments.length < 2) return; const latest = loadProjects().find(p=>p.id===project.id) || project; persist({ ...latest, wheel: { ...latest.wheel, spinning: true, visible: true }, updatedAt:"just now" }); const channel = new BroadcastChannel(`ttc-project-${project.id}`); channel.postMessage({ type:"WHEEL_SPIN", at:Date.now() }); channel.close(); setTimeout(()=>{ const current=loadProjects().find(p=>p.id===project.id); if(current) persist({ ...current, wheel:{...current.wheel, spinning:false, visible:false}, updatedAt:"just now" }); }, 3200); }

  function persist(next: Project) {
    const storedNext: Project = {
      ...next,
      assets: next.assets.map(asset => asset.storageKey?.startsWith("projects/") ? asset : asset.storageKey ? { ...asset, url: undefined } : asset),
    };
    const all = loadProjects();
    saveProjects(all.some(p => p.id === storedNext.id) ? all.map(p => p.id === storedNext.id ? storedNext : p) : [storedNext, ...all]);
    setProject(next);
    void saveProjectToServer(storedNext).catch(() => {});
  }

  function saveProjectTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    const name = projectTitleDraft.trim();
    if (!name) { setAssetStatus("Project title cannot be empty."); return; }
    if (name.length > 100) { setAssetStatus("Project title must be 100 characters or fewer."); return; }
    persist({ ...project, name, updatedAt: "just now" });
    setRenamingProject(false);
    setAssetStatus("Project title updated.");
  }

  async function handleDeleteProject() {
    if (!project) return;
    const confirmed = window.confirm(`Delete "${project.name}"? This will permanently remove the project and its saved assets from this browser.`);
    if (!confirmed) return;
    try { await deleteProjectStoredAssets(project.id); } catch {}
    deleteProject(project.id);
    window.location.href = "/projects";
  }

  async function handleDeleteAsset(asset: ProjectAsset) {
    if (!project) return;
    const confirmed = window.confirm(`Delete "${asset.name}" from this project?`);
    if (!confirmed) return;
    if (asset.storageKey) {
      try { await deleteStoredAsset(asset.storageKey); } catch {}
    }
    const current = loadProjects().find(item => item.id === project.id) || project;
    const index = current.assets.findIndex(item =>
      asset.storageKey ? item.storageKey === asset.storageKey : item.name === asset.name && item.type === asset.type
    );
    if (index < 0) return;
    const nextAssets = current.assets.filter((_, i) => i !== index);
    replaceProjectAssets(project.id, nextAssets);
    setProject(await hydrateProjectAssets({ ...current, assets: nextAssets }));
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!project) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setAssetStatus(files.length === 1 ? `Uploading ${files[0].name}…` : `Uploading ${files.length} files…`);
    try {
      const uploaded = await Promise.all(files.map(file => storeUploadedAsset(project.id, file)));
      const hydratedUploaded = await Promise.all(uploaded.map(asset => hydrateAsset(asset)));
      const latest = loadProjects().find(p => p.id === project.id) || project;
      persist({ ...latest, assets: [...latest.assets, ...hydratedUploaded], updatedAt: "just now" });
      setAssetStatus(uploaded.length === 1 ? `${uploaded[0].name} added` : `${uploaded.length} files added`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "The file could not be added.");
    } finally {
      event.target.value = "";
    }
  }

  async function generateAsset(type: GeneratorType) {
    if (!project || assetBusy) return;
    const requested = window.prompt(`Describe the ${type} you want to generate`, project.prompt || `A neon futuristic ${type} for this TikTok LIVE experience`);
    if (!requested?.trim()) return;
    setShowGenerator(false);
    setAssetBusy(true);
    setAssetStatus(`Generating ${type}…`);

    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: requested.trim(), type }),
      });
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
        url = await waitForGeneratedVideo(
          String(data.videoId),
          data.model || "agnes-video-2.5-flash",
          progress => setAssetStatus(`Generating video… ${Math.round(progress)}%`),
        );
      }
      if (!url) throw new Error(`${type} generation returned no asset output.`);

      const latest = loadProjects().find(p => p.id === project.id) || project;
      const name = `${type[0].toUpperCase()}${type.slice(1)} ${latest.assets.length + 1}`;
      const generatedAsset = { name, type: data.model || type, url };

      let asset: ProjectAsset = generatedAsset;
      try {
        asset = await storeGeneratedAsset(project.id, generatedAsset);
      } catch {
        // Keep the direct URL as a fallback if browser storage cannot cache the generated result.
      }

      persist({
        ...latest,
        assets: [...latest.assets, asset],
        updatedAt: "just now",
      });
      setAssetStatus(`${name} generated and saved`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : `${type} generation failed.`);
    } finally {
      setAssetBusy(false);
    }
  }

  function toggleAssetInProject(index: number) {
    if (!project) return;
    const asset = project.assets[index];
    const adding = !asset.inProject;
    const role: ProjectAsset["role"] = isImage(asset) ? (project.assets.some(a => a.inProject && a.role === "background") ? "layer" : "background") : isVideo(asset) ? "video" : "audio";
    const nextAssets = project.assets.map((item, i) => i === index ? { ...item, inProject: adding, role: adding ? role : item.role } : item);
    persist({ ...project, assets: nextAssets, updatedAt: "just now" });
    setAssetStatus(adding ? asset.name + " added to the live project." : asset.name + " removed from the live project.");
  }

  function saveAssetEdits(index: number, nextAsset: ProjectAsset) {
    if (!project) return;
    const nextAssets = project.assets.map((asset, assetIndex) => assetIndex === index ? nextAsset : asset);
    persist({ ...project, assets: nextAssets, updatedAt: "just now" });
  }

  async function saveAssetAsNew(nextAsset: ProjectAsset) {
    if (!project || !nextAsset.url) return;
    if (isVideo(nextAsset)) {
      const start=Math.max(0,nextAsset.edits?.trimStart||0);
      const source=document.createElement("video");
      source.crossOrigin="anonymous"; source.preload="auto"; source.src=nextAsset.url;
      setAssetStatus("Preparing trimmed video…");
      await new Promise<void>((resolve,reject)=>{source.onloadedmetadata=()=>resolve();source.onerror=()=>reject(new Error("Could not load video for trimming."));});
      const end=Math.min(nextAsset.edits?.trimEnd||source.duration,source.duration);
      if(!Number.isFinite(end)||end<=start+.05) throw new Error("Choose a valid video trim range.");
      const capture=(source as HTMLVideoElement & {captureStream?:()=>MediaStream}).captureStream;
      if(!capture||typeof MediaRecorder==="undefined") throw new Error("Video trimming requires a browser with MediaRecorder support.");
      source.currentTime=start;
      await new Promise<void>(resolve=>{if(Math.abs(source.currentTime-start)<.05)return resolve();source.onseeked=()=>resolve();});
      const stream=capture.call(source);
      const preferred=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(t=>MediaRecorder.isTypeSupported(t))||"";
      const recorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
      const chunks:BlobPart[]=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      const finished=new Promise<Blob>((resolve,reject)=>{recorder.onerror=()=>reject(new Error("Video trim recording failed."));recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||"video/webm"}));});
      recorder.start(250); await source.play();
      setAssetStatus(`Trimming video from ${start.toFixed(1)}s to ${end.toFixed(1)}s…`);
      await new Promise<void>(resolve=>{const watch=()=>{if(source.currentTime>=end||source.ended){source.pause();resolve();return}requestAnimationFrame(watch)};watch()});
      recorder.stop(); const blob=await finished; stream.getTracks().forEach(track=>track.stop());
      const file=new File([blob],(nextAsset.name.replace(/\.[^.]+$/,"")||"trimmed-video")+"-trimmed.webm",{type:blob.type||"video/webm"});
      const stored=await storeUploadedAsset(project.id,file);
      const latest=loadProjects().find(p=>p.id===project.id)||project;
      persist({...latest,assets:[...latest.assets,{...stored,name:file.name,edits:undefined}],updatedAt:"just now"});
      setAssetStatus(file.name+" saved as a new permanent video asset.");
      return;
    }
    setAssetStatus("Rendering edited image…");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = nextAsset.url;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not load image for editing.")); });
    const e = nextAsset.edits || {};
    const ratio = e.crop === "square" ? 1 : e.crop === "portrait" ? 9/16 : e.crop === "landscape" ? 16/9 : image.naturalWidth/image.naturalHeight;
    let w = e.width || image.naturalWidth;
    let h = e.height || Math.round(w / ratio);
    if (e.height && !e.width) w = Math.round(h * ratio);
    w = Math.max(1, Math.min(4096, w)); h = Math.max(1, Math.min(4096, h));
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image renderer is unavailable.");
    ctx.clearRect(0,0,w,h); ctx.globalAlpha = e.opacity ?? 1;
    ctx.filter = `brightness(${e.brightness ?? 100}%) contrast(${e.contrast ?? 100}%) saturate(${e.saturation ?? 100}%) blur(${e.blur ?? 0}px)`;
    ctx.translate(w/2 + (e.offsetX || 0), h/2 + (e.offsetY || 0));
    ctx.rotate((e.rotation || 0) * Math.PI / 180);
    ctx.scale((e.flipX ? -1 : 1) * (e.zoom || 1), (e.flipY ? -1 : 1) * (e.zoom || 1));
    const scale = e.crop && e.crop !== "original" ? Math.max(w/image.naturalWidth,h/image.naturalHeight) : Math.min(w/image.naturalWidth,h/image.naturalHeight);
    ctx.drawImage(image,-image.naturalWidth*scale/2,-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale);
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not render edited image.")),"image/png",.95));
    const file = new File([blob], (nextAsset.name.replace(/\.[^.]+$/,"") || "edited-image") + "-edited.png", { type:"image/png" });
    const stored = await storeUploadedAsset(project.id,file);
    const latest = loadProjects().find(p=>p.id===project.id) || project;
    persist({ ...latest, assets:[...latest.assets,{...stored,name:file.name}], updatedAt:"just now" });
    setAssetStatus(file.name + " saved as a new permanent asset.");
  }

  function renderAsset(asset: ProjectAsset, index: number) {
    if (!asset.url) return null;
    const cropStyle = asset.edits?.crop && asset.edits.crop !== "original"
      ? { aspectRatio: asset.edits.crop === "square" ? "1 / 1" : asset.edits.crop === "portrait" ? "9 / 16" : "16 / 9" }
      : undefined;
    if (isImage(asset)) return <div className="editable-media-preview" style={cropStyle}><img src={asset.url} alt={asset.name} className="asset-thumb" style={{ objectFit: asset.edits?.crop === "original" ? "contain" : "cover" }} /><button type="button" className="media-edit-btn" onClick={() => setEditingAssetIndex(index)}>Edit / Crop</button></div>;
    if (isVideo(asset)) return <div className="editable-media-preview" style={cropStyle}><video src={asset.url} className="asset-thumb" controls preload="metadata" /><button type="button" className="media-edit-btn" onClick={() => setEditingAssetIndex(index)}>Edit / Crop / Trim</button></div>;
    if (isAudio(asset)) return <audio src={asset.url} controls />;
    return null;
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!project || !draft.trim() || building) return;
    const text = draft.trim();
    const updated: Project = { ...project, updatedAt: "just now", messages: [...project.messages, { role: "user", text }] };
    setDraft(""); setBuilding(true);
    const wheelRequest = /game wheel|spin(ning)? wheel|wheel.*overlay|custom(ize|izable).*wheel/i.test(text);
    const triviaRequest = /jeopardy|jeapordy|trivia board|trivia game|trivia categories/i.test(text);
    if (triviaRequest) {
      const latest = loadProjects().find(p => p.id === project.id) || project;
      const existing = latest.gameTools || [];
      const trivia = existing.find(t => t.name === "Trivia Board");
      const tool: GameTool = trivia || { id:`trivia-${Date.now()}`, type:"trivia-board", name:"Trivia Board", enabled:true, config:TRIVIA_CONFIG };
      persist({ ...latest, gameTools:[...existing.filter(t=>t.name !== "Trivia Board"), tool], messages:[...latest.messages, {role:"user",text}, {role:"assistant",text:"Added a Jeopardy-style Trivia Board with five categories and five increasing-value questions per category. Pick any question from the dashboard to take over the live overlay."}], updatedAt:"just now" });
      setBuilding(false);
      return;
    }
    if (wheelRequest) {
      const latest = loadProjects().find(p => p.id === project.id) || project;
      const wheel = latest.wheel || { enabled:false,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false };
      const wheelProject: Project = { ...latest, updatedAt:"just now", wheel:{ ...wheel, enabled:true }, messages:[...latest.messages,{role:"user",text},{role:"assistant",text:"Added a customizable Game Wheel to the dashboard and live overlay. You can edit its title and segments in the dashboard, then spin it for viewers."}] };
      persist(wheelProject); setBuilding(false); return;
    }
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: updated.messages }) });
      const data = await response.json();
      const reply = response.ok && data.message ? data.message : "I updated the project context and prepared the requested change. Add your Agnes API key in Vercel to turn on live AI generation.";
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: reply }] });
    } catch {
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: "Your change is saved locally. The AI gateway is not reachable right now." }] });
    } finally { setBuilding(false); }
  }

  function trigger(control: Project["controls"][number]) { if (!project) return; if (control.action === "wheel.spin") { spinWheel(); return; } setEventLog(v => [`${control.label} → ${control.detail}`, ...v].slice(0, 4)); const channel = new BroadcastChannel(`ttc-project-${project.id}`); channel.postMessage({ type: "PROJECT_EVENT", action: control.action, at: Date.now() }); channel.close(); }
  function publish() {
    if (!project) return;
    const { publishedSnapshot: _previous, ...draft } = project;
    const snapshot = { ...draft, status: "Published" as const, updatedAt: "just now" };
    persist({ ...project, status: "Published", publishedSnapshot: snapshot, updatedAt: "just now" });
    setAssetStatus("Live overlay updated from this preview.");
  }
  function beginBlank() { const p = createProject("Create a new interactive TikTok LIVE experience"); saveProjects([p, ...loadProjects().filter(x => x.id !== p.id)]); window.location.href = `/project/${p.id}`; }

  if (!project) return <main className="loading-page"><div className="ai-orb">✦</div><h1>Loading your project...</h1></main>;
  return <main className="workspace-page">
    <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">{renamingProject ? <form onSubmit={saveProjectTitle} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input autoFocus aria-label="Project title" maxLength={100} value={projectTitleDraft} onChange={event => setProjectTitleDraft(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setRenamingProject(false); }} style={{ minWidth: 180, maxWidth: "35vw", padding: "8px 10px", borderRadius: 8, color: "#fff", background: "#172032", border: "1px solid #3ddde6" }}/><button type="submit">Save</button><button type="button" onClick={() => setRenamingProject(false)}>Cancel</button></form> : <>{project.name} <button type="button" aria-label="Rename project" title="Rename project" onClick={() => { setProjectTitleDraft(project.name); setRenamingProject(true); }} style={{ marginLeft: 8, cursor: "pointer" }}>✎ Rename</button></>} <span>{project.status}</span></div><div className="workspace-actions"><Link href={projectUrl} className="preview-link">Preview</Link><button onClick={publish} className="publish-btn">{project.publishedSnapshot ? "Update Live Overlay ↗" : "Publish Live Overlay ↗"}</button><button type="button" onClick={handleDeleteProject} className="danger-btn">Delete Project</button></div></header>
    <div className="workspace-grid">
      <section className="chat-panel"><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Keep building it.</h1></div><div className="ai-orb">✦</div></div><div className="messages">{project.messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="message-icon">{m.role === "assistant" ? "✦" : "YOU"}</div><div><strong>{m.role === "assistant" ? "TTCGameLab AI" : "You"}</strong><p>{m.text}</p></div></div>)}{building&&<div className="build-activity"><span>✦</span><div><strong>Building your change...</strong><small>Sending project context to the AI engine</small></div></div>}<div className="idea-card"><span>QUICK ACTIONS</span><button onClick={()=>setDraft("Make the main character bigger and move it slightly left.")}>Make character bigger <b>→</b></button><button onClick={()=>setDraft("Add a follower alert with a dramatic entrance animation.")}>Add follower alert <b>→</b></button><button onClick={()=>setDraft("Give the whole experience a stronger neon glow.")}>Increase neon <b>→</b></button></div></div><form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Tell me what to change..."/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button type="button" onClick={() => fileInputRef.current?.click()}>＋ Upload</button><button type="button" onClick={() => setShowGenerator(v => !v)}>{assetBusy ? "Generating…" : "◈ Generate asset"}</button><button className="send" type="submit">{building ? "Building…" : "Update experience →"}</button></div>{showGenerator&&<div className="idea-card"><span>GENERATE WITH AI</span>{GENERATORS.map((item)=><button key={item.type} type="button" onClick={()=>generateAsset(item.type)}>{item.icon} {item.label} <b>→</b></button>)}</div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
      <section className="preview-panel"><div className="preview-head"><div><small>FULL LIVESTREAM PREVIEW</small><h2>{project.name}</h2></div><span className="preview-mode-badge">DRAFT PREVIEW</span></div><div className="stage">{(() => { const selected = project.assets.filter(a => a.inProject && a.url); const bg = selected.find(a => a.role === "background"); const layers = selected.filter(a => a.role !== "background"); return <><div className="stage-scan"/>{bg && <img src={bg.url} alt={bg.name} className="builder-preview-background" style={assetEditStyle(bg)}/>}<div className="builder-preview-layers">{layers.map((a,i) => isVideo(a) ? <video key={(a.storageKey || a.name)+i} src={a.url} className="builder-preview-media" style={assetEditStyle(a)} autoPlay loop muted playsInline/> : isAudio(a) ? null : <img key={(a.storageKey || a.name)+i} src={a.url} alt={a.name} className="builder-preview-media" style={assetEditStyle(a)}/>)}</div><div className="overlay-demo"><div className="overlay-live">● PREVIEW</div><div className="overlay-headline">{project.overlay.title}</div><div className="overlay-sub">{project.overlay.subtitle}</div>{project.overlay.showCharacter&&<div className="demo-character">◉</div>}<div className="demo-alert">FOLLOW ALERT</div></div><div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></>; })()}</div><div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Events</span><span>{project.status} · {project.updatedAt}</span></div><div className="control-strip"><div><small>HOST CONTROLS</small><strong>Trigger your generated experience</strong></div><div className="control-buttons">{project.controls.map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div>{eventLog.length>0&&<div className="event-log">{eventLog.map((x,i)=><span key={i}>✓ {x}</span>)}</div>}</div></section>
      <aside className="assets-panel">
        <div className="assets-head">
          <div>
            <small>PROJECT</small>
            <h2>Details</h2>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>＋</button>
        </div>
        <div className="detail-block">
          <span>PROJECT URL</span>
          <code>{projectUrl}</code>
          <Link href={projectUrl}>Open project ↗</Link>
        </div>
        <div className="detail-block">
          <span>GAME TOOLS</span>
          <div className="tool-library">
            {TOOL_LIBRARY.map(tool => (
              <div className="tool-library-row" key={tool.type}>
                <div>
                  <b>{tool.name}</b>
                  <small>{tool.description}</small>
                </div>
                <button className="outline-btn" onClick={() => addGameTool(tool.type)}>＋ Add</button>
              </div>
            ))}
          </div>
          <div className="tool-config-list">
            {(project.gameTools || []).map(tool => (
              <div className="tool-config" key={tool.id}>
                <div>
                  <b>{tool.name}</b>
                  <em>{tool.type}</em>
                </div>
                <button className="outline-btn" onClick={() => triggerGameTool(tool)}>Trigger</button>
              </div>
            ))}
          </div>
          {(project.gameTools || []).some(t => t.name === "Trivia Board") && (
            <div className="trivia-dashboard">
              <strong>TRIVIA BOARD</strong>
              <small>Choose a question to fill the live overlay. Every question is source-backed; regenerate topics or questions whenever you want.</small>
              <div className="trivia-actions">
                <button className="outline-btn" disabled={triviaBusy} onClick={() => regenerateTrivia("generate")}>↻ Regenerate sourced board</button>
                <button className="outline-btn" disabled={triviaBusy} onClick={() => regenerateTrivia("source")}>↻ Refresh sources</button>
              </div>
              <div className="trivia-topic-editor">
                <small>TOPICS</small>
                {(triviaConfig || TRIVIA_CONFIG).categories.map((cat: any, i: number) => (
                  <input
                    key={i}
                    value={triviaTopics[i] ?? cat.name}
                    onChange={e => setTriviaTopics(v => v.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder={`Category ${i + 1}`}
                  />
                ))}
              </div>
              <div className="trivia-grid">
                {(triviaConfig || TRIVIA_CONFIG).categories.map((cat: any, ci: number) => (
                  <div className="trivia-column" key={cat.name}>
                    <div className="trivia-column-head">
                      <b>{cat.name}</b>
                      <button onClick={() => regenerateTrivia("generate", cat.name)} disabled={triviaBusy}>↻</button>
                    </div>
                    {cat.questions.map((q: any, qi: number) => (
                      <div className="trivia-cell" key={q.value}>
                        <button
                          className={q.used ? "trivia-used" : ""}
                          disabled={q.used}
                          onClick={() => triggerTriviaQuestion(ci, qi)}
                        >
                          {q.used ? "USED" : `${q.value}`}
                        </button>
                        {!q.used && (
                          <button className="trivia-reveal-btn" onClick={() => revealTriviaAnswer(ci, qi)}>
                            Reveal
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <button className="outline-btn" onClick={closeTriviaQuestion}>Close current clue</button>
            </div>
          )}
        </div>
        <div className="detail-block">
          <span>WHEEL SETTINGS</span>
          {project.wheel?.enabled ? (
            <>
              <input className="wheel-input" value={project.wheel.title} onChange={e => updateWheelField("title", e.target.value)} placeholder="Wheel title" />
              <input className="wheel-input" value={project.wheel.segments.join(", ")} onChange={e => updateWheelField("segments", e.target.value)} placeholder="Prize, Challenge, Bonus" />
              <button className="outline-btn" onClick={spinWheel}>↻ Trigger wheel</button>
            </>
          ) : (
            <p className="empty-note">Add the Game Wheel from the library when you need it.</p>
          )}
        </div>
        <div className="detail-block">
          <span>ASSETS</span>
          {project.assets.map((a, index) => (
            <div className="asset-card" key={(a.storageKey || a.name) + index}>
              <div className="asset-card-title">
                <div>
                  <b>{a.name}</b>
                  <em>{a.type}</em>
                </div>
                <button type="button" className="danger-btn asset-delete-btn" onClick={() => handleDeleteAsset(a)}>Delete</button>
              </div>
              {renderAsset(a, index)}
              <button type="button" className={a.inProject ? "outline-btn asset-project-btn active" : "outline-btn asset-project-btn"} onClick={() => toggleAssetInProject(index)}>{a.inProject ? "✓ Added to Project" : "+ Add to Project"}</button>
            </div>
          ))}
          {project.assets.length === 0 && (
            <p className="empty-note">No assets yet. Upload or generate them from the conversation.</p>
          )}
        </div>
        <div className="detail-block">
          <span>NEW PROJECT</span>
          <button className="outline-btn" onClick={beginBlank}>＋ Start fresh</button>
        </div>
      </aside>
    </div>
    {editingAssetIndex !== null && project.assets[editingAssetIndex] && <MediaEditor asset={project.assets[editingAssetIndex]} onClose={() => setEditingAssetIndex(null)} onSave={next => saveAssetEdits(editingAssetIndex, next)} onSaveAsNew={saveAssetAsNew} />}
  </main>;
}
