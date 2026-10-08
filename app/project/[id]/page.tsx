"use client";

import CompactConversation from "../../../components/CompactConversation";
import BoardDesigner, { BoardArtwork } from "../../../components/BoardDesigner";
import {mediaKind} from "../../../lib/board-design";
import OverlayAsset from "../../../components/OverlayAsset";
import QuestionCardEditor from "../../../components/QuestionCardEditor";
import QuestionHostPanel from "../../../components/QuestionHostPanel";
import GoogleSearch from "../../../components/GoogleSearch";
import {createCardSystem} from "../../../lib/question-cards";
import BuildSpace from "../../../components/BuildSpace";
import ProjectWorkflowNav from "../../../components/ProjectWorkflowNav";
import CollapsibleFolder from "../../../components/CollapsibleFolder";
import AssetFolders from "../../../components/AssetFolders";
import { assetCategory } from "../../../lib/asset-folders";
import YouTubePlacementEditor from "../../../components/YouTubePlacementEditor";
import YouTubeOverlayPlayer from "../../../components/YouTubeOverlayPlayer";
import { youtubePlacement, youtubePosition, safeYoutubePlacement } from "../../../lib/youtube";
import type { YouTubeState } from "../../../lib/youtube";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AssetComposition, createProject, deleteProjectFromServer, Project, ProjectAsset, saveProjectToServer, loadProjectFromServer, GameTool, GameToolType } from "../../../lib/project";
import { deleteStoredAsset, hydrateAsset, hydrateProjectAssets, storeGeneratedAsset, storeUploadedAsset } from "../../../lib/asset-store";
import { waitForGeneratedVideo } from "../../../lib/video-generation";
import MediaEditor from "../../../components/MediaEditor";
import AssetComposer from "../../../components/AssetComposer";
import CompositionPlayer, { defaultOverlayResult } from "../../../components/CompositionPlayer";
import { applyBuildChanges } from "../../../lib/build-edits";
import {addCreationControl,clarifyYoutubeSearch} from "../../../lib/build-controls";
import {toolDefaults,infoTypes} from "../../../lib/game-tools";
import {GameInfoHostPanel} from "../../../components/GameInfoTools";
import {buildReadiness} from "../../../lib/build-readiness";
import "./workflow.css";
import CardListEditor from "../../../components/CardListEditor";
import PickerHostPanel from "../../../components/PickerHostPanel";
import AssetPoolManager from "../../../components/AssetPoolManager";
import AssetPoolAssignment from "../../../components/AssetPoolAssignment";
import AssetDetailsDialog from "../../../components/AssetDetailsDialog";
import AssetThumbnail from "../../../components/AssetThumbnail";
import { removeAssetFromPools } from "../../../lib/asset-pools";
import { removeLegacyCardTimers } from "../../../lib/control-connections";
import {createCardList,savedListEntries} from "../../../lib/card-lists";
import GameToolEditor, { overlayToolPlacement } from "../../../components/GameToolEditor";
import RuntimeActionLayers, { useRuntimeActions } from "../../../components/RuntimeActionLayers";

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
  return Boolean(asset.url && mediaKind(asset)==="video");
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
  const runtime = useRuntimeActions(project,states=>{if(project)persist({...project,cardPreviewStates:states});});
  const projectRef = useRef<Project | null>(null);
  projectRef.current = project;
  const [draft, setDraft] = useState("");
  const [workflowStep, setWorkflowStep] = useState(0);
  const [workshopStep, setWorkshopStep] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [backgroundIntent, setBackgroundIntent] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const workflowRef = useRef<HTMLElement>(null);
  function chooseWorkflowStep(step: number, substep = workshopStep) {
    setWorkflowStep(step);
    setWorkshopStep(substep);
    if (step === 1) setPreviewMode("overlay");
    if (project) persist({ ...project, workflow: { stage: step, workshopStep: substep, promptDraft: draft, generatorPrompt }, updatedAt: "just now" });
  }
  function openWorkshopTool(tool: "media" | "trivia" | "boards" | "tools", background = false) {
    chooseWorkflowStep(0, 1);
    setBackgroundIntent(background);
    if (background) setGeneratorType("image");
    setShowGenerator(tool === "media");
    setShowTriviaListGenerator(tool === "trivia");
    setShowBoardTemplates(tool === "boards");
    setShowToolTemplates(tool === "tools");
    requestAnimationFrame(() => promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  async function saveProgress() {
    if (!project || saveBusy) return;
    setSaveBusy(true); setSaveStatus("Saving your progress…");
    const next = { ...project, workflow: { stage: workflowStep, workshopStep, promptDraft: draft, generatorPrompt }, updatedAt: "just now" };
    try {
      await saveQueue.current;
      await saveProjectToServer({ ...next, assets: next.assets.map(asset => asset.storageKey?.startsWith("projects/") ? asset : asset.storageKey ? { ...asset, url: undefined } : asset) });
      setProject(next); setSaveStatus("Saved. Reopen this project to continue from this step.");
    } catch(error) { setSaveStatus(error instanceof Error ? error.message : "Could not save. Please try again."); }
    finally { setSaveBusy(false); }
  }
  const [renamingProject, setRenamingProject] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [aiUndo,setAiUndo]=useState<Project|null>(null);
  const [aiControlFocus,setAiControlFocus]=useState<{id:string;request:number}|null>(null);
  const [buildSelection,setBuildSelection]=useState<{kind:string;id:string}|null>(null);
  const [chatDrawer, setChatDrawer] = useState(false);
  const [youtubeToolOpen,setYoutubeToolOpen] = useState(false);
  const [positionAssetKey,setPositionAssetKey]=useState<string|null>(null);
  const [selectedAssetKey,setSelectedAssetKey]=useState<string|null>(null);
  const [assetSearch,setAssetSearch]=useState("");
  const [assetKindFilter,setAssetKindFilter]=useState<"all"|"image"|"video"|"audio"|"other">("all");
  const [youtubePreview, setYoutubePreview] = useState<YouTubeState | null>(null);
  const [youtubeFeedback, setYoutubeFeedback] = useState<{playbackId:string;status:string;errorCode?:number}|null>(null);
  const youtubeActualPosition = useRef<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [hostKey, setHostKey] = useState("");
  const [dashboardLinkStatus, setDashboardLinkStatus] = useState("");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showTriviaListGenerator, setShowTriviaListGenerator] = useState(false);
  const [triviaListCategories, setTriviaListCategories] = useState("");
  const [triviaListCount, setTriviaListCount] = useState(25);
  const [triviaListQuestions, setTriviaListQuestions] = useState<any[]>([]);
  const [triviaListBusy, setTriviaListBusy] = useState(false);
  const [newCardEditorId,setNewCardEditorId]=useState("");
  const newCardDialog=useRef<HTMLDialogElement>(null);
  const [listEditorId,setListEditorId]=useState("");
  const listDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(listEditorId&&listDialog.current&&!listDialog.current.open){listDialog.current.showModal();listDialog.current.querySelector<HTMLInputElement>('input')?.focus();}},[listEditorId]);
  function openNewList(){const current=projectRef.current;if(!current)return;const list=createCardList();persist({...current,gameTools:[...current.gameTools,list]});setListEditorId(list.id);}

  useEffect(()=>{if(newCardEditorId&&newCardDialog.current&&!newCardDialog.current.open){newCardDialog.current.showModal();newCardDialog.current.querySelector<HTMLInputElement>('input')?.focus();}},[newCardEditorId]);
  function createWorkshopCard(kind:'question'|'blank'){
    const current=projectRef.current||project;if(!current)return;
    try{const next=createCardSystem(current,undefined,kind);const card=next.gameTools[next.gameTools.length-1];persist(next);setNewCardEditorId(card.id);setAssetStatus(kind==='blank'?'Blank card created. Customize it in the editor.':'Question and answer cards created. Choose their question pool and customize their appearance.');}
    catch(error){setAssetStatus(error instanceof Error?error.message:'Card creation failed. Please try again.');}
  }
  const [showBoardTemplates, setShowBoardTemplates] = useState(false);
  const [showBoardGuide, setShowBoardGuide] = useState(false);
  const [guideBoardId, setGuideBoardId] = useState("");
  const [showToolTemplates, setShowToolTemplates] = useState(false);
  const [musicLengthMode, setMusicLengthMode] = useState("short");
  const [musicDuration, setMusicDuration] = useState(25);
  const [musicLyrics, setMusicLyrics] = useState("");
  const [generatorType, setGeneratorType] = useState<GeneratorType>("image");
  const [generatorPrompt, setGeneratorPrompt] = useState("");
  const [videoReferenceKey, setVideoReferenceKey] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetStatus, setAssetStatus] = useState("");
  const [boardDesignerId,setBoardDesignerId]=useState("");
  const [backgroundDestinationKey,setBackgroundDestinationKey]=useState("");
  const [triviaConfig, setTriviaConfig] = useState<any>(null);
  const [activeTrivia, setActiveTrivia] = useState<string | null>(null);
  const [triviaAnswerRevealed, setTriviaAnswerRevealed] = useState(false);
  const [triviaBusy, setTriviaBusy] = useState(false);
  const [triviaTopics, setTriviaTopics] = useState<string[]>([]);
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);
  const [showAssetComposer, setShowAssetComposer] = useState(false);
  const [editingComposition, setEditingComposition] = useState<AssetComposition | undefined>();
  const [sideBySideTesting, setSideBySideTesting] = useState(true);
  const [previewMode, setPreviewMode] = useState<"overlay" | "dashboard">("overlay");
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<{ composition: AssetComposition; control: Project["controls"][number]; at: number } | null>(null);
  const [dragPlacement, setDragPlacement] = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
  const placementPointer = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number; width: number; height: number; resize: boolean; stageWidth: number; stageHeight: number } | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision=useRef(0);

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
      setProject(removeLegacyCardTimers({ ...clarifyYoutubeSearch(hydrated), gameTools: (clarifyYoutubeSearch(hydrated).gameTools || []).map(tool => tool.type !== "trivia-board" && tool.type !== "blank-board" ? { ...tool, inToolbox: true } : tool) }));
      setWorkflowStep(Math.max(0, Math.min(2, found.workflow?.stage ?? 0)));
      setWorkshopStep(Math.max(0, Math.min(2, found.workflow?.workshopStep ?? 0)));
      setDraft(found.workflow?.promptDraft || "");
      setGeneratorPrompt(found.workflow?.generatorPrompt || "");
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
    { type:"blank-board", name:"Blank Board", description:"Start a custom audience board and build its background and interactive areas with chat and project assets." },
  ];
  async function previewYoutube(command: Record<string, unknown>): Promise<YouTubeState> {
    const action = command.action as YouTubeState["action"];
    let next: YouTubeState;
    if (action === "play") {
      const response = await fetch("/api/youtube?" + new URLSearchParams({video:String(command.videoId),region:String(command.region || "US")}), {cache:"no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Video is not embeddable.");
      if (data.video.durationSeconds && (Number(command.start) >= data.video.durationSeconds || command.end != null && Number(command.end) > data.video.durationSeconds + 1)) throw new Error("Choose clip times within the video's length.");
      next = {action,videoId:data.video.id,title:data.video.title,durationSeconds:data.video.durationSeconds,startMuted:false,start:Number(command.start),end:command.end == null ? null : Number(command.end),position:Number(command.start),at:Date.now(),volume:Number(command.volume),placement:safeYoutubePlacement(command.placement),playbackId:crypto.randomUUID()};
    } else {
      if (!youtubePreview || youtubePreview.action === "stop") throw new Error("No preview clip is active.");
      next = {...youtubePreview,action,position:youtubeActualPosition.current ?? youtubePosition(youtubePreview),at:Date.now()};
    }
    if (action === "play") youtubeActualPosition.current = Number(command.start);
    setYoutubeFeedback(null); setYoutubePreview(next); if(action==="play") setAssetStatus("Testing YouTube in the audience preview. Use the controls below to pause, resume or hide it before publishing.");
    return next;
  }
  const TOOL_LIBRARY: { type: GameToolType; name: string; description: string }[] = [
    { type:"wheel", name:"Game Wheel", description:"Spin configurable segments on the live overlay." },
    { type:"random-picker", name:"Random Picker", description:"Randomly draw an unused image or card. The same button removes it." },
    { type:"scoreboard",name:"Scoreboard",description:"Show players or teams and adjust their scores during the game." },
    { type:"prize-list",name:"Prize List",description:"List prizes and mark who wins each one." },
    { type:"game-tool-list",name:"TikTok Gift Guide",description:"Show which gifts activate steals, skips, or other host-defined actions." },
    { type:"countdown", name:"Countdown", description:"Show a host-triggered countdown timer." },
    { type:"poll", name:"Live Poll", description:"Show choices and a live audience poll." },
    { type:"coin-toss", name:"Coin Toss", description:"Flip an animated coin for a random Heads or Tails result. Customize its look and connect it in Build Space." },
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
    const channel = new BroadcastChannel(`ttc-draft-${project.id}`);
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
    const channel = new BroadcastChannel(`ttc-draft-${project.id}`);
    channel.postMessage({ type:"TRIVIA_ANSWER", category:category.name, value:question.value, prompt:question.prompt, answer:question.answer, source:question.source, sourceUrl:question.sourceUrl });
    channel.close();
    setEventLog(v => [`${category.name} ${question.value} → answer revealed`, ...v].slice(0,4));
  }

  function closeTriviaQuestion() {
    if (!project) return;
    const channel = new BroadcastChannel(`ttc-draft-${project.id}`);
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
      const response = await fetch("/api/trivia",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,categories,category:categoryName || "",exclude:[...current.categories.flatMap((c:any)=>c.questions||[]),...project.gameTools.flatMap(t=>Array.isArray(t.config.questions)?t.config.questions:[])]})});
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

  async function generateTriviaList(options?: { count: number; categories: string[]; baseProject: Project }) {
    if (!project || triviaListBusy) return;
    const target=Math.max(1,Math.min(500,options?.count || triviaListCount));
    const categories=options?.categories || triviaListCategories.split(",").map(x=>x.trim()).filter(Boolean);
    setTriviaListBusy(true);setTriviaListQuestions([]);
    const all:any[]=[],pending=new Map<string,any>();
    const key=(q:any)=>String(q.question||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const previousQuestions=(projectRef.current || options?.baseProject || project).gameTools.flatMap(t=>{const qs=Array.isArray(t.config.questions)?t.config.questions:[];const cats=Array.isArray(t.config.categories)?t.config.categories:[];return [...qs,...cats.flatMap((c:any)=>Array.isArray(c.questions)?c.questions:[])].map((q:any)=>({question:String(q.question||q.prompt||""),answer:String(q.answer||"")}))});
    let lastError="";
    try {
      const limit=Math.max(6,Math.ceil(target/10)*6);
      for(let attempt=0;all.length<target && attempt<limit;attempt++){
        setAssetStatus(`Searching additional sources · ${all.length}/${target} verified · attempt ${attempt+1}/${limit}`);
        try{
          const response=await fetch("/api/trivia-list",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({count:Math.min(10,target-all.length),categories,attempt,exclude:[...previousQuestions,...all,...pending.values()]})});
          const data=await response.json();
          if(!response.ok){lastError=data.error||"Source temporarily unavailable.";continue}
          for(const q of data.questions||[]){if(all.length<target && !all.some(x=>key(x)===key(q))){all.push({...q,verificationStatus:"verified"});pending.delete(key(q))}}
          for(const q of data.manualCandidates||[]){if(q.sourceUrl && !all.some(x=>key(x)===key(q)))pending.set(key(q),{...q,verificationStatus:"needs-review"})}
          setTriviaListQuestions([...all]);
        }catch(error){lastError=error instanceof Error?error.message:"Source request failed."}
      }
      const review=Array.from(pending.values()).filter(q=>!all.some(x=>key(x)===key(q))).slice(0,target-all.length);
      const questions=[...all,...review];
      if(!questions.length)throw new Error(lastError||"No source-backed questions could be found. Try another category.");
      setTriviaListQuestions(questions);
      const tool:any={id:`trivia-list-${Date.now()}`,type:"trivia-list",name:`Trivia Question List (${questions.length})`,enabled:true,inToolbox:true,config:{title:"Trivia Question List",requestedCount:target,suggestedCategories:categories,questions,verifiedCount:all.length,reviewCount:review.length}};
      const base = projectRef.current || options?.baseProject || project;
      const saved = {...base,gameTools:[...(base.gameTools||[]),tool],updatedAt:"just now"};
      persist(saved);
      const summary = `${all.length} verified; ${review.length} * need manual verification; ${target-questions.length} still missing. Review starred questions against their linked sources before use.`;
      setAssetStatus(summary);
      return {project:saved, summary};
    }catch(error){const message=error instanceof Error?error.message:"Trivia generation failed.";setAssetStatus(message);if(options)throw new Error(message)}
    finally{setTriviaListBusy(false)}
  }
  async function downloadTriviaPdf() {
    if(!triviaListQuestions.length)return; const response=await fetch("/api/trivia-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({questions:triviaListQuestions.map(q=>({...q,question:q.question+(q.verificationStatus==="needs-review"?" * NEEDS MANUAL VERIFICATION":"")}))})});
    if(!response.ok){setAssetStatus("PDF download could not be created.");return;} const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download="ttcgamelab-trivia.pdf";a.click();URL.revokeObjectURL(url);
  }
  function addTriviaListToToolbox() {
    if(!project)return; const tools=project.gameTools||[]; const idx=[...tools].reverse().findIndex(t=>t.type==="trivia-list"); if(idx<0)return; const real=tools.length-1-idx;
    persist({...project,gameTools:tools.map((t,i)=>i===real?{...t,inToolbox:true}:t),updatedAt:"just now"}); setAssetStatus("Trivia Question List added to the Dashboard Toolbox.");
  }

  async function addGameTool(type: GameToolType) {
    if (!project || triviaBusy) return;
    const latest = project;
    const existing = latest.gameTools || [];
    if (existing.some(t=>t.type===type && t.enabled)) { setAssetStatus("That template is already being customized in this project."); return; }
    const info = [...BOARD_LIBRARY, ...TOOL_LIBRARY].find(t=>t.type===type)!;
    const config = {...toolDefaults(type),...(type==='youtube'?{placement:youtubePlacement}:type==='trivia-board'?TRIVIA_CONFIG:{})};
    const tool: GameTool = { id: `${type}-${Date.now()}`, type, name: info.name, enabled:true, inToolbox: type !== "trivia-board" && type !== "blank-board", config };
    const next = { ...latest, gameTools:[...existing,tool], updatedAt:"just now" };
    persist(next);

    if(type === "youtube") { setPreviewMode("dashboard");setSideBySideTesting(true); setAssetStatus("YouTube tool is in your dashboard toolbox. Choose where it belongs and what dashboard control should open it, then test in the paired previews."); return; }

    // Selecting a template starts a workspace creation. It is not in the dashboard toolbox yet.
    if (type !== "trivia-board" && type !== "blank-board") {
      setAssetStatus(`${info.name} is ready in the workspace. Customize it with the AI Creative Director, It is saved in your toolbox automatically. In Build Space, connect it to a dashboard button when you want to use it.`);
      return;
    }

    if (type === "blank-board") {
      setBoardDesignerId(tool.id);
      setPreviewMode("overlay");
      setAssetStatus("Blank Board is ready in the workspace. Add or generate its background and describe interactive areas to the AI Creative Director, then use Add to Overlay Build when it is finished.");
      return;
    }

    setBoardDesignerId(tool.id);
    // Trivia Board starts with a sourced 5×5 board.
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
      const current = projectRef.current || next;
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
    const isBoard = tool.type === "trivia-board" || tool.type === "blank-board";
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
    if ((tool.type==="youtube" && current.length>0) || current.some(id=>project.gameTools.find(t=>t.id===id)?.type==="youtube")) {setAssetStatus("YouTube search uses its own private dashboard button. Assign it to an empty button.");return;}
    if(current.length>=2){setAssetStatus("A dashboard button can hold a maximum of 2 tools.");return;}
    updateControl(controlId,{toolIds:[...current,tool.id],detail:[...current,tool.id].map(id=>project.gameTools?.find(t=>t.id===id)?.name).filter(Boolean).join(" + "),action:current.length===0?`tool.${tool.id}`:control.action});
  }
  function addChainStep(controlId:string, kind:"asset"|"composition"|"animation", refId:string, label:string) {
    if (!project) return; const control=project.controls.find(c=>c.id===controlId); if(!control)return;
    updateControl(controlId,{chain:[...(control.chain||[]),{id:`chain-${Date.now()}`,kind,refId,label,timing:{mode:"immediate"}}]});
  }
  function triggerGameTool(tool: GameTool) {
    if (!project) return;
    const channel = new BroadcastChannel(`ttc-draft-${project.id}`);
    channel.postMessage({ type:"GAME_TOOL_TRIGGER", tool });
    channel.close();
    setEventLog(v => [`${tool.name} → triggered on overlay`, ...v].slice(0,4));
  }


  function updateWheelField(field: "title" | "segments", value: string) { if (!project) return; const wheel = project.wheel || { enabled:true,title:"Game Wheel",segments:["Prize","Challenge","Bonus","Mystery"],spinning:false,visible:false }; persist({ ...project, wheel: { ...wheel, [field]: field === "segments" ? value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12) : value }, updatedAt:"just now" }); }

  function spinWheel() { if (!project?.wheel?.enabled || project.wheel.segments.length < 2) return; const latest = project; persist({ ...latest, wheel: { ...latest.wheel, spinning: true, visible: true }, updatedAt:"just now" }); setTimeout(()=>{ setProject(current => { if (!current?.wheel) return current; const next={ ...current, wheel:{...current.wheel, spinning:false, visible:false}, updatedAt:"just now" }; const storedNext={...next,assets:next.assets.map(asset=>asset.storageKey?.startsWith("projects/")?asset:asset.storageKey?{...asset,url:undefined}:asset)}; saveQueue.current=saveQueue.current.then(()=>saveProjectToServer(storedNext)).then(()=>undefined).catch(error=>{setAssetStatus(error instanceof Error?error.message:"Project save failed.");}); return next; }); }, 3200); }

  function persist(next: Project) {
    const revision=++saveRevision.current;
    setAiUndo(null);
    setSaveStatus("Saving changes…");
    const storedNext: Project = {
      ...next,
      assets: next.assets.map(asset => asset.storageKey?.startsWith("projects/") ? asset : asset.storageKey ? { ...asset, url: undefined } : asset),
    };
    projectRef.current = next;
    setProject(next);
    saveQueue.current = saveQueue.current.then(() => saveProjectToServer(storedNext)).then(() => { if(revision===saveRevision.current)setSaveStatus("Changes saved."); }).catch(error => { if(revision===saveRevision.current)setSaveStatus("Save failed. Use Save progress to retry."); setAssetStatus(error instanceof Error ? error.message : "Project save failed."); });
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
    const confirmed = window.confirm(`Delete "${project.name}"? This permanently removes the project and its stored assets.`);
    if (!confirmed) return;
    try {
      await deleteProjectFromServer(project.id);
      window.location.href = "/projects";
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "Project deletion failed.");
    }
  }

  async function handleDeleteAsset(asset: ProjectAsset) {
    if (!project) return;
    const confirmed = window.confirm(`Delete "${asset.name}" from this project?`);
    if (!confirmed) return;
    const current = project;
    const index = current.assets.findIndex(item =>
      asset.storageKey ? item.storageKey === asset.storageKey : item.name === asset.name && item.type === asset.type
    );
    if (index < 0) return;
    const assetKey = asset.storageKey || asset.name;
    const next = { ...current, assets: current.assets.filter((_, i) => i !== index), assetPools: removeAssetFromPools(current.assetPools || [], assetKey), updatedAt: "just now" };
    try {
      await saveProjectToServer(next);
      if (asset.storageKey) await deleteStoredAsset(asset.storageKey);
      setProject(await hydrateProjectAssets(next));
      if (selectedAssetKey === assetKey) setSelectedAssetKey(null);
      setAssetStatus("Asset deleted.");
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "Asset deletion failed.");
    }
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (!project) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setAssetStatus(files.length === 1 ? `Uploading ${files[0].name}…` : `Uploading ${files.length} files…`);
    try {
      const uploaded = await Promise.all(files.map(file => storeUploadedAsset(project.id, file)));
      const hydratedUploaded = (await Promise.all(uploaded.map(asset => hydrateAsset(asset)))).map(asset => backgroundIntent && isImage(asset) ? { ...asset, role: "background" as const, inProject: false } : asset);
      const latest = project;
      const savedProject = { ...latest, assets: [...latest.assets, ...hydratedUploaded], updatedAt: "just now" };
      setProject(savedProject);
      await saveProjectToServer({ ...savedProject, assets: savedProject.assets.map(item => item.storageKey?.startsWith("projects/") ? item : item.storageKey ? { ...item, url: undefined } : item) });
      if (backgroundIntent && hydratedUploaded.length === 1 && (isImage(hydratedUploaded[0])||isVideo(hydratedUploaded[0]))) setBackgroundDestinationKey(hydratedUploaded[0].storageKey||hydratedUploaded[0].name);
      setBackgroundIntent(false);
      setAssetStatus(uploaded.length === 1 ? `${uploaded[0].name} uploaded and saved` : `${uploaded.length} files uploaded and saved`);
    } catch (error) {
      setAssetStatus(error instanceof Error ? error.message : "The file could not be added.");
    } finally {
      event.target.value = "";
    }
  }

  async function generateAsset(type: GeneratorType, explicitPrompt?: string, options?: { sourceKey?: string | null; voice?: string | null; baseProject?: Project; durationSeconds?: number; lyrics?: string; aspectRatio?: string }) {
    if (!project || assetBusy) return;
    let promptImage = "";
    const referenceKey = options ? options.sourceKey : type === "video" ? videoReferenceKey : "";
    if ((type === "video" || type === "image") && referenceKey) {
      const selectedAsset = project.assets.find(asset => (asset.storageKey || asset.name) === referenceKey);
      if (!selectedAsset) { setAssetStatus("The selected video reference image is no longer available."); return; }
      try {
        const hydrated = await hydrateAsset(selectedAsset);
        promptImage = hydrated.url || "";
      } catch {}
      if (!promptImage) { setAssetStatus("The selected reference image could not be loaded. Refresh the project and try again."); return; }
    }
    const requested = (explicitPrompt || "").trim();
    if (!requested) { setAssetStatus(`Describe the ${type} you want to generate.`); return; }
    setShowGenerator(false);
    setAssetBusy(true);
    setAssetStatus(type === "video" && promptImage ? "Generating video from reference image…" : `Generating ${type}…`);

    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: requested.trim(), type, ...(promptImage ? { promptImage } : {}), ...(type === "image" ? { aspectRatio: promptImage ? "auto" : (options?.aspectRatio || "16:9") } : {}), ...(options?.voice ? { voice: options.voice } : {}), ...(type === "music" ? { durationSeconds: options?.durationSeconds, lyrics: options?.lyrics } : {}) }),
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

      const latest = projectRef.current || options?.baseProject || project;
      const name = `${type[0].toUpperCase()}${type.slice(1)} ${latest.assets.length + 1}`;
      const generatedAsset = { name, type: data.model || type, url, ...(type === "music" ? { durationSeconds: data.durationSeconds } : {}) };

      const storedAsset = await storeGeneratedAsset(project.id, generatedAsset);
      const asset: ProjectAsset = !options && backgroundIntent && (type === "image"||type === "video") ? { ...storedAsset, role: "background", inProject: false } : storedAsset;

      const savedProject = { ...latest, assets: [...latest.assets, asset], updatedAt: "just now" };
      setProject(savedProject);
      await saveProjectToServer({ ...savedProject, assets: savedProject.assets.map(item => item.storageKey?.startsWith("projects/") ? item : item.storageKey ? { ...item, url: undefined } : item) });
      if (backgroundIntent && (type === "image"||type === "video")) setBackgroundDestinationKey(asset.storageKey||asset.name);
      setBackgroundIntent(false);
      setGeneratorPrompt("");
      setShowGenerator(false);
      setAssetStatus(`${name} generated and saved`);
      return { project: savedProject, name };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${type} generation failed.`;
      setAssetStatus(message);
      if (options) throw new Error(message);
    } finally {
      setAssetBusy(false);
    }
  }

  function placeSceneImage(index: number, role: "background" | "layer") {
    if (!project || !(isImage(project.assets[index]) || isVideo(project.assets[index]))) return;
    const asset = project.assets[index];
    const assets = project.assets.map((item, i) => i === index
      ? { ...item, inProject: true, role }
      : role === "background" && item.inProject && item.role === "background"
        ? { ...item, inProject: false }
        : item);
    persist({ ...project, assets, updatedAt: "just now" });
    setPreviewMode("overlay");
    setAssetStatus(role === "background" ? asset.name + " is the draft background. The previous background remains in your asset library." : asset.name + " is an image layer over your draft background. Use Edit / Crop to adjust its position, size and appearance.");
  }

  function toggleAssetInProject(index: number) {
    if (!project) return;
    const asset = project.assets[index];
    const adding = !asset.inProject;
    const role: ProjectAsset["role"] = isImage(asset) ? (project.assets.some(a => a.inProject && a.role === "background") ? "layer" : "background") : isVideo(asset) ? "video" : "audio";
    const nextAssets = project.assets.map((item, i) => i === index ? { ...item, inProject: adding, role: adding ? role : item.role } : item);
    persist({ ...project, assets: nextAssets, updatedAt: "just now" });
    setPreviewMode("overlay");
    setAssetStatus(adding ? asset.name + " added to the draft overlay." : asset.name + " removed from the draft overlay.");
  }

  function useImageAsBlankBoardBackground(index: number) {
    if (!project) return;
    const asset = project.assets[index];
    if (!asset || !(isImage(asset)||isVideo(asset))) return;
    const blankBoard = (project.gameTools || []).find(tool => tool.type === "blank-board" && tool.enabled);
    if (!blankBoard) { setAssetStatus("Add a Blank Board first, then choose its background image."); return; }
    const assetKey = asset.storageKey || asset.name;
    const nextAssets = project.assets.map((item, i) => i === index ? { ...item, inProject: true, role: "background" as const } : item);
    const currentKeys = Array.isArray(blankBoard.config?.backgroundAssetKeys) ? blankBoard.config.backgroundAssetKeys.map(String) : [];
    const backgroundAssetKeys = Array.from(new Set([...currentKeys, assetKey]));
    const nextTools = (project.gameTools || []).map(tool => tool.id === blankBoard.id
      ? { ...tool, config: { ...(tool.config || {}), backgroundAssetKey: assetKey, backgroundAssetKeys } }
      : tool);
    persist({ ...project, assets: nextAssets, gameTools: nextTools, updatedAt:"just now" });
    setPreviewMode("overlay");
    setAssetStatus(`${asset.name} is now the Blank Board background.`);
  }

  function saveAssetEdits(index: number, nextAsset: ProjectAsset) {
    if (!project) return;
    const nextAssets = project.assets.map((asset, assetIndex) => assetIndex === index ? nextAsset : asset);
    persist({ ...project, assets: nextAssets, updatedAt: "just now" });
  }

  async function saveAssetAsNew(nextAsset: ProjectAsset) {
    if (!project || !nextAsset.url) return;
    if (!nextAsset.edits) {
      const stored=await storeGeneratedAsset(project.id,{name:nextAsset.name,type:nextAsset.type,url:nextAsset.url});
      const latest=projectRef.current || project;
      persist({...latest,assets:[...latest.assets,stored],updatedAt:"just now"});
      setAssetStatus(nextAsset.name+" saved as a new asset.");
      return;
    }
    const renderUrl=nextAsset.storageKey?.startsWith("projects/") ? `/api/assets/content?key=${encodeURIComponent(nextAsset.storageKey)}` : nextAsset.url;
    if (isVideo(nextAsset)) {
      const start=Math.max(0,nextAsset.edits?.trimStart||0);
      const source=document.createElement("video");
      source.crossOrigin="anonymous"; source.preload="auto"; source.src=renderUrl;
      setAssetStatus("Preparing trimmed video…");
      await new Promise<void>((resolve,reject)=>{source.onloadedmetadata=()=>resolve();source.onerror=()=>reject(new Error("Could not load video for trimming."));});
      const end=Math.min(nextAsset.edits?.trimEnd||source.duration,source.duration);
      if(!Number.isFinite(end)||end<=start+.05) throw new Error("Choose a valid video trim range.");
      const capture=(source as HTMLVideoElement & {captureStream?:()=>MediaStream}).captureStream;
      if(!capture||typeof MediaRecorder==="undefined") throw new Error("Video trimming requires a browser with MediaRecorder support.");
      await new Promise<void>(resolve=>{if(Math.abs(source.currentTime-start)<.05)return resolve();source.onseeked=()=>resolve();source.currentTime=start;});
      await source.play();
      const stream=capture.call(source);
      const preferred=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(t=>MediaRecorder.isTypeSupported(t))||"";
      const recorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
      const chunks:BlobPart[]=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      const finished=new Promise<Blob>((resolve,reject)=>{recorder.onerror=()=>reject(new Error("Video trim recording failed."));recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||"video/webm"}));});
      recorder.start(250);
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
    image.src = renderUrl;
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

  function saveAssetPools(assetPools: NonNullable<Project["assetPools"]>) {
    const current = projectRef.current || project;
    if (current) persist({ ...current, assetPools, updatedAt: "just now" });
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!project || !draft.trim() || building) return;
    const text = draft.trim();
    const updated: Project = { ...project, updatedAt: "just now", messages: [...project.messages, { role: "user", text }] };
    setDraft(""); setBuilding(true);
    try {
      const context = { ...updated, messages:undefined, assets: updated.assets.map(({ url, ...asset }) => asset), publishedSnapshot: undefined };
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "draft-edit", request: text, history: updated.messages.slice(-30), project: context, selectedImageKey: videoReferenceKey || null, workspaceStage: workflowStep===1?"build":"workshop", selectedItem:buildSelection }) });
      let data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI editing is unavailable right now.");
      if(data.action?.type==='search'){
        const search=await fetch('/api/web-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:data.action.query})});
        const evidence=await search.json();if(!search.ok)throw new Error(evidence.error||'Web search is unavailable. No pool was created.');
        if(!evidence.results?.length)throw new Error('No search results were found. Try a more specific topic.');
        const followup=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'draft-edit',request:text,history:updated.messages.slice(-30),project:context,workspaceStage:workflowStep===1?'build':'workshop',selectedItem:buildSelection,searchEvidence:evidence.results})});
        data=await followup.json();if(!followup.ok)throw new Error(data.error||'The search results could not be turned into a pool.');
        if(data.action?.type==='search')throw new Error('The search completed, but a pool could not be created from these results.');
      }
      const baseProject={...(projectRef.current||updated),messages:updated.messages};
      const result = applyBuildChanges(baseProject, data.changes);
      const steps = Array.isArray(data.manualSteps) ? data.manualSteps.filter((step: unknown) => typeof step === "string") : [];
      const unapplied = Object.keys(data.changes || {}).length > 0 && !result.applied && !data.action;
      const affectedControls=result.project.controls.filter(control=>{const existing=baseProject.controls.find(item=>item.id===control.id);return !existing||JSON.stringify(existing)!==JSON.stringify(control);});
      const controlsSummary=affectedControls.length?`Updated draft dashboard ${affectedControls.length===1?"button":"buttons"}: ${affectedControls.map(control=>control.label).join(", ")}. You can review them in Build Space and try them in Test.`:"";
      const reply = [unapplied ? "I could not apply the requested changes. Your draft has not been changed." : result.warnings.length&&result.applied?"I applied part of your request, but could not complete every change. The remaining issues are listed below.": data.reply || (result.applied ? "I updated the draft." : "I could not apply that change."), controlsSummary, result.warnings.length?result.warnings.join("\n"):"", steps.length ? `How to do it manually:\n${steps.map((step: string, i: number) => `${i + 1}. ${step}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
      if (data.action) {
        const action = data.action;
        if (action.type === "trivia") {
          const generated = await generateTriviaList({count:action.count,categories:action.categories,baseProject:result.project});
          if (!generated) throw new Error("Trivia generation is already running.");
          persist({...generated.project,messages:[...updated.messages,{role:"assistant",text:generated.summary}]});
          return;
        }
        if (action.type === "tool") {
          const info = [...BOARD_LIBRARY,...TOOL_LIBRARY].find(t=>t.type===action.toolType);
          if (!info) throw new Error("That tool template is unavailable.");
          const tool: GameTool = {id:crypto.randomUUID(),type:action.toolType as GameToolType,name:action.name || info.name,enabled:true,inToolbox:action.toolType!=="blank-board",config:{...toolDefaults(action.toolType),...action.config}};
          let next:Project={...result.project,gameTools:[...(result.project.gameTools||[]),tool]};
          if(workflowStep===1)next=addCreationControl(next,'tool',tool.id).project;
          persist({...next,messages:[...updated.messages,{role:"assistant",text:tool.name+(workflowStep===1?" is connected in your draft. Try its controls in Test.":" is saved in Workshop. Customize its entries and appearance, then add it in Build Space.")} ]});
          setAiUndo(baseProject);
          return;
        }
        if (!["image","video","voice","music","sfx"].includes(action.type) || !action.prompt?.trim()) throw new Error("That generation request could not be understood.");
        if (action.sourceKey && !updated.assets.some(asset => asset.storageKey === action.sourceKey && isImage(asset))) throw new Error("Please identify an existing image for that request.");
        if (action.type === "voice" && !action.voice) {
          persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: "What kind of voice would you like—female or male?" }] });
          return;
        }
        const working = { ...result.project, messages: [...updated.messages, { role: "assistant" as const, text: "Generating your requested " + action.type + "…" }] };
        persist(working);
        await saveQueue.current;
        const generated = await generateAsset(action.type as GeneratorType, action.prompt, { sourceKey: action.sourceKey, voice: action.voice, baseProject: working, durationSeconds: action.durationSeconds, lyrics: action.lyrics });
        if (!generated) throw new Error("Generation could not start. Check whether another generation is already running.");
        persist({ ...generated.project, messages: [...updated.messages, { role: "assistant", text: generated.name + " is generated and saved in your assets for review." }] });
      } else {
        persist({ ...result.project, updatedAt: "just now", messages: [...updated.messages, { role: "assistant", text: reply }] });
        if(result.applied)setAiUndo(baseProject);
        if(workflowStep===1&&affectedControls.length){const focus=affectedControls.find(control=>control.action.startsWith('coin.cycle.'))||affectedControls.find(control=>control.action==='sequence')||affectedControls[0];setAiControlFocus({id:focus.id,request:Date.now()});}
      }
    } catch (error) {
      persist({ ...updated, messages: [...updated.messages, { role: "assistant", text: error instanceof Error ? `${error.message} Your request is in this chat; no draft edit was applied.` : "AI editing is unavailable. No draft edit was applied." }] });
    } finally { setBuilding(false); }
  }

  function trigger(control: Project["controls"][number]) {
    if (!project) return;
    if (control.toolIds?.some(id=>project.gameTools.some(t=>t.id===id && t.type==="youtube" && t.enabled)) || project.gameTools.some(t=>t.type==="youtube" && t.enabled && control.action===`tool.${t.id}`)) {setYoutubeToolOpen(true);setSideBySideTesting(true);setPreviewMode("dashboard");setEventLog(v=>[control.label+" → opened private YouTube search",...v].slice(0,4));return;}
    try{runtime.fire(control);}catch(e){setEventLog(v=>[e instanceof Error?e.message:"Action failed",...v].slice(0,4));return;} setPreviewMode("overlay");
    if (control.action === "wheel.spin") spinWheel();
    setEventLog(v => [control.label + " → action triggered", ...v].slice(0,4));
  }
  async function publish() {
    if (!project || publishing) return;
    const issues=buildReadiness(project);if(issues.length){setAssetStatus("Before publishing: "+issues.map(i=>i.message).join(" "));return;}
    if (project.assets.some(asset => (asset.inProject || project.controls.some(c=>c.action===`background.show.${asset.storageKey||asset.name}`)) && asset.storageKey && !asset.storageKey.startsWith("projects/"))) {
      setAssetStatus("Publish needs cloud-stored assets. Re-upload any browser-only asset before publishing.");
      return;
    }
    const { publishedSnapshot: _previous, cardPreviewStates:_previewCards, ...draft } = project;
    const snapshot = { ...draft, gameTools:draft.gameTools.map(t=>({...t,inOverlayBuild:Boolean(t.inOverlayBuild)})), wheel:{...draft.wheel,spinning:false,visible:false}, compositions: (draft.compositions || []).filter(c => c.inProject), status: "Published" as const, updatedAt: "just now" };
    const next = { ...project, status: "Published" as const, publishedSnapshot: snapshot, updatedAt: "just now" };
    setPublishing(true);
    try {
      await saveQueue.current;
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
  const visibleAssets=project.assets.filter(asset=>{
    const kind=assetCategory(asset);
    return (assetKindFilter==="all"||kind===assetKindFilter) && (!assetSearch.trim()||`${asset.name} ${asset.type}`.toLowerCase().includes(assetSearch.trim().toLowerCase()));
  });
  const selectedAssetIndex=project.assets.findIndex(asset=>(asset.storageKey||asset.name)===selectedAssetKey);
  const selectedAsset=selectedAssetIndex>=0?project.assets[selectedAssetIndex]:null;
  const editingBoard=project.gameTools.find(t=>t.id===boardDesignerId);
  if(editingBoard)return <main className="workspace-page"><BoardDesigner key={editingBoard.id} project={project} tool={editingBoard} onSave={next=>{const current=projectRef.current||project;persist({...current,gameTools:current.gameTools.map(t=>t.id===next.id?{...next,config:{...next.config,...(t.type==='trivia-board'?{categories:t.config.categories}: {})}}:t)});}} onClose={()=>setBoardDesignerId("")} onCreateArtwork={()=>{setBoardDesignerId("");setShowGenerator(true);setGeneratorType("video");setGeneratorPrompt("Create a seamless animated game board background. Keep game spaces readable. ");setBackgroundIntent(true);}}/></main>;
  const draftOverlay = <>{(() => { const selected = project.assets.filter(a => a.inProject && a.url); const bg = project.assets.find(a => runtime.backgroundKey && (a.storageKey || a.name) === runtime.backgroundKey) || selected.find(a => a.role === "background"); const layers = selected.filter(a => a.role !== "background"); return <><div className="stage-scan"/>{bg && <OverlayAsset asset={bg} background className="builder-preview-background"/>}<div className="builder-preview-layers">{layers.map((a,i) => <OverlayAsset key={(a.storageKey || a.name)+i} asset={a} className="builder-preview-media"/>)}</div>{(() => { const trivia = (project.gameTools || []).find(t => t.type === "trivia-board" && t.enabled && t.inOverlayBuild); const config:any = triviaConfig || trivia?.config; if (!trivia || !Array.isArray(config?.categories) || config.categories.length !== 5) return null; if (activeTrivia) { const [ci,qi]=activeTrivia.split(":").map(Number); const cat=config.categories[ci]; const q=cat?.questions?.[qi]; if (!cat || !q) return null; return <div className="runtime-trivia" style={overlayToolPlacement(trivia)}><div className="runtime-trivia-board-label">NEON TRIVIA NIGHT</div><div className="runtime-trivia-category">{cat.name}</div><div className="runtime-trivia-value">${q.value}</div><div className="runtime-trivia-question">{q.prompt}</div>{triviaAnswerRevealed&&<div className="runtime-trivia-answer"><span>ANSWER</span>{q.answer}</div>}{q.source&&<div className="runtime-trivia-source">Source: {q.source}</div>}</div>; } if(trivia.config.triggerOnly)return null; return <div className="runtime-jeopardy" style={overlayToolPlacement(trivia)}><BoardArtwork tool={trivia} project={project}/><div className="runtime-jeopardy-title">NEON TRIVIA NIGHT</div><div className="runtime-jeopardy-grid">{config.categories.map((cat:any,ci:number)=><div className="runtime-jeopardy-column" key={`${cat.name}-${ci}`}><div className="runtime-jeopardy-category">{cat.name}</div>{(cat.questions||[]).slice(0,5).map((q:any,qi:number)=><div className={`runtime-jeopardy-value ${q.used?"used":""}`} key={`${q.value}-${qi}`}>{q.used?"USED":`${q.value}`}</div>)}</div>)}</div><div className="runtime-jeopardy-help">Choose a clue from the Trivia Board controls</div></div>; })()}<div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></>; })()}<RuntimeActionLayers runtime={runtime} project={project}/><YouTubeOverlayPlayer state={youtubePreview} interactive onStatus={(feedback)=>{youtubeActualPosition.current=feedback.position;setYoutubeFeedback(previous=>previous?.playbackId===feedback.playbackId && previous.status===feedback.status && previous.errorCode===feedback.errorCode ? previous : {playbackId:feedback.playbackId,status:feedback.status,errorCode:feedback.errorCode});}}/>{previewAction&&<CompositionPlayer key={`${previewAction.control.id}-${previewAction.at}`} composition={previewAction.composition} assets={project.assets} placement={previewAction.control.overlayResult||defaultOverlayResult} startedAt={previewAction.at} onEnd={()=>setPreviewAction(null)}/>}</>;
  return <main className="workspace-page">
    <header className="workspace-topbar"><Link href="/" className="back">← TTCGameLab</Link><div className="workspace-title">{renamingProject ? <form onSubmit={saveProjectTitle} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input autoFocus aria-label="Project title" maxLength={100} value={projectTitleDraft} onChange={event => { setProjectTitleDraft(event.target.value); }} onKeyDown={event => { if (event.key === "Escape") setRenamingProject(false); }} style={{ minWidth: 180, maxWidth: "35vw", padding: "8px 10px", borderRadius: 8, color: "#fff", background: "#172032", border: "1px solid #3ddde6" }}/><button type="submit">Save</button><button type="button" onClick={() => setRenamingProject(false)}>Cancel</button></form> : <>{project.name} <button type="button" aria-label="Rename project" title="Rename project" onClick={() => { setProjectTitleDraft(project.name); setRenamingProject(true); }} style={{ marginLeft: 8, cursor: "pointer" }}>✎ Rename</button></>} <span>{project.status}</span></div><div className="workspace-actions"><div className="workspace-save-group"><button type="button" className="build-btn" onClick={saveProgress} disabled={saveBusy || assetBusy || building}>{saveBusy ? "Saving…" : "Save progress"}</button><small role="status" aria-live="polite">{saveStatus || "Draft changes save automatically."}</small></div><button type="button" onClick={handleDeleteProject} className="danger-btn">Delete Project</button></div></header>
    <section className={"workshop-flow"+(workflowStep===1?" compact-build-heading":"")} ref={workflowRef} aria-label="Project workflow">
      <div className="workshop-flow-heading">
        <div><small>YOUR PROJECT</small><h1>{["Brainstorm & create", "Build & implement", "Review & publish"][workflowStep]}</h1></div>
        <Link href="/guide" target="_blank" rel="noreferrer" className="outline-btn">How to use TTCGameLab</Link>
      </div>
      <ProjectWorkflowNav stage={workflowStep} workshopSection={workshopStep} onStageChange={chooseWorkflowStep}/>
      <div className="workshop-next"><div><small>{workflowStep === 0 ? ["GAME PLAN", "ASSETS & TOOLS", "SCENES & EFFECTS"][workshopStep] : workflowStep === 1 ? "BUILD SPACE" : "PUBLISH"}</small>
        <h2>{workflowStep === 0 ? ["Brainstorm your experience and how it works", "Create the pieces for your game", "Create scenes, effects and interactions"][workshopStep] : workflowStep === 1 ? "Connect your dashboard to the overlay" : "Approve your overlay and dashboard, then publish"}</h2>
        <p>{workflowStep === 0 ? [
          "Brainstorm with AI or write your own plan. Develop the theme, purpose, rules, rounds, turns, scoring and how someone wins. Refine the framework and play-through here before building it.",
          "Create everything your overlay and dashboard need: images, videos, audio, cards, boards and customized tools. Generate, upload, edit or ask AI for changes. Your creations stay available for assembly in Build Space.",
          "Create optional cutscenes, sparkles, sound, animations and interactive features. Use Asset Composer to combine and preview them, then save the finished pieces for your project."
        ][workshopStep] : workflowStep === 1 ? "Turn your Workshop creations into a working experience. Arrange the overlay, customize your host dashboard, connect buttons to actions, and rehearse both together. Return to Workshop whenever you need more pieces." : "Publish your approved overlay and its controlling dashboard together. Add the audience overlay URL as a Link source in TikTok LIVE Studio; keep the dashboard URL private. Saving a draft does not update the published experience."}</p></div>
        <div className="workshop-step-actions">
          {workflowStep === 0 && workshopStep === 0 && <button className="build-btn" type="button" onClick={() => {document.getElementById("game-plan")?.scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("game-theme")?.focus({preventScroll:true});}}>Start my game plan</button>}
          {workflowStep === 0 && workshopStep === 1 && <button className="build-btn" type="button" onClick={() => openWorkshopTool("media",true)}>Create overlay background</button>}
          {workflowStep === 0 && workshopStep === 2 && <button className="build-btn" type="button" onClick={() => {setEditingComposition(undefined);setShowAssetComposer(true);}}>Create a scene or effect</button>}
          {workflowStep === 1 && <button className="outline-btn" type="button" onClick={() => chooseWorkflowStep(0,1)}>Return to Workshop</button>}
          {workflowStep === 2 && <button className="build-btn" type="button" onClick={publish} disabled={publishing || assetBusy || building}>{publishing ? "Publishing…" : project.publishedSnapshot ? "Publish latest changes" : "Publish experience"}</button>}
        </div>
      </div>
      {workflowStep === 0 && <details key={"game-plan-"+workshopStep} open={workshopStep === 0} className="game-plan" id="game-plan" aria-label="Game plan"><summary style={{cursor:"pointer",fontWeight:700}}>Your game plan{workshopStep !== 0 && <span style={{fontWeight:400}}> · {project.name || "Untitled project"} · Open to review or edit</span>}</summary><div className="game-plan-fields"><label htmlFor="game-title">Project or game title<span id="game-title-help">Give your project a name so you can find it in your saved projects. You can change it later.</span><input id="game-title" type="text" aria-describedby="game-title-help" value={project.name === "New Project" ? "" : project.name} placeholder="Example: Lady Lovelace’s Lyric Showdown" onChange={event => persist({...project,name:event.target.value,updatedAt:"just now"})}/></label>{[
        ["theme","Game theme & style","Example: a futuristic neon music gameshow; a spooky haunted-hotel mystery; or a colorful tropical trivia night."],
        ["purpose","Purpose and goal","What should players or the audience accomplish?"],
        ["rules","Rules and play-through","Describe what happens from the start to the end of a game."],
        ["rounds","Rounds","How many rounds, and what happens in each?"],
        ["turns","Turns and players","Who plays, and how do turns move between players?"],
        ["scoring","Points and scoring","How are points awarded or taken away?"],
        ["winning","Winning and ties","How does the game end? How are ties resolved?"]
      ].map(([key,label,placeholder]) => <label key={key} htmlFor={"game-"+key}>{label}{key === "theme" && <span id="game-theme-help">Describe the world, mood and visual style of your game. What is it about, and how should it look and feel? For example: a futuristic neon music gameshow, a spooky haunted-hotel mystery, or a colorful tropical trivia night.</span>}<textarea aria-describedby={key === "theme" ? "game-theme-help" : undefined} id={"game-"+key} value={project.gamePlan?.[key] || ""} placeholder={placeholder} onChange={event => persist({...project,gamePlan:{...project.gamePlan,[key]:event.target.value},updatedAt:"just now"})}/></label>)}</div><button type="button" className="outline-btn" onClick={() => {setDraft("Help develop the framework and play-through for this game plan: " + JSON.stringify({title:project.name,...project.gamePlan}));promptRef.current?.focus();}}>Discuss this game plan with AI</button></details>}
      {workflowStep === 0 && <div className="creation-tools-folder"><CollapsibleFolder title="Creation tools" count={10} description="Artwork, media, cards, boards, tools and scenes" storageKey={`${project.id}:creation-tools`} defaultOpen={workshopStep === 1} expandKey={workshopStep === 1 ? "assets-section" : ""} keepMounted><div className="workshop-tools" role="group" aria-label="Workshop creation tools"><strong>CREATE IN WORKSHOP</strong>
        <button type="button" onClick={() => openWorkshopTool("media",true)}>Create background artwork</button>
        <button type="button" onClick={() => {chooseWorkflowStep(0,1);setBackgroundIntent(true);fileInputRef.current?.click();}}>Upload background image</button>
        <button type="button" onClick={() => {chooseWorkflowStep(0,1);setBackgroundIntent(false);fileInputRef.current?.click();}}>Upload other assets</button>
        <button type="button" onClick={() => openWorkshopTool("media")}>Generate media</button>
        <button type="button" onClick={() => openWorkshopTool("trivia")}>Generate trivia</button>
        <button type="button" onClick={() => {chooseWorkflowStep(0,1);setShowBoardGuide(true);}}>Create an interactive game board</button>
        <button type="button" onClick={() => openWorkshopTool("tools")}>Create game tools</button><button type="button" onClick={openNewList}>Create list and cards</button>
        <button type="button" onClick={() => {setSideBySideTesting(false);requestAnimationFrame(()=>document.getElementById("workshop-assets")?.scrollIntoView({behavior:"smooth",block:"start"}));}}>Organize assets &amp; pools</button>
        <button type="button" onClick={() => {chooseWorkflowStep(0,2);setEditingComposition(undefined);setShowAssetComposer(true);}}>Asset Composer</button>
      </div></CollapsibleFolder></div>}
      {workflowStep === 0 && <section className="workshop-help" aria-label="Artwork and interactive board guide">
        <button type="button" className="outline-btn" aria-expanded={showBoardGuide} onClick={() => {chooseWorkflowStep(0,1);setShowBoardGuide(!showBoardGuide);}}>Combine artwork with an interactive board</button>
        {showBoardGuide && <div className="workshop-help-grid">
          <article><h3>1. Choose how your board works</h3><p>Artwork gives your board its look. The interactive board supplies selectable areas and reveal behavior. Both are saved in this project.</p><button type="button" className="outline-btn" onClick={() => openWorkshopTool("boards")}>Choose a board template</button><button type="button" className="outline-btn" onClick={() => void addGameTool("blank-board")}>Create a custom board</button></article>
          <article><h3>2. Create or upload the artwork</h3><p>Generate a new image, upload your own, or use an image already saved below.</p><button type="button" className="outline-btn" onClick={() => openWorkshopTool("media",true)}>Generate board artwork</button><button type="button" className="outline-btn" onClick={() => {setBackgroundIntent(true);fileInputRef.current?.click();}}>Upload board artwork</button></article>
          <article><h3>3. Connect artwork to your custom board</h3><p>Choose the custom board, then an image. This saves the image as that board’s background; your other images remain available.</p><label htmlFor="guide-board">Custom board<select id="guide-board" value={guideBoardId} onChange={event => setGuideBoardId(event.target.value)}><option value="">Choose a custom board</option>{(project.gameTools || []).filter(tool => tool.type === "blank-board").map(tool => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></label>
          {!(project.gameTools || []).some(tool => tool.type === "blank-board") && <p>Create a custom board in step 1 to connect your artwork.</p>}
          {project.assets.filter(isImage).length === 0 && <p>Create or upload an image in step 2 to continue.</p>}
          {project.assets.filter(isImage).map((asset,index) => <button key={(asset.storageKey || asset.name)+index} type="button" className="outline-btn" disabled={!guideBoardId} onClick={() => {const assetKey=asset.storageKey || asset.name;persist({...project,gameTools:(project.gameTools || []).map(tool => tool.id === guideBoardId ? {...tool,config:{...tool.config,backgroundAssetKey:assetKey,backgroundAssetKeys:Array.from(new Set([...(Array.isArray(tool.config?.backgroundAssetKeys) ? tool.config.backgroundAssetKeys : []),assetKey]))}} : tool),updatedAt:"just now"});setAssetStatus("Board artwork connected and saved. Use Build Space to position the board and wire its controls.");}}>Use {asset.name} as board artwork{(project.gameTools || []).find(tool => tool.id === guideBoardId)?.config?.backgroundAssetKey === (asset.storageKey || asset.name) ? " ✓" : ""}</button>)}</article>
          <article><h3>4. Assemble and test</h3><p>In Build Space, add the board to the overlay, position its interactive areas, and connect host controls. Preview the artwork and behavior together before publishing.</p><button type="button" className="build-btn" onClick={() => chooseWorkflowStep(1)}>Continue to Build Space</button></article>
        </div>}
      </section>}
      {workflowStep !== 2 && <details className="workshop-help"><summary>Guide: backgrounds, layers, tools, scenes and buttons</summary><div className="workshop-help-grid">
        <article><h3>Create a background</h3><p>In Workshop, generate or upload your background image. Use Edit / Crop to crop it and change its size, position or appearance. Ask AI about the edit for requested changes. Save it before assembly.</p></article>
        <article><h3>Add backgrounds and image layers</h3><p>In Build Space, choose Use as Background on a finished image. Choose Add as Image Layer for images over that background. Edit / Crop adjusts their position and zoom. Replacing a background keeps the old image saved.</p></article>
        <article><h3>Store customized tools</h3><p>Create and customize tools in Workshop. They are stored in the toolbox automatically. In Build Space, choose which tools to connect to dashboard buttons. Unused tools stay in the toolbox.</p></article>
        <article><h3>Create scenes and effects</h3><p>In Workshop, combine video, visual layers, voice, music, sound effects, text and effects in Asset Composer. Preview and save the composition. In Build Space, add the finished composition to the preview and assign a dashboard button.</p></article>
        <article><h3>Wire dashboard actions</h3><p>In Build Space, add and select a dashboard button. Assign a toolbox tool or composition. Choose Single Action or Multi-Link Chain Command. For chains, add supporting actions and choose their order and delays.</p></article>
        <article><h3>Test, save and publish</h3><p>Switch between Audience Overlay and Host Dashboard to test your build. Save progress whenever you stop. Return to Workshop for more creations at any time. Publish your approved preview, then check the two published pages together before going live.</p></article>
      </div></details>}
      {workflowStep === 2 && <div className="workshop-publish-links">{project.publishedSnapshot ? <><h3>Your published experience</h3><p>The dashboard controls your overlay. Keep its host link private.</p><div><button type="button" className="outline-btn" onClick={copyDashboardLink}>Copy private dashboard URL</button><Link className="outline-btn" href={privateDashboardUrl} target="_blank" rel="noreferrer">Open dashboard</Link><Link className="outline-btn" href={projectUrl + "/overlay"} target="_blank" rel="noreferrer">Open overlay</Link><button type="button" className="outline-btn" onClick={async () => {try {await navigator.clipboard.writeText(new URL(projectUrl + "/overlay",window.location.origin).toString());setDashboardLinkStatus("Overlay URL copied. Add it as a browser source in your streaming software.");} catch {setDashboardLinkStatus("Open the overlay and copy its address.");}}}>Copy overlay URL</button></div></> : <p>Your two URLs will be available after publishing.</p>}{dashboardLinkStatus && <p role="status">{dashboardLinkStatus}</p>}</div>}
      {workflowStep === 0 && <div className="workshop-progress">
        <button type="button" className="outline-btn" disabled={workshopStep === 0} onClick={() => chooseWorkflowStep(0,workshopStep-1)}>Previous section</button>
        <span>All editing tools remain available. You can revisit any section.</span>
        <button type="button" className="build-btn" onClick={() => workshopStep < 2 ? chooseWorkflowStep(0,workshopStep+1) : chooseWorkflowStep(1)}>{["Next: Assets & tools","Next: Scenes & effects","Continue to Build Space"][workshopStep]}</button>
      </div>}
      {workflowStep === 2 && <section className="publish-review" aria-label="Before publishing">
        <h3>Before you publish</h3>
        <p>Rehearse a complete round in Build Space. Check the appearance of your overlay, your host buttons, media playback, and how each item is cleared or stopped.</p>
        <p>You stay in control: only publishing updates the live experience. You can return to Workshop or Build Space to make more edits.</p>
        <button type="button" className="outline-btn" onClick={() => chooseWorkflowStep(1)}>Return to Build Space</button>
      </section>}
      {workflowStep === 2 && <section className="publish-review" aria-label="TikTok LIVE Studio setup">
        <h3>Connect your overlay to TikTok LIVE Studio</h3>
        <ol>
          <li>In your LIVE Studio scene, choose <strong>Add source → Link</strong> and paste the audience overlay URL.</li>
          <li>Match the source size to your scene. Check the mobile preview for cropping and readable text.</li>
          <li>Open your private dashboard on your computer, phone, or tablet to control the overlay. Never use that private link as the audience source.</li>
          <li>Before going live, test each image, animated clip, sound, and show / hide / stop control in LIVE Studio itself.</li>
        </ol>
        <p>Images and videos play inside the web overlay. A successful editor preview is not a guarantee that every uploaded file or audio track will play in your streaming setup.</p>
        <a className="outline-btn" href="https://www.tiktok.com/live/studio/help/article/Get-started-with-your-first-LIVE/Whats-a-source?lang=en" target="_blank" rel="noreferrer">TikTok’s source setup guide</a>
      </section>}

    </section>
    <div className={"workspace-grid workflow-layout workflow-stage-" + workflowStep + (workflowStep!==0 ? " general-build-space" : "")}>
      <section className={"chat-panel"+(workflowStep===1?" build-space-chat":"")}><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h2>{workflowStep === 0 ? "Workshop AI" : "Build Space AI"}</h2></div><div className="ai-orb">✦</div></div>{workflowStep===1&&<p className="build-ai-help">Describe the change in your own words. I can connect pools and buttons, place items, change their look, and set playback. Changes apply to your draft for testing.</p>}{aiUndo&&<button type="button" className="outline-btn" disabled={building} onClick={()=>{const previous=aiUndo;persist({...previous,publishedSnapshot:project.publishedSnapshot,status:project.status,messages:[...project.messages,{role:"assistant",text:"The last AI edit has been undone."}]});setAiUndo(null);}}>Undo last AI edit</button>}<CompactConversation messages={project.messages} busy={building}/><details className="chat-example-requests"><summary>Example requests</summary><div className="idea-card"><span>TRY A REQUEST</span>{(workflowStep===1?[
 ["Connect an image pool","Connect my image pool to one random draw/remove button. Ask me which pool if needed."],
 ["Add a scoreboard","Add and connect a scoreboard. Ask me which players or teams to include."],
 ["Adjust an item","Help me position and size the selected item on the overlay."]
 ]:[["Help me get started","Help me plan my game. Ask me what you need to know."],["Create media","Help me create the media my game needs."],["Customize a card","Help me customize a card for my game."]]).map(([label,prompt])=><button type="button" key={label} onClick={()=>setDraft(prompt)}>{label} <b>→</b></button>)}</div></details><form className="composer" onSubmit={sendMessage}><label className="workshop-prompt-label" htmlFor="workshop-prompt">What would you like to create or change?</label><textarea id="workshop-prompt" ref={promptRef} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={workflowStep===1?"Example: Connect my Prize Images pool to a random draw button and show images in the center.":"Example: Help me create a music quiz with easy host controls."}/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button className="send" type="submit" disabled={building||!draft.trim()}>{building ? "Working…" : "Apply my request"}</button></div>{showBoardTemplates&&<div className="idea-card"><span>BOARD TEMPLATES</span>{BOARD_LIBRARY.map(item=><button key={item.type} type="button" disabled={triviaBusy} onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>}{showToolTemplates&&<div className="idea-card"><span>TOOL TEMPLATES</span>{TOOL_LIBRARY.map(item=><button key={item.type} type="button" onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>}{showTriviaListGenerator&&<div className="idea-card generator-panel"><span>GENERATE TRIVIA</span><small>Choose how many questions you want. Categories are optional — type one or several separated by commas, or leave them blank and TTCGameLab will choose them.</small><label>NUMBER OF QUESTIONS<input type="number" min="1" max="500" value={triviaListCount} onChange={e=>setTriviaListCount(Math.max(1,Math.min(500,Number(e.target.value)||1)))}/></label><label>CATEGORIES (OPTIONAL)<textarea value={triviaListCategories} onChange={e=>setTriviaListCategories(e.target.value)} placeholder="Example: 90s music, science, horror movies, world history"/></label><button className="build-btn" type="button" disabled={triviaListBusy} onClick={()=>void generateTriviaList()}>{triviaListBusy ? "Generating & verifying…" : `Generate ${triviaListCount} Questions →`}</button>{triviaListQuestions.length>0&&<><small>{triviaListQuestions.length} questions ready; starred items need review.</small><div style={{maxHeight:320,overflow:"auto"}}>{triviaListQuestions.map((q:any,i:number)=><div key={`${q.question}-${i}`} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.12)"}}><strong>{i+1}. {q.question}{q.verificationStatus==="needs-review" ? " * Needs verification" : " ✓ Verified"}</strong><div>Answer: {q.answer}</div><small>{q.category} · <a href={q.sourceUrl} target="_blank" rel="noreferrer">{q.source}</a></small></div>)}</div><button type="button" onClick={()=>void downloadTriviaPdf()}>Download PDF</button><small>Saved in your toolbox. Connect it to a dashboard button in Build Space when needed.</small></>}</div>}{showGenerator&&<div className="idea-card generator-panel"><span>{backgroundIntent ? "CREATE OVERLAY BACKGROUND" : "GENERATE ASSET"}</span><small>Choose a media type, describe it here, then generate it directly.</small><div className="generator-types">{GENERATORS.map(item=><button key={item.type} type="button" className={generatorType===item.type?"active":""} disabled={assetBusy} onClick={()=>setGeneratorType(item.type)}>{item.icon} {item.label}</button>)}</div><textarea value={generatorPrompt} disabled={assetBusy} onChange={e=>setGeneratorPrompt(e.target.value)} placeholder={`Describe the ${generatorType} you want to generate…`}/>{generatorType==="image"&&<small className="generator-format-note">Horizontal TikTok Studio format · 16:9 (1920 × 1080 canvas). New images are generated in this shape to fit your overlay.</small>}{generatorType==="video"&&<label>Reference image (optional)<select value={videoReferenceKey} disabled={assetBusy} onChange={e=>setVideoReferenceKey(e.target.value)}><option value="">Text-to-video</option>{project.assets.filter(isImage).map((asset,i)=><option key={(asset.storageKey||asset.name)+i} value={asset.storageKey||asset.name}>{asset.name}</option>)}</select></label>}{generatorType==="music"&&<><label>Song length<select value={musicLengthMode} disabled={assetBusy} onChange={e=>setMusicLengthMode(e.target.value)}><option value="auto">Use the length in my description</option><option value="short">Short intro / custom length</option><option value="full">Full song</option></select></label>{musicLengthMode==="short"&&<label>Length in seconds<input type="number" min="3" max="120" step="1" value={musicDuration} disabled={assetBusy} onChange={e=>setMusicDuration(Number(e.target.value))}/></label>}<label>Lyrics (optional)<textarea value={musicLyrics} disabled={assetBusy} onChange={e=>setMusicLyrics(e.target.value)} placeholder="Paste the words you want sung, one lyric line per line."/></label><small>For a short intro, choose 20–25 seconds and use a few lyric lines so they fit. Short tracks use MiniMax Music 3; about $0.04–$0.05 for 20–25 seconds. Paste lyrics for vocals, or describe instrumental music. The model may finish before the selected length.</small></>}<button className="build-btn" type="button" disabled={assetBusy || !generatorPrompt.trim()} onClick={()=>void generateAsset(generatorType, generatorPrompt, generatorType === "music" ? { durationSeconds: musicLengthMode === "short" ? musicDuration : musicLengthMode === "full" ? 0 : undefined, lyrics: musicLyrics } : generatorType === "image" ? { aspectRatio: "16:9" } : undefined)}>{assetBusy ? "Generating media…" : `Generate ${generatorType} →`}</button></div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
      {backgroundDestinationKey&&(()=>{const asset=project.assets.find(a=>(a.storageKey||a.name)===backgroundDestinationKey);return asset?<section><BackgroundDestination project={project} asset={asset} onChange={persist}/><button type="button" onClick={()=>setBackgroundDestinationKey("")}>Done choosing background destination</button></section>:null;})()}
      {workflowStep===1 && <BuildSpace focusControl={aiControlFocus} onSelect={setBuildSelection} cardStates={runtime.cardStates} onPublishStep={()=>chooseWorkflowStep(2)} feedback={eventLog[0]} project={project} onChange={persist} overlay={draftOverlay} onTrigger={trigger} onWorkshop={()=>chooseWorkflowStep(0,1)} youtubeOpen={youtubeToolOpen} onOpenYoutube={()=>setYoutubeToolOpen(true)} onCloseYoutube={()=>setYoutubeToolOpen(false)} onYoutubeCommand={previewYoutube} youtubeState={youtubePreview} youtubeFeedback={youtubeFeedback} sequenceRunning={runtime.sequenceRunning} onStopSequence={runtime.stopSequence} sequenceError={runtime.sequenceError} dashboardExtras={toolId=><>{!toolId&&<GoogleSearch onSavePool={(name,results)=>{const current=projectRef.current||project;const pool={...createCardList(),name,config:{entries:results.map(result=>({id:crypto.randomUUID(),text:result.summary||result.title,sourceUrl:result.url,sourceTitle:result.title})),cards:[]}};persist({...current,gameTools:[...current.gameTools,pool]});}}/>}{project.gameTools.filter(t=>t.enabled&&t.inOverlayBuild&&infoTypes.includes(t.type)&&(!toolId||t.id===toolId)).map(t=><GameInfoHostPanel key={t.id} tool={t} state={runtime.cardStates[t.id]} onCommand={runtime.cardCommand}/>)}{project.gameTools.filter(t=>t.enabled&&t.inOverlayBuild&&t.type==="random-picker"&&(!toolId||t.id===toolId)).map(t=><PickerHostPanel key={t.id} project={project} tool={t} state={runtime.cardStates[t.id]} onCommand={runtime.cardCommand}/>)}{project.gameTools.filter(t=>t.enabled&&(t.type==="question-card"||t.type==="blank-card")&&(!toolId||t.id===toolId)).map(t=><QuestionHostPanel key={t.id} project={project} tool={t} state={runtime.cardStates[t.id]} onCommand={runtime.cardCommand}/>)}</>}/>}
      {workflowStep===0 && <section className="preview-panel"><div className="preview-head"><div><small>FULL LIVESTREAM PREVIEW</small><h2>{project.name}</h2></div><div className="preview-switch"><button type="button" aria-pressed={sideBySideTesting} onClick={()=>setSideBySideTesting(!sideBySideTesting)}>{sideBySideTesting ? "Exit side-by-side test" : "Test side by side"}</button><button className={previewMode==="overlay"?"active":""} onClick={()=>setPreviewMode("overlay")}>Audience Overlay</button><button className={previewMode==="dashboard"?"active":""} onClick={()=>setPreviewMode("dashboard")}>Host Dashboard</button><span className="preview-mode-badge">DRAFT PREVIEW</span></div></div><div className="stage" style={{display:sideBySideTesting || previewMode==="overlay" ? undefined : "none"}}>{(() => { const selected = project.assets.filter(a => a.inProject && a.url); const bg = project.assets.find(a => runtime.backgroundKey && (a.storageKey || a.name) === runtime.backgroundKey) || selected.find(a => a.role === "background"); const layers = selected.filter(a => a.role !== "background"); return <><div className="stage-scan"/>{bg && <OverlayAsset asset={bg} background className="builder-preview-background"/>}<div className="builder-preview-layers">{layers.map((a,i) => <OverlayAsset key={(a.storageKey || a.name)+i} asset={a} className="builder-preview-media"/>)}</div><div className="overlay-demo"><div className="overlay-live">● PREVIEW</div><div className="overlay-headline">{project.overlay.title === "YOUR LIVESTREAM" ? project.name : project.overlay.title}</div><div className="overlay-sub">{project.overlay.subtitle === "YOUR LIVE EXPERIENCE" ? "" : project.overlay.subtitle}</div></div>{(() => { const trivia = (project.gameTools || []).find(t => t.type === "trivia-board" && t.enabled && t.inOverlayBuild); const config:any = triviaConfig || trivia?.config; if (!trivia || !Array.isArray(config?.categories) || config.categories.length !== 5) return null; if (activeTrivia) { const [ci,qi]=activeTrivia.split(":").map(Number); const cat=config.categories[ci]; const q=cat?.questions?.[qi]; if (!cat || !q) return null; return <div className="runtime-trivia" style={overlayToolPlacement(trivia)}><div className="runtime-trivia-board-label">NEON TRIVIA NIGHT</div><div className="runtime-trivia-category">{cat.name}</div><div className="runtime-trivia-value">${q.value}</div><div className="runtime-trivia-question">{q.prompt}</div>{triviaAnswerRevealed&&<div className="runtime-trivia-answer"><span>ANSWER</span>{q.answer}</div>}{q.source&&<div className="runtime-trivia-source">Source: {q.source}</div>}</div>; } if(trivia.config.triggerOnly)return null; return <div className="runtime-jeopardy" style={overlayToolPlacement(trivia)}><BoardArtwork tool={trivia} project={project}/><div className="runtime-jeopardy-title">NEON TRIVIA NIGHT</div><div className="runtime-jeopardy-grid">{config.categories.map((cat:any,ci:number)=><div className="runtime-jeopardy-column" key={`${cat.name}-${ci}`}><div className="runtime-jeopardy-category">{cat.name}</div>{(cat.questions||[]).slice(0,5).map((q:any,qi:number)=><div className={`runtime-jeopardy-value ${q.used?"used":""}`} key={`${q.value}-${qi}`}>{q.used?"USED":`${q.value}`}</div>)}</div>)}</div><div className="runtime-jeopardy-help">Choose a clue from the Trivia Board controls</div></div>; })()}<div className="stage-corner top-left"/><div className="stage-corner top-right"/><div className="stage-corner bottom-left"/><div className="stage-corner bottom-right"/></>; })()}{(()=>{const control=project.controls.find(c=>c.id===selectedControlId&&c.compositionId);if(!control)return null;const r=dragPlacement?.id===control.id?dragPlacement:control.overlayResult||defaultOverlayResult;return <div className="overlay-placement-marker" style={{left:`${r.x}%`,top:`${r.y}%`,width:`${r.width}%`,height:`${r.height}%`}} onPointerDown={e=>startPlacement(e,control,e.target instanceof HTMLElement&&e.target.dataset.resize==="true")} onPointerMove={movePlacement} onPointerUp={endPlacement}><span>{control.label} · drag to position</span><i data-resize="true" title="Drag to resize"/></div>})()}<RuntimeActionLayers runtime={runtime} project={project}/>{(()=>{const asset=project.assets.find(a=>(a.storageKey||a.name)===positionAssetKey&&a.inProject&&a.role!=="background");return asset?<YouTubePlacementEditor label={asset.name} top={44} placement={asset.edits?.placement||{x:0,y:0,width:100,height:100}} onChange={placement=>persist({...project,assets:project.assets.map(a=>a===asset?{...a,edits:{...a.edits,placement}}:a)})}/>:null;})()}{selectedControlId&&project.controls.some(c=>c.id===selectedControlId&&c.toolIds?.some(id=>project.gameTools.some(t=>t.id===id&&t.type==="youtube"))) && <YouTubePlacementEditor placement={safeYoutubePlacement(project.gameTools.find(t=>t.type==="youtube")?.config.placement)} onChange={placement=>{persist({...project,gameTools:project.gameTools.map(t=>t.type==="youtube"?{...t,config:{...t.config,placement}}:t)});setYoutubePreview(current=>current?{...current,placement}:current);}}/>}<YouTubeOverlayPlayer state={youtubePreview} interactive onStatus={(feedback)=>{youtubeActualPosition.current=feedback.position;setYoutubeFeedback(previous=>previous?.playbackId===feedback.playbackId && previous.status===feedback.status && previous.errorCode===feedback.errorCode ? previous : {playbackId:feedback.playbackId,status:feedback.status,errorCode:feedback.errorCode});}}/>{previewAction&&<CompositionPlayer key={`${previewAction.control.id}-${previewAction.at}`} composition={previewAction.composition} assets={project.assets} placement={previewAction.control.overlayResult||defaultOverlayResult} startedAt={previewAction.at} onEnd={()=>setPreviewAction(null)}/>}</div><div className="dashboard-preview" style={{display:sideBySideTesting || previewMode==="dashboard" ? undefined : "none"}}><h3>{project.name} · Draft dashboard</h3><p>Build the dashboard with blank trigger buttons. Choose the Workshop creations you want here, then choose what each control does. Test these controls alongside the draft overlay before publishing.</p><div className="dashboard-toolbox"><small>CUSTOMIZED TOOLBOX</small>{(project.gameTools||[]).filter(tool=>tool.enabled && tool.type!=="trivia-board" && tool.inToolbox).map(tool=>{const selected=project.controls.find(control=>control.id===selectedControlId);const assigned=Boolean(selected?.toolIds?.includes(tool.id));return <div className="tool-library-row" key={tool.id}><div><b>{tool.name}</b><small>Customized workspace tool</small></div><button className="outline-btn" disabled={!selected||assigned} onClick={()=>selected&&assignToolToButton(selected.id,tool)}>{assigned?"✓ Assigned":selected?"+ Assign to selected button":"Select a dashboard button"}</button></div>})}</div><div className="dashboard-preview-buttons">{project.controls.filter(c=>!c.toolIds?.some(id=>project.gameTools.find(t=>t.id===id)?.type==="youtube")).map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div></div><div className="preview-foot"><span>Dashboard <b>/</b> Overlay <b>/</b> Events</span><span>{project.status} · {project.updatedAt}</span></div><CollapsibleFolder title="Quick rehearsal controls" count={project.controls.length} storageKey={`${project.id}:quick-rehearsal`} keepMounted><div className="control-strip"><div><small>HOST CONTROLS</small><strong>Trigger your generated experience</strong></div><div className="control-buttons">{project.controls.filter(c=>!c.toolIds?.some(id=>project.gameTools.find(t=>t.id===id)?.type==="youtube")).map(c=><button key={c.id} onClick={()=>trigger(c)}>{c.label}</button>)}</div>{eventLog.length>0&&<div className="event-log">{eventLog.map((x,i)=><span key={i}>✓ {x}</span>)}</div>}</div></CollapsibleFolder><CollapsibleFolder title="Advanced dashboard editing" count={project.controls.length} storageKey={`${project.id}:advanced-dashboard`} keepMounted><div className="dashboard-action-editor"><h3>Dashboard buttons</h3>{project.controls.map(control=><div className="dashboard-action-row" key={control.id}><button className="outline-btn" onClick={()=>{setSelectedControlId(control.id);setPreviewMode("overlay")}}>{control.label} · Edit Overlay Result</button>{control.compositionId&&<small>{project.compositions?.find(c=>c.id===control.compositionId)?.name||"Missing composition"}</small>}</div>)}{(()=>{const control=project.controls.find(c=>c.id===selectedControlId);if(!control)return null;const result=control.overlayResult||defaultOverlayResult;return <div className="overlay-result-editor"><h4>Configure Dashboard Button · {control.label}</h4><label>Button label<input value={control.label} onChange={e=>updateControl(control.id,{label:e.target.value})}/></label><label>Background action<select value={control.action.startsWith("background.show.")?control.action:""} onChange={e=>updateControl(control.id,{action:e.target.value || "unassigned",toolIds:[],compositionId:undefined,detail:e.target.value?"Show chosen background":"Unassigned dashboard button"})}><option value="">No background change</option>{project.assets.filter(a=>isImage(a)||isVideo(a)).map((asset,i)=><option key={(asset.storageKey||asset.name)+i} value={"background.show."+(asset.storageKey||asset.name)}>{asset.name}</option>)}</select></label><label>Button type<select value={control.buttonMode||"single"} onChange={e=>updateControl(control.id,{buttonMode:e.target.value as "single"|"chain"})}><option value="single">Single Action</option><option value="chain">Multi-Link Chain Command</option></select></label><div className="tool-config-list"><small>PRIMARY TOOLS · {(control.toolIds||[]).length}/2</small>{(control.toolIds||[]).map(id=>{const tool=(project.gameTools||[]).find(t=>t.id===id);return tool?<div className="tool-config" key={id}><b>{tool.name}</b><button className="danger-btn" onClick={()=>updateControl(control.id,{toolIds:(control.toolIds||[]).filter(x=>x!==id),action:control.action===`tool.${id}`?"":control.action})}>Remove</button></div>:null})}</div>{control.buttonMode==="chain"&&<div className="tool-config-list"><strong>CHAIN SUPPORTING ACTIONS</strong><small>Add media/effects to this button. Steps run in order. Each timed delay is measured after the previous step.</small><div className="trivia-actions">{project.assets.filter(a=>a.inProject).map((asset,i)=><button className="outline-btn" key={(asset.storageKey||asset.name)+i} onClick={()=>addChainStep(control.id,"asset",asset.storageKey||asset.name,asset.name)}>＋ {asset.name}</button>)}{(project.compositions||[]).filter(x=>x.inProject).map(comp=><button className="outline-btn" key={comp.id} onClick={()=>addChainStep(control.id,"composition",comp.id,comp.name)}>＋ {comp.name}</button>)}</div>{(control.chain||[]).map((step,index)=><div className="tool-config" key={step.id}><b>{index+1}. {step.label}</b><label>Timing<select value={step.timing.mode} onChange={e=>updateControl(control.id,{chain:(control.chain||[]).map(s=>s.id===step.id?{...s,timing:{...s.timing,mode:e.target.value as "immediate"|"delay"}}:s)})}><option value="immediate">Immediately</option><option value="delay">Timed delay</option></select></label>{step.timing.mode==="delay"&&<label>Seconds<input type="number" min="0" step=".1" value={step.timing.seconds||0} onChange={e=>updateControl(control.id,{chain:(control.chain||[]).map(s=>s.id===step.id?{...s,timing:{mode:"delay",seconds:Math.max(0,+e.target.value||0)}}:s)})}/></label>}<button className="danger-btn" onClick={()=>updateControl(control.id,{chain:(control.chain||[]).filter(s=>s.id!==step.id)})}>Remove</button></div>)}</div>}<button className="build-btn" onClick={()=>trigger(control)}>Test button</button>{control.compositionId&&<><label>Composition<select value={control.compositionId} onChange={e=>updateControl(control.id,{compositionId:e.target.value})}>{(project.compositions||[]).filter(c=>c.inProject).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>{(["x","y","width","height","layer","entranceSeconds","exitSeconds"] as const).map(key=><label key={key}>{key}<input type="number" value={result[key]} min={key==="width"||key==="height"?1:0} max={key==="layer"?100:100} step={key.endsWith("Seconds")?.1:1} onChange={e=>updateControl(control.id,{overlayResult:{...result,[key]:+e.target.value}})}/></label>)}{(["entrance","exit"] as const).map(key=><label key={key}>{key}<select value={result[key]} onChange={e=>updateControl(control.id,{overlayResult:{...result,[key]:e.target.value as typeof result[typeof key]}})}>{["none","fade","slide","zoom"].map(option=><option key={option}>{option}</option>)}</select></label>)}<button className="build-btn" onClick={()=>trigger(control)}>Test Trigger</button></>}<button className="danger-btn" onClick={()=>{persist({...project,controls:project.controls.filter(c=>c.id!==control.id)});setSelectedControlId(null)}}>Remove button</button></div>})()}</div></CollapsibleFolder></section>}
      <aside className="assets-panel">
        <div className="assets-head">
          <div>
            <small>PROJECT</small>
            <h2>Your assets & tools</h2>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>＋</button>
        </div>
        <div className="detail-block" id="workshop-assets">
          <h3>Media library</h3>
          <p className="asset-library-help">Open a media folder to find your assets. Select an item to edit, place it on the overlay, or add it to a game pool.</p>
          <CollapsibleFolder title="Asset pools" count={(project.assetPools || []).length} description="Named groups used by your game controls" storageKey={`${project.id}:pools`} keepMounted><AssetPoolManager pools={project.assetPools || []} assets={project.assets} onChange={saveAssetPools} saveStatus={saveStatus} /></CollapsibleFolder>
          <div className="workshop-assets-toolbar">
            <label className="workshop-assets-search">Find an asset<input type="search" value={assetSearch} onChange={event => setAssetSearch(event.target.value)} placeholder="Search by name" /></label>
            <label className="workshop-assets-filter">Show<select value={assetKindFilter} onChange={event => setAssetKindFilter(event.target.value as typeof assetKindFilter)}><option value="all">All media</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="other">Other files</option></select></label>
          </div>
          {visibleAssets.length > 0 ? <AssetFolders
            assets={visibleAssets} scope={`workshop:${project.id}`} selectedAssetKey={selectedAssetKey}
            searchKey={assetSearch.trim() || (assetKindFilter !== "all" ? `filter:${assetKindFilter}` : "")}
            renderAsset={asset => {
              const key=asset.storageKey||asset.name,kind=assetCategory(asset),selected=key===selectedAssetKey;
              return <button type="button" key={key} className={`workshop-asset-tile${selected?" selected":""}`} aria-pressed={selected} aria-label={`Select ${asset.name}, ${kind}`} onClick={()=>setSelectedAssetKey(key)}>
                <AssetThumbnail key={asset.url||key} asset={asset} kind={kind}/>
                <span className="workshop-asset-name">{asset.name}</span><small>{kind==="audio"?"Audio":kind==="other"?asset.type:kind[0].toUpperCase()+kind.slice(1)}</small>
              </button>;
            }}
          /> : <p className="empty-note">{project.assets.length===0?"Your saved assets will appear here. Create or upload something to get started.":"No assets match that search. Try a different name or media type."}</p>}
          {selectedAsset && <AssetDetailsDialog key={selectedAsset.storageKey||selectedAsset.name} label={`Actions for ${selectedAsset.name}`} onClose={()=>setSelectedAssetKey(null)}><section className="asset-detail-panel">
            <header><AssetThumbnail key={selectedAsset.url||selectedAsset.name} asset={selectedAsset} kind={assetCategory(selectedAsset)}/><div><h3>{selectedAsset.name}</h3><p>{selectedAsset.type} · {selectedAsset.inProject?"On the overlay":"In your library"}</p></div><button type="button" className="asset-detail-close" aria-label="Close asset details" onClick={()=>setSelectedAssetKey(null)}>×</button></header>
            <AssetPoolAssignment key={selectedAsset.storageKey||selectedAsset.name} asset={selectedAsset} pools={project.assetPools||[]} onChange={saveAssetPools}/>
            <p role="status">{saveStatus}</p>
            <div className="asset-detail-actions">
              {(isImage(selectedAsset)||isVideo(selectedAsset))&&<button type="button" className="build-btn" onClick={()=>{setSelectedAssetKey(null);setEditingAssetIndex(selectedAssetIndex);}}>Edit {isImage(selectedAsset)?"image":"video"}</button>}
              {(isImage(selectedAsset)||isVideo(selectedAsset))&&<><button type="button" className="outline-btn" onClick={()=>{placeSceneImage(selectedAssetIndex,"background");setSelectedAssetKey(null);}}>{selectedAsset.inProject&&selectedAsset.role==="background"?"Background selected":"Use as background"}</button><button type="button" className="outline-btn" onClick={()=>{placeSceneImage(selectedAssetIndex,"layer");setSelectedAssetKey(null);}}>{selectedAsset.inProject&&selectedAsset.role==="layer"?"Added as overlay layer":"Add as overlay layer"}</button></>}
              {!isImage(selectedAsset)&&!isVideo(selectedAsset)&&<button type="button" className="build-btn" onClick={()=>toggleAssetInProject(selectedAssetIndex)}>{selectedAsset.inProject?"Remove from overlay":"Add to overlay"}</button>}
              {selectedAsset.inProject&&selectedAsset.role!=="background"&&<button type="button" className="outline-btn" onClick={()=>{setPositionAssetKey(selectedAsset.storageKey||selectedAsset.name);setSideBySideTesting(true);setSelectedAssetKey(null);}}>Position and size on overlay</button>}
            </div>
            {(isVideo(selectedAsset)||isAudio(selectedAsset))&&<details className="asset-playback-options"><summary>Playback options</summary><label>Repeat this media<input type="checkbox" checked={selectedAsset.edits?.loop??isVideo(selectedAsset)} onChange={event=>persist({...project,assets:project.assets.map((asset,index)=>index===selectedAssetIndex?{...asset,edits:{...asset.edits,loop:event.target.checked}}:asset)})}/></label><label>Play sound<input type="checkbox" checked={selectedAsset.edits?.sound??isAudio(selectedAsset)} onChange={event=>persist({...project,assets:project.assets.map((asset,index)=>index===selectedAssetIndex?{...asset,edits:{...asset.edits,sound:event.target.checked}}:asset)})}/></label><label>Volume <span>{selectedAsset.edits?.volume??80}%</span><input type="range" min="0" max="100" value={selectedAsset.edits?.volume??80} onChange={event=>persist({...project,assets:project.assets.map((asset,index)=>index===selectedAssetIndex?{...asset,edits:{...asset.edits,volume:+event.target.value}}:asset)})}/></label></details>}
            {(isImage(selectedAsset)||isVideo(selectedAsset))&&<details className="asset-more-options"><summary>Other ways to use this</summary><BackgroundDestination project={project} asset={selectedAsset} onChange={persist}/>{(project.gameTools||[]).some(tool=>tool.type==="blank-board"&&tool.enabled)&&<button type="button" className="outline-btn" onClick={()=>useImageAsBlankBoardBackground(selectedAssetIndex)}>Use as board background</button>}</details>}
            <button type="button" className="danger-btn asset-detail-delete" onClick={()=>handleDeleteAsset(selectedAsset)}>Delete asset</button>
          </section></AssetDetailsDialog>}
        </div>
        <CollapsibleFolder title="Published links & sharing" storageKey={`${project.id}:sharing`} keepMounted><div className="detail-block">
          <span>PROJECT URL</span>
          <code>{projectUrl}</code>
          <Link href={privateDashboardUrl}>Open project ↗</Link>
          <button className="outline-btn" onClick={copyDashboardLink}>Copy Dashboard Link for Phone</button>
          {dashboardLinkStatus && <small role="status">{dashboardLinkStatus}</small>}
        </div></CollapsibleFolder>
        <CollapsibleFolder title="Scenes & effects" count={(project.compositions || []).length} description="Open Asset Composer or edit a saved scene" storageKey={`${project.id}:scenes`} expandKey={workshopStep === 2 ? "scenes-section" : ""} keepMounted><div className="detail-block asset-composer-launch">
          <span>ASSET COMPOSER</span>
          <p className="empty-note">Combine video, voice, music, SFX, text and effects on a synchronized multi-track timeline.</p>
          <button className="build-btn composer-open-btn" onClick={() => {setEditingComposition(undefined);setShowAssetComposer(true)}}>◫ Open Asset Composer</button>
          {(project.compositions || []).map(comp => <div className="saved-composition" key={comp.id}><div><b>{comp.name}</b><small>{comp.clips.length} clips · {comp.duration.toFixed(1)}s</small></div><button className="outline-btn build-only" onClick={()=>toggleComposition(comp.id)}>{comp.inProject?"✓ In Preview":"+ Add to Preview"}</button><button className="outline-btn" onClick={()=>{setEditingComposition(comp);setShowAssetComposer(true)}}>Edit</button><button className="build-btn build-only" disabled={!comp.inProject} onClick={()=>addCompositionControl(comp)}>Assign button</button><button className="danger-btn" onClick={() => deleteComposition(comp.id)}>Delete</button></div>)}
        </div></CollapsibleFolder>
        <CollapsibleFolder title="Game tools & cards" count={project.gameTools.filter(tool => tool.type !== "youtube").length} description="Cards, boards, questions and customized tools" storageKey={`${project.id}:tools`} keepMounted><div className="detail-block">
          <span>WORKSPACE CREATIONS</span>
          <p className="empty-note">Choose templates from Creation Tools above. Edit appearance and settings below, or customize them in chat, then add finished boards to the overlay and finished tools to the dashboard toolbox.</p>
          <div className="tool-config-list">
            <div className="background-destination"><h3>Create cards for your game</h3><button type="button" onClick={openNewList}>Create list and cards</button><button type="button" onClick={()=>createWorkshopCard("question")}>Create question and answer cards</button><button type="button" onClick={()=>createWorkshopCard("blank")}>Create blank card</button></div>{(project.gameTools || []).filter(tool => tool.type !== "youtube").map(tool => (
              <CollapsibleFolder key={tool.id} title={tool.name} description={tool.type.replace(/-/g," ")} storageKey={`${project.id}:tool:${tool.id}`} keepMounted><div className="tool-config">
                <div>
                  <b>{tool.name}</b>
                  <em>{tool.type}</em>{(tool.type==="blank-board"||tool.type==="trivia-board")&&<button type="button" onClick={()=>setBoardDesignerId(tool.id)}>Open board designer</button>}
                  {tool.type==="trivia-list" && <button type="button" onClick={()=>{setTriviaListQuestions(Array.isArray(tool.config.questions)?tool.config.questions:[]);setTriviaListCount(Number(tool.config.requestedCount)||10);setTriviaListCategories(Array.isArray(tool.config.suggestedCategories)?tool.config.suggestedCategories.join(", "):"");setShowTriviaListGenerator(true);promptRef.current?.scrollIntoView({behavior:"smooth",block:"center"});}}>Review saved questions</button>}
                  {tool.type==="card-list"?<><p>{savedListEntries(tool).length} pool entries · {Array.isArray(tool.config.cards)?tool.config.cards.length:0} cards</p><button type="button" onClick={()=>setListEditorId(tool.id)}>Open pool and card designer</button></>: (tool.type==="question-card"||tool.type==="blank-card")?<button type="button" onClick={()=>setNewCardEditorId(tool.id)}>Customize cards</button>:<GameToolEditor key={tool.id} tool={tool} project={project} assets={project.assets} onSave={next=>persist({...project,gameTools:(project.gameTools||[]).map(x=>x.id===next.id?next:x),updatedAt:"just now"})}/>}
                </div>
                <small>{(tool.type==="trivia-board" || tool.type==="blank-board") ? (tool.inOverlayBuild ? "✓ In Overlay Build" : "Board customization workspace") : (tool.inToolbox ? "✓ In Dashboard Toolbox" : "Tool customization workspace")}</small>{(tool.type === "trivia-board" || tool.type === "blank-board") ? <button className="build-btn build-only" disabled={tool.inOverlayBuild} onClick={()=>pushWorkspaceCreation(tool)}>{tool.inOverlayBuild ? "Added to Overlay Build" : "Add to Overlay Build"}</button> : <small>{tool.type === "youtube" ? "Connected to dashboard and overlay · test in the preview before publishing" : "Saved in Toolbox · connect to a button in Build Space when needed"}</small>}
              </div></CollapsibleFolder>
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
        </div></CollapsibleFolder>
        <CollapsibleFolder title="Wheel settings" storageKey={`${project.id}:wheel`} keepMounted><div className="detail-block">
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
        </div></CollapsibleFolder>
        <div className="detail-block">
          <span>NEW PROJECT</span>
          <button className="outline-btn" onClick={beginBlank}>＋ Start fresh</button>
        </div>
      </aside>
    </div>
    {showAssetComposer && <AssetComposer assets={project.assets} compositions={project.compositions || []} initial={editingComposition} onSave={saveComposition} onClose={() => setShowAssetComposer(false)} />}
    {editingAssetIndex !== null && project.assets[editingAssetIndex] && <MediaEditor asset={project.assets[editingAssetIndex]} onClose={() => setEditingAssetIndex(null)} onSave={next => saveAssetEdits(editingAssetIndex, next)} onSaveAsNew={saveAssetAsNew} />}
    {(showAssetComposer || editingAssetIndex !== null) && <div className="floating-ai"><button className="floating-ai-toggle" onClick={() => setChatDrawer(v => !v)} aria-expanded={chatDrawer}>✦ Ask AI about this edit</button>{chatDrawer && <section className="floating-ai-panel"><header><strong>AI Creative Director</strong><button onClick={() => setChatDrawer(false)} aria-label="Close chat">×</button></header><div className="floating-ai-messages">{project.messages.slice(-8).map((m,i)=><p key={i}><b>{m.role === "assistant" ? "AI" : "You"}</b><br/>{m.text}</p>)}{building&&<p>Working on your request…</p>}</div><form onSubmit={sendMessage}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Describe the change you want…"/><button type="submit" disabled={building}>Send</button></form></section>}</div>}
    {listEditorId&&project.gameTools.find(t=>t.id===listEditorId)&&<dialog ref={listDialog} className="card-creation-dialog" aria-label="List and card creator" onCancel={()=>setListEditorId("")}><button type="button" onClick={()=>{listDialog.current?.close();setListEditorId("");}}>Close list creator</button><CardListEditor key={listEditorId} project={project} tool={project.gameTools.find(t=>t.id===listEditorId)!} onSave={next=>{const current=projectRef.current||project;persist({...current,gameTools:current.gameTools.map(t=>t.id===next.id?next:t)});}}/></dialog>}
    {newCardEditorId&&project.gameTools.find(t=>t.id===newCardEditorId)&&<dialog ref={newCardDialog} className="card-creation-dialog" aria-label="Card designer" onCancel={()=>setNewCardEditorId("")}><button type="button" className="outline-btn" onClick={()=>{newCardDialog.current?.close();setNewCardEditorId("");}}>Close card editor</button><p role="status">Follow the steps below to customize your card, then save your changes.</p><QuestionCardEditor key={newCardEditorId} project={project} tool={project.gameTools.find(t=>t.id===newCardEditorId)!} onSave={next=>{const current=projectRef.current||project;persist({...current,gameTools:current.gameTools.map(t=>t.id===next.id?next:t)});}}/></dialog>}
  </main>;
}


function BackgroundDestination({project,asset,onChange}:{project:Project;asset:ProjectAsset;onChange:(p:Project)=>void}){
 const [destination,setDestination]=useState(''),[target,setTarget]=useState(''),[saved,setSaved]=useState(false);
 const cards=project.gameTools.filter(t=>t.enabled&&(destination==='blank'?t.type==='blank-card':t.type==='question-card'));
 const key=asset.storageKey||asset.name;
 function apply(){if(destination==='overlay'){onChange({...project,assets:project.assets.map(a=>a===asset?{...a,inProject:true,role:'background'}:a.role==='background'?{...a,inProject:false}:a)});}else if(destination==='later'){onChange(project);}else if(target){const cardKey=destination==='answer'?'answerCard':'questionCard';onChange({...project,gameTools:project.gameTools.map(t=>t.id===target?{...t,config:{...t.config,[cardKey]:{...((t.config[cardKey]||{}) as Record<string,unknown>),backgroundKey:key}}}:t)});}else onChange(createCardSystem(project,key,destination as 'question'|'answer'|'blank'));setSaved(true);}
 return <div className="background-destination"><h3>Where would you like to use this background?</h3><label>Use background for<select value={destination} onChange={e=>{setDestination(e.target.value);setTarget('');setSaved(false);}}><option value="">Choose a destination</option>{isImage(asset)&&<><option value="question">Question card</option><option value="answer">Answer card</option><option value="blank">Blank card</option></>}<option value="overlay">Overlay background</option><option value="later">Save for later in asset library</option></select></label>{['question','answer','blank'].includes(destination)&&<label>Apply to card<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Create a new card</option>{cards.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}<button type="button" disabled={!destination} onClick={apply}>Use background</button>{saved&&<span role="status">Saved. Customize card text in its design controls below; this background can be reused.</span>}</div>;
}
