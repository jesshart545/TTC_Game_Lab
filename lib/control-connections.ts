import type { Project, ProjectEvent } from './project';
import { cardControl } from './question-cards';

export function controlConnectionError(project: Project, control: ProjectEvent): string | null {
  if (!control.action?.trim() && !control.toolIds?.length && !control.compositionId && !(control.buttonMode === 'chain' && control.chain?.length)) {
    return 'Choose an action for this dashboard button in Build Space before using it.';
  }
  if(control.action?.startsWith('asset.show.'))return project.assets.some(a=>(a.storageKey||a.name)===control.action.slice(11)&&a.url)?null:'Choose an available media file for this control.';
  if(control.action?.startsWith('result.hide.'))return project.controls.some(c=>c.id===control.action.slice(12))?null:'The display control for this Hide button is missing.';
  const card = cardControl(control.action || '');
  if (card) {
    const tool = project.gameTools.find(t => t.id === card.toolId && t.enabled);
    if (!tool || (tool.type !== 'question-card' && !(tool.type==='random-picker'&&['draw','clear','new-game'].includes(card.action)) && !(tool.type==='blank-card' && ['blank','clear','new-game'].includes(card.action)))) return 'This button is not connected to an available question card. Choose its action again in Build Space.';
  }
  const ids = card ? [] : [...(control.toolIds || []), ...(control.action?.startsWith('tool.') ? [control.action.slice(5)] : []), ...(control.buttonMode === 'chain' ? (control.chain || []).filter(s => s.kind === 'tool').map(s => s.refId) : [])];
  for (const id of ids) {
    const tool = project.gameTools.find(t => t.id === id && t.enabled);
    if (!tool) return 'A connected tool is unavailable. Choose an available tool in Build Space.';
    if (tool.type === 'question-card') return 'Choose a specific card action, such as Show Question or Reveal Answer, in Build Space.';
    if (tool.type === 'blank-card') return 'Use the blank card panel on the dashboard to enter text and show the card.';
  }
  return null;
}

export function assignControlAction(project: Project, control: ProjectEvent, action: string): ProjectEvent {
  const card = cardControl(action);
  const tool = project.gameTools.find(t => t.id === card?.toolId || action === `tool.${t.id}`);
  const composition = project.compositions?.find(c => action === `composition.play.${c.id}`);
  return {...control, action, toolIds: tool ? [tool.id] : [], compositionId: composition?.id,
    detail: card && tool ? `${card.action}: ${tool.name}` : tool ? `Open ${tool.name}` : composition ? `Play ${composition.name}` : action.startsWith('background.show.') ? 'Change background' : 'Unassigned dashboard button'};
}

export function connectQuestionCard(project: Project, toolId: string): Project {
  const tool = project.gameTools.find(t => t.id === toolId && t.type === 'question-card' && t.enabled);
  if (!tool) return project;
  // Repair legacy generic buttons without changing their labels or appearance.
  const controls = project.controls.map(c => c.action === `tool.${toolId}` ? assignControlAction(project, c, `cards.show.${toolId}`) : c);
  for (const [action, label] of [['show', 'Show Question'], ['reveal', 'Reveal Answer']]) {
    if (!controls.some(c => c.action === `cards.${action}.${toolId}`)) controls.push({id: crypto.randomUUID(), label: `${label}: ${tool.name}`, action: `cards.${action}.${toolId}`, detail: `${label}: ${tool.name}`, toolIds: [toolId]});
  }
  return {...project, controls, gameTools: project.gameTools.map(t => t.id === toolId ? {...t, inToolbox: true, inOverlayBuild: true} : t)};
}
