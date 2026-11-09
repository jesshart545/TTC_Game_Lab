import type { AssetPool, ProjectAsset } from "./project";

export function createAssetPool(pools: AssetPool[], name: string, assetKeys: string[] = []): { pools: AssetPool[]; pool: AssetPool } {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error("Give your pool a name.");
  if (pools.some(pool => pool.name.trim().toLowerCase() === trimmed.toLowerCase())) throw new Error("That pool name already exists. Choose that pool or use another name.");
  const pool = { id: crypto.randomUUID(), name: trimmed, assetKeys: Array.from(new Set(assetKeys)) };
  return { pools: [...pools, pool], pool };
}

export function setPoolAssetMembership(pools: AssetPool[], poolId: string, assetKey: string, selected: boolean): AssetPool[] {
  return pools.map((pool) => {
    if (pool.id !== poolId) return pool;
    const assetKeys = selected
      ? Array.from(new Set([...pool.assetKeys, assetKey]))
      : pool.assetKeys.filter((key) => key !== assetKey);
    return { ...pool, assetKeys };
  });
}

export function removeAssetFromPools(pools: AssetPool[], assetKey: string): AssetPool[] {
  return pools.map((pool) => ({ ...pool, assetKeys: pool.assetKeys.filter((key) => key !== assetKey) }));
}

/**
 * The pool's playable audio tracks, in pool order: the members the
 * pool player queues. A member counts when it is an audio asset
 * (its stored type says so) with a URL to play; members that are
 * missing from the library or are not audio are left out without
 * disturbing the order of the rest.
 */
export function poolAudioTracks(pool: AssetPool, assets: ProjectAsset[]): ProjectAsset[] {
  const byKey = new Map<string, ProjectAsset>();
  for (const asset of assets) {
    const assetKey = asset.storageKey || asset.name;
    if (!byKey.has(assetKey)) byKey.set(assetKey, asset);
  }
  return pool.assetKeys
    .map((poolKey) => byKey.get(poolKey))
    .filter((asset): asset is ProjectAsset => asset !== undefined && Boolean(asset.url) && (asset.type || "").toLowerCase().includes("audio"));
}
