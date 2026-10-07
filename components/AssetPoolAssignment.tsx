"use client";
import { useState } from "react";
import type { AssetPool, ProjectAsset } from "../lib/project";
import { createAssetPool, setPoolAssetMembership } from "../lib/asset-pools";

export default function AssetPoolAssignment({asset,pools,onChange}:{asset:ProjectAsset;pools:AssetPool[];onChange:(pools:AssetPool[])=>void}) {
 const [poolId,setPoolId]=useState(''),[name,setName]=useState(''),[message,setMessage]=useState('');
 const key=asset.storageKey||asset.name;
 const memberships=pools.filter(pool=>pool.assetKeys.includes(key));
 const available=pools.filter(pool=>!pool.assetKeys.includes(key));
 const target=available.find(pool=>pool.id===poolId)||available[0];
 function create(){try{const result=createAssetPool(pools,name,[key]);onChange(result.pools);setName('');setMessage(`Added ${asset.name} to ${result.pool.name}.`);}catch(error){setMessage(error instanceof Error?error.message:'Could not create the pool.');}}
 return <section className="asset-detail-pools" aria-label={`Pools for ${asset.name}`}><h4>Add to a pool</h4><p>Pools group your assets. Adding here keeps the asset in your library.</p>
 {memberships.length>0?<ul className="pool-memberships">{memberships.map(pool=><li key={pool.id}><span>In <strong>{pool.name}</strong></span><button type="button" onClick={()=>{onChange(setPoolAssetMembership(pools,pool.id,key,false));setMessage(`Removed from ${pool.name}. The asset is still in your library.`);}}>Remove from pool</button></li>)}</ul>:<p>This asset is not in a pool yet.</p>}
 {available.length>0&&<div className="asset-pool-create"><label>Choose a pool<select value={target?.id||''} onChange={event=>setPoolId(event.target.value)}>{available.map(pool=><option key={pool.id} value={pool.id}>{pool.name}</option>)}</select></label><button type="button" disabled={!target} onClick={()=>{if(!target)return;onChange(setPoolAssetMembership(pools,target.id,key,true));setMessage(`Added ${asset.name} to ${target.name}.`);}}>Add to pool</button></div>}
 <div className="asset-pool-create"><label>Or create a new pool<input value={name} maxLength={80} onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();create();}}} placeholder="Example: Music round images"/></label><button type="button" disabled={!name.trim()} onClick={create}>Create pool &amp; add</button></div>
 {message&&<p role="status">{message}</p>}
 </section>;
}
