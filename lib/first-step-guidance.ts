import type { Project } from "./project";

export type EntryStages = Partial<Record<number, boolean>>;
const storageKey = (projectId: string) => `ttc-entry-guide:${projectId}`;

export function readEntryStages(projectId: string): EntryStages {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey(projectId)) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const result: EntryStages = {};
    for (const stage of [0, 1, 2]) if (typeof stored[stage] === "boolean") result[stage] = stored[stage];
    return result;
  } catch { return {}; }
}

export function rememberEntryStages(projectId: string, stages: EntryStages) {
  try { window.sessionStorage.setItem(storageKey(projectId), JSON.stringify(stages)); } catch {}
}

// Evidence that an entry action happened, never proof of completion or testing.
export function hasExistingEntryAction(project: Project, stage: number): boolean {
  if (stage === 0) return Object.values(project.gamePlan || {}).some(value => String(value || "").trim().length > 0)
    || project.assets.length > 0 || project.gameTools.length > 0 || (project.compositions || []).length > 0;
  if (stage === 1) return project.assets.some(asset => asset.inProject && asset.role === "background")
    || project.gameTools.some(tool => tool.enabled && tool.inOverlayBuild && ["blank-board", "trivia-board"].includes(tool.type));
  return stage === 2 && Boolean(project.publishedSnapshot);
}
