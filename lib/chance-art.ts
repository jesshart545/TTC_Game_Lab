import type { GameTool, GameToolType, Project, ProjectAsset } from "./project";

/**
 * The other chance games' OWN artwork (Jessica, 2026-11-15) — the
 * Plinko own-artwork pattern (lib/plinko-art) carried to the Game
 * Wheel, Dice, Higher or Lower, and Cliffhanger:
 * every tool Jewel creates is the creator's own, its artwork
 * generated from the creator's style/theme words at creation time at
 * rich game-show detail, instead of every tool wearing the same
 * code-drawn face.
 *
 * How the pieces fit, exactly as for Plinko:
 * - The model passes the creator's style/theme words in the tool
 *   config's `artStyle` field (see the Jewel prompt in
 *   app/api/jewel/route.ts and app/api/ai/route.ts).
 * - When the project page's Jewel executor creates one of these
 *   tools — or a draft edit rewrites its `artStyle` (a restyle) — it
 *   generates the artwork through the site's existing image pipeline
 *   (/api/generate-asset, the same funnel as every Jewel image),
 *   files the result into the project like any other Jewel-generated
 *   media (lib/asset-filing), and stores the asset's key on the
 *   tool's config as `artKey`.
 * - Each display renders the tool's own artwork when its surface
 *   resolves `artKey` to an asset URL via chanceArtUrl, and its
 *   standard design otherwise — a tool never renders blank over a
 *   missing key. The artwork never carries the game's labels or
 *   values: the composition locks in chanceArtPrompt leave the
 *   playing area to the code, which layers the real segments, cards,
 *   and climber over the art exactly as it does over the standard
 *   design, with identical geometry.
 * - The DICE are the special case (Jessica's ask: cartoon characters
 *   INSTEAD of the number dots — the characters stand in for the
 *   pips). The generated artwork is a single character portrait;
 *   DiceDisplay places that portrait in the pip positions, so a face
 *   shows exactly as many characters as its value — the count can
 *   never be painted wrong. Character faces are a six-sided-die
 *   feature: a die with another side count keeps its number face.
 * - If generation fails, the tool is still created with its standard
 *   design and the executor tells the creator plainly — custom art
 *   is never claimed when it does not exist.
 *
 * Like Plinko, the generation is text-to-image through the same
 * pipeline — no reference image — so the creator's style words fully
 * direct the result. (Plinko originally generated as an
 * image-to-image restyle of its shipped board; the reference
 * dominated and every board came out a near-copy, so Plinko moved to
 * this same text-to-image shape on 2026-11-15.)
 */

/** The tool config field holding the asset key of the tool's own artwork. */
export const CHANCE_ART_KEY_FIELD = "artKey";
/** The tool config field holding the creator's style/theme words for the artwork. */
export const CHANCE_ART_STYLE_FIELD = "artStyle";
/** The tools that carry their own generated artwork. */
export const chanceArtTypes: GameToolType[] = ["wheel", "dice", "higher-lower", "cliffhanger"];

export function isChanceArtType(type: unknown): type is GameToolType {
  return typeof type === "string" && (chanceArtTypes as string[]).includes(type);
}

/** The standard design each tool shows until its own artwork exists —
 *  the phrase the executor uses to tell the creator plainly when a
 *  generation did not come through. */
export const CHANCE_ART_FALLBACK_DESIGN: Partial<Record<GameToolType, string>> = {
  wheel: "the standard wheel design",
  dice: "the standard dot faces",
  "higher-lower": "the standard card table design",
  cliffhanger: "the standard mountain design",
};

const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};

/** Style words with the dollar-sign character removed (the
 *  no-dollar-signs rule is absolute, and the words feed an image
 *  prompt), whitespace collapsed, capped at a sane length. The
 *  character is built from its char code because the
 *  no-dollar-signs guards scan sources for the literal character. */
function cleanStyleWords(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.split(String.fromCharCode(36)).join("").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** The creator's style/theme words saved on a chance tool's config. */
export function chanceArtStyleOf(config: unknown): string {
  return cleanStyleWords(record(config)[CHANCE_ART_STYLE_FIELD]);
}

/** The saved asset key of a chance tool's own artwork, if any. */
export function chanceArtKeyOf(config: unknown): string {
  const raw = record(config)[CHANCE_ART_KEY_FIELD];
  return typeof raw === "string" ? raw : "";
}

/**
 * Resolve a saved chance tool's own artwork to a displayable URL:
 * the config's artKey names a project asset by storageKey (or name),
 * the same resolution every other asset-keyed display in the app
 * uses. Returns undefined when the tool has no artwork of its own,
 * or its asset is not in this project — the display then uses its
 * standard design, so a tool never renders blank over a missing key.
 */
export function chanceArtUrl(tool: GameTool, assets: ProjectAsset[] | undefined): string | undefined {
  const key = chanceArtKeyOf(tool?.config);
  if (!key) return undefined;
  const asset = (assets || []).find(a => (a.storageKey || a.name) === key);
  return asset?.url || undefined;
}

/**
 * The artwork generation prompt for one of the chance tools, built
 * by code so the composition locks hold no matter what style the
 * creator asked for: rich, detailed, glossy game-show art whose
 * playing area stays plain, because the display composites the real
 * game over the middle of the art — and no text, numbers, or
 * currency marks anywhere. The creator's style/theme words ride
 * along as the art direction; without them the tool still generates,
 * in a neutral vivid game-show styling.
 */
export function chanceArtPrompt(type: GameToolType, styleWords?: unknown): string {
  const style = cleanStyleWords(styleWords);
  const locks = "No text, no words, no letters, no numbers anywhere in the image. No dollar signs, no currency symbols.";
  const direction = style ? `Style and theme: ${style}.` : "Style and theme: vivid television game-show styling, rich colors and glossy finishes.";
  switch (type) {
    case "wheel":
      return [
        "Game-show stage artwork for a spinning prize wheel: a rich, glossy, cartoonish television stage backboard — a square panel with marquee lights, sparkle, and themed decoration concentrated around its edges and corners, and a plain, calm circular area in the center, because the game's own wheel is composited over the middle of this panel and paints its own segments and labels there. The center circle stays empty and undecorated.",
        locks, direction,
      ].join(" ");
    case "dice":
      return [
        "A single cute cartoon character portrait for a game die: one character's head and shoulders, front view, large and centered, cheerful and bold, rich glossy cartoon game art on a plain solid pale background. In the game this character stands in for the dots on the die's faces, so the portrait must read clearly at small sizes. No dice, no dots, no other characters in the image.",
        locks, direction,
      ].join(" ");
    case "higher-lower":
      return [
        "Game-show stage artwork for a card game: a rich, glossy, cartoonish card-table stage backdrop with dramatic spotlights, sparkle, and an elegant empty playing area in the center, because the game's own cards are placed over the middle of this scene by the game itself. No playing cards and no card suits anywhere in the image.",
        locks, direction,
      ].join(" ");
    case "cliffhanger":
      return [
        "Game-show stage artwork for a mountain climbing game: a rich, glossy, cartoonish alpine stage backdrop — sky, clouds, and distant snowy scenery around the edges, with a plain, calm open area in the center, because the game's own mountain and climber are drawn over the middle of this scene by the game itself. No climber, no people, no flags in the image.",
        locks, direction,
      ].join(" ");
    default:
      return ["Game-show stage artwork: a rich, glossy, cartoonish television stage scene.", locks, direction].join(" ");
  }
}

/**
 * The chance tools in `after` that need their own artwork generated
 * as part of this change: tools the change created (present in
 * `after`, absent in `before`, whose saved artKey does not resolve
 * to an asset in the project), and existing tools whose saved
 * artStyle the change actually rewrote — a restyle. An edit that
 * leaves artStyle alone never regenerates a tool's artwork, and a
 * tool whose artwork already resolves is never re-targeted by an
 * unrelated creation.
 */
export function chanceArtTargets(before: Project, after: Project): GameTool[] {
  const beforeById = new Map((before.gameTools || []).map(t => [t.id, t]));
  const targets: GameTool[] = [];
  for (const tool of after.gameTools || []) {
    if (!isChanceArtType(tool.type)) continue;
    const prior = beforeById.get(tool.id);
    if (!prior) {
      if (!chanceArtUrl(tool, after.assets)) targets.push(tool);
      continue;
    }
    const nextStyle = chanceArtStyleOf(tool.config);
    if (nextStyle && nextStyle !== chanceArtStyleOf(prior.config)) targets.push(tool);
  }
  return targets;
}
