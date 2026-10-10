import type { Project, ProjectEvent } from './project';
import { mediaKind } from './board-design';

export const additionTypes = [
  { id: 'image', label: 'Images & logos', help: 'Pick a saved image, place it on the overlay, then use Show and Hide from the host dashboard.' },
  { id: 'video', label: 'Video & animation', help: 'Pick a saved clip, set size and playback, then Play and Stop from the host dashboard.' },
  { id: 'audio', label: 'Music, voices & sounds', help: 'Pick saved audio, set volume and loop, then Play and Stop. Audio has no visible overlay piece.' },
  { id: 'question-card', label: 'Question & answer cards', help: 'Link a question pool, design both faces, then Show Question, Reveal Answer, and Clear from the host dashboard.' },
  { id: 'blank-card', label: 'Text cards', help: 'Set the card text and look, then Show and Clear from the host dashboard.' },
  { id: 'wheel', label: 'Wheels', help: 'Edit the wheel choices and look, place it on the overlay, then Spin and Hide from the host dashboard.' },
  { id: 'random-picker', label: 'Random pickers', help: 'Link an image pool or card list. One button draws an unused item, then removes it. No repeats in the same game.' },
  { id: 'coin-toss', label: 'Coin Toss', help: 'Customize the coin, place it, then Flip and Hide — or one Show → Flip → Remove cycle button.' },
  { id: 'dice', label: 'Dice', help: 'Choose sides and colors, place the die, then Roll and Hide from the host dashboard.' },
  { id: 'countdown', label: 'Timers', help: 'Set duration and look, then Show, Start/pause, Reset, and Hide from the host dashboard.' },
  { id: 'poll', label: 'Polls', help: 'Write the question and options, place the poll, then Show and Hide from the host dashboard.' },
  { id: 'scoreboard', label: 'Scoreboard', help: 'Add teams or players, choose points or strikes, then show the board and adjust scores live.' },
  { id: 'prize-list', label: 'Prize list', help: 'Add prizes and a look, then show the list and mark prizes awarded from the host dashboard.' },
  { id: 'game-tool-list', label: 'TikTok gift guide', help: 'List gift names and what each does in your game. The guide is display-only; the host runs the actions.' },
  { id: 'youtube', label: 'YouTube search', help: 'Private host search only. Search and preview stay on the dashboard; the audience sees a video only after Play on overlay.' },
  { id: 'composition', label: 'Composed scenes', help: 'Pick a scene from Asset Composer, place it, then Play and Stop from the host dashboard.' },
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
  const matches=(c:ProjectEvent)=>creation.kind === 'asset' ? c.action === `asset.show.${creation.id}`
    : creation.kind === 'composition' ? c.action === `composition.play.${creation.id}`
    : c.toolIds?.includes(creation.id) || c.action === `tool.${creation.id}` || c.action.startsWith('cards.') && c.action.endsWith(`.${creation.id}`);
  const visible=project.controls.filter(c=>!c.sequenceOnly);
  const primary = visible.filter(c=>matches(c)||c.action==='sequence'&&c.chain?.some(step=>{const action=project.controls.find(item=>item.id===step.refId);return !!action&&matches(action);}));
  const ids = new Set(primary.map(c => c.id));
  return visible.filter(c => ids.has(c.id) || c.action.startsWith('result.hide.') && ids.has(c.action.slice(12)));
}
