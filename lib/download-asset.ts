import type { ProjectAsset } from "./project";
import { getStoredAssetBlob } from "./asset-store";

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  // Defer cleanup: removing the link or revoking the URL synchronously can
  // cancel the save in some browsers.
  setTimeout(() => { link.remove(); URL.revokeObjectURL(objectUrl); }, 4000);
}

/**
 * Save an asset's file to the user's device. Handles all three ways an
 * asset can be stored: object storage (fetched through the same-origin
 * asset route — never directly, whose cross-origin fetch can fail
 * silently), the browser's own file storage for older uploads (read
 * locally, no network), and plain URLs. Resolves true when a save was
 * triggered, false when nothing could be fetched.
 */
export async function downloadAssetToDevice(asset: Pick<ProjectAsset, "name" | "type" | "url" | "storageKey">): Promise<boolean> {
  const ext = (asset.url || "").split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1]
    || (asset.type.includes("/") ? asset.type.split("/")[1] : "")
    || (asset.storageKey || "").match(/\.([a-z0-9]+)$/i)?.[1] || "";
  const fileName = /\.[a-z0-9]+$/i.test(asset.name) || !ext ? asset.name : `${asset.name}.${ext.replace("jpeg", "jpg")}`;
  try {
    if (asset.storageKey && !asset.storageKey.startsWith("projects/")) {
      const local = await getStoredAssetBlob(asset.storageKey);
      if (local) { saveBlob(local, fileName); return true; }
    }
    const source = asset.storageKey?.startsWith("projects/")
      ? `/api/assets/content?key=${encodeURIComponent(asset.storageKey)}`
      : asset.url;
    if (!source) return false;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    saveBlob(await response.blob(), fileName);
    return true;
  } catch {
    if (asset.url && !asset.url.startsWith("blob:")) { window.open(asset.url, "_blank"); return true; }
    return false;
  }
}
