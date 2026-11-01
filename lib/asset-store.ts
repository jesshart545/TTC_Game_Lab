import { Project, ProjectAsset } from "./project";

const DB_NAME = "ttc-gamelab-assets-v1";
const DB_VERSION = 1;
const STORE_NAME = "files";

type StoredAsset = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  blob: Blob;
};

function openAssetDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("Browser file storage is unavailable."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open browser file storage."));
  });
}

function makeStorageKey(prefix = "asset") {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

async function putStoredAsset(record: StoredAsset) {
  const db = await openAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Unable to save the selected file."));
      tx.onabort = () => reject(tx.error || new Error("Unable to save the selected file."));
    });
  } finally { db.close(); }
}

async function getStoredAsset(id: string): Promise<StoredAsset | null> {
  const db = await openAssetDb();
  try {
    return await new Promise<StoredAsset | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as StoredAsset | undefined) || null);
      request.onerror = () => reject(request.error || new Error("Unable to read the uploaded file."));
    });
  } finally { db.close(); }
}

async function uploadBlob(projectId: string, name: string, blob: Blob): Promise<ProjectAsset> {
  // Preferred: upload the bytes directly to object storage with a presigned
  // URL. The multipart route below passes through the web server, whose
  // request-size limit rejects large files (the 413 behind "The upload
  // exceeds the server limit."). Any failure here falls back to multipart.
  try {
    const presignResponse = await fetch("/api/assets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presign: true, projectId, name, type: blob.type || "application/octet-stream" }),
    });
    if (presignResponse.ok) {
      const data = await presignResponse.json().catch(() => ({}));
      if (data.uploadUrl && data.storageKey) {
        const put = await fetch(String(data.uploadUrl), { method: "PUT", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob });
        if (put.ok) return { name: data.name || name, type: blob.type || "application/octet-stream", storageKey: data.storageKey, url: data.url };
      }
    }
  } catch { /* fall through to the multipart upload */ }
  const form = new FormData();
  form.append("projectId", projectId);
  form.append("file", blob, name);
  const response = await fetch("/api/assets", { method: "POST", body: form });
  const data = await response.json().catch(() => ({ error: response.status === 413 ? "The upload exceeds the server limit." : "Unable to store asset. Please try again." }));
  if (!response.ok) throw new Error(data.error || "Unable to store asset.");
  return { name: data.name || name, type: data.type || blob.type || "application/octet-stream", storageKey: data.storageKey, url: data.url };
}

export async function storeUploadedAsset(projectId: string, file: File): Promise<ProjectAsset> {
  return uploadBlob(projectId, file.name, file);
}

/**
 * Media types by file extension, used to repair generated downloads whose
 * source served them with a generic type (application/octet-stream) or
 * none at all — the Hugging Face Spaces' file endpoint does this for the
 * Kokoro fallback's WAV output. The stored asset type is what sorts an
 * asset into its library folder and Build Space tab, so a generic type
 * strands a perfectly good voice clip under "Other files".
 */
const GENERATED_TYPE_BY_EXTENSION: Record<string, string> = {
  wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4",
  aac: "audio/aac", flac: "audio/flac",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  gif: "image/gif", avif: "image/avif", svg: "image/svg+xml",
};

function typedGeneratedBlob(blob: Blob, sourceUrl: string): Blob {
  if (blob.type && blob.type !== "application/octet-stream") return blob;
  let pathname = "";
  try { pathname = decodeURIComponent(new URL(sourceUrl).pathname); } catch { return blob; }
  const extension = /\.([a-z0-9]+)$/i.exec(pathname)?.[1]?.toLowerCase() || "";
  const type = GENERATED_TYPE_BY_EXTENSION[extension];
  return type ? new Blob([blob], { type }) : blob;
}

export async function storeGeneratedAsset(projectId: string, asset: { name: string; type: string; url: string; durationSeconds?: number | null }): Promise<ProjectAsset> {
  const source = new URL(asset.url);
  if (source.protocol === "https:" && (source.hostname === "fal.media" || source.hostname.endsWith(".fal.media"))) {
    const response = await fetch("/api/assets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: asset.name, sourceUrl: asset.url, durationSeconds: asset.durationSeconds }),
    });
    const data = await response.json().catch(() => ({ error: "Unable to save generated media. Please try again." }));
    if (!response.ok) throw new Error(data.error || "Unable to save generated media.");
    return { name: data.name || asset.name, type: data.type || asset.type, storageKey: data.storageKey, url: data.url };
  }
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error("Unable to download generated asset.");
  const blob = await response.blob();
  return uploadBlob(projectId, asset.name, typedGeneratedBlob(blob, asset.url));
}

/** The local file bytes for a browser-stored asset (legacy uploads whose
 * storageKey does not point at object storage), or null when absent. */
export async function getStoredAssetBlob(storageKey: string): Promise<Blob | null> {
  try {
    const stored = await getStoredAsset(storageKey);
    return stored?.blob ?? null;
  } catch {
    return null;
  }
}

export async function hydrateAsset(asset: ProjectAsset): Promise<ProjectAsset> {
  if (!asset.storageKey) return asset;
  if (asset.storageKey.startsWith("projects/")) {
    const response = await fetch(`/api/assets?key=${encodeURIComponent(asset.storageKey)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh the asset URL.");
    const { url } = await response.json();
    return { ...asset, url };
  }
  if (asset.url && !asset.url.startsWith("blob:")) return asset;
  const stored = await getStoredAsset(asset.storageKey);
  if (!stored?.blob) return asset;
  return { ...asset, type: stored.type || asset.type, url: URL.createObjectURL(stored.blob) };
}

export async function hydrateProjectAssets(project: Project): Promise<Project> {
  const assets = await Promise.all((project.assets || []).map(async asset => {
    try { return await hydrateAsset(asset); } catch { return asset; }
  }));
  return { ...project, assets };
}


export async function deleteStoredAsset(storageKey: string): Promise<void> {
  if (storageKey.startsWith("projects/")) {
    const response = await fetch(`/api/assets?key=${encodeURIComponent(storageKey)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete the stored asset.");
    return;
  }
  const db = await openAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Unable to delete the asset."));
    });
  } finally { db.close(); }
}

export async function deleteProjectStoredAssets(projectId: string): Promise<void> {
  const db = await openAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (!cursor) return;
        const value = cursor.value as StoredAsset;
        if (value.projectId === projectId) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error("Unable to clean up project assets."));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Unable to clean up project assets."));
      tx.onabort = () => reject(tx.error || new Error("Unable to clean up project assets."));
    });
  } finally {
    db.close();
  }
}
