import { OverlayResult, Project, ProjectAssetEdits } from "./project";

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, limit = 120) => typeof value === "string" ? value.trim().slice(0, limit) : undefined;
const number = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;

export function applyDraftChanges(project: Project, input: unknown) {
  const changes = object(input);
  let applied = 0;
  const next: Project = { ...project, overlay: { ...project.overlay }, assets: project.assets.map(asset => ({ ...asset })), compositions: (project.compositions || []).map(c => ({ ...c, clips: c.clips.map(clip => ({ ...clip })) })), controls: project.controls.map(c => ({ ...c })) };
  if (["cyan", "purple", "pink"].includes(String(changes.theme)) && next.theme !== changes.theme) { next.theme = changes.theme as Project["theme"]; applied++; }
  const overlay = object(changes.overlay);
  for (const key of ["title", "subtitle"] as const) { const value = text(overlay[key]); if (value !== undefined && value !== next.overlay[key]) { next.overlay[key] = value; applied++; } }
  for (const key of ["showChat", "showAlerts", "showCharacter"] as const) if (typeof overlay[key] === "boolean" && next.overlay[key] !== overlay[key]) { next.overlay[key] = overlay[key] as boolean; applied++; }
  if (Array.isArray(changes.assets)) for (const raw of changes.assets) {
    const edit = object(raw), asset = next.assets.find(a => a.storageKey && a.storageKey === edit.storageKey); if (!asset) continue;
    if (typeof edit.inProject === "boolean") { asset.inProject = edit.inProject; applied++; }
    if (["background", "layer", "video", "audio"].includes(String(edit.role))) { asset.role = edit.role as typeof asset.role; applied++; }
    const values = object(edit.edits);
    for (const key of ["zoom", "rotation", "opacity", "brightness", "contrast", "saturation", "blur", "offsetX", "offsetY", "trimStart", "trimEnd"] as (keyof ProjectAssetEdits)[]) {
      const value = number(values[key], key === "opacity" ? 0 : -10000, 10000);
      if (value !== undefined) { asset.edits = { ...asset.edits, [key]: value }; applied++; }
    }
  }
  if (Array.isArray(changes.compositions)) for (const raw of changes.compositions) {
    const edit = object(raw), composition = next.compositions?.find(c => c.id === edit.id); if (!composition) continue;
    const name = text(edit.name); if (name) { composition.name = name; applied++; }
    if (typeof edit.inProject === "boolean") { composition.inProject = edit.inProject; applied++; }
    if (Array.isArray(edit.clips)) for (const rawClip of edit.clips) {
      const change = object(rawClip), clip = composition.clips.find(c => c.id === change.id); if (!clip) continue;
      for (const key of ["start", "duration", "trimStart", "volume", "fadeIn", "fadeOut", "playbackRate"] as const) {
        const value = number(change[key], key === "duration" || key === "playbackRate" ? .1 : 0, key === "volume" ? 1 : 3600);
        if (value !== undefined) { clip[key] = value; applied++; }
      }
      if (typeof change.loop === "boolean") { clip.loop = change.loop; applied++; }
      for (const key of ["text", "effect"] as const) { const value = text(change[key], 500); if (value !== undefined && clip.track === key) { clip[key] = value; applied++; } }
    }
    composition.duration = Math.max(1, ...composition.clips.map(c => c.start + c.duration));
  }
  if (Array.isArray(changes.controls)) for (const raw of changes.controls) {
    const edit = object(raw), control = next.controls.find(c => c.id === edit.id); if (!control) continue;
    const label = text(edit.label, 80); if (label) { control.label = label; applied++; }
    if (typeof edit.compositionId === "string" && next.compositions?.some(c => c.id === edit.compositionId && c.inProject)) { control.compositionId = edit.compositionId; applied++; }
    const result = object(edit.overlayResult);
    const placement = { ...(control.overlayResult || { x: 0, y: 0, width: 100, height: 100, entrance: "fade", exit: "fade", entranceSeconds: .3, exitSeconds: .3, layer: 10 }) };
    let touched = false;
    for (const key of ["x", "y", "width", "height", "entranceSeconds", "exitSeconds", "layer"] as const) { const value = number(result[key], key === "width" || key === "height" ? 1 : 0, key === "layer" ? 100 : 100); if (value !== undefined) { placement[key] = value; touched = true; applied++; } }
    for (const key of ["entrance", "exit"] as const) if (["none", "fade", "slide", "zoom"].includes(String(result[key]))) { placement[key] = result[key] as OverlayResult[typeof key]; touched = true; applied++; }
    if (touched) control.overlayResult = placement;
  }
  return { project: next, applied };
}
