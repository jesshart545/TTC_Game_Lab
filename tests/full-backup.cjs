// Full backup: when off-site backup storage is configured, every snapshot
// also copies the snapshot data and every media file to that storage (each
// file once), records what it held, and a restore brings missing media
// files back. Without the configuration, snapshots behave exactly as before.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');

function load(file, requireFn) {
  const exp = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: exp, module: { exports: exp }, require: requireFn, process, console, URL, Date, Math, Set, Map, JSON, Promise, setTimeout, clearTimeout });
  return exp;
}

// ---- Fake database (only the backup/restore surface) ----
function makeStore() { return { projects: new Map(), backups: [], audit: [], backupSeq: 0, clock: 0 }; }
function tick(store) { return new Date(1700000000000 + (++store.clock) * 60000); }
function seedProject(store, id, assetKeys) {
  store.projects.set(id, {
    id, slug: id + '-slug', name: 'Project ' + id, description: '', status: 'Draft', theme: 'cyan', prompt: '',
    owner_id: 'user-1', updated_at: tick(store), deleted_at: null, deleted_by: null,
    data: { id, assets: assetKeys.map(k => ({ name: k.split('/').pop(), storageKey: k })), gameTools: [], controls: [] },
  });
}
function makeDb(store) {
  return async function db(parts, ...values) {
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith('ALTER TABLE') || q.startsWith('CREATE TABLE') || q.startsWith('CREATE INDEX')) return [];
    if (q.includes('INSERT INTO project_deletion_audit')) { store.audit.push({ action: values[5] }); return []; }
    if (q.includes('DELETE FROM project_backups')) {
      const keep = values[0];
      const sorted = [...store.backups].sort((a, b) => (b.created_at - a.created_at) || (b.id - a.id));
      const keepIds = new Set(sorted.slice(0, keep).map(b => b.id));
      const removed = store.backups.filter(b => !keepIds.has(b.id));
      store.backups = store.backups.filter(b => keepIds.has(b.id));
      return removed.map(b => ({ id: b.id, export_key: b.export_key ?? null }));
    }
    if (q.includes('INSERT INTO project_backups')) {
      const row = { id: ++store.backupSeq, created_at: tick(store), project_count: values[0], payload: JSON.parse(values[1]), export_key: null, exported_at: null, export_error: null, asset_backup: null };
      store.backups.push(row);
      return [{ id: row.id, created_at: row.created_at }];
    }
    if (q.includes('UPDATE project_backups') && q.includes('asset_backup')) {
      const row = store.backups.find(b => b.id === Number(values[1]));
      if (row) row.asset_backup = JSON.parse(values[0]);
      return [];
    }
    if (q.includes('UPDATE project_backups')) {
      const row = store.backups.find(b => b.id === Number(values[3]));
      if (row) { row.export_key = values[0]; row.exported_at = values[1]; row.export_error = values[2]; }
      return [];
    }
    if (q.includes('FROM project_backups')) {
      if (q.includes('payload')) { const row = store.backups.find(b => b.id === Number(values[0])); return row ? [{ ...row }] : []; }
      return [...store.backups].sort((a, b) => (b.created_at - a.created_at) || (b.id - a.id));
    }
    if (q.includes('INSERT INTO projects')) {
      store.projects.set(values[0], { id: values[0], slug: values[1], name: values[2], description: values[3], status: values[4], theme: values[5], prompt: values[6], data: JSON.parse(values[7]), owner_id: values[8], updated_at: tick(store), deleted_at: null, deleted_by: null });
      return [];
    }
    if (q.includes('FROM projects') && q.includes('WHERE')) {
      const row = [...store.projects.values()].find(p => p.id === values[0] || p.slug === values[1]);
      return row ? [{ id: row.id }] : [];
    }
    if (q.includes('FROM projects')) return [...store.projects.values()];
    return [];
  };
}

// ---- Fake live bucket (via the object-storage module stub) ----
const liveBucket = new Map();
const objectStorageStub = {
  putAsset: async (key, body, contentType) => { liveBucket.set(key, { bytes: Buffer.from(body), contentType }); },
  deleteAsset: async key => { liveBucket.delete(key); },
  getAssetBytes: async key => { const hit = liveBucket.get(key); if (!hit) throw new Error('NoSuchKey'); return { bytes: new Uint8Array(hit.bytes), contentType: hit.contentType }; },
  assetExists: async key => liveBucket.has(key),
  getAssetUrl: async key => 'https://example/' + key,
};

// ---- Fake off-site backup bucket (via the backup-storage module stub) ----
const backupBucket = new Map();
const media = {
  listKeys: async prefix => [...backupBucket.keys()].filter(k => k.startsWith(prefix)),
  put: async (key, body, contentType) => { backupBucket.set(key, { bytes: Buffer.isBuffer(body) || body instanceof Uint8Array ? Buffer.from(body) : Buffer.from(String(body)), contentType }); },
  get: async key => { const hit = backupBucket.get(key); return hit ? { bytes: new Uint8Array(hit.bytes), contentType: hit.contentType } : null; },
};
let mediaConfigured = true;
const backupStorageStub = {
  getBackupMediaStorage: () => (mediaConfigured ? media : null),
  backupAssetKey: k => 'backups/assets/' + k,
  BACKUP_ASSET_PREFIX: 'backups/assets/',
};

const protection = load('lib/project-protection.ts', id =>
  id === './db' ? {} :
  id === './object-storage' ? objectStorageStub :
  id === './backup-storage' ? backupStorageStub :
  require(id));

const admin = { id: 'admin-1', email: 'admin@example.com' };
function putLive(key, text, contentType = 'application/octet-stream') { liveBucket.set(key, { bytes: Buffer.from(text), contentType }); }

(async () => {
  const store = makeStore();
  const db = makeDb(store);
  seedProject(store, 'p1', ['projects/p1/bg.png', 'projects/p1/song.mp3']);
  seedProject(store, 'p2', ['projects/p2/clip.mp4']);
  putLive('projects/p1/bg.png', 'PNGDATA', 'image/png');
  putLive('projects/p1/song.mp3', 'MP3DATA', 'audio/mpeg');
  putLive('projects/p2/clip.mp4', 'MP4DATA', 'video/mp4');

  // First full backup: everything is copied off-site, once.
  const snap1 = await protection.createBackupSnapshot(db);
  assert.equal(snap1.assetBackup.configured, true);
  assert.equal(snap1.assetBackup.total, 3);
  assert.equal(snap1.assetBackup.copied, 3);
  assert.equal(snap1.assetBackup.alreadyPresent, 0);
  assert.deepEqual([...snap1.assetBackup.failed], []);
  assert.equal(snap1.assetBackup.snapshotExported, true);
  assert.equal(backupBucket.get('backups/assets/projects/p1/bg.png').bytes.toString(), 'PNGDATA');
  assert.equal(backupBucket.get('backups/assets/projects/p2/clip.mp4').bytes.toString(), 'MP4DATA');
  assert.ok(backupBucket.has(snap1.exportKey), 'snapshot JSON is in the off-site bucket too');
  const manifest = JSON.parse(backupBucket.get('backups/manifest.json').bytes.toString());
  assert.deepEqual(manifest.assets, ['projects/p1/bg.png', 'projects/p1/song.mp3', 'projects/p2/clip.mp4']);
  const row1 = store.backups.find(b => b.id === Number(snap1.id));
  assert.equal(row1.asset_backup.copied, 3, 'the summary is recorded on the snapshot row');

  // Second backup: nothing new to copy.
  const snap2 = await protection.createBackupSnapshot(db);
  assert.equal(snap2.assetBackup.copied, 0);
  assert.equal(snap2.assetBackup.alreadyPresent, 3);

  // A media file missing from live storage is reported, never fatal.
  seedProject(store, 'p3', ['projects/p3/ghost.png']);
  const snap3 = await protection.createBackupSnapshot(db);
  assert.deepEqual([...snap3.assetBackup.failed], ['projects/p3/ghost.png']);
  assert.equal(snap3.assetBackup.total, 4);

  // Restore brings a lost media file back from the off-site copy.
  liveBucket.delete('projects/p2/clip.mp4');
  store.projects.delete('p2');
  const restored = await protection.restoreProjectFromBackup(db, Number(snap2.id), 'p2', admin);
  assert.equal(restored.ok, true);
  assert.equal(restored.assetsRestored, 1);
  assert.deepEqual([...restored.assetsMissing], []);
  assert.equal(liveBucket.get('projects/p2/clip.mp4').bytes.toString(), 'MP4DATA');
  assert.equal(store.projects.get('p2').name, 'Project p2');

  // Without the off-site configuration, snapshots and restores work as before.
  mediaConfigured = false;
  backupBucket.clear();
  const snap4 = await protection.createBackupSnapshot(db);
  assert.equal(snap4.assetBackup.configured, false);
  assert.equal(backupBucket.size, 0);
  store.projects.delete('p1');
  const restoredPlain = await protection.restoreProjectFromBackup(db, Number(snap4.id), 'p1', admin);
  assert.equal(restoredPlain.ok, true);
  assert.equal(restoredPlain.assetsRestored, 0);

  console.log('full-backup: all assertions passed');
})().catch(error => { console.error(error); process.exit(1); });
