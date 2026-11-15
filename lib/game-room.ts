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
import {
  quizConfigFromSnapshot, quizPlayerState, quizKey, quizTotalSquares, quizAnswerMatches,
  QUIZ_REVEAL_MS,
  type QuizConfig, type QuizPlayerState, type QuizRoomState,
} from "./quiz-board";
import {
  surveyConfigFromSnapshot, surveyPlayerState, surveyMatchAnswer, SURVEY_TEAMS,
  SURVEY_FACEOFF_MS, SURVEY_GUESS_MS, SURVEY_REVEAL_MS,
  type SurveyConfig, type SurveyPlayerState, type SurveyRoomState,
} from "./survey-showdown";
import {
  perfectMatchConfigFromSnapshot, perfectMatchPlayerState, perfectMatchRevealOrder, perfectMatchStartRefusal, seededRng,
  PERFECT_MATCH_HAND_SIZE, PERFECT_MATCH_WIN_POINTS, PERFECT_MATCH_REVEAL_MS,
  type PerfectMatchConfig, type PerfectMatchPlayerState, type PerfectMatchRoomState,
} from "./perfect-match";
import {
  wordChainConfigFromSnapshot, wordChainPlayerState, wordChainCheckWord,
  WORD_CHAIN_CHAIN_TARGET, WORD_CHAIN_MAX_STRIKES,
  type WordChainConfig, type WordChainPlayerState, type WordChainRoomState,
} from "./word-chain";
import {
  drawGuessConfigFromSnapshot, drawGuessPlayerState, drawGuessBlanks, drawGuessCleanStroke,
  DRAW_GUESS_DRAWS_EACH, DRAW_GUESS_GUESSER_POINTS, DRAW_GUESS_DRAWER_POINTS,
  DRAW_GUESS_MAX_STROKES, DRAW_GUESS_FEED_LIMIT, DRAW_GUESS_REVEAL_MS,
  type DrawGuessConfig, type DrawGuessPlayerState, type DrawGuessRoomState,
} from "./draw-guess";
import {
  propertyTycoonConfigFromSnapshot, propertyTycoonPlayerState, tycoonDice, tycoonRent, tycoonOwnsSet, tycoonNetWorth,
  TYCOON_START_BALANCE, TYCOON_SALARY, TYCOON_TAX, TYCOON_TURNS_EACH,
  type PropertyTycoonConfig, type PropertyTycoonPlayerState, type PropertyTycoonRoomState,
} from "./property-tycoon";

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
  /** Optional plain-words refusal when this game cannot start for the
   * players at the table — the start and play-again actions surface
   * it to the player who tapped, in the same words as any refusal. */
  startError?(room: Room, players: RoomPlayer[]): string | null;
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
// Quiz Board module
// ---------------------------------------------------------------------------

function quizStateOf(room: Room): QuizRoomState {
  return room.state as unknown as QuizRoomState;
}

function quizCurrentDef(config: QuizConfig, state: QuizRoomState): { categoryName: string; prompt: string; answer: string; value: number } | null {
  const category = config.categories[state.currentCategory];
  const question = category?.questions[state.currentQuestion];
  if (!category || !question) return null;
  return { categoryName: category.name, prompt: question.prompt, answer: question.answer, value: question.value };
}

/** Score the open question, publish the reveal, and mark the square used. */
function closeQuizQuestion(room: Room, players: RoomPlayer[], now: number): void {
  const config = room.config as unknown as QuizConfig;
  const state = quizStateOf(room);
  const current = quizCurrentDef(config, state);
  if (!current) return;
  const results = players.map(player => {
    const mine = quizPlayerState(player.state);
    const answered = mine.answerKey === state.currentKey && mine.answerText.trim().length > 0;
    const correct = answered && quizAnswerMatches(mine.answerText, current.answer);
    const delta = correct ? current.value : answered ? -current.value : 0;
    if (delta !== 0) {
      mine.score += delta;
      player.state = mine as unknown as Record<string, unknown>;
    }
    return { playerId: player.id, answered, correct, delta };
  });
  if (!state.usedKeys.includes(state.currentKey)) state.usedKeys = [...state.usedKeys, state.currentKey];
  state.lastReveal = {
    key: state.currentKey,
    categoryName: current.categoryName,
    prompt: current.prompt,
    answer: current.answer,
    value: current.value,
    results,
  };
  state.phase = "reveal";
  state.revealUntil = now + QUIZ_REVEAL_MS;
}

const quizModule: GameModule = {
  gameType: "quiz-board",

  extractConfig(snapshot) {
    const result = quizConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init() {
    const state: QuizRoomState = {
      startedAt: 0, phase: "pick", turnPlayerId: null,
      currentKey: "", currentCategory: -1, currentQuestion: -1,
      openedAt: 0, revealAt: 0, revealUntil: 0,
      usedKeys: [], lastReveal: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now) {
    const state = quizStateOf(room);
    state.startedAt = now;
    state.phase = "pick";
    state.turnPlayerId = players[0]?.id ?? null;
    state.currentKey = "";
    state.currentCategory = -1;
    state.currentQuestion = -1;
    state.usedKeys = [];
    state.lastReveal = null;
    for (const player of players) {
      const fresh: QuizPlayerState = { score: 0, answerKey: "", answerText: "" };
      player.state = fresh as unknown as Record<string, unknown>;
    }
  },

  playerInit(room, player) {
    player.state = quizPlayerState(player.state) as unknown as Record<string, unknown>;
  },

  onAction(room, players, player, action, now) {
    const config = room.config as unknown as QuizConfig;
    const state = quizStateOf(room);

    if (action.type === "pick") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase !== "pick") return "That question is still being played — hold on.";
      if (player.id !== state.turnPlayerId) {
        const turn = players.find(candidate => candidate.id === state.turnPlayerId);
        return turn ? `It's ${turn.name}'s turn to pick a square.` : "It's not your turn to pick a square.";
      }
      const category = action.category;
      const question = action.question;
      if (!Number.isInteger(category) || !Number.isInteger(question)) return "That square isn't on the board.";
      const cat = config.categories[category as number];
      const def = cat?.questions[question as number];
      if (!cat || !def) return "That square isn't on the board.";
      const key = quizKey(category as number, question as number);
      if (state.usedKeys.includes(key)) return "That square has already been played.";
      state.currentCategory = category as number;
      state.currentQuestion = question as number;
      state.currentKey = key;
      state.openedAt = now;
      state.revealAt = now + config.answerMs;
      state.phase = "answer";
      return null;
    }

    if (action.type === "answer") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase !== "answer") return "There's no open question to answer right now.";
      const mine = quizPlayerState(player.state);
      if (mine.answerKey === state.currentKey) return null; // already in: a double-tap is fine
      const text = String(action.text ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
      if (!text) return "Type your answer first.";
      mine.answerKey = state.currentKey;
      mine.answerText = text;
      player.state = mine as unknown as Record<string, unknown>;
      return null;
    }

    return "That move isn't part of this game.";
  },

  tick(room, players, now) {
    const state = quizStateOf(room);
    if (!state.startedAt) return;
    if (state.phase === "answer") {
      const everyoneIn = players.length > 0 && players.every(player => quizPlayerState(player.state).answerKey === state.currentKey);
      if (now >= state.revealAt || everyoneIn) closeQuizQuestion(room, players, now);
    }
    if (state.phase === "reveal" && now >= state.revealUntil) {
      // Hand the pick to the next player and reopen the board.
      const index = players.findIndex(candidate => candidate.id === state.turnPlayerId);
      state.turnPlayerId = players.length ? players[(index + 1) % players.length].id : null;
      state.currentKey = "";
      state.currentCategory = -1;
      state.currentQuestion = -1;
      state.phase = "pick";
    }
  },

  checkFinish(room, players) {
    const config = room.config as unknown as QuizConfig;
    const state = quizStateOf(room);
    if (!state.startedAt) return null;
    if (state.phase === "reveal") return null; // the last reveal gets its moment
    if (state.usedKeys.length < quizTotalSquares(config)) return null;
    const rows = players.map(player => ({ player, score: quizPlayerState(player.state).score }));
    const top = rows.reduce((best, row) => Math.max(best, row.score), Number.NEGATIVE_INFINITY);
    rows.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
    return rows.map(row => ({
      playerId: row.player.id,
      name: row.player.name,
      score: row.score,
      detail: row.score === top ? `${row.score} points — quiz champion` : `${row.score} points`,
      winner: row.score === top,
    }));
  },

  publicState(room, players, now) {
    const config = room.config as unknown as QuizConfig;
    const state = quizStateOf(room);
    const used = new Set(state.usedKeys);
    const current = state.phase === "answer" || state.phase === "reveal" ? quizCurrentDef(config, state) : null;
    const names = new Map(players.map(player => [player.id, player.name]));
    return {
      accent: config.accent,
      theme: config.theme,
      categories: config.categories.map((category, ci) => ({
        name: category.name,
        squares: category.questions.map((question, qi) => ({ value: question.value, used: used.has(quizKey(ci, qi)) })),
      })),
      phase: state.startedAt ? state.phase : "pick",
      turnPlayerId: state.turnPlayerId,
      turnName: state.turnPlayerId ? names.get(state.turnPlayerId) || null : null,
      current: current ? {
        key: state.currentKey,
        categoryName: current.categoryName,
        value: current.value,
        prompt: current.prompt,
        endsAt: state.phase === "answer" ? state.revealAt : null,
        answeredCount: players.filter(player => quizPlayerState(player.state).answerKey === state.currentKey).length,
        playerCount: players.length,
      } : null,
      // The answer exists in this payload ONLY at the reveal moment —
      // during the answer window it is nowhere in what players receive.
      reveal: state.phase === "reveal" && state.lastReveal ? {
        answer: state.lastReveal.answer,
        value: state.lastReveal.value,
        results: state.lastReveal.results.map(result => ({
          playerId: result.playerId,
          name: names.get(result.playerId) || "",
          answered: result.answered,
          correct: result.correct,
          delta: result.delta,
          answerText: quizPlayerState(players.find(player => player.id === result.playerId)?.state).answerText,
        })),
      } : null,
      scores: Object.fromEntries(players.map(player => [player.id, quizPlayerState(player.state).score])),
      remaining: quizTotalSquares(config) - state.usedKeys.length,
      totalSquares: quizTotalSquares(config),
    };
  },
};

// ---------------------------------------------------------------------------
// Survey Showdown module
// ---------------------------------------------------------------------------

function surveyStateOf(room: Room): SurveyRoomState {
  return room.state as unknown as SurveyRoomState;
}

function surveyConfigOf(room: Room): SurveyConfig {
  return room.config as unknown as SurveyConfig;
}

/** The next player in a team's rotation — and the rotation moves on. */
function surveyNextPlayer(state: SurveyRoomState, team: number): string | null {
  const members = state.teams[team];
  if (!members.length) return null;
  const id = members[state.cursors[team] % members.length];
  state.cursors[team] = (state.cursors[team] + 1) % members.length;
  return id;
}

function surveyOpenFaceoff(room: Room, now: number): void {
  const state = surveyStateOf(room);
  state.faceoff = [surveyNextPlayer(state, 0), surveyNextPlayer(state, 1)];
  state.slot += 1;
  state.slotEndsAt = now + SURVEY_FACEOFF_MS;
  state.guesserId = null;
}

function surveyStartQuestion(room: Room, now: number, questionIndex: number): void {
  const state = surveyStateOf(room);
  state.questionIndex = questionIndex;
  state.phase = "faceoff";
  state.revealed = [];
  state.pot = 0;
  state.strikes = 0;
  state.controlTeam = null;
  state.faceoffAttempt = 0;
  state.lastRound = null;
  surveyOpenFaceoff(room, now);
}

/** Close the round: award the pot, open the whole board for a moment. */
function surveyEndRound(room: Room, now: number, winnerTeam: number | null, stolen: boolean): void {
  const config = surveyConfigOf(room);
  const state = surveyStateOf(room);
  const question = config.questions[state.questionIndex];
  if (winnerTeam !== null) state.teamScores[winnerTeam] += state.pot;
  state.lastRound = {
    questionIndex: state.questionIndex,
    question: question ? question.question : "",
    winnerTeam,
    potAwarded: winnerTeam !== null ? state.pot : 0,
    stolen,
  };
  state.phase = "reveal";
  state.revealUntil = now + SURVEY_REVEAL_MS;
  state.guesserId = null;
}

/** Score the face-off once both answers are in (or the window ran out). */
function surveyResolveFaceoff(room: Room, players: RoomPlayer[], now: number): void {
  const config = surveyConfigOf(room);
  const state = surveyStateOf(room);
  const question = config.questions[state.questionIndex];
  if (!question || state.controlTeam !== null) return;
  const guesses = state.faceoff.map(id => {
    const player = id ? players.find(candidate => candidate.id === id) : undefined;
    const mine = player ? surveyPlayerState(player.state) : null;
    if (!mine || mine.guessSlot !== state.slot || !mine.guessText) return { match: -1, at: 0 };
    return { match: surveyMatchAnswer(mine.guessText, question, state.revealed), at: mine.guessAt };
  });
  const [first, second] = guesses;
  if (first.match < 0 && second.match < 0) {
    // Nobody found the board: the next pair steps up. Once every player
    // has had a face-off try, the question is skipped with no points.
    state.faceoffAttempt += 1;
    const attempts = Math.max(state.teams[0].length, state.teams[1].length, 1);
    if (state.faceoffAttempt >= attempts) { surveyEndRound(room, now, null, false); return; }
    surveyOpenFaceoff(room, now);
    return;
  }
  const matched = new Set<number>();
  if (first.match >= 0) matched.add(first.match);
  if (second.match >= 0) matched.add(second.match);
  for (const index of matched) {
    state.revealed = [...state.revealed, index];
    state.pot += question.answers[index].points;
  }
  state.revealed.sort((a, b) => a - b);
  let winner: number;
  if (first.match >= 0 && second.match >= 0) {
    // The higher answer on the board wins; the same answer goes to
    // whoever said it first.
    winner = first.match === second.match ? (first.at <= second.at ? 0 : 1) : (first.match < second.match ? 0 : 1);
  } else {
    winner = first.match >= 0 ? 0 : 1;
  }
  state.controlTeam = winner;
  state.phase = "play";
  state.guesserId = surveyNextPlayer(state, winner);
  state.slot += 1;
  state.slotEndsAt = now + SURVEY_GUESS_MS;
  if (!state.guesserId) surveyEndRound(room, now, winner, false);
}

/** One controlling-team guess (an empty text is a timed-out guess). */
function surveyResolvePlayGuess(room: Room, now: number, text: string): void {
  const config = surveyConfigOf(room);
  const state = surveyStateOf(room);
  const question = config.questions[state.questionIndex];
  if (!question || state.controlTeam === null) return;
  const control = state.controlTeam;
  const match = text ? surveyMatchAnswer(text, question, state.revealed) : -1;
  if (match >= 0) {
    state.revealed = [...state.revealed, match].sort((a, b) => a - b);
    state.pot += question.answers[match].points;
    if (state.revealed.length >= question.answers.length) { surveyEndRound(room, now, control, false); return; }
  } else {
    state.strikes += 1;
    if (state.strikes >= 3) {
      const other = control === 0 ? 1 : 0;
      const stealer = surveyNextPlayer(state, other);
      if (!stealer) { surveyEndRound(room, now, control, false); return; }
      state.phase = "steal";
      state.guesserId = stealer;
      state.slot += 1;
      state.slotEndsAt = now + SURVEY_GUESS_MS;
      return;
    }
  }
  state.guesserId = surveyNextPlayer(state, control);
  state.slot += 1;
  state.slotEndsAt = now + SURVEY_GUESS_MS;
  if (!state.guesserId) surveyEndRound(room, now, control, false);
}

/** The steal: one guess from the other team for the whole pot. */
function surveyResolveStealGuess(room: Room, now: number, text: string): void {
  const config = surveyConfigOf(room);
  const state = surveyStateOf(room);
  const question = config.questions[state.questionIndex];
  if (!question || state.controlTeam === null) return;
  const control = state.controlTeam;
  const other = control === 0 ? 1 : 0;
  const match = text ? surveyMatchAnswer(text, question, state.revealed) : -1;
  if (match >= 0) {
    state.revealed = [...state.revealed, match].sort((a, b) => a - b);
    state.pot += question.answers[match].points;
    surveyEndRound(room, now, other, true);
  } else {
    surveyEndRound(room, now, control, false);
  }
}

const surveyModule: GameModule = {
  gameType: "survey-showdown",

  extractConfig(snapshot) {
    const result = surveyConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init() {
    const state: SurveyRoomState = {
      startedAt: 0, phase: "faceoff",
      teams: [[], []], cursors: [0, 0],
      questionIndex: 0, revealed: [], pot: 0, strikes: 0, controlTeam: null,
      faceoff: [null, null], faceoffAttempt: 0, slot: 0, slotEndsAt: 0,
      guesserId: null, teamScores: [0, 0], revealUntil: 0, lastRound: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now) {
    const state = surveyStateOf(room);
    state.startedAt = now;
    state.teams = [[], []];
    state.cursors = [0, 0];
    state.teamScores = [0, 0];
    players.forEach((player, index) => {
      const team = index % 2;
      state.teams[team].push(player.id);
      const fresh: SurveyPlayerState = { team, guessSlot: -1, guessText: "", guessAt: 0 };
      player.state = fresh as unknown as Record<string, unknown>;
    });
    surveyStartQuestion(room, now, 0);
  },

  playerInit(room, player) {
    const state = surveyStateOf(room);
    const mine = surveyPlayerState(player.state);
    if (state.startedAt) {
      // A late joiner is dealt into the smaller team, at the end of its
      // rotation — the game never waits for a host to place them.
      if (!state.teams[0].includes(player.id) && !state.teams[1].includes(player.id)) {
        const team = state.teams[0].length <= state.teams[1].length ? 0 : 1;
        state.teams[team] = [...state.teams[team], player.id];
      }
      mine.team = state.teams[1].includes(player.id) ? 1 : 0;
    }
    player.state = mine as unknown as Record<string, unknown>;
  },

  onAction(room, players, player, action, now) {
    if (action.type !== "guess") return "That move isn't part of this game.";
    if (room.status !== "playing") return "The game isn't running right now.";
    const state = surveyStateOf(room);
    const text = String(action.text ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!text) return "Type your answer first.";

    if (state.phase === "faceoff") {
      if (!state.faceoff.includes(player.id)) return "This face-off belongs to the two players up front — your turn comes around.";
      const mine = surveyPlayerState(player.state);
      if (mine.guessSlot === state.slot && mine.guessText) return null; // already in: a double-tap is fine
      mine.guessSlot = state.slot;
      mine.guessText = text;
      mine.guessAt = now;
      player.state = mine as unknown as Record<string, unknown>;
      return null;
    }

    if (state.phase === "play" || state.phase === "steal") {
      if (player.id !== state.guesserId) {
        const turn = players.find(candidate => candidate.id === state.guesserId);
        return turn ? `It's ${turn.name}'s guess — yours comes around.` : "It's not your guess right now.";
      }
      if (state.phase === "play") surveyResolvePlayGuess(room, now, text);
      else surveyResolveStealGuess(room, now, text);
      return null;
    }

    return "Hold on — there's no guess to make right now.";
  },

  tick(room, players, now) {
    const config = surveyConfigOf(room);
    const state = surveyStateOf(room);
    if (!state.startedAt) return;
    if (state.phase === "faceoff") {
      const bothIn = state.faceoff.every(id => {
        if (!id) return true;
        const player = players.find(candidate => candidate.id === id);
        const mine = player ? surveyPlayerState(player.state) : null;
        return !!mine && mine.guessSlot === state.slot && mine.guessText.length > 0;
      });
      if (bothIn || now >= state.slotEndsAt) surveyResolveFaceoff(room, players, now);
    } else if (state.phase === "play") {
      if (now >= state.slotEndsAt) surveyResolvePlayGuess(room, now, "");
    } else if (state.phase === "steal") {
      if (now >= state.slotEndsAt) surveyResolveStealGuess(room, now, "");
    } else if (state.phase === "reveal") {
      if (now >= state.revealUntil) {
        if (state.questionIndex + 1 < config.questions.length) surveyStartQuestion(room, now, state.questionIndex + 1);
        else state.phase = "done";
      }
    }
  },

  checkFinish(room, players) {
    const state = surveyStateOf(room);
    if (!state.startedAt || state.phase !== "done") return null;
    const [gold, teal] = state.teamScores;
    const top = Math.max(gold, teal);
    const rows = players.map(player => {
      const team = state.teams[1].includes(player.id) ? 1 : 0;
      return { player, team, score: state.teamScores[team], winner: state.teamScores[team] === top };
    });
    rows.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
    return rows.map(row => ({
      playerId: row.player.id,
      name: row.player.name,
      score: row.score,
      detail: row.winner
        ? (gold === teal ? `${SURVEY_TEAMS[row.team].name} · ${row.score} points — a tied game!` : `${SURVEY_TEAMS[row.team].name} · ${row.score} points — champions!`)
        : `${SURVEY_TEAMS[row.team].name} · ${row.score} points`,
      winner: row.winner,
    }));
  },

  publicState(room, players) {
    const config = surveyConfigOf(room);
    const state = surveyStateOf(room);
    const names = new Map(players.map(player => [player.id, player.name]));
    const question = config.questions[state.questionIndex] || null;
    const roundOver = state.phase === "reveal" || state.phase === "done";
    const revealed = new Set(state.revealed);
    const submitted = (id: string | null) => {
      if (!id) return false;
      const player = players.find(candidate => candidate.id === id);
      const mine = player ? surveyPlayerState(player.state) : null;
      return !!mine && mine.guessSlot === state.slot && mine.guessText.length > 0;
    };
    return {
      accent: config.accent,
      theme: config.theme,
      teams: SURVEY_TEAMS.map((team, index) => ({
        name: team.name,
        color: team.color,
        score: state.teamScores[index],
        members: (state.teams[index] || []).map(id => ({ id, name: names.get(id) || "" })),
        control: state.controlTeam === index && (state.phase === "play" || state.phase === "steal"),
      })),
      stage: state.startedAt ? state.phase : "faceoff",
      questionIndex: state.questionIndex,
      questionCount: config.questions.length,
      question: question ? question.question : null,
      // A covered slot shows only its rank. Its answer and points exist
      // in this payload ONLY once the slot has flipped open — or when
      // the round ends and the whole board opens.
      board: question ? question.answers.map((answer, index) => {
        const open = roundOver || revealed.has(index);
        return open
          ? { rank: index + 1, open: true, text: answer.text, points: answer.points }
          : { rank: index + 1, open: false };
      }) : [],
      pot: state.pot,
      strikes: state.strikes,
      controlTeam: state.controlTeam,
      faceoff: state.phase === "faceoff" ? {
        playerIds: state.faceoff,
        names: state.faceoff.map(id => (id ? names.get(id) || null : null)),
        endsAt: state.slotEndsAt,
        submitted: state.faceoff.map(id => submitted(id)),
      } : null,
      guesser: (state.phase === "play" || state.phase === "steal") && state.guesserId ? {
        playerId: state.guesserId,
        name: names.get(state.guesserId) || null,
        team: state.teams[1].includes(state.guesserId) ? 1 : 0,
        endsAt: state.slotEndsAt,
      } : null,
      lastRound: state.phase === "reveal" && state.lastRound ? {
        winnerTeam: state.lastRound.winnerTeam,
        winnerName: state.lastRound.winnerTeam !== null ? SURVEY_TEAMS[state.lastRound.winnerTeam].name : null,
        potAwarded: state.lastRound.potAwarded,
        stolen: state.lastRound.stolen,
      } : null,
    };
  },
};

// ---------------------------------------------------------------------------
// Perfect Match module
// ---------------------------------------------------------------------------

function matchStateOf(room: Room): PerfectMatchRoomState {
  return room.state as unknown as PerfectMatchRoomState;
}

function matchConfigOf(room: Room): PerfectMatchConfig {
  return room.config as unknown as PerfectMatchConfig;
}

function matchCurrentPrompt(config: PerfectMatchConfig, state: PerfectMatchRoomState): string | null {
  const index = state.promptOrder[state.promptIndex];
  return index === undefined ? null : config.prompts[index] ?? null;
}

/** Draw one card for a refill, reshuffling the discard pile back in
 * when the draw pile runs dry (played cards are the only discards, and
 * they only reach the pile once their round is over). */
function matchDraw(state: PerfectMatchRoomState): string | null {
  if (!state.drawPile.length && state.discard.length) {
    state.drawPile = shuffle(state.discard, seededRng(state.revealSeed + state.roundNumber * 31 + 1000));
    state.discard = [];
  }
  return state.drawPile.pop() ?? null;
}

/** Deal up to the hand size, round-robin, from the draw pile. */
function matchDealHand(state: PerfectMatchRoomState, mine: PerfectMatchPlayerState): void {
  while (mine.hand.length < state.handSize) {
    const card = matchDraw(state);
    if (!card) break;
    mine.hand.push(card);
  }
}

/** The submit window closes: freeze the submissions into their
 * shuffled, anonymous reveal order and hand the round to the judge.
 * A round nobody played skips straight to its (pointless) reveal. */
function matchCloseSubmissions(room: Room, now: number): void {
  const config = matchConfigOf(room);
  const state = matchStateOf(room);
  state.lastRound = {
    prompt: matchCurrentPrompt(config, state) || "",
    judgeId: state.judgeId,
    winnerId: null,
    winningCard: null,
  };
  if (!state.submissions.length) {
    state.revealed = [];
    state.phase = "reveal";
    state.revealUntil = now + PERFECT_MATCH_REVEAL_MS;
    return;
  }
  state.revealed = perfectMatchRevealOrder(state.submissions, state.revealSeed, state.roundNumber);
  state.phase = "judge";
}

/** The reveal moment ends: bank the played cards, then either finish
 * (someone reached the winning count, or the prompts ran out) or deal
 * the next round — hands refilled, judge rotated, next prompt up. */
function matchAdvanceRound(room: Room, players: RoomPlayer[], now: number): void {
  const config = matchConfigOf(room);
  const state = matchStateOf(room);
  state.discard = [...state.discard, ...state.submissions.map(entry => entry.card)];
  state.submissions = [];
  state.revealed = [];
  const topScore = players.reduce((best, player) => Math.max(best, perfectMatchPlayerState(player.state).score), 0);
  const promptsLeft = state.promptOrder.length - (state.promptIndex + 1);
  if (topScore >= PERFECT_MATCH_WIN_POINTS || promptsLeft <= 0) {
    state.phase = "done";
    return;
  }
  state.promptIndex += 1;
  state.roundNumber += 1;
  if (state.rotation.length) {
    state.judgeIndex = (state.judgeIndex + 1) % state.rotation.length;
    state.judgeId = state.rotation[state.judgeIndex];
  }
  for (const player of players) {
    const mine = perfectMatchPlayerState(player.state);
    mine.submittedCard = "";
    matchDealHand(state, mine);
    player.state = mine as unknown as Record<string, unknown>;
  }
  state.roundEndsAt = now + config.submitMs;
  state.phase = "submit";
}

const perfectMatchModule: GameModule = {
  gameType: "perfect-match",

  extractConfig(snapshot) {
    const result = perfectMatchConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init() {
    const state: PerfectMatchRoomState = {
      startedAt: 0, phase: "submit", roundNumber: 1,
      handSize: PERFECT_MATCH_HAND_SIZE, rotation: [], judgeIndex: 0, judgeId: null,
      promptOrder: [], promptIndex: 0, drawPile: [], discard: [],
      submissions: [], revealed: [], roundEndsAt: 0, revealUntil: 0,
      revealSeed: 0, lastRound: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now, rng) {
    const config = matchConfigOf(room);
    const state = matchStateOf(room);
    state.startedAt = now;
    state.phase = "submit";
    state.roundNumber = 1;
    state.rotation = players.map(player => player.id);
    state.judgeIndex = 0;
    state.judgeId = state.rotation[0] ?? null;
    state.promptOrder = shuffle(config.prompts.map((_, index) => index), rng);
    state.promptIndex = 0;
    state.drawPile = shuffle(config.answers, rng);
    state.discard = [];
    state.submissions = [];
    state.revealed = [];
    state.lastRound = null;
    state.revealSeed = Math.floor(rng() * 1_000_000_000);
    // Hands of 7 while the deck covers them; a smaller deck deals
    // smaller hands evenly rather than leaving late seats empty. The
    // start gate (startError) has already refused any table the deck
    // cannot seat with a full personal hand at the floor, so this
    // division covers the floor on the normal path; the max(1, …)
    // only guards a table that grew during the countdown seconds —
    // and even then the deal is even and without replacement, never
    // a duplicated card.
    state.handSize = players.length
      ? Math.max(1, Math.min(PERFECT_MATCH_HAND_SIZE, Math.floor(config.answers.length / players.length)))
      : PERFECT_MATCH_HAND_SIZE;
    for (const player of players) {
      const fresh: PerfectMatchPlayerState = { score: 0, hand: [], submittedRound: 0, submittedCard: "" };
      player.state = fresh as unknown as Record<string, unknown>;
    }
    for (let round = 0; round < state.handSize; round++) {
      for (const player of players) {
        const card = state.drawPile.pop();
        if (!card) break;
        const mine = perfectMatchPlayerState(player.state);
        mine.hand.push(card);
        player.state = mine as unknown as Record<string, unknown>;
      }
    }
    state.roundEndsAt = now + config.submitMs;
  },

  startError(room, players) {
    // Every player is dealt their own hand from the one deck, without
    // replacement — a table the deck cannot seat at the floor hand is
    // refused in plain words rather than dealt short or shared hands.
    return perfectMatchStartRefusal(matchConfigOf(room).answers.length, players.length);
  },

  playerInit(room, player) {
    const state = matchStateOf(room);
    const mine = perfectMatchPlayerState(player.state);
    if (state.startedAt && !state.rotation.includes(player.id)) {
      // A late joiner takes the next seat in the judge rotation and is
      // dealt a hand from what's left — the game never waits on a host.
      // If the deck is momentarily dry (every card is in a hand or on
      // the table) the deal gives them nothing: they watch this game
      // out without holding the table up, and the next game deals
      // them in fresh — never a borrowed or duplicated card.
      matchDealHand(state, mine);
      if (mine.hand.length) {
        state.rotation = [...state.rotation, player.id];
        if (!state.judgeId) state.judgeId = player.id;
      }
    }
    player.state = mine as unknown as Record<string, unknown>;
  },

  onAction(room, players, player, action, now) {
    const state = matchStateOf(room);

    if (action.type === "submit") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase === "judge") return "The cards are already in — the judge is picking.";
      if (state.phase !== "submit") return "Hold on — the judge is still looking at the last round.";
      if (player.id === state.judgeId) return "You're the judge this round — your job is picking the winner, not playing a card.";
      const mine = perfectMatchPlayerState(player.state);
      if (mine.submittedRound === state.roundNumber) return null; // already in: a double-tap is fine
      const card = String(action.card ?? "").trim();
      const index = mine.hand.indexOf(card);
      if (!card || index < 0) return "That card isn't in your hand.";
      mine.hand.splice(index, 1);
      mine.submittedRound = state.roundNumber;
      mine.submittedCard = card;
      player.state = mine as unknown as Record<string, unknown>;
      state.submissions = [...state.submissions, { playerId: player.id, card }];
      return null;
    }

    if (action.type === "pick") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase !== "judge") return "There's nothing to pick yet — the cards are still coming in.";
      if (player.id !== state.judgeId) {
        const judge = players.find(candidate => candidate.id === state.judgeId);
        return judge ? `${judge.name} is the judge this round — the pick is theirs.` : "The pick belongs to this round's judge.";
      }
      const index = action.index;
      if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= state.revealed.length) return "That card isn't on the table.";
      const winning = state.revealed[index as number];
      const winner = players.find(candidate => candidate.id === winning.playerId);
      if (winner) {
        const winnerState = perfectMatchPlayerState(winner.state);
        winnerState.score += 1;
        winner.state = winnerState as unknown as Record<string, unknown>;
      }
      state.lastRound = {
        prompt: matchCurrentPrompt(matchConfigOf(room), state) || "",
        judgeId: state.judgeId,
        winnerId: winning.playerId,
        winningCard: winning.card,
      };
      state.phase = "reveal";
      state.revealUntil = now + PERFECT_MATCH_REVEAL_MS;
      return null;
    }

    return "That move isn't part of this game.";
  },

  tick(room, players, now) {
    const state = matchStateOf(room);
    if (!state.startedAt) return;
    if (state.phase === "submit") {
      // Only seated players hold the round open — a late joiner still
      // waiting for the deck to deal them in never stalls the table
      // (publicState's waitingOn already counts the same seats).
      const inRotation = new Set(state.rotation);
      const waiting = players.filter(player => player.id !== state.judgeId && inRotation.has(player.id))
        .every(player => perfectMatchPlayerState(player.state).submittedRound === state.roundNumber);
      if (waiting || now >= state.roundEndsAt) matchCloseSubmissions(room, now);
    } else if (state.phase === "reveal") {
      if (now >= state.revealUntil) matchAdvanceRound(room, players, now);
    }
  },

  checkFinish(room, players) {
    const state = matchStateOf(room);
    if (!state.startedAt || state.phase !== "done") return null;
    const rows = players.map(player => ({ player, score: perfectMatchPlayerState(player.state).score }));
    const top = rows.reduce((best, row) => Math.max(best, row.score), Number.NEGATIVE_INFINITY);
    rows.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
    return rows.map(row => ({
      playerId: row.player.id,
      name: row.player.name,
      score: row.score,
      detail: row.score === top ? `${row.score} winning cards — Perfect Match champion` : `${row.score} winning cards`,
      winner: row.score === top,
    }));
  },

  publicState(room, players) {
    const config = matchConfigOf(room);
    const state = matchStateOf(room);
    const names = new Map(players.map(player => [player.id, player.name]));
    const inRotation = new Set(state.rotation);
    return {
      accent: config.accent,
      theme: config.theme,
      matchStage: state.startedAt ? state.phase : "submit",
      prompt: state.startedAt ? matchCurrentPrompt(config, state) : null,
      promptNumber: state.promptIndex + 1,
      promptCount: config.prompts.length,
      judgeId: state.judgeId,
      judgeName: state.judgeId ? names.get(state.judgeId) || null : null,
      endsAt: state.phase === "submit" && state.startedAt ? state.roundEndsAt : null,
      winPoints: PERFECT_MATCH_WIN_POINTS,
      handCounts: Object.fromEntries(players.map(player => [player.id, perfectMatchPlayerState(player.state).hand.length])),
      scores: Object.fromEntries(players.map(player => [player.id, perfectMatchPlayerState(player.state).score])),
      submittedIds: state.submissions.map(entry => entry.playerId),
      waitingOn: state.startedAt && state.phase === "submit"
        ? players.filter(player => player.id !== state.judgeId && inRotation.has(player.id) && perfectMatchPlayerState(player.state).submittedRound !== state.roundNumber).length
        : 0,
      // The revealed cards carry ONLY their text while the judge is
      // picking — whose card is whose exists nowhere in this payload
      // until the pick is made and the winner is named in the reveal.
      revealedCards: state.phase === "judge"
        ? state.revealed.map(entry => ({ text: entry.card }))
        : state.phase === "reveal"
          ? state.revealed.map(entry => ({
            text: entry.card,
            ownerId: entry.playerId,
            ownerName: names.get(entry.playerId) || "",
            winner: !!state.lastRound && entry.playerId === state.lastRound.winnerId && entry.card === state.lastRound.winningCard,
          }))
          : [],
      lastRound: state.phase === "reveal" && state.lastRound ? {
        prompt: state.lastRound.prompt,
        winnerId: state.lastRound.winnerId,
        winnerName: state.lastRound.winnerId ? names.get(state.lastRound.winnerId) || null : null,
        winningCard: state.lastRound.winningCard,
        judgeName: state.lastRound.judgeId ? names.get(state.lastRound.judgeId) || null : null,
      } : null,
    };
  },
};

// ---------------------------------------------------------------------------
// Word Chain module
// ---------------------------------------------------------------------------

function chainStateOf(room: Room): WordChainRoomState {
  return room.state as unknown as WordChainRoomState;
}

function chainConfigOf(room: Room): WordChainConfig {
  return room.config as unknown as WordChainConfig;
}

function chainPlayer(player: RoomPlayer): WordChainPlayerState {
  return wordChainPlayerState(player.state);
}

function saveChainPlayer(player: RoomPlayer, mine: WordChainPlayerState): void {
  player.state = mine as unknown as Record<string, unknown>;
}

/** Players still in the chain, in join order. */
function chainAlive(players: RoomPlayer[]): RoomPlayer[] {
  return players.filter(player => !chainPlayer(player).out);
}

/** Hand the turn to the next player still in, scanning in join order. */
function chainAdvanceTurn(room: Room, players: RoomPlayer[], now: number): void {
  const state = chainStateOf(room);
  const alive = chainAlive(players);
  if (!alive.length) { state.turnPlayerId = null; return; }
  const index = players.findIndex(candidate => candidate.id === state.turnPlayerId);
  for (let step = 1; step <= players.length; step++) {
    const next = players[(index + step) % players.length];
    if (next && !chainPlayer(next).out) {
      state.turnPlayerId = next.id;
      state.turnNumber += 1;
      state.turnEndsAt = now + chainConfigOf(room).turnMs;
      return;
    }
  }
  state.turnPlayerId = alive[0].id;
  state.turnNumber += 1;
  state.turnEndsAt = now + chainConfigOf(room).turnMs;
}

/** One strike against a player; the second puts them out of the chain. */
function chainStrike(room: Room, player: RoomPlayer): void {
  const state = chainStateOf(room);
  const mine = chainPlayer(player);
  mine.strikes += 1;
  if (mine.strikes >= WORD_CHAIN_MAX_STRIKES && !mine.out) {
    mine.out = true;
    mine.outAt = state.chain.length;
  }
  saveChainPlayer(player, mine);
}

const wordChainModule: GameModule = {
  gameType: "word-chain",

  extractConfig(snapshot) {
    const result = wordChainConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init() {
    const state: WordChainRoomState = {
      startedAt: 0, phase: "play",
      starterOrder: [], starterIndex: 0,
      chain: [], turnPlayerId: null, turnEndsAt: 0, turnNumber: 0,
      lastPlay: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now, rng) {
    const config = chainConfigOf(room);
    const state = chainStateOf(room);
    state.startedAt = now;
    state.phase = "play";
    state.starterOrder = shuffle(config.starters.map((_, index) => index), rng);
    state.starterIndex = 0;
    const starter = config.starters[state.starterOrder[0]] ?? config.starters[0] ?? "";
    state.chain = starter ? [starter] : [];
    state.lastPlay = null;
    for (const player of players) {
      const fresh: WordChainPlayerState = { strikes: 0, out: false, outAt: null, added: 0 };
      saveChainPlayer(player, fresh);
    }
    state.turnPlayerId = players[0]?.id ?? null;
    state.turnNumber = 1;
    state.turnEndsAt = now + config.turnMs;
  },

  playerInit(room, player) {
    // A late joiner takes the next seat in the turn order with a clean
    // slate — the chain never waits for a host to place them. If the
    // turn somehow points nowhere (everyone ahead went out), the new
    // seat picks it up.
    const state = chainStateOf(room);
    saveChainPlayer(player, chainPlayer(player));
    if (state.startedAt && !state.turnPlayerId) {
      state.turnPlayerId = player.id;
      state.turnNumber += 1;
      state.turnEndsAt = Date.now() + chainConfigOf(room).turnMs;
    }
  },

  onAction(room, players, player, action, now) {
    if (action.type !== "play") return "That move isn't part of this game.";
    if (room.status !== "playing") return "The game isn't running right now.";
    const state = chainStateOf(room);
    if (state.phase !== "play") return "The chain is finished.";
    if (chainPlayer(player).out) return "You're out of this chain — two strikes. You can watch it finish!";
    if (player.id !== state.turnPlayerId) {
      const turn = players.find(candidate => candidate.id === state.turnPlayerId);
      return turn ? `It's ${turn.name}'s turn — yours comes around.` : "It's not your turn right now.";
    }
    const raw = String(action.text ?? "");
    if (!raw.trim()) return "Type your word first.";
    const check = wordChainCheckWord(raw, state.chain);
    if (!check.ok) {
      // A submitted word that breaks a rule is a played move, not a
      // refused one: it earns its strike and the turn moves on.
      chainStrike(room, player);
      state.lastPlay = { playerId: player.id, word: raw.trim().slice(0, 60), result: check.result };
      chainAdvanceTurn(room, players, now);
      return null;
    }
    state.chain = [...state.chain, check.word];
    const mine = chainPlayer(player);
    mine.added += 1;
    saveChainPlayer(player, mine);
    state.lastPlay = { playerId: player.id, word: check.word, result: "in" };
    chainAdvanceTurn(room, players, now);
    return null;
  },

  tick(room, players, now) {
    const state = chainStateOf(room);
    if (!state.startedAt || state.phase !== "play") return;
    if (!state.turnPlayerId || now < state.turnEndsAt) return;
    const turn = players.find(candidate => candidate.id === state.turnPlayerId);
    if (!turn || chainPlayer(turn).out) { chainAdvanceTurn(room, players, now); return; }
    // The clock ran out on this seat: a strike, and the chain moves on.
    chainStrike(room, turn);
    state.lastPlay = { playerId: turn.id, word: "", result: "timeout" };
    chainAdvanceTurn(room, players, now);
  },

  checkFinish(room, players) {
    const state = chainStateOf(room);
    if (!state.startedAt) return null;
    const alive = chainAlive(players);
    const chainFull = state.chain.length >= WORD_CHAIN_CHAIN_TARGET;
    if (!chainFull && alive.length > 1) return null;
    if (!players.length) return null;
    state.phase = "done";
    const rows = players.map(player => ({ player, mine: chainPlayer(player) }));
    rows.sort((a, b) => {
      // Still in before out; among the standing, fewest strikes first;
      // among the out, whoever lasted longest (went out latest) first.
      if (a.mine.out !== b.mine.out) return a.mine.out ? 1 : -1;
      if (!a.mine.out && a.mine.strikes !== b.mine.strikes) return a.mine.strikes - b.mine.strikes;
      if (a.mine.out && b.mine.out && (a.mine.outAt ?? 0) !== (b.mine.outAt ?? 0)) return (b.mine.outAt ?? 0) - (a.mine.outAt ?? 0);
      if (a.mine.added !== b.mine.added) return b.mine.added - a.mine.added;
      return a.player.name.localeCompare(b.player.name);
    });
    return rows.map(row => {
      const standing = !row.mine.out;
      const winner = chainFull ? standing : row === rows[0];
      return {
        playerId: row.player.id,
        name: row.player.name,
        score: row.mine.added,
        detail: chainFull
          ? (standing ? `Finished the ${WORD_CHAIN_CHAIN_TARGET}-word chain · added ${row.mine.added}` : `Out at word ${row.mine.outAt ?? 0} · added ${row.mine.added}`)
          : (winner ? `Last one standing · added ${row.mine.added}` : `Out at word ${row.mine.outAt ?? 0} · added ${row.mine.added}`),
        winner,
      };
    });
  },

  publicState(room, players) {
    const config = chainConfigOf(room);
    const state = chainStateOf(room);
    const names = new Map(players.map(player => [player.id, player.name]));
    return {
      accent: config.accent,
      theme: config.theme,
      chainStage: state.startedAt ? state.phase : "play",
      chain: state.startedAt ? state.chain : [],
      currentWord: state.chain.length ? state.chain[state.chain.length - 1] : null,
      chainLength: state.chain.length,
      chainTarget: WORD_CHAIN_CHAIN_TARGET,
      turnPlayerId: state.startedAt ? state.turnPlayerId : null,
      turnName: state.turnPlayerId ? names.get(state.turnPlayerId) || null : null,
      turnEndsAt: state.startedAt && state.phase === "play" ? state.turnEndsAt : null,
      turnNumber: state.turnNumber,
      maxStrikes: WORD_CHAIN_MAX_STRIKES,
      wordPlayers: Object.fromEntries(players.map(player => {
        const mine = chainPlayer(player);
        return [player.id, { strikes: mine.strikes, out: mine.out, added: mine.added }];
      })),
      lastPlay: state.lastPlay ? {
        playerId: state.lastPlay.playerId,
        name: names.get(state.lastPlay.playerId) || "",
        word: state.lastPlay.word,
        result: state.lastPlay.result,
      } : null,
    };
  },
};

// ---------------------------------------------------------------------------
// Draw & Guess module
// ---------------------------------------------------------------------------

function drawStateOf(room: Room): DrawGuessRoomState {
  return room.state as unknown as DrawGuessRoomState;
}

function drawConfigOf(room: Room): DrawGuessConfig {
  return room.config as unknown as DrawGuessConfig;
}

function drawPlayer(player: RoomPlayer): DrawGuessPlayerState {
  return drawGuessPlayerState(player.state);
}

function saveDrawPlayer(player: RoomPlayer, mine: DrawGuessPlayerState): void {
  player.state = mine as unknown as Record<string, unknown>;
}

/** Open a round: seat the drawer, hand them their word through their
 * own player state ONLY, and start with a blank canvas. */
function drawBeginRound(room: Room, players: RoomPlayer[], now: number): void {
  const config = drawConfigOf(room);
  const state = drawStateOf(room);
  state.drawerId = state.rotation[state.drawerIndex] ?? null;
  const wordIndex = state.wordOrder[state.wordIndex];
  state.currentWord = wordIndex === undefined ? "" : config.words[wordIndex] ?? "";
  state.strokes = [];
  state.guesses = [];
  state.roundEndsAt = now + config.roundMs;
  state.phase = "draw";
  if (state.drawerId) state.drawsTaken[state.drawerId] = (state.drawsTaken[state.drawerId] || 0) + 1;
  for (const player of players) {
    const mine = drawPlayer(player);
    mine.drawWord = player.id === state.drawerId ? state.currentWord : "";
    saveDrawPlayer(player, mine);
  }
}

/** Close the running round: the word becomes everyone's to see, and
 * the private copy leaves the drawer's state. */
function drawEndRound(room: Room, players: RoomPlayer[], now: number, guesserId: string | null): void {
  const state = drawStateOf(room);
  state.lastRound = { word: state.currentWord, drawerId: state.drawerId, guesserId };
  state.phase = "reveal";
  state.revealUntil = now + DRAW_GUESS_REVEAL_MS;
  for (const player of players) {
    const mine = drawPlayer(player);
    if (mine.drawWord) {
      mine.drawWord = "";
      saveDrawPlayer(player, mine);
    }
  }
}

/** The reveal moment ends: either the game is over (the words ran
 * out, or every player has had their two turns at the easel) or the
 * next drawer in the rotation takes the next word. */
function drawAdvanceRound(room: Room, players: RoomPlayer[], now: number): void {
  const state = drawStateOf(room);
  state.wordIndex += 1;
  let next = -1;
  for (let step = 1; step <= state.rotation.length; step++) {
    const index = (state.drawerIndex + step) % state.rotation.length;
    const id = state.rotation[index];
    if (id && (state.drawsTaken[id] || 0) < DRAW_GUESS_DRAWS_EACH) { next = index; break; }
  }
  if (next < 0 || state.wordIndex >= state.wordOrder.length) {
    state.phase = "done";
    state.drawerId = null;
    return;
  }
  state.drawerIndex = next;
  drawBeginRound(room, players, now);
}

const drawGuessModule: GameModule = {
  gameType: "draw-guess",

  extractConfig(snapshot) {
    const result = drawGuessConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init() {
    const state: DrawGuessRoomState = {
      startedAt: 0, phase: "draw",
      wordOrder: [], wordIndex: 0,
      rotation: [], drawerIndex: 0, drawerId: null,
      drawsTaken: {}, currentWord: "",
      strokes: [], guesses: [],
      roundEndsAt: 0, revealUntil: 0, lastRound: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now, rng) {
    const config = drawConfigOf(room);
    const state = drawStateOf(room);
    state.startedAt = now;
    state.wordOrder = shuffle(config.words.map((_, index) => index), rng);
    state.wordIndex = 0;
    state.rotation = players.map(player => player.id);
    state.drawerIndex = 0;
    state.drawsTaken = {};
    state.lastRound = null;
    for (const player of players) saveDrawPlayer(player, { score: 0, drawWord: "" });
    if (players.length) drawBeginRound(room, players, now);
  },

  playerInit(room, player) {
    const state = drawStateOf(room);
    if (state.startedAt && !state.rotation.includes(player.id)) {
      // A late joiner takes the next seat in the drawing rotation —
      // the game never waits for a host to place them.
      state.rotation = [...state.rotation, player.id];
    }
    // A fresh seat never holds the word: only the seated drawer's own
    // state carries it, and only while their round runs.
    const mine = drawPlayer(player);
    mine.drawWord = "";
    saveDrawPlayer(player, mine);
  },

  onAction(room, players, player, action, now) {
    const state = drawStateOf(room);

    if (action.type === "stroke") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase !== "draw") return "That round is over — the next drawing is coming up.";
      if (player.id !== state.drawerId) return "Only the player drawing can add to the canvas.";
      const stroke = drawGuessCleanStroke(action.stroke);
      if (!stroke) return "That stroke didn't come through — try again.";
      if (state.strokes.length >= DRAW_GUESS_MAX_STROKES) return "The canvas is full — clear it to keep drawing.";
      state.strokes = [...state.strokes, stroke];
      return null;
    }

    if (action.type === "clear") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase !== "draw") return "That round is over — the next drawing is coming up.";
      if (player.id !== state.drawerId) return "Only the player drawing can clear the canvas.";
      state.strokes = [];
      return null;
    }

    if (action.type === "guess") {
      if (room.status !== "playing") return "The game isn't running right now.";
      if (state.phase === "reveal") return "That round is over — the next word is coming up.";
      if (state.phase !== "draw") return "Hold on — there's nothing to guess right now.";
      if (player.id === state.drawerId) return "You're drawing this one — everyone else does the guessing.";
      const text = String(action.text ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
      if (!text) return "Type your guess first.";
      if (quizAnswerMatches(text, state.currentWord)) {
        // The first right guess ends the round on the spot: the
        // guesser takes 3 points, the drawer takes 1, and the word is
        // revealed to everyone.
        const mine = drawPlayer(player);
        mine.score += DRAW_GUESS_GUESSER_POINTS;
        saveDrawPlayer(player, mine);
        const drawer = players.find(candidate => candidate.id === state.drawerId);
        if (drawer) {
          const drawerState = drawPlayer(drawer);
          drawerState.score += DRAW_GUESS_DRAWER_POINTS;
          saveDrawPlayer(drawer, drawerState);
        }
        drawEndRound(room, players, now, player.id);
        return null;
      }
      state.guesses = [...state.guesses, { playerId: player.id, text, at: now }].slice(-DRAW_GUESS_FEED_LIMIT);
      return null;
    }

    return "That move isn't part of this game.";
  },

  tick(room, players, now) {
    const state = drawStateOf(room);
    if (!state.startedAt) return;
    if (state.phase === "draw" && now >= state.roundEndsAt) {
      // The clock ran out: the word is revealed, nobody scores.
      drawEndRound(room, players, now, null);
    } else if (state.phase === "reveal" && now >= state.revealUntil) {
      drawAdvanceRound(room, players, now);
    }
  },

  checkFinish(room, players) {
    const state = drawStateOf(room);
    if (!state.startedAt || state.phase !== "done") return null;
    const rows = players.map(player => ({ player, score: drawPlayer(player).score }));
    const top = rows.reduce((best, row) => Math.max(best, row.score), Number.NEGATIVE_INFINITY);
    rows.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
    return rows.map(row => ({
      playerId: row.player.id,
      name: row.player.name,
      score: row.score,
      detail: row.score === top ? `${row.score} points — Draw & Guess champion` : `${row.score} points`,
      winner: row.score === top,
    }));
  },

  publicState(room, players) {
    const config = drawConfigOf(room);
    const state = drawStateOf(room);
    const names = new Map(players.map(player => [player.id, player.name]));
    return {
      accent: config.accent,
      theme: config.theme,
      drawStage: state.startedAt ? state.phase : "draw",
      drawerId: state.startedAt ? state.drawerId : null,
      drawerName: state.drawerId ? names.get(state.drawerId) || null : null,
      // Letter blanks only while the round runs: the word's length is
      // all a guesser gets. The word itself appears in this payload
      // ONLY inside the reveal, once the round is over.
      blanks: state.startedAt && state.phase === "draw" ? drawGuessBlanks(state.currentWord) : null,
      strokes: state.startedAt ? state.strokes : [],
      guesses: state.startedAt ? state.guesses.map(guess => ({
        playerId: guess.playerId,
        name: names.get(guess.playerId) || "",
        text: guess.text,
      })) : [],
      endsAt: state.startedAt && state.phase === "draw" ? state.roundEndsAt : null,
      wordNumber: state.wordIndex + 1,
      wordCount: config.words.length,
      scores: Object.fromEntries(players.map(player => [player.id, drawPlayer(player).score])),
      drawReveal: state.phase === "reveal" && state.lastRound ? {
        word: state.lastRound.word,
        drawerId: state.lastRound.drawerId,
        drawerName: state.lastRound.drawerId ? names.get(state.lastRound.drawerId) || null : null,
        guesserId: state.lastRound.guesserId,
        guesserName: state.lastRound.guesserId ? names.get(state.lastRound.guesserId) || null : null,
      } : null,
    };
  },
};

// ---------------------------------------------------------------------------
// Property Tycoon module
// ---------------------------------------------------------------------------

function tycoonStateOf(room: Room): PropertyTycoonRoomState {
  return room.state as unknown as PropertyTycoonRoomState;
}

function tycoonConfigOf(room: Room): PropertyTycoonConfig {
  return room.config as unknown as PropertyTycoonConfig;
}

function tycoonPlayer(player: RoomPlayer): PropertyTycoonPlayerState {
  return propertyTycoonPlayerState(player.state);
}

function saveTycoonPlayer(player: RoomPlayer, mine: PropertyTycoonPlayerState): void {
  player.state = mine as unknown as Record<string, unknown>;
}

/** The event fragment for a charge that broke a player. */
function tycoonBankruptFragment(player: RoomPlayer): string {
  return ` — more than ${player.name} had: ${player.name} is bankrupt and out, and their properties are back on the market`;
}

/** Charge a player for rent, tax or a chance loss. They pay what they
 * have (crediting the payee, when there is one); when the charge is
 * more than that, they are bankrupt — out of the game, with every
 * property they owned back on the market. Returns true when the
 * charge bankrupted them. */
function tycoonCharge(room: Room, player: RoomPlayer, amount: number, payee?: RoomPlayer): boolean {
  const state = tycoonStateOf(room);
  const mine = tycoonPlayer(player);
  const short = amount > mine.balance;
  const paid = short ? mine.balance : amount;
  mine.balance -= paid;
  saveTycoonPlayer(player, mine);
  if (payee && paid > 0) {
    const theirs = tycoonPlayer(payee);
    theirs.balance += paid;
    saveTycoonPlayer(payee, theirs);
  }
  if (!short) return false;
  const broken = tycoonPlayer(player);
  broken.out = true;
  saveTycoonPlayer(player, broken);
  state.owners = state.owners.map(owner => (owner === player.id ? null : owner));
  if (!state.outOrder.includes(player.id)) state.outOrder = [...state.outOrder, player.id];
  return true;
}

/** Move a player's token, paying the Start salary when the move wraps
 * past it (landing exactly on Start counts — the token passed it). */
function tycoonMove(room: Room, player: RoomPlayer, steps: number, events: string[]): void {
  const config = tycoonConfigOf(room);
  const mine = tycoonPlayer(player);
  const from = mine.position;
  mine.position = (from + steps) % config.spaces.length;
  if (from + steps >= config.spaces.length) {
    mine.balance += TYCOON_SALARY;
    events.push(`${player.name} passes Start and collects ${TYCOON_SALARY}`);
  }
  saveTycoonPlayer(player, mine);
}

/** Resolve the space a token just landed on, appending the story to
 * `events`. Returns false when the turn must pause — an unowned
 * property the player can afford is on offer to them, and the turn
 * cannot move on until they buy or pass. `fromChance` is true when a
 * chance card's move brought the token here: a second Chance space
 * never draws a second card. */
function tycoonResolveLanding(room: Room, players: RoomPlayer[], player: RoomPlayer, events: string[], fromChance: boolean): boolean {
  const config = tycoonConfigOf(room);
  const state = tycoonStateOf(room);
  const mine = tycoonPlayer(player);
  const space = config.spaces[mine.position];
  if (!space) return true;

  switch (space.kind) {
    case "start":
      events.push(`${player.name} lands on Start`);
      return true;

    case "rest":
      events.push(`${player.name} rests at the Rest Stop — nothing happens`);
      return true;

    case "tax": {
      const broke = tycoonCharge(room, player, TYCOON_TAX);
      events.push(`${player.name} lands on Tax and pays ${TYCOON_TAX}${broke ? tycoonBankruptFragment(player) : ""}`);
      return true;
    }

    case "timeout": {
      const fresh = tycoonPlayer(player);
      fresh.position = config.timeoutSpace;
      fresh.skipNext = true;
      saveTycoonPlayer(player, fresh);
      events.push(`${player.name} is sent to Time-Out at the Rest Stop corner — and misses their next turn`);
      return true;
    }

    case "chance": {
      if (fromChance) {
        events.push(`${player.name} lands on Chance again — one card a turn`);
        return true;
      }
      const card = config.chanceCards[state.chanceIndex % config.chanceCards.length];
      state.chanceIndex += 1;
      const text = card.text.replace(/\.\s*$/, "");
      const effect = card.effect;
      if (effect.kind === "money" && effect.amount > 0) {
        const fresh = tycoonPlayer(player);
        fresh.balance += effect.amount;
        saveTycoonPlayer(player, fresh);
        events.push(`${player.name} draws Chance: ${text} — collects ${effect.amount}`);
        return true;
      }
      if (effect.kind === "money") {
        const broke = tycoonCharge(room, player, -effect.amount);
        events.push(`${player.name} draws Chance: ${text} — pays ${-effect.amount}${broke ? tycoonBankruptFragment(player) : ""}`);
        return true;
      }
      if (effect.kind === "skip") {
        const fresh = tycoonPlayer(player);
        fresh.skipNext = true;
        saveTycoonPlayer(player, fresh);
        events.push(`${player.name} draws Chance: ${text} — and misses their next turn`);
        return true;
      }
      // A move card: the token moves (Start salary still pays on the
      // way past), and the new space resolves like any landing —
      // except it can never draw another chance card.
      events.push(`${player.name} draws Chance: ${text}`);
      tycoonMove(room, player, effect.steps, events);
      return tycoonResolveLanding(room, players, player, events, true);
    }

    case "property": {
      const property = config.properties[space.property];
      const ownerId = state.owners[space.property];
      if (ownerId === null || ownerId === undefined) {
        if (mine.balance >= property.price) {
          state.stage = "decide";
          state.offerSpace = mine.position;
          events.push(`${player.name} lands on ${property.name} — ${property.price} to buy it`);
          return false;
        }
        events.push(`${player.name} lands on ${property.name}, but ${property.price} is more than they have — it stays on the market`);
        return true;
      }
      if (ownerId === player.id) {
        events.push(`${player.name} lands on their own ${property.name} — no rent to pay`);
        return true;
      }
      const owner = players.find(candidate => candidate.id === ownerId);
      const rent = tycoonRent(config, state.owners, space.property);
      const fullSet = tycoonOwnsSet(config, state.owners, space.property);
      const broke = tycoonCharge(room, player, rent, owner);
      events.push(`${player.name} lands on ${owner?.name ?? "another player"}'s ${property.name} — rent ${rent} to ${owner?.name ?? "its owner"}${fullSet ? " (full set — rent doubled)" : ""}${broke ? tycoonBankruptFragment(player) : ""}`);
      return true;
    }
  }
  return true;
}

/** Hand the turn to the next player who can take it: bankrupt players
 * are passed over, and a player serving a Time-Out skip has it
 * consumed as the turn reaches them (the miss is part of the story).
 * If nobody else can take it, the first solvent player keeps the turn
 * so the game is never stuck — the finish check ends it if it is over. */
function tycoonAdvanceTurn(room: Room, players: RoomPlayer[], events: string[]): void {
  const state = tycoonStateOf(room);
  state.stage = "roll";
  state.offerSpace = null;
  if (!players.length) { state.turnPlayerId = null; return; }
  const startIndex = players.findIndex(candidate => candidate.id === state.turnPlayerId);
  let fallback: RoomPlayer | null = null;
  for (let step = 1; step <= players.length; step++) {
    const candidate = players[(startIndex + step) % players.length];
    const theirs = tycoonPlayer(candidate);
    if (theirs.out) continue;
    if (!fallback) fallback = candidate;
    if (theirs.skipNext) {
      theirs.skipNext = false;
      saveTycoonPlayer(candidate, theirs);
      events.push(`${candidate.name} misses a turn in Time-Out`);
      continue;
    }
    state.turnPlayerId = candidate.id;
    return;
  }
  state.turnPlayerId = fallback ? fallback.id : null;
}

const propertyTycoonModule: GameModule = {
  gameType: "property-tycoon",

  extractConfig(snapshot) {
    const result = propertyTycoonConfigFromSnapshot(snapshot);
    if ("error" in result) return result;
    return { config: result.config as unknown as Record<string, unknown> };
  },

  init(config) {
    const properties = (config as unknown as PropertyTycoonConfig).properties || [];
    const state: PropertyTycoonRoomState = {
      startedAt: 0, diceSeed: 0, rollsMade: 0,
      turnPlayerId: null, stage: "roll", offerSpace: null,
      lastDice: null,
      owners: properties.map(() => null),
      chanceIndex: 0, turnsTaken: {}, outOrder: [], lastEvent: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  onStart(room, players, now, rng) {
    const config = tycoonConfigOf(room);
    const state = tycoonStateOf(room);
    state.startedAt = now;
    state.diceSeed = Math.floor(rng() * 1_000_000_000);
    state.rollsMade = 0;
    state.turnPlayerId = players[0]?.id ?? null;
    state.stage = "roll";
    state.offerSpace = null;
    state.lastDice = null;
    state.owners = config.properties.map(() => null);
    state.chanceIndex = 0;
    state.turnsTaken = {};
    state.outOrder = [];
    state.lastEvent = null;
    for (const player of players) {
      saveTycoonPlayer(player, { balance: TYCOON_START_BALANCE, position: 0, out: false, skipNext: false });
    }
  },

  playerInit(room, player) {
    // A fresh seat starts with a full stake on the Start square. A
    // late joiner takes the next seat in the turn order the same way —
    // the game never waits for a host to place them.
    saveTycoonPlayer(player, tycoonPlayer(player));
  },

  onAction(room, players, player, action) {
    const config = tycoonConfigOf(room);
    const state = tycoonStateOf(room);

    if (action.type === "roll") {
      if (room.status !== "playing" || !state.startedAt) return "The game isn't running right now.";
      if (state.stage !== "roll") return "Settle the property offer first — buy it or pass.";
      if (player.id !== state.turnPlayerId) {
        const turn = players.find(candidate => candidate.id === state.turnPlayerId);
        return turn ? `It's ${turn.name}'s turn — yours comes around.` : "It's not your turn right now.";
      }
      if (tycoonPlayer(player).out) return "You're out of this game — you can watch it finish!";
      const dice = tycoonDice(state.diceSeed, state.rollsMade);
      state.rollsMade += 1;
      state.lastDice = dice;
      state.turnsTaken[player.id] = (state.turnsTaken[player.id] || 0) + 1;
      const events = [`${player.name} rolled ${dice[0]} and ${dice[1]}`];
      tycoonMove(room, player, dice[0] + dice[1], events);
      const turnEnds = tycoonResolveLanding(room, players, player, events, false);
      if (turnEnds) tycoonAdvanceTurn(room, players, events);
      state.lastEvent = `${events.join(". ")}.`;
      return null;
    }

    if (action.type === "decide") {
      if (room.status !== "playing" || !state.startedAt) return "The game isn't running right now.";
      if (state.stage !== "decide" || state.offerSpace === null) return "There's no property on offer right now.";
      if (player.id !== state.turnPlayerId) return "That offer is on the table for the player whose turn it is.";
      const space = config.spaces[state.offerSpace];
      if (!space || space.kind !== "property") return "That offer has closed.";
      const property = config.properties[space.property];
      const events: string[] = [];
      if (action.buy === true) {
        const mine = tycoonPlayer(player);
        if (mine.balance < property.price) return `${property.name} costs ${property.price} — more than you have. Pass, and play on.`;
        mine.balance -= property.price;
        saveTycoonPlayer(player, mine);
        state.owners[space.property] = player.id;
        events.push(`${player.name} buys ${property.name} for ${property.price}`);
      } else {
        events.push(`${player.name} passes on ${property.name}`);
      }
      tycoonAdvanceTurn(room, players, events);
      state.lastEvent = `${events.join(". ")}.`;
      return null;
    }

    return "That move isn't part of this game.";
  },

  tick() {
    // Property Tycoon turns wait for their players — there are no
    // timers in this game, so time passing changes nothing.
  },

  checkFinish(room, players) {
    const config = tycoonConfigOf(room);
    const state = tycoonStateOf(room);
    if (!state.startedAt) return null;
    if (state.stage === "decide") return null; // an open offer settles first
    const solvent = players.filter(candidate => !tycoonPlayer(candidate).out);
    const lastOneStanding = state.outOrder.length > 0 && solvent.length <= 1;
    const turnsDone = solvent.length > 0 && solvent.every(candidate => (state.turnsTaken[candidate.id] || 0) >= TYCOON_TURNS_EACH);
    if (!lastOneStanding && !turnsDone) return null;
    const rows = players.map(player => {
      const mine = tycoonPlayer(player);
      return {
        player,
        mine,
        worth: mine.out ? 0 : tycoonNetWorth(config, state.owners, player.id, mine.balance),
        outAt: state.outOrder.indexOf(player.id),
      };
    });
    rows.sort((a, b) => {
      // Solvent before bankrupt; among the solvent, the richest
      // first; among the bankrupt, whoever fell latest first.
      if (a.mine.out !== b.mine.out) return a.mine.out ? 1 : -1;
      if (!a.mine.out && a.worth !== b.worth) return b.worth - a.worth;
      if (a.mine.out && b.mine.out && a.outAt !== b.outAt) return b.outAt - a.outAt;
      return a.player.name.localeCompare(b.player.name);
    });
    const topWorth = rows.filter(row => !row.mine.out).reduce((best, row) => Math.max(best, row.worth), Number.NEGATIVE_INFINITY);
    return rows.map((row, index) => {
      const winner = !row.mine.out ? row.worth === topWorth : solvent.length === 0 && index === 0;
      return {
        playerId: row.player.id,
        name: row.player.name,
        score: row.mine.out ? 0 : row.worth,
        detail: row.mine.out
          ? (winner ? "Last to fall — bankrupt, but outlasted everyone" : "Bankrupt — out of the game")
          : (winner ? `${row.worth} net worth — Property Tycoon champion` : `${row.worth} net worth`),
        winner,
      };
    });
  },

  publicState(room, players) {
    const config = tycoonConfigOf(room);
    const state = tycoonStateOf(room);
    const names = new Map(players.map(player => [player.id, player.name]));
    const offerSpace = state.offerSpace !== null ? config.spaces[state.offerSpace] : null;
    return {
      accent: config.accent,
      theme: config.theme,
      tycoonStage: state.startedAt ? state.stage : "roll",
      spaces: config.spaces.map((space, index) => {
        if (space.kind === "property") {
          const property = config.properties[space.property];
          const ownerId = state.owners[space.property] ?? null;
          return {
            index, kind: space.kind,
            name: property.name,
            price: property.price,
            color: property.color,
            ownerId,
            ownerName: ownerId ? names.get(ownerId) || null : null,
          };
        }
        return {
          index, kind: space.kind,
          name: space.kind === "start" ? "Start" : space.kind === "chance" ? "Chance" : space.kind === "rest" ? "Rest Stop" : space.kind === "tax" ? "Tax" : "Go to Time-Out",
          price: space.kind === "tax" ? TYCOON_TAX : space.kind === "start" ? TYCOON_SALARY : null,
        };
      }),
      turnPlayerId: state.startedAt ? state.turnPlayerId : null,
      turnName: state.turnPlayerId ? names.get(state.turnPlayerId) || null : null,
      offer: state.stage === "decide" && offerSpace && offerSpace.kind === "property" ? {
        space: state.offerSpace,
        name: config.properties[offerSpace.property].name,
        price: config.properties[offerSpace.property].price,
      } : null,
      lastDice: state.startedAt ? state.lastDice : null,
      lastEvent: state.startedAt ? state.lastEvent : null,
      turnsEach: TYCOON_TURNS_EACH,
      tycoonPlayers: Object.fromEntries(players.map(player => {
        const mine = tycoonPlayer(player);
        return [player.id, {
          balance: mine.balance,
          position: mine.position,
          out: mine.out,
          skipNext: mine.skipNext,
          properties: config.properties.filter((_, index) => state.owners[index] === player.id).length,
          netWorth: tycoonNetWorth(config, state.owners, player.id, mine.balance),
          turnsTaken: state.turnsTaken[player.id] || 0,
        }];
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------

export const GAME_MODULES: Record<string, GameModule> = {
  [bingoModule.gameType]: bingoModule,
  [quizModule.gameType]: quizModule,
  [surveyModule.gameType]: surveyModule,
  [perfectMatchModule.gameType]: perfectMatchModule,
  [wordChainModule.gameType]: wordChainModule,
  [drawGuessModule.gameType]: drawGuessModule,
  [propertyTycoonModule.gameType]: propertyTycoonModule,
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
    // Module ticks mutate the game state in place and return nothing, so
    // the only way to know a timed transition actually happened is to
    // compare the persisted shape before and after. Without this, callers
    // that save only on change (loadPlayRoom) never store mid-game
    // advances — a quiz reveal, a survey stage change, a match round
    // rollover — and every poll reloads the stale copy and re-derives
    // the same frozen moment forever.
    const before = JSON.stringify({
      state: room.state,
      status: room.status,
      round: room.round,
      players: players.map(player => player.state),
    });
    GAME_MODULES[room.gameType].tick(room, players, now);
    const standings = GAME_MODULES[room.gameType].checkFinish(room, players, now);
    if (standings) {
      room.status = "finished";
      room.state = { ...room.state, standings };
      changed = true;
    }
    if (!changed) {
      const after = JSON.stringify({
        state: room.state,
        status: room.status,
        round: room.round,
        players: players.map(player => player.state),
      });
      if (after !== before) changed = true;
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
    const refusal = GAME_MODULES[room.gameType].startError?.(room, players);
    if (refusal) return refusal;
    room.status = "countdown";
    room.countdownEndsAt = now + COUNTDOWN_MS;
    return null;
  }

  if (type === "play-again") {
    if (room.status !== "finished") return "The game is still going.";
    const refusal = GAME_MODULES[room.gameType].startError?.(room, players);
    if (refusal) return refusal;
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
