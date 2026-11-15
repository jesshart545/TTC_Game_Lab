"use client";

import type { GameTool, Project, ProjectAsset } from "../lib/project";
import { pickGame } from "../lib/game-room";
import { GAME_NIGHT_TEMPLATES, type GameNightTemplate } from "../lib/game-night-templates";
import type { BingoConfig } from "../lib/bingo";
import type { QuizConfig } from "../lib/quiz-board";
import type { SurveyConfig } from "../lib/survey-showdown";
import type { PerfectMatchConfig } from "../lib/perfect-match";
import type { WordChainConfig } from "../lib/word-chain";
import type { DrawGuessConfig } from "../lib/draw-guess";
import type { PropertyTycoonConfig } from "../lib/property-tycoon";

/**
 * The Game Night game, shown as itself (Jessica, 2026-11-15).
 *
 * Both Game Night areas — Imagine & Create and Set the Stage — open
 * with THIS presentation: the game the project actually holds,
 * resolved by the very pickGame the game-room engine runs on the
 * published snapshot (lib/game-room.ts), and its content laid out as
 * real game pieces — quiz questions on a pictured board, prompt and
 * answer cards as cards with their text on them, bingo items as
 * items, word starters as words, properties as board spaces — never
 * as word-list rows with counts, and never with livestream language:
 * a game night has no host, no dashboard and no overlay.
 *
 * The presentation is not an editor wall. Pieces are visible at a
 * glance, and each family of pieces carries ONE quiet door into the
 * existing hand editor that owns it (the list and card creator for
 * card lists, the board designer for a trivia board) — the door
 * opens the very tool whose cards are on show, found by matching
 * the resolved config's own texts back to the project's tools, so
 * the door can never point at a different list than the one playing.
 */

export type GameNightDoors = {
  openListEditor: (toolId: string) => void;
  openBoardDesigner: (toolId: string) => void;
  openMediaEditor: (assetIndex: number) => void;
  upload: () => void;
  /** Ask the page to delete one stored asset (the page confirms first,
   *  then runs its normal asset-deletion path). */
  deleteAsset: (asset: ProjectAsset) => void;
};

export type GameNightGameInfo = {
  gameType: string;
  name: string;
  description: string;
  icon: string;
  image: string;
};

const KIND_ART = "/redesign/kind-multiplayer.webp";

const FALLBACK_NAMES: Record<string, string> = {
  bingo: "Bingo",
  "quiz-board": "Quiz Board",
  "survey-showdown": "Survey Showdown",
  "perfect-match": "Perfect Match",
  "word-chain": "Word Chain",
  "draw-guess": "Draw & Guess",
  "property-tycoon": "Property Tycoon",
};

/** The shelf identity of a resolved game type: the template registry
 *  is the one place game names, descriptions and artwork live. */
export function gameInfoFor(gameType: string): GameNightGameInfo {
  const template: GameNightTemplate | undefined = GAME_NIGHT_TEMPLATES.find(t => t.gameType === gameType);
  if (template) return { gameType, name: template.name, description: template.description, icon: template.icon, image: template.image };
  return { gameType, name: FALLBACK_NAMES[gameType] || "Game Night", description: "", icon: "🎲", image: KIND_ART };
}

/** The texts a card-list tool holds, read the same way the engine's
 *  extractors read them: cards first, then items, then entries. */
function listTexts(tool: GameTool): string[] {
  const config = (tool.config || {}) as Record<string, unknown>;
  const pick = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map(entry => (typeof entry === "string" ? entry : String((entry as { text?: unknown })?.text ?? "")))
      .map(text => text.trim())
      .filter(Boolean);
  };
  const fromCards = pick(config.cards);
  if (fromCards.length) return fromCards;
  const fromItems = pick(config.items);
  if (fromItems.length) return fromItems;
  return pick(config.entries);
}

/** The card list whose own texts cover the most of the pieces on
 *  show — that list is the one playing, so it is the one the editor
 *  door opens. No match, no door (Jewel remains the way). */
function sourceListFor(project: Project, pieces: string[]): GameTool | undefined {
  const wanted = new Set(pieces.map(piece => piece.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return undefined;
  let best: GameTool | undefined;
  let bestScore = 0;
  for (const tool of project.gameTools || []) {
    if (tool.type !== "card-list" || !tool.enabled) continue;
    const score = listTexts(tool).filter(text => wanted.has(text.toLowerCase())).length;
    if (score > bestScore) { best = tool; bestScore = score; }
  }
  return bestScore > 0 ? best : undefined;
}

/** The trivia board whose categories are the ones on show. */
function sourceBoardFor(project: Project, categoryNames: string[]): GameTool | undefined {
  const wanted = new Set(categoryNames.map(name => name.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return undefined;
  return (project.gameTools || []).find(tool => {
    if (tool.type !== "trivia-board" || !tool.enabled) return false;
    const categories = (tool.config as { categories?: unknown })?.categories;
    return Array.isArray(categories) && categories.some(category => wanted.has(String((category as { name?: unknown })?.name ?? "").trim().toLowerCase()));
  });
}

function EditorDoor({ doors, tool, board }: { doors: GameNightDoors; tool: GameTool; board?: boolean }) {
  return (
    <div className="gn-door-row">
      <button
        type="button"
        className="gn-door"
        onClick={() => (board ? doors.openBoardDesigner(tool.id) : doors.openListEditor(tool.id))}
      >
        {board ? `Open “${tool.name}” in the board designer` : `Open “${tool.name}” in the card editor`}
      </button>
    </div>
  );
}

function MoreNote({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null;
  return <p className="gn-more">+ {hidden} more — open the editor above to see them all, or ask Jewel.</p>;
}

const TILE_CAP = 60;
const QUESTION_CAP = 30;

function Pieces({ project, doors, gameType, config }: { project: Project; doors: GameNightDoors; gameType: string; config: Record<string, unknown> }) {
  if (gameType === "bingo") {
    const cfg = config as unknown as BingoConfig;
    const items = cfg.items || [];
    const shown = items.slice(0, TILE_CAP);
    const source = sourceListFor(project, items);
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">The call items — one is called out every few seconds, players mark their cards</div>
        <div className="gn-tiles">{shown.map((item, i) => <span className="gn-tile" key={i}>{item}</span>)}</div>
        <MoreNote hidden={items.length - shown.length} />
        {source && <EditorDoor doors={doors} tool={source} />}
      </div>
    );
  }
  if (gameType === "quiz-board") {
    const cfg = config as unknown as QuizConfig;
    const categories = cfg.categories || [];
    const board = sourceBoardFor(project, categories.map(c => c.name));
    const allPrompts = categories.flatMap(c => (c.questions || []).map(q => q.prompt));
    const list = board ? undefined : sourceListFor(project, allPrompts);
    let shownQuestions = 0;
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">Your board — pick a square, answer the question, win its points</div>
        <div className="gn-board" role="img" aria-label={`Quiz board with categories ${categories.map(c => c.name).join(", ")}`}>
          {categories.map((category, ci) => (
            <div className="gn-board-col" key={ci}>
              <div className="gn-board-cat">{category.name}</div>
              {(category.questions || []).map((q, qi) => <div className="gn-board-cell" key={qi}>{q.value}</div>)}
            </div>
          ))}
        </div>
        <div className="gn-cards">
          {categories.map((category, ci) => (category.questions || []).map((q, qi) => {
            if (shownQuestions >= QUESTION_CAP) return null;
            shownQuestions += 1;
            return (
              <div className="gn-card gn-card-question" key={`${ci}-${qi}`}>
                <small>{category.name} · {q.value}</small>
                <b>{q.prompt}</b>
                <span>Answer: {q.answer}</span>
              </div>
            );
          }))}
        </div>
        <MoreNote hidden={allPrompts.length - shownQuestions} />
        {board && <EditorDoor doors={doors} tool={board} board />}
        {list && <EditorDoor doors={doors} tool={list} />}
      </div>
    );
  }
  if (gameType === "survey-showdown") {
    const cfg = config as unknown as SurveyConfig;
    const questions = cfg.questions || [];
    const board = sourceBoardFor(project, questions.map(q => q.question));
    const list = board ? undefined : sourceListFor(project, questions.flatMap(q => (q.answers || []).map(a => a.text)));
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">Your survey questions — teams guess the answers on the board</div>
        <div className="gn-cards">
          {questions.map((q, qi) => (
            <div className="gn-card gn-card-survey" key={qi}>
              <b>{q.question}</b>
              <ol className="gn-survey-answers">
                {(q.answers || []).map((a, ai) => <li key={ai}><span>{a.text}</span><em>{a.points}</em></li>)}
              </ol>
            </div>
          ))}
        </div>
        {board && <EditorDoor doors={doors} tool={board} board />}
        {list && <EditorDoor doors={doors} tool={list} />}
      </div>
    );
  }
  if (gameType === "perfect-match") {
    const cfg = config as unknown as PerfectMatchConfig;
    const prompts = cfg.prompts || [];
    const answers = cfg.answers || [];
    const promptList = sourceListFor(project, prompts);
    const answerList = sourceListFor(project, answers);
    const shownPrompts = prompts.slice(0, TILE_CAP);
    const shownAnswers = answers.slice(0, TILE_CAP);
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">Prompt cards — one is drawn each round, and everyone plays an answer card to match it</div>
        <div className="gn-cards">{shownPrompts.map((text, i) => <div className="gn-card gn-card-prompt" key={i}>{text}</div>)}</div>
        <MoreNote hidden={prompts.length - shownPrompts.length} />
        {promptList && <EditorDoor doors={doors} tool={promptList} />}
        <div className="gn-pieces-head">Answer cards — the hand every player plays from</div>
        <div className="gn-cards">{shownAnswers.map((text, i) => <div className="gn-card gn-card-answer" key={i}>{text}</div>)}</div>
        <MoreNote hidden={answers.length - shownAnswers.length} />
        {answerList && <EditorDoor doors={doors} tool={answerList} />}
      </div>
    );
  }
  if (gameType === "word-chain") {
    const cfg = config as unknown as WordChainConfig;
    const starters = cfg.starters || [];
    const shown = starters.slice(0, TILE_CAP);
    const source = sourceListFor(project, starters);
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">Starter words — a round opens with one, and the chain grows word by word</div>
        <div className="gn-tiles">{shown.map((word, i) => <span className="gn-tile gn-tile-word" key={i}>{word}</span>)}</div>
        <MoreNote hidden={starters.length - shown.length} />
        {source && <EditorDoor doors={doors} tool={source} />}
      </div>
    );
  }
  if (gameType === "draw-guess") {
    const cfg = config as unknown as DrawGuessConfig;
    const words = cfg.words || [];
    const shown = words.slice(0, TILE_CAP);
    const source = sourceListFor(project, words);
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">Words to draw — one player draws in secret, everyone else guesses</div>
        <div className="gn-tiles">{shown.map((word, i) => <span className="gn-tile gn-tile-word" key={i}>{word}</span>)}</div>
        <MoreNote hidden={words.length - shown.length} />
        {source && <EditorDoor doors={doors} tool={source} />}
      </div>
    );
  }
  if (gameType === "property-tycoon") {
    const cfg = config as unknown as PropertyTycoonConfig;
    const properties = cfg.properties || [];
    const chance = cfg.chanceCards || [];
    const source = sourceListFor(project, properties.map(p => p.name));
    return (
      <div className="gn-pieces">
        <div className="gn-pieces-head">Your board — players travel it, buy these properties and charge each other rent</div>
        <div className="gn-spaces">
          {properties.map((property, i) => {
            const loose = property as unknown as Record<string, unknown>;
            const color = typeof loose.color === "string" ? loose.color : undefined;
            return (
              <div className="gn-space" key={i}>
                <span className="gn-space-band" style={color ? { background: color } : undefined} aria-hidden="true" />
                <b>{property.name}</b>
                <small>{property.price}</small>
              </div>
            );
          })}
        </div>
        {chance.length > 0 && (
          <>
            <div className="gn-pieces-head">Chance cards — drawn on the Chance spaces</div>
            <div className="gn-cards">{chance.map((card, i) => <div className="gn-card gn-card-chance" key={i}>{card.text}</div>)}</div>
          </>
        )}
        {source && <EditorDoor doors={doors} tool={source} />}
      </div>
    );
  }
  return null;
}

/**
 * The resolved game presentation, or null when the project holds no
 * playable game yet (the caller shows the pictured shelf instead).
 */
export default function GameNightGameView({ project, doors }: { project: Project; doors: GameNightDoors }) {
  const picked = pickGame(project);
  if ("error" in picked) return null;
  const info = gameInfoFor(picked.gameType);
  return (
    <div className="gn-game">
      <div className="gn-game-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gn-game-art" src={info.image} alt="" />
        <div className="gn-game-title">
          <small>YOUR GAME</small>
          <h2>{info.icon} {info.name}</h2>
          {info.description && <p>{info.description}</p>}
        </div>
      </div>
      <Pieces project={project} doors={doors} gameType={picked.gameType} config={picked.config} />
    </div>
  );
}

/**
 * The pictured shelf of the seven games — what stands in Imagine &
 * Create when the project holds no game yet: examples of what can be
 * built, picture + name, the Game Night templates' own presentation.
 * Tapping one puts the ask in Jewel's conversation — the shelf is an
 * example shelf, not a form and not a tool pile.
 */
export function GameNightShelf({ onAskJewel }: { onAskJewel: (text: string) => void }) {
  return (
    <div className="gn-shelf">
      <h2 className="gn-shelf-head">Games you can build</h2>
      <p className="gn-shelf-note">Tap a game and Jewel will build it with you — or skip the shelf and just tell her your own idea.</p>
      <div className="gn-shelf-grid">
        {GAME_NIGHT_TEMPLATES.map(template => (
          <button
            type="button"
            className="gn-shelf-card"
            key={template.id}
            onClick={() => onAskJewel(`Build me a ${template.name} game for my game night, in the style of my project. Ask me anything you need to know first.`)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={template.image} alt="" />
            <span>{template.icon} {template.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
