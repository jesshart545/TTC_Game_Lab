"use client";

import { useState, type ReactNode } from "react";
import type { Project } from "../lib/project";
import type { WorkflowEvaluation, WorkflowStepState } from "../lib/workflow-progress";
import { CREATIVE_LIBERTY_TEXT } from "../lib/gameshow-path";
import {
  BareStageContext, MediaDemos, MediaShelf, PlanTemplates,
  type GameshowDoors, type GameshowWorkshopProps,
} from "./GameshowWorkshop";
import TriviaStep, { BoardStep, ScenesStep, ToolboxStep } from "./GameshowSteps";
import ToolsStep from "./GameshowToolDemos";
import JewelAvatar from "./JewelAvatar";
import JewelWandScene from "./JewelWandScene";
import "./gameshow-workshop.css";

/**
 * The Gameshow Imagine and Create stage (Jessica, 2026-11-04): the
 * Talk Show stage's light composition, applied to the gameshow —
 * the build she approved there ("Ok much better") is the pattern
 * for every kind. The checklist is JEWEL'S: she holds the seven
 * areas, marks them checked or not, and directs, all inside her
 * conversation. The page carries NO guided path, NO step list, NO
 * Back/Next buttons, NO progress list in a sidebar, NO change
 * piles — the user never handles the checklist. The user's own
 * inputs are the two creation already asks for (the show's title,
 * and its theme — given to Jewel as her starting input at the
 * plan); everything else happens by talking to her.
 *
 * What the page shows is the ONE area Jewel is on (the workflow
 * model's first unfinished gameshow step): pictured, living
 * demonstrations first — the creator's own saved work when it
 * exists, pictured examples until then, INCLUDING on an empty
 * project (the backdrop demo frames the example stage and the
 * effects fire over it) — then Jewel's conversation, then the
 * area's storage shelves and genuine manual doors. The plan area
 * carries no showpiece: creation already asked for the title and
 * theme, so it opens with Jewel's landing-page wand scene itself,
 * the whole pictured card one button into the conversation below
 * it — the same doorway as the Talk stage — followed by the
 * pictured template shelf and the quiet plan-form door.
 *
 * The screens themselves are the workshop's own (GameshowWorkshop /
 * GameshowSteps / GameshowToolDemos), rendered under
 * BareStageContext so their step heads, done-when strips,
 * checked-off lines, change piles and ask strips stand down while
 * every demonstration, shelf and editor door survives untouched.
 * The workflow model is untouched: it still picks the area shown
 * here, and Jewel's check-offs still come from what is actually
 * in the project.
 */

const GAMESHOW_AREAS = ["plan", "media", "trivia-cards", "board", "tools", "scenes", "toolbox"] as const;
type GameshowArea = (typeof GAMESHOW_AREAS)[number];

type StageProps = {
  project: Project;
  workflow: WorkflowEvaluation;
  onNavigateStep: (stage: number, stepId?: string) => void;
  onAskJewel: (text: string) => void;
  onOpenJewel: () => void;
  doors: GameshowDoors;
  ccssEntitled: boolean;
  jewelPanel?: ReactNode;
  /** Stepping into Jewel through the wand scene: the page reveals
   *  her conversation if it was hidden and lands on her input. */
  onEnterJewel: () => void;
};

function screenProps(props: StageProps, step?: WorkflowStepState): GameshowWorkshopProps & { step?: WorkflowStepState } {
  return {
    project: props.project,
    workflow: props.workflow,
    activeStep: step?.id || "",
    onNavigateStep: props.onNavigateStep,
    onAskJewel: props.onAskJewel,
    onOpenJewel: props.onOpenJewel,
    doors: props.doors,
    ccssEntitled: props.ccssEntitled,
    step,
  };
}

function AreaHeading({ children }: { children: ReactNode }) {
  return <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>{children}</div>;
}

/* ---------------- Plan — the entry area ---------------- */

function PlanArea(props: StageProps) {
  const { doors, jewelPanel, onEnterJewel } = props;
  return (
    <div>
      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <JewelWandScene onEnter={onEnterJewel} />
      </div>
      {jewelPanel}
      <PlanTemplates doors={doors} />
      <div className="gsw-card" style={{ marginTop: 14 }}>
        <div className="gsw-chipsrow" style={{ marginTop: 0, justifyContent: "space-between" }}>
          <span>Prefer to type it yourself?</span>
          <button type="button" className="gsw-jchip" onClick={doors.showPlanForm}>Open the plan form</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Media — backdrop & sign, one piece ---------------- */

function MediaArea(props: StageProps & { step?: WorkflowStepState }) {
  const [kind, setKind] = useState<string>("image");
  return (
    <div>
      <AreaHeading>Media — your backdrop and its sign are one piece, made together</AreaHeading>
      <MediaDemos {...screenProps(props, props.step)} kind={kind} onKindChange={setKind} />
      {props.jewelPanel}
      <MediaShelf project={props.project} doors={props.doors} />
    </div>
  );
}

/* ---------------- The stage itself ---------------- */

export default function GameshowStage(props: StageProps) {
  const steps = props.workflow.stages[0]?.steps || [];
  // Jewel's current area: the model's first unfinished gameshow
  // step. When every area is checked off, the toolbox — the
  // storage review — is where the stage rests.
  const open = steps.find(step => !step.complete && (GAMESHOW_AREAS as readonly string[]).includes(step.id));
  const area: GameshowArea = (open?.id as GameshowArea) || "toolbox";
  const stepState = steps.find(step => step.id === area);
  const sp = screenProps(props, stepState);
  return (
    <section className="gsw gsw-stage" aria-label="Imagine and Create — your show, as Jewel builds it with you">
      <div className="gsw-liberty">
        <JewelAvatar size={58} />
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{CREATIVE_LIBERTY_TEXT}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>
      <BareStageContext.Provider value={true}>
        {area === "plan" && <PlanArea {...props} />}
        {area === "media" && <MediaArea {...props} step={stepState} />}
        {area === "trivia-cards" && (
          <div>
            <AreaHeading>Trivia cards — write your own, or have Jewel generate them, then make the cards yours</AreaHeading>
            <TriviaStep {...sp} />
            {props.jewelPanel}
          </div>
        )}
        {area === "board" && (
          <div>
            <AreaHeading>Your game board</AreaHeading>
            <BoardStep {...sp} />
            {props.jewelPanel}
          </div>
        )}
        {area === "tools" && (
          <div>
            <AreaHeading>Game tools — tap one and watch it work</AreaHeading>
            <ToolsStep {...sp} />
            {props.jewelPanel}
          </div>
        )}
        {area === "scenes" && (
          <div>
            <AreaHeading>Scenes &amp; effects — tap an effect and watch it fire</AreaHeading>
            <ScenesStep {...sp} />
            {props.jewelPanel}
          </div>
        )}
        {area === "toolbox" && (
          <div>
            <AreaHeading>Your toolbox — everything you’ve made, in one place</AreaHeading>
            <ToolboxStep {...sp} />
            {props.jewelPanel}
          </div>
        )}
      </BareStageContext.Provider>
    </section>
  );
}
