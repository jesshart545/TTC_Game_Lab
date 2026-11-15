// Property Tycoon — the seventh Game Night module (Off-Stream
// Multiplayer Game Night). A property-trading board game in the
// classic style, under the site's own generic name: players roll dice
// around a board, buy the properties they land on, and pay rent to
// whoever owns the ones they can't. NO host: the game keeps the turns,
// the money and the board, and runs itself.
//
// Where the game's content comes from (documented choice): ONE card
// list in the project, read out of the published snapshot exactly the
// way bingo reads its card list (propertyTycoonConfigFromSnapshot).
// The list is identified by the card-list tool's NAME, which is how
// Jewel is taught to build it: a list whose name contains "property"
// (like "Properties") holds the buyable spaces IN BOARD ORDER. When
// several lists signal the board, the largest one plays. A playable
// game needs at least TYCOON_MIN_PROPERTIES different properties. An
// OPTIONAL second list whose name contains "chance" supplies the
// chance-card texts; without one, a small built-in set of cards plays.
//
// Prices are NOT creator data: they ladder by board position, so the
// board is balanced no matter what the creator names their streets.
// Properties group into color sets by position (sets of two or three
// consecutive properties); holding a whole set doubles its rents.
// Every amount in this game is a PLAIN NUMBER — no dollar signs, no
// currency symbols, anywhere.
//
// Precedence with Bingo: bingo is tried first and needs only one card
// list, so an ordinary single list still plays Bingo exactly as before.
// A qualifying property list is left out of bingo's call pool whenever
// it is present (the pattern Perfect Match's deck pair and Draw &
// Guess's deck set — see lib/bingo.ts), so a project whose content is
// a property list plays Property Tycoon; beside an ordinary list,
// bingo keeps the project and plays from that list, exactly as it
// always has.
//
// The board: the properties in order around a loop, with START at
// position 0 and four special spaces interleaved after roughly every
// quarter of the properties — Chance, Rest, Tax, and Go to Time-Out,
// in that order — for a total of properties + 5 spaces. The Rest space
// doubles as the Time-Out corner (the classic board's jail corner):
// landing on it by dice is a rest, but a player sent there by the Go
// to Time-Out space stays on that corner and misses their next turn.
//
// Turns are ACTION-DRIVEN — there are no timers in this game at all.
// A turn waits for its player: they roll, the token moves, the space
// resolves, and if it is an unowned property the turn pauses on a
// buy-or-pass offer that only that player can settle. The module's
// tick is a no-op by design, so the game never depends on the poll
// advancing anything.

export type TycoonChanceEffect =
  | { kind: "money"; amount: number }
  | { kind: "move"; steps: number }
  | { kind: "skip" };

export type TycoonChanceCard = {
  text: string;
  effect: TycoonChanceEffect;
};

export type TycoonProperty = {
  name: string;
  price: number;
  /** Color-set index (sets are consecutive runs of properties). */
  set: number;
  color: string;
};

export type TycoonSpace =
  | { kind: "start" }
  | { kind: "property"; property: number }
  | { kind: "chance" }
  | { kind: "rest" }
  | { kind: "tax" }
  | { kind: "timeout" };

export type PropertyTycoonConfig = {
  title: string;
  properties: TycoonProperty[];
  spaces: TycoonSpace[];
  /** Board index of the Rest space — the Time-Out corner. */
  timeoutSpace: number;
  chanceCards: TycoonChanceCard[];
  theme: string;
  accent: string;
};

export type PropertyTycoonRoomState = {
  startedAt: number;
  /** Server seed for the dice, dealt at game start. */
  diceSeed: number;
  /** How many rolls have been made — each roll's dice derive from it. */
  rollsMade: number;
  turnPlayerId: string | null;
  /** "roll" while the turn player is yet to roll; "decide" while a
   * buy-or-pass offer is open (the turn cannot move on without it). */
  stage: "roll" | "decide";
  /** Board index of the space whose property is on offer, if any. */
  offerSpace: number | null;
  lastDice: [number, number] | null;
  /** Owner per property index (parallel to config.properties). */
  owners: (string | null)[];
  /** Next chance card to draw. */
  chanceIndex: number;
  turnsTaken: Record<string, number>;
  /** Player ids in the order they went bankrupt. */
  outOrder: string[];
  /** The latest thing that happened, in plain words, names included. */
  lastEvent: string | null;
};

export type PropertyTycoonPlayerState = {
  balance: number;
  /** Board index the player's token stands on. */
  position: number;
  out: boolean;
  /** Miss the next turn (Time-Out, or a chance card's say-so). */
  skipNext: boolean;
};

export const TYCOON_MIN_PROPERTIES = 12;
export const TYCOON_START_BALANCE = 1500;
export const TYCOON_SALARY = 200;
export const TYCOON_TAX = 50;
export const TYCOON_TURNS_EACH = 12;

const MAX_PROPERTIES = 24;
const MAX_CHANCE_CARDS = 30;

/** Color-set palette, assigned to sets in order around the board. */
export const TYCOON_SET_COLORS = [
  "#92400e", "#0ea5e9", "#ec4899", "#f97316", "#22c55e",
  "#6366f1", "#e11d48", "#a855f7", "#14b8a6", "#eab308",
];

/** The fixed effect rotation creator chance texts are paired with:
 * card k of the creator's list carries effect k of this cycle. */
export const TYCOON_CHANCE_ROTATION: TycoonChanceEffect[] = [
  { kind: "money", amount: 100 },
  { kind: "money", amount: -75 },
  { kind: "move", steps: 3 },
  { kind: "money", amount: 50 },
  { kind: "money", amount: -40 },
  { kind: "skip" },
];

/** The built-in chance deck, played when the project holds no chance
 * list of its own: the same rotation, with its own texts. */
export const TYCOON_BUILTIN_CHANCE: TycoonChanceCard[] = [
  { text: "Lucky day! A stranger tips you for your style. Collect 100.", effect: { kind: "money", amount: 100 } },
  { text: "An unexpected bill arrives. Pay 75.", effect: { kind: "money", amount: -75 } },
  { text: "A friendly shortcut opens up. Move forward 3 spaces.", effect: { kind: "move", steps: 3 } },
  { text: "Your side hustle pays off. Collect 50.", effect: { kind: "money", amount: 50 } },
  { text: "Parking fees add up. Pay 40.", effect: { kind: "money", amount: -40 } },
  { text: "You need a breather. Miss your next turn.", effect: { kind: "skip" } },
];

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

/** Whether a card list signals the Property Tycoon board, from its
 * name — the same signal bingo's extraction uses to leave a qualifying
 * property list out of its call pool. */
export function cardListIsPropertyList(name: unknown): boolean {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  return text.includes("propert");
}

/** Whether a card list signals the chance deck, from its name. */
export function cardListIsChanceList(name: unknown): boolean {
  const text = typeof name === "string" ? name.toLowerCase() : "";
  return text.includes("chance");
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

/** The price ladder: properties cost more the further around the
 * board they sit. Plain numbers, always. */
export function tycoonPrice(propertyIndex: number): number {
  return 60 + propertyIndex * 20;
}

/** Color sets: consecutive runs of two or three properties. The set
 * count is the smallest that keeps every set at three or fewer, and
 * the fuller sets come first, so the layout is a pure function of how
 * many properties the board holds. */
export function tycoonSetSizes(propertyCount: number): number[] {
  const sets = Math.max(1, Math.ceil(propertyCount / 3));
  const base = Math.floor(propertyCount / sets);
  const fuller = propertyCount - base * sets;
  return Array.from({ length: sets }, (_, index) => base + (index < fuller ? 1 : 0));
}

/** Build the board from the property names, in order: the properties
 * with their prices and color sets, the full loop of spaces (START
 * first, then a special after roughly every quarter — Chance, Rest,
 * Tax, Go to Time-Out), and the Time-Out corner's board index. */
export function tycoonBuildBoard(names: string[]): { properties: TycoonProperty[]; spaces: TycoonSpace[]; timeoutSpace: number } {
  const sizes = tycoonSetSizes(names.length);
  const setOf: number[] = [];
  sizes.forEach((size, set) => { for (let i = 0; i < size; i++) setOf.push(set); });
  const properties: TycoonProperty[] = names.map((name, index) => ({
    name,
    price: tycoonPrice(index),
    set: setOf[index] ?? 0,
    color: TYCOON_SET_COLORS[(setOf[index] ?? 0) % TYCOON_SET_COLORS.length],
  }));

  const quarter = Math.max(1, Math.ceil(names.length / 4));
  const specials = new Map<number, TycoonSpace["kind"]>([
    [quarter - 1, "chance"],
    [2 * quarter - 1, "rest"],
    [3 * quarter - 1, "tax"],
    [names.length - 1, "timeout"],
  ]);
  const spaces: TycoonSpace[] = [{ kind: "start" }];
  let timeoutSpace = -1;
  names.forEach((_, index) => {
    spaces.push({ kind: "property", property: index });
    const special = specials.get(index);
    if (special === "chance") spaces.push({ kind: "chance" });
    else if (special === "rest") { timeoutSpace = spaces.length; spaces.push({ kind: "rest" }); }
    else if (special === "tax") spaces.push({ kind: "tax" });
    else if (special === "timeout") spaces.push({ kind: "timeout" });
  });
  return { properties, spaces, timeoutSpace };
}

/** Read the Property Tycoon definition out of a project's published snapshot. */
export function propertyTycoonConfigFromSnapshot(snapshot: unknown): { config: PropertyTycoonConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];
  const lists = tools.filter(tool => tool.type === "card-list");
  const boardList = lists.filter(tool => cardListIsPropertyList(tool.name))
    .slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
  const names = boardList ? dedupe(cardTexts(boardList)).slice(0, MAX_PROPERTIES) : [];
  if (!boardList || names.length < TYCOON_MIN_PROPERTIES) {
    // pickGame surfaces the LAST module's error, so this one speaks for
    // the whole game night: all seven games, in plain words.
    return { error: `This game night needs something to play before it can be shared — add a card list with at least 5 items for Bingo, a quiz board with at least 6 questions across at least 2 categories for Quiz Board, a survey board with at least 3 questions of at least 3 answers each for Survey Showdown, two card lists for Perfect Match — one with "prompt" in its name holding at least 10 prompts and one with "answer" in its name holding at least 30 answers — a card list with "word" in its name holding at least 10 starter words for Word Chain, a card list with "draw" in its name holding at least 12 words to draw for Draw & Guess, or a card list with "property" in its name holding at least ${TYCOON_MIN_PROPERTIES} properties to trade for Property Tycoon (ask Jewel to build one), publish, then share.` };
  }
  const { properties, spaces, timeoutSpace } = tycoonBuildBoard(names);

  // The chance deck: the creator's own list when the project holds
  // one (never the board list itself), its texts paired with the
  // fixed effect rotation; otherwise the built-in cards.
  const chanceList = lists.filter(tool => tool !== boardList && cardListIsChanceList(tool.name))
    .slice().sort((a, b) => cardTexts(b).length - cardTexts(a).length)[0];
  const chanceTexts = chanceList ? dedupe(cardTexts(chanceList)).slice(0, MAX_CHANCE_CARDS) : [];
  const chanceCards: TycoonChanceCard[] = chanceTexts.length
    ? chanceTexts.map((text, index) => ({ text, effect: TYCOON_CHANCE_ROTATION[index % TYCOON_CHANCE_ROTATION.length] }))
    : TYCOON_BUILTIN_CHANCE;

  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Property Tycoon",
      properties,
      spaces,
      timeoutSpace,
      chanceCards,
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function propertyTycoonPlayerState(raw: unknown): PropertyTycoonPlayerState {
  const state = (raw || {}) as Partial<PropertyTycoonPlayerState>;
  return {
    balance: typeof state.balance === "number" && Number.isFinite(state.balance) ? Math.floor(state.balance) : TYCOON_START_BALANCE,
    position: typeof state.position === "number" && Number.isFinite(state.position) ? Math.max(0, Math.floor(state.position)) : 0,
    out: state.out === true,
    skipNext: state.skipNext === true,
  };
}

/** Whether the owner of `propertyIndex` holds every property in its
 * color set — the set bonus that doubles the rent. */
export function tycoonOwnsSet(config: PropertyTycoonConfig, owners: readonly (string | null)[], propertyIndex: number): boolean {
  const property = config.properties[propertyIndex];
  if (!property) return false;
  const owner = owners[propertyIndex];
  if (!owner) return false;
  return config.properties.every((candidate, index) => candidate.set !== property.set || owners[index] === owner);
}

/** The rent for landing on a property: a fifth of its price, rounded,
 * doubled when its owner holds the whole color set. */
export function tycoonRent(config: PropertyTycoonConfig, owners: readonly (string | null)[], propertyIndex: number): number {
  const property = config.properties[propertyIndex];
  if (!property) return 0;
  const base = Math.round(property.price / 5);
  return tycoonOwnsSet(config, owners, propertyIndex) ? base * 2 : base;
}

/** A player's net worth: what they hold in hand plus what they paid
 * for the properties they own. */
export function tycoonNetWorth(config: PropertyTycoonConfig, owners: readonly (string | null)[], playerId: string, balance: number): number {
  let worth = balance;
  config.properties.forEach((property, index) => {
    if (owners[index] === playerId) worth += property.price;
  });
  return worth;
}

/** The two dice for one roll, derived from the game's seed and the
 * roll's place in the game — the same mulberry step Perfect Match's
 * seededRng deals from, so a roll is the server's alone to make and
 * every screen agrees on it. */
export function tycoonDice(diceSeed: number, rollIndex: number): [number, number] {
  let a = ((diceSeed >>> 0) + Math.imul(rollIndex + 1, 0x9E3779B9)) | 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return [1 + Math.floor(next() * 6), 1 + Math.floor(next() * 6)];
}
