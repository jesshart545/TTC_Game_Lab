const fs = require('fs'), vm = require('vm'), ts = require('typescript'), assert = require('node:assert/strict');

// Repo-style loader: transpile a TS module in a vm with a stubbed require map.
function load(file, requireFn) {
  const exp = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: exp, module: { exports: exp }, require: requireFn, process, console, URL, Date, Math, Set, Map, JSON, Promise, setTimeout, clearTimeout });
  return exp;
}

// ---- In-memory fake of the Neon tagged-template db ----
function makeStore() {
  return { projects: new Map(), audit: [], backups: [], liveHosts: new Map(), liveEvents: [], liveCards: [], auditSeq: 0, backupSeq: 0, clock: 0 };
}
function tick(store) { return new Date(1700000000000 + (++store.clock) * 60000); }
function seedProject(store, id, ownerId, name) {
  const row = { id, slug: id + '-slug', name, description: 'desc ' + id, status: 'Draft', theme: 'cyan', prompt: '', owner_id: ownerId, updated_at: tick(store), deleted_at: null, deleted_by: null, data: { id, name, assets: [{ name: 'bg.png', storageKey: 'projects/' + id + '/bg.png', inProject: true }], gameTools: [], controls: [] } };
  store.projects.set(id, row);
  return row;
}
function makeDb(store) {
  return async function db(parts, ...values) {
    const q = parts.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith('ALTER TABLE') || q.startsWith('CREATE TABLE') || q.startsWith('CREATE INDEX')) return [];
    if (q.includes('INSERT INTO project_deletion_audit')) {
      store.audit.push({ id: ++store.auditSeq, project_id: values[0], project_title: values[1], owner_id: values[2], actor_id: values[3], actor_email: values[4], action: values[5], created_at: tick(store) });
      return [];
    }
    if (q.includes('FROM project_deletion_audit')) {
      return [...store.audit].sort((a, b) => b.id - a.id).slice(0, values[0] ?? 100);
    }
    if (q.includes('DELETE FROM project_backups')) {
      const keep = values[0];
      const sorted = [...store.backups].sort((a, b) => (b.created_at - a.created_at) || (b.id - a.id));
      const keepIds = new Set(sorted.slice(0, keep).map(b => b.id));
      const removed = store.backups.filter(b => !keepIds.has(b.id));
      store.backups = store.backups.filter(b => keepIds.has(b.id));
      return removed.map(b => ({ id: b.id, export_key: b.export_key ?? null }));
    }
    if (q.includes('INSERT INTO project_backups')) {
      const row = { id: ++store.backupSeq, created_at: tick(store), project_count: values[0], payload: JSON.parse(values[1]), export_key: null, exported_at: null, export_error: null };
      store.backups.push(row);
      return [{ id: row.id, created_at: row.created_at }];
    }
    if (q.includes('UPDATE project_backups')) {
      const row = store.backups.find(b => b.id === Number(values[3]));
      if (row) { row.export_key = values[0]; row.exported_at = values[1]; row.export_error = values[2]; }
      return [];
    }
    if (q.includes('FROM project_backups')) {
      if (q.includes('payload')) { const row = store.backups.find(b => b.id === values[0]); return row ? [{ ...row }] : []; }
      return [...store.backups].sort((a, b) => (b.created_at - a.created_at) || (b.id - a.id)).map(b => ({ id: b.id, created_at: b.created_at, project_count: b.project_count, export_key: b.export_key ?? null, exported_at: b.exported_at ?? null, export_error: b.export_error ?? null }));
    }
    if (q.includes('UPDATE projects SET deleted_at = NOW()')) {
      const row = store.projects.get(values[1]);
      if (row && !row.deleted_at) { row.deleted_at = tick(store); row.deleted_by = values[0]; return [{ id: row.id }]; }
      return [];
    }
    if (q.includes('UPDATE projects SET deleted_at = NULL')) {
      const row = store.projects.get(values[0]);
      if (row && row.deleted_at) { row.deleted_at = null; row.deleted_by = null; return [{ id: row.id }]; }
      return [];
    }
    if (q.includes('DELETE FROM live_hosts')) { store.liveHosts.delete(values[0]); return []; }
    if (q.includes('DELETE FROM live_events')) { store.liveEvents = store.liveEvents.filter(e => e.project_id !== values[0]); return []; }
    if (q.includes('DELETE FROM projects')) { store.projects.delete(values[0]); return []; }
    if (q.includes('INSERT INTO live_hosts')) { if (!store.liveHosts.has(values[0])) store.liveHosts.set(values[0], values[1]); return []; }
    if (q.includes('INSERT INTO live_cards')) {
      if (!store.liveCards.some(c => c.project_id === values[0] && c.tool_id === values[1])) store.liveCards.push({ project_id: values[0], tool_id: values[1], version: values[2], data: JSON.parse(values[3]) });
      return [];
    }
    if (q.includes('INSERT INTO projects')) {
      const row = { id: values[0], slug: values[1], name: values[2], description: values[3], status: values[4], theme: values[5], prompt: values[6], data: JSON.parse(values[7]), owner_id: values[8], updated_at: tick(store), deleted_at: null, deleted_by: null };
      store.projects.set(row.id, row);
      return [];
    }
    if (q.includes('SELECT project_id, token_hash FROM live_hosts')) return [...store.liveHosts.entries()].map(([project_id, token_hash]) => ({ project_id, token_hash }));
    if (q.includes('SELECT project_id, tool_id, version, data FROM live_cards')) return store.liveCards.map(c => ({ ...c }));
    if (q.includes('FROM projects')) {
      const byIdOrSlug = (a, b) => [...store.projects.values()].find(r => r.id === a || r.slug === b);
      if (q.includes('SELECT data FROM projects')) {
        const row = byIdOrSlug(values[0], values[1]);
        if (!row || row.deleted_at) return [];
        if (q.includes('owner_id = ?') && row.owner_id !== values[2]) return [];
        return [{ data: row.data }];
      }
      if (q.includes('SELECT id, name, owner_id, deleted_at FROM projects')) {
        const row = byIdOrSlug(values[0], values[1]);
        if (!row || !row.deleted_at) return [];
        if (q.includes('owner_id = ?') && row.owner_id !== values[2]) return [];
        return [{ id: row.id, name: row.name, owner_id: row.owner_id, deleted_at: row.deleted_at }];
      }
      if (q.includes('SELECT id, name, owner_id FROM projects')) {
        const row = byIdOrSlug(values[0], values[1]);
        if (!row || row.deleted_at) return [];
        if (q.includes('owner_id = ?') && row.owner_id !== values[2]) return [];
        return [{ id: row.id, name: row.name, owner_id: row.owner_id }];
      }
      if (q.includes('SELECT id FROM projects')) {
        const row = [...store.projects.values()].find(r => r.id === values[0] || r.slug === values[1]);
        return row ? [{ id: row.id }] : [];
      }
      if (q.includes('SELECT id, slug')) {
        let rows = [...store.projects.values()];
        if (q.includes('deleted_at IS NOT NULL')) {
          rows = rows.filter(r => r.deleted_at);
          if (q.includes('owner_id = ?')) rows = rows.filter(r => r.owner_id === values[0]);
        } else if (!q.includes('ORDER BY id')) {
          rows = rows.filter(r => !r.deleted_at);
          if (q.includes('owner_id = ?')) rows = rows.filter(r => r.owner_id === values[0]);
        }
        return rows.map(r => ({ ...r }));
      }
    }
    throw new Error('Unexpected SQL: ' + q);
  };
}

// ---- Module loading with stubs ----
// The default backup-export storage (used when createBackupSnapshot is
// called without an explicit storage, as the routes do) delegates to this
// swappable fake so tests can record or break exports at will.
let defaultExportHook = null;
const objectStorageStub = {
  putAsset: async (key, body, contentType) => { if (defaultExportHook) return defaultExportHook.put(key, body, contentType); },
  deleteAsset: async key => { if (defaultExportHook) return defaultExportHook.remove(key); },
};
const protection = load('lib/project-protection.ts', id => id === './db' ? {} : id === './object-storage' ? objectStorageStub : require(id));
function recordingStorage() {
  const objects = new Map(); const removed = [];
  return {
    objects, removed,
    put: async (key, body, contentType) => { objects.set(key, { body: String(body), contentType }); },
    remove: async key => { removed.push(key); objects.delete(key); },
  };
}
let activeDb = null, currentUser = null, assetDeleteCalls = 0;
const nextStub = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } };
function routeRequire(extra = {}) {
  return id => {
    if (id === 'next/server') return nextStub;
    if (id.endsWith('lib/db')) return { getDb: () => activeDb };
    if (id.endsWith('lib/auth/server')) return { requireCreator: async () => currentUser, isAdmin: u => !!u && u.role === 'admin' };
    if (id.endsWith('lib/project-protection')) return protection;
    if (id.endsWith('lib/object-storage')) return { deleteAssetsByPrefix: async () => { assetDeleteCalls++; return 2; }, getAssetUrl: async k => 'https://example/' + k };
    if (id.endsWith('lib/city-crime-scene')) return { readCityCrimeSceneConfig: c => c, sanitizeCityCrimeSceneForOverlay: c => c, canUseCityCrimeScene: () => true, stripCityCrimeSceneTools: d => d };
    return extra[id] ?? require(id);
  };
}
const owner = { id: 'user-1', email: 'owner@example.com', role: 'user' };
const other = { id: 'user-2', email: 'other@example.com', role: 'user' };
const admin = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
const params = id => ({ params: Promise.resolve({ id }) });

(async () => {
  // ---------- Lib: trash / restore / delete-forever + audit ----------
  {
    const store = makeStore(); const db = makeDb(store);
    const row = seedProject(store, 'p1', 'user-1', 'Alpha');
    store.liveHosts.set('p1', 'hash1'); store.liveEvents.push({ project_id: 'p1', control_id: 'c1' });
    assert.equal(await protection.trashProject(db, row, owner), true);
    assert.ok(row.deleted_at instanceof Date); assert.equal(row.deleted_by, 'owner@example.com');
    assert.equal(await protection.trashProject(db, row, owner), false); // already trashed
    assert.deepEqual((await protection.listTrashedProjects(db, { id: 'user-1', admin: false })).map(r => r.id), ['p1']);
    assert.deepEqual(await protection.listTrashedProjects(db, { id: 'user-2', admin: false }), []); // owner-scoped
    assert.equal((await protection.listTrashedProjects(db, { id: 'admin-1', admin: true })).length, 1); // admin sees all
    assert.equal(await protection.restoreTrashedProject(db, row, owner), true);
    assert.equal(row.deleted_at, null); assert.equal(row.deleted_by, null);
    assert.equal(await protection.trashProject(db, row, owner), true);
    await protection.deleteProjectForever(db, row, owner);
    assert.equal(store.projects.has('p1'), false);
    assert.equal(store.liveHosts.has('p1'), false);
    assert.equal(store.liveEvents.length, 0);
    assert.deepEqual(store.audit.map(a => a.action), ['trash', 'restore', 'trash', 'delete-forever']);
    assert.ok(store.audit.every(a => a.project_id === 'p1' && a.project_title === 'Alpha' && a.actor_email === 'owner@example.com' && a.owner_id === 'user-1'));
    const listed = await protection.listDeletionAudit(db, 2);
    assert.equal(listed.length, 2); assert.equal(listed[0].action, 'delete-forever'); // newest first
    console.log('PASS: trash/restore/delete-forever lifecycle with audit entries for every action.');
  }

  // ---------- Routes: DELETE soft-deletes, library excludes trash, open 404s ----------
  {
    const store = makeStore(); const db = makeDb(store); activeDb = db; assetDeleteCalls = 0;
    seedProject(store, 'mine', 'user-1', 'Mine'); seedProject(store, 'theirs', 'user-2', 'Theirs');
    const listRoute = load('app/api/projects/route.ts', routeRequire());
    const idRoute = load('app/api/projects/[id]/route.ts', routeRequire());
    currentUser = owner;
    let res = await listRoute.GET();
    assert.deepEqual(res.body.projects.map(p => p.id), ['mine']);
    res = await idRoute.DELETE({}, params('mine'));
    assert.equal(res.status, 200); assert.equal(res.body.trashed, true);
    assert.equal(assetDeleteCalls, 0); // soft delete never touches stored assets
    assert.ok(store.projects.get('mine').deleted_at); // row survives in trash
    res = await listRoute.GET();
    assert.deepEqual(res.body.projects, []); // excluded from the library
    res = await idRoute.GET({}, params('mine'));
    assert.equal(res.status, 404); // trashed project is not openable
    res = await idRoute.DELETE({}, params('mine'));
    assert.equal(res.status, 404); // already trashed
    res = await idRoute.DELETE({}, params('theirs'));
    assert.equal(res.status, 404); // not the owner
    currentUser = admin;
    res = await listRoute.GET();
    assert.deepEqual(res.body.projects.map(p => p.id), ['theirs']); // admin library also excludes trash
    currentUser = null;
    res = await listRoute.GET();
    assert.equal(res.status, 401);
    console.log('PASS: DELETE route trashes instead of hard-deleting; library + open endpoints exclude trashed projects.');
  }

  // ---------- Routes: Trash restore + delete-forever ----------
  {
    const store = makeStore(); const db = makeDb(store); activeDb = db; assetDeleteCalls = 0;
    const row = seedProject(store, 'gone', 'user-1', 'Gone Soon');
    await protection.trashProject(db, row, owner);
    const trashRoute = load('app/api/projects/trash/route.ts', routeRequire());
    const trashIdRoute = load('app/api/projects/trash/[id]/route.ts', routeRequire());
    currentUser = other;
    let res = await trashRoute.GET();
    assert.deepEqual(res.body.projects, []); // someone else's trash is invisible
    res = await trashIdRoute.POST({ json: async () => ({ action: 'restore' }) }, params('gone'));
    assert.equal(res.status, 404);
    currentUser = owner;
    res = await trashRoute.GET();
    assert.equal(res.body.projects.length, 1); assert.equal(res.body.projects[0].id, 'gone');
    res = await trashIdRoute.POST({ json: async () => ({ action: 'bogus' }) }, params('gone'));
    assert.equal(res.status, 400);
    res = await trashIdRoute.POST({ json: async () => ({ action: 'restore' }) }, params('gone'));
    assert.equal(res.status, 200); assert.equal(res.body.restored, true);
    assert.equal(store.projects.get('gone').deleted_at, null);
    await protection.trashProject(db, store.projects.get('gone'), owner);
    res = await trashIdRoute.POST({ json: async () => ({ action: 'delete-forever' }) }, params('gone'));
    assert.equal(res.status, 200); assert.equal(res.body.deletedForever, true); assert.equal(res.body.deletedAssets, 2);
    assert.equal(assetDeleteCalls, 1); // delete-forever DOES clean stored assets, like the old hard delete
    assert.equal(store.projects.has('gone'), false);
    assert.deepEqual(store.audit.map(a => a.action), ['trash', 'restore', 'trash', 'delete-forever']);
    console.log('PASS: Trash view listing, restore, and delete-forever (with asset cleanup) routes.');
  }

  // ---------- Backup: completeness shape + retention pruning ----------
  {
    const store = makeStore(); const db = makeDb(store);
    seedProject(store, 'b1', 'user-1', 'Backup One'); seedProject(store, 'b2', 'user-2', 'Backup Two');
    store.liveHosts.set('b1', 'hosthash');
    store.liveCards.push({ project_id: 'b1', tool_id: 'tool-9', version: 3, data: { used: [1] } });
    const payload = await protection.buildBackupPayload(db);
    assert.equal(payload.version, 1);
    assert.equal(payload.projects.length, 2);
    const p1 = payload.projects.find(p => p.id === 'b1');
    for (const key of ['id', 'slug', 'name', 'description', 'status', 'theme', 'prompt', 'data', 'owner_id']) assert.ok(key in p1, 'payload project missing ' + key);
    assert.equal(p1.data.assets[0].storageKey, 'projects/b1/bg.png'); // asset metadata (not binaries)
    assert.deepEqual(payload.liveHosts, [{ project_id: 'b1', token_hash: 'hosthash' }]);
    assert.deepEqual(payload.liveCards, [{ project_id: 'b1', tool_id: 'tool-9', version: 3, data: { used: [1] } }]);
    const snap = await protection.createBackupSnapshot(db);
    assert.equal(snap.projectCount, 2);
    for (let i = 0; i < 15; i++) await protection.createBackupSnapshot(db);
    const list = await protection.listBackupSnapshots(db);
    assert.equal(list.length, protection.BACKUP_RETENTION); // 16 created, newest 14 kept
    assert.equal(list[0].id, 16); assert.equal(list[list.length - 1].id, 3);
    const single = makeStore(); const singleDb = makeDb(single);
    await protection.createBackupSnapshot(singleDb);
    assert.equal(await protection.pruneBackups(singleDb), 0); // pruning never removes the last remaining snapshot
    assert.equal((await protection.listBackupSnapshots(singleDb)).length, 1);
    console.log('PASS: backup payload is complete (projects + live hosts + live cards) and retention keeps the newest 14 without ever deleting the last snapshot.');
  }

  // ---------- Restore from backup ----------
  {
    const store = makeStore(); const db = makeDb(store);
    const original = seedProject(store, 'lost', 'user-1', 'Yipee Clone');
    store.liveHosts.set('lost', 'hosthash');
    store.liveCards.push({ project_id: 'lost', tool_id: 't1', version: 1, data: { used: [] } });
    const snap = await protection.createBackupSnapshot(db);
    // Simulate the Yipee Ki Yay loss: the rows vanish at the database level.
    store.projects.delete('lost'); store.liveHosts.delete('lost'); store.liveCards = [];
    const restored = await protection.restoreProjectFromBackup(db, Number(snap.id), 'lost', admin);
    assert.equal(restored.ok, true); assert.equal(restored.id, 'lost');
    const row = store.projects.get('lost');
    assert.ok(row); assert.equal(row.deleted_at, null); assert.equal(row.deleted_by, null); // back as a normal project
    assert.equal(row.owner_id, 'user-1'); assert.deepEqual(row.data, original.data); // full payload intact
    assert.equal(store.liveHosts.get('lost'), 'hosthash');
    assert.equal(store.liveCards.length, 1);
    assert.deepEqual((await protection.listTrashedProjects(db, { id: 'user-1', admin: false })), []); // not in trash — it's live
    // Conflict: restoring again must not overwrite the live project.
    row.data = { ...row.data, name: 'Edited after restore' };
    const conflict = await protection.restoreProjectFromBackup(db, Number(snap.id), 'lost', admin);
    assert.equal(conflict.ok, false); assert.equal(conflict.reason, 'conflict');
    assert.equal(store.projects.get('lost').data.name, 'Edited after restore'); // untouched
    const missing = await protection.restoreProjectFromBackup(db, Number(snap.id), 'nope', admin);
    assert.equal(missing.ok, false); assert.equal(missing.reason, 'project-not-in-backup');
    const noSnap = await protection.restoreProjectFromBackup(db, 9999, 'lost', admin);
    assert.equal(noSnap.ok, false); assert.equal(noSnap.reason, 'snapshot-not-found');
    assert.deepEqual(store.audit.map(a => a.action), ['restore-backup']);
    assert.equal(store.audit[0].actor_email, 'admin@example.com');
    console.log('PASS: restore-from-backup recreates an openable project with host + card rows, refuses to overwrite, and audits the restore.');
  }

  // ---------- Cron endpoint auth ----------
  {
    assert.equal(protection.isCronAuthorized(null, 's3cret'), false);
    assert.equal(protection.isCronAuthorized('Bearer wrong', 's3cret'), false);
    assert.equal(protection.isCronAuthorized('Bearer s3cret', 's3cret'), true);
    assert.equal(protection.isCronAuthorized('Bearer s3cret', ''), false); // no secret configured -> fail closed
    assert.equal(protection.isCronAuthorized('Bearer s3cret', undefined) || protection.isCronAuthorized(null, undefined), false);
    const store = makeStore(); const db = makeDb(store); activeDb = db;
    seedProject(store, 'c1', 'user-1', 'Cron Project');
    const cronRoute = load('app/api/cron/backup/route.ts', routeRequire());
    process.env.CRON_SECRET = 's3cret';
    const req = auth => ({ headers: { get: name => name === 'authorization' ? auth : null } });
    let res = await cronRoute.GET(req(null));
    assert.equal(res.status, 401); assert.equal(store.backups.length, 0);
    res = await cronRoute.GET(req('Bearer wrong'));
    assert.equal(res.status, 401); assert.equal(store.backups.length, 0);
    res = await cronRoute.GET(req('Bearer s3cret'));
    assert.equal(res.status, 200); assert.equal(res.body.ok, true); assert.equal(res.body.snapshot.projectCount, 1);
    assert.equal(store.backups.length, 1);
    delete process.env.CRON_SECRET;
    console.log('PASS: cron backup endpoint rejects unauthenticated calls and runs the same export with the CRON_SECRET bearer token.');
  }

  // ---------- Admin backups API: gating + back up now ----------
  {
    const store = makeStore(); const db = makeDb(store); activeDb = db;
    seedProject(store, 'a1', 'user-1', 'Admin Project');
    const backupsRoute = load('app/api/admin/backups/route.ts', routeRequire());
    const detailRoute = load('app/api/admin/backups/[id]/route.ts', routeRequire());
    const restoreRoute = load('app/api/admin/backups/[id]/restore/route.ts', routeRequire());
    currentUser = owner;
    let res = await backupsRoute.GET();
    assert.equal(res.status, 403); // not an admin
    currentUser = admin;
    res = await backupsRoute.POST();
    assert.equal(res.status, 200); assert.equal(res.body.snapshot.projectCount, 1);
    res = await backupsRoute.GET();
    assert.equal(res.body.snapshots.length, 1); assert.equal(res.body.snapshots[0].projectCount, 1);
    assert.ok(!('payload' in res.body.snapshots[0])); // list never leaks full payloads
    res = await detailRoute.GET({}, params(String(res.body.snapshots[0].id)));
    assert.deepEqual(res.body.projects.map(p => p.id), ['a1']);
    store.projects.delete('a1'); // simulate loss, then restore through the admin route
    res = await restoreRoute.POST({ json: async () => ({ projectId: 'a1' }) }, params('1'));
    assert.equal(res.status, 200); assert.ok(store.projects.get('a1'));
    res = await restoreRoute.POST({ json: async () => ({ projectId: 'a1' }) }, params('1'));
    assert.equal(res.status, 409); // conflict surfaced, nothing overwritten
    console.log('PASS: admin backups API is admin-gated, backs up on demand, and restores one project per snapshot.');
  }

  // ---------- External export: written on snapshot creation ----------
  {
    const store = makeStore(); const db = makeDb(store);
    seedProject(store, 'x1', 'user-1', 'Exported One');
    const storage = recordingStorage();
    const snap = await protection.createBackupSnapshot(db, storage);
    assert.equal(storage.objects.size, 1);
    const [key, entry] = [...storage.objects.entries()][0];
    assert.equal(key, snap.exportKey);
    assert.equal(key, protection.backupExportKey(Number(snap.id), snap.createdAt));
    assert.match(key, /^backups\/snapshot-1-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.json$/);
    assert.equal(entry.contentType, 'application/json');
    const exportedPayload = JSON.parse(entry.body);
    assert.equal(exportedPayload.projects.length, 1);
    assert.equal(exportedPayload.projects[0].id, 'x1'); // the export IS the snapshot payload
    assert.ok(snap.exportedAt instanceof Date); assert.equal(snap.exportError, null);
    const row = store.backups.find(b => b.id === Number(snap.id));
    assert.equal(row.export_key, key); assert.ok(row.exported_at instanceof Date); assert.equal(row.export_error, null);
    const list = await protection.listBackupSnapshots(db);
    assert.equal(list[0].export_key, key); assert.equal(list[0].export_error, null);
    // Default path (what the cron + admin routes call): no storage argument.
    const storage2 = recordingStorage(); defaultExportHook = storage2;
    const snap2 = await protection.createBackupSnapshot(db);
    defaultExportHook = null;
    assert.equal(storage2.objects.size, 1); assert.equal(snap2.exportKey, [...storage2.objects.keys()][0]);
    console.log('PASS: every new snapshot is also exported to object storage under backups/, with the outcome recorded on the snapshot row.');
  }

  // ---------- External export: failure never fails the snapshot ----------
  {
    const store = makeStore(); const db = makeDb(store);
    seedProject(store, 'x2', 'user-1', 'Export Fails');
    const broken = { put: async () => { throw new Error('storage is down'); }, remove: async () => {} };
    const snap = await protection.createBackupSnapshot(db, broken); // resolves, does not throw
    assert.equal(snap.projectCount, 1);
    assert.equal(snap.exportKey, null); assert.equal(snap.exportedAt, null); assert.equal(snap.exportError, 'storage is down');
    const row = store.backups.find(b => b.id === Number(snap.id));
    assert.equal(row.export_error, 'storage is down'); assert.equal(row.export_key, null); assert.equal(row.exported_at, null);
    const full = await protection.getBackupSnapshot(db, Number(snap.id));
    assert.equal(full.payload.projects[0].id, 'x2'); // the database snapshot stands, fully restorable
    console.log('PASS: a failed external export leaves the snapshot intact and records the error on the row.');
  }

  // ---------- External export: pruning removes only pruned snapshots' copies ----------
  {
    const store = makeStore(); const db = makeDb(store);
    seedProject(store, 'x3', 'user-1', 'Prune Exports');
    const storage = recordingStorage();
    const total = protection.BACKUP_RETENTION + 2; // 16 snapshots, newest 14 survive
    const allKeys = [];
    for (let i = 0; i < total; i++) allKeys.push((await protection.createBackupSnapshot(db, storage)).exportKey);
    const list = await protection.listBackupSnapshots(db);
    assert.equal(list.length, protection.BACKUP_RETENTION);
    const survivingKeys = new Set(list.map(r => r.export_key));
    assert.equal(storage.objects.size, protection.BACKUP_RETENTION);
    assert.deepEqual(new Set(storage.objects.keys()), survivingKeys); // exactly the survivors' exports remain
    assert.deepEqual([...storage.removed].sort(), allKeys.slice(0, 2).sort()); // snapshots 1 and 2 were pruned, their exports deleted
    assert.ok(storage.removed.every(k => !survivingKeys.has(k)));
    // A lone snapshot is never pruned, so its export is never deleted either.
    const single = makeStore(); const singleDb = makeDb(single);
    seedProject(single, 'x4', 'user-1', 'Last One');
    const singleStorage = recordingStorage();
    const only = await protection.createBackupSnapshot(singleDb, singleStorage);
    assert.equal(await protection.pruneBackups(singleDb, protection.BACKUP_RETENTION, singleStorage), 0);
    assert.equal(singleStorage.objects.size, 1); assert.ok(singleStorage.objects.has(only.exportKey));
    assert.equal(singleStorage.removed.length, 0);
    console.log('PASS: pruning deletes the external copies of pruned snapshots only, and never the last remaining snapshot\'s copy.');
  }

  // ---------- Schema extension is lazy + idempotent ----------
  {
    const sql = [];
    const recordingDb = async (parts, ...values) => { sql.push(parts.join('?').replace(/\s+/g, ' ').trim()); return []; };
    const fresh = load('lib/project-protection.ts', id => id === './db' ? {} : id === './object-storage' ? objectStorageStub : require(id));
    await fresh.ensureProtectionSchema(recordingDb);
    await fresh.ensureProtectionSchema(recordingDb); // second call: memoized, no duplicate DDL
    await Promise.all([fresh.ensureProtectionSchema(recordingDb), fresh.ensureProtectionSchema(recordingDb)]);
    for (const col of ['export_key', 'exported_at', 'export_error']) {
      const stmt = `ALTER TABLE project_backups ADD COLUMN IF NOT EXISTS ${col}`;
      assert.equal(sql.filter(q => q.startsWith(stmt)).length, 1, 'expected exactly one idempotent DDL for ' + col);
    }
    console.log('PASS: export columns are added by lazy, idempotent (IF NOT EXISTS) schema DDL.');
  }

  console.log('ALL PROJECT-PROTECTION TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
