import type { Project, ProjectAsset } from "./project";

/**
 * Plain-language, value-level summary of what a Jewel draft edit actually
 * changed, computed by diffing the project before and after the executor
 * applied it. Jewel's own reply describes intent; this list is the receipt —
 * real names, real sizes and positions on the 1920x1080 canvas — so a creator
 * never has to dig through Customize to verify what happened.
 */

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const px = (pct: unknown, full: number) => Math.max(0, Math.round(((Number(pct) || 0) / 100) * full));

const FIT_WORDS: Record<string, string> = {
  contain: "show the whole item (empty edges possible)",
  cover: "fill the frame (edges may be cropped)",
  fill: "stretch to fill the frame",
};

function assetKey(asset: ProjectAsset) {
  return asset.storageKey || asset.name;
}

function assetEditLines(before: ProjectAsset, after: ProjectAsset): string[] {
  const lines: string[] = [];
  const name = after.name;
  const b = before.edits || {};
  const a = after.edits || {};
  if (a.fit && String(b.fit || "") !== String(a.fit)) lines.push(`"${name}": fit set to ${a.fit} — ${FIT_WORDS[String(a.fit)] || a.fit}`);
  if (a.placement && JSON.stringify(b.placement || null) !== JSON.stringify(a.placement)) {
    lines.push(`"${name}": size ${px(a.placement.width, CANVAS_W)} × ${px(a.placement.height, CANVAS_H)}, placed at ${px(a.placement.x, CANVAS_W)}, ${px(a.placement.y, CANVAS_H)}`);
  }
  const numeric: [string, string, string][] = [
    ["zoom", "zoom", "×"],
    ["rotation", "rotation", "°"],
    ["brightness", "brightness", "%"],
    ["contrast", "contrast", "%"],
    ["saturation", "saturation", "%"],
    ["volume", "volume", ""],
  ];
  for (const [key, label, unit] of numeric) {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (av !== undefined && av !== bv) lines.push(`"${name}": ${label} set to ${av}${unit}`);
  }
  if ((a.trimStart !== undefined || a.trimEnd !== undefined) && (a.trimStart !== b.trimStart || a.trimEnd !== b.trimEnd)) {
    lines.push(`"${name}": trimmed to ${a.trimStart ?? 0}s – ${a.trimEnd ?? "?"}s`);
  }
  if (a.loop !== undefined && a.loop !== b.loop) lines.push(`"${name}": looping ${a.loop ? "on" : "off"}`);
  return lines;
}

export function detailedChangeLines(before: Project, after: Project): string[] {
  const lines: string[] = [];

  if (before.name !== after.name) lines.push(`Project renamed to "${after.name}"`);
  if (before.overlay?.title !== after.overlay?.title && after.overlay?.title) lines.push(`Overlay title set to "${after.overlay.title}"`);
  if (before.overlay?.subtitle !== after.overlay?.subtitle && after.overlay?.subtitle) lines.push(`Overlay subtitle set to "${after.overlay.subtitle}"`);

  const beforeAssets = new Map((before.assets || []).map(asset => [assetKey(asset), asset]));
  for (const asset of after.assets || []) {
    const old = beforeAssets.get(assetKey(asset));
    if (!old) { lines.push(`Added "${asset.name}" to your assets`); continue; }
    lines.push(...assetEditLines(old, asset));
    if (Boolean(old.inProject) !== Boolean(asset.inProject)) lines.push(asset.inProject ? `"${asset.name}" is now on the overlay` : `"${asset.name}" was taken off the overlay`);
    if (old.role !== asset.role && asset.role === "background") lines.push(`"${asset.name}" is now the background`);
  }

  const beforeControls = new Map((before.controls || []).map(control => [control.id, control]));
  for (const control of after.controls || []) {
    const old = beforeControls.get(control.id);
    if (!old) { if (!control.sequenceOnly) lines.push(`Added button "${control.label}"`); continue; }
    if (old.label !== control.label) lines.push(`Renamed button "${old.label}" to "${control.label}"`);
    const bo = old.overlayResult;
    const ao = control.overlayResult;
    if (bo && ao) {
      if (bo.width !== ao.width || bo.height !== ao.height) lines.push(`Button "${control.label}": item size ${px(bo.width, CANVAS_W)} × ${px(bo.height, CANVAS_H)} → ${px(ao.width, CANVAS_W)} × ${px(ao.height, CANVAS_H)}`);
      if (bo.x !== ao.x || bo.y !== ao.y) lines.push(`Button "${control.label}": item moved to ${px(ao.x, CANVAS_W)}, ${px(ao.y, CANVAS_H)}`);
    }
    if (old.action !== control.action) lines.push(`Button "${control.label}": what it does changed`);
  }
  for (const control of before.controls || []) {
    if (!(after.controls || []).some(item => item.id === control.id) && !control.sequenceOnly) lines.push(`Removed button "${control.label}"`);
  }

  const beforeTools = new Map((before.gameTools || []).map(tool => [tool.id, tool]));
  for (const tool of after.gameTools || []) {
    const old = beforeTools.get(tool.id);
    if (!old) { lines.push(`Added "${tool.name}"`); continue; }
    if (old.name !== tool.name) lines.push(`Renamed "${old.name}" to "${tool.name}"`);
    if (tool.config?.seconds !== undefined && old.config?.seconds !== tool.config?.seconds) lines.push(`"${tool.name}": length set to ${tool.config.seconds} seconds`);
    const oldEntries = Array.isArray(old.config?.entries) ? old.config.entries.length : undefined;
    const newEntries = Array.isArray(tool.config?.entries) ? tool.config.entries.length : undefined;
    if (oldEntries !== undefined && newEntries !== undefined && oldEntries !== newEntries) lines.push(`"${tool.name}": ${newEntries} entries`);
  }

  if (lines.length > 8) return [...lines.slice(0, 8), `…and ${lines.length - 8} more changes`];
  return lines;
}
