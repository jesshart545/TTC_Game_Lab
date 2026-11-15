// Draw & Guess — the sixth Game Night module (Off-Stream Multiplayer
// Game Night). A drawing-and-guessing game in the classic style, under
// the site's own generic name: one player draws a word on a shared
// canvas while everyone else races to guess it. NO host: the game
// deals the words, keeps the turns, runs the clock and scores itself.
//
// Where the game's content comes from (documented choice): ONE card
// list in the project, read out of the published snapshot exactly the
// way bingo reads its card list (drawGuessConfigFromSnapshot). The deck
// is identified by the card-list tool's NAME, which is how Jewel is
// taught to build it: a list whose name contains "draw" (like "Draw
// Words") holds the words to draw. When several lists signal the deck,
// the largest one plays. A playable game needs at least
// DRAW_GUESS_MIN_WORDS different words.
//
// Name signals: "draw" wins over "word" when a name carries both
// ("Draw Words" is a drawing deck, not a Word Chain starter deck) —
// the same kind of tiebreak Perfect Match set when it ruled that a
// name containing both "prompt" and "answer" is the prompt deck.
// lib/word-chain.ts reads its signal the same way.
//
// Precedence with Bingo: bingo is tried first and needs only one card
// list, so an ordinary single list still plays Bingo exactly as before.
// A qualifying draw deck is left out of bingo's call pool whenever it
// is present (the pattern Perfect Match's deck pair set — see
// lib/bingo.ts), so a project whose content is a draw deck plays Draw
// & Guess; beside an ordinary list, bingo keeps the project and plays
// from that list, exactly as it always has.
//
// Secrecy: the word being drawn lives in the room state on the server
// and reaches the drawer ONLY through their own player state (the
// drawWord field — the same private channel as a Perfect Match hand).
// The public state carries the drawing, the wrong guesses and the
// word's letter blanks — never the word itself — until the round ends
// and the word is revealed to everyone. Points are plain counts
// everywhere; no dollar signs.

export type DrawGuessConfig = {
  title: string;
  words: string[];
  roundMs: number;
  theme: string;
  accent: string;
};

/** One pen stroke: a polyline of [x, y] points in canvas coordinates
 * (DRAW_GUESS_CANVAS space), drawn in one color at one width. */
export type DrawGuessStroke = {
  color: string;
  width: number;
  points: [number, number][];
};

/** One wrong guess, shown publicly in the guess feed. */
export type DrawGuessGuess = {
  playerId: string;
  text: string;
  at: number;
};

export type DrawGuessRoundResult = {
  word: string;
  drawerId: string | null;
  /** The player who guessed it — null when the clock ran out. */
  guesserId: string | null;
};

export type DrawGuessRoomState = {
  startedAt: number;
  phase: "draw" | "reveal" | "done";
  /** Shuffled indices into config.words; [wordIndex] is this round's word. */
  wordOrder: number[];
  wordIndex: number;
  /** Player ids in drawer rotation order (join order; late joiners append). */
  rotation: string[];
  drawerIndex: number;
  drawerId: string | null;
  /** How many turns at the easel each player has taken this game. */
  drawsTaken: Record<string, number>;
  /** The word being drawn — SERVER-SIDE ONLY while the round runs. */
  currentWord: string;
  strokes: DrawGuessStroke[];
  /** Wrong guesses only — a right one ends the round on the spot. */
  guesses: DrawGuessGuess[];
  roundEndsAt: number;
  revealUntil: number;
  lastRound: DrawGuessRoundResult | null;
};

export type DrawGuessPlayerState = {
  score: number;
  /** The word this player is drawing right now — set ONLY on the
   * drawer's own state, and only while their round runs. */
  drawWord: string;
};

export const DRAW_GUESS_MIN_WORDS = 12;
export const DRAW_GUESS_ROUND_MS = 60000;
export const DRAW_GUESS_REVEAL_MS = 5000;
export const DRAW_GUESS_DRAWS_EACH = 2;
export const DRAW_GUESS_GUESSER_POINTS = 3;
export const DRAW_GUESS_DRAWER_POINTS = 1;
export const DRAW_GUESS_MAX_STROKES = 200;
export const DRAW_GUESS_MAX_POINTS_PER_STROKE = 240;
export const DRAW_GUESS_FEED_LIMIT = 30;
/** The shared canvas coordinate space every client draws in. */
export const DRAW_GUESS_CANVAS = { width: 1000, height: 750 };
export const DRAW_GUESS_COLORS = [
  "#1f2430", "#e11d48", "#f97316", "#facc15",
  "#22c55e", "#0ea5e9", "#6366f1", "#a855f7",
  "#ec4899", "#92400e", "#ffffff",
];
export const DRAW_GUESS_WIDTHS = [4, 10, 22];

const MAX_WORDS = 200;

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

/** Whether a card list signals the Draw & Guess deck, from its name —
 * the same signal bingo's extraction uses to leave a qualifying draw
 * deck out of its call pool. */
export function cardListIsDrawDeck(name: unknown): boolean {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  return text.includes("draw");
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

/** Read the Draw & Guess definition out of a project's published snapshot. */
export function drawGuessConfigFromSnapshot(snapshot: unknown): { config: DrawGuessConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];
  const lists = tools.filter(tool => tool.type === "card-list" && cardListIsDrawDeck(tool.name));
  const deck = lists.slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
  const words = deck ? dedupe(cardTexts(deck)).slice(0, MAX_WORDS) : [];
  if (words.length < DRAW_GUESS_MIN_WORDS) {
    // pickGame surfaces the LAST module's error, so this one speaks for
    // the whole game night: all six games, in plain words.
    return { error: `This game night needs something to play before it can be shared — add a card list with at least 5 items for Bingo, a quiz board with at least 6 questions across at least 2 categories for Quiz Board, a survey board with at least 3 questions of at least 3 answers each for Survey Showdown, two card lists for Perfect Match — one with "prompt" in its name holding at least 10 prompts and one with "answer" in its name holding at least 30 answers — a card list with "word" in its name holding at least 10 starter words for Word Chain, or a card list with "draw" in its name holding at least ${DRAW_GUESS_MIN_WORDS} words to draw for Draw & Guess (ask Jewel to build one), publish, then share.` };
  }
  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Draw & Guess",
      words,
      roundMs: DRAW_GUESS_ROUND_MS,
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function drawGuessPlayerState(raw: unknown): DrawGuessPlayerState {
  const state = (raw || {}) as Partial<DrawGuessPlayerState>;
  return {
    score: typeof state.score === "number" && Number.isFinite(state.score) ? state.score : 0,
    drawWord: typeof state.drawWord === "string" ? state.drawWord : "",
  };
}

/** The word as letter blanks for the guessers: one blank per letter,
 * spaces and punctuation shown as they are. Length is all it gives
 * away — never a letter. */
export function drawGuessBlanks(word: string): string {
  return String(word ?? "").split("").map(char => (/[A-Za-z]/.test(char) ? "_" : char)).join("");
}

/** Validate and tame one incoming stroke before it joins the public
 * drawing: the color must be a palette color and the width a pen size
 * (anything else falls back to the defaults), points are clamped into
 * the canvas, rounded, and decimated to the per-stroke cap so room
 * state stays small no matter how fast a hand moves. Returns null
 * when there is nothing drawable in it. */
export function drawGuessCleanStroke(raw: unknown): DrawGuessStroke | null {
  const stroke = (raw || {}) as { color?: unknown; width?: unknown; points?: unknown };
  if (!Array.isArray(stroke.points)) return null;
  const color = typeof stroke.color === "string" && DRAW_GUESS_COLORS.includes(stroke.color) ? stroke.color : DRAW_GUESS_COLORS[0];
  const width = typeof stroke.width === "number" && DRAW_GUESS_WIDTHS.includes(stroke.width) ? stroke.width : DRAW_GUESS_WIDTHS[1];
  const rawPoints: [number, number][] = [];
  for (const point of stroke.points) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    rawPoints.push([
      Math.round(Math.min(DRAW_GUESS_CANVAS.width, Math.max(0, x))),
      Math.round(Math.min(DRAW_GUESS_CANVAS.height, Math.max(0, y))),
    ]);
  }
  // Consecutive duplicates carry no line — drop them before decimating.
  const points = rawPoints.filter((point, index) => index === 0 || point[0] !== rawPoints[index - 1][0] || point[1] !== rawPoints[index - 1][1]);
  if (!points.length) return null;
  const stride = Math.max(1, Math.ceil(points.length / DRAW_GUESS_MAX_POINTS_PER_STROKE));
  const capped = points.filter((_, index) => index % stride === 0 || index === points.length - 1);
  return { color, width, points: capped };
}
