"use client";

import type { GameToolType, Project } from "../lib/project";
import { shelfRoute, type LibraryItem } from "../lib/workshop-libraries";
import { EXAMPLE_QUESTIONS, demoTool } from "../lib/gameshow-path";
import { freshCardState } from "../lib/question-cards";
import { listCards, savedListEntries } from "../lib/card-lists";
import { WheelDisplay, DiceDisplay, CoinDisplay, HigherLowerDisplay, CliffhangerDisplay } from "./ChanceTools";
import { chanceArtUrl } from "../lib/chance-art";
import { PLINKO_DEFAULT_BOARD_ART } from "../lib/plinko-art";
import { BankDisplay } from "./BankDisplay";
import { DjDeckVisual } from "./DjDeckPlayer";
import { SoundBoardVisual } from "./SoundBoardPlayer";
import { FittedCard, StyledTimer } from "./QuestionCards";
import { GameInfoOverlay } from "./GameInfoTools";
import { StandingToolFace } from "./StandingToolFace";
import { BoardArtwork } from "./BoardDesigner";
import "./tool-shelf.css";

/**
 * The Imagine and Create tool shelf (Jessica's rule, re-stated
 * 2026-11-15): EVERY one of the site's game tools stands here as a
 * pictured card — picture and name only, never a text row — in every
 * non-talkshow project, for every creator. Choosing a card creates
 * the tool through the same machinery that already creates it:
 * the plain adds go through addGameTool (which builds on
 * toolDefaults — the exact construction Jewel's creation path uses,
 * so a shelf-made chance game is identical to a Jewel-made one and
 * lands in the toolbox, unwired, off the overlay), and the card /
 * list / trivia tiles hand the tap to their existing creators (the
 * card-system creator, the list door, the trivia generation entry).
 * Nothing here wires a dashboard button or places anything on the
 * overlay: a tool moves to Set the Stage only when the creator
 * chooses it there.
 */

export type ShelfHandlers = {
  addGameTool: (type: GameToolType) => void;
  onCreateCard?: (kind: "question" | "blank") => void;
  onNewList?: () => void;
  onGenerateTriviaList?: () => void;
};

function texts(values: unknown): string[] {
  return (Array.isArray(values) ? values : []).map(v => typeof v === "string" ? v : String((v as { text?: unknown })?.text ?? v));
}

function cfgOf(tool: { config: Record<string, unknown> }): Record<string, any> {
  return (tool.config || {}) as Record<string, any>;
}

function appearanceText(cfg: Record<string, any>): string {
  return String(cfg.appearance?.textColor || "#ffffff");
}

/** A tool's own face, standing still: the real display the demos and
 *  the overlay run, over the project's own tool of that type when one
 *  exists and over the tool's built-in defaults until then (the
 *  demoTool stand-in — demonstrations never invent project data). */
function ShelfFace({ item, project }: { item: LibraryItem; project: Project }) {
  const { tool } = demoTool(project, item.type);
  const cfg = cfgOf(tool);
  switch (item.type) {
    case "plinko":
      // The neutral house board is the shelf face — never a specific
      // creator's own board (Jessica's ruling: her uploaded board is
      // not the face of every Plinko).
      return <img src={PLINKO_DEFAULT_BOARD_ART} alt="" />;
    case "wheel": {
      const segments = texts(cfg.segments);
      return <WheelDisplay entries={segments} result={segments[0] || ""} preview colors={[String(cfg.slotColor || "#154c69"), String(cfg.alternateSlotColor || "#512b75")]} textColor={appearanceText(cfg)} artSrc={chanceArtUrl(tool, project.assets)} />;
    }
    case "dice": {
      const sides = Number(cfg.sides) || 6;
      return <DiceDisplay result={Math.min(6, sides)} sides={sides} preview faceColor={String(cfg.faceColor || "#f5faff")} pipColor={String(cfg.pipColor || "#102132")} artSrc={chanceArtUrl(tool, project.assets)} />;
    }
    case "coin-toss":
      return <CoinDisplay result="Heads" preview ready faceColor={String(cfg.faceColor || "#ffd166")} textColor={String(cfg.textColor || "#382608")} />;
    case "higher-lower": {
      const cards = (Array.isArray(cfg.cards) ? cfg.cards : []).map((c: any) => ({ label: String(c?.label ?? c?.value ?? "?"), value: Number(c?.value) || 0 }));
      return <HigherLowerDisplay outcome={{ phase: "draw", card: cards[0] || { label: "?", value: 0 } }} preview textColor={appearanceText(cfg)} artSrc={chanceArtUrl(tool, project.assets)} />;
    }
    case "cliffhanger": {
      const items = (Array.isArray(cfg.items) ? cfg.items : []).map((c: any) => ({ label: String(c?.label ?? "Item"), price: Number(c?.price) || 0 }));
      return <CliffhangerDisplay outcome={{ phase: "item", item: items[0] || { label: "Item", price: 0 }, position: 0, stepsToFall: Number(cfg.stepsToFall) || 25, dollarsPerStep: Math.max(1, Number(cfg.dollarsPerStep) || 1) }} preview textColor={appearanceText(cfg)} artSrc={chanceArtUrl(tool, project.assets)} />;
    }
    case "bank":
      return <span className="shelf-face-pad"><BankDisplay tool={tool} preview /></span>;
    case "countdown": {
      const total = Number(cfg.seconds) || 10;
      return <span className="shelf-face-timer"><StyledTimer tool={tool} remaining={total} total={total} /></span>;
    }
    case "scoreboard":
    case "game-tool-list":
      return <span className="shelf-face-abs"><GameInfoOverlay tool={tool} project={project} state={freshCardState()} /></span>;
    case "random-picker":
      return <span className="shelf-face-pad"><StandingToolFace tool={tool} project={project} /></span>;
    case "poll": {
      const options = texts(cfg.options);
      return (
        <span className="shelf-face-pad shelf-poll">
          <strong>{String(cfg.question || "Choose what happens next")}</strong>
          {options.map((option, i) => (
            <span key={i} className="shelf-poll-row"><span className="shelf-poll-track" /><span>{option}</span></span>
          ))}
        </span>
      );
    }
    case "trivia-board": {
      const categories = Array.isArray(cfg.categories) ? cfg.categories : [];
      if (categories.length) {
        return (
          <span className="shelf-jeopardy">
            {categories.slice(0, 5).map((cat: any, ci: number) => (
              <span key={ci} className="shelf-jeopardy-col">
                <strong>{String(cat?.name || "")}</strong>
                {(Array.isArray(cat?.questions) ? cat.questions : []).slice(0, 5).map((q: any, qi: number) => (
                  <span key={qi}>{String(q?.value ?? "")}</span>
                ))}
              </span>
            ))}
          </span>
        );
      }
      return <span className="shelf-face-abs"><BoardArtwork tool={tool} project={project} /></span>;
    }
    case "blank-board":
      return <span className="shelf-face-abs"><BoardArtwork tool={tool} project={project} /></span>;
    case "youtube":
      return (
        <span className="shelf-face-abs">
          <img src="/redesign/kind-gameshow.webp" alt="" />
          <span className="shelf-yt-play" aria-hidden="true">▶</span>
        </span>
      );
    case "question-card":
      return <span className="shelf-face-abs"><FittedCard project={project} tool={tool} text="?" /></span>;
    case "blank-card":
      return <span className="shelf-face-abs"><FittedCard project={project} tool={tool} text="" /></span>;
    case "card-list": {
      const entries = savedListEntries(tool).length ? savedListEntries(tool) : listCards(tool);
      const rows = entries.map(entry => entry.text).filter(Boolean).slice(0, 4);
      if (rows.length) {
        return (
          <span className="shelf-face-pad shelf-mini-list">
            {rows.map((text, i) => <span key={i}>{text}</span>)}
          </span>
        );
      }
      return <span className="shelf-card-stack" aria-hidden="true"><i /><i /><i /></span>;
    }
    case "trivia-list": {
      const saved = (Array.isArray(cfg.questions) ? cfg.questions : []).slice(0, 2).map((q: any) => ({ question: String(q?.question || q?.prompt || ""), answer: String(q?.answer || "") })).filter((q: { question: string }) => q.question);
      const questions = saved.length ? saved : EXAMPLE_QUESTIONS.slice(0, 2);
      return (
        <span className="shelf-face-pad shelf-mini-list">
          {questions.map((q, i) => (
            <span key={i}><strong>{q.question}</strong><em>Answer: {q.answer}</em></span>
          ))}
        </span>
      );
    }
    case "city-crime-scene":
      return <span className="shelf-ccs" aria-hidden="true">🔎</span>;
    case "sound-board":
      return <span className="shelf-face-pad"><SoundBoardVisual tool={tool} preview /></span>;
    case "dj-deck":
      return <span className="shelf-face-pad"><DjDeckVisual tool={tool} project={project} preview /></span>;
    default:
      return null;
  }
}

export function ShelfCards({ items, project, ccssEntitled, triviaBusy = false, handlers }: {
  items: LibraryItem[];
  project: Project;
  ccssEntitled: boolean;
  triviaBusy?: boolean;
  handlers: ShelfHandlers;
}) {
  const choose = (item: LibraryItem) => {
    const route = shelfRoute(item);
    if (route === "question-card" && handlers.onCreateCard) return handlers.onCreateCard("question");
    if (route === "blank-card" && handlers.onCreateCard) return handlers.onCreateCard("blank");
    if (route === "card-list" && handlers.onNewList) return handlers.onNewList();
    if (route === "trivia-list" && handlers.onGenerateTriviaList) return handlers.onGenerateTriviaList();
    void handlers.addGameTool(item.type);
  };
  return (
    <div className="shelf-grid">
      {items.filter(item => !item.restricted || ccssEntitled).map(item => (
        <button
          key={item.type}
          type="button"
          className="shelf-card"
          disabled={triviaBusy}
          onClick={() => choose(item)}
          aria-label={`Add ${item.name} to your project`}
        >
          <span className="shelf-face" aria-hidden="true"><ShelfFace item={item} project={project} /></span>
          <span className="shelf-name">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
