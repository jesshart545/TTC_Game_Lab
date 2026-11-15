// Perfect Match — the fourth Game Night module (Off-Stream Multiplayer
// Game Night). A card-matching game in the classic style, under the
// site's own generic name: a prompt card is shown, everyone else plays
// one answer card from their hand face-down, and the round's judge — a
// player like everyone else, rotating every round — picks the best
// match. NO host: the game deals, collects, reveals and scores itself.
//
// Where the game's content comes from (documented choice): TWO card
// lists in the project, read out of the published snapshot exactly the
// way bingo reads its card list (perfectMatchConfigFromSnapshot). The
// decks are identified by the card-list tool's NAME, which is how Jewel
// is taught to build them: a list whose name contains "prompt" is the
// prompt deck (short descriptions — "Spooky", "Worth a million
// followers"); a list whose name contains "answer" is the answer deck
// (things, people and places players hold in hand). A list whose name
// contains both words counts as the prompt deck. When several lists
// signal the same deck, the largest one plays. A playable game needs at
// least PERFECT_MATCH_MIN_PROMPTS prompts and at least
// PERFECT_MATCH_MIN_ANSWERS answers.
//
// Precedence with Bingo: bingo is tried first and needs only one card
// list, so a project with a single list still plays Bingo exactly as
// before. Perfect Match may only claim a snapshot holding BOTH decks —
// and when both decks are present, bingo's extraction leaves the two
// deck lists out of its call pool (see lib/bingo.ts), so a two-deck
// project is a matching game, not a bingo game that happens to hold
// prompt cards.
//
// Hands and secrecy: a player's hand lives ONLY in their own player
// state, which the room view hands back to that player alone (the same
// discipline as a bingo card). publicState carries hand COUNTS for the
// other players, never their cards. Submissions are collected without
// any owner attached to what players see: the revealed cards carry only
// their text until the judge has picked, and only then is the winner
// named. Points are plain counts everywhere; no dollar signs.

import { shuffle } from "./bingo";

export type PerfectMatchConfig = {
  title: string;
  prompts: string[];
  answers: string[];
  submitMs: number;
  theme: string;
  accent: string;
};

export type PerfectMatchSubmission = { playerId: string; card: string };

export type PerfectMatchRoundResult = {
  prompt: string;
  judgeId: string | null;
  winnerId: string | null;
  winningCard: string | null;
};

export type PerfectMatchRoomState = {
  startedAt: number;
  phase: "submit" | "judge" | "reveal" | "done";
  /** Rounds played in this game (the room's own round counts Play Agains). */
  roundNumber: number;
  handSize: number;
  /** Player ids in judge rotation order (join order; late joiners append). */
  rotation: string[];
  judgeIndex: number;
  judgeId: string | null;
  promptOrder: number[];
  promptIndex: number;
  drawPile: string[];
  discard: string[];
  submissions: PerfectMatchSubmission[];
  /** The submissions in their shuffled, anonymous reveal order (server-side). */
  revealed: PerfectMatchSubmission[];
  roundEndsAt: number;
  revealUntil: number;
  revealSeed: number;
  lastRound: PerfectMatchRoundResult | null;
};

export type PerfectMatchPlayerState = {
  score: number;
  hand: string[];
  submittedRound: number;
  submittedCard: string;
};

export const PERFECT_MATCH_MIN_PROMPTS = 10;
export const PERFECT_MATCH_MIN_ANSWERS = 30;
export const PERFECT_MATCH_HAND_SIZE = 7;
export const PERFECT_MATCH_WIN_POINTS = 5;
export const PERFECT_MATCH_DEFAULT_SUBMIT_MS = 90000;
export const PERFECT_MATCH_REVEAL_MS = 6000;

const MAX_PROMPTS = 60;
const MAX_ANSWERS = 240;

const THEME_ACCENTS: Record<string, string> = {
  cyan: "#22d3ee",
  purple: "#a855f7",
  pink: "#ec4899",
};

type AnyTool = {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  config?: Record<string, unknown> | null;
};

/** Which deck a card list belongs to, from its name — the same signal
 * bingo's extraction uses to leave a complete pair of decks alone. A
 * name containing both words is the prompt deck. */
export function cardListDeckKind(name: unknown): "prompt" | "answer" | null {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  if (text.includes("prompt")) return "prompt";
  if (text.includes("answer")) return "answer";
  return null;
}

function cardTexts(tool: AnyTool): string[] {
  const config = (tool.config || {}) as Record<string, unknown>;
  const fromCards: string[] = [];
  if (Array.isArray(config.cards)) {
    for (const card of config.cards) {
      const text = typeof card === "string" ? card : String((card as { text?: unknown })?.text ?? "");
      if (text.trim()) fromCards.push(text.trim());
    }
  }
  if (fromCards.length) return fromCards;
  if (Array.isArray(config.items)) {
    return config.items.map(item => String(item ?? "").trim()).filter(Boolean);
  }
  return [];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function largestDeck(lists: AnyTool[]): AnyTool | undefined {
  return lists.slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
}

function submitMs(...sources: Array<Record<string, unknown> | undefined>): number {
  for (const source of sources) {
    const raw = source?.submitSeconds;
    const seconds = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(180, Math.max(30, seconds)) * 1000;
    }
  }
  return PERFECT_MATCH_DEFAULT_SUBMIT_MS;
}

/** Read the Perfect Match definition out of a project's published snapshot. */
export function perfectMatchConfigFromSnapshot(snapshot: unknown): { config: PerfectMatchConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];
  const lists = tools.filter(tool => tool.type === "card-list");
  const promptDeck = largestDeck(lists.filter(tool => cardListDeckKind(tool.name) === "prompt"));
  const answerDeck = largestDeck(lists.filter(tool => cardListDeckKind(tool.name) === "answer" && tool !== promptDeck));
  const prompts = promptDeck ? dedupe(cardTexts(promptDeck)).slice(0, MAX_PROMPTS) : [];
  const answers = answerDeck ? dedupe(cardTexts(answerDeck)).slice(0, MAX_ANSWERS) : [];
  if (prompts.length < PERFECT_MATCH_MIN_PROMPTS || answers.length < PERFECT_MATCH_MIN_ANSWERS) {
    // pickGame surfaces the LAST module's error, so this one speaks for
    // the whole game night: all four games, in plain words.
    return { error: `This game night needs something to play before it can be shared — add a card list with at least 5 items for Bingo, a quiz board with at least 6 questions across at least 2 categories for Quiz Board, a survey board with at least 3 questions of at least 3 answers each for Survey Showdown, or two card lists for Perfect Match — one with "prompt" in its name holding at least ${PERFECT_MATCH_MIN_PROMPTS} prompts and one with "answer" in its name holding at least ${PERFECT_MATCH_MIN_ANSWERS} answers (ask Jewel to build them), publish, then share.` };
  }
  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Perfect Match",
      prompts,
      answers,
      submitMs: submitMs(
        (answerDeck?.config || undefined) as Record<string, unknown> | undefined,
        (promptDeck?.config || undefined) as Record<string, unknown> | undefined,
      ),
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function perfectMatchPlayerState(raw: unknown): PerfectMatchPlayerState {
  const state = (raw || {}) as Partial<PerfectMatchPlayerState>;
  return {
    score: typeof state.score === "number" && Number.isFinite(state.score) ? state.score : 0,
    hand: Array.isArray(state.hand) ? state.hand.map(card => String(card ?? "")).filter(Boolean) : [],
    submittedRound: typeof state.submittedRound === "number" && Number.isFinite(state.submittedRound) ? state.submittedRound : 0,
    submittedCard: typeof state.submittedCard === "string" ? state.submittedCard : "",
  };
}

/** A small deterministic PRNG (mulberry32) so the anonymous reveal
 * order is shuffled from the room's seed — never from Math.random,
 * which the engine keeps out of module state transitions. */
export function seededRng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle with a seed derived from the room, so every client and every
 * test sees the same anonymous order for a given round. */
export function perfectMatchRevealOrder(submissions: PerfectMatchSubmission[], seed: number, roundNumber: number): PerfectMatchSubmission[] {
  return shuffle(submissions, seededRng(seed + roundNumber * 7919));
}
