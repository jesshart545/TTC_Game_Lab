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
