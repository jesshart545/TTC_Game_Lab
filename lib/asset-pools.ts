import type { AssetPool } from "./project";

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
