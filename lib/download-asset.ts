import type { ProjectAsset } from "./project";

/**
 * Save an asset's file to the user's device.
 *
 * The file is fetched through the same-origin asset route (never directly
 * from storage, whose cross-origin fetch can fail silently), turned into a
 * blob, and saved with a temporary download link. Resolves true when the
 * save was triggered, false when nothing could be fetched.
 */
export async function downloadAssetToDevice(asset: Pick<ProjectAsset, "name" | "type" | "url" | "storageKey">): Promise<boolean> {
  const ext = (asset.url || "").split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1]
    || (asset.type.includes("/") ? asset.type.split("/")[1] : "")
    || (asset.storageKey || "").match(/\.([a-z0-9]+)$/i)?.[1] || "";
  const fileName = /\.[a-z0-9]+$/i.test(asset.name) || !ext ? asset.name : `${asset.name}.${ext.replace("jpeg", "jpg")}`;
  const source = asset.storageKey ? `/api/assets/content?key=${encodeURIComponent(asset.storageKey)}` : asset.url;
  if (!source) return false;
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    // Defer cleanup: removing the link or revoking the URL synchronously can
    // cancel the save in some browsers.
    setTimeout(() => { link.remove(); URL.revokeObjectURL(objectUrl); }, 4000);
    return true;
  } catch {
    if (asset.url) { window.open(asset.url, "_blank"); return true; }
    return false;
  }
}
