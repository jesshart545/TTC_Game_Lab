"use client";

import { FormEvent, RefObject } from "react";
import CompactConversation from "./CompactConversation";
import { BOARD_LIBRARY, TOOL_LIBRARY, GENERATORS, isImage, type GeneratorType } from "../lib/workshop-libraries";
import { VIDEO_DURATIONS } from "../lib/video-duration";

const GENERATOR_VOICES = [
  { name: "Aria", label: "Aria — warm female" },
  { name: "Sarah", label: "Sarah — clear female" },
  { name: "Charlotte", label: "Charlotte — soft female" },
  { name: "Alice", label: "Alice — bright female" },
  { name: "Jessica", label: "Jessica — friendly female" },
  { name: "Roger", label: "Roger — deep male" },
  { name: "George", label: "George — warm male" },
  { name: "Brian", label: "Brian — steady male" },
  { name: "Liam", label: "Liam — young male" },
  { name: "Bill", label: "Bill — older male" },
];
import type { GameToolType, Project } from "../lib/project";

export type WorkshopAiPanelProps = {
  workflowStep: number;
  workshopStep: number;
  buildAiOpen: boolean;
  setBuildAiOpen: (v: boolean) => void;
  building: boolean;
  draft: string;
  setDraft: (v: string) => void;
  sendMessage: (e: FormEvent) => void;
  promptRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  project: Project;
  aiUndo: Project | null;
  showBoardTemplates: boolean;
  showToolTemplates: boolean;
  showTriviaListGenerator: boolean;
  showGenerator: boolean;
  triviaBusy: boolean;
  addGameTool: (type: GameToolType) => void;
  triviaListCount: number;
  setTriviaListCount: (v: number) => void;
  triviaListCategories: string;
  setTriviaListCategories: (v: string) => void;
  triviaListBusy: boolean;
  generateTriviaList: () => void;
  triviaListQuestions: any[];
  downloadTriviaPdf: () => void;
  backgroundIntent: boolean;
  generatorType: GeneratorType;
  setGeneratorType: (v: GeneratorType) => void;
  assetBusy: boolean;
  generatorPrompt: string;
  setGeneratorPrompt: (v: string) => void;
  imageShape: string;
  setImageShape: (v: string) => void;
  videoLength: string;
  setVideoLength: (v: string) => void;
  videoReferenceKey: string;
  setVideoReferenceKey: (v: string) => void;
  musicLengthMode: string;
  setMusicLengthMode: (v: string) => void;
  musicDuration: number;
  setMusicDuration: (v: number) => void;
  musicLyrics: string;
  setMusicLyrics: (v: string) => void;
  musicInstrumental: boolean;
  setMusicInstrumental: (v: boolean) => void;
  imageReferenceKey: string;
  setImageReferenceKey: (v: string) => void;
  generatorVoice: string;
  setGeneratorVoice: (v: string) => void;
  generatorStability: number;
  setGeneratorStability: (v: number) => void;
  sfxSeconds: number;
  setSfxSeconds: (v: number) => void;
  generationQueueCount: number;
  jewelProgress: string;
  generateAsset: (type: GeneratorType, prompt: string, opts?: any) => void;
  assetStatus: string | null;
  persist: (p: Project) => void;
  setAiUndo: (v: Project | null) => void;
  ccssEntitled: boolean;
  onAddTemplate: (templateId: string) => void;
};

export default function WorkshopAiPanel(props: WorkshopAiPanelProps) {
  const {
    workflowStep, workshopStep, buildAiOpen, setBuildAiOpen, building, draft, setDraft,
    sendMessage, promptRef, fileInputRef, handleFiles, project, aiUndo,
    showBoardTemplates, showToolTemplates, showTriviaListGenerator, showGenerator,
    triviaBusy, addGameTool, triviaListCount, setTriviaListCount, triviaListCategories,
    setTriviaListCategories, triviaListBusy, generateTriviaList, triviaListQuestions,
    downloadTriviaPdf, backgroundIntent, generatorType, setGeneratorType, assetBusy,
    generatorPrompt, setGeneratorPrompt, imageShape, setImageShape, videoLength,
    setVideoLength, videoReferenceKey, setVideoReferenceKey, musicLengthMode,
    setMusicLengthMode, musicDuration, setMusicDuration, musicLyrics, setMusicLyrics,
    musicInstrumental, setMusicInstrumental,
    imageReferenceKey, setImageReferenceKey, generatorVoice, setGeneratorVoice,
    generatorStability, setGeneratorStability, sfxSeconds, setSfxSeconds, generationQueueCount,
    jewelProgress,
    generateAsset, assetStatus, persist, setAiUndo, ccssEntitled, onAddTemplate,
  } = props;
  const videoSeconds = videoLength === "auto" ? 5 : Number(videoLength);
  const videoHd = videoSeconds > 10 || (Boolean(videoReferenceKey) && videoSeconds !== 5);

  return (
<section hidden={workflowStep===1&&!buildAiOpen} className={"chat-panel"+(workflowStep===1?" build-space-chat":"")}><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h2>Jewel</h2></div><div className="ai-orb">✦</div></div>{workflowStep===1&&<button type="button" className="outline-btn" onClick={()=>{setBuildAiOpen(false);document.querySelector('.build-space')?.scrollIntoView({block:'start'});}}>Back to Build Space</button>}{workflowStep===1&&<p className="build-ai-help">Describe the change in your own words. I can connect pools and buttons, place items, change their look, and set playback. Changes apply to your draft for testing.</p>}{aiUndo&&<button type="button" className="outline-btn" disabled={building} onClick={()=>{const previous=aiUndo;persist({...previous,publishedSnapshot:project.publishedSnapshot,status:project.status,messages:[...project.messages,{role:"assistant",text:"The last AI edit has been undone."}]});setAiUndo(null);}}>Undo last AI edit</button>}<CompactConversation messages={project.messages} busy={building} progressText={jewelProgress}/><details className="chat-example-requests"><summary>Example requests</summary><div className="idea-card"><span>TRY A REQUEST</span>{(workflowStep===1?[
 ["Connect an image pool","Connect my image pool to one random draw/remove button. Ask me which pool if needed."],
 ["Add a scoreboard","Add and connect a scoreboard. Ask me which players or teams to include."],
 ["Adjust an item","Help me position and size the selected item on the overlay."]
 ]:[["Help me get started","Help me plan my game. Ask me what you need to know."],["Create media","Help me create the media my game needs."],["Customize a card","Help me customize a card for my game."]]).map(([label,prompt])=><button type="button" key={label} onClick={()=>setDraft(prompt)}>{label} <b>→</b></button>)}</div></details><form className="composer" onSubmit={sendMessage}><label className="workshop-prompt-label" htmlFor="workshop-prompt">What would you like to create or change?</label><textarea id="workshop-prompt" ref={promptRef} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={workflowStep===1?"Example: Connect my Prize Images pool to a random draw button and show images in the center.":"Example: Help me create a music quiz with easy host controls."}/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button className="send" type="submit" disabled={building||!draft.trim()}>{building ? "Working…" : "Apply my request"}</button></div>{showBoardTemplates&&<div id="board-templates" hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card"><span>BOARD TEMPLATES</span>{BOARD_LIBRARY.map(item=><button key={item.type} type="button" disabled={triviaBusy} onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>}{showToolTemplates&&<div id="tool-templates" hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card"><span>TOOL TEMPLATES</span>{TOOL_LIBRARY.filter(t=>!t.restricted||ccssEntitled).map(item=><button key={item.type} type="button" onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>}{showTriviaListGenerator&&<div hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card generator-panel"><span>GENERATE TRIVIA</span><small>Choose how many questions you want. Categories are optional — type one or several separated by commas, or leave them blank and TTCGameLab will choose them.</small><label>NUMBER OF QUESTIONS<input id="trivia-list-count" type="number" min="1" max="500" value={triviaListCount} onChange={e=>setTriviaListCount(Math.max(1,Math.min(500,Number(e.target.value)||1)))}/></label><label>CATEGORIES (OPTIONAL)<textarea value={triviaListCategories} onChange={e=>setTriviaListCategories(e.target.value)} placeholder="Example: 90s music, science, horror movies, world history"/></label><button className="build-btn" type="button" disabled={triviaListBusy} onClick={()=>void generateTriviaList()}>{triviaListBusy ? "Generating & verifying…" : `Generate ${triviaListCount} Questions →`}</button>{triviaListQuestions.length>0&&<><small>{triviaListQuestions.length} questions ready; starred items need review.</small><div style={{maxHeight:320,overflow:"auto"}}>{triviaListQuestions.map((q:any,i:number)=><div key={`${q.question}-${i}`} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.12)"}}><strong>{i+1}. {q.question}{q.verificationStatus==="needs-review" ? " * Needs verification" : " ✓ Verified"}</strong><div>Answer: {q.answer}</div><small>{q.category} · <a href={q.sourceUrl} target="_blank" rel="noreferrer">{q.source}</a></small></div>)}</div><button type="button" onClick={()=>void downloadTriviaPdf()}>Download PDF</button><small>Saved in your toolbox. Connect it to a dashboard button in Build Space when needed.</small></>}</div>}{showGenerator&&<div hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card generator-panel"><span>{backgroundIntent ? "CREATE OVERLAY BACKGROUND" : "GENERATE ASSET"}</span><small>Choose a media type, describe it here, then generate it directly.</small><div className="generator-types">{GENERATORS.map(item=><button key={item.type} type="button" className={generatorType===item.type?"active":""} onClick={()=>setGeneratorType(item.type)}>{item.icon} {item.label}</button>)}</div><textarea id="generator-prompt" aria-label="Describe the media to generate" value={generatorPrompt} onChange={e=>setGeneratorPrompt(e.target.value)} placeholder={`Describe the ${generatorType} you want to generate…`}/>{generatorType==="image"&&<label>Image shape<select value={imageShape} onChange={e=>setImageShape(e.target.value)}><option value="16:9">Full overlay · landscape 16:9</option><option value="9:16">Portrait · 9:16</option><option value="1:1">Square · 1:1</option><option value="4:3">Landscape · 4:3</option><option value="3:4">Portrait · 3:4</option></select><small>Choose the shape for the intended overlay area. Edit the result to set exact pixel dimensions.</small></label>}{generatorType==="image"&&<label>Starting image (optional)<small>Start from one of your images and describe the variation or change you want.</small><select value={imageReferenceKey} onChange={e=>setImageReferenceKey(e.target.value)}><option value="">Start from scratch</option>{project.assets.filter(isImage).map((asset,i)=><option key={(asset.storageKey||asset.name)+i} value={asset.storageKey||asset.name}>{asset.name}</option>)}</select></label>}{generatorType==="image"&&<small className="generator-format-note">Horizontal TikTok Studio overlay · 1920 × 1080 canvas. Images use your selected shape and fit without stretching.</small>}{generatorType==="video"&&<small className="generator-format-note">Horizontal TikTok Studio overlay · 1920 × 1080 canvas. {videoHd ? "This mode renders in full HD (1080p)." : videoReferenceKey ? "A 5-second reference-image clip renders in 720p at maximum quality; choose another length for full HD (1080p)." : "Short text-only clips render in 720p HD. Add a reference image or choose a length over 10 seconds for full HD (1080p)."}</small>}{generatorType==="video"&&<label>Video length<select value={videoLength} onChange={e=>setVideoLength(e.target.value)}><option value="auto">Use the length in my description (default 5 seconds)</option>{VIDEO_DURATIONS.map(seconds=><option key={seconds} value={String(seconds)}>{seconds} seconds</option>)}</select><small>Generate a single clip up to 30 seconds. Longer clips can use a different model and take longer to make. Combine clips in the Asset Composer for longer videos.</small></label>}{generatorType==="video"&&<label>Reference image (optional)<small>Choose a widescreen image you have reviewed. For a portrait or square design, create or upload a horizontal version first; animation will not add filler or change its layout automatically.</small><select value={videoReferenceKey} onChange={e=>setVideoReferenceKey(e.target.value)}><option value="">Text-to-video</option>{project.assets.filter(isImage).map((asset,i)=><option key={(asset.storageKey||asset.name)+i} value={asset.storageKey||asset.name}>{asset.name}</option>)}</select></label>}{generatorType==="video"&&<small>Tip: video models garble written words, so describe the scene without signs, logos or text.</small>}{generatorType==="voice"&&<><label>Voice<select value={generatorVoice} onChange={e=>setGeneratorVoice(e.target.value)}>{GENERATOR_VOICES.map(voice=><option key={voice.name} value={voice.name}>{voice.label}</option>)}</select></label><label>Stability · {Math.round(generatorStability*100)}%<input type="range" min="0" max="1" step="0.05" value={generatorStability} onChange={e=>setGeneratorStability(Number(e.target.value))}/><small>Lower stability sounds more expressive; higher is steadier and more even.</small></label><small>Type the exact words you want spoken, just as they should be read aloud.</small></>}{generatorType==="sfx"&&<><label>Sound length<select value={sfxSeconds} onChange={e=>setSfxSeconds(Number(e.target.value))}>{[2,5,10,15,30].map(seconds=><option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label><small>Describe the sound itself: what makes it, how it starts, and how it ends.</small></>}{generatorType==="music"&&<><label>Song length<select value={musicLengthMode} onChange={e=>setMusicLengthMode(e.target.value)}><option value="auto">Use the length in my description</option><option value="short">Short intro / custom length</option><option value="full">Full song</option></select></label>{musicLengthMode==="short"&&<label>Length in seconds<input type="number" min="3" max="120" step="1" value={musicDuration} onChange={e=>setMusicDuration(Number(e.target.value))}/></label>}<label>Lyrics (optional)<textarea value={musicLyrics} onChange={e=>setMusicLyrics(e.target.value)} placeholder="Paste the words you want sung, one lyric line per line."/></label><label style={{display:"flex",alignItems:"center",gap:"8px"}}><input type="checkbox" checked={musicInstrumental} onChange={e=>setMusicInstrumental(e.target.checked)}/> Instrumental (no vocals)</label><small>For a short intro, choose 20–25 seconds and use a few lyric lines so they fit. Short tracks use MiniMax Music 3. Paste lyrics for vocals, or describe instrumental music. The model may finish before the selected length.</small></>}<button className="build-btn" type="button" disabled={!generatorPrompt.trim()} onClick={()=>void generateAsset(generatorType, generatorPrompt, generatorType === "music" ? { durationSeconds: musicLengthMode === "short" ? musicDuration : musicLengthMode === "full" ? 0 : undefined, lyrics: musicLyrics, instrumental: musicInstrumental } : generatorType === "image" ? { aspectRatio: imageShape, sourceKey: imageReferenceKey || undefined } : generatorType === "video" ? { durationSeconds: videoLength === "auto" ? undefined : Number(videoLength) } : generatorType === "voice" ? { voice: generatorVoice, stability: generatorStability } : generatorType === "sfx" ? { durationSeconds: sfxSeconds } : undefined)}>{assetBusy ? "Add to queue →" : `Generate ${generatorType} →`}</button>{(assetBusy||generationQueueCount>0)&&<small>{assetBusy ? "A generation is running — new requests line up and start automatically." : ""}{generationQueueCount>0 ? ` ${generationQueueCount} waiting in the queue.` : ""}</small>}</div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
  );
}
