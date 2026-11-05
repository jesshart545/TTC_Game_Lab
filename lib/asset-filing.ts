import type { Project, ProjectAsset } from "./project";
import { assetCategory } from "./asset-folders";

/**
 * How media made inside a project is filed, and how edited copies are
 * named (Jessica, 2026-11-04 — the Kysha's Growth Lab failure: Jewel
 * generated nine images for a talk show, none of them was ever filed
 * into the project, and Jewel then told the creator they were in a
 * "library/assets area on this page" that does not exist).
 *
 * The rule: what Jewel generates while working inside a project is
 * added to THAT project at generation time — inProject, with the
 * same role the workspace library's "+ Add to Project" action would
 * give it — so it stands on the project's own shelves immediately
 * (the talk backdrops shelf and media shelf, the gameshow media
 * library shelf) and the creator never has to leave the project and
 * hunt the Asset Library for something Jewel just made for them.
 * Edited copies keep the filing of the asset they were made from, so
 * a copy stands on the same shelf as its source.
 */

/**
 * File a freshly generated asset into its project: inProject, with
 * the "+ Add to Project" role default when the asset carries no role
 * of its own (an image becomes the background when the project has
 * none on the overlay yet, a layer otherwise; a video is a video;
 * anything audible is audio). Media generated for a City Crime Scene
 * case item is filed too, but is never made the backdrop — it
 * belongs to its case item, not the overlay's opening scene.
 */
export function fileGeneratedAsset(project: Project, asset: ProjectAsset, options?: { backdropEligible?: boolean }): ProjectAsset {
  const kind = assetCategory(asset);
  let role = asset.role;
  if (!role) {
    if (kind === "image") {
      const hasBackground = (project.assets || []).some(existing => existing.inProject && existing.role === "background");
      role = options?.backdropEligible === false || hasBackground ? "layer" : "background";
    } else if (kind === "video") {
      role = "video";
    } else {
      role = "audio";
    }
  }
  return { ...asset, inProject: true, role };
}

const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|avif|bmp|svg|mp4|mov|webm|m4v|mp3|wav|m4a|aac|oga|ogg|flac)$/i;

/**
 * The base name of an asset in an edit line: the name with any media
 * extension and every stacked edit suffix removed — the "(edit N)"
 * suffixes this module writes and the "-edited" suffixes older saves
 * stacked ("Image 2-edited-edited-edited" bases back to "Image 2").
 * Existing already-mangled names in saved projects are never renamed
 * retroactively; the base is only computed when a NEW copy is named.
 */
export function editBaseName(name: string): string {
  let base = String(name ?? "").trim().replace(MEDIA_EXTENSION, "");
  for (;;) {
    const stripped = base.replace(/\s*\(edit\s+\d+\)$/i, "").replace(/-edited$/i, "").trim();
    if (stripped === base) break;
    base = stripped;
  }
  return base || "Asset";
}

/**
 * The name for the next edited copy of a source asset: the base name
 * plus "(edit N)", where N continues the line — the first edit of
 * "Image 2" is "Image 2 (edit 1)", the next edit of that line (of
 * the source, or of any earlier edit) is "Image 2 (edit 2)". The
 * suffix never stacks, so a copy's name can never compound.
 */
export function nextEditName(existingNames: readonly string[], sourceName: string): string {
  const base = editBaseName(sourceName);
  let highest = 0;
  for (const existing of existingNames) {
    const raw = String(existing ?? "").trim().replace(MEDIA_EXTENSION, "");
    const match = /\(edit\s+(\d+)\)$/i.exec(raw);
    if (match && editBaseName(raw) === base) highest = Math.max(highest, Number(match[1]));
  }
  const taken = new Set(existingNames.map(name => String(name)));
  let n = highest + 1;
  while (taken.has(`${base} (edit ${n})`)) n += 1;
  return `${base} (edit ${n})`;
}
