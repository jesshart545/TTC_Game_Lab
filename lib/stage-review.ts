import type { Project, ProjectEvent, TalkSlide } from './project';
import { assetPlaced } from './asset-filing';
import { creationControls, type BuildCreation } from './build-guide';

/**
 * Set the Stage review spaces (Jessica, 2026-11-04): the data path the
 * review surface stands on. Two pure pieces live here so the page's
 * rendering and the tests share exactly one definition:
 *
 * - How a talk deck moment maps to the creation it points at, and
 *   whether that moment is staged yet (it has a live dashboard clicker,
 *   or — for the sign/backdrop — it already IS the overlay's starting
 *   scene). The DeckArranger in Imagine and Create promised "the
 *   clickers that run your slides live arrive in Set the Stage"; this
 *   is how the staging surface (and Jewel, through her context) knows
 *   which moments still need one.
 *
 * - How a dashboard drag-reorder writes back into project.controls:
 *   only the visible (non-sequenceOnly) buttons move; hidden sequence
 *   steps keep their slots, and every other control — including legacy
 *   controls whose actions predate the current runtime — keeps its
 *   identity and fields. Reordering never creates or drops a control.
 */

export const DECK_SLIDE_KIND_LABELS: Record<TalkSlide['kind'], string> = {
  sign: 'Sign',
  backdrop: 'Backdrop',
  quiz: 'Quiz',
  youtube: 'YouTube',
  media: 'Media',
  composition: 'Package',
};

/** The creation a deck moment points at, for the moment kinds that get
 *  a dashboard clicker at Set the Stage. Sign and backdrop moments
 *  return null: they are the show's opening scene, not a clicker. */
export function deckSlideCreation(slide: TalkSlide): BuildCreation | null {
  if (!slide.refKey) return null;
  if (slide.kind === 'media') return { kind: 'asset', id: slide.refKey, name: slide.label };
  if (slide.kind === 'quiz' || slide.kind === 'youtube') return { kind: 'tool', id: slide.refKey, name: slide.label };
  if (slide.kind === 'composition') return { kind: 'composition', id: slide.refKey, name: slide.label };
  return null;
}

/** Is this deck moment staged — does it already reach the audience
 *  through the dashboard or the opening scene? */
export function deckMomentStaged(project: Project, slide: TalkSlide): boolean {
  const controls = project.controls || [];
  if (slide.kind === 'sign' || slide.kind === 'backdrop') {
    const asset = (project.assets || []).find(a => (a.storageKey || a.name) === slide.refKey);
    // Staged means the moment IS the overlay's starting scene: the
    // asset is PLACED as the background. Being merely filed on the
    // shelf (inProject) is not staging (lib/asset-filing).
    if (asset && assetPlaced(asset) && asset.role === 'background') return true;
    return controls.some(c => c.action === `background.show.${slide.refKey}` || c.action === `asset.show.${slide.refKey}`);
  }
  const creation = deckSlideCreation(slide);
  if (!creation) return false;
  return creationControls(project, creation).length > 0;
}

/** Write a dashboard drag-reorder back into the full controls array.
 *  `orderedVisibleIds` is the new order of the VISIBLE buttons (the
 *  ones the dashboard review shows); sequenceOnly steps and any other
 *  hidden controls keep their exact slots and objects. */
export function reorderVisibleControls(controls: ProjectEvent[], orderedVisibleIds: string[]): ProjectEvent[] {
  const byId = new Map((controls || []).map(c => [c.id, c]));
  const queue = orderedVisibleIds.map(id => byId.get(id)).filter((c): c is ProjectEvent => !!c);
  let index = 0;
  return (controls || []).map(c => (c.sequenceOnly ? c : queue[index++] ?? c));
}
