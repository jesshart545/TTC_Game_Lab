import type { ProjectAsset } from "./project";
import { mediaKind } from "./board-design";

export type AssetKind = "image" | "video" | "music" | "voice" | "sfx" | "audio" | "other";
export const mediaFolders: { kind: AssetKind; label: string }[] = [
  { kind: "image", label: "Images" },
  { kind: "video", label: "Videos" },
  { kind: "music", label: "Music" },
  { kind: "voice", label: "Voice" },
  { kind: "sfx", label: "Sound effects" },
  { kind: "audio", label: "Audio" },
  { kind: "other", label: "Other files" },
];

export function assetCategory(asset: ProjectAsset): AssetKind {
  const detected = mediaKind(asset);
  const type = (asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const isAudio = detected === "audio" || type.includes("audio") || /voice|music|sfx|sound/.test(type) || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name);
  if (isAudio) {
    // The generator knows what it made; uploaded clips fall back to name hints.
    const generated = (asset.generation?.type || "").toLowerCase();
    if (generated === "voice" || asset.generation?.voice) return "voice";
    if (generated === "music") return "music";
    if (generated === "sfx") return "sfx";
    if (/voice|narration|announcer|spoken/.test(name)) return "voice";
    if (/sfx|sound effect|sound-effect/.test(name)) return "sfx";
    if (/music|song|soundtrack|intro|outro|theme/.test(name)) return "music";
    return "audio";
  }
  if (detected === "image" || detected === "video") return detected;
  if (type.includes("image") || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(name) || name.startsWith("image")) return "image";
  if (type.includes("video") || /\.(mp4|mov|webm|m4v|avi)$/i.test(name)) return "video";
  if (detected !== "unknown") return detected;
  return "other";
}

/** The "audio" filter covers every spoken/sung/sounded kind. */
export function categoryMatchesFilter(kind: AssetKind, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "audio") return kind === "audio" || kind === "music" || kind === "voice" || kind === "sfx";
  return kind === filter;
}

export function groupAssets<T extends ProjectAsset>(assets: T[]) {
  return mediaFolders.map(folder => ({
    ...folder,
    items: assets.map((asset, index) => ({ asset, index })).filter(item => assetCategory(item.asset) === folder.kind),
  })).filter(folder => folder.items.length > 0);
}
