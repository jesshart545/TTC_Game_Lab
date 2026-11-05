import type { Project, ProjectAsset } from "./project";

/**
 * Re-attaching deck references whose asset entry a stale save erased.
 *
 * Before the single-writer save lineage (PR #158), an unqueued stale
 * save could overwrite the project document with a copy that predated a
 * generated asset — erasing the asset's ENTRY from project.assets while
 * the file itself stayed in object storage and the talk deck kept
 * referencing it by storage key (the lost backdrop of
 * project-1793770257912, "Jewel Test Talk Show": the deck's sign slide
 * still points at the backdrop's key, and the file still resolves).
 * Slides resolve through project.assets (slideAsset in
 * components/TalkshowSteps.tsx), so the slide renders a placeholder for
 * a picture that was never actually deleted, and no screen offers a way
 * to attach an existing storage object back to a project.
 *
 * The heal is deliberately narrow — talk deck references only, and only
 * what the key itself proves:
 *  - the refKey must sit under the project's OWN storage prefix
 *    (projects/<projectId>/…) and have no entry in project.assets
 *    (matched by storageKey);
 *  - the file must still resolve through the app's asset-url
 *    resolution (hydrateAsset in lib/asset-store.ts — the client path
 *    behind GET /api/assets?key=). A key that does not resolve is
 *    skipped silently: no entry is ever created for a missing file;
 *  - the re-attached entry carries only what the key states: the
 *    storage key, a name rebuilt from the key's tail, the image type
 *    when the tail carries the generated " — Image" label, the
 *    background role a deck picture reference stands for, and
 *    inProject. Nothing else is reconstructed — the lost entry's text
 *    layer and generation record are gone with it and are never
 *    fabricated here.
 */

const GENERATED_IMAGE_LABEL = /(^|-)Image$/;
const STORAGE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

/** The deck refKeys (deduplicated, in deck order) that point at a file
 * under the project's own storage prefix with no asset entry left. */
export function deckOrphanRefKeys(project: Project): string[] {
  const prefix = `projects/${project.id}/`;
  const known = new Set(
    (project.assets || []).map(asset => asset.storageKey).filter((key): key is string => Boolean(key)),
  );
  const orphans: string[] = [];
  for (const slide of Array.isArray(project.talkDeck) ? project.talkDeck : []) {
    const refKey = slide?.refKey;
    if (!refKey || !refKey.startsWith(prefix) || known.has(refKey) || orphans.includes(refKey)) continue;
    orphans.push(refKey);
  }
  return orphans;
}

/** The key's tail with the storage prefix and the generated UUID gone:
 * "projects/<id>/<uuid>-Cozy-studio-backdrop-Image" reads back as the
 * name the generator gave it, minus the punctuation the storage key
 * could not keep ("Cozy studio backdrop Image"). */
export function deckOrphanName(storageKey: string): string {
  const tail = storageKey.split("/").pop() || storageKey;
  return tail.replace(STORAGE_UUID, "").replace(/-/g, " ").trim() || tail;
}

/** The minimal honest entry for one orphaned deck reference, or null
 * when the key does not identify an image — for anything else the
 * original entry's type and role cannot be derived from the key, so
 * the heal makes no claim about it rather than fabricating one. */
export function deckOrphanEntry(storageKey: string): ProjectAsset | null {
  const tail = storageKey.split("/").pop() || "";
  if (!GENERATED_IMAGE_LABEL.test(tail.replace(STORAGE_UUID, ""))) return null;
  return {
    name: deckOrphanName(storageKey),
    type: "image/png",
    storageKey,
    role: "background",
    inProject: true,
  };
}

/**
 * The project with every re-attachable deck orphan appended to its
 * assets — or null when nothing was re-attached (no orphans, or none
 * whose file still resolves), so the caller saves only on a real heal
 * and an untouched project stays completely untouched. `resolveAsset`
 * is the app's asset-url resolution (hydrateAsset): it returns the
 * entry carrying a fresh url when the file resolves and throws when it
 * does not. The input project is never mutated, so loading the healed
 * project again finds the entries present and this returns null — the
 * heal is idempotent.
 */
export async function reattachDeckOrphans(
  project: Project,
  resolveAsset: (asset: ProjectAsset) => Promise<ProjectAsset>,
): Promise<Project | null> {
  const reattached: ProjectAsset[] = [];
  for (const refKey of deckOrphanRefKeys(project)) {
    const entry = deckOrphanEntry(refKey);
    if (!entry) continue;
    try {
      reattached.push(await resolveAsset(entry));
    } catch {
      // The file does not resolve — skip silently, never invent an
      // entry for a file that is not there.
    }
  }
  if (!reattached.length) return null;
  return { ...project, assets: [...(project.assets || []), ...reattached] };
}
