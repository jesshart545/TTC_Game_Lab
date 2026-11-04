import type { BackdropTextSpec, Project, ProjectAsset } from "./project";
import { isSupportedFont, resolveFont } from "./fonts";

/**
 * The backdrop text layer: a show title (or any short line) rendered as a
 * REAL text layer over a background asset — a DOM element in the font and
 * colors the creator chose. AI image models garble lettering and cannot
 * honor a font, so the text is never burned into the artwork; it lives in
 * this spec on the asset and is drawn over the background everywhere the
 * background renders (workshop preview, Build Space preview, published
 * overlay). The talk show SIGN is this mechanism with the show's name as
 * the text on the project's sign backdrop.
 */

export const BACKDROP_TEXT_MAX = 120;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A hex color (#rgb or #rrggbb) or undefined — anything else is rejected. */
export function cleanHexColor(value: unknown): string | undefined {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : undefined;
}

/**
 * Validate an untrusted text spec. Returns null when the spec cannot be
 * honored exactly: empty/overlong text, a font outside the site catalog
 * (lib/fonts.ts), or a color that is not a hex value. Callers drop the
 * change rather than silently swapping in a different font.
 */
export function cleanBackdropText(value: unknown): BackdropTextSpec | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const text = typeof raw.text === "string" ? raw.text.trim().replace(/\s+/g, " ") : "";
  if (!text || text.length > BACKDROP_TEXT_MAX) return null;
  if (typeof raw.fontFamily !== "string" || !isSupportedFont(raw.fontFamily)) return null;
  const textColor = cleanHexColor(raw.textColor);
  if (!textColor) return null;
  const accentColor = raw.accentColor === undefined ? undefined : cleanHexColor(raw.accentColor);
  if (raw.accentColor !== undefined && !accentColor) return null;
  const presentation = raw.presentation === undefined ? undefined : raw.presentation;
  if (presentation !== undefined && presentation !== "plain" && presentation !== "bubble" && presentation !== "frame") return null;
  return { text, fontFamily: resolveFont(raw.fontFamily), textColor, ...(accentColor ? { accentColor } : {}), ...(presentation ? { presentation } : {}) };
}

/** The valid text layer on an asset, or null when it has none. */
export function assetBackdropText(asset: ProjectAsset | null | undefined): BackdropTextSpec | null {
  if (!asset) return null;
  return cleanBackdropText(asset.textOverlay);
}

/**
 * The valid OPENING PROMPT layer on an asset, or null: the talk show's
 * talking-point text, drawn over the background in the creator's chosen
 * font, color, and presentation (thought bubble, frame, or plain). It is
 * the same real-text-layer machinery as the sign lettering, kept in its
 * own field so a background can carry both its sign and its prompt.
 */
export function assetPromptText(asset: ProjectAsset | null | undefined): BackdropTextSpec | null {
  if (!asset) return null;
  return cleanBackdropText(asset.promptOverlay);
}

/** The background asset that carries the show's opening prompt, if any:
 * the overlay background first, then backgrounds in saved order. */
export function promptAsset(project: Project): ProjectAsset | null {
  const backgrounds = backgroundAssets(project);
  return backgrounds.find(asset => asset.inProject && assetPromptText(asset))
    || backgrounds.find(asset => assetPromptText(asset))
    || null;
}

/** Opening-prompt evaluator fact: a background carries a valid prompt layer. */
export function promptPresent(project: Project): boolean {
  return Boolean(promptAsset(project));
}

/** Background-role assets (the ones the overlay background slot can show). */
export function backgroundAssets(project: Project): ProjectAsset[] {
  return (project.assets || []).filter(asset => asset.role === "background");
}

/**
 * The project's sign backdrop: an asset the creator (or Jewel) flagged as
 * the sign — Jewel's made sign or the creator's own uploaded sign — or a
 * background whose text layer IS the show's name.
 */
export function findSignAsset(project: Project): ProjectAsset | null {
  const assets = project.assets || [];
  const flagged = assets.find(asset => asset.sign === true);
  if (flagged) return flagged;
  const name = (project.name || "").trim().toLowerCase();
  if (!name) return null;
  return backgroundAssets(project).find(asset => assetBackdropText(asset)?.text.trim().toLowerCase() === name) || null;
}

/** Sign step evaluator fact: a real show name AND a sign present. */
export function signPresent(project: Project): boolean {
  return Boolean((project.name || "").trim()) && Boolean(findSignAsset(project));
}

/**
 * Sizing the backdrop text layers (components/BackdropText.tsx). The fit
 * finds the largest font size whose greedy wrap fits the background's
 * box — for the SIGN that maximize-to-fill behavior is the design: a
 * show's title should letter big. The opening PROMPT is a different
 * role — a talking-point sentence worn LOW on the background, a
 * lower-third caption — and the spec carries no size of its own, so
 * left to the title's fit a sentence grows to title scale (at the
 * overlay's native 1920×1080 the sample prompt fit near 180px a line,
 * three lines deep, burying the sign and the backdrop under it). The
 * prompt's fit is therefore capped like a broadcast lower-third: no
 * line taller than this share of the frame's height…
 */
export const PROMPT_LINE_MAX_RATIO = 0.065;
/** …and the whole prompt block within this share of the frame. */
export const PROMPT_BLOCK_MAX_RATIO = 0.32;
/** The block budget the title fit has always used. */
const TITLE_BLOCK_MAX_RATIO = 0.78;

/** What a measure reports for a string at a given px size: its advance
 *  width and its INK extents — how far the painted glyphs can reach
 *  above and below the baseline, i.e. the font's full bounding
 *  extents. Display and script fonts paint far outside their line
 *  box (a script face's painted extent can span ~1.5em against a
 *  1.16em line height, beyond even its tight glyph box), so a fit
 *  budgeted on the line box alone lets the first line's ascenders
 *  paint past the frame's edge: measured in a real browser at the
 *  review canvas, a script sign's line box sat fully inside the
 *  canvas while its ink crossed the top and was cropped by the
 *  frame's overflow. The fit below budgets the ink. */
export type BackdropTextMeasure = { width: number; inkAscent: number; inkDescent: number };

/**
 * The auto-fit both backdrop text layers share. `measure` reports a
 * string's rendered width and ink extents at a given px size (the
 * component passes a canvas measure; tests pass a fixed one).
 * `lower: true` applies the opening prompt's lower-third caps above;
 * the sign keeps its maximize-to-fill fit, now ink-budgeted like the
 * prompt. Render-time only — saved specs are never rewritten.
 */
export function fitBackdropTextSize(args: {
  text: string;
  width: number;
  height: number;
  lower?: boolean;
  measure: (text: string, px: number) => BackdropTextMeasure;
}): number {
  const { text, width, height, lower, measure } = args;
  const words = text.split(/\s+/).filter(Boolean);
  const blockRatio = lower ? PROMPT_BLOCK_MAX_RATIO : TITLE_BLOCK_MAX_RATIO;
  // Font ink metrics scale linearly with px; sample them once.
  const sampled = measure(text, 100);
  const inkPerPx = Math.max(0, (sampled.inkAscent + sampled.inkDescent) / 100);
  const fits = (px: number) => {
    const maxWidth = width * 0.88;
    let lines = 1, line = "";
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (measure(trial, px).width > maxWidth && line) {
        lines += 1; line = word;
        if (measure(word, px).width > maxWidth) return false;
      } else line = trial;
    }
    // The block's painted height: every line after the first adds a
    // line height; the ink itself spans inkPerPx per px of font size.
    const inkBlock = (lines - 1) * px * 1.16 + inkPerPx * px;
    return inkBlock <= height * blockRatio;
  };
  let low = 10, high = Math.max(12, Math.floor(height * 0.85)), best = low;
  if (lower) high = Math.min(high, Math.max(low, Math.floor(height * PROMPT_LINE_MAX_RATIO)));
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (fits(mid)) { best = mid; low = mid + 1; } else high = mid - 1;
  }
  return best;
}
