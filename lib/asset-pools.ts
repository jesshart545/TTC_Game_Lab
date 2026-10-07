import type { AssetPool } from "./project";

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
