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
 * Edited copies made inside a project file themselves into it with
 * their source's role (see fileEditedCopy below).
 */

/**
 * Filing and placement are separate states (Jessica, 2026-11-05 —
 * the second Kysha's Growth Lab failure: ONE flag, `inProject`, meant
 * both "filed in this project" and "placed on the overlay", so when
 * Jewel took two finished backdrops off the stage the way she had
 * been taught — setting inProject false — she un-filed them from
 * every project shelf, and generation during Imagine and Create
 * staged a fresh backdrop on the overlay uninvited because filing
 * it placed it).
 *
 * - `inProject` is FILING only: the asset belongs to this project
 *   and stands on its shelves. It is sticky — no placement
 *   operation (backdrop switching, taking an item off the overlay,
 *   wiring or removing a control) may change it. Only the explicit
 *   filing paths move it: generation and uploads inside the
 *   project, the workspace library's "+ Add to Project" toggle,
 *   and asset deletion.
 * - `inOverlayBuild` is PLACEMENT only: the asset stands on the
 *   overlay/stage as part of the build (the current background, a
 *   standing layer). An asset can also reach the audience through
 *   a dashboard control (`asset.show.<key>` / `background.show.<key>`)
 *   without standing on the overlay — that is the control's state,
 *   not the asset's.
 *
 * Assets saved before placement had its own field carry no
 * `inOverlayBuild`; for those, placement reads as the `inProject`
 * value they were written with, so nothing already built changes
 * meaning overnight. Every new write sets the field explicitly.
 */
export function assetPlaced(asset: ProjectAsset): boolean {
  return asset.inOverlayBuild !== undefined ? asset.inOverlayBuild : Boolean(asset.inProject);
}

/** The background standing on the overlay right now, if any: a
 *  placed background-role asset. Shelves and design previews read
 *  filed assets by role instead (lib/backdrop-text backgroundAssets). */
export function placedBackground(project: Project): ProjectAsset | undefined {
  return (project.assets || []).find(asset => asset.role === "background" && assetPlaced(asset));
}

/**
 * File a freshly generated asset into its project: inProject, with
 * the "+ Add to Project" role default when the asset carries no role
 * of its own (an image becomes the background when the project has
 * no background filed yet, a layer otherwise; a video is a video;
 * anything audible is audio). Filing is NOT placing: a generated
 * asset is never on the overlay until a placement action puts it
 * there, so it is stamped inOverlayBuild false. Media generated for
 * a City Crime Scene case item is filed too, but is never made the
 * backdrop — it belongs to its case item, not the overlay's opening
 * scene.
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
  return { ...asset, inProject: true, inOverlayBuild: false, role };
}

/**
 * File an edited copy made inside a project: the copy takes its
 * source's role and is filed in the project (inProject true) even
 * when its source was never filed — a copy made here belongs here.
 * Placement is NOT inherited: the copy stands on its source's shelf,
 * never on the overlay, until a placement action puts it there.
 */
export function fileEditedCopy<T extends ProjectAsset>(copy: T, source: ProjectAsset): T {
  return { ...copy, role: source.role, inProject: true, inOverlayBuild: false };
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
