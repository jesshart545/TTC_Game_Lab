import { videoDuration } from "./video-duration";
import { musicDuration } from "./music-duration";
import { isGeneratorVoice } from "./generator-voices";
import type { Project } from "./project";

/**
 * Jewel's generation actions, checked and normalized.
 *
 * Piece 2, Half A (teach first, close second): every option the manual
 * generator panels offer must be something a creator can simply tell Jewel
 * and have her pass through to the very same /api/generate-asset call the
 * panel makes. The panel (components/WorkshopAiPanel.tsx) builds its call
 * from GenerateOptions — image aspectRatio + sourceKey, video
 * durationSeconds (+ a reference image as sourceKey), voice + stability,
 * sfx durationSeconds, music durationSeconds + lyrics + instrumental — and
 * the checkers here produce exactly those fields from Jewel's reply JSON,
 * with the panel's own validation: image shapes from the panel's list,
 * video lengths through lib/video-duration (2–30 whole seconds), music
 * lengths through lib/music-duration (a short length, or 0/null for a full
 * song), voices from the one shared catalog (lib/generator-voices.ts),
 * stability clamped to the panel slider's 0–1, and sound-effect lengths
 * clamped to the panel's 2–30 seconds (5 when unnamed, the server default).
 */

export type JewelGenerationAction =
  | { type: "image"; prompt: string; sourceKey: string | null; aspectRatio: string }
  | { type: "video"; prompt: string; sourceKey: string | null; durationSeconds: number }
  | { type: "voice"; prompt: string; sourceKey: string | null; voice: string | null; stability: number | null }
  | { type: "music"; prompt: string; sourceKey: string | null; durationSeconds: number | null; lyrics: string; instrumental: boolean }
  | { type: "sfx"; prompt: string; sourceKey: string | null; durationSeconds: number };

const GENERATION_TYPES = ["image", "video", "voice", "music", "sfx"];
const IMAGE_ASPECT_RATIOS = ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"];

export function checkedGenerationAction(raw: unknown, requestText: string): JewelGenerationAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (!GENERATION_TYPES.includes(String(input.type)) || typeof input.prompt !== "string") return null;
  const prompt = input.prompt.slice(0, 12000);
  const sourceKey = typeof input.sourceKey === "string" ? input.sourceKey : null;
  if (input.type === "image") {
    return {
      type: "image", prompt, sourceKey,
      aspectRatio: IMAGE_ASPECT_RATIOS.includes(String(input.aspectRatio))
        ? String(input.aspectRatio)
        : typeof input.sourceKey === "string" && input.sourceKey ? "auto" : "16:9",
    };
  }
  if (input.type === "video") {
    // Same helper the panel's lengths pass through on the server; an
    // out-of-range length throws, exactly as it does for a panel request,
    // so the route's validation retry can correct it.
    return { type: "video", prompt, sourceKey, durationSeconds: videoDuration(`${requestText} ${prompt}`, input.durationSeconds) };
  }
  if (input.type === "voice") {
    return {
      type: "voice", prompt, sourceKey,
      voice: isGeneratorVoice(input.voice) ? input.voice : null,
      stability: typeof input.stability === "number" && Number.isFinite(input.stability)
        ? Math.min(1, Math.max(0, input.stability))
        : null,
    };
  }
  if (input.type === "music") {
    return {
      type: "music", prompt, sourceKey,
      durationSeconds: musicDuration(requestText, input.durationSeconds ?? musicDuration(prompt)),
      lyrics: typeof input.lyrics === "string" ? input.lyrics.slice(0, 3500) : "",
      instrumental: input.instrumental === true,
    };
  }
  const seconds = typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds)
    ? Math.round(input.durationSeconds)
    : 5;
  return { type: "sfx", prompt, sourceKey, durationSeconds: Math.min(30, Math.max(2, seconds)) };
}

export type JewelTriviaAction = { type: "trivia"; count: number; categories: string[] };

/** The GENERATE TRIVIA panel's contract: 1–500 questions, optional categories. */
export function checkedTriviaAction(raw: unknown): JewelTriviaAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (input.type !== "trivia" || !Number.isInteger(input.count) || (input.count as number) < 1 || (input.count as number) > 500) return null;
  return {
    type: "trivia",
    count: input.count as number,
    categories: Array.isArray(input.categories) ? input.categories.filter((x: unknown) => typeof x === "string").slice(0, 20) : [],
  };
}

export type JewelBoardRegenerateAction = { type: "board-regenerate"; mode: "generate" | "source"; category: string | null };

/**
 * The Trivia Board's regenerate buttons (WorkshopAssetsPanel) as a Jewel
 * action: mode "generate" is "Regenerate sourced board" (or one category of
 * it), mode "source" is "Refresh sources". The executor runs the identical
 * page function the buttons call. A category must name one of the saved
 * board's categories exactly — anything else is a validation error, so
 * Jewel gets the route's corrective retry instead of regenerating the
 * wrong thing.
 */
export function checkedBoardRegenerateAction(raw: unknown, project: Pick<Project, "gameTools"> | null | undefined): JewelBoardRegenerateAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (input.type !== "board-regenerate") return null;
  if (input.mode !== "generate" && input.mode !== "source") {
    throw new Error("Board regeneration needs mode \"generate\" (fresh sourced questions) or \"source\" (refresh the board's sources).");
  }
  const board = (project?.gameTools || []).find(tool => tool.type === "trivia-board");
  if (!board) throw new Error("This project has no saved Trivia Board to regenerate. A Trivia Board has to be added first; then regeneration is available.");
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : null;
  if (category) {
    const names = Array.isArray(board.config?.categories)
      ? board.config.categories.map((c: any) => String(c?.name || "")).filter(Boolean)
      : [];
    if (!names.includes(category)) {
      throw new Error(`The saved Trivia Board has no category named "${category}". Its categories are: ${names.join(", ") || "none yet"}. Use one of those exact names, or omit category to regenerate the whole board.`);
    }
  }
  return { type: "board-regenerate", mode: input.mode, category };
}
