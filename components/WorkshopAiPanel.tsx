"use client";

import { type FormEvent, type RefObject } from "react";
import CompactConversation from "./CompactConversation";
import PlaylistPlayer from "./PlaylistPlayer";
import { BOARD_LIBRARY, TOOL_LIBRARY } from "../lib/workshop-libraries";
import { ShelfCards } from "./ToolShelf";
import { TALK_TOOL_TYPES } from "../lib/talkshow-path";
import type { GameToolType, Project, ProjectAsset } from "../lib/project";
import type { WorkflowEvaluation } from "../lib/workflow-progress";

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
  project: Project;
  workflow: WorkflowEvaluation;
  onNavigateStep: (stage: number, stepId?: string) => void;
  aiUndo: Project | null;
  showBoardTemplates: boolean;
  showToolTemplates: boolean;
  triviaBusy: boolean;
  addGameTool: (type: GameToolType) => void;
  /** The tool shelf's routed tiles (Jessica, 2026-11-15): the card,
   *  list and trivia tiles on the shelf hand their tap to the same
   *  creators those tools already have — the card-system creator,
   *  the list door, the trivia generation entry — never a second,
   *  divergent creation path. */
  onCreateCard?: (kind: "question" | "blank") => void;
  onNewList?: () => void;
  onGenerateTriviaList?: () => void;
  jewelProgress: string;
  assetStatus: string | null;
  /** The playlist a just-finished zip upload created: its player is
   *  presented right here with the completion status, so the creator
   *  can press Play immediately instead of hunting through the asset
   *  pools (owner standard, 2026-11-09). Absent/null otherwise. */
  addedPlaylist?: { poolName: string; tracks: ProjectAsset[] } | null;
  persist: (p: Project) => void;
  setAiUndo: (v: Project | null) => void;
  ccssEntitled: boolean;
  onAddTemplate: (templateId: string) => void;
  /** Set the Stage review spaces (gameshow + talk, stage 1): the
   *  panel stands open on the page as one of the stage's three
   *  surfaces — never hidden behind Ask Jewel, no Back button, and
   *  no progress strip (see the withholding note below). */
  stageReview?: boolean;
  /** Game Night views (kind "multiplayer", Imagine & Create and Set
   *  the Stage): the panel stands in those light frames with its
   *  progress strip withheld (via stageReview) — and its stage-1
   *  words speak game night, not livestream: a game night has no
   *  overlay and no dashboard, so the help line, the example
   *  requests and the composer placeholder offer game asks instead
   *  of wiring asks. Page composition only — Jewel's behavior, her
   *  conversation and every other kind's panel are untouched. */
  gameNight?: boolean;
  /** Admin-only housekeeping: when the viewer is the site admin,
   *  the panel heading shows a quiet "Clear chat" button that asks
   *  the page (via onClearChat) to clear Jewel's conversation for
   *  this project. Absent for every regular viewer. */
  viewerIsAdmin?: boolean;
  onClearChat?: () => void;
  /** Admin-only housekeeping, the single-message companion to
   *  Clear chat: when the viewer is the site admin, every message
   *  in Jewel's conversation carries a small remove control that
   *  asks the page (via onRemoveMessage, with the message's index
   *  in the full history) to remove just that one message after
   *  confirmation. Absent for every regular viewer. */
  onRemoveMessage?: (index: number) => void;
};

export default function WorkshopAiPanel(props: WorkshopAiPanelProps) {
  const {
    workflowStep, workshopStep, buildAiOpen, setBuildAiOpen, building, draft, setDraft,
    sendMessage, promptRef, fileInputRef, project, workflow, onNavigateStep, aiUndo,
    showBoardTemplates, showToolTemplates,
    triviaBusy, addGameTool, onCreateCard, onNewList, onGenerateTriviaList,
    jewelProgress,
    assetStatus, addedPlaylist = null, persist, setAiUndo, ccssEntitled, onAddTemplate, stageReview = false, gameNight = false,
    viewerIsAdmin = false, onClearChat, onRemoveMessage,
  } = props;

  // Talk Show Imagine and Create (Jessica, 2026-11-04): the page
  // carries NO progress strip — no topic chips, no "Next:" line with
  // its Go-there button. Jewel owns the check-offs and the directing
  // inside her conversation; piling that machinery onto the page, in
  // an unnecessary area below the wand scene, was the miss she named.
  // The workflow model keeps running exactly as before (it picks the
  // topic the stage shows, records facts and skips, and gates Set
  // the Stage) — only its page furniture is withheld in this view.
  // The Set the Stage review spaces (gameshow, talk and radio at
  // stage 1) withhold it the same way: the strip is page furniture,
  // and the review page shows only the two review spaces and this
  // conversation. Every other kind and stage keeps the strip.
  const talkCreateView = project.kind === "talk" && workflowStep === 0;
  const gameshowCreateView = project.kind === "gameshow" && workflowStep === 0;
  const radioCreateView = project.kind === "radio" && workflowStep === 0;
  const stripWithheld = talkCreateView || gameshowCreateView || radioCreateView || stageReview;

  return (
<section hidden={workflowStep===1&&!buildAiOpen&&!stageReview} className={"chat-panel"+(workflowStep===1?" build-space-chat":"")}><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h2>Jewel</h2>{viewerIsAdmin&&onClearChat&&<button type="button" className="clear-chat-btn" onClick={onClearChat}>Clear chat</button>}</div><div className="ai-orb">✦</div></div>{!stripWithheld && (()=>{const stageState=workflow.stages[workflowStep];if(!stageState)return null;const currentInStage=stageState.steps.find(s=>!s.complete);const nextTask=workflow.current;return <div className="jewel-progress" aria-label="Your progress"><div className="jewel-progress-steps">{stageState.steps.map(step=><button key={step.id} type="button" className={"jewel-step-chip"+(step.complete?" done":step===currentInStage?" current":"")} onClick={()=>onNavigateStep(workflowStep,step.id)}>{step.complete?"✓ ":""}{step.label}</button>)}</div>{nextTask?<div className="jewel-progress-next"><span>Next: {nextTask.label}</span><button type="button" onClick={()=>onNavigateStep(nextTask.stageIndex,nextTask.stepId)}>Go there →</button></div>:<div className="jewel-progress-next"><span>Every step is checked off — your show is ready.</span></div>}</div>;})()}{workflowStep===1&&!stageReview&&<button type="button" className="outline-btn" onClick={()=>{setBuildAiOpen(false);document.querySelector('.build-space')?.scrollIntoView({block:'start'});}}>Back to Set the Stage</button>}{workflowStep===1&&<p className="build-ai-help">{gameNight?"Describe the change in your own words. I can add questions, cards and words to your game, change pieces, give it a fresh look, and publish it for you — right here, exactly as your friends will play it.":stageReview?"Describe the change in your own words. I place items on your overlay, put buttons on your dashboard and wire them, move things, and change how they look — right here in the review, exactly as they will be when you publish.":"Describe the change in your own words. I can connect pools and buttons, place items, change their look, and set playback. Changes apply to your draft for testing."}</p>}{aiUndo&&<button type="button" className="outline-btn" disabled={building} onClick={()=>{const previous=aiUndo;persist({...previous,publishedSnapshot:project.publishedSnapshot,status:project.status,messages:[...project.messages,{role:"assistant",text:"The last AI edit has been undone."}]});setAiUndo(null);}}>Undo last AI edit</button>}<CompactConversation messages={project.messages} busy={building} progressText={jewelProgress} canRemoveMessages={viewerIsAdmin} onRemoveMessage={onRemoveMessage}/><details className="chat-example-requests"><summary>Example requests</summary><div className="idea-card"><span>TRY A REQUEST</span>{(workflowStep===1?(gameNight?[
 ["Add more pieces","Add more pieces to my game — new ones in the same style as the pieces it already has."],
 ["Change a piece","I want to change one of my game's pieces — ask me which one and what it should say instead."],
 ["Publish my game","Publish my game and give me its play link and QR code so I can share it with my friends."]
 ]:[
 ["Connect an image pool","Connect my image pool to one random draw/remove button. Ask me which pool if needed."],
 ["Add a scoreboard","Add and connect a scoreboard. Ask me which players or teams to include."],
 ["Adjust an item","Help me position and size the selected item on the overlay."]
 ]):project.kind==="radio"?(project.radioBranch==="karaoke"?[["Build my song list","Help me build the list of songs for my karaoke night."],["Make an intro","Make a short intro for my karaoke night."],["Design my look","Design the look of my karaoke night for the overlay."]]:[["Build my playlist","Help me build the playlist for my show."],["Set up my sound board","Set up a sound board with my intro, stings and effects."],["Make a cutscene","Make a short video cutscene for my show."]]):[["Help me get started","Help me plan my game. Ask me what you need to know."],["Create media","Help me create the media my game needs."],["Customize a card","Help me customize a card for my game."]]).map(([label,prompt])=><button type="button" key={label} onClick={()=>setDraft(prompt)}>{label} <b>→</b></button>)}</div></details><form className="composer" onSubmit={sendMessage}><label className="workshop-prompt-label" htmlFor="workshop-prompt">What would you like to create or change?</label><textarea id="workshop-prompt" ref={promptRef} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={project.kind==="radio"&&workflowStep===1?"Example: Put my DJ deck on the overlay and set the merge blend to 6 seconds.":project.kind==="radio"?(project.radioBranch==="karaoke"?"Example: Add these songs to my karaoke list and make an intro sting.":"Example: Build my playlist and set up a sound board with my intro and effects."):gameNight&&workflowStep===1?"Example: Add five more questions to my game.":workflowStep===1?"Example: Connect my Prize Images pool to a random draw button and show images in the center.":"Example: Help me create a music quiz with easy host controls."}/><div className="composer-bottom"><button className="send" type="submit" disabled={building||!draft.trim()}>{building ? "Working…" : "Apply my request"}</button></div>{showBoardTemplates&&!stageReview&&project.kind!=="talk"&&project.kind!=="radio"&&<div id="board-templates" hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card"><span>BOARD TEMPLATES</span><ShelfCards items={BOARD_LIBRARY} project={project} ccssEntitled={ccssEntitled} triviaBusy={triviaBusy} handlers={{addGameTool, onCreateCard, onNewList, onGenerateTriviaList}}/></div>}{showToolTemplates&&!stageReview&&project.kind!=="talk"&&project.kind!=="radio"&&<div id="tool-templates" hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card"><span>TOOL TEMPLATES</span><ShelfCards items={TOOL_LIBRARY} project={project} ccssEntitled={ccssEntitled} handlers={{addGameTool, onCreateCard, onNewList, onGenerateTriviaList}}/></div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}{addedPlaylist&&addedPlaylist.tracks.length>0&&<PlaylistPlayer poolName={addedPlaylist.poolName} tracks={addedPlaylist.tracks}/>}</form></section>
  );
}
