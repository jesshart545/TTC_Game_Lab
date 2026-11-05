"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Project } from "../lib/project";
import type { WorkflowEvaluation, WorkflowStepState } from "../lib/workflow-progress";
import {
  CREATIVE_LIBERTY_TEXT, GAMESHOW_STEP_META, STEP_ASKS, PLAN_CHANGES, MEDIA_CHANGES, MEDIA_SHARED_CHANGES,
  backdropAsset, latestAssetOfKind, type ChangeItem,
} from "../lib/gameshow-path";
import { GENERATORS } from "../lib/workshop-libraries";
import { GAME_TEMPLATES } from "../lib/game-templates";
import { assetCategory } from "../lib/asset-folders";
import AssetThumbnail from "./AssetThumbnail";
import TriviaStep, { BoardStep, ScenesStep, ToolboxStep } from "./GameshowSteps";
import ToolsStep from "./GameshowToolDemos";
import "./gameshow-workshop.css";

/**
 * The Gameshow Workshop, rebuilt to the approved demonstration design:
 * a guided path of seven tasks (state read from Piece 1's workflow model —
 * this component keeps no completion state of its own), living
 * demonstrations instead of stacked words and forms, a plain list of what
 * can be changed under each one, and example asks that are handed to Jewel.
 * Nothing here generates or edits: Jewel is the only door, exactly as the
 * doors-close build (Piece 2, Half B) left the product.
 */

export type GameshowDoors = {
  openBoardDesigner: (toolId: string) => void;
  openCardEditor: (toolId: string) => void;
  openListEditor: (toolId: string) => void;
  openMediaEditor: (assetIndex: number) => void;
  openComposer: () => void;
  applyTemplate: (templateId: string) => void;
  showTemplates: () => void;
  upload: () => void;
  openNewList: () => void;
  openBoardTemplates: () => void;
  openToolTemplates: () => void;
  showAsset: (key: string) => void;
  openCityCrimeScene: () => void;
  downloadTriviaPdf: (questions: any[]) => void;
  showSavedWork: () => void;
  showPlanForm: () => void;
};

export type GameshowWorkshopProps = {
  project: Project;
  workflow: WorkflowEvaluation;
  activeStep: string;
  onNavigateStep: (stage: number, stepId?: string) => void;
  onAskJewel: (text: string) => void;
  onOpenJewel: () => void;
  doors: GameshowDoors;
  ccssEntitled: boolean;
};

/**
 * The light stage (components/GameshowStage.tsx) renders these same
 * screens inside Jewel's checklist model (Jessica, 2026-11-04): she
 * holds the steps and marks them herself, so the page furniture —
 * step heads, "done when" strips, checked-off lines, change piles
 * and ask strips — stands down. Screens under this context keep
 * every demonstration, shelf and manual door; only the furniture
 * is suppressed. The user just talks to Jewel.
 */
export const BareStageContext = createContext(false);

/** A ticking clock for demonstration animations (the runtime's own pattern). */
export function useNow(active: boolean): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => { setTick(t => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return Date.now();
}

export function ChangeList({ title, items, onAsk, spring }: { title: string; items: ChangeItem[]; onAsk: (text: string) => void; spring?: string }) {
  const bare = useContext(BareStageContext);
  if (bare) return null;
  return (
    <div className="gsw-edits">
      <div className="gsw-eh">{title}</div>
      {spring && <p className="gsw-spring">{spring}</p>}
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            {item.say ? (
              <button type="button" className="gsw-ei" onClick={() => onAsk(item.say!)}>
                <span>{item.label}{item.sub && <span className="gsw-sub">{item.sub}</span>}</span>
                <span className="gsw-ask-arrow">TAP TO ASK →</span>
              </button>
            ) : (
              <span className="gsw-ei"><span>{item.label}{item.sub && <span className="gsw-sub">{item.sub}</span>}</span></span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AskStrip({ stepId, note, onAskJewel: onAsk, onOpenJewel, extra }: GameshowWorkshopProps & { stepId: string; note?: ReactNode; extra?: ReactNode }) {
  const bare = useContext(BareStageContext);
  if (bare) return null;
  const meta = GAMESHOW_STEP_META[stepId];
  const asks = STEP_ASKS[stepId] || [];
  return (
    <div>
      <div className="gsw-seclabel">Make it with Jewel</div>
      <div className="gsw-jewel">
        <div className="gsw-jhead">
          <div className="gsw-java">✦</div>
          <div><div className="gsw-jt">Jewel</div><div className="gsw-js">Your co-creator</div></div>
        </div>
        <div className="gsw-jmsg">{note ?? meta?.jewelNote}</div>
        <div className="gsw-exlabel">Examples — tap one, or write your own</div>
        <div className="gsw-jchips">
          {asks.map(ask => (
            <button key={ask.say} type="button" className="gsw-jchip" onClick={() => onAsk(ask.say)}>{ask.chip}</button>
          ))}
        </div>
        <button type="button" className="gsw-openjewel" onClick={onOpenJewel}>Write it in Jewel’s box ↓</button>
        {extra && <p className="gsw-jnote">{extra}</p>}
      </div>
    </div>
  );
}

export function StepShell({ stepId, step, children }: { stepId: string; step?: WorkflowStepState; children: ReactNode }) {
  const bare = useContext(BareStageContext);
  const meta = GAMESHOW_STEP_META[stepId];
  if (bare || !meta || !step) return <>{children}</>;
  return (
    <section aria-label={step.label}>
      <div className="gsw-stephead"><span className="gsw-k">{meta.kicker}</span><div className="gsw-display">{step.label}</div></div>
      <p className="gsw-ask">{meta.intro}</p>
      <div className={"gsw-donewhen" + (step.complete ? " met" : "")}>
        <span className="gsw-box">{step.complete ? "✓" : ""}</span>
        <span><b>This step is done when</b> {meta.doneWhen}</span>
      </div>
      {step.complete && <div className="gsw-jcheck">✓ Checked off — {step.checkLine}</div>}
      {children}
    </section>
  );
}

/** Draw-without-repeating over a list's real entries — the picker/card-list behavior, as a demonstration. */
export function DrawDemo({ title, entries, drawnLabel }: { title: string; entries: string[]; drawnLabel: string }) {
  const [remaining, setRemaining] = useState<string[]>(entries);
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => { setRemaining(entries); setDrawn(null); }, [entries]);
  function draw() {
    if (!remaining.length) return;
    const index = Math.floor(Math.random() * remaining.length);
    setDrawn(remaining[index]);
    setRemaining(remaining.filter((_, i) => i !== index));
  }
  return (
    <div className="gsw-card">
      <h4>{title}</h4>
      <div className="gsw-qcard" style={{ marginTop: 12, boxShadow: "none" }}>
        <div className="gsw-qk">{drawnLabel}</div>
        <div className="gsw-qq" style={{ fontSize: 17 }}>{drawn ?? "Press draw — a card appears here"}</div>
      </div>
      <div className="gsw-chipsrow">
        <button type="button" className="gsw-demobtn gold" onClick={draw} disabled={!remaining.length}>Draw a card</button>
        <span className="gsw-vchip">{remaining.length} left</span>
        <button type="button" className="gsw-jchip" onClick={() => { setRemaining(entries); setDrawn(null); }}>New round</button>
        {!remaining.length && <span className="gsw-demostatus">Pool empty — every card drawn. New round resets it.</span>}
      </div>
    </div>
  );
}

/* ---------------- Step 1 · Plan your show ---------------- */

/** The pictured example stage for an empty project: the site's own
 * Gameshow artwork, so an area demonstrates with a real picture —
 * never a flat gradient void or text placeholders. Labelled as an
 * example wherever it stands in (the Talk stage's own pattern). */
export function GameshowExampleStage() {
  return <img className="gsw-bg" src="/redesign/kind-gameshow.webp" alt="" />;
}

/** The plan at a glance, over the show's own backdrop — or, while the
 * project is still empty, over the pictured example stage. */
export function PlanVisual({ project }: { project: Project }) {
  const plan = project.gamePlan || {};
  const backdrop = backdropAsset(project);
  const chips: [string, string][] = [
    ["Theme", plan.theme], ["Rounds", plan.rounds], ["Turns", plan.turns], ["Scoring", plan.scoring], ["Winning", plan.winning],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())) as [string, string][];
  return (
    <div>
      <div className="gsw-seclabel">Your game plan — as it stands</div>
      <div className="gsw-stage-visual" style={{ minHeight: 280 }}>
        {backdrop?.url ? <img className="gsw-bg" src={backdrop.url} alt="" /> : <GameshowExampleStage />}
        <div className="gsw-shade" />
        <div className="gsw-inner">
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 2.4, color: "#e9c979" }}>YOUR GAME PLAN</div>
          <div className="gsw-display gsw-plan-title">{project.name}</div>
          {plan.purpose
            ? <p style={{ color: "#d9d3ec", fontSize: 14.5, marginTop: 6, lineHeight: 1.55 }}>{plan.purpose}</p>
            : <p style={{ color: "#d9d3ec", fontSize: 14, marginTop: 6, lineHeight: 1.55 }}>No plan yet — tell Jewel your theme and she drafts the rest: rounds, scoring, how it ends.</p>}
          {chips.length > 0 && (
            <div className="gsw-chipsrow">
              {chips.map(([label, value], i) => <span key={label} className={"gsw-vchip" + (i === 0 ? " gold" : "")}>{label} · {value}</span>)}
            </div>
          )}
          <p style={{ color: "#948bb3", fontSize: 12.5, marginTop: 12 }}>Purpose, rules and play-through live on the plan itself — this card is the whole plan at a glance.</p>
        </div>
      </div>
    </div>
  );
}

/** The ready-made shows shelf: each tile is its picture and name —
 * tap one and it is applied to the project, as today. */
export function PlanTemplates({ doors }: { doors: GameshowDoors }) {
  const templates = GAME_TEMPLATES.slice(0, 3);
  return (
    <div>
      <div className="gsw-seclabel" style={{ marginTop: 22 }}>Ready-made shows</div>
      <div className="gsw-shelf">
        {templates.map(template => (
          <button key={template.id} type="button" className="gsw-asset gsw-template-card" onClick={() => doors.applyTemplate(template.id)}>
            <img src="/redesign/kind-gameshow.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div className="gsw-shade" />
            <span className="gsw-an">{template.name}</span>
          </button>
        ))}
        <button type="button" className="gsw-asset gsw-template-card" onClick={doors.showTemplates}>
          <img src="/redesign/kind-gameshow.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div className="gsw-shade" />
          <span className="gsw-an">All {GAME_TEMPLATES.length} templates →</span>
        </button>
      </div>
    </div>
  );
}

function PlanStep(props: GameshowWorkshopProps & { step?: WorkflowStepState }) {
  const { project, doors, onAskJewel: onAsk } = props;
  return (
    <StepShell stepId="plan" step={props.step}>
      <div className="gsw-cols">
        <div>
          <PlanVisual project={project} />
          <ChangeList title="What you can change — the game plan" items={PLAN_CHANGES} onAsk={onAsk} />
          <PlanTemplates doors={doors} />
        </div>
        <AskStrip
          {...props}
          stepId="plan"
          extra={<>Prefer typing the plan yourself? The plan form (title, theme, purpose, rules, rounds, turns, scoring, winning) is right below — same fields as today. <button type="button" className="gsw-jchip" style={{ marginTop: 6 }} onClick={() => props.onNavigateStep(0, "plan")}>Open the plan form</button></>}
        />
      </div>
    </StepShell>
  );
}

/* ---------------- Step 2 · Make your media ---------------- */

const MEDIA_DESCRIPTIONS: Record<string, string> = {
  image: "Backdrop & artwork", video: "Intros & clips — plays", voice: "Announcer lines — press play",
  music: "Theme & beds — press play", sfx: "Buzzers & stings — press play",
};
const WAVE_HEIGHTS = [40, 70, 100, 55, 85, 35, 65, 90, 50, 75, 30, 60];

function AudioDemo({ project, kind, label }: { project: Project; kind: "voice" | "music" | "sfx"; label: string }) {
  const asset = latestAssetOfKind(project, kind);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  if (!asset?.url) {
    return (
      <div className="gsw-card">
        <span className="gsw-vchip gold">{label} · nothing yet</span>
        <div className="gsw-wave" aria-hidden="true">
          {WAVE_HEIGHTS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="gsw-card">
      <span className="gsw-vchip gold">{label} · {asset.name}</span>
      <div className={"gsw-wave" + (playing ? " playing" : "")} aria-hidden="true">
        {WAVE_HEIGHTS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
      </div>
      <div className="gsw-chipsrow">
        <button
          type="button" className="gsw-demobtn"
          onClick={() => { const audio = audioRef.current; if (!audio) return; if (playing) audio.pause(); else void audio.play(); }}
        >{playing ? "⏸ Pause" : "▶ Play it"}</button>
        <span className="gsw-vchip">From your library — the real file</span>
      </div>
      <audio
        ref={audioRef} src={asset.url} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

/** The media demonstrations: one living demo per media kind. On an
 * empty project the image demo stands over the pictured example
 * stage — never an empty frame with text placeholders. */
export function MediaDemos(props: GameshowWorkshopProps & { kind: string; onKindChange: (kind: string) => void }) {
  const { project, kind, onKindChange } = props;
  const [shape, setShape] = useState("16/9");
  const backdrop = backdropAsset(project);
  const video = latestAssetOfKind(project, "video");
  const pending = project.pendingVideos || [];
  const shapeWidth: Record<string, string> = { "16/9": "520px", "9/16": "230px", "1/1": "360px", "4/3": "440px" };
  return (
    <div>
      <div className="gsw-mtypes">
        {GENERATORS.map(generator => (
          <button key={generator.type} type="button" className={"gsw-mtype" + (kind === generator.type ? " on" : "")} onClick={() => onKindChange(generator.type)}>
            <div className="gsw-ic">{generator.icon}</div>
            <div className="gsw-mt">{generator.label}</div>
            <div className="gsw-md">{MEDIA_DESCRIPTIONS[generator.type]}</div>
          </button>
        ))}
      </div>
      <div>
          <span className="gsw-demotag">Live demonstration — try it</span>
          {kind === "image" && (
            <div>
              <div className="gsw-seclabel">{backdrop ? "Image — your backdrop & sign, one piece. Change its shape and watch the frame follow" : "Image — your backdrop & sign will stand here, one piece. Change its shape and watch the frame follow"}</div>
              <div className="gsw-imgframe" style={{ aspectRatio: shape.replace("/", " / "), maxWidth: shapeWidth[shape] || "520px" }}>
                <div className="gsw-stage-visual" style={{ height: "100%" }}>
                  {backdrop?.url
                    ? <img className="gsw-bg" src={backdrop.url} alt="" />
                    : <GameshowExampleStage />}
                  <div className="gsw-inner"><span className="gsw-vchip gold">{backdrop ? `Stage backdrop · ${backdrop.name}` : "Example stage"}</span></div>
                </div>
              </div>
              <div className="gsw-chipsrow">
                <span style={{ fontSize: 13, color: "#948bb3", fontWeight: 600 }}>Shape:</span>
                {[["16/9", "Full overlay · 16:9"], ["9/16", "Portrait · 9:16"], ["1/1", "Square · 1:1"], ["4/3", "4:3"]].map(([value, label]) => (
                  <button key={value} type="button" className={"gsw-vchip" + (shape === value ? " on" : "")} onClick={() => setShape(value)}>{label}</button>
                ))}
                <span className="gsw-vchip">1920 × 1080 canvas</span><span className="gsw-vchip">Starting image · optional</span>
              </div>
            </div>
          )}
          {kind === "video" && (
            <div>
              <div className="gsw-seclabel">Video — your clip, really playing. Length is yours to set</div>
              {video?.url ? (
                <div className="gsw-stage-visual" style={{ maxWidth: 520 }}>
                  <video src={video.url} controls loop playsInline style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover", background: "#000" }} />
                  <div className="gsw-inner" style={{ position: "absolute", left: 0, bottom: 0, pointerEvents: "none" }}><span className="gsw-vchip gold">▶ {video.name}</span></div>
                </div>
              ) : (
                <div className="gsw-stage-visual" style={{ maxWidth: 520, minHeight: 220 }}>
                  <GameshowExampleStage />
                  <div className="gsw-shade" />
                  <div className="gsw-inner"><span className="gsw-vchip gold">No video yet</span></div>
                </div>
              )}
              <div className="gsw-chipsrow">
                <span style={{ fontSize: 13, color: "#948bb3", fontWeight: 600 }}>Length:</span>
                <span className="gsw-vchip">5 seconds</span><span className="gsw-vchip">10 seconds</span><span className="gsw-vchip">30 seconds</span>
                <span className="gsw-vchip">Reference image · optional</span><span className="gsw-vchip">Single clip up to 30s</span>
              </div>
              {pending.map(job => (
                <div key={job.videoId} className="gsw-card" style={{ marginTop: 14 }}>
                  <h4>⏳ {job.prompt} — still rendering</h4>
                </div>
              ))}
            </div>
          )}
          {kind === "voice" && (<><div className="gsw-seclabel">Voice — press play and hear your announcer line</div><AudioDemo project={project} kind="voice" label="Voice" /></>)}
          {kind === "music" && (<><div className="gsw-seclabel">Music — press play for your theme</div><AudioDemo project={project} kind="music" label="Music" /></>)}
          {kind === "sfx" && (<><div className="gsw-seclabel">Sound effect — press play and hear it</div><AudioDemo project={project} kind="sfx" label="Sound Effect" /></>)}
      </div>
    </div>
  );
}

/** The media library shelf: the most recent work, stored — plus the
 * upload door, exactly as it works today. */
export function MediaShelf({ project, doors }: { project: Project; doors: GameshowDoors }) {
  const shelf = (project.assets || []).slice(-7);
  return (
    <div>
      <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your media library — everything you’ve made &amp; uploaded</div>
      <div className="gsw-shelf">
        {shelf.map(asset => {
          const key = asset.storageKey || asset.name;
          return (
            <button key={key} type="button" className="gsw-asset" onClick={() => doors.showAsset(key)}>
              <AssetThumbnail asset={asset} kind={assetCategory(asset)} />
              <div className="gsw-shade" />
              <span className="gsw-ak">{assetCategory(asset)}</span>
              <span className="gsw-an">{asset.name}</span>
            </button>
          );
        })}
        <button type="button" className="gsw-asset plain" onClick={doors.upload}>
          <span className="gsw-big">＋</span>
          <span className="gsw-an" style={{ position: "static", fontWeight: 800, fontSize: 13.5 }}>Upload assets</span>
        </button>
      </div>
    </div>
  );
}

function MediaStep(props: GameshowWorkshopProps & { step?: WorkflowStepState }) {
  const { project, doors, onAskJewel: onAsk } = props;
  const [kind, setKind] = useState<string>("image");
  return (
    <StepShell stepId="media" step={props.step}>
      <MediaDemos {...props} kind={kind} onKindChange={setKind} />
      <div className="gsw-cols">
        <div>
          <ChangeList
            title="What you can change"
            items={[...(MEDIA_CHANGES[kind] || []), ...MEDIA_SHARED_CHANGES]}
            onAsk={onAsk}
            spring="Springboards, not a menu — every line here is something Jewel can do, and anything you can describe goes on the list too."
          />
          <MediaShelf project={project} doors={doors} />
        </div>
        <AskStrip
          {...props}
          stepId="media"
          extra="Adjust opens the same media editor as today — trim, resize, save an edited copy; AI edits go through Jewel now, like all generation. Uploads work exactly as before, from the library shelf."
        />
      </div>
    </StepShell>
  );
}

/* ---------------- Shell ---------------- */

const SHORT_LABELS: Record<string, string> = {
  plan: "plan", media: "media", "trivia-cards": "trivia cards", board: "game board",
  tools: "game tools", scenes: "scenes & effects", toolbox: "your toolbox",
};

export default function GameshowWorkshop(props: GameshowWorkshopProps) {
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
        These buttons are the path — each one names a task, and tapping it takes you straight to that task’s screen, nowhere else first.
        Work top to bottom and every part of your show gets made. You can revisit any step any time, and the creative steps can be re-run
        as often as you like — nothing here locks you in. A step earns its green ✓ only when Jewel has checked it against what’s actually
        in your project — you never tick a step off yourself. Each step opens with a working demonstration: try the thing itself, watch
        how it can change, then tell Jewel to make yours.
      </p>
      <div className="gsw-liberty">
        <div className="gsw-lmedal" aria-hidden="true">✦</div>
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{CREATIVE_LIBERTY_TEXT}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>

      {active.id === "plan" && <PlanStep {...screenProps} />}
      {active.id === "media" && <MediaStep {...screenProps} />}
      {active.id === "trivia-cards" && <TriviaStep {...screenProps} />}
      {active.id === "board" && <BoardStep {...screenProps} />}
      {active.id === "tools" && <ToolsStep {...screenProps} />}
      {active.id === "scenes" && <ScenesStep {...screenProps} />}
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
