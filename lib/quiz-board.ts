// Quiz Board — the second Game Night module (Off-Stream Multiplayer
// Game Night). A categories × point-values quiz in the classic style,
// under the site's own generic name. Like every game-night format it has
// NO host: players take turns picking a square, everyone answers the
// question on their own phone inside a time window, correct answers gain
// the square's points and wrong answers lose them, and the game scores
// itself to final standings.
//
// Where the game's content comes from (documented choice): the creator's
// own trivia, read out of the published snapshot exactly the way bingo
// reads its card list (quizConfigFromSnapshot). A `trivia-board` tool is
// the natural home — its config.categories already hold named categories
// of { value, question/prompt, answer } — so a board wins when one holds
// a playable quiz. Otherwise the project's `trivia-list` tools serve:
// their questions group by each entry's `category` (questions without
// one group under their list's name), with point values laddered by
// position (100, 200, 300…). A playable quiz needs at least
// QUIZ_MIN_QUESTIONS questions across at least QUIZ_MIN_CATEGORIES
// categories. Jewel builds either shape when a creator asks for a quiz.
//
// Answers live ONLY in the room config, which never leaves the server:
// publicState shows the open question's text but never its answer until
// the reveal moment — the same discipline bingo keeps for uncalled
// items. Point values are plain numbers everywhere; no dollar signs.

export type QuizQuestionDef = { prompt: string; answer: string; value: number };
export type QuizCategoryDef = { name: string; questions: QuizQuestionDef[] };

export type QuizConfig = {
  title: string;
  categories: QuizCategoryDef[];
  answerMs: number;
  theme: string;
  accent: string;
};

export type QuizRevealResult = { playerId: string; answered: boolean; correct: boolean; delta: number };

export type QuizReveal = {
  key: string;
  categoryName: string;
  prompt: string;
  answer: string;
  value: number;
  results: QuizRevealResult[];
};

export type QuizRoomState = {
  startedAt: number;
  phase: "pick" | "answer" | "reveal";
  turnPlayerId: string | null;
  currentKey: string;
  currentCategory: number;
  currentQuestion: number;
  openedAt: number;
  revealAt: number;
  revealUntil: number;
  usedKeys: string[];
  lastReveal: QuizReveal | null;
};

export type QuizPlayerState = {
  score: number;
  answerKey: string;
  answerText: string;
};

export const QUIZ_MIN_QUESTIONS = 6;
export const QUIZ_MIN_CATEGORIES = 2;
export const QUIZ_DEFAULT_ANSWER_MS = 20000;
export const QUIZ_REVEAL_MS = 6000;

const MAX_CATEGORIES = 6;
const MAX_PER_CATEGORY = 5;

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

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function questionDef(raw: unknown, indexInCategory: number): QuizQuestionDef | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  const prompt = cleanText(entry.question ?? entry.prompt);
  const answer = cleanText(entry.answer);
  if (!prompt || !answer) return null;
  const rawValue = typeof entry.value === "number" ? entry.value : typeof entry.value === "string" ? Number(entry.value) : NaN;
  const value = Number.isFinite(rawValue) && rawValue > 0 ? Math.round(rawValue) : (indexInCategory + 1) * 100;
  return { prompt, answer, value };
}

function categoriesFromBoard(tool: AnyTool): QuizCategoryDef[] {
  const config = (tool.config || {}) as Record<string, unknown>;
  const rawCategories = Array.isArray(config.categories) ? config.categories : [];
  const categories: QuizCategoryDef[] = [];
  for (const raw of rawCategories) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const category = raw as Record<string, unknown>;
    const name = cleanText(category.name);
    if (!name) continue;
    const rawQuestions = Array.isArray(category.questions) ? category.questions : [];
    const questions: QuizQuestionDef[] = [];
    for (const entry of rawQuestions) {
      const def = questionDef(entry, questions.length);
      if (def) questions.push(def);
      if (questions.length >= MAX_PER_CATEGORY) break;
    }
    if (questions.length) categories.push({ name, questions });
    if (categories.length >= MAX_CATEGORIES) break;
  }
  return categories;
}

function categoriesFromLists(tools: AnyTool[]): QuizCategoryDef[] {
  const buckets = new Map<string, QuizQuestionDef[]>();
  for (const tool of tools) {
    const config = (tool.config || {}) as Record<string, unknown>;
    const rawQuestions = Array.isArray(config.questions) ? config.questions : [];
    const fallbackName = cleanText(tool.name) || "Questions";
    for (const entry of rawQuestions) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const name = cleanText((entry as Record<string, unknown>).category) || fallbackName;
      const bucket = buckets.get(name) || [];
      const def = questionDef(entry, bucket.length);
      if (!def) continue;
      bucket.push(def);
      buckets.set(name, bucket);
    }
  }
  const categories: QuizCategoryDef[] = [];
  for (const [name, questions] of buckets) {
    if (questions.length) categories.push({ name, questions: questions.slice(0, MAX_PER_CATEGORY) });
    if (categories.length >= MAX_CATEGORIES) break;
  }
  return categories;
}

function answerMs(...sources: Array<Record<string, unknown> | undefined>): number {
  for (const source of sources) {
    const raw = source?.answerSeconds;
    const seconds = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(60, Math.max(10, seconds)) * 1000;
    }
  }
  return QUIZ_DEFAULT_ANSWER_MS;
}

function playable(categories: QuizCategoryDef[]): boolean {
  const total = categories.reduce((sum, category) => sum + category.questions.length, 0);
  return categories.length >= QUIZ_MIN_CATEGORIES && total >= QUIZ_MIN_QUESTIONS;
}

/** Read the Quiz Board definition out of a project's published snapshot. */
export function quizConfigFromSnapshot(snapshot: unknown): { config: QuizConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];

  let categories: QuizCategoryDef[] = [];
  let timingSource: Record<string, unknown> | undefined;
  const boards = tools.filter(tool => tool.type === "trivia-board");
  for (const board of boards) {
    const fromBoard = categoriesFromBoard(board);
    if (playable(fromBoard)) {
      categories = fromBoard;
      timingSource = (board.config || undefined) as Record<string, unknown> | undefined;
      break;
    }
    if (fromBoard.reduce((sum, c) => sum + c.questions.length, 0) > categories.reduce((sum, c) => sum + c.questions.length, 0)) {
      categories = fromBoard;
    }
  }
  if (!playable(categories)) {
    const lists = tools.filter(tool => tool.type === "trivia-list");
    const fromLists = categoriesFromLists(lists);
    if (playable(fromLists)) {
      categories = fromLists;
      timingSource = (lists[0]?.config || undefined) as Record<string, unknown> | undefined;
    }
  }

  if (!playable(categories)) {
    return { error: `This game night needs something to play before it can be shared — add a card list with at least 5 items for Bingo, or a quiz board with at least ${QUIZ_MIN_QUESTIONS} questions across at least ${QUIZ_MIN_CATEGORIES} categories for Quiz Board (ask Jewel to build one), publish, then share.` };
  }
  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Quiz Board",
      categories,
      answerMs: answerMs(timingSource),
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function quizPlayerState(raw: unknown): QuizPlayerState {
  const state = (raw || {}) as Partial<QuizPlayerState>;
  return {
    score: typeof state.score === "number" && Number.isFinite(state.score) ? state.score : 0,
    answerKey: typeof state.answerKey === "string" ? state.answerKey : "",
    answerText: typeof state.answerText === "string" ? state.answerText : "",
  };
}

export function quizKey(category: number, question: number): string {
  return `${category}:${question}`;
}

export function quizTotalSquares(config: QuizConfig): number {
  return config.categories.reduce((sum, category) => sum + category.questions.length, 0);
}

/** Forgiving answer comparison: case, spacing, trailing punctuation and
 * a leading "the/a/an" never decide a game. */
export function quizAnswerMatches(submitted: string, answer: string): boolean {
  const normalize = (text: string) => text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .replace(/^(the|a|an)\s+/, "");
  const given = normalize(submitted);
  return given.length > 0 && given === normalize(answer);
}
