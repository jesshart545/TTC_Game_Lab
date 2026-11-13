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
  config?: Record<string, unknown> | null;
};

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
  const picker = tools.find(tool => tool.type === "random-picker" && tool.config?.source === "cards" && typeof tool.config?.listId === "string");
  let pool = picker ? lists.find(tool => tool.id === picker.config?.listId) : undefined;
  if (!pool) {
    pool = lists.slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
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
