import type { Project, ProjectEvent } from './project';
import {sequenceControls} from './sequences';
import { cardControl } from './question-cards';

export function removeLegacyCardTimers(project: Project): Project {
  const cardIds = new Set(project.gameTools.filter(tool => tool.type === 'question-card').map(tool => tool.id));
  const controls = project.controls.filter(control => ![...cardIds].some(id => control.action === `cards.turn.${id}` || control.action === `cards.steal.${id}`));
  const gameTools = project.gameTools.map(tool => tool.type !== 'question-card' ? tool : {
    ...tool,
    config: Object.fromEntries(Object.entries(tool.config).filter(([key]) => key !== 'turnTimerId' && key !== 'stealTimerId')),
  });
  return { ...project, controls, gameTools };
}

export function controlConnectionError(project: Project, control: ProjectEvent): string | null {
  if (!control.action?.trim() && !control.toolIds?.length && !control.compositionId && !(control.buttonMode === 'chain' && control.chain?.length)) {
    return 'Choose an action for this dashboard button in Build Space before using it.';
  }
  if(control.action?.startsWith('coin.cycle.'))return project.gameTools.some(tool=>tool.id===control.action.slice(11)&&tool.type==='coin-toss'&&tool.enabled)?null:'Choose an available Coin Toss tool for this button.';
  if(control.action?.startsWith('asset.show.'))return project.assets.some(a=>(a.storageKey||a.name)===control.action.slice(11)&&a.url)?null:'Choose an available media file for this control.';
  if(control.action?.startsWith('result.hide.'))return project.controls.some(c=>c.id===control.action.slice(12))?null:'The display control for this Hide button is missing.';
  if(control.action==='sequence'){try{for(const step of sequenceControls(project,control)){const error=controlConnectionError(project,step.control);if(error)return error;}return null;}catch(error){return error instanceof Error?error.message:'Check the sequence actions.';}}
  const card = cardControl(control.action || '');
  if (card) {
    const tool = project.gameTools.find(t => t.id === card.toolId && t.enabled);
    if (!tool || (tool.type !== 'question-card' && !(tool.type==='random-picker'&&['toggle','draw','clear','new-game'].includes(card.action)) && !(['scoreboard','prize-list','game-tool-list'].includes(tool.type)&&['toggle','score','award','clear','new-game'].includes(card.action)) && !(tool.type==='blank-card' && ['blank','clear','new-game'].includes(card.action)))) return 'This button is not connected to an available question card. Choose its action again in Build Space.';
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
  const tool = project.gameTools.find(t => t.id === card?.toolId || action === `tool.${t.id}` || action === `coin.cycle.${t.id}`);
  const composition = project.compositions?.find(c => action === `composition.play.${c.id}`);
  return {...control, action, toolIds: tool ? [tool.id] : [], compositionId: composition?.id,
    detail: card && tool ? `${card.action}: ${tool.name}` : tool ? `Open ${tool.name}` : composition ? `Play ${composition.name}` : action.startsWith('background.show.') ? 'Change background' : 'Unassigned dashboard button'};
}

export function connectQuestionCard(project: Project, toolId: string): Project {
  const tool = project.gameTools.find(t => t.id === toolId && t.type === 'question-card' && t.enabled);
  if (!tool) return project;
  // Repair legacy generic buttons without changing their labels or appearance.
  const controls = project.controls
    .filter(c => c.action !== `cards.turn.${toolId}` && c.action !== `cards.steal.${toolId}`)
    .map(c => c.action === `tool.${toolId}` ? assignControlAction(project, c, `cards.show.${toolId}`) : c);
  for (const [action, label] of [['show', 'Show Question'], ['reveal', 'Reveal Answer']]) {
    if (!controls.some(c => c.action === `cards.${action}.${toolId}`)) controls.push({id: crypto.randomUUID(), label: `${label}: ${tool.name}`, action: `cards.${action}.${toolId}`, detail: `${label}: ${tool.name}`, toolIds: [toolId]});
  }
  return {...project, controls, gameTools: project.gameTools.map(t => t.id === toolId ? {...t, config: Object.fromEntries(Object.entries(t.config).filter(([key]) => key !== 'turnTimerId' && key !== 'stealTimerId')), inToolbox: true, inOverlayBuild: true} : t)};
}
