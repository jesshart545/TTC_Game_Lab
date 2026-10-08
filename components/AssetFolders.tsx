"use client";

import { useState, type ReactNode } from "react";
import type { ProjectAsset } from "../lib/project";
import { groupAssets } from "../lib/asset-folders";
import CollapsibleFolder, { type FolderBulkAction } from "./CollapsibleFolder";

type Props<T extends ProjectAsset> = {
  assets: T[];
  scope: string;
  renderAsset: (asset: T, index: number) => ReactNode;
  gridClassName?: string;
  searchKey?: string;
  selectedAssetKey?: string | null;
  bulkAction?: FolderBulkAction;
  showControls?: boolean;
};

export default function AssetFolders<T extends ProjectAsset>({
  assets, scope, renderAsset, gridClassName = "workshop-assets-grid",
  searchKey = "", selectedAssetKey, bulkAction, showControls = true,
}: Props<T>) {
  const [localAction, setLocalAction] = useState<FolderBulkAction>({ open: false, sequence: 0 });
  const action = bulkAction || localAction;
  const folders = groupAssets(assets);
  return (
    <div className="asset-folders">
      {showControls && <div className="folder-toolbar" role="group" aria-label="Media folder controls">
        <span>{assets.length} saved {assets.length === 1 ? "asset" : "assets"}</span>
        <button type="button" onClick={() => setLocalAction(value => ({ open: true, sequence: value.sequence + 1 }))}>Expand all media</button>
        <button type="button" onClick={() => setLocalAction(value => ({ open: false, sequence: value.sequence + 1 }))}>Collapse all media</button>
      </div>}
      {folders.map(folder => {
        const reveal = selectedAssetKey && folder.items.some(({ asset }) => (asset.storageKey || asset.name) === selectedAssetKey);
        return <CollapsibleFolder
          key={folder.kind} title={folder.label} count={folder.items.length}
          storageKey={`${scope}:media:${folder.kind}`}
          defaultOpen={Boolean(action.sequence && action.open)}
          expandKey={searchKey || (reveal ? `asset:${selectedAssetKey}` : "")}
          bulkAction={action}
        >
          <div className={gridClassName} aria-label={`${folder.label} assets`}>
            {folder.items.map(({ asset, index }) => renderAsset(asset, index))}
          </div>
        </CollapsibleFolder>;
      })}
    </div>
  );
}
