"use client";

import type { ReactNode } from "react";
import type { Project } from "../lib/project";
import type { WorkflowEvaluation, WorkflowStepState } from "../lib/workflow-progress";
import { TALK_CREATIVITY_BANNER, TALK_STEPS, type TalkStepId } from "../lib/talkshow-path";
import { BackdropsStep, QuizStep, ResearchStep, SignStep, SlidesStep, ToolboxStep, YoutubeStep } from "./TalkshowSteps";
import "./gameshow-workshop.css";
import "./talkshow-workshop.css";

/**
 * The Talk Show or Classroom Workshop: the same guided-path architecture as
 * the Gameshow Workshop — seven tasks whose state is read from the workflow
 * model (this component keeps no completion state of its own), living
 * demonstrations instead of stacked words and forms, a plain list of what
 * can be changed under each one, and example asks that are handed to Jewel.
 * Nothing here generates: Jewel is the only generation door. The only
 * writes on these screens are the creator's own — arranging the slide deck
 * by hand, through the page's normal save path.
 */

export type TalkshowDoors = {
  /** Upload the creator's own sign (page tags the upload as the sign). */
  uploadSign: () => void;
  /** Scroll to the project form below (name + theme & style fields). */
  showPlanForm: () => void;
  /** Put a saved backdrop on the overlay (the existing background choice). */
  applyBackground: (assetKey: string) => void;
  openMediaEditor: (assetIndex: number) => void;
  openListEditor: (toolId: string) => void;
  openCardEditor: (toolId: string) => void;
  /** The Workshop's own question-card creation flow (editor opens). */
  createQuizCards: () => void;
  /** Add the YouTube tool through the existing tool-template flow. */
  addYoutube: () => void;
  openComposer: () => void;
  showSavedWork: () => void;
};

export type TalkshowWorkshopProps = {
  project: Project;
  workflow: WorkflowEvaluation;
  activeStep: string;
  onNavigateStep: (stage: number, stepId?: string) => void;
  onAskJewel: (text: string) => void;
  onOpenJewel: () => void;
  /** The page's normal save path — used only for the hand-arranged deck. */
  onSaveProject: (project: Project) => void;
  doors: TalkshowDoors;
};

const DONE_WHEN: Record<TalkStepId, string> = {
  sign: "your show has a real name, and a sign exists — made by Jewel with your title lettered over a backdrop, or your own uploaded sign.",
  backdrops: "at least one backdrop is saved with your backgrounds.",
  research: "Jewel has run a web search in this project — her findings, with their sources, are in your conversation with her.",
  quiz: "a quiz with at least one multiple-choice question is saved in your toolbox.",
  youtube: "the YouTube tool is in your toolbox, ready for your dashboard.",
  slides: "your deck holds at least two slides, in the order your show will follow.",
  toolbox: "every earlier step is complete, and you have opened this review.",
};

export function TalkStepShell({ stepId, step, children }: { stepId: TalkStepId; step?: WorkflowStepState; children: ReactNode }) {
  const info = TALK_STEPS[stepId];
  if (!step) return <>{children}</>;
  return (
    <section aria-label={step.label}>
      <div className="gsw-stephead"><span className="gsw-k">Imagine and Create · Talk Show or Classroom</span><div className="gsw-display">{step.label}</div></div>
      <p className="gsw-ask">{info.sub}</p>
      <div className={"gsw-donewhen" + (step.complete ? " met" : "")}>
        <span className="gsw-box">{step.complete ? "✓" : ""}</span>
        <span><b>This step is done when</b> {DONE_WHEN[stepId]}</span>
      </div>
      {step.complete && <div className="gsw-jcheck">✓ Checked off — {step.checkLine}</div>}
      {children}
    </section>
  );
}

export function TalkAskStrip(props: TalkshowWorkshopProps & { stepId: TalkStepId; extra?: ReactNode }) {
  const { stepId, extra, onAskJewel: onAsk, onOpenJewel } = props;
  const info = TALK_STEPS[stepId];
  return (
    <div>
      <div className="gsw-seclabel">Make it with Jewel</div>
      <div className="gsw-jewel">
        <div className="gsw-jhead">
          <div className="gsw-java">✦</div>
          <div><div className="gsw-jt">Jewel</div><div className="gsw-js">Your co-creator</div></div>
        </div>
        <div className="gsw-jmsg">{info.status}</div>
        <div className="gsw-exlabel">{info.askTitle}</div>
        <div className="gsw-jchips">
          {info.asks.map(ask => (
            <button key={ask.label} type="button" className="gsw-jchip" onClick={() => onAsk(ask.ask)}>{ask.label}</button>
          ))}
        </div>
        <button type="button" className="gsw-openjewel" onClick={onOpenJewel}>Write it in Jewel’s box ↓</button>
        {extra && <p className="gsw-jnote">{extra}</p>}
      </div>
    </div>
  );
}

export function TalkChangeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="gsw-edits">
      <div className="gsw-eh">{title}</div>
      <ul>
        {items.map((item, i) => (
          <li key={i}><span className="gsw-ei"><span>{item}</span></span></li>
        ))}
      </ul>
    </div>
  );
}

const SHORT_LABELS: Record<string, string> = {
  sign: "Name & sign", backdrops: "Backdrops", research: "Research", quiz: "Quiz",
  youtube: "YouTube", slides: "Slides", toolbox: "Toolbox",
};

export default function TalkshowWorkshop(props: TalkshowWorkshopProps) {
  const { project, workflow, activeStep, onNavigateStep } = props;
  const steps = workflow.stages[0]?.steps || [];
  const active = steps.find(step => step.id === activeStep) || steps.find(step => !step.complete) || steps[0];
  if (!active) return null;
  const index = steps.findIndex(step => step.id === active.id);
  const previous = index > 0 ? steps[index - 1] : null;
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
  const screenProps = { ...props, step: active };
  return (
    <section className="gsw" aria-label="Imagine and Create — the guided path">
      <div className="gsw-path" role="navigation" aria-label="Your path through Imagine and Create">
        {steps.map((step, i) => (
          <button
            key={step.id} type="button"
            className={"gsw-pstep" + (step.id === active.id ? " on" : "") + (step.complete ? " done" : "")}
            onClick={() => onNavigateStep(0, step.id)}
            aria-current={step.id === active.id ? "step" : undefined}
          >
            <span className="gsw-n">{step.complete ? "✓" : i + 1}</span>{step.label}
          </button>
        ))}
      </div>
      <p className="gsw-pathnote">
        These buttons are the path — each one names a task, and tapping it takes you straight to that task’s screen.
        Each step opens with a working demonstration: try the thing itself, see what can change, then tell Jewel to make yours.
        A step earns its green ✓ only when Jewel has checked it against what’s actually in your project.
      </p>
      <div className="gsw-liberty">
        <div className="gsw-lmedal" aria-hidden="true">✦</div>
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{TALK_CREATIVITY_BANNER}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>

      {active.id === "sign" && <SignStep {...screenProps} />}
      {active.id === "backdrops" && <BackdropsStep {...screenProps} />}
      {active.id === "research" && <ResearchStep {...screenProps} />}
      {active.id === "quiz" && <QuizStep {...screenProps} />}
      {active.id === "youtube" && <YoutubeStep {...screenProps} />}
      {active.id === "slides" && <SlidesStep {...screenProps} />}
      {active.id === "toolbox" && <ToolboxStep {...screenProps} />}

      <div className="gsw-nextrow">
        <button type="button" className="gsw-backbtn" disabled={!previous} onClick={() => previous && onNavigateStep(0, previous.id)}>
          ← Back{previous ? ` — ${SHORT_LABELS[previous.id] || previous.label}` : ""}
        </button>
        {next ? (
          <button type="button" className="gsw-nextbtn" onClick={() => onNavigateStep(0, next.id)}>
            Next — {SHORT_LABELS[next.id] || next.label} →
          </button>
        ) : (
          <button type="button" className="gsw-nextbtn" onClick={() => onNavigateStep(1)}>Continue — Set the Stage →</button>
        )}
        <span className="gsw-hint">Step {index + 1} of {steps.length} · {active.label}</span>
      </div>
    </section>
  );
}
