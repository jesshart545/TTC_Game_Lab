// Word Chain — the fifth Game Night module (Off-Stream Multiplayer
// Game Night). A word association game in the classic style, under the
// site's own generic name: a starter word goes up BIG, and players take
// turns adding one word associated with the word before it, building a
// chain across the screen. NO host: the game deals the starter, keeps
// the turns, runs the clock and scores itself.
//
// Where the game's content comes from (documented choice): ONE card
// list in the project, read out of the published snapshot exactly the
// way bingo reads its card list (wordChainConfigFromSnapshot). The deck
// is identified by the card-list tool's NAME, which is how Jewel is
// taught to build it: a list whose name contains "word" (like "Word
// Starters") holds the starter words. When several lists signal the
// deck, the largest one plays. A playable game needs at least
// WORD_CHAIN_MIN_STARTERS different starter words.
//
// Precedence with Bingo: bingo is tried first and needs only one card
// list, so an ordinary single list still plays Bingo exactly as before.
// The one exception follows the pattern Perfect Match set: when a
// word-named list that qualifies as a word deck is the snapshot's ONLY
// bingo candidate, bingo's extraction leaves it out of its call pool
// (see lib/bingo.ts), so a project whose only content is a starter deck
// is a Word Chain game, not a bingo game that happens to hold words.
// A word list sitting next to any other playable content changes
// nothing — bingo and the earlier modules keep their priority.
//
// The rules the game enforces are only the objective ones — there is no
// AI judging whether an association is "good enough" (that's the
// group's fun, and there is no host to argue with): a play must be one
// word, letters only, and not a repeat of any word already in the chain.
// Anything else — a repeat, a malformed word, or the 10-second clock
// running out — is a strike. Two strikes and the player is out; the
// chain plays on without them. The game ends when one player is left
// standing, or when the chain reaches WORD_CHAIN_CHAIN_TARGET words
// and everyone still in shares the finish.

export type WordChainConfig = {
  title: string;
  starters: string[];
  turnMs: number;
  theme: string;
  accent: string;
};

export type WordChainPlayResult = "in" | "repeat" | "invalid" | "timeout";

export type WordChainLastPlay = {
  playerId: string;
  word: string;
  result: WordChainPlayResult;
};

export type WordChainRoomState = {
  startedAt: number;
  phase: "play" | "done";
  /** Shuffled indices into config.starters; [starterIndex] is this game's starter. */
  starterOrder: number[];
  starterIndex: number;
  /** The chain so far — chain[0] is the starter word. */
  chain: string[];
  turnPlayerId: string | null;
  turnEndsAt: number;
  /** Increments on every turn change, so a stale screen can't act twice. */
  turnNumber: number;
  lastPlay: WordChainLastPlay | null;
};

export type WordChainPlayerState = {
  strikes: number;
  out: boolean;
  /** Chain length at the moment the player went out (null while in). */
  outAt: number | null;
  /** Words this player has added to the chain. */
  added: number;
};

export const WORD_CHAIN_MIN_STARTERS = 10;
export const WORD_CHAIN_TURN_MS = 10000;
export const WORD_CHAIN_CHAIN_TARGET = 30;
export const WORD_CHAIN_MAX_STRIKES = 2;

const MAX_STARTERS = 200;

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

/** Whether a card list signals the Word Chain deck, from its name —
 * the same signal bingo's extraction uses to leave a lone qualifying
 * word deck to the chain game. */
export function cardListIsWordDeck(name: unknown): boolean {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  return text.includes("word");
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

/** Read the Word Chain definition out of a project's published snapshot. */
export function wordChainConfigFromSnapshot(snapshot: unknown): { config: WordChainConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];
  const lists = tools.filter(tool => tool.type === "card-list" && cardListIsWordDeck(tool.name));
  const deck = lists.slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
  const starters = deck ? dedupe(cardTexts(deck)).slice(0, MAX_STARTERS) : [];
  if (starters.length < WORD_CHAIN_MIN_STARTERS) {
    // pickGame surfaces the LAST module's error, so this one speaks for
    // the whole game night: all five games, in plain words.
    return { error: `This game night needs something to play before it can be shared — add a card list with at least 5 items for Bingo, a quiz board with at least 6 questions across at least 2 categories for Quiz Board, a survey board with at least 3 questions of at least 3 answers each for Survey Showdown, two card lists for Perfect Match — one with "prompt" in its name holding at least 10 prompts and one with "answer" in its name holding at least 30 answers — or a card list with "word" in its name holding at least ${WORD_CHAIN_MIN_STARTERS} starter words for Word Chain (ask Jewel to build one), publish, then share.` };
  }
  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Word Chain",
      starters,
      turnMs: WORD_CHAIN_TURN_MS,
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function wordChainPlayerState(raw: unknown): WordChainPlayerState {
  const state = (raw || {}) as Partial<WordChainPlayerState>;
  return {
    strikes: typeof state.strikes === "number" && Number.isFinite(state.strikes) ? Math.max(0, Math.floor(state.strikes)) : 0,
    out: state.out === true,
    outAt: typeof state.outAt === "number" && Number.isFinite(state.outAt) ? state.outAt : null,
    added: typeof state.added === "number" && Number.isFinite(state.added) ? Math.max(0, Math.floor(state.added)) : 0,
  };
}

/** The objective check on one submitted word. "ok" carries the word as
 * typed (trimmed); anything else names the strike it earns. A word is
 * playable when it is a single word of letters only and no word already
 * in the chain matches it (case-insensitive). */
export function wordChainCheckWord(text: string, chain: readonly string[]): { ok: true; word: string } | { ok: false; result: "repeat" | "invalid" } {
  const word = String(text ?? "").trim();
  if (!word || /\s/.test(word) || !/^[A-Za-z]+$/.test(word)) return { ok: false, result: "invalid" };
  const key = word.toLowerCase();
  if (chain.some(entry => entry.toLowerCase() === key)) return { ok: false, result: "repeat" };
  return { ok: true, word };
}
