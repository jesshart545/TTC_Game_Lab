"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AssetComposition, createProject, deleteProject, Project, ProjectAsset, replaceProjectAssets, saveProjectToServer, loadProjectFromServer, GameTool, GameToolType } from "../../../lib/project";
import { deleteProjectStoredAssets, deleteStoredAsset, hydrateAsset, hydrateProjectAssets, storeGeneratedAsset, storeUploadedAsset } from "../../../lib/asset-store";
import { waitForGeneratedVideo } from "../../../lib/video-generation";
import MediaEditor from "../../../components/MediaEditor";
import AssetComposer from "../../../components/AssetComposer";
import CompositionPlayer, { defaultOverlayResult } from "../../../components/CompositionPlayer";
import { applyDraftChanges } from "../../../lib/draft-edit";

const GENERATORS = [
  { type: "image", label: "Image · Nano Banana 2", icon: "▣" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "voice", label: "Voice", icon: "◖" },
  { type: "music", label: "Music", icon: "♫" },
  { type: "sfx", label: "Sound Effect", icon: "✦" },
] as const;

type GeneratorType = (typeof GENERATORS)[number]["type"];

function isImage(asset: ProjectAsset) {
  if (!asset.url) return false;
  const type = (asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const url = asset.url.toLowerCase().split("?")[0];
  return type.includes("image")
    || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(name)
    || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(url)
    || name.startsWith("image");
}

function isVideo(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("video") || asset.name.toLowerCase().startsWith("video")));
}

function isAudio(asset: ProjectAsset) {
  return Boolean(asset.url && (asset.type.toLowerCase().includes("audio") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music") || asset.name.toLowerCase().startsWith("sfx")));
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
  const [chatDrawer, setChatDrawer] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hostKey, setHostKey] = useState("");
  const [dashboardLinkStatus, setDashboardLinkStatus] = useState("");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");
  const [triviaConfig, setTriviaConfig] = useState<any>(null);
  const [activeTrivia, setActiveTrivia] = useState<string | null>(null);
  const [triviaAnswerRevealed, setTriviaAnswerRevealed] = useState(false);
  const [triviaBusy, setTriviaBusy] = useState(false);
  const [triviaTopics, setTriviaTopics] = useState<string[]>([]);
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);
  const [showAssetComposer, setShowAssetComposer] = useState(false);
  const [editingComposition, setEditingComposition] = useState<AssetComposition | undefined>();
  const [previewMode, setPreviewMode] = useState<"overlay" | "dashboard">("overlay");
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<{ composition: AssetComposition; control: Project["controls"][number]; at: number } | null>(null);
  const [dragPlacement, setDragPlacement] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
  const placementPointer = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number; width: number; height: number; resize: boolean; stageWidth: number; stageHeight: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let found: Project | null = null;
      try { found = await loadProjectFromServer(params.id); } catch (error) { setAssetStatus(error instanceof Error ? error.message : "Could not load project."); }
      if (!found) return;
      let hydrated = found;
      try {
        hydrated = await hydrateProjectAssets(found);
      } catch {
        hydrated = found;
      }
      if (cancelled) return;
      setProject(hydrated);
      setHostKey(window.localStorage.getItem(`ttc-host-key-${found.id}`) || "");
      const tool = (found.gameTools || []).find(t => t.name === "Trivia Board");
      setTriviaConfig(tool?.config || null);
      setTriviaTopics(Array.isArray(tool?.config?.categories) ? tool.config.categories.map((c:any)=>String(c.name)) : []);
    })();
    return () => { cancelled = true; };
  }, [params.id]);
  const projectUrl = useMemo(() => project ? (process.env.NEXT_PUBLIC_PROJECT_BASE_DOMAIN ? `https://${project.slug}.${process.env.NEXT_PUBLIC_PROJECT_BASE_DOMAIN}` : `/published/${project.slug}`) : "", [project]);
  const privateDashboardUrl = projectUrl && hostKey ? `${projectUrl}?key=${encodeURIComponent(hostKey)}` : projectUrl;
  async function copyDashboardLink() {
    if (!hostKey) { setDashboardLinkStatus("Publish the project first to create its private dashboard link."); return; }
    const url = new URL(privateDashboardUrl, window.location.origin).toString();
    try { await navigator.clipboard.writeText(url); setDashboardLinkStatus("Private dashboard link copied. Send it to your phone or tablet."); }
    catch { window.prompt("Copy this private dashboard link for your phone or tablet:", url); }
  }

  const BOARD_LIBRARY: { type: GameToolType; name: string; description: string }[] = [
    { type:"trivia-board", name:"5×5 Trivia Board", description:"Start with a functional 5×5 board, then customize its content, visuals and interactive areas with chat." },
  ];
  const TOOL_LIBRARY: { type: GameToolType; name: string; description: string }[] = [
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
    setActiveTrivia(`${categoryIndex}:${questionIndex}`);
    setTriviaAnswerRevealed(false);
    const nextConfig = {
      ...config,
      categories: config.categories.map((c:any, ci:number) =>
        ci === categoryIndex
          ? { ...c, questions: c.questions.map((q:any, qi:number) => qi === questionIndex ? { ...q, used:true } : q) }
          : c
      )
    };
    setTriviaConfig(nextConfig);
    const latest = project;
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
    setTriviaAnswerRevealed(true);
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
    setActiveTrivia(null);
    setTriviaAnswerRevealed(false);
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
      const latest = project;
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

  async function addGameTool(type: GameToolType) {
    if (!project || triviaBusy) return;
    const latest = project;
    const existing = latest.gameTools || [];
    if (existing.some(t=>t.type===type && t.enabled)) { setAssetStatus("That template is already being customized in this project."); return; }
    const info = [...BOARD_LIBRARY, ...TOOL_LIBRARY].find(t=>t.type===type)!;
    const config = type==="wheel" ? { title:"Game Wheel", segments:["Prize","Challenge","Bonus","Mystery"] } : type==="random-picker" ? { items:["Player 1","Player 2","Player 3"] } : type==="countdown" ? { seconds:10 } : type==="poll" ? { question:"Choose what happens next", options:["Option A","Option B"] } : type==="dice" ? { sides:6 } : TRIVIA_CONFIG;
    const tool: GameTool = { id: `${type}-${Date.now()}`, type, name: info.name, enabled:true, config };
    const next = { ...latest, gameTools:[...existing,tool], updatedAt:"just now" };
    persist(next);

    // Selecting a template starts a workspace creation. It is not in the dashboard toolbox yet.
    if (type !== "trivia-board") {
      setAssetStatus(`${info.name} is ready in the workspace. Customize it with the AI Creative Director, then push the finished tool to your dashboard toolbox.`);
      return;
    }

    // Trivia Board is the one workspace tool whose visual belongs on the audience overlay.
    // Seed it with a real sourced board immediately so Add never creates an invisible empty board.
    setTriviaConfig(TRIVIA_CONFIG);
    setTriviaTopics([]);
    setPreviewMode("overlay");
    setTriviaBusy(true);
    setAssetStatus("Trivia Board added. Building its default sourced 5×5 board for the audience overlay…");
    try {
      const response = await fetch("/api/trivia", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ mode:"generate" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Trivia generation failed.");
      const nextConfig = { categories: Array.isArray(data.categories) ? data.categories : [] };
      const current = project || next;
      persist({ ...current, gameTools:(current.gameTools || []).map(t=>t.id===tool.id ? { ...t, config:nextConfig } : t), updatedAt:"just now" });
      setTriviaConfig(nextConfig);
      setTriviaTopics(nextConfig.categories.map((category:any)=>String(category.name || "")));
      setAssetStatus("5×5 Trivia Board is ready in the workspace. Customize its categories, questions, visuals and interactive areas with the AI Creative Director. Push it to the audience overlay only when it is finished.");
    } catch (error) {
      setAssetStatus(error instanceof Error ? `Trivia Board was added to the overlay workspace, but its default sourced questions could not be generated: ${error.message}` : "Trivia Board was added, but its default questions could not be generated.");
    } finally { setTriviaBusy(false); }
  }
  function pushWorkspaceCreation(tool: GameTool) {
    if (!project) return;
    const isBoard = tool.type === "trivia-board";
    persist({ ...project, gameTools:(project.gameTools||[]).map(t=>t.id===tool.id ? { ...t, inToolbox:!isBoard || t.inToolbox, inOverlayBuild:isBoard || t.inOverlayBuild } : t), updatedAt:"just now" });
    setAssetStatus(isBoard ? `${tool.name} added to the Overlay Build.` : `${tool.name} added to the Dashboard Toolbox.`);
  }
  function addBlankDashboardButton() {
    if (!project) return;
    const id=`dashboard-button-${Date.now()}`;
    persist({ ...project, controls:[...project.controls,{ id, label:"NEW BUTTON", action:"", detail:"Unassigned dashboard button", buttonMode:"single", toolIds:[], chain:[] }], updatedAt:"just now" });
    setSelectedControlId(id); setPreviewMode("dashboard");
  }
  function assignToolToButton(controlId:string, tool:GameTool) {
    if (!project) return; const control=project.controls.find(c=>c.id===controlId); if(!control)return;
    const current=control.toolIds||[]; if(current.includes(tool.id))return;
    if(current.length>=2){setAssetStatus("A dashboard button can hold a maximum of 2 tools.");return;}
    updateControl(controlId,{toolIds:[...current,tool.id],action:current.length===0?`tool.${tool.id}`:control.action});
  }
  function addChainStep(controlId:string, kind:"asset"|"composition"|"animation", refId:string, label:string) {
    if (!project) return; const control=project.controls.find(c=>c.id===controlId); if(!control)return;
    updateControl(controlId,{chain:[...(control.chain||[]),{id:`chain-${Date.now()}`,kind,refId,label,timing:{mode:"immediate"}}]});
  }
  function addToolToDashboard(tool: GameTool) {
    if (!project) return;
    const action = `tool.${tool.id}`;
    if (project.controls.some(control => control.action === action)) {
      setAssetStatus(`${tool.name} is already on the host dashboard.`);
      setPreviewMode("dashboard");
      return;
    }
    const control = {
      id: `tool-control-${tool.id}`,
      label: tool.name.toUpperCase(),
      action,
      detail: `Trigger the customized ${tool.name} audience result`,
    };
    persist({ ...project, controls:[...project.controls, control], updatedAt:"just now" });
    setPreviewMode("dashboard");
    setAssetStatus(`${tool.name} added to the host dashboard. Its customized audience result is now available to wire/test from this button.`);
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

  function spinWheel() { if (!project?.wheel?.enabled || project.wheel.segments.length < 2) return; const latest = project; persist({ ...latest, wheel: { ...latest.wheel, spinning: true, visible: true }, updatedAt:"just now" }); const channel = new BroadcastChannel(`ttc-project-${project.id}`); channel.postMessage({ type:"WHEEL_SPIN", at:Date.now() }); channel.close(); setTimeout(()=>{ const current=project; if(current) persist({ ...current, wheel:{...current.wheel, spinning:false, visible:false}, updatedAt:"just now" }); }, 3200); }

  function persist(next: Project) {
    const storedNext: Project = {
      ...next,
      assets: next.assets.map(asset => asset.storageKey?.startsWith("projects/") ? asset : asset.storageKey ? { ...asset, url: undefined } : asset),
    };
    setProject(next);
    void saveProjectToServer(storedNext).catch(error => setAssetStatus(error instanceof Error ? error.message : "Project save failed."));
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
    const current = project;
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
      const latest = project;
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
    let promptImage = "";
    if (type === "video") {
      const imageAssets = project.assets.filter(asset => isImage(asset) || asset.type?.toLowerCase().includes("image"));
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
      } else if (imageAssets.length) {
        setAssetStatus("The project image could not be loaded for video generation. Refresh the project and try again.");
        return;
      }
    }
    const requested = window.prompt(`Describe the ${type} you want to generate`, project.prompt || `A neon futuristic ${type} for this TikTok LIVE experience`);
    if (!requested?.trim()) return;
    setShowGenerator(false);
    setAssetBusy(true);
    setAssetStatus(type === "video" && promptImage ? "Generating video from reference image…" : `Generating ${type}…`);

    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: requested.trim(), type, ...(promptImage ? { promptImage } : {}) }),
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

      const latest = project;
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
      const latest=project;
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
    const latest = project;
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
      const latest = project;
      const existing = latest.gameTools || [];
      const trivia = existing.find(t => t.name === "Trivia Board");
      const tool: GameTool = trivia || { id:`trivia-${Date.now()}`, type:"trivia-board", name:"Trivia Board", enabled:true, config:TRIVIA_CONFIG };
      persist({ ...latest, gameTools:[...existing.filter(t=>t.name !== "Trivia Board"), tool], messages:[...latest.messages, {role:"user",text}, {role:"assistant",text:"Added a Jeopardy-style Trivia Board with five categories and five increasing-value questions per category. Pick any question from the dashboard to take over the live overlay."}], updatedAt:"just now" });
      setBuilding(false);
      return;
    }
    if (wheelRequest) {
      const latest = project;
      const wheel = latest.wheel || { enabled:false,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false };
      const wheelProject: Project = { ...latest, updatedAt:"just now", wheel:{ ...wheel, enabled:true }, messages:[...latest.messages,{role:"user",text},{role:"assistant",text:"Added a customizable Game Wheel to the dashboard and live overlay. You can edit its title and segments in the dashboard, then spin it for viewers."}] };
      persist(wheelProject); setBuilding(false); return;
    }
    try {
      const context = { ...updated, assets: updated.assets.map(({ url, ...asset }) => asset), publishedSnapshot: undefined };
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "draft-edit", request: text, history: updated.messages.slice(-8), project: context }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI editing is unavailable right now.");
      const result = applyDraftChanges(updated, data.changes);
      const steps = Array.isArray(data.manualSteps) ? data.manualSteps.filter((step: unknown) => typeof step === "string") : [];
      const reply = [data.reply || (result.applied ? "I updated the draft." : "I could not apply that change."), steps.length ? `How to do it manually:\n${steps.map((step: string, i: number) => `${i + 1}. ${step}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
      persist({ ...result.project, updatedAt: "just now", messages: [...updated.messages, { role: "assistant", text: reply }] });
    } catch (error) {
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: error instanceof Error ? `${error.message} Your request is in this chat; no draft edit was applied.` : "AI editing is unavailable. No draft edit was applied." }] });
    } finally { setBuilding(false); }
  }

  function trigger(control: Project["controls"][number]) {
    if (!project) return;
    if (control.compositionId) {
      const composition = project.compositions?.find(c => c.id === control.compositionId && c.inProject);
      if (composition) { setPreviewMode("overlay"); setPreviewAction({ composition, control, at: Date.now() }); }
      return;
    }
    if (control.action === "wheel.spin") { spinWheel(); return; }
    setEventLog(v => [`${control.label} → ${control.detail}`, ...v].slice(0, 4));
    const channel = new BroadcastChannel(`ttc-project-${project.id}`);
    channel.postMessage({ type: "PROJECT_EVENT", action: control.action, at: Date.now() }); channel.close();
  }
  async function publish() {
    if (!project || publishing) return;
    if (project.assets.some(asset => asset.inProject && asset.storageKey && !asset.storageKey.startsWith("projects/"))) {
      setAssetStatus("Publish needs cloud-stored assets. Re-upload any browser-only asset before publishing.");
      return;
    }
    const { publishedSnapshot: _previous, ...draft } = project;
    const snapshot = { ...draft, compositions: (draft.compositions || []).filter(c => c.inProject), status: "Published" as const, updatedAt: "just now" };
    const next = { ...project, status: "Published" as const, publishedSnapshot: snapshot, updatedAt: "just now" };
    setPublishing(true);
    try {
      const saved = await saveProjectToServer(next, true, hostKey);
      if (!saved.hostKey) throw new Error("The server did not return host access.");
      window.localStorage.setItem(`ttc-host-key-${next.id}`, saved.hostKey);
      setHostKey(saved.hostKey);
      setProject(next);
      setAssetStatus("Approved preview published to the host dashboard and audience overlay.");
    } catch (error) {
      setAssetStatus(error instanceof Error ? `Publish failed: ${error.message}` : "Publish failed. Your draft is still available.");
    } finally { setPublishing(false); }
  }
  function saveComposition(composition: AssetComposition) {
    if (!project) return;
    const latest = project;
    persist({ ...latest, compositions: [...(latest.compositions || []).filter(c => c.id !== composition.id), composition], updatedAt: "just now" });
    setShowAssetComposer(false);
    setEditingComposition(undefined);
    setAssetStatus(composition.name + " saved as a reusable Action Package.");
  }
  function deleteComposition(id: string) {
    if (!project) return;
    persist({ ...project, compositions: (project.compositions || []).filter(c => c.id !== id), controls: project.controls.filter(c => c.compositionId !== id), updatedAt: "just now" });
  }
  function toggleComposition(id: string) {
    if (!project) return;
    persist({ ...project, compositions: (project.compositions || []).map(c => c.id === id ? { ...c, inProject: !c.inProject } : c), updatedAt: "just now" });
  }
  function addCompositionControl(composition: AssetComposition) {
    if (!project) return;
    const label = window.prompt("Dashboard button label", `PLAY ${composition.name.toUpperCase()}`)?.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    const control = { id, label, action: `composition.play.${composition.id}`, detail: `Play ${composition.name}`, compositionId: composition.id, overlayResult: { ...defaultOverlayResult } };
    persist({ ...project, controls: [...project.controls, control], updatedAt: "just now" });
    setSelectedControlId(id); setPreviewMode("dashboard");
  }
  function updateControl(id: string, change: Partial<Project["controls"][number]>) {
    if (!project) return;
    persist({ ...project, controls: project.controls.map(c => c.id === id ? { ...c, ...change } : c), updatedAt: "just now" });
  }
  function startPlacement(event: React.PointerEvent<HTMLDivElement>, control: Project["controls"][number], resize: boolean) {
    const stage = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!stage) return;
    const value = control.overlayResult || defaultOverlayResult;
    placementPointer.current = { id: control.id, clientX: event.clientX, clientY: event.clientY, x: value.x, y: value.y, width: value.width, height: value.height, resize, stageWidth: stage.width, stageHeight: stage.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePlacement(event: React.PointerEvent<HTMLDivElement>) {
    const drag = placementPointer.current;
    if (!drag) return;
    const dx = (event.clientX - drag.clientX) / drag.stageWidth * 100;
    const dy = (event.clientY - drag.clientY) / drag.stageHeight * 100;
    setDragPlacement({ id: drag.id, x: drag.x + (drag.resize ? 0 : dx), y: drag.y + (drag.resize ? 0 : dy), width: Math.max(5, drag.width + (drag.resize ? dx : 0)), height: Math.max(5, drag.height + (drag.resize ? dy : 0)) });
  }
  function endPlacement() {
    const drag = dragPlacement, pointer = placementPointer.current;
    placementPointer.current = null; setDragPlacement(null);
    if (!drag || !pointer || !project) return;
    const control = project.controls.find(c => c.id === drag.id);
    if (control) updateControl(control.id, { overlayResult: { ...(control.overlayResult || defaultOverlayResult), x: Math.max(0, Math.min(95, drag.x)), y: Math.max(0, Math.min(95, drag.y)), width: Math.min(100, drag.width), height: Math.min(100, drag.height) } });
  }
  async function beginBlank() { const p = createProject("Create a new interactive TikTok LIVE experience"); try { await saveProjectToServer(p); window.location.href = `/project/${p.id}`; } catch (error) { setAssetStatus(error instanceof Error ? error.message : "Project could not be created."); } }

  if (!project) return <main className="loading-page"><div className="ai-orb">✦</div><h1>Loading your project...</h1></main>;
  return <main className="workspace-page">
    <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">{renamingProject ? <form onSubmit={saveProjectTitle} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input autoFocus aria-label="Project title" maxLength={100} value={projectTitleDraft} onChange={event => { setProjectTitleDraft(event.target.value); }} onKeyDown={event => { if (event.key === "Escape") setRenamingProject(false); }} style={{ minWidth: 180, maxWidth: "35vw", padding: "8px 10px", borderRadius: 8, color: "#fff", background: "#172032", border: "1px solid #3ddde6" }}/><button type="submit">Save</button><button type="button" onClick={() => setRenamingProject(false)}>Cancel</button></form> : <>{project.name} <button type="button" aria-label="Rename project" title="Rename project" onClick={() => { setProjectTitleDraft(project.name); setRenamingProject(true); }} style={{ marginLeft: 8, cursor: "pointer" }}>✎ Rename</button></>} <span>{project.status}</span></div><div className="workspace-actions"><Link href={privateDashboardUrl} className="preview-link">Open Host Dashboard</Link><button onClick={publish} disabled={publishing} className="publish-btn">{publishing ? "Publishing…" : project.publishedSnapshot ? "Update Published Experience ↗" : "Publish Experience ↗"}</button><button type="button" onClick={handleDeleteProject} className="danger-btn">Delete Project</button></div></header>
    <div className="workspace-grid">
      <section className="chat-panel"><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h1>Keep building it.</h1></div><div className="ai-orb">✦</div></div><div className="messages">{project.messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="message-icon">{m.role === "assistant" ? "✦" : "YOU"}</div><div><strong>{m.role === "assistant" ? "TTCGameLab AI" : "You"}</strong><p>{m.text}</p></div></div>)}{building&&<div className="build-activity"><span>✦</span><div><strong>Building your change...</strong><small>Sending project context to the AI engine</small></div></div>}<div className="idea-card"><span>QUICK ACTIONS</span><button onClick={()=>setDraft("Make the main character bigger and move it slightly left.")}>Make character bigger <b>→</b></button><button onClick={()=>setDraft("Add a follower alert with a dramatic entrance animation.")}>Add follower alert <b>→</b></button><button onClick={()=>setDraft("Give the whole experience a stronger neon glow.")}>Increase neon <b>→</b></button></div></div><form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Tell me what to change..."/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button type="button" onClick={() => fileInputRef.current?.click()}>＋ Upload</button><button type="button" onClick={() => setShowGenerator(v => !v)}>{assetBusy ? "Generating…" : "◈ Generate asset"}</button><button className="send" type="submit">{building ? "Building…" : "Update experience →"}</button></div>{showGenerator&&<div className="idea-card"><span>GENERATE WITH AI</span>{GENERATORS.map((item)=><button key={item.type} type="button" onClick={()=>generateAsset(item.type)}>{item.icon} {item.label} <b>→</b></button>)}</div>}<div className="idea-card"><span>BOARD TEMPLATES</span>{BOARD_LIBRARY.map(item=><button key={item.type} type="button" disabled={triviaBusy} onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}<button type="button" onClick={()=>{setDraft("Create a custom blank game board. I will use chat plus uploaded or generated assets to build its background and interactive areas.");setAssetStatus("Blank Board template selected. Describe the board, background and interactive areas in chat, then update the experience.");}}>Blank Board <b>→</b></button></div><div className="idea-card"><span>TOOL TEMPLATES</span>{TOOL_LIBRARY.map(item=><button key={item.type} type="button" onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
      <section className="preview-panel"><div className="preview-head"><div><small>FULL LIVESTREAM PREVIEW</small><h2>{project.name}</h2></div><div className="preview-switch"><button className={previewMode==="overlay"?"active":""} onClick={()=>setPreviewMode("overlay")}>Audience Overlay</button><button className={previewMode==="dashboard"?"active":""} onClick={()=>setPreviewMode("dashboard")}>Host Dashboard</button><span className="preview-mode-badge">DRAFT PREVIEW</span></div></div>{previewMode==="overlay"?<div className="stage">{(() => { const selected = project.assets.filter(a => a.inProject && a.url); const bg = selected.find(a => a.role === "background"); const layers = selected.filter(a => a.role !== "background"); return <><div className="stage-scan"/>{bg && <img src={bg.url} alt={bg.name} className="builder-preview-background" style={assetEditStyle(bg)}/>}<div className="builder-preview-layers">{layers.map((a,i) => isVideo(a) ? <video key={(a.storageKey || a.name)+i} src={a.url} className="builder-preview-media" style={assetEditStyle(a)} autoPlay loop muted playsInline/> : isAudio(a) ? null : <img key={(a.storageKey || a.name)+i} src={a.url} alt={a.name} className="builder-preview-media" style={assetEditStyle(a)}/>)}</div><div className="overlay-demo"><div className="overlay-live">● PREVIEW</div><div className="overlay-headline">{project.overlay.title}</div><div className="overlay-sub">{project.overlay.subtitle}</div>{project.overlay.showCharacter&&<div className="demo-character">◉</div>}<div className="demo-alert">FOLLOW ALERT</div></div>{(() => { const trivia = (project.gameTools || []).find(t => t.type === "trivia-board" && t.enabled); const config:any = triviaConfig || trivia?.config; if (!trivia || !Array.isArray(config?.categories) || config.categories.length !== 5) return null; if (activeTrivia) { const [ci,qi]=activeTrivia.split(":").map(Number); const cat=config.categories[ci]; const q=cat?.questions?.[qi]; if (!cat || !q) return null; return <div className="runtime-trivia"><div className="runtime-trivia-board-label">NEON TRIVIA NIGHT</div><div className="runtime-trivia-category">{cat.name}</div><div className="runtime-trivia-value">${q.value}</div><div className="runtime-trivia-question">{q.prompt}</div>{triviaAnswerRevealed&&<div className="runtime-trivia-answer"><span>ANSWER</span>{q.answer}</div>}{q.source&&<div className="runtime-trivia-source">Source: {q.source}</div>}</div>; } return <div className="runtime-jeopardy"><div className="runtime-jeopardy-title">NEON TRIVIA NIGHT</div><div className="runtime-jeopardy-grid">{config.categories.map((cat:any,ci:number)=><div className="runtime-jeopardy-column" key={`${cat.name}-${ci}`}><div className="runtime-jeopardy-category">{cat.name}</div>{(cat.questions||[]).slice(0,5).map((q:any,qi:number)=><div className={`runtime-jeopardy-value ${q.used?"used":""}`} key={`${q.value}-${qi}`}>{q.used?"USED":`${q.value}`}</div>)}</div>)}</div><div className="runtime-jeopardy-help">Choose a clue from the Trivia Board controls</div></div>; })()}<div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></>; })()}{(()=>{const control=project.controls.find(c=>c.id===selectedControlId&&c.compositionId);if(!control)return null;const r=dragPlacement?.id===control.id?dragPlacement:control.overlayResult||defaultOverlayResult;return <div className="overlay-placement-marker" style={{left:`${r.x}%`,top:`${r.y}%`,width:`${r.width}%`,height:`${r.height}%`}} onPointerDown={e=>startPlacement(e,control,e.target instanceof HTMLElement&&e.target.dataset.resize==="true")} onPointerMove={movePlacement} onPointerUp={endPlacement}><span>{control.label} · drag to position</span><i data-resize="true" title="Drag to resize"/></div>})()}{previewAction&&<CompositionPlayer key={`${previewAction.control.id}-${previewAction.at}`} composition={previewAction.composition} assets={project.assets} placement={previewAction.control.overlayResult||defaultOverlayResult} startedAt={previewAction.at} onEnd={()=>setPreviewAction(null)}/>}</div>:<div className="dashboard-preview"><h3>{project.name} · Host Dashboard</h3><p>Build the dashboard with blank trigger buttons. Customized tools are pushed to the toolbox first; board and overlay actions can then be wired to buttons individually or as ordered/timed command sequences.</p><div className="dashboard-toolbox"><small>CUSTOMIZED TOOLBOX</small>{(project.gameTools||[]).filter(tool=>tool.enabled && tool.type!=="trivia-board").map(tool=>{const added=project.controls.some(control=>control.action===`tool.${tool.id}`);return <div className="tool-library-row" key={tool.id}><div><b>{tool.name}</b><small>Customized workspace tool</small></div><button className="outline-btn" disabled={added} onClick={()=>addToolToDashboard(tool)}>{added?"✓ Assigned":"+ Use on Dashboard"}</button></div>})}</div><div className="dashboard-preview-buttons">{project.controls.map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div></div>}<div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Events</span><span>{project.status} · {project.updatedAt}</span></div><div className="control-strip"><div><small>HOST CONTROLS</small><strong>Trigger your generated experience</strong></div><div className="control-buttons">{project.controls.map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div>{eventLog.length>0&&<div className="event-log">{eventLog.map((x,i)=><span key={i}>✓ {x}</span>)}</div>}</div><div className="dashboard-action-editor"><h3>Dashboard buttons</h3>{project.controls.map(control=><div className="dashboard-action-row" key={control.id}><button className="outline-btn" onClick={()=>{setSelectedControlId(control.id);setPreviewMode("overlay")}}>{control.label} · Edit Overlay Result</button>{control.compositionId&&<small>{project.compositions?.find(c=>c.id===control.compositionId)?.name||"Missing composition"}</small>}</div>)}{(()=>{const control=project.controls.find(c=>c.id===selectedControlId);if(!control)return null;const result=control.overlayResult||defaultOverlayResult;return <div className="overlay-result-editor"><h4>Configure Dashboard Button · {control.label}</h4><label>Button label<input value={control.label} onChange={e=>updateControl(control.id,{label:e.target.value})}/></label><label>Button type<select value={control.buttonMode||"single"} onChange={e=>updateControl(control.id,{buttonMode:e.target.value as "single"|"chain"})}><option value="single">Single Action</option><option value="chain">Multi-Link Chain Command</option></select></label><div className="tool-config-list"><small>PRIMARY TOOLS · {(control.toolIds||[]).length}/2</small>{(control.toolIds||[]).map(id=>{const tool=(project.gameTools||[]).find(t=>t.id===id);return tool?<div className="tool-config" key={id}><b>{tool.name}</b><button className="danger-btn" onClick={()=>updateControl(control.id,{toolIds:(control.toolIds||[]).filter(x=>x!==id)})}>Remove</button></div>:null})}</div>{control.buttonMode==="chain"&&<div className="tool-config-list"><strong>CHAIN SUPPORTING ACTIONS</strong><small>Add media/effects to this button. Each step can fire immediately or after its own timed delay.</small><div className="trivia-actions">{project.assets.filter(a=>a.inProject).map((asset,i)=><button className="outline-btn" key={(asset.storageKey||asset.name)+i} onClick={()=>addChainStep(control.id,"asset",asset.storageKey||asset.name,asset.name)}>＋ {asset.name}</button>)}{(project.compositions||[]).filter(x=>x.inProject).map(comp=><button className="outline-btn" key={comp.id} onClick={()=>addChainStep(control.id,"composition",comp.id,comp.name)}>＋ {comp.name}</button>)}</div>{(control.chain||[]).map((step,index)=><div className="tool-config" key={step.id}><b>{index+1}. {step.label}</b><label>Timing<select value={step.timing.mode} onChange={e=>updateControl(control.id,{chain:(control.chain||[]).map(s=>s.id===step.id?{...s,timing:{...s.timing,mode:e.target.value as "immediate"|"delay"}}:s)})}><option value="immediate">Immediately</option><option value="delay">Timed delay</option></select></label>{step.timing.mode==="delay"&&<label>Seconds<input type="number" min="0" step=".1" value={step.timing.seconds||0} onChange={e=>updateControl(control.id,{chain:(control.chain||[]).map(s=>s.id===step.id?{...s,timing:{mode:"delay",seconds:Math.max(0,+e.target.value||0)}}:s)})}/></label>}<button className="danger-btn" onClick={()=>updateControl(control.id,{chain:(control.chain||[]).filter(s=>s.id!==step.id)})}>Remove</button></div>)}</div>}{control.compositionId&&<><label>Composition<select value={control.compositionId} onChange={e=>updateControl(control.id,{compositionId:e.target.value})}>{(project.compositions||[]).filter(c=>c.inProject).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>{(["x","y","width","height","layer","entranceSeconds","exitSeconds"] as const).map(key=><label key={key}>{key}<input type="number" value={result[key]} min={key==="width"||key==="height"?1:0} max={key==="layer"?100:100} step={key.endsWith("Seconds")?.1:1} onChange={e=>updateControl(control.id,{overlayResult:{...result,[key]:+e.target.value}})}/></label>)}{(["entrance","exit"] as const).map(key=><label key={key}>{key}<select value={result[key]} onChange={e=>updateControl(control.id,{overlayResult:{...result,[key]:e.target.value as typeof result[typeof key]}})}>{["none","fade","slide","zoom"].map(option=><option key={option}>{option}</option>)}</select></label>)}<button className="build-btn" onClick={()=>trigger(control)}>Test Trigger</button></>}<button className="danger-btn" onClick={()=>{persist({...project,controls:project.controls.filter(c=>c.id!==control.id)});setSelectedControlId(null)}}>Remove button</button></div>})()}</div></section>
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
          <Link href={privateDashboardUrl}>Open project ↗</Link>
          <button className="outline-btn" onClick={copyDashboardLink}>Copy Dashboard Link for Phone</button>
          {dashboardLinkStatus && <small role="status">{dashboardLinkStatus}</small>}
        </div>
        <div className="detail-block asset-composer-launch">
          <span>ASSET COMPOSER</span>
          <p className="empty-note">Combine video, voice, music, SFX, text and effects on a synchronized multi-track timeline.</p>
          <button className="build-btn composer-open-btn" onClick={() => {setEditingComposition(undefined);setShowAssetComposer(true)}}>◫ Open Asset Composer</button>
          {(project.compositions || []).map(comp => <div className="saved-composition" key={comp.id}><div><b>{comp.name}</b><small>{comp.clips.length} clips · {comp.duration.toFixed(1)}s</small></div><button className="outline-btn" onClick={()=>toggleComposition(comp.id)}>{comp.inProject?"✓ In Preview":"+ Add to Preview"}</button><button className="outline-btn" onClick={()=>{setEditingComposition(comp);setShowAssetComposer(true)}}>Edit</button><button className="build-btn" disabled={!comp.inProject} onClick={()=>addCompositionControl(comp)}>Assign button</button><button className="danger-btn" onClick={() => deleteComposition(comp.id)}>Delete</button></div>)}
        </div>
        <div className="detail-block">
          <span>WORKSPACE CREATIONS</span>
          <p className="empty-note">Choose board and tool templates below the chat. Customize them with the AI before deciding where they belong.</p>
          <div className="tool-config-list">
            {(project.gameTools || []).map(tool => (
              <div className="tool-config" key={tool.id}>
                <div>
                  <b>{tool.name}</b>
                  <em>{tool.type}</em>
                </div>
                <small>{tool.type==="trivia-board" ? (tool.inOverlayBuild ? "✓ In Overlay Build" : "Board customization workspace") : (tool.inToolbox ? "✓ In Dashboard Toolbox" : "Tool customization workspace")}</small><button className="build-btn" disabled={tool.type==="trivia-board"?tool.inOverlayBuild:tool.inToolbox} onClick={()=>pushWorkspaceCreation(tool)}>{tool.type==="trivia-board"?(tool.inOverlayBuild?"✓ Added to Overlay Build":"Add to Overlay Build"):(tool.inToolbox?"✓ Added to Toolbox":"Add to Toolbox")}</button>
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
                        {activeTrivia === `${ci}:${qi}` && (
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
    {showAssetComposer && <AssetComposer assets={project.assets} compositions={project.compositions || []} initial={editingComposition} onSave={saveComposition} onClose={() => setShowAssetComposer(false)} />}
    {editingAssetIndex !== null && project.assets[editingAssetIndex] && <MediaEditor asset={project.assets[editingAssetIndex]} onClose={() => setEditingAssetIndex(null)} onSave={next => saveAssetEdits(editingAssetIndex, next)} onSaveAsNew={saveAssetAsNew} />}
    {(showAssetComposer || editingAssetIndex !== null) && <div className="floating-ai"><button className="floating-ai-toggle" onClick={() => setChatDrawer(v => !v)} aria-expanded={chatDrawer}>✦ Ask AI about this edit</button>{chatDrawer && <section className="floating-ai-panel"><header><strong>AI Creative Director</strong><button onClick={() => setChatDrawer(false)} aria-label="Close chat">×</button></header><div className="floating-ai-messages">{project.messages.slice(-8).map((m,i)=><p key={i}><b>{m.role === "assistant" ? "AI" : "You"}</b><br/>{m.text}</p>)}{building&&<p>Working on your request…</p>}</div><form onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Describe the change you want…"/><button type="submit" disabled={building}>Send</button></form></section>}</div>}
  </main>;
}
