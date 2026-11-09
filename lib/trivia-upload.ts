/**
 * Plain-text trivia upload parsing (owner request, 2026-11-09): a
 * creator drops a .txt file of their own trivia questions on a project
 * and the questions become a new question list in that project, named
 * after the file — stored exactly like a generated or hand-typed list
 * (a trivia-list tool whose config.questions carry question/answer
 * entries), so it is usable and customizable everywhere lists are.
 *
 * This module is the pure half of that flow: given the file's text it
 * decides which blocks are usable questions and counts the rest. The
 * browser glue (reading the file, creating the list, saving through
 * the project's save queue) lives in the project page, so everything
 * here is unit-testable without a browser.
 *
 * The accepted layouts, per block (blocks are separated by blank
 * lines):
 *
 *   Labeled (primary):
 *     Q: What is the largest planet?
 *     A: Jupiter
 *     Category: Science          (optional)
 *   The labels are Q:/Question: and A:/Answer:, case-insensitive, and
 *   question or answer text may wrap over several lines (joined with
 *   spaces). "A:" with a colon is always the answer label.
 *
 *   Unlabeled (fallback): the first line is the question, the second
 *   line is the answer, and any further lines append to the answer.
 *
 *   Multiple choice: option lines look like "A) text", "B) text" or
 *   "C. text" — a letter A–F followed by ) or . — 2 to 6 of them, in
 *   order. The answer is then either the full text of the correct
 *   option or a bare letter ("Answer: B"); the saved entry carries
 *   options + correctIndex, with answer set to the correct option's
 *   text, matching the site's quiz shape (lib/question-cards.ts).
 */

/** One parsed question, in the CardQuestion shape (lib/question-cards.ts):
 *  id is derived from the question text exactly the way questionPool
 *  derives it, so a parsed entry and a pooled entry agree. */
export type TriviaUploadQuestion = {
  id: string;
  question: string;
  answer: string;
  category?: string;
  options?: string[];
  correctIndex?: number;
};

export type TriviaUploadResult = {
  /** Usable, de-duplicated questions, in file order, capped at TRIVIA_UPLOAD_MAX_QUESTIONS. */
  questions: TriviaUploadQuestion[];
  /** Blocks left out because they had no usable question or no usable answer. */
  skipped: number;
  /** Blocks left out because their question repeats one already taken from this file. */
  duplicates: number;
  /** Usable, non-duplicate questions left out because the file held more than the cap. */
  cappedCount: number;
};

/** The most questions one uploaded file may add (matches QUIZ_MAX_QUESTIONS in lib/quiz.ts). */
export const TRIVIA_UPLOAD_MAX_QUESTIONS = 500;

const QUESTION_LABEL = /^(?:q|question)\s*:\s*(.*)$/i;
const ANSWER_LABEL = /^(?:a|answer)\s*:\s*(.*)$/i;
const CATEGORY_LABEL = /^category\s*:\s*(.*)$/i;
const OPTION_LINE = /^([a-f])\s*[).]\s*(.+)$/i;
const BARE_LETTER = /^([a-f])$/i;

const squash = (value: string): string => value.trim().replace(/\s+/g, " ");

/** True when a chosen file name is a plain-text file. */
export function isTriviaTextFileName(name: string): boolean {
  return /\.txt$/i.test(String(name || "").trim());
}

/**
 * The base name for an uploaded file's question list: the file's own
 * name without the .txt ("my-questions.txt" → "my-questions"). The
 * caller de-duplicates it against the project's existing list names
 * with uniqueTriviaListName (lib/trivia-list-name.ts).
 */
export function triviaListBaseName(fileName: string): string {
  const base = String(fileName || "").replace(/\\/g, "/").split("/").pop() || "";
  return base.replace(/\.txt$/i, "").trim() || "Trivia Questions";
}

type ParsedBlock = Omit<TriviaUploadQuestion, "id">;

/**
 * Parse one block (the lines between blank lines) into a question, or
 * return null when the block has no usable question or no usable
 * answer. Lines are classified as they are walked: labels switch the
 * field being filled, an option line counts only when its letter is
 * the next expected one (A first, then B, …), and any other line
 * appends to the field in progress — in an unlabeled block the first
 * line fills the question and later lines fill the answer.
 */
function parseTriviaBlock(lines: readonly string[]): ParsedBlock | null {
  const questionParts: string[] = [];
  const answerParts: string[] = [];
  let category = "";
  const options: { text: string }[] = [];
  let field: "none" | "question" | "answer" | "category" | "options" = "none";
  const nextOptionLetter = () => String.fromCharCode(97 + options.length);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    let match: RegExpMatchArray | null;
    if ((match = line.match(QUESTION_LABEL))) {
      field = "question";
      if (match[1]) questionParts.push(match[1]);
      continue;
    }
    if ((match = line.match(ANSWER_LABEL))) {
      field = "answer";
      if (match[1]) answerParts.push(match[1]);
      continue;
    }
    if ((match = line.match(CATEGORY_LABEL))) {
      field = "category";
      if (match[1]) category = match[1];
      continue;
    }
    if ((match = line.match(OPTION_LINE)) && match[1].toLowerCase() === nextOptionLetter() && options.length < 6) {
      options.push({ text: match[2] });
      field = "options";
      continue;
    }
    // A plain line appends to the field in progress. Before anything
    // else it starts the question, and in an unlabeled block the lines
    // after the question are the answer.
    if (field === "question") questionParts.push(line);
    else if (field === "category") category = category ? `${category} ${line}` : line;
    else if (field === "none") { questionParts.push(line); field = "answer"; }
    else answerParts.push(line);
  }

  // A single option-looking line was never a choice set — it was the
  // answer line of an unlabeled block ("What is 2+2?" / "A) 4" style
  // aside, its text is the answer the creator wrote).
  if (options.length === 1) answerParts.push(options.pop()!.text);

  const question = squash(questionParts.join(" "));
  if (!question) return null;
  let answer = squash(answerParts.join(" "));

  let choice: { options: string[]; correctIndex: number } | null = null;
  if (options.length >= 2) {
    const texts = options.map(option => squash(option.text)).filter(Boolean);
    if (texts.length >= 2 && new Set(texts.map(text => text.toLowerCase())).size === texts.length) {
      let correctIndex = -1;
      const bare = answer.match(BARE_LETTER);
      if (bare) correctIndex = bare[1].toLowerCase().charCodeAt(0) - 97;
      else {
        const wanted = squash(answer.replace(/^[a-f]\s*[).]\s*/i, "")).toLowerCase();
        correctIndex = texts.findIndex(text => text.toLowerCase() === wanted);
      }
      if (correctIndex < 0 || correctIndex >= texts.length) return null;
      choice = { options: texts, correctIndex };
      answer = texts[correctIndex];
    }
  }
  if (!answer) return null;

  const cleanedCategory = squash(category);
  return {
    question,
    answer,
    ...(cleanedCategory ? { category: cleanedCategory } : {}),
    ...(choice ? { options: choice.options, correctIndex: choice.correctIndex } : {}),
  };
}

/**
 * Parse a whole .txt file into trivia questions. Blocks are separated
 * by blank lines; a block with no usable question or answer is
 * skipped and counted, a block repeating a question already taken
 * from the file counts as a duplicate, and usable questions past the
 * 500 cap count as capped — the caller reports all three truthfully.
 */
export function parseTriviaText(text: string): TriviaUploadResult {
  const normalized = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const questions: TriviaUploadQuestion[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let cappedCount = 0;
  for (const block of normalized.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    if (!lines.some(line => line.trim())) continue;
    const parsed = parseTriviaBlock(lines);
    if (!parsed) { skipped += 1; continue; }
    // The question id is derived exactly as questionPool derives it
    // (lowercased question text, whitespace collapsed) — the same key
    // doubles as this file's duplicate check.
    const id = parsed.question.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(id)) { duplicates += 1; continue; }
    if (questions.length >= TRIVIA_UPLOAD_MAX_QUESTIONS) { cappedCount += 1; continue; }
    seen.add(id);
    questions.push({ id, ...parsed });
  }
  return { questions, skipped, duplicates, cappedCount };
}
