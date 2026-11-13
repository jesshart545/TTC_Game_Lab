import type { Project, ProjectEvent } from "./project";

/**
 * Deleting a game tool from a project (owner request, 2026-11-12). The
 * asset shelf has had a Delete button for a long time, but a game tool
 * could never be removed at all — duplicate tools (seven identical
 * Question Cards tools in one real project) piled up with no
 * user-facing way out.
 *
 * removeGameTool is the whole cascade as one pure function, so the page
 * handler stays a thin "derive from the latest project ref, save
 * through the guarded queue" wrapper and the rules stay unit-testable:
 *
 * - The tool leaves project.gameTools. Its overlay placement goes with
 *   it: a tool's place on the overlay build lives in the tool record
 *   itself (inOverlayBuild + config.placement), and the Set the Stage
 *   dashboard panels render from the tool list, so both disappear.
 * - A dashboard control whose ACTION targets this tool specifically
 *   (tool.<id>, cards.<verb>.<id>, timer.<op>.<id>, coin.cycle.<id>) is
 *   removed entirely — that button exists only to run this tool.
 * - A control whose toolIds is exactly [toolId] is removed entirely.
 * - A control shared with other tools (toolIds longer than one, action
 *   not aimed at this tool) is KEPT, with this tool's id dropped from
 *   its toolIds.
 * - A Hide/Stop control minted for a removed control (its action is
 *   result.hide.<removedControlId>) is removed with it.
 * - Chain steps on surviving controls that point at this tool (kind
 *   "tool", refId = toolId) or at a removed control (kind "control")
 *   are dropped, so no sequence is left pressing something that is gone.
 * - The tool's preview card state (project.cardPreviewStates[toolId])
 *   is cleared. Live published card state is server-side, keyed by tool
 *   id, and inert once the tool is gone: the card server looks the tool
 *   up in gameTools before touching any state.
 *
 * NEVER removed: trivia lists and question pools (a question-card
 * tool's list is a separate tool and stays), assets, asset pools,
 * compositions, or any other tool.
 */

function actionTargetsTool(action: string | undefined, toolId: string): boolean {
  if (!action) return false;
  if (action === `tool.${toolId}`) return true;
  const match = /^(?:cards|timer)\.[a-z-]+\.(.+)$/.exec(action) || /^coin\.cycle\.(.+)$/.exec(action);
  return !!match && match[1] === toolId;
}

export function removeGameTool(project: Project, toolId: string): Project {
  if (!(project.gameTools || []).some(tool => tool.id === toolId)) return project;

  const removedControlIds = new Set<string>();
  const kept: ProjectEvent[] = [];
  for (const control of project.controls || []) {
    const ids = control.toolIds || [];
    const soleToolControl = ids.length === 1 && ids[0] === toolId;
    if (soleToolControl || actionTargetsTool(control.action, toolId)) {
      removedControlIds.add(control.id);
      continue;
    }
    kept.push(ids.includes(toolId) ? { ...control, toolIds: ids.filter(id => id !== toolId) } : control);
  }

  // Hide/Stop controls (action result.hide.<controlId>) exist only to
  // dismiss one specific control's result; when that control goes, they
  // go too. Loop to a fixpoint in case a hide control is itself hidden
  // by another.
  let controls = kept;
  for (;;) {
    const before = controls.length;
    controls = controls.filter(control => {
      const hideTarget = /^result\.hide\.(.+)$/.exec(control.action || "")?.[1];
      if (hideTarget && removedControlIds.has(hideTarget)) {
        removedControlIds.add(control.id);
        return false;
      }
      return true;
    });
    if (controls.length === before) break;
  }

  // Surviving sequence controls keep their other steps; steps that ran
  // this tool or a now-removed control are dropped.
  controls = controls.map(control => {
    if (!control.chain?.length) return control;
    const chain = control.chain.filter(step =>
      !(step.kind === "tool" && step.refId === toolId) &&
      !(step.kind === "control" && removedControlIds.has(step.refId)));
    return chain.length === control.chain.length ? control : { ...control, chain };
  });

  const next: Project = {
    ...project,
    gameTools: (project.gameTools || []).filter(tool => tool.id !== toolId),
    controls,
  };
  if (project.cardPreviewStates && toolId in project.cardPreviewStates) {
    const cardPreviewStates = { ...project.cardPreviewStates };
    delete cardPreviewStates[toolId];
    next.cardPreviewStates = cardPreviewStates;
  }
  return next;
}
