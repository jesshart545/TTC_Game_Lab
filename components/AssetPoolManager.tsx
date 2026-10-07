"use client";

import { useState } from "react";
import type { AssetPool, ProjectAsset } from "../lib/project";
import { setPoolAssetMembership } from "../lib/asset-pools";

function assetKey(asset: ProjectAsset) {
  return asset.storageKey || asset.name;
}

function isImage(asset: ProjectAsset) {
  return asset.type.toLowerCase().includes("image") || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(asset.name);
}

export default function AssetPoolManager({
  assets,
  pools,
  onChange,
}: {
  assets: ProjectAsset[];
  pools: AssetPool[];
  onChange: (pools: AssetPool[]) => void;
}) {
  const [poolName, setPoolName] = useState("");

  function createPool() {
    const name = poolName.trim();
    if (!name) return;
    onChange([...pools, { id: crypto.randomUUID(), name, assetKeys: [] }]);
    setPoolName("");
  }

  function updatePool(id: string, patch: Partial<AssetPool>) {
    onChange(pools.map((pool) => pool.id === id ? { ...pool, ...patch } : pool));
  }

  function toggleAsset(pool: AssetPool, key: string, checked: boolean) {
    onChange(setPoolAssetMembership(pools, pool.id, key, checked));
  }

  return (
    <section className="asset-pool-manager" aria-label="Asset pools">
      <div className="asset-pool-heading">
        <div>
          <h3>Asset pools</h3>
          <p>Create named groups, then choose which saved images, videos, voices, music, or sound effects belong in each one.</p>
        </div>
      </div>

      <form className="asset-pool-create" onSubmit={(event) => { event.preventDefault(); createPool(); }}>
        <label>
          New pool name
          <input
            value={poolName}
            onChange={(event) => setPoolName(event.target.value)}
            placeholder="For example: Prize images"
            maxLength={80}
          />
        </label>
        <button type="submit" className="build-btn" disabled={!poolName.trim()}>Create pool</button>
      </form>

      {assets.length === 0 && <p className="empty-note">Generate or upload assets first. Images, video, voice, music, and sound effects will appear here.</p>}
      {pools.length === 0 && assets.length > 0 && <p className="empty-note">No pools yet. Give a pool a name, then choose the assets to group together.</p>}

      <div className="asset-pool-list">
        {pools.map((pool) => (
          <article className="asset-pool-card" key={pool.id}>
            <div className="asset-pool-card-heading">
              <label>
                Pool name
                <input value={pool.name} maxLength={80} onChange={(event) => updatePool(pool.id, { name: event.target.value })} />
              </label>
              <span>{pool.assetKeys.length} {pool.assetKeys.length === 1 ? "asset" : "assets"}</span>
              <button type="button" className="danger-btn" onClick={() => onChange(pools.filter((item) => item.id !== pool.id))}>Delete pool</button>
            </div>
            {assets.length > 0 ? (
              <fieldset>
                <legend>Assets in this pool</legend>
                {assets.map((asset, index) => {
                  const key = assetKey(asset);
                  const image = isImage(asset);
                  return (
                    <label className="asset-pool-option" key={`${key}-${index}`}>
                      <input type="checkbox" checked={pool.assetKeys.includes(key)} onChange={(event) => toggleAsset(pool, key, event.target.checked)} />
                      {asset.url && image ? <img src={asset.url} alt="" /> : <span className="asset-pool-kind" aria-hidden="true">{asset.type.toLowerCase().includes("video") ? "▶" : asset.type.toLowerCase().includes("audio") || /voice|music|sfx/i.test(asset.type) ? "♫" : "▣"}</span>}
                      <span>{asset.name}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : <p className="empty-note">Add assets to the project to fill this pool.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
