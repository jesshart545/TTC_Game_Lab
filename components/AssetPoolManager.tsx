"use client";
import { useState } from "react";
import type { AssetPool, ProjectAsset } from "../lib/project";
import { createAssetPool, setPoolAssetMembership } from "../lib/asset-pools";
import { mediaKind } from "../lib/board-design";
import AssetThumbnail from "./AssetThumbnail";
function Thumbnail({asset}:{asset:ProjectAsset}){const kind=mediaKind(asset);return <AssetThumbnail key={asset.url||asset.storageKey||asset.name} asset={asset} kind={kind==='unknown'?'other':kind}/>;}
export default function AssetPoolManager({pools,assets,onChange,saveStatus}:{pools:AssetPool[];assets:ProjectAsset[];onChange:(pools:AssetPool[])=>void;saveStatus?:string}) {
 const [poolName,setPoolName]=useState(''),[activeId,setActiveId]=useState<string|null>(null),[adding,setAdding]=useState(false),[selected,setSelected]=useState<string[]>([]),[message,setMessage]=useState(''),[search,setSearch]=useState('');
 const active=pools.find(pool=>pool.id===activeId);
 const key=(asset:ProjectAsset)=>asset.storageKey||asset.name;
 const members=active?assets.filter(asset=>active.assetKeys.includes(key(asset))):[];
 const choices=active?assets.filter(asset=>!active.assetKeys.includes(key(asset))&&asset.name.toLowerCase().includes(search.toLowerCase())):[];
 function open(id:string){setActiveId(id);setSelected([]);setAdding(false);setSearch('');setMessage('');}
 function create(){try{const result=createAssetPool(pools,poolName);onChange(result.pools);setPoolName('');open(result.pool.id);setAdding(true);setMessage(`Created ${result.pool.name}. Choose assets below to fill it.`);}catch(error){setMessage(error instanceof Error?error.message:'Could not create the pool.');}}
 function add(){if(!active)return;const valid=selected.filter(id=>assets.some(asset=>key(asset)===id)&&!active.assetKeys.includes(id));let next=pools;for(const id of valid)next=setPoolAssetMembership(next,active.id,id,true);onChange(next);setSelected([]);setAdding(false);setMessage(`Added ${valid.length} ${valid.length===1?'asset':'assets'} to ${active.name}.`);}
 return <section className="asset-pool-manager" aria-label="Asset pools"><div className="asset-pool-heading"><h3>Your asset pools</h3><p>Create a named group, then add images, videos, sounds, or other assets. Pools keep your library organized.</p></div>
 <form className="asset-pool-create" onSubmit={event=>{event.preventDefault();create();}}><label>New pool name<input value={poolName} onChange={event=>setPoolName(event.target.value)} placeholder="Example: Music round images" maxLength={80}/></label><button type="submit" className="build-btn" disabled={!poolName.trim()}>Create pool</button></form>
 {!pools.length&&<p>No pools yet. Name your first pool above.</p>}
 <div className="pool-tabs" aria-label="Choose a pool">{pools.map(pool=><button type="button" key={pool.id} aria-pressed={active?.id===pool.id} onClick={()=>open(pool.id)}>{pool.name}<small>{assets.filter(asset=>pool.assetKeys.includes(key(asset))).length} assets</small></button>)}</div>
 {active&&<div className="pool-contents"><h4>{active.name}</h4><p>{members.length} {members.length===1?'asset':'assets'} in this pool</p><button type="button" className="build-btn" onClick={()=>{setAdding(!adding);setSelected([]);setSearch('');}}>{adding?'Cancel adding':'Add assets to this pool'}</button>
 {adding&&<section aria-label={`Add assets to ${active.name}`}><label className="pool-search">Find assets<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search by name"/></label><p>Click the thumbnails you want, then press Add selected assets.</p><div className="pool-asset-grid">{choices.map(asset=><button type="button" key={key(asset)} aria-pressed={selected.includes(key(asset))} className="pool-asset-choice" onClick={()=>setSelected(previous=>previous.includes(key(asset))?previous.filter(id=>id!==key(asset)):[...previous,key(asset)])}><Thumbnail asset={asset}/><span>{asset.name}</span><small>{selected.includes(key(asset))?'✓ Selected':'Select'}</small></button>)}</div>{!choices.length&&<p>{assets.length?'No matching assets outside this pool.':'Upload or generate assets in Workshop first.'}</p>}<button type="button" className="build-btn" disabled={!selected.length} onClick={add}>Add selected assets ({selected.length})</button></section>}
 {!adding&&!members.length&&<p>This pool is empty. Press Add assets to this pool to fill it.</p>}
 {members.length>0&&<div className="pool-asset-grid" aria-label={`Assets in ${active.name}`}>{members.map(asset=><article className="pool-asset-member" key={key(asset)}><Thumbnail asset={asset}/><span>{asset.name}</span><button type="button" aria-label={`Remove ${asset.name} from ${active.name}`} onClick={()=>{onChange(setPoolAssetMembership(pools,active.id,key(asset),false));setMessage(`Removed ${asset.name} from ${active.name}. The asset is still in your library.`);}}>Remove</button></article>)}</div>}
 <details><summary>Rename or delete this pool</summary><label>Pool name<input value={active.name} maxLength={80} onChange={event=>onChange(pools.map(pool=>pool.id===active.id?{...pool,name:event.target.value}:pool))}/></label><p>Deleting a pool keeps all its assets in your library.</p><button type="button" className="danger-btn" onClick={()=>{onChange(pools.filter(pool=>pool.id!==active.id));setActiveId(null);setMessage(`Deleted ${active.name}. Its assets are still in your library.`);}}>Delete pool</button></details>
 </div>}
 {message&&<p role="status">{message}</p>}{saveStatus&&<p role="status">{saveStatus}</p>}
 </section>;
}
