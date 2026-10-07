"use client";

import { useState } from "react";
import type { AssetPool } from "../lib/project";

export default function AssetPoolManager({
  pools,
  onChange,
}: {
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

  return (
    <section className="asset-pool-manager" aria-label="Asset pools">
      <div className="asset-pool-heading">
        <div>
          <h3>Asset pools</h3>
          <p>Name groups here. Select an asset below to add it to a group.</p>
        </div>
      </div>

      <form className="asset-pool-create" onSubmit={(event) => { event.preventDefault(); createPool(); }}>
        <label>
          New pool name
          <input
            value={poolName}
            onChange={(event) => setPoolName(event.target.value)}
            placeholder="For example: Game intro media"
            maxLength={80}
          />
        </label>
        <button type="submit" className="build-btn" disabled={!poolName.trim()}>Create pool</button>
      </form>

      {pools.length === 0 && <p className="empty-note">No pools yet. Create one to start organizing your media.</p>}

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
          </article>
        ))}
      </div>
    </section>
  );
}
