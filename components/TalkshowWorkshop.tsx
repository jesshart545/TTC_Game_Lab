"use client";

import type { ReactNode } from "react";
import type { Project, ProjectAsset } from "../lib/project";
import { allCreateStepsComplete, type WorkflowEvaluation, type WorkflowStepState } from "../lib/workflow-progress";
import { TALK_CREATIVITY_BANNER, TALK_SKIPPABLE_STEPS, TALK_STEPS, type TalkStepId } from "../lib/talkshow-path";
import JewelAvatar from "./JewelAvatar";
import { BackgroundStep, MediaStep, MissedStep, PromptStep, QuizStep, ResearchStep, SignStep, ThemeStep } from "./TalkshowSteps";
import "./gameshow-workshop.css";
import "./talkshow-workshop.css";

/**
 * The Talk Show or Classroom Workshop, in the layout Jessica dictated
 * (2026-11-04): eight areas in her order — theme & subject, background,
 * title sign, opening prompt, research, quiz or follow-up questions,
 * media, anything we missed — with no generic workshop frame stacked
 * above them. Area state is read from the workflow model only (this
 * component keeps no completion state of its own); the optional areas
 * carry a Skip that counts as complete; complete never locks an area.
 * Jewel's real avatar and wand appear ONCE on this page — in the
 * guidance banner below — for continuity (she is the user's magic wand),
 * never stamped on every control. Nothing here generates: Jewel is the
 * only generation door. The creator's own writes (the theme box, the
 * prompt layer, the hand-arranged deck, a skip) go through the page's
 * normal save path.
 */

export type TalkshowDoors = {
  /** Upload media for the Media area (the plain project upload). */
  uploadMedia: () => void;
  /** Scroll to the project form below. Kept wired for the page's other
   *  entries into the form; the theme itself is edited in area 1 now. */
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
  /** Ask the page to delete one stored asset (the page confirms first,
   *  then runs its normal asset-deletion path). */
  deleteAsset: (asset: ProjectAsset) => void;
};

export type TalkshowWorkshopProps = {
  project: Project;
  workflow: WorkflowEvaluation;
  activeStep: string;
  onNavigateStep: (stage: number, stepId?: string) => void;
  onAskJewel: (text: string) => void;
  onOpenJewel: () => void;
  /** The page's normal save path — the theme box, the prompt layer, the
   *  hand-arranged deck, and skips are the creator's own writes. */
  onSaveProject: (project: Project) => void;
  /** Record a skip on an optional area (counts as complete). */
  onSkipStep?: (stepId: string) => void;
  doors: TalkshowDoors;
};

export function TalkStepShell({ stepId, step, children }: { stepId: TalkStepId; step?: WorkflowStepState; children: ReactNode }) {
  const info = TALK_STEPS[stepId];
  if (!step) return <>{children}</>;
  return (
    <section aria-label={step.label}>
      <div className="gsw-stephead"><span className="gsw-k">{info.kicker}</span><div className="gsw-display">{step.label}</div></div>
      <p className="gsw-ask">{info.intro}</p>
      <div className={"gsw-donewhen" + (step.complete ? " met" : "")}>
        <span className="gsw-box">{step.complete ? "✓" : ""}</span>
        <span><b>This area is done when</b> {info.doneWhen}</span>
      </div>
      {step.complete && !step.skipped && <div className="gsw-jcheck">✓ Checked off — {step.checkLine}</div>}
      {step.skipped && <div className="gsw-jcheck">✓ Skipped — counts as complete. You can still change anything here, any time.</div>}
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
        <div className="gsw-jmsg">{info.jewelNote}</div>
        <div className="gsw-exlabel">Examples — tap one, or write your own</div>
        <div className="gsw-jchips">
          {info.asks.map(ask => (
            <button key={ask.say} type="button" className="gsw-jchip" onClick={() => onAsk(ask.say)}>{ask.chip}</button>
          ))}
        </div>
        <button type="button" className="gsw-openjewel" onClick={onOpenJewel}>Write it in Jewel’s box ↓</button>
        {extra && <p className="gsw-jnote">{extra}</p>}
      </div>
    </div>
  );
}

const SHORT_LABELS: Record<string, string> = {
  theme: "Theme & subject", background: "Background", sign: "Title sign", prompt: "Opening prompt",
  research: "Research", quiz: "Quiz & follow-ups", media: "Media", missed: "Anything missed",
};

export default function TalkshowWorkshop(props: TalkshowWorkshopProps) {
  const { workflow, activeStep, onNavigateStep, onSkipStep } = props;
  const steps = workflow.stages[0]?.steps || [];
  const active = steps.find(step => step.id === activeStep) || steps.find(step => !step.complete) || steps[0];
  if (!active) return null;
  const index = steps.findIndex(step => step.id === active.id);
  const previous = index > 0 ? steps[index - 1] : null;
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
  const screenProps = { ...props, step: active };
  const skippable = TALK_SKIPPABLE_STEPS.includes(active.id as TalkStepId);
  const createComplete = allCreateStepsComplete(workflow);
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
        These buttons are the path — each one names an area, and tapping it takes you straight to that area’s screen.
        Each area opens by showing you the thing itself — then you make yours with Jewel.
        An area earns its green ✓ when Jewel has checked it against what’s actually in your project — or when you skip it, where skipping is offered.
      </p>
      <div className="gsw-liberty">
        <JewelAvatar size={58} />
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{TALK_CREATIVITY_BANNER}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>

      {active.id === "theme" && <ThemeStep {...screenProps} />}
      {active.id === "background" && <BackgroundStep {...screenProps} />}
      {active.id === "sign" && <SignStep {...screenProps} />}
      {active.id === "prompt" && <PromptStep {...screenProps} />}
      {active.id === "research" && <ResearchStep {...screenProps} />}
      {active.id === "quiz" && <QuizStep {...screenProps} />}
      {active.id === "media" && <MediaStep {...screenProps} />}
      {active.id === "missed" && <MissedStep {...screenProps} />}

      {skippable && !active.complete && onSkipStep && (
        <div className="tsw-skiprow">
          <span>Don’t need this one?</span>
          <button type="button" className="gsw-demobtn" onClick={() => { onSkipStep(active.id); if (next) onNavigateStep(0, next.id); }}>
            Skip this area — it counts as complete →
          </button>
        </div>
      )}

      <div className="gsw-nextrow">
        <button type="button" className="gsw-backbtn" disabled={!previous} onClick={() => previous && onNavigateStep(0, previous.id)}>
          ← Back{previous ? ` — ${SHORT_LABELS[previous.id] || previous.label}` : ""}
        </button>
        {next ? (
          <button type="button" className="gsw-nextbtn" onClick={() => onNavigateStep(0, next.id)}>
            Next — {SHORT_LABELS[next.id] || next.label} →
          </button>
        ) : createComplete ? (
          <button type="button" className="gsw-nextbtn" onClick={() => onNavigateStep(1)}>Continue — Set the Stage →</button>
        ) : (
          <button type="button" className="gsw-nextbtn" disabled title="Set the Stage unlocks when every area is done — or skipped">
            Set the Stage unlocks when every area is done 🔒
          </button>
        )}
        <span className="gsw-hint">Area {index + 1} of {steps.length} · {active.label}</span>
      </div>
    </section>
  );
}
