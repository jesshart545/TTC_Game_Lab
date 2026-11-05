"use client";

import { useContext, useState } from "react";
import type { GameTool } from "../lib/project";
import type { WorkflowStepState } from "../lib/workflow-progress";
import {
  CARD_LIST_CHANGES, TRIVIA_GEN_CHANGES, CARD_CHANGES, BOARD_CHANGES, SCENE_CHANGES,
  CARD_LOOK_PRESETS, CARD_SHAPES, CARD_SHAPE_LABELS, EXAMPLE_QUESTIONS, backdropAsset,
} from "../lib/gameshow-path";
import { listCards, savedListEntries } from "../lib/card-lists";
import { cardDesign, questionPool } from "../lib/question-cards";
import { EFFECT_NAMES } from "../lib/composition-effects";
import { AskStrip, BareStageContext, ChangeList, DrawDemo, GameshowExampleStage, StepShell, useNow, type GameshowWorkshopProps } from "./GameshowWorkshop";
import { FittedCard } from "./QuestionCards";
import CompositionEffect from "./CompositionEffect";
import CompositionPlayer, { defaultOverlayResult } from "./CompositionPlayer";

type ScreenProps = GameshowWorkshopProps & { step?: WorkflowStepState };

/* ---------------- Step 3 · Trivia cards ---------------- */

type DemoQuestion = { category?: string; question: string; answer: string; verificationStatus?: string };

function MiniFlip({ q }: { q: DemoQuestion }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="gsw-flipwrap">
      <div
        className={"gsw-flip gsw-mini-flip" + (flipped ? " flipped" : "")}
        onClick={() => setFlipped(f => !f)}
        role="button" aria-label={`Flip the card: ${q.question}`}
      >
        <div className="gsw-face"><div className="gsw-mini-face" style={{ height: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, color: "#20e8ff", textTransform: "uppercase" }}>{q.category || "Trivia"} · Question</div>
          <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.35, marginTop: 6 }}>{q.question}</div>
          <div style={{ marginTop: 10 }}>
            {q.verificationStatus === "needs-review" ? <span className="gsw-review">* Needs verification</span> : <span className="gsw-verified">✓ Verified</span>}
          </div>
        </div></div>
        <div className="gsw-face back"><div className="gsw-mini-face" style={{ height: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, color: "#20e8ff", textTransform: "uppercase" }}>Answer</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>{q.answer}</div>
          <div style={{ fontSize: 12, color: "#948bb3", marginTop: 6 }}>{q.verificationStatus === "needs-review" ? "Ask Jewel to re-check this one any time" : "Source checked when generated"}</div>
        </div></div>
      </div>
    </div>
  );
}

function CardDesignDemo({ project }: { project: GameshowWorkshopProps["project"] }) {
  const own = (project.gameTools || []).find(tool => tool.type === "question-card" && tool.enabled);
  const baseTool: GameTool = own || { id: "gsw-demo-card", type: "question-card", name: "Question Card", enabled: true, config: {} };
  const pool = own ? questionPool(project, own) : [];
  const question = pool[0]?.question || EXAMPLE_QUESTIONS[0].question;
  const answer = pool[0]?.answer || EXAMPLE_QUESTIONS[0].answer;
  const [look, setLook] = useState(0);
  const [shapeIndex, setShapeIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mount, setMount] = useState(0);
  const [status, setStatus] = useState("That’s the edit range, live: the same card, restyled in front of you. Jewel restyles yours the same way.");
  const preset = CARD_LOOK_PRESETS[look];
  const patch = {
    backgroundColor: preset.backgroundColor, textColor: preset.textColor, accentColor: preset.accentColor,
    fontFamily: preset.fontFamily, backgroundKey: "", shape: CARD_SHAPES[shapeIndex],
  };
  const tool: GameTool = {
    ...baseTool,
    config: {
      ...baseTool.config,
      questionCard: { ...cardDesign(baseTool, false), ...patch },
      answerCard: { ...cardDesign(baseTool, true), ...patch },
    },
  };
  return (
    <div>
      <div
        className="gsw-flipwrap"
        onClick={() => setFlipped(f => !f)}
        role="button" aria-label="Flip the demonstration question card"
      >
        <div className={"gsw-flip" + (flipped ? " flipped" : "")} key={mount}>
          <div className="gsw-face"><div className="gsw-facehost"><FittedCard project={project} tool={tool} text={question} shownAt={Date.now()} /></div></div>
          <div className="gsw-face back"><div className="gsw-facehost"><FittedCard project={project} tool={tool} text={answer} answer shownAt={Date.now()} /></div></div>
        </div>
      </div>
      <div className="gsw-chipsrow" style={{ marginTop: 12 }}>
        <button type="button" className="gsw-demobtn" onClick={event => {
          event.stopPropagation();
          const next = (look + 1) % CARD_LOOK_PRESETS.length;
          setLook(next);
          setStatus(`Look: ${CARD_LOOK_PRESETS[next].name} — same card, new skin. ${next === CARD_LOOK_PRESETS.length - 1 ? "One more tap cycles back to Neon." : "Tap again to keep cycling."}`);
        }}>Change the look — Neon → Light → Classic</button>
        <button type="button" className="gsw-vchip" onClick={event => {
          event.stopPropagation();
          const next = (shapeIndex + 1) % CARD_SHAPES.length;
          setShapeIndex(next);
          setStatus(`Shape: ${CARD_SHAPE_LABELS[CARD_SHAPES[next]]} — the editor’s real shapes, on the real card.`);
        }}>Shape: {CARD_SHAPE_LABELS[CARD_SHAPES[shapeIndex]]}</button>
        <button type="button" className="gsw-vchip" onClick={event => { event.stopPropagation(); setMount(m => m + 1); setStatus("Entrance replayed — that animation is the card’s own entrance, from its design."); }}>↻ Replay entrance</button>
      </div>
      <p className="gsw-demostatus" style={{ marginTop: 8 }}>{status}</p>
    </div>
  );
}

export default function TriviaStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const cardList = (project.gameTools || []).find(tool => tool.type === "card-list" && tool.enabled
    && (savedListEntries(tool).length > 0 || listCards(tool).length > 0));
  const listEntries = cardList ? (savedListEntries(cardList).length ? savedListEntries(cardList) : listCards(cardList)).map(card => card.text) : [];
  const triviaList = (project.gameTools || []).find(tool => tool.type === "trivia-list" && tool.enabled
    && Array.isArray(tool.config.questions) && tool.config.questions.length > 0);
  const savedQuestions: DemoQuestion[] = triviaList
    ? (triviaList.config.questions as any[]).slice(0, 3).map(q => ({
      category: q.category ? String(q.category) : undefined,
      question: String(q.question || q.prompt || ""), answer: String(q.answer || ""),
      verificationStatus: q.verificationStatus ? String(q.verificationStatus) : undefined,
    })).filter(q => q.question)
    : [];
  const questions = savedQuestions.length ? savedQuestions : EXAMPLE_QUESTIONS;
  return (
    <StepShell stepId="trivia-cards" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-seclabel">Two ways to get your questions</div>
          <div className="gsw-grid2">
            <div className="gsw-card"><h4>Write your own</h4><p>Your questions, in your own words — type them or paste them as a list, one per line. They become your trivia cards exactly as you wrote them.</p></div>
            <div className="gsw-card"><h4>Have Jewel generate</h4><p>Give Jewel a topic and a count. She writes the questions, verifies every answer against its source, and saves the list in your toolbox.</p></div>
          </div>
          <p className="gsw-demostatus" style={{ marginTop: 10 }}>Either way, the words end up on the same cards — and the last part of this step is making those cards yours.</p>

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Route 1 · Write your own — your words become a list of cards</div>
          {cardList ? (
            <>
              <DrawDemo title={`${cardList.name} · card list`} entries={listEntries} drawnLabel="Now drawn" />
              <ChangeList title="What you can change — a card list" items={CARD_LIST_CHANGES} onAsk={onAsk} />
            </>
          ) : (
            <div className="gsw-card">
              <h4>No card list yet</h4>
              <p>Start one with your own words — Jewel never rewrites them unless you ask her to.</p>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-jchip" onClick={doors.openNewList}>Create list and cards</button>
                <button type="button" className="gsw-jchip" onClick={() => onAsk("I want to write my own questions and add them to my list")}>Add my own questions — ask Jewel</button>
              </div>
            </div>
          )}

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Route 2 · Have Jewel generate — verified questions, saved for you</div>
          <span className="gsw-demotag">Live demonstration — tap a card to flip it</span>
          {!savedQuestions.length && <p className="gsw-hint" style={{ marginBottom: 10 }}>Example questions — yours will be saved here, flipped the same way.</p>}
          <div className="gsw-grid2">
            {questions.map((q, i) => <MiniFlip key={i} q={q} />)}
            {triviaList && (
              <div className="gsw-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h4>{triviaList.name} · {(triviaList.config.questions as any[]).length} questions</h4>
                <p>Saved in your toolbox. Connect it to a dashboard button in Set the Stage when you need it.</p>
                <div className="gsw-chipsrow">
                  <button type="button" className="gsw-jchip" onClick={() => doors.downloadTriviaPdf(Array.isArray(triviaList.config.questions) ? triviaList.config.questions : [])}>Download PDF</button>
                  <button type="button" className="gsw-jchip" onClick={doors.showSavedWork}>Open the list</button>
                </div>
              </div>
            )}
          </div>
          <ChangeList title="What you can change — trivia generation" items={TRIVIA_GEN_CHANGES} onAsk={onAsk} />

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Then · Customize the cards — whichever route you took</div>
          <span className="gsw-demotag">Live demonstration — the card itself</span>
          <div className="gsw-seclabel">Question card — tap it to flip to the answer</div>
          <CardDesignDemo project={project} />
          <ChangeList
            title="What you can change — a card" items={CARD_CHANGES} onAsk={onAsk}
            spring="The three looks are starting points — describe any style at all (“art-deco gold on black”, “underwater neon”) and Jewel will aim the card at it."
          />
        </div>
        <AskStrip
          {...props}
          stepId="trivia-cards"
          extra="Adjust opens the real editors — your saved question list, the card designer (Look · Size & position · Content · Review) and the pool and card designer — exactly as they work today."
        />
      </div>
    </StepShell>
  );
}

/* ---------------- Step 4 · Make your game board ---------------- */

export function BoardStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const board = (project.gameTools || []).find(tool => tool.type === "trivia-board" && tool.enabled);
  const blank = (project.gameTools || []).find(tool => tool.type === "blank-board" && tool.enabled);
  const categories: any[] = board && Array.isArray(board.config.categories) ? board.config.categories : [];
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("Pick any value — squares get used up as the game plays.");
  const isUsed = (ci: number, qi: number, q: any) => used[`${ci}:${qi}`] ?? Boolean(q?.used);
  return (
    <StepShell stepId="board" step={props.step}>
      <div className="gsw-cols">
        <div>
          <span className="gsw-demotag">Live demonstration — the board itself</span>
          {board && categories.length ? (
            <>
              <div className="gsw-seclabel">{board.name} — pick a square, like your players will</div>
              <div className="gsw-board">
                {categories.map((cat: any, ci: number) => <div key={ci} className="gsw-bh">{String(cat.name || `Category ${ci + 1}`)}</div>)}
                {[0, 1, 2, 3, 4].map(qi => categories.map((cat: any, ci: number) => {
                  const q = (cat.questions || [])[qi];
                  if (!q) return <div key={`${ci}-${qi}`} />;
                  const cellUsed = isUsed(ci, qi, q);
                  return (
                    <button
                      key={`${ci}-${qi}`} type="button"
                      className={"gsw-bc" + (cellUsed ? " used" : "")}
                      onClick={() => {
                        if (cellUsed) return;
                        setUsed(current => ({ ...current, [`${ci}:${qi}`]: true }));
                        setStatus(`${cat.name} · ${q.value} — “${q.prompt || q.question || ""}” In the live game the card appears on the overlay.`);
                      }}
                    >{cellUsed ? "USED" : String(q.value)}</button>
                  );
                }))}
              </div>
              <p className="gsw-demostatus" style={{ marginTop: 10 }}>{status}</p>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-jchip" onClick={() => { setUsed({}); setStatus("Board reset — every square live again."); }}>Reset the board</button>
                <button type="button" className="gsw-jchip" onClick={() => doors.openBoardDesigner(board.id)}>Open the board designer</button>
                <span className="gsw-vchip">…or start from a Blank Board and design your own</span>
              </div>
            </>
          ) : blank ? (
            <div className="gsw-card">
              <h4>{blank.name} — your Blank Board</h4>
              <p>Your board is a Blank Board: its background and interactive areas are set in the board designer.</p>
              <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={() => doors.openBoardDesigner(blank.id)}>Open the board designer</button></div>
            </div>
          ) : (
            <>
              <div className="gsw-stage-visual" style={{ minHeight: 190, marginBottom: 14 }}>
                <GameshowExampleStage />
                <div className="gsw-shade" />
                <div className="gsw-inner"><span className="gsw-vchip gold">Example stage — the board Jewel builds with you stands here</span></div>
              </div>
              <div className="gsw-card">
                <h4>No board yet</h4>
                <p>Start from the 5×5 trivia board, or from a Blank Board you design yourself — pick a template, or ask Jewel to build yours.</p>
                <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={doors.openBoardTemplates}>Choose a board template</button></div>
              </div>
            </>
          )}
          <ChangeList title="What you can change — a board" items={BOARD_CHANGES} onAsk={onAsk} />
        </div>
        <AskStrip
          {...props}
          stepId="board"
          extra="Adjust opens the board designer, where the board’s background and interactive areas are set — exactly as it works today."
        />
      </div>
    </StepShell>
  );
}

/* ---------------- Step 6 · Compose your scenes & effects ---------------- */

const TRACK_LABELS: Record<string, string> = { video: "VIDEO ▣", visual: "VISUAL ◇", voice: "VOICE ◖", music: "MUSIC ♫", sfx: "SFX ✦", text: "TEXT T", effect: "EFFECT ⚡" };
const TRACK_ORDER = ["video", "visual", "voice", "music", "sfx", "text", "effect"];
const TRACK_COLORS: Record<string, string> = { video: "#154c69", visual: "#512b75", voice: "#0c7a43", music: "#8a5a12", sfx: "#7a2d12", text: "#3f3f46", effect: "#b3123f" };
const FX_ICONS: Record<string, string> = { Confetti: "🎉", Sparkles: "✨", Glow: "💡", Particles: "🫧" };

export function ScenesStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const backdrop = backdropAsset(project);
  const compositions = project.compositions || [];
  const [effect, setEffect] = useState<{ name: string; at: number } | null>(null);
  const now = useNow(Boolean(effect) && Date.now() - (effect?.at ?? 0) < 3200);
  const effectTime = effect ? Math.min(3, (now - effect.at) / 1000) : 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const composition = compositions.find(comp => comp.id === selectedId) || compositions[0];
  const [playing, setPlaying] = useState(false);
  const [playAt, setPlayAt] = useState(0);
  const total = composition ? Math.max(1, composition.duration || 1) : 1;
  return (
    <StepShell stepId="scenes" step={props.step}>
      <div className="gsw-cols">
        <div>
          <span className="gsw-demotag">Live demonstration — tap an effect, watch it fire</span>
          <div className="gsw-fxstage">
            {backdrop?.url ? <img src={backdrop.url} alt="" /> : <img src="/redesign/kind-gameshow.webp" alt="" />}
            {effect && effectTime < 3 && <CompositionEffect name={effect.name} time={effectTime} />}
            <div className="gsw-fxlabel">{effect && effectTime < 3 ? `Now playing: ${effect.name}` : backdrop ? "▶ Tap an effect — the real effect, fired over your stage" : "▶ Tap an effect — the real effect, fired over an example stage"}</div>
          </div>
          <div className="gsw-fxrow">
            {EFFECT_NAMES.map(name => (
              <button key={name} type="button" className="gsw-fx" onClick={() => setEffect({ name, at: Date.now() })}>
                <span className="gsw-fi">{FX_ICONS[name]}</span>{name}
              </button>
            ))}
          </div>

          {composition ? (
            <>
              <div className="gsw-seclabel" style={{ marginTop: 22 }}>The Asset Composer — {composition.name}, on its timeline</div>
              <div className="gsw-timeline">
                {TRACK_ORDER.filter(track => composition.clips.some(clip => clip.track === track)).map(track => (
                  <div key={track} className="gsw-trow">
                    <span className="gsw-tlabel">{TRACK_LABELS[track]}</span>
                    <div className="gsw-tlane">
                      {composition.clips.filter(clip => clip.track === track).map(clip => (
                        <div
                          key={clip.id} className="gsw-clip"
                          style={{ left: `${(clip.start / total) * 100}%`, width: `${Math.max(4, (clip.duration / total) * 100)}%`, background: TRACK_COLORS[track] }}
                        >{clip.track === "text" ? (clip.text || clip.assetName) : clip.track === "effect" ? (clip.effect || clip.assetName) : clip.assetName}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-demobtn gold" onClick={() => { setPlayAt(Date.now()); setPlaying(true); }}>▶ Play the package</button>
                <button type="button" className="gsw-jchip" onClick={doors.openComposer}>Open in the Asset Composer</button>
                <span className="gsw-vchip">{composition.clips.length} clips · {composition.duration.toFixed(1)}s</span>
              </div>
              {playing && (
                <div className="gsw-compstage">
                  <CompositionPlayer
                    composition={composition} assets={project.assets}
                    startedAt={playAt} placement={defaultOverlayResult}
                    onEnd={() => setPlaying(false)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="gsw-card" style={{ marginTop: 22 }}>
              <h4>No packages yet</h4>
              <p>When you save a scene, its timeline appears here and plays for real. Open the Asset Composer to build one by hand, or describe the moment to Jewel.</p>
              <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={doors.openComposer}>Open Asset Composer</button></div>
            </div>
          )}
          <ChangeList title="What you can change — a scene & its clips" items={SCENE_CHANGES} onAsk={onAsk} />

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your saved packages</div>
          <div className="gsw-shelf" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {compositions.map(comp => (
              <button key={comp.id} type="button" className="gsw-asset plain" onClick={() => { setSelectedId(comp.id); setPlaying(false); }}>
                <span className="gsw-ak">Package</span>
                <span className="gsw-an" style={{ position: "static" }}>{comp.name}<br /><span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{comp.clips.length} clips · {comp.duration.toFixed(1)}s</span></span>
              </button>
            ))}
            <button type="button" className="gsw-asset plain" onClick={doors.openComposer}>
              <span className="gsw-big">＋</span>
              <span className="gsw-an" style={{ position: "static" }}>Open Asset Composer</span>
            </button>
          </div>
          <div className="gsw-card" style={{ marginTop: 14 }}>
            <h4>Where packages get used</h4>
            <p>A saved package is one reusable action. Where it sits on your overlay or dashboard — and what triggers it — is your choice in Set the Stage; nothing is placed for you.</p>
          </div>
        </div>
        <AskStrip
          {...props}
          stepId="scenes"
          extra="Adjust opens the Asset Composer — the timeline workbench with its clip inspector — exactly as it works today. This step is a creative step: revisit and rebuild packages as often as you like."
        />
      </div>
    </StepShell>
  );
}

/* ---------------- Step 7 · Review your toolbox ---------------- */

export function ToolboxStep(props: ScreenProps) {
  const { project, doors, onNavigateStep, onAskJewel: onAsk } = props;
  const bare = useContext(BareStageContext);
  const tools = (project.gameTools || []).filter(tool => tool.type !== "youtube");
  const compositions = project.compositions || [];
  const firstCard = (project.gameTools || []).find(tool => tool.type === "question-card" || tool.type === "blank-card");
  const firstList = (project.gameTools || []).find(tool => tool.type === "card-list");
  const firstBoard = (project.gameTools || []).find(tool => tool.type === "trivia-board" || tool.type === "blank-board");
  const editorTiles: { icon: string; title: string; description: string; action: () => void }[] = [
    { icon: "▭", title: "Card designer", description: "Look · Size & position · Content · Review", action: () => firstCard ? doors.openCardEditor(firstCard.id) : bare ? onAsk("Make a question card for my show") : onNavigateStep(0, "trivia-cards") },
    { icon: "≣", title: "Pool and card designer", description: "Entries in, designed cards out", action: () => firstList ? doors.openListEditor(firstList.id) : bare ? onAsk("Make a card list for my show") : onNavigateStep(0, "trivia-cards") },
    { icon: "▦", title: "Board designer", description: "Background art & interactive areas", action: () => firstBoard ? doors.openBoardDesigner(firstBoard.id) : bare ? onAsk("Make a game board for my show") : onNavigateStep(0, "board") },
    { icon: "✂", title: "Media editor", description: "Trim · Resize · Save an edited copy", action: () => project.assets.length ? doors.openMediaEditor(0) : bare ? onAsk("Make a backdrop for my show") : onNavigateStep(0, "media") },
    { icon: "⚙", title: "Tool editors", description: "Name · Setup · Look · Preview — per tool", action: doors.showSavedWork },
    { icon: "⚡", title: "Asset Composer", description: "The timeline workbench", action: doors.openComposer },
    { icon: "✎", title: "Game plan form", description: "Title, theme, rules, rounds, scoring…", action: () => doors.showPlanForm() },
    { icon: "🗂", title: "Organize assets & pools", description: "Search, filter, group your media", action: doors.showSavedWork },
  ];
  const toolStatus = (tool: GameTool) => tool.type === "trivia-list"
    ? `${Array.isArray(tool.config.questions) ? tool.config.questions.length : 0} questions`
    : tool.type === "card-list"
      ? `${savedListEntries(tool).length} pool entries · ${listCards(tool).length} cards`
      : (tool.type === "trivia-board" || tool.type === "blank-board")
        ? (tool.inOverlayBuild ? "✓ In Overlay Build" : "Board workspace")
        : (tool.inToolbox ? "✓ In Dashboard Toolbox" : "Saved in toolbox");
  return (
    <StepShell stepId="toolbox" step={props.step}>
      <div className="gsw-seclabel" style={{ marginTop: 20 }}>Your game tools &amp; cards</div>
      {tools.length ? (
        <div className="gsw-shelf">
          {tools.map(tool => (
            <button key={tool.id} type="button" className="gsw-asset plain" onClick={doors.showSavedWork}>
              <span className="gsw-ak">{tool.type.replace(/-/g, " ")}</span>
              <span className="gsw-an" style={{ position: "static" }}>{tool.name}<br /><span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{toolStatus(tool)}</span></span>
            </button>
          ))}
        </div>
      ) : (
        <p className="gsw-hint">Nothing in the toolbox yet — the tools you make on the earlier steps land here.</p>
      )}
      {compositions.length > 0 && (
        <>
          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your packages</div>
          <div className="gsw-shelf">
            {compositions.map(comp => (
              <button key={comp.id} type="button" className="gsw-asset plain" onClick={() => bare ? doors.openComposer() : onNavigateStep(0, "scenes")}>
                <span className="gsw-ak">Package</span>
                <span className="gsw-an" style={{ position: "static" }}>{comp.name}<br /><span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{comp.clips.length} clips</span></span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="gsw-hint" style={{ marginTop: 10 }}>Anything you switched off can still be made on its step, any time. Nothing is ever locked out.</p>

      <div className="gsw-seclabel" style={{ marginTop: 22 }}>Every manual editor — the doors</div>
      <div className="gsw-tiles" style={{ marginTop: 0 }}>
        {editorTiles.map(tile => (
          <button key={tile.title} type="button" className="gsw-tile" onClick={tile.action}>
            <div className="gsw-ic">{tile.icon}</div><div className="gsw-tt">{tile.title}</div><div className="gsw-td">{tile.description}</div>
          </button>
        ))}
      </div>
      <div className="gsw-grid2" style={{ marginTop: 16 }}>
        <div className="gsw-card"><h4>Published links &amp; sharing</h4><p>The links for this project, where they already live today.</p>
          <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={doors.showSavedWork}>Open sharing</button></div></div>
        {!bare && <div className="gsw-card"><h4>Mistake? Take it back</h4><p>Jewel’s edits can be undone, one step at a time — the Undo button appears in her panel after she changes something.</p>
          <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={props.onOpenJewel}>Open Jewel</button></div></div>}
      </div>
      <div className="gsw-cols">
        <div />
        <AskStrip {...props} stepId="toolbox" />
      </div>
    </StepShell>
  );
}
