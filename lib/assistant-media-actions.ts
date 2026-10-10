import type { ProjectAsset, ProjectAssetEdits } from "./project";

export type AssistantMediaAction =
  | { type: "edit-video"; sourceKey: string; prompt: string }
  | { type: "render-copy"; sourceKey: string; edits: ProjectAssetEdits };

export function assistantMediaKind(asset: Pick<ProjectAsset, "type" | "name" | "url">): "image" | "video" | "other" {
  const hint = `${asset.type} ${asset.name} ${(asset.url || "").split("?")[0]}`.toLowerCase();
  if (/video|image-to-video|\.mp4\b|\.webm\b|\.mov\b|\.m4v\b/.test(hint)) return "video";
  if (/image|nano-banana|\.png\b|\.jpe?g\b|\.webp\b|\.gif\b|\.avif\b/.test(hint)) return "image";
  return "other";
}

/** Accepts saved identity and supported fields only, never a model-supplied URL. */
export function checkedAssistantMediaAction(raw: unknown, assets: ProjectAsset[]): AssistantMediaAction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (input.type !== "edit-video" && input.type !== "render-copy") return null;
  if (typeof input.sourceKey !== "string" || !input.sourceKey) throw new Error("Choose the saved image or video to edit.");
  const asset = assets.find(item => (item.storageKey || item.name) === input.sourceKey);
  if (!asset) throw new Error("That saved media asset is no longer available.");
  const kind = assistantMediaKind(asset);
  if (input.type === "edit-video") {
    if (kind !== "video") throw new Error("AI video editing requires an existing video.");
    if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 3000) throw new Error("Describe the video edit in at most 3,000 characters.");
    return { type: "edit-video", sourceKey: input.sourceKey, prompt: input.prompt.trim() };
  }
  if (kind === "other" || !input.edits || typeof input.edits !== "object" || Array.isArray(input.edits)) throw new Error("Choose an image or video and supported copy edits.");
  const source = input.edits as Record<string, unknown>;
  const edits: ProjectAssetEdits = {};
  const ranges: Record<string, [number, number]> = kind === "video" ? { trimStart: [0, 36000], trimEnd: [0.01, 36000] } : {
    width: [1, 4096], height: [1, 4096], zoom: [0.1, 4], rotation: [-360, 360], opacity: [0, 1],
    brightness: [0, 200], contrast: [0, 200], saturation: [0, 200], blur: [0, 100], offsetX: [-4096, 4096], offsetY: [-4096, 4096],
  };
  for (const [key, value] of Object.entries(source)) {
    if (kind === "image" && key === "fit" && ["contain", "cover", "fill"].includes(String(value))) { edits.fit = value as ProjectAssetEdits["fit"]; continue; }
    if (kind === "image" && key === "crop" && ["original", "square", "landscape", "portrait"].includes(String(value))) { edits.crop = value as ProjectAssetEdits["crop"]; continue; }
    if (kind === "image" && ["flipX", "flipY"].includes(key) && typeof value === "boolean") { (edits as Record<string, unknown>)[key] = value; continue; }
    const range = ranges[key];
    if (!range || typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new Error(`The ${key} setting is not supported for this media copy.`);
    if ((key === "width" || key === "height") && !Number.isInteger(value)) throw new Error("Image dimensions must be whole pixels.");
    (edits as Record<string, unknown>)[key] = value;
  }
  if (!Object.keys(edits).length) throw new Error("Specify a supported edit for the new copy.");
  if (kind === "video" && edits.trimEnd !== undefined && edits.trimEnd <= (edits.trimStart || 0)) throw new Error("Trim end must be later than trim start.");
  return { type: "render-copy", sourceKey: input.sourceKey, edits };
}
