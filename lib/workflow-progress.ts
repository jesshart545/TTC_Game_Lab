import { backgroundAssets, promptPresent, signPresent } from "./backdrop-text";
import { buildReadiness } from "./build-readiness";
import { listCards, savedListEntries } from "./card-lists";
import { questionPool } from "./question-cards";
import { quizQuestionsOf } from "./quiz";
import type { Project } from "./project";

/**
 * The workflow spine: one source of truth for where a creator stands in
 * their project's workflow, derived from the project's REAL data.
 *
 * Stages run in order: 0 Imagine and Create (Workshop), 1 Set the Stage
 * (Build Space), 2 Showtime! (Publish). Each step's completeness is a pure
 * evaluator over the project — never stored, never taken on anyone's word.
 * The few facts that cannot be derived (the toolbox was opened, a rehearsal
 * happened, which check-offs Jewel has already spoken) live in the small
 * `workflowProgress` record on the project; a stored record can unlock a
 * step whose substance is an action (opened / rehearsed), but it can NEVER
 * mark a data-derived step complete when the evaluator says it is not.
 *
 * Jewel reads this model every turn (see app/api/jewel/route.ts): she
 * states progress from it, speaks a step's checkLine when the step becomes
 * complete, and may direct navigation with a `navigate` directive that this
 * module validates against the same model — she can never send a creator
 * to a stage, step, or item that does not exist for their project.
 */

export type WorkflowStageId = "create" | "stage" | "showtime";
export type WorkflowStepState = { id: string; label: string; complete: boolean; checkLine: string; skipped?: boolean };
export type WorkflowStageState = { id: WorkflowStageId; index: number; label: string; steps: WorkflowStepState[] };
export type WorkflowStepRef = { stageId: WorkflowStageId; stageIndex: number; stepId: string; label: string };
export type WorkflowEvaluation = {
  stages: WorkflowStageState[];
  /** The first incomplete step in stage order — the task the creator is on. */
  current: WorkflowStepRef | null;
  /** The step immediately after `current` in stage order, when one exists. */
  next: WorkflowStepRef | null;
};

export type JewelNavigate = { stage: 0 | 1 | 2; stepId?: string; targetId?: string };

const PLACEHOLDER_NAMES = ["New Project", "New LIVE Experience"];

function realName(project: Project): boolean {
  const name = (project.name || "").trim();
  return Boolean(name) && !PLACEHOLDER_NAMES.includes(name);
}

/** The Publish checklist's title test, mirrored exactly (name + overlay title). */
function realTitle(project: Project): boolean {
  if (!realName(project)) return false;
  const overlayTitle = (project.overlay?.title || "").trim().toUpperCase();
  return !["", "YOUR LIVESTREAM", "YOUR LIVE EXPERIENCE"].includes(overlayTitle);
}

function planComplete(project: Project): boolean {
  const plan = project.gamePlan || {};
  return realName(project) && Boolean((plan.theme || "").trim()) && Boolean((plan.winning || "").trim());
}

function mediaComplete(project: Project): boolean {
  // Filed media only: a saved storage key or a real URL. Pending video
  // requests live outside project.assets and never count here.
  return (project.assets || []).some(asset => Boolean(asset.storageKey) || Boolean(asset.url));
}

function triviaCardsComplete(project: Project): boolean {
  return (project.gameTools || []).some(tool => {
    if (!tool.enabled) return false;
    if (tool.type === "question-card") return questionPool(project, tool).length > 0;
    if (tool.type === "card-list") return savedListEntries(tool).length > 0 || listCards(tool).length > 0;
    return false;
  });
}

function boardComplete(project: Project): boolean {
  return (project.gameTools || []).some(tool => tool.enabled && (tool.type === "trivia-board" || tool.type === "blank-board"));
}

const BOARD_TYPES = ["trivia-board", "blank-board"];

function gameToolsComplete(project: Project): boolean {
  return (project.gameTools || []).some(tool => tool.enabled && !BOARD_TYPES.includes(tool.type) && tool.type !== "trivia-list");
}

function scenesComplete(project: Project): boolean {
  return (project.compositions || []).length > 0;
}

function backgroundComplete(project: Project): boolean {
  return (project.assets || []).some(asset => asset.inProject && asset.role === "background")
    || (project.gameTools || []).some(tool => tool.enabled && tool.inOverlayBuild && BOARD_TYPES.includes(tool.type));
}

function placedComplete(project: Project): boolean {
  const placedAssets = (project.assets || []).filter(asset => asset.inProject && asset.role !== "background").length;
  const placedTools = (project.gameTools || []).filter(tool => tool.inOverlayBuild).length;
  return placedAssets + placedTools > 0 || (project.controls || []).length > 0;
}

function buttonsComplete(project: Project): boolean {
  const controls = project.controls || [];
  return controls.length > 0 && controls.every(control => Boolean(control.action) && control.action !== "unassigned");
}

function readinessComplete(project: Project): boolean {
  return (project.controls || []).length > 0 && buildReadiness(project).length === 0;
}

function checksComplete(project: Project): boolean {
  return realTitle(project) && (project.controls || []).length > 0 && buildReadiness(project).length === 0;
}

function publishedComplete(project: Project): boolean {
  return Boolean(project.publishedSnapshot) || project.status === "Published";
}

/* ---- Talk Show or Classroom stage-0 evaluators ----
 * Jessica's own layout (2026-11-04): eight areas in her order — theme,
 * background, title sign, opening prompt, then the four optional areas
 * (research, quiz or follow-ups, media, anything-missed). The optional
 * areas are skippable: a recorded skip counts as complete (applied in
 * evaluateWorkflow), and completing — by fact or by skip — never locks
 * an area against going back and changing it. */

function talkThemeComplete(project: Project): boolean {
  // The first box: the creator has answered what their show is all about
  // (gamePlan.theme — the same field the new-project ask seeds).
  return Boolean((project.gamePlan?.theme || "").trim());
}

function talkBackgroundComplete(project: Project): boolean {
  return backgroundAssets(project).length > 0;
}

function talkSignComplete(project: Project): boolean {
  // A real show name AND a sign present: the sign Jewel made (a backdrop
  // carrying the title as a text layer) or the creator's own uploaded sign.
  return realName(project) && signPresent(project);
}

function talkPromptComplete(project: Project): boolean {
  return promptPresent(project);
}

function talkResearchComplete(project: Project): boolean {
  // No evaluator can verify a conversation: the step completes on the one
  // recorded fact — Jewel ran a web search in this project (recorded by
  // the project page when her search returns results, like toolboxOpened).
  return project.workflowProgress?.researched === true;
}

function talkQuizComplete(project: Project): boolean {
  return (project.gameTools || []).some(tool => tool.enabled && quizQuestionsOf(tool).length > 0);
}

function talkFollowUpsComplete(project: Project): boolean {
  // The follow-up path: the creator's own question cards exist — a card
  // system drawing from a pool, or a saved list carrying entries/cards.
  return (project.gameTools || []).some(tool => {
    if (!tool.enabled) return false;
    if (tool.type === "question-card") return questionPool(project, tool).length > 0;
    if (tool.type === "card-list") return savedListEntries(tool).length > 0 || listCards(tool).length > 0;
    return false;
  });
}

function talkMediaComplete(project: Project): boolean {
  // Media beyond the background/sign: a filed non-background asset, or
  // the YouTube option added for the dashboard.
  const filed = (project.assets || []).some(asset => asset.role !== "background" && (Boolean(asset.storageKey) || Boolean(asset.url)));
  const youtube = (project.gameTools || []).some(tool => tool.enabled && tool.type === "youtube");
  return filed || youtube;
}

function talkMissedComplete(project: Project): boolean {
  // "Anything we missed?" holds the toolbox doors; opening that review is
  // the recorded fact, exactly as the old toolbox step used it.
  return project.workflowProgress?.toolboxOpened === true;
}

type StepDef = { id: string; label: string; checkLine: string; evaluate: (project: Project) => boolean; skippable?: boolean; skipLine?: string };

function createStageSteps(project: Project): StepDef[] {
  const toolbox: StepDef = {
    id: "toolbox",
    label: "Review your toolbox",
    checkLine: project.kind === "gameshow"
      ? "I've reviewed your toolbox with you: plan, media, questions, cards, tools and packages are all here."
      : project.kind === "talk"
        ? "I've reviewed your toolbox with you: your sign, backdrops, research, quiz, videos and slides are all here."
        : "I've reviewed your toolbox with you — everything you've made is filed here.",
    evaluate: () => false, // replaced below: it depends on the other steps
  };
  const steps: StepDef[] = project.kind === "talk"
    ? [
      { id: "theme", label: "Show theme & subject", checkLine: "your show's theme & subject are set — I know what your show is all about. Step complete.", evaluate: talkThemeComplete },
      { id: "background", label: "Decide on a background", checkLine: "your background is designed and saved with your show. Step complete.", evaluate: talkBackgroundComplete },
      { id: "sign", label: "Add your title sign", checkLine: "your title sign is on your show — the title, lettered the way you chose. Step complete.", evaluate: talkSignComplete },
      { id: "prompt", label: "Opening prompt", checkLine: "your opening prompt is on your background, in your font and your colors. Step complete.", evaluate: talkPromptComplete },
      { id: "research", label: "Research your talking point", checkLine: "we've researched your talking point together — the data points are shaping your show. Step complete.", evaluate: talkResearchComplete, skippable: true, skipLine: "you skipped research for now — it counts as complete, and you can come back to it anytime. Step complete." },
      { id: "quiz", label: "Quiz or follow-up questions", checkLine: "your questions are ready — a quiz, or follow-up cards your audience can play along with. Step complete.", evaluate: (project: Project) => talkQuizComplete(project) || talkFollowUpsComplete(project), skippable: true, skipLine: "you skipped questions for now — it counts as complete, and you can come back to it anytime. Step complete." },
      { id: "media", label: "Add your media", checkLine: "your media is filed and ready — your clips, your uploads, your show's extras. Step complete.", evaluate: talkMediaComplete, skippable: true, skipLine: "you skipped media for now — it counts as complete, and you can come back to it anytime. Step complete." },
      { id: "missed", label: "Anything we missed?", checkLine: "we've covered everything else you wanted — your show is fully imagined. Step complete.", evaluate: talkMissedComplete, skippable: true, skipLine: "skipped — nothing else to add, and that counts as complete. You can come back anytime. Step complete." },
    ]
    : project.kind === "gameshow"
    ? [
      { id: "plan", label: "Plan your show", checkLine: "your show has a name, a theme, and a way to win. Step complete.", evaluate: planComplete },
      { id: "media", label: "Make your media", checkLine: "your media is made and filed in your library. Step complete.", evaluate: mediaComplete },
      { id: "trivia-cards", label: "Write/generate and customize your trivia cards", checkLine: "your trivia cards are ready: questions in place and the cards built. Step complete.", evaluate: triviaCardsComplete },
      { id: "board", label: "Make your game board", checkLine: "your game board is built and ready to play on. Step complete.", evaluate: boardComplete },
      { id: "tools", label: "Build your game tools", checkLine: "your game tools are built and in your toolbox. Step complete.", evaluate: gameToolsComplete },
      { id: "scenes", label: "Compose your scenes & effects", checkLine: "your scene is composed and saved as a package. Step complete.", evaluate: scenesComplete },
      toolbox,
    ]
    : [
      { id: "plan", label: "Plan your project", checkLine: "your project has a name, a theme, and a way to win. Step complete.", evaluate: planComplete },
      { id: "media", label: "Make your media", checkLine: "your media is made and filed in your library. Step complete.", evaluate: mediaComplete },
      { id: "tools", label: "Build your tools", checkLine: "your tools are built and in your toolbox. Step complete.", evaluate: gameToolsComplete },
      { id: "scenes", label: "Compose your scenes & effects", checkLine: "your scene is composed and saved as a package. Step complete.", evaluate: scenesComplete },
      toolbox,
    ];
  // The toolbox review is complete only when every earlier step in this
  // stage is complete AND the creator has actually opened the toolbox —
  // the one fact that lives in the progress record.
  const earlier = steps.filter(step => step.id !== "toolbox");
  toolbox.evaluate = (candidate: Project) =>
    earlier.every(step => step.evaluate(candidate)) && candidate.workflowProgress?.toolboxOpened === true;
  return steps;
}

const STAGE_STEPS: { id: WorkflowStageId; label: string; steps: (project: Project) => StepDef[] }[] = [
  { id: "create", label: "Imagine and Create", steps: createStageSteps },
  {
    id: "stage", label: "Set the Stage", steps: () => [
      { id: "background", label: "Set your background", checkLine: "your opening scene is set — the backdrop is on the overlay.", evaluate: backgroundComplete },
      { id: "placed", label: "Place your pieces", checkLine: "your pieces are placed on the stage, each one added by your own choice.", evaluate: placedComplete },
      { id: "buttons", label: "Decide what each button does", checkLine: "every button on your dashboard has a decided job.", evaluate: buttonsComplete },
      { id: "rehearsed", label: "Rehearse your show", checkLine: "you rehearsed your show with the draft dashboard.", evaluate: (project: Project) => project.workflowProgress?.rehearsed === true },
      { id: "readiness", label: "Check you're ready to publish", checkLine: "no connection issues remain — you're ready to publish.", evaluate: readinessComplete },
    ],
  },
  {
    id: "showtime", label: "Showtime!", steps: () => [
      { id: "checks", label: "Run the final checks", checkLine: "your title is set, your buttons are ready, and every publish check passes.", evaluate: checksComplete },
      { id: "published", label: "Publish your show", checkLine: "your show is published — the live version is saved.", evaluate: publishedComplete },
      { id: "live", label: "Run your show live", checkLine: "your show is live — your overlay and private dashboard links are ready.", evaluate: publishedComplete },
    ],
  },
];

/** Evaluate the whole workflow for a project from its real data. */
export function evaluateWorkflow(project: Project): WorkflowEvaluation {
  const skippedIds = project.workflowProgress?.skipped || [];
  const stages: WorkflowStageState[] = STAGE_STEPS.map((stage, index) => ({
    id: stage.id,
    index,
    label: stage.label,
    steps: stage.steps(project).map(step => {
      const byFact = step.evaluate(project);
      // A skip counts as complete for the areas Jessica marked optional —
      // but the state remembers it was a skip, so Jewel's check-off line
      // says so honestly instead of claiming work that never happened.
      const bySkip = !byFact && step.skippable === true && skippedIds.includes(step.id);
      return {
        id: step.id,
        label: step.label,
        complete: byFact || bySkip,
        checkLine: bySkip && step.skipLine ? step.skipLine : step.checkLine,
        ...(bySkip ? { skipped: true } : {}),
      };
    }),
  }));
  const flat: WorkflowStepRef[] = stages.flatMap(stage =>
    stage.steps.filter(step => !step.complete).map(step => ({ stageId: stage.id, stageIndex: stage.index, stepId: step.id, label: step.label })),
  );
  const allRefs: WorkflowStepRef[] = stages.flatMap(stage =>
    stage.steps.map(step => ({ stageId: stage.id, stageIndex: stage.index, stepId: step.id, label: step.label })),
  );
  const current = flat[0] || null;
  let next: WorkflowStepRef | null = null;
  if (current) {
    const at = allRefs.findIndex(ref => ref.stageId === current.stageId && ref.stepId === current.stepId);
    next = at >= 0 ? (allRefs[at + 1] || null) : null;
  }
  return { stages, current, next };
}

/** The step key used in the progress record's issuedChecks list. */
export function workflowStepKey(stageId: string, stepId: string): string {
  return `${stageId}:${stepId}`;
}

/** Every step that is complete in `after` but was not complete in `before`, in stage order. */
export function newlyCompletedSteps(before: WorkflowEvaluation, after: WorkflowEvaluation): { stageId: WorkflowStageId; stepId: string; checkLine: string }[] {
  const fresh: { stageId: WorkflowStageId; stepId: string; checkLine: string }[] = [];
  for (const stage of after.stages) {
    const beforeStage = before.stages.find(candidate => candidate.id === stage.id);
    for (const step of stage.steps) {
      const was = beforeStage?.steps.find(candidate => candidate.id === step.id);
      if (step.complete && was && !was.complete) fresh.push({ stageId: stage.id, stepId: step.id, checkLine: step.checkLine });
    }
  }
  return fresh;
}

/** Resolve a navigate targetId to the kind of saved item it names, or null. */
export function resolveNavigateTarget(project: Project, targetId: string): { kind: "control" | "tool" | "asset"; id: string } | null {
  if ((project.controls || []).some(control => control.id === targetId)) return { kind: "control", id: targetId };
  if ((project.gameTools || []).some(tool => tool.id === targetId)) return { kind: "tool", id: targetId };
  if ((project.assets || []).some(asset => (asset.storageKey || asset.name) === targetId)) return { kind: "asset", id: targetId };
  return null;
}

/**
 * Validate a navigation directive from Jewel against the progress model
 * and the project itself. Anything that does not check out — a stage out
 * of range, a step that does not exist for this project in that stage, a
 * target that is not a saved item — strips the whole directive to null, so
 * she can never direct a creator to a place that does not exist.
 */
export function validateNavigate(project: Project, raw: unknown): JewelNavigate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const stage = candidate.stage;
  if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 0 || stage > 2) return null;
  const evaluation = evaluateWorkflow(project);
  const stageState = evaluation.stages[stage];
  if (!stageState) return null;
  const navigate: JewelNavigate = { stage: stage as 0 | 1 | 2 };
  if (candidate.stepId !== undefined) {
    if (typeof candidate.stepId !== "string" || !stageState.steps.some(step => step.id === candidate.stepId)) return null;
    navigate.stepId = candidate.stepId;
  }
  if (candidate.targetId !== undefined) {
    if (typeof candidate.targetId !== "string" || !resolveNavigateTarget(project, candidate.targetId)) return null;
    navigate.targetId = candidate.targetId;
  }
  return navigate;
}

/** The compact progress block Jewel receives in her context each turn. */
/** True when every Imagine and Create step is complete — by fact, or by
 * a recorded skip where the step allows one. The talk stage-nav gate. */
export function allCreateStepsComplete(evaluation: WorkflowEvaluation): boolean {
  const create = evaluation.stages[0];
  return Boolean(create) && create.steps.every(step => step.complete);
}

export function workflowContextBlock(evaluation: WorkflowEvaluation): {
  stages: { stage: string; steps: { step: string; stepId: string; done: boolean; skipped?: boolean; checkLine?: string }[] }[];
  currentTask: string | null;
  currentStepId: string | null;
  currentStage: number | null;
  afterThat: string | null;
} {
  return {
    stages: evaluation.stages.map(stage => ({
      stage: stage.label,
      steps: stage.steps.map(step => ({
        step: step.label,
        stepId: step.id,
        done: step.complete,
        ...(step.skipped ? { skipped: true } : {}),
        ...(step.complete ? { checkLine: step.checkLine } : {}),
      })),
    })),
    currentTask: evaluation.current?.label || null,
    currentStepId: evaluation.current?.stepId || null,
    currentStage: evaluation.current ? evaluation.current.stageIndex : null,
    afterThat: evaluation.next?.label || null,
  };
}
