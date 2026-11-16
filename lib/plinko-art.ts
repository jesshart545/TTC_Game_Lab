import type { GameTool, Project, ProjectAsset } from "./project";

/**
 * A Plinko board's OWN artwork (Jessica, 2026-11-15): every board
 * Jewel creates is the creator's own — its artwork is generated from
 * the creator's style/theme words at creation time, at rich game-show
 * detail, instead of every board being stamped with the same shipped
 * picture. She never asked for the same artwork, values, or colors on
 * every board.
 *
 * How the pieces fit:
 * - The model passes the creator's style/theme words in the tool
 *   config's `artStyle` field (see the Jewel prompt in
 *   app/api/jewel/route.ts and app/api/ai/route.ts).
 * - When the project page's Jewel executor creates a Plinko board —
 *   or a draft edit rewrites a board's `artStyle` (a restyle) — it
 *   generates the artwork text-to-image through the site's existing
 *   image pipeline (/api/generate-asset, the same funnel as every
 *   Jewel image), from the code-built prompt in plinkoBoardArtPrompt
 *   plus the creator's style words — no reference image, exactly as
 *   the other chance tools generate theirs (lib/chance-art); an
 *   image-to-image restyle of the shipped board made every board a
 *   near-copy of it and defeated the creator's theme. It files the
 *   result into the project like any other Jewel-generated media
 *   (lib/asset-filing), and stores the asset's key on the tool's
 *   config as `boardArtKey` (the attach step is an ordinary
 *   applyBuildChanges gameTools patch, the way City Crime Scene media
 *   attaches to its case items).
 * - PlinkoDisplay (components/ChanceTools.tsx) renders the tool's own
 *   artwork when a surface resolves `boardArtKey` to an asset URL via
 *   plinkoBoardArtUrl, and the neutral house board otherwise. The artwork
 *   itself never carries values or text — the display layers the
 *   marquee title and the configured slot labels over it, exactly as
 *   it does over the house board, so the composition locks in
 *   plinkoBoardArtPrompt (blank marquee, peg field, nine EMPTY slot
 *   boxes, no text anywhere) are what make a generated board line up
 *   with that layering.
 * - If generation fails, the board is still created with the neutral
 *   house artwork and the executor tells the creator plainly — custom
 *   art is never claimed when it does not exist.
 */

/** The tool config field holding the asset key of the board's own artwork. */
export const PLINKO_BOARD_ART_FIELD = "boardArtKey";
/** The tool config field holding the creator's style/theme words for the artwork. */
export const PLINKO_ART_STYLE_FIELD = "artStyle";
/** The neutral house board every Plinko renders until it has artwork
 *  of its own — and the fallback whenever its own artwork cannot be
 *  shown. Deliberately NOT the first board Jessica uploaded (the neon
 *  cabinet): she ruled (2026-11-14, again 2026-11-15) that her board
 *  was not to become the face of every Plinko game, so the default is
 *  this purpose-made house board (deep purple + gold, blank marquee,
 *  nine empty slots, no text), a different identity from hers. */
export const PLINKO_DEFAULT_BOARD_ART = "/game-art/plinko-board-default.webp";

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

/** The creator's style/theme words saved on a Plinko tool's config. */
export function plinkoArtStyleOf(config: unknown): string {
  return cleanStyleWords(record(config)[PLINKO_ART_STYLE_FIELD]);
}

/** The saved asset key of a Plinko tool's own board artwork, if any. */
export function plinkoBoardArtKeyOf(config: unknown): string {
  const raw = record(config)[PLINKO_BOARD_ART_FIELD];
  return typeof raw === "string" ? raw : "";
}

/**
 * Resolve a saved Plinko tool's own board artwork to a displayable
 * URL: the config's boardArtKey names a project asset by storageKey
 * (or name), the same resolution every other asset-keyed display in
 * the app uses (appearance.imageKey, City Crime Scene imageKey).
 * Returns undefined when the board has no artwork of its own, or its
 * asset is not in this project — the display then uses the neutral
 * house board, so a board never renders blank over a missing key.
 * The resolver can only see the asset RECORD: if the object behind a
 * resolved URL is itself gone (a published snapshot can outlive the
 * stored file), the display's own load-failure fallback in
 * PlinkoDisplay swaps in the house board — the artwork never renders
 * blank either way.
 */
export function plinkoBoardArtUrl(tool: GameTool, assets: ProjectAsset[] | undefined): string | undefined {
  const key = plinkoBoardArtKeyOf(tool?.config);
  if (!key) return undefined;
  const asset = (assets || []).find(a => (a.storageKey || a.name) === key);
  return asset?.url || undefined;
}

/**
 * The board-artwork generation prompt, built by code so the
 * composition locks hold no matter what style the creator asked for:
 * a front-facing cabinet, a wide marquee band with NO lettering, a
 * peg field, exactly nine EMPTY slot boxes along the bottom (the
 * display writes the board's own slot labels over them), and no text
 * or currency marks anywhere. The creator's style/theme words ride
 * along as the art direction; without them the board still generates,
 * in a neutral vivid game-show styling. One clause is unconditional:
 * the quality floor. Jessica's uploaded board set the DETAIL bar for
 * every board the site generates — but generated boards must always
 * be ORIGINAL designs from the requesting creator's own spec, never
 * the same as or resembling hers. So the clause benchmarks detail
 * and finish against a generic flagship television game-show cabinet
 * only: it never names, describes, or evokes her board's identity,
 * and the design direction comes from the creator's words alone.
 */
export function plinkoBoardArtPrompt(styleWords?: unknown): string {
  const style = cleanStyleWords(styleWords);
  return [
    "Plinko board artwork for a television game show: a front-facing Plinko game cabinet standing on a glossy game-show stage, seen straight on — rich, detailed, glossy art with bright marquee lights and polished reflections.",
    "A wide empty marquee band stretches across the top of the cabinet, with no lettering on it.",
    "Below the marquee, a tall field of round metal pegs in offset rows.",
    "Along the very bottom, a single row of exactly nine empty open slot boxes side by side, with nothing inside them — the game writes its own prize labels over the slots, so the boxes stay blank.",
    "No text, no words, no letters, no numbers anywhere in the image. No dollar signs, no currency symbols, no markings on any ball or coin.",
    "Quality floor, whatever the theme: richly detailed, glossy, premium television game-show finish — glowing marquee bulbs, polished reflective surfaces, and real depth and shading — detail and finish at the level of a flagship television game-show cabinet; never flat, plain, or cheap-looking, and always an original design built from the creator's own specification.",
    style ? `Style and theme: ${style}.` : "Style and theme: vivid television game-show styling, rich colors and glossy finishes.",
  ].join(" ");
}

/**
 * The Plinko boards in `after` that need their own artwork generated
 * as part of this change: boards the change created (present in
 * `after`, absent in `before`, carrying no artwork yet), and existing
 * boards whose saved artStyle the change actually rewrote — a
 * restyle. An edit that leaves artStyle alone never regenerates a
 * board's artwork, and a board that already has artwork is never
 * re-targeted by an unrelated creation.
 */
export function plinkoArtTargets(before: Project, after: Project): GameTool[] {
  const beforeById = new Map((before.gameTools || []).map(t => [t.id, t]));
  const targets: GameTool[] = [];
  for (const tool of after.gameTools || []) {
    if (tool.type !== "plinko") continue;
    const prior = beforeById.get(tool.id);
    if (!prior) {
      if (!plinkoBoardArtKeyOf(tool.config)) targets.push(tool);
      continue;
    }
    const nextStyle = plinkoArtStyleOf(tool.config);
    if (nextStyle && nextStyle !== plinkoArtStyleOf(prior.config)) targets.push(tool);
  }
  return targets;
}
