import type { GameTool } from "./project";
import { cleanQuizChoice } from "./question-cards";

export { cleanQuizChoice };

/**
 * Short multiple-choice quizzes for Talk Show or Classroom projects.
 *
 * The smallest honest shape, built on what already exists: a quiz is a
 * trivia-list tool whose question entries may carry `options` (the choices)
 * and `correctIndex` (which choice is right). The entry's `answer` string
 * always equals options[correctIndex] — one source of truth, enforced by
 * the cleaner below. Question cards pointed at the list render the question
 * plus its choices; the correct answer stays host-side knowledge until the
 * reveal: the live card states blank it (lib/question-cards.ts
 * publicCardState strips correctIndex and the answer before the answer
 * phase), and the published snapshot strips both fields from quiz entries
 * (app/api/projects/route.ts — the same publish-scrub the City Crime Scene
 * case file gets). The host's draft keeps the full quiz.
 */

export type QuizQuestion = {
  question: string;
  answer: string;
  category?: string;
  options: string[];
  correctIndex: number;
};

export const QUIZ_MAX_QUESTIONS = 500;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/**
 * Sanitize a trivia-list questions array (used on every path that writes
 * one: Jewel's draft edits and build changes). Plain question/answer
 * entries pass through with their fields intact; entries carrying options
 * keep them only when the choice set is valid, with the answer forced to
 * the correct option's text.
 */
export function cleanTriviaQuestions(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    const question = cleanText(raw.question ?? raw.prompt, 600);
    if (!question) continue;
    const choice = cleanQuizChoice(raw);
    const answer = choice ? choice.options[choice.correctIndex] : cleanText(raw.answer, 600);
    if (!answer) continue;
    if (choice) out.push({ ...raw, question, answer, options: choice.options, correctIndex: choice.correctIndex });
    else { const { options: _options, correctIndex: _correctIndex, ...plain } = raw; out.push({ ...plain, question, answer }); }
    if (out.length >= QUIZ_MAX_QUESTIONS) break;
  }
  return out;
}

/** The valid multiple-choice questions saved in a trivia-list tool. */
export function quizQuestionsOf(tool: GameTool | null | undefined): QuizQuestion[] {
  if (!tool || tool.type !== "trivia-list" || !Array.isArray(tool.config?.questions)) return [];
  const out: QuizQuestion[] = [];
  for (const entry of tool.config.questions as Record<string, unknown>[]) {
    if (!entry || typeof entry !== "object") continue;
    const choice = cleanQuizChoice(entry);
    const question = cleanText(entry.question ?? entry.prompt, 600);
    if (!choice || !question) continue;
    out.push({
      question,
      answer: choice.options[choice.correctIndex],
      ...(typeof entry.category === "string" && entry.category ? { category: entry.category } : {}),
      options: choice.options,
      correctIndex: choice.correctIndex,
    });
  }
  return out;
}

export function isQuizTool(tool: GameTool | null | undefined): boolean {
  return quizQuestionsOf(tool).length > 0;
}

/**
 * Publish scrub for quiz entries: the audience-facing snapshot keeps the
 * question and its choices, but never which choice is correct (the answer
 * text or its index). The reveal travels through the host-gated live card
 * states instead. Plain trivia entries are untouched — their answers have
 * always shipped with the board data.
 */
export function scrubQuizQuestionsForPublish(questions: unknown): unknown {
  if (!Array.isArray(questions)) return questions;
  return questions.map(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const raw = entry as Record<string, unknown>;
    if (!cleanQuizChoice(raw)) return entry;
    const { answer: _answer, correctIndex: _correctIndex, ...rest } = raw;
    return rest;
  });
}
