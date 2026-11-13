// The Game Night room engine (Off-Stream Multiplayer Game Night).
//
// One engine underneath every game-night format: a room is created from a
// project's frozen published snapshot, friends join by name only, and THE
// GAME RUNS ITSELF — there is no host and no host dashboard. The creator
// is a player like everyone else; the only creator-only power is pressing
// Start in the lobby (someone has to). Time-based advancement is computed
// from timestamps whenever state is read or an action lands — the ~1s
// client poll drives the game, exactly like the existing live runtime,
// so there is no background job to keep alive.
//
// This file is the pure core: it never touches the database. The store
// (lib/game-room-store.ts) maps rooms/players to the game_rooms and
// game_players tables, and the API routes under app/api/play/[token]
// load → tick/act → save on every request.
//
// Game formats plug in as modules in the registry below. A module owns
// its config extraction (from the published snapshot), its per-player
// state (cards, hands, boards…), its actions, and its finish check.

import {
  bingoConfigFromSnapshot, bingoDrawnItems, bingoPlayerState, dealBingoCard,
  bingoMarks, bingoAway, bingoHasLine, shuffle,
  type BingoConfig, type BingoPlayerState, type BingoRoomState,
} from "./bingo";

export type RoomStatus = "lobby" | "countdown" | "playing" | "finished";

export type RoomPlayer = {
  id: string;
  name: string;
  isCreator: boolean;
  ready: boolean;
  joinedAt: number;
  state: Record<string, unknown>;
};

export type Room = {
  id: string;
  token: string;
  projectId: string;
  ownerId: string;
  gameType: string;
  title: string;
  status: RoomStatus;
  snapshot: unknown;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  countdownEndsAt: number | null;
  round: number;
  createdAt: number;
};

export type Standing = {
  playerId: string;
  name: string;
  score: number;
  detail: string;
  winner: boolean;
};

export type GameAction = { type: string; [key: string]: unknown };

export interface GameModule {
  gameType: string;
  /** Read this module's game definition out of a published snapshot. */
  extractConfig(snapshot: unknown): { config: Record<string, unknown> } | { error: string };
  /** Fresh module room state for a new game (round 1 and every Play Again). */
  init(config: Record<string, unknown>): Record<string, unknown>;
  /** The game starts (countdown reached zero): set up draws, decks, turns. */
  onStart(room: Room, players: RoomPlayer[], now: number, rng: () => number): void;
  /** Give a player their module state when they join (immediately if the game is already running). */
  playerInit(room: Room, player: RoomPlayer, players: RoomPlayer[], rng: () => number): void;
  /** One module action from one player. Return an error string to refuse it. */
  onAction(room: Room, players: RoomPlayer[], player: RoomPlayer, action: GameAction, now: number): string | null;
  /** Time passing: advance anything time-based. */
  tick(room: Room, players: RoomPlayer[], now: number): void;
  /** Non-null when the game is over: the final standings, winner first. */
  checkFinish(room: Room, players: RoomPlayer[], now: number): Standing[] | null;
  /** What every player may see of the module's room state right now. */
  publicState(room: Room, players: RoomPlayer[], now: number): Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Bingo module
// ---------------------------------------------------------------------------

const bingoModule: GameModule = {
  gameType: "bingo",

  extractConfig(snapshot) {
    const result = bingoConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init() {
    const state: BingoRoomState = { drawOrder: [], startedAt: 0, winnerId: null, finishReason: null };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now, rng) {
    const config = room.config as unknown as BingoConfig;
    const state = room.state as unknown as BingoRoomState;
    state.drawOrder = shuffle(config.items.map((_, index) => index), rng);
    state.startedAt = now;
    state.winnerId = null;
    state.finishReason = null;
    for (const player of players) dealTo(room, player, players, rng);
  },

  playerInit(room, player, players, rng) {
    const state = room.state as unknown as BingoRoomState;
    player.state = bingoPlayerState(player.state) as unknown as Record<string, unknown>;
    if (state.startedAt) dealTo(room, player, players, rng);
  },

  onAction(room, players, player, action, now) {
    if (action.type !== "mark") return "That move isn't part of this game.";
    if (room.status !== "playing") return "The game isn't running right now.";
    const config = room.config as unknown as BingoConfig;
    const state = room.state as unknown as BingoRoomState;
    const mine = bingoPlayerState(player.state);
    const cell = action.cell;
    if (!Number.isInteger(cell) || (cell as number) < 0 || (cell as number) > 24) return "That square isn't on your card.";
    if (cell === 12) return "The middle square is free — it's already yours.";
    if (!mine.card.length) return "You don't have a card yet.";
    if (mine.markedCells.includes(cell as number)) return null; // already marked: a double-tap is fine
    const item = mine.card[cell as number];
    const drawn = new Set(bingoDrawnItems(config, state, now));
    if (!item || !drawn.has(item)) return "That one hasn't been called yet.";
    mine.markedCells = [...mine.markedCells, cell as number].sort((a, b) => a - b);
    player.state = mine as unknown as Record<string, unknown>;
    if (bingoHasLine(mine)) {
      state.winnerId = player.id;
      state.finishReason = "line";
    }
    return null;
  },

  tick() {
    // Bingo draws are a pure function of elapsed time — nothing to mutate.
  },

  checkFinish(room, players, now) {
    const config = room.config as unknown as BingoConfig;
    const state = room.state as unknown as BingoRoomState;
    if (!state.startedAt) return null;
    const drawn = bingoDrawnItems(config, state, now);
    // The calls run out one full interval AFTER the last item appears —
    // the final call gets its moment on screen and can still be marked.
    const exhausted = drawn.length >= config.items.length && now - state.startedAt >= config.items.length * config.drawIntervalMs;
    if (!state.winnerId && !exhausted) return null;
    if (!state.winnerId) state.finishReason = "exhausted";
    const winnerId = state.winnerId || [...players].sort((a, b) => bingoMarks(bingoPlayerState(b.state)) - bingoMarks(bingoPlayerState(a.state)))[0]?.id;
    const rows = players.map(player => {
      const mine = bingoPlayerState(player.state);
      return { player, marks: bingoMarks(mine), away: bingoAway(mine), winner: player.id === winnerId };
    });
    rows.sort((a, b) => Number(b.winner) - Number(a.winner) || b.marks - a.marks || a.away - b.away || a.player.name.localeCompare(b.player.name));
    return rows.map(row => ({
      playerId: row.player.id,
      name: row.player.name,
      score: row.marks,
      detail: row.winner && state.finishReason === "line" ? "BINGO! First to complete a line" : `${row.marks} marked`,
      winner: row.winner,
    }));
  },

  publicState(room, players, now) {
    const config = room.config as unknown as BingoConfig;
    const state = room.state as unknown as BingoRoomState;
    const drawn = bingoDrawnItems(config, state, now);
    const inGame = state.startedAt > 0 && room.status !== "finished";
    const elapsed = state.startedAt ? (now - state.startedAt) % config.drawIntervalMs : 0;
    return {
      accent: config.accent,
      theme: config.theme,
      totalItems: config.items.length,
      drawnItems: drawn,
      currentItem: drawn.length ? drawn[drawn.length - 1] : null,
      drawCount: drawn.length,
      nextDrawInMs: inGame && drawn.length < config.items.length ? config.drawIntervalMs - elapsed : null,
      progress: Object.fromEntries(players.map(player => {
        const mine = bingoPlayerState(player.state);
        return [player.id, { marks: bingoMarks(mine), away: mine.card.length ? bingoAway(mine) : null }];
      })),
    };
  },
};

/** Deal a fresh card to one player, never identical to another player's. */
function dealTo(room: Room, player: RoomPlayer, players: RoomPlayer[], rng: () => number) {
  const config = room.config as unknown as BingoConfig;
  const taken = new Set(players.filter(other => other.id !== player.id).map(other => bingoPlayerState(other.state).card.join("")));
  let card = dealBingoCard(config.items, rng);
  for (let attempt = 0; attempt < 25 && taken.has(card.join("")); attempt++) {
    card = dealBingoCard(config.items, rng);
  }
  const dealt: BingoPlayerState = { card, markedCells: [12] };
  player.state = dealt as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------

export const GAME_MODULES: Record<string, GameModule> = {
  [bingoModule.gameType]: bingoModule,
};

/** Pick the module a published snapshot can play, and extract its config. */
export function pickGame(snapshot: unknown): { gameType: string; config: Record<string, unknown> } | { error: string } {
  let firstError = "This project doesn't hold a playable game night yet.";
  for (const mod of Object.values(GAME_MODULES)) {
    const result = mod.extractConfig(snapshot);
    if ("config" in result) return { gameType: mod.gameType, config: result.config };
    firstError = result.error;
  }
  return { error: firstError };
}

// ---------------------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------------------

export const COUNTDOWN_MS = 3000;

export function newRoomState(gameType: string, config: Record<string, unknown>): Pick<Room, "status" | "state" | "round" | "countdownEndsAt"> {
  const mod = GAME_MODULES[gameType];
  return { status: "lobby", state: mod.init(config), round: 1, countdownEndsAt: null };
}

export function joinPlayer(
  room: Room,
  players: RoomPlayer[],
  input: { name: string; isCreator: boolean },
  now: number,
  rng: () => number = Math.random,
): { player: RoomPlayer; joined: boolean } | { error: string } {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Tell everyone your name first." };
  if (name.length > 24) return { error: "Names are up to 24 characters." };
  const existing = players.find(player => player.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (input.isCreator && !existing.isCreator) existing.isCreator = true;
    return { player: existing, joined: false };
  }
  if (room.status === "finished") return { error: "That game just ended — ask for a fresh link, or wait for Play Again." };
  const player: RoomPlayer = {
    id: crypto.randomUUID(),
    name,
    isCreator: input.isCreator,
    ready: false,
    joinedAt: now,
    state: {},
  };
  GAME_MODULES[room.gameType].playerInit(room, player, [...players, player], rng);
  players.push(player);
  return { player, joined: true };
}

/** Advance anything time-based. Returns true when anything changed. */
export function tickRoom(room: Room, players: RoomPlayer[], now: number, rng: () => number = Math.random): boolean {
  let changed = false;
  if (room.status === "countdown" && room.countdownEndsAt !== null && now >= room.countdownEndsAt) {
    room.status = "playing";
    room.countdownEndsAt = null;
    GAME_MODULES[room.gameType].onStart(room, players, now, rng);
    changed = true;
  }
  if (room.status === "playing") {
    GAME_MODULES[room.gameType].tick(room, players, now);
    const standings = GAME_MODULES[room.gameType].checkFinish(room, players, now);
    if (standings) {
      room.status = "finished";
      room.state = { ...room.state, standings };
      changed = true;
    }
  }
  return changed;
}

/** Apply one player's action. Returns an error string, or null on success. */
export function applyAction(
  room: Room,
  players: RoomPlayer[],
  playerId: string,
  action: GameAction,
  now: number,
  rng: () => number = Math.random,
): string | null {
  const player = players.find(candidate => candidate.id === playerId);
  if (!player) return "Join the game first.";
  const type = String(action?.type || "");

  if (type === "ready") {
    if (room.status !== "lobby") return "The game has already started.";
    player.ready = action.ready !== false;
    return null;
  }

  if (type === "start") {
    if (!player.isCreator) return "Only the game's creator can start it — everyone else, tap Ready.";
    if (room.status !== "lobby") return "The game has already started.";
    if (!players.length) return "Nobody is in the lobby yet.";
    room.status = "countdown";
    room.countdownEndsAt = now + COUNTDOWN_MS;
    return null;
  }

  if (type === "play-again") {
    if (room.status !== "finished") return "The game is still going.";
    room.round += 1;
    room.state = GAME_MODULES[room.gameType].init(room.config);
    for (const each of players) {
      each.ready = false;
      each.state = {};
    }
    room.status = "countdown";
    room.countdownEndsAt = now + COUNTDOWN_MS;
    return null;
  }

  const error = GAME_MODULES[room.gameType].onAction(room, players, player, action, now);
  if (error) return error;
  const standings = GAME_MODULES[room.gameType].checkFinish(room, players, now);
  if (standings && room.status === "playing") {
    room.status = "finished";
    room.state = { ...room.state, standings };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The view every client renders from
// ---------------------------------------------------------------------------

export function roomView(room: Room, players: RoomPlayer[], viewerId: string | null, now: number): Record<string, unknown> {
  const me = viewerId ? players.find(player => player.id === viewerId) || null : null;
  const standings = room.status === "finished" ? (room.state.standings as Standing[] | undefined) || null : null;
  return {
    title: room.title,
    gameType: room.gameType,
    status: room.status,
    round: room.round,
    countdownEndsAt: room.countdownEndsAt,
    serverNow: now,
    players: players.map(player => ({
      id: player.id,
      name: player.name,
      isCreator: player.isCreator,
      ready: player.ready,
      me: me?.id === player.id,
    })),
    game: GAME_MODULES[room.gameType].publicState(room, players, now),
    me: me ? { id: me.id, isCreator: me.isCreator, state: me.state } : null,
    standings,
  };
}
