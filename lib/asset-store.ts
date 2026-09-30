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

async function uploadLargeBlob(projectId:string,name:string,blob:Blob):Promise<ProjectAsset> {
  async function send(body:BodyInit,headers?:HeadersInit) {
    let lastError="Unable to save media.";
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const response=await fetch("/api/assets/upload",{method:"POST",body,headers});
        const data=await response.json().catch(()=>({error:"The media transfer could not complete."}));
        if(response.ok) return data;
        lastError=data.error || lastError;
        if(response.status<500 && response.status!==429) throw new Error(lastError);
      } catch(error) {
        lastError=error instanceof Error?error.message:lastError;
        if(attempt===2) throw new Error(lastError);
      }
      await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
    }
    throw new Error(lastError);
  }
  const json={"Content-Type":"application/json"};
  const upload=await send(JSON.stringify({action:"start",projectId,name,type:blob.type,size:blob.size}),json);
  try {
    for(let offset=0,index=0;offset<blob.size;offset+=upload.chunkBytes,index++) {
      const form=new FormData();
      form.append("token",upload.token);form.append("index",String(index));
      form.append("file",blob.slice(offset,Math.min(offset+upload.chunkBytes,blob.size)),"part");
      await send(form);
    }
    const data=await send(JSON.stringify({action:"complete",token:upload.token}),json);
    return {name:data.name || name,type:data.type || blob.type,storageKey:data.storageKey,url:data.url};
  } catch(error) {
    void fetch("/api/assets/upload",{method:"POST",headers:json,body:JSON.stringify({action:"cancel",token:upload.token})}).catch(()=>{});
    throw error;
  }
}

async function uploadBlob(projectId: string, name: string, blob: Blob): Promise<ProjectAsset> {
  if (blob.size > 2 * 1024 * 1024) return uploadLargeBlob(projectId,name,blob);
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

export async function storeGeneratedAsset(projectId: string, asset: { name: string; type: string; url: string }): Promise<ProjectAsset> {
  const source = new URL(asset.url);
  if (source.protocol === "https:" && (source.hostname === "fal.media" || source.hostname.endsWith(".fal.media"))) {
    const response = await fetch("/api/assets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: asset.name, sourceUrl: asset.url }),
    });
    const data = await response.json().catch(() => ({ error: "Unable to save generated media. Please try again." }));
    if (!response.ok) throw new Error(data.error || "Unable to save generated media.");
    return { name: data.name || asset.name, type: data.type || asset.type, storageKey: data.storageKey, url: data.url };
  }
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error("Unable to download generated asset.");
  const blob = await response.blob();
  return uploadBlob(projectId, asset.name, blob);
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
