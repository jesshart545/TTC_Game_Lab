import type { Project, ProjectEvent } from './project';
import { mediaKind } from './board-design';

export const additionTypes = [
  { id: 'image', label: 'Images & logos', help: 'Choose an image, position it on the overlay, then name its Show and Hide buttons.' },
  { id: 'video', label: 'Video & animation', help: 'Choose a clip, set its size and playback, then connect Play and Stop buttons.' },
  { id: 'audio', label: 'Music, voices & sounds', help: 'Choose audio, set its volume and looping, then connect Play and Stop buttons. Audio has no visible overlay item.' },
  { id: 'question-card', label: 'Question & answer cards', help: 'Choose cards and their question pool, design both faces, then connect Show Question, Reveal Answer and Clear. Timers are optional.' },
  { id: 'blank-card', label: 'Text cards', help: 'Choose a card, set its text and appearance, then connect Show and Clear buttons.' },
  { id: 'wheel', label: 'Wheels', help: 'Choose a wheel, review its choices and placement, then connect Spin and Hide buttons.' },
  { id: 'random-picker', label: 'Random pickers', help: 'Choose a picker, review its entries and placement, then connect Pick and Hide buttons.' },
  { id: 'dice', label: 'Dice', help: 'Choose dice, review the settings and placement, then connect Roll and Hide buttons.' },
  { id: 'countdown', label: 'Timers', help: 'Choose a timer, set its duration and appearance, then connect Start and Hide buttons. Starting a timer does not reveal an answer.' },
  { id: 'poll', label: 'Polls', help: 'Choose a poll, review its options and placement, then connect Show and Hide buttons.' },
  { id: 'youtube', label: 'YouTube', help: 'Choose the video destination and its placement. The dashboard opens private search; the host chooses when to send a video to the overlay.' },
  { id: 'composition', label: 'Composed scenes', help: 'Choose a scene made in Asset Composer, set its placement, then connect Play and Stop buttons.' },
] as const;
export type AdditionType = typeof additionTypes[number]['id'];
export type BuildCreation = { kind: 'asset'|'tool'|'composition'; id: string; name: string };
export function creationsForType(project: Project, type: AdditionType): BuildCreation[] {
  if (type === 'image' || type === 'video' || type === 'audio') return project.assets
    .filter(a => mediaKind(a) === type && !(a.role === 'background' && a.inProject))
    .map(a => ({ kind: 'asset', id: a.storageKey || a.name, name: a.name }));
  if (type === 'composition') return (project.compositions || []).map(c => ({ kind: 'composition', id: c.id, name: c.name }));
  return project.gameTools.filter(t => t.enabled && t.type === type).map(t => ({ kind: 'tool', id: t.id, name: t.name }));
}
export function creationControls(project: Project, creation: BuildCreation): ProjectEvent[] {
  const primary = project.controls.filter(c => creation.kind === 'asset' ? c.action === `asset.show.${creation.id}`
    : creation.kind === 'composition' ? c.action === `composition.play.${creation.id}`
    : c.toolIds?.includes(creation.id) || c.action === `tool.${creation.id}` || c.action.startsWith('cards.') && c.action.endsWith(`.${creation.id}`));
  const ids = new Set(primary.map(c => c.id));
  return project.controls.filter(c => ids.has(c.id) || c.action.startsWith('result.hide.') && ids.has(c.action.slice(12)));
}
