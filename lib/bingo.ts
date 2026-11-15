// Bingo — the first Game Night module (Off-Stream Multiplayer Game Night).
//
// Where the game's content comes from (documented choice): a bingo game is
// assembled in the project Workshop exactly the way the site's existing
// Playlist Bingo template assembles it — the call items live in a
// `card-list` tool's config.cards (each card's `text` is one call item),
// and a `random-picker` tool draws from that list (config.source "cards",
// config.listId → the card-list tool). extractConfig reads the published
// snapshot in that shape: the picker-linked card list wins; otherwise the
// largest card-list tool in the project is the pool. A list tool may also
// carry config.items (string[]) as a fallback pool. The draw interval
// comes from the picker/list config (`drawIntervalSeconds`) and defaults
// to 6 seconds.
//
// Cards are 5×5 with a FREE center. A card needs 24 items: when the pool
// has 24+, each card is sampled without replacement; when the pool is
// smaller, the card is filled by cycling freshly-shuffled passes over the
// pool, so an item may appear more than once on one card (marking a drawn
// item marks every matching cell). Draws are always without replacement
// from the pool, in an order shuffled once when the game starts — the
// number of draws revealed is a pure function of elapsed time, so the
// poll drives the game with no background job.

export type BingoConfig = {
  title: string;
  items: string[];
  drawIntervalMs: number;
  theme: string;
  accent: string;
};

export type BingoRoomState = {
  drawOrder: number[];
  startedAt: number;
  winnerId: string | null;
  finishReason: "line" | "exhausted" | null;
};

export type BingoPlayerState = {
  card: string[];
  markedCells: number[];
};

export const BINGO_MIN_ITEMS = 5;
export const BINGO_DEFAULT_INTERVAL_MS = 6000;

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

/** Which Perfect Match deck a card list belongs to, from its name (the
 * same signal lib/perfect-match.ts reads). When a project holds BOTH
 * decks, those two lists are a matching game waiting to be dealt, not a
 * bingo call pool — bingo leaves them out and plays from any other list
 * exactly as before. A single list, deck-named or not, is untouched. */
function deckKind(name: unknown): "prompt" | "answer" | null {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  if (text.includes("prompt")) return "prompt";
  if (text.includes("answer")) return "answer";
  return null;
}

/** The Word Chain deck signal (lib/word-chain.ts reads the same one):
 * a card-list name containing "word". WORD_DECK_MIN_STARTERS mirrors
 * WORD_CHAIN_MIN_STARTERS there — a list only counts as a word deck
 * when it holds at least that many different starter words. A name
 * that also signals Draw & Guess ("draw") is a drawing deck, not a
 * word deck — the draw signal wins, as both modules read it. */
const WORD_DECK_MIN_STARTERS = 10;

function isWordDeck(name: unknown): boolean {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  return text.includes("word") && !text.includes("draw");
}

/** The Draw & Guess deck signal (lib/draw-guess.ts reads the same
 * one): a card-list name containing "draw". DRAW_DECK_MIN_WORDS
 * mirrors DRAW_GUESS_MIN_WORDS there — a list only counts as a draw
 * deck when it holds at least that many different words to draw. */
const DRAW_DECK_MIN_WORDS = 12;

function isDrawDeck(name: unknown): boolean {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  return text.includes("draw");
}

function qualifiesAsDrawDeck(tool: AnyTool): boolean {
  return isDrawDeck(tool.name) && dedupe(cardTexts(tool)).length >= DRAW_DECK_MIN_WORDS;
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

function intervalMs(...sources: Array<Record<string, unknown> | undefined>): number {
  for (const source of sources) {
    const raw = source?.drawIntervalSeconds;
    const seconds = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(60, Math.max(3, seconds)) * 1000;
    }
  }
  return BINGO_DEFAULT_INTERVAL_MS;
}

/** Read the bingo definition out of a project's published snapshot. */
export function bingoConfigFromSnapshot(snapshot: unknown): { config: BingoConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];
  const lists = tools.filter(tool => tool.type === "card-list");
  const deckPairPresent = lists.some(tool => deckKind(tool.name) === "prompt") && lists.some(tool => deckKind(tool.name) === "answer");
  const poolLists = deckPairPresent ? lists.filter(tool => deckKind(tool.name) === null) : lists;
  // Draw & Guess's deck: a draw-named list that qualifies as a draw
  // deck is a drawing game waiting to be played, not a bingo call
  // pool, so it is left out whenever it is present — the same
  // treatment the Perfect Match deck pair gets above. (That is also
  // what leaves a word deck standing as the pool's sole candidate in
  // a draw-deck-plus-word-deck project, below.) A draw-named list too
  // small to play (under the minimum) is an ordinary pool list,
  // exactly like a short word list.
  const drawExcluded = poolLists.filter(tool => !qualifiesAsDrawDeck(tool));
  // Word Chain's deck: a word-named list that qualifies as a word deck
  // is left out of the call pool ONLY when it is the snapshot's sole
  // bingo candidate — a project whose only content is a starter deck is
  // a chain game, and the room falls through the registry to Word
  // Chain. With any other candidate present, bingo plays exactly as it
  // always has, word list included.
  const wordDeckAlone = drawExcluded.length === 1 && isWordDeck(drawExcluded[0].name)
    && dedupe(cardTexts(drawExcluded[0])).length >= WORD_DECK_MIN_STARTERS;
  const candidates = wordDeckAlone ? [] : drawExcluded;
  const picker = tools.find(tool => tool.type === "random-picker" && tool.config?.source === "cards" && typeof tool.config?.listId === "string");
  let pool = picker ? candidates.find(tool => tool.id === picker.config?.listId) : undefined;
  if (!pool) {
    pool = candidates.slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
  }
  const items = pool ? dedupe(cardTexts(pool)) : [];
  if (!pool || items.length < BINGO_MIN_ITEMS) {
    return { error: `This game night needs a list of at least ${BINGO_MIN_ITEMS} call items before it can be shared — add a card list of items (the way Playlist Bingo holds its songs) in the Workshop, publish, then share.` };
  }
  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Game Night Bingo",
      items,
      drawIntervalMs: intervalMs(picker?.config || undefined, (pool.config || undefined) as Record<string, unknown>),
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function shuffle<T>(input: readonly T[], rng: () => number): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deal one 5×5 card (index 12 is the FREE center, stored as ""). */
export function dealBingoCard(items: string[], rng: () => number): string[] {
  const cells: string[] = [];
  while (cells.length < 24) {
    for (const item of shuffle(items, rng)) {
      if (cells.length >= 24) break;
      cells.push(item);
    }
  }
  const card = cells.slice();
  card.splice(12, 0, "");
  return card;
}

export const BINGO_LINES: number[][] = (() => {
  const lines: number[][] = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map(c => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map(r => r * 5 + c));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines;
})();

export function bingoMarks(playerState: BingoPlayerState): number {
  return playerState.markedCells.filter(cell => cell !== 12).length;
}

/** How many more marked cells the player's best line needs (0 = bingo). */
export function bingoAway(playerState: BingoPlayerState): number {
  const marked = new Set(playerState.markedCells);
  let best = 5;
  for (const line of BINGO_LINES) {
    const missing = line.filter(cell => !marked.has(cell)).length;
    if (missing < best) best = missing;
  }
  return best;
}

export function bingoHasLine(playerState: BingoPlayerState): boolean {
  return bingoAway(playerState) === 0;
}

/** Items revealed so far — a pure function of time since the game started. */
export function bingoDrawnItems(config: BingoConfig, state: BingoRoomState, now: number): string[] {
  if (!state.startedAt || !state.drawOrder.length) return [];
  const count = Math.min(state.drawOrder.length, Math.floor((now - state.startedAt) / config.drawIntervalMs) + 1);
  if (count <= 0) return [];
  return state.drawOrder.slice(0, count).map(index => config.items[index]);
}

export function bingoPlayerState(raw: unknown): BingoPlayerState {
  const state = (raw || {}) as Partial<BingoPlayerState>;
  return {
    card: Array.isArray(state.card) ? state.card.map(cell => String(cell ?? "")) : [],
    markedCells: Array.isArray(state.markedCells) ? state.markedCells.filter(cell => Number.isInteger(cell)) as number[] : [],
  };
}
