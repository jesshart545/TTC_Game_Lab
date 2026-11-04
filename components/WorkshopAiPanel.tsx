"use client";

import { type FormEvent, type RefObject } from "react";
import CompactConversation from "./CompactConversation";
import { BOARD_LIBRARY, TOOL_LIBRARY } from "../lib/workshop-libraries";
import { TALK_TOOL_TYPES } from "../lib/talkshow-path";
import type { GameToolType, Project } from "../lib/project";
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
  handleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  project: Project;
  workflow: WorkflowEvaluation;
  onNavigateStep: (stage: number, stepId?: string) => void;
  aiUndo: Project | null;
  showBoardTemplates: boolean;
  showToolTemplates: boolean;
  triviaBusy: boolean;
  addGameTool: (type: GameToolType) => void;
  jewelProgress: string;
  assetStatus: string | null;
  persist: (p: Project) => void;
  setAiUndo: (v: Project | null) => void;
  ccssEntitled: boolean;
  onAddTemplate: (templateId: string) => void;
};

export default function WorkshopAiPanel(props: WorkshopAiPanelProps) {
  const {
    workflowStep, workshopStep, buildAiOpen, setBuildAiOpen, building, draft, setDraft,
    sendMessage, promptRef, fileInputRef, handleFiles, project, workflow, onNavigateStep, aiUndo,
    showBoardTemplates, showToolTemplates,
    triviaBusy, addGameTool,
    jewelProgress,
    assetStatus, persist, setAiUndo, ccssEntitled, onAddTemplate,
  } = props;

  return (
<section hidden={workflowStep===1&&!buildAiOpen} className={"chat-panel"+(workflowStep===1?" build-space-chat":"")}><div className="panel-heading"><div><small>AI CREATIVE DIRECTOR</small><h2>Jewel</h2></div><div className="ai-orb">✦</div></div>{(()=>{const stageState=workflow.stages[workflowStep];if(!stageState)return null;const currentInStage=stageState.steps.find(s=>!s.complete);const nextTask=workflow.current;return <div className="jewel-progress" aria-label="Your progress"><div className="jewel-progress-steps">{stageState.steps.map(step=><button key={step.id} type="button" className={"jewel-step-chip"+(step.complete?" done":step===currentInStage?" current":"")} onClick={()=>onNavigateStep(workflowStep,step.id)}>{step.complete?"✓ ":""}{step.label}</button>)}</div>{nextTask?<div className="jewel-progress-next"><span>Next: {nextTask.label}</span><button type="button" onClick={()=>onNavigateStep(nextTask.stageIndex,nextTask.stepId)}>Go there →</button></div>:<div className="jewel-progress-next"><span>Every step is checked off — your show is ready.</span></div>}</div>;})()}{workflowStep===1&&<button type="button" className="outline-btn" onClick={()=>{setBuildAiOpen(false);document.querySelector('.build-space')?.scrollIntoView({block:'start'});}}>Back to Set the Stage</button>}{workflowStep===1&&<p className="build-ai-help">Describe the change in your own words. I can connect pools and buttons, place items, change their look, and set playback. Changes apply to your draft for testing.</p>}{aiUndo&&<button type="button" className="outline-btn" disabled={building} onClick={()=>{const previous=aiUndo;persist({...previous,publishedSnapshot:project.publishedSnapshot,status:project.status,messages:[...project.messages,{role:"assistant",text:"The last AI edit has been undone."}]});setAiUndo(null);}}>Undo last AI edit</button>}<CompactConversation messages={project.messages} busy={building} progressText={jewelProgress}/><details className="chat-example-requests"><summary>Example requests</summary><div className="idea-card"><span>TRY A REQUEST</span>{(workflowStep===1?[
 ["Connect an image pool","Connect my image pool to one random draw/remove button. Ask me which pool if needed."],
 ["Add a scoreboard","Add and connect a scoreboard. Ask me which players or teams to include."],
 ["Adjust an item","Help me position and size the selected item on the overlay."]
 ]:[["Help me get started","Help me plan my game. Ask me what you need to know."],["Create media","Help me create the media my game needs."],["Customize a card","Help me customize a card for my game."]]).map(([label,prompt])=><button type="button" key={label} onClick={()=>setDraft(prompt)}>{label} <b>→</b></button>)}</div></details><form className="composer" onSubmit={sendMessage}><label className="workshop-prompt-label" htmlFor="workshop-prompt">What would you like to create or change?</label><textarea id="workshop-prompt" ref={promptRef} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={workflowStep===1?"Example: Connect my Prize Images pool to a random draw button and show images in the center.":"Example: Help me create a music quiz with easy host controls."}/><div className="composer-bottom"><input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={handleFiles}/><button className="send" type="submit" disabled={building||!draft.trim()}>{building ? "Working…" : "Apply my request"}</button></div>{showBoardTemplates&&project.kind!=="talk"&&<div id="board-templates" hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card"><span>BOARD TEMPLATES</span>{BOARD_LIBRARY.map(item=><button key={item.type} type="button" disabled={triviaBusy} onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>}{showToolTemplates&&project.kind!=="talk"&&<div id="tool-templates" hidden={workflowStep === 0 && workshopStep !== 1} className="idea-card"><span>TOOL TEMPLATES</span>{TOOL_LIBRARY.filter(t=>!t.restricted||ccssEntitled).map(item=><button key={item.type} type="button" onClick={()=>void addGameTool(item.type)}>{item.name} <b>→</b></button>)}</div>}{assetStatus&&<div className="asset-empty">{assetStatus}</div>}</form></section>
  );
}
