import type { Project, ProjectAsset } from "./project";
import { deleteStoredAsset } from "./asset-store";
import { removeAssetFromPools } from "./asset-pools";

export type AssetDeletionResult = {
  ok: boolean;
  storageCleaned: boolean;
  message: string;
};

/**
 * Delete an asset from a project and clean up storage.
 * - Removes the asset from project.assets and asset pools.
 * - Only deletes the file from storage if no other references remain.
 * - Returns a status message for the UI.
 *
 * This is the re-implementation of PR #5's "properly removed from storage"
 * fix, split into a pushable module.
 */
export async function deleteAssetFromProject(
  project: Project,
  asset: ProjectAsset,
  save: (next: Project) => Promise<void>,
): Promise<{ next: Project; result: AssetDeletionResult }> {
  const index = project.assets.findIndex(item =>
    asset.storageKey ? item.storageKey === asset.storageKey : item.name === asset.name && item.type === asset.type
  );
  if (index < 0) {
    return { next: project, result: { ok: false, storageCleaned: false, message: "Asset not found." } };
  }
  const assetKey = asset.storageKey || asset.name;
  const next: Project = {
    ...project,
    assets: project.assets.filter((_, i) => i !== index),
    assetPools: removeAssetFromPools(project.assetPools || [], assetKey),
    updatedAt: "just now",
  };
  // Count remaining references to this storage key.
  const sharedUses = asset.storageKey
    ? next.assets.filter(a => a.storageKey === asset.storageKey).length
    : 0;

  await save(next);

  let storageCleaned = false;
  if (asset.storageKey && sharedUses <= 0) {
    try {
      await deleteStoredAsset(asset.storageKey);
      storageCleaned = true;
    } catch (error) {
      return {
        next,
        result: {
          ok: true,
          storageCleaned: false,
          message: error instanceof Error
            ? `Asset removed, but storage cleanup failed: ${error.message}`
            : "Asset removed, but storage cleanup failed.",
        },
      };
    }
  }
  return {
    next,
    result: {
      ok: true,
      storageCleaned,
      message: "Asset deleted and project references cleaned.",
    },
  };
}
