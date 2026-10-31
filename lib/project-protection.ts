import { getDb } from "./db";
import { assetExists, deleteAsset, getAssetBytes, putAsset } from "./object-storage";
import { BACKUP_ASSET_PREFIX, backupAssetKey, getBackupMediaStorage, type BackupMediaStorage } from "./backup-storage";

// Project deletion protection: soft-delete (trash), a deletion audit log,
// nightly full-project backups, and restore-from-backup.
//
// Why this exists: on 2026-10-16 a project ("Yipee Ki Yay") vanished with no
// delete request in the logs — the row disappeared at the database level and
// there was no backup to restore from. These layers make a project
// recoverable: deletes land in trash first, every destructive action is
// audited, and every night a full snapshot of all project data is stored in
// the `project_backups` table so any single project can be recreated.
//
// Schema changes follow this repo's convention: lazy, idempotent DDL executed
// from code (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), the same
// way `owner_id` and `live_cards` were introduced. There is no migration
// runner; the first request that touches these routes applies the schema.

export type Db = NonNullable<ReturnType<typeof getDb>>;
export type ProtectionActor = { id: string; email?: string };
export type AuditAction = "trash" | "restore" | "delete-forever" | "restore-backup";

export const BACKUP_RETENTION = 14;

let schema: Promise<unknown> | null = null;
export function ensureProtectionSchema(db: Db) {
  if (!schema) {
    schema = (async () => {
      await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
      await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by TEXT`;
      await db`CREATE TABLE IF NOT EXISTS project_deletion_audit (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, project_title TEXT NOT NULL DEFAULT '', owner_id TEXT, actor_id TEXT, actor_email TEXT, action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await db`CREATE INDEX IF NOT EXISTS project_deletion_audit_project_idx ON project_deletion_audit (project_id, created_at DESC)`;
      await db`CREATE TABLE IF NOT EXISTS project_backups (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), project_count INTEGER NOT NULL DEFAULT 0, payload JSONB NOT NULL)`;
      await db`ALTER TABLE project_backups ADD COLUMN IF NOT EXISTS export_key TEXT`;
      await db`ALTER TABLE project_backups ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ`;
      await db`ALTER TABLE project_backups ADD COLUMN IF NOT EXISTS export_error TEXT`;
      await db`ALTER TABLE project_backups ADD COLUMN IF NOT EXISTS asset_backup JSONB`;
    })().catch(error => { schema = null; throw error; });
  }
  return schema;
}

export async function recordDeletionAudit(db: Db, entry: {
  projectId: string;
  projectTitle?: string;
  ownerId?: string | null;
  actor?: ProtectionActor | null;
  action: AuditAction;
}) {
  await ensureProtectionSchema(db);
  await db`INSERT INTO project_deletion_audit (project_id, project_title, owner_id, actor_id, actor_email, action) VALUES (${entry.projectId}, ${entry.projectTitle ?? ""}, ${entry.ownerId ?? null}, ${entry.actor?.id ?? null}, ${entry.actor?.email ?? null}, ${entry.action})`;
}

export async function listDeletionAudit(db: Db, limit = 100) {
  await ensureProtectionSchema(db);
  return db`SELECT id, project_id, project_title, owner_id, actor_id, actor_email, action, created_at FROM project_deletion_audit ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
}

// ---- Trash (soft delete) ----

type ProjectRef = { id: string; name: string; owner_id?: string | null };

export async function trashProject(db: Db, project: ProjectRef, actor: ProtectionActor) {
  await ensureProtectionSchema(db);
  const rows = await db`UPDATE projects SET deleted_at = NOW(), deleted_by = ${actor.email || actor.id} WHERE id = ${project.id} AND deleted_at IS NULL RETURNING id`;
  if (!rows.length) return false;
  await recordDeletionAudit(db, { projectId: project.id, projectTitle: project.name, ownerId: project.owner_id ?? null, actor, action: "trash" });
  return true;
}

export async function restoreTrashedProject(db: Db, project: ProjectRef, actor: ProtectionActor) {
  await ensureProtectionSchema(db);
  const rows = await db`UPDATE projects SET deleted_at = NULL, deleted_by = NULL WHERE id = ${project.id} AND deleted_at IS NOT NULL RETURNING id`;
  if (!rows.length) return false;
  await recordDeletionAudit(db, { projectId: project.id, projectTitle: project.name, ownerId: project.owner_id ?? null, actor, action: "restore" });
  return true;
}

// Database half of the permanent delete. The route deletes the project's
// stored assets first (and aborts on failure, exactly like the old hard
// delete); this removes the database rows the old delete removed.
export async function deleteProjectForever(db: Db, project: ProjectRef, actor: ProtectionActor) {
  await ensureProtectionSchema(db);
  await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
  await db`CREATE TABLE IF NOT EXISTS live_events (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, control_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`DELETE FROM live_hosts WHERE project_id = ${project.id}`;
  await db`DELETE FROM live_events WHERE project_id = ${project.id}`;
  await db`DELETE FROM projects WHERE id = ${project.id}`;
  await recordDeletionAudit(db, { projectId: project.id, projectTitle: project.name, ownerId: project.owner_id ?? null, actor, action: "delete-forever" });
  return true;
}

export async function listTrashedProjects(db: Db, user: { id: string; admin: boolean }) {
  await ensureProtectionSchema(db);
  return user.admin
    ? db`SELECT id, slug, name, description, status, theme, updated_at, data, owner_id, deleted_at, deleted_by FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
    : db`SELECT id, slug, name, description, status, theme, updated_at, data, owner_id, deleted_at, deleted_by FROM projects WHERE deleted_at IS NOT NULL AND owner_id = ${user.id} ORDER BY deleted_at DESC`;
}

// ---- Nightly backups ----

// A backup captures everything needed to recreate a project as an openable,
// publishable draft: the full project row (its `data` JSONB holds all assets
// metadata, tools, controls and the published snapshot) plus the rows in
// other tables that belong to the project: live_hosts (the host key hash, so
// a restored published project keeps working for its host) and live_cards
// (published card-system state). Asset binaries are NOT included — they live
// in object storage under `projects/<id>/` and the rows reference them by
// storage key. Ephemeral runtime state (live_events history, live timer/coin
// states) is intentionally excluded: it is meaningless to restore.
export type BackupPayload = {
  version: 1;
  createdAt: string;
  projects: Array<Record<string, unknown>>;
  liveHosts: Array<Record<string, unknown>>;
  liveCards: Array<Record<string, unknown>>;
};

export async function buildBackupPayload(db: Db): Promise<BackupPayload> {
  await ensureProtectionSchema(db);
  const projects = await db`SELECT id, slug, name, description, status, theme, prompt, data, owner_id, updated_at, deleted_at, deleted_by FROM projects ORDER BY id`;
  await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
  const liveHosts = await db`SELECT project_id, token_hash FROM live_hosts`;
  await db`CREATE TABLE IF NOT EXISTS live_cards (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, PRIMARY KEY(project_id,tool_id))`;
  const liveCards = await db`SELECT project_id, tool_id, version, data FROM live_cards`;
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    projects: projects as Array<Record<string, unknown>>,
    liveHosts: liveHosts as Array<Record<string, unknown>>,
    liveCards: liveCards as Array<Record<string, unknown>>,
  };
}

// ---- External backup export ----

// Snapshots live in the same Neon database they protect, so a whole-database
// loss would take the backups with it. Every snapshot is therefore ALSO
// written to object storage (which lives outside the database) as a JSON
// file under `backups/`. The export outcome is recorded on the snapshot row
// (export_key / exported_at / export_error) so the admin page can show it,
// and pruned snapshots take their external copies with them.
export type BackupExportStorage = {
  put: (key: string, body: string | Uint8Array, contentType: string) => Promise<unknown>;
  remove: (key: string) => Promise<unknown>;
};

const defaultBackupExportStorage: BackupExportStorage = {
  put: (key, body, contentType) => putAsset(key, body, contentType),
  remove: key => deleteAsset(key),
};

export function backupExportKey(snapshotId: number, createdAt: string | Date) {
  const iso = new Date(createdAt).toISOString().replace(/:/g, "-");
  return `backups/snapshot-${snapshotId}-${iso}.json`;
}


// ---- Off-site media backup ----
//
// A snapshot's JSON names every media file but does not hold the files
// themselves, so a restore used to bring back projects pointing at missing
// pictures, videos, and sounds. When a separate backup storage is configured
// (lib/backup-storage.ts — Oracle Object Storage), every snapshot ALSO
// copies each referenced media file there, once per file (storage keys are
// unique and never overwritten, so a file already copied is skipped), plus
// the snapshot JSON itself and a manifest. Restores copy any missing files
// back. Pruning never deletes these copies: a kept snapshot may still point
// at them, and they are the last resort in a disaster.

export type AssetBackupSummary = { configured: boolean; snapshotExported: boolean; total: number; copied: number; alreadyPresent: number; totalBytes: number; failed: string[] };
export const EMPTY_ASSET_BACKUP: AssetBackupSummary = { configured: false, snapshotExported: false, total: 0, copied: 0, alreadyPresent: 0, totalBytes: 0, failed: [] };

export type AssetSource = {
  read: (key: string) => Promise<{ bytes: Uint8Array; contentType: string }>;
  exists: (key: string) => Promise<boolean>;
  write: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>;
};
const defaultAssetSource: AssetSource = {
  read: key => getAssetBytes(key),
  exists: key => assetExists(key),
  write: (key, bytes, contentType) => putAsset(key, bytes, contentType),
};

export function collectAssetKeys(projects: Array<Record<string, unknown>>): string[] {
  const keys = new Set<string>();
  for (const project of projects) {
    const data = project.data as { assets?: Array<{ storageKey?: unknown }> } | undefined;
    for (const asset of data?.assets ?? []) {
      if (typeof asset?.storageKey === "string" && asset.storageKey.startsWith("projects/")) keys.add(asset.storageKey);
    }
  }
  return [...keys].sort();
}

export async function backupSnapshotAssets(payload: BackupPayload, media: BackupMediaStorage | null, source: AssetSource = defaultAssetSource): Promise<AssetBackupSummary> {
  if (!media) return { ...EMPTY_ASSET_BACKUP };
  const keys = collectAssetKeys(payload.projects);
  const summary: AssetBackupSummary = { configured: true, snapshotExported: false, total: keys.length, copied: 0, alreadyPresent: 0, totalBytes: 0, failed: [] };
  let existing = new Set<string>();
  try { existing = new Set((await media.listKeys(BACKUP_ASSET_PREFIX)).map(k => k.slice(BACKUP_ASSET_PREFIX.length))); } catch { /* treated as empty; the copies below surface real failures per file */ }
  const present: string[] = [];
  for (const key of keys) {
    if (existing.has(key)) { summary.alreadyPresent++; present.push(key); continue; }
    try {
      const { bytes, contentType } = await source.read(key);
      await media.put(backupAssetKey(key), bytes, contentType);
      summary.copied++; summary.totalBytes += bytes.length; present.push(key);
    } catch { summary.failed.push(key); }
  }
  try {
    await media.put("backups/manifest.json", JSON.stringify({ updatedAt: new Date().toISOString(), assets: present.sort() }), "application/json");
  } catch { /* the manifest is bookkeeping; the copies themselves are the backup */ }
  return summary;
}

// Prune to the newest `keep` snapshots. The DELETE only ever removes rows
// outside the newest `keep`, so it can never remove the last remaining
// snapshot. Exports belonging to pruned snapshots are deleted too (best
// effort: the database row is already gone, and a failed object delete must
// not fail the backup that triggered the prune).
export async function pruneBackups(db: Db, keep = BACKUP_RETENTION, storage: BackupExportStorage = defaultBackupExportStorage) {
  await ensureProtectionSchema(db);
  const removed = await db`DELETE FROM project_backups WHERE id NOT IN (SELECT id FROM project_backups ORDER BY created_at DESC, id DESC LIMIT ${keep}) RETURNING id, export_key`;
  for (const row of removed) {
    if (!row.export_key) continue;
    try { await storage.remove(String(row.export_key)); } catch { /* best effort, see above */ }
  }
  return removed.length;
}

export async function createBackupSnapshot(db: Db, storage: BackupExportStorage = defaultBackupExportStorage, media: BackupMediaStorage | null = getBackupMediaStorage(), source: AssetSource = defaultAssetSource) {
  await ensureProtectionSchema(db);
  const payload = await buildBackupPayload(db);
  const rows = await db`INSERT INTO project_backups (project_count, payload) VALUES (${payload.projects.length}, ${JSON.stringify(payload)}::jsonb) RETURNING id, created_at`;
  const id = rows[0].id;
  // Export AFTER the snapshot exists. An export failure never fails the
  // snapshot or the backup request — it is recorded on the row instead, so
  // the database copy still stands and the admin page shows what happened.
  let exportKey: string | null = null;
  let exportedAt: Date | null = null;
  let exportError: string | null = null;
  try {
    exportKey = backupExportKey(Number(id), rows[0].created_at as string | Date);
    await storage.put(exportKey, JSON.stringify(payload), "application/json");
    exportedAt = new Date();
  } catch (error) {
    exportKey = null;
    const message = (error as { message?: unknown } | null)?.message;
    exportError = typeof message === "string" ? message : String(error);
  }
  try {
    await db`UPDATE project_backups SET export_key = ${exportKey}, exported_at = ${exportedAt}, export_error = ${exportError} WHERE id = ${id}`;
  } catch { /* bookkeeping only — the snapshot itself already succeeded */ }
  // Off-site full backup: the snapshot JSON and every media file it
  // references are copied to the separate backup storage, when configured.
  // A media-backup failure never fails the snapshot — it is recorded on the
  // snapshot row instead, the same policy as the export above.
  let assetBackup: AssetBackupSummary = { ...EMPTY_ASSET_BACKUP };
  try {
    assetBackup = await backupSnapshotAssets(payload, media, source);
    if (media) {
      try { await media.put(backupExportKey(Number(id), rows[0].created_at as string | Date), JSON.stringify(payload), "application/json"); assetBackup.snapshotExported = true; } catch { /* the summary still records the media copies */ }
    }
  } catch { assetBackup = { ...EMPTY_ASSET_BACKUP, configured: !!media, failed: ["media-backup-failed"] }; }
  if (assetBackup.configured) {
    try { await db`UPDATE project_backups SET asset_backup = ${JSON.stringify(assetBackup)}::jsonb WHERE id = ${id}`; } catch { /* bookkeeping only */ }
  }
  const pruned = await pruneBackups(db, BACKUP_RETENTION, storage);
  return { id, createdAt: rows[0].created_at, projectCount: payload.projects.length, pruned, exportKey, exportedAt, exportError, assetBackup };
}

export async function listBackupSnapshots(db: Db) {
  await ensureProtectionSchema(db);
  return db`SELECT id, created_at, project_count, export_key, exported_at, export_error, asset_backup FROM project_backups ORDER BY created_at DESC, id DESC`;
}

export async function getBackupSnapshot(db: Db, id: number) {
  await ensureProtectionSchema(db);
  const rows = await db`SELECT id, created_at, project_count, payload FROM project_backups WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

// Restore ONE project from a snapshot. Conflict policy (the safe option):
// the project is recreated with its original id and slug ONLY when no row
// with that id or slug currently exists. If one does — live or trashed —
// nothing is overwritten and a conflict is reported; the admin can restore
// the trashed copy from Trash, or delete it forever, and then retry.
export async function restoreProjectFromBackup(db: Db, snapshotId: number, projectId: string, actor: ProtectionActor, media: BackupMediaStorage | null = getBackupMediaStorage(), source: AssetSource = defaultAssetSource) {
  await ensureProtectionSchema(db);
  const snapshot = await getBackupSnapshot(db, snapshotId);
  if (!snapshot) return { ok: false as const, reason: "snapshot-not-found" as const };
  const payload = snapshot.payload as BackupPayload;
  const entry = (payload.projects || []).find(project => project.id === projectId);
  if (!entry) return { ok: false as const, reason: "project-not-in-backup" as const };
  const existing = await db`SELECT id FROM projects WHERE id = ${projectId} OR slug = ${String(entry.slug)} LIMIT 1`;
  if (existing.length) return { ok: false as const, reason: "conflict" as const };
  await db`INSERT INTO projects (id, slug, name, description, status, theme, prompt, data, owner_id, updated_at, deleted_at, deleted_by) VALUES (${String(entry.id)}, ${String(entry.slug)}, ${String(entry.name)}, ${String(entry.description ?? "")}, ${String(entry.status ?? "Draft")}, ${String(entry.theme ?? "cyan")}, ${String(entry.prompt ?? "")}, ${JSON.stringify(entry.data ?? {})}::jsonb, ${(entry.owner_id as string | null) ?? null}, NOW(), NULL, NULL)`;
  const host = (payload.liveHosts || []).find(row => row.project_id === projectId);
  if (host) {
    await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
    await db`INSERT INTO live_hosts (project_id, token_hash) VALUES (${projectId}, ${String(host.token_hash)}) ON CONFLICT (project_id) DO NOTHING`;
  }
  const cards = (payload.liveCards || []).filter(row => row.project_id === projectId);
  if (cards.length) {
    await db`CREATE TABLE IF NOT EXISTS live_cards (project_id TEXT NOT NULL, tool_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL, PRIMARY KEY(project_id,tool_id))`;
    for (const card of cards) {
      await db`INSERT INTO live_cards (project_id, tool_id, version, data) VALUES (${projectId}, ${String(card.tool_id)}, ${Number(card.version ?? 0)}, ${JSON.stringify(card.data ?? {})}::jsonb) ON CONFLICT (project_id, tool_id) DO NOTHING`;
    }
  }
  await recordDeletionAudit(db, { projectId, projectTitle: String(entry.name ?? ""), ownerId: (entry.owner_id as string | null) ?? null, actor, action: "restore-backup" });
  // Bring back any of the project's media files that are missing from live
  // storage, using the off-site backup copies, when backup storage is set
  // up. A file that cannot be brought back is reported, never fatal: the
  // project row itself is already restored.
  let assetsRestored = 0;
  const assetsMissing: string[] = [];
  if (media) {
    for (const key of collectAssetKeys([entry])) {
      try {
        if (await source.exists(key)) continue;
        const backed = await media.get(backupAssetKey(key));
        if (!backed) { assetsMissing.push(key); continue; }
        await source.write(key, backed.bytes, backed.contentType);
        assetsRestored++;
      } catch { assetsMissing.push(key); }
    }
  }
  return { ok: true as const, id: projectId, assetsRestored, assetsMissing };
}

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET
// environment variable is set. Fail closed when no secret is configured.
export function isCronAuthorized(authorization: string | null | undefined, secret: string | undefined = process.env.CRON_SECRET) {
  if (!secret) return false;
  return authorization === `Bearer ${secret}`;
}
