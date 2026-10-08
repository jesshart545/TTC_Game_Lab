import type { ProjectAsset } from "./project";
import { mediaKind } from "./board-design";

export type AssetKind = "image" | "video" | "audio" | "other";
export const mediaFolders: { kind: AssetKind; label: string }[] = [
  { kind: "image", label: "Images" },
  { kind: "video", label: "Videos" },
  { kind: "audio", label: "Audio" },
  { kind: "other", label: "Other files" },
];

export function assetCategory(asset: ProjectAsset): AssetKind {
  const detected = mediaKind(asset);
  if (detected !== "unknown") return detected;
  const type = (asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  if (type.includes("image") || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(name) || name.startsWith("image")) return "image";
  if (type.includes("video") || /\.(mp4|mov|webm|m4v|avi)$/i.test(name)) return "video";
  if (type.includes("audio") || /voice|music|sfx|sound/.test(type) || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) return "audio";
  return "other";
}

export function groupAssets<T extends ProjectAsset>(assets: T[]) {
  return mediaFolders.map(folder => ({
    ...folder,
    items: assets.map((asset, index) => ({ asset, index })).filter(item => assetCategory(item.asset) === folder.kind),
  })).filter(folder => folder.items.length > 0);
}
