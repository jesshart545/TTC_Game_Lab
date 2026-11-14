// Survey Showdown — the third Game Night module (Off-Stream Multiplayer
// Game Night). A survey game in the classic style, under the site's own
// generic name: two teams, one survey question per round, a face-off for
// control, strikes, a steal — and NO host. The game runs itself: players
// join by name only, teams are dealt automatically, and the board scores
// itself to final standings.
//
// Where the game's content comes from (documented choice): the creator's
// own survey, read out of the published snapshot in the lightest shape
// Jewel can already build — a `trivia-board` tool, shaped for survey:
// each CATEGORY is one survey question (the category's name is the
// question), and the category's entries are the ranked answers, each
// carrying `answer` (the answer text) and `value` (its points, a plain
// number; a classic board's answers add up to about 100). The telling
// difference from a Quiz Board board: survey entries carry NO question
// text of their own. That keeps the two games unmistakable — a board
// whose entries ask their own questions plays as Quiz Board (and the
// registry tries Quiz Board first anyway); a board whose categories are
// questions and whose entries are bare ranked answers plays as Survey
// Showdown. A playable survey needs at least SURVEY_MIN_QUESTIONS
// questions with at least SURVEY_MIN_ANSWERS answers each.
//
// Answers live ONLY in the room config, which never leaves the server:
// publicState shows a board slot's answer and points only once it has
// been revealed (or when the round ends and the whole board opens) —
// the same discipline bingo keeps for uncalled items and Quiz Board
// keeps for its answers. Points are plain numbers everywhere; no
// dollar signs.

import { quizAnswerMatches } from "./quiz-board";

export type SurveyAnswerDef = { text: string; points: number };
export type SurveyQuestionDef = { question: string; answers: SurveyAnswerDef[] };

export type SurveyConfig = {
  title: string;
  questions: SurveyQuestionDef[];
  theme: string;
  accent: string;
};

export type SurveyRoundResult = {
  questionIndex: number;
  question: string;
  /** The team that took the pot — null when nobody did (a skipped question). */
  winnerTeam: number | null;
  potAwarded: number;
  stolen: boolean;
};

export type SurveyRoomState = {
  startedAt: number;
  phase: "faceoff" | "play" | "steal" | "reveal" | "done";
  /** Player ids per team, in rotation order. */
  teams: [string[], string[]];
  /** Next rotation index per team. */
  cursors: [number, number];
  questionIndex: number;
  revealed: number[];
  pot: number;
  strikes: number;
  controlTeam: number | null;
  faceoff: [string | null, string | null];
  faceoffAttempt: number;
  /** The current guess slot — a player's stored guess counts only for this slot. */
  slot: number;
  slotEndsAt: number;
  guesserId: string | null;
  teamScores: [number, number];
  revealUntil: number;
  lastRound: SurveyRoundResult | null;
};

export type SurveyPlayerState = {
  team: number;
  guessSlot: number;
  guessText: string;
  guessAt: number;
};

export const SURVEY_MIN_QUESTIONS = 3;
export const SURVEY_MIN_ANSWERS = 3;
export const SURVEY_FACEOFF_MS = 15000;
export const SURVEY_GUESS_MS = 30000;
export const SURVEY_REVEAL_MS = 6000;

const MAX_QUESTIONS = 8;
const MAX_ANSWERS = 8;
// Fallback points by rank when a creator's board leaves a value off —
// Jewel is taught to always write the points, so this is a safety net.
const DEFAULT_POINTS = [32, 24, 17, 12, 8, 5, 3, 2];

const THEME_ACCENTS: Record<string, string> = {
  cyan: "#22d3ee",
  purple: "#a855f7",
  pink: "#ec4899",
};

export const SURVEY_TEAMS: { name: string; color: string }[] = [
  { name: "Gold Team", color: "#f59e0b" },
  { name: "Teal Team", color: "#2dd4bf" },
];

type AnyTool = {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  config?: Record<string, unknown> | null;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** The ranked answers inside one board category. An entry only counts as
 * a survey answer when it carries answer text and NO question text of
 * its own — an entry with its own question is a quiz clue, never a
 * survey answer, so the two board shapes can never blur. */
function answersFromCategory(rawQuestions: unknown[]): SurveyAnswerDef[] {
  const answers: SurveyAnswerDef[] = [];
  for (const raw of rawQuestions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    if (cleanText(entry.question ?? entry.prompt)) continue;
    const text = cleanText(entry.answer ?? entry.text);
    if (!text) continue;
    const rawValue = typeof entry.value === "number" ? entry.value : typeof entry.value === "string" ? Number(entry.value) : NaN;
    const points = Number.isFinite(rawValue) && rawValue > 0 ? Math.round(rawValue) : (DEFAULT_POINTS[answers.length] ?? 2);
    answers.push({ text, points });
    if (answers.length >= MAX_ANSWERS) break;
  }
  return answers;
}

function questionsFromBoard(tool: AnyTool): SurveyQuestionDef[] {
  const config = (tool.config || {}) as Record<string, unknown>;
  const rawCategories = Array.isArray(config.categories) ? config.categories : [];
  const questions: SurveyQuestionDef[] = [];
  for (const raw of rawCategories) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const category = raw as Record<string, unknown>;
    const question = cleanText(category.name ?? category.question);
    if (!question) continue;
    const answers = answersFromCategory(Array.isArray(category.questions) ? category.questions : []);
    if (answers.length >= SURVEY_MIN_ANSWERS) questions.push({ question, answers });
    if (questions.length >= MAX_QUESTIONS) break;
  }
  return questions;
}

/** Read the Survey Showdown definition out of a project's published snapshot. */
export function surveyConfigFromSnapshot(snapshot: unknown): { config: SurveyConfig } | { error: string } {
  const snap = (snapshot || {}) as { name?: unknown; theme?: unknown; gameTools?: unknown };
  const tools: AnyTool[] = Array.isArray(snap.gameTools) ? (snap.gameTools as AnyTool[]) : [];

  let questions: SurveyQuestionDef[] = [];
  for (const board of tools.filter(tool => tool.type === "trivia-board")) {
    const fromBoard = questionsFromBoard(board);
    if (fromBoard.length > questions.length) questions = fromBoard;
  }

  if (questions.length < SURVEY_MIN_QUESTIONS) {
    // pickGame surfaces the LAST module's error, so this one speaks for
    // the whole game night: all three games, in plain words.
    return { error: "This game night needs something to play before it can be shared — add a card list with at least 5 items for Bingo, a quiz board with at least 6 questions across at least 2 categories for Quiz Board, or a survey board with at least 3 questions of at least 3 answers each for Survey Showdown (ask Jewel to build one), publish, then share." };
  }
  const theme = typeof snap.theme === "string" ? snap.theme : "purple";
  return {
    config: {
      title: typeof snap.name === "string" && snap.name.trim() ? snap.name : "Survey Showdown",
      questions,
      theme,
      accent: THEME_ACCENTS[theme] || THEME_ACCENTS.purple,
    },
  };
}

export function surveyPlayerState(raw: unknown): SurveyPlayerState {
  const state = (raw || {}) as Partial<SurveyPlayerState>;
  return {
    team: state.team === 1 ? 1 : 0,
    guessSlot: typeof state.guessSlot === "number" && Number.isFinite(state.guessSlot) ? state.guessSlot : -1,
    guessText: typeof state.guessText === "string" ? state.guessText : "",
    guessAt: typeof state.guessAt === "number" && Number.isFinite(state.guessAt) ? state.guessAt : 0,
  };
}

/** Match a guess against a question's still-covered answers, using the
 * same forgiving comparison Quiz Board uses. Returns the answer's rank
 * (0 = top answer) or -1 for a miss. */
export function surveyMatchAnswer(text: string, question: SurveyQuestionDef, revealed: readonly number[]): number {
  const covered = new Set(revealed);
  for (let index = 0; index < question.answers.length; index++) {
    if (covered.has(index)) continue;
    if (quizAnswerMatches(text, question.answers[index].text)) return index;
  }
  return -1;
}
