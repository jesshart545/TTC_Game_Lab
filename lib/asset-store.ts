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

export async function storeUploadedAsset(projectId: string, file: File): Promise<ProjectAsset> {
  const storageKey = makeStorageKey("upload");
  await putStoredAsset({ id: storageKey, projectId, name: file.name, type: file.type || "application/octet-stream", blob: file });
  return { name: file.name, type: file.type || "File", storageKey };
}

export async function storeGeneratedAsset(projectId: string, asset: { name: string; type: string; url: string }): Promise<ProjectAsset> {
  const storageKey = makeStorageKey("generated");
  let blob: Blob;
  if (asset.url.startsWith("data:")) {
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error("Unable to read generated asset data.");
    blob = await response.blob();
  } else {
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error("Unable to download generated asset.");
    blob = await response.blob();
  }
  const type = blob.type || asset.type || "application/octet-stream";
  await putStoredAsset({ id: storageKey, projectId, name: asset.name, type, blob });
  return { name: asset.name, type, storageKey };
}

export async function hydrateAsset(asset: ProjectAsset): Promise<ProjectAsset> {
  if (!asset.storageKey || asset.url) return asset;
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
  const db = await openAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Unable to delete the asset."));
      tx.onabort = () => reject(tx.error || new Error("Unable to delete the asset."));
    });
  } finally {
    db.close();
  }
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
