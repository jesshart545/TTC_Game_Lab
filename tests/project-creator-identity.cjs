const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

const root = path.join(__dirname, '..');
const { creatorEmailForViewer } = load('lib/creator-identity.ts');

// 1. The shaping rule (Jessica's correction): creator identification is
// ADMIN-ONLY. An admin sees the creating account's email; everyone else —
// including the project's own owner — gets null, so nothing about the
// creator is ever sent to a non-admin client.
assert.equal(creatorEmailForViewer(true, 'creator@example.com'), 'creator@example.com', 'admin sees the creator email');
assert.equal(creatorEmailForViewer(false, 'creator@example.com'), null, 'non-admin owner gets null even for their own project');
assert.equal(creatorEmailForViewer(false, 'someone-else@example.com'), null, 'non-admin stranger gets null');
assert.equal(creatorEmailForViewer(false, null), null, 'non-admin + no owner -> null');

// 2. A missing or unresolvable owner never invents an email (the admin UI
// turns this null into the visible "Creator unknown").
assert.equal(creatorEmailForViewer(true, null), null, 'admin + missing owner -> null');
assert.equal(creatorEmailForViewer(true, undefined), null, 'admin + undefined owner -> null');
assert.equal(creatorEmailForViewer(true, ''), null, 'admin + empty owner email -> null');
assert.equal(creatorEmailForViewer(true, '   '), null, 'admin + blank owner email -> null');
assert.equal(creatorEmailForViewer(true, '  creator@example.com  '), 'creator@example.com', 'owner email is trimmed');

// 3. API source guards: both project endpoints shape creatorEmail through
// the one admin-only helper, and the list endpoint resolves owners in a
// single batched lookup keyed on the project's stored owner_id.
const listRoute = fs.readFileSync(path.join(root, 'app/api/projects/route.ts'), 'utf8');
assert.ok(listRoute.includes('creatorEmailForViewer(admin,'), 'list endpoint shapes creatorEmail via the admin-only helper');
assert.ok(listRoute.includes('WHERE id = ANY('), 'list endpoint batch-resolves owner emails in one query');
assert.ok(listRoute.includes('neon_auth.user'), 'list endpoint resolves owner_id via neon_auth.user');
assert.ok(listRoute.includes('viewerIsAdmin: admin'), 'list endpoint reports the viewer admin flag');
assert.ok(listRoute.includes('owner_id'), 'list endpoint reads the stored owner_id');

const detailRoute = fs.readFileSync(path.join(root, 'app/api/projects/[id]/route.ts'), 'utf8');
assert.ok(detailRoute.includes('creatorEmailForViewer(admin, ownerEmail)'), 'detail endpoint shapes creatorEmail via the admin-only helper');
assert.ok(detailRoute.includes('creatorEmail, viewerIsAdmin: admin'), 'detail endpoint returns creatorEmail + viewerIsAdmin');
assert.ok(detailRoute.includes('ownerCcssEntitled'), 'detail endpoint keeps the CCS entitlement boolean');

// 4. UI source guards: on every surface the creator line exists ONLY inside
// a viewerIsAdmin conditional, so a non-admin session renders nothing new —
// no "by" line, no "Created by", no "Creator unknown".
const surfaces = [
  ['app/projects/page.tsx', 'by {creatorById[project.id]}'],
  ['app/workspace-home.tsx', 'by {creatorById[project.id]}'],
  ['app/project/[id]/page.tsx', 'Created by ${creatorEmail}'],
];
for (const [file, line] of surfaces) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(source.includes('viewerIsAdmin &&'), `${file}: creator line is gated on viewerIsAdmin`);
  assert.ok(source.includes(line), `${file}: renders the creator line`);
  assert.ok(source.includes('Creator unknown'), `${file}: admin sees "Creator unknown" when the owner is unrecorded`);
  // The gate must wrap the rendered line: the conditional appears before it.
  assert.ok(source.indexOf('viewerIsAdmin &&') < source.indexOf(line), `${file}: the admin gate precedes the creator line`);
}

// 5. The creator identity must not ride inside the saved Project JSON: the
// clients keep it in a side map keyed by project id, never on the Project
// object itself (which is persisted verbatim on save).
for (const file of ['app/projects/page.tsx', 'app/workspace-home.tsx']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(source.includes('creatorById'), `${file}: keeps creator emails in a side map`);
  assert.ok(!source.includes('creatorEmail:'), `${file}: never stamps creatorEmail onto a project object`);
}

// 6. Behavioral: execute the REAL route handlers against a fake db (the
// project-protection.cjs harness pattern) with the REAL creator-identity
// helper wired in, and inspect the actual response bodies per viewer.
const vm = require('node:vm');
const ts = require('typescript');
function loadWith(file, requireFn) {
  const exp = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: exp, module: { exports: exp }, require: requireFn, process, console, URL, Date, Math, Set, Map, JSON, Promise, setTimeout, clearTimeout });
  return exp;
}

const USERS = { 'user-1': 'owner@example.com', 'user-2': 'other@example.com' };
const PROJECT_ROWS = [
  { id: 'p1', slug: 'p1-slug', name: 'Alpha', description: '', status: 'Draft', theme: 'cyan', updated_at: new Date(0), prompt: '', owner_id: 'user-1', data: { id: 'p1', name: 'Alpha' } },
  { id: 'p2', slug: 'p2-slug', name: 'Beta', description: '', status: 'Draft', theme: 'cyan', updated_at: new Date(0), prompt: '', owner_id: 'user-2', data: { id: 'p2', name: 'Beta' } },
  { id: 'p3', slug: 'p3-slug', name: 'Legacy', description: '', status: 'Draft', theme: 'cyan', updated_at: new Date(0), prompt: '', owner_id: null, data: { id: 'p3', name: 'Legacy' } },
];
let currentUser = null;
const fakeDb = async (parts, ...values) => {
  const q = parts.join('?').replace(/\s+/g, ' ').trim();
  if (q.startsWith('CREATE TABLE') || q.startsWith('ALTER TABLE') || q.startsWith('CREATE INDEX')) return [];
  if (q.includes('FROM neon_auth.user')) {
    if (q.includes('ANY(')) return (values[0] || []).filter(id => USERS[id]).map(id => ({ id, email: USERS[id] }));
    return USERS[values[0]] ? [{ email: USERS[values[0]] }] : [];
  }
  if (q.startsWith('SELECT data FROM projects')) {
    const row = PROJECT_ROWS.find(r => r.id === values[0] || r.slug === values[0]);
    return row ? [{ data: row.data }] : [];
  }
  if (q.startsWith('SELECT id, name, owner_id FROM projects')) {
    const row = PROJECT_ROWS.find(r => r.id === values[0] || r.slug === values[0]);
    return row ? [{ id: row.id, name: row.name, owner_id: row.owner_id }] : [];
  }
  if (q.includes('FROM projects')) return PROJECT_ROWS;
  return [];
};
const nextStub = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } };
function routeRequire(id) {
  if (id === 'next/server') return nextStub;
  if (id.endsWith('lib/db')) return { getDb: () => fakeDb };
  if (id.endsWith('lib/auth/server')) return { requireCreator: async () => currentUser, isAdmin: u => !!u && u.role === 'admin' };
  if (id.endsWith('lib/project-protection')) return { ensureProtectionSchema: async () => {}, trashProject: async () => true };
  if (id.endsWith('lib/city-crime-scene')) return { readCityCrimeSceneConfig: c => c, sanitizeCityCrimeSceneForOverlay: c => c, canUseCityCrimeScene: () => false, stripCityCrimeSceneTools: d => d };
  if (id.endsWith('lib/creator-identity')) return { creatorEmailForViewer };
  return require(id);
}
const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
const ownerUser = { id: 'user-1', email: 'owner@example.com', role: 'user' };
const strangerUser = { id: 'user-3', email: 'stranger@example.com', role: 'user' };
const params = id => ({ params: Promise.resolve({ id }) });

(async () => {
  const listRoute = loadWith('app/api/projects/route.ts', routeRequire);
  const detailRoute = loadWith('app/api/projects/[id]/route.ts', routeRequire);

  // List as ADMIN: every project's creator email is resolved from owner_id,
  // the unowned legacy project stays null, and owner_id itself is not sent.
  currentUser = adminUser;
  const adminList = await listRoute.GET();
  assert.equal(adminList.body.viewerIsAdmin, true, 'list: admin flag reported');
  const byId = Object.fromEntries(adminList.body.projects.map(p => [p.id, p]));
  assert.equal(byId.p1.creatorEmail, 'owner@example.com', 'list: admin sees p1 creator');
  assert.equal(byId.p2.creatorEmail, 'other@example.com', 'list: admin sees p2 creator');
  assert.equal(byId.p3.creatorEmail, null, 'list: admin sees null for the unowned project (-> "Creator unknown")');
  for (const p of adminList.body.projects) assert.ok(!('owner_id' in p), 'list: owner_id is never sent to the client');

  // List as the OWNER (non-admin): no creatorEmail anywhere — not even for
  // their own project — and no creator email string appears in the payload.
  currentUser = ownerUser;
  const ownerList = await listRoute.GET();
  assert.equal(ownerList.body.viewerIsAdmin, false, 'list: owner is not flagged admin');
  for (const p of ownerList.body.projects) assert.equal(p.creatorEmail, null, 'list: non-admin response carries creatorEmail: null');
  assert.ok(!JSON.stringify(ownerList.body).includes('other@example.com'), 'list: non-admin payload contains no creator emails');

  // List as a STRANGER (non-admin): same — null everywhere.
  currentUser = strangerUser;
  const strangerList = await listRoute.GET();
  for (const p of strangerList.body.projects) assert.equal(p.creatorEmail, null, 'list: stranger response carries creatorEmail: null');

  // Detail as ADMIN: creator email present; as OWNER: null (admin-only);
  // unowned project as ADMIN: null.
  currentUser = adminUser;
  const adminDetail = await detailRoute.GET({}, params('p1'));
  assert.equal(adminDetail.body.creatorEmail, 'owner@example.com', 'detail: admin sees the creator email');
  assert.equal(adminDetail.body.viewerIsAdmin, true, 'detail: admin flag reported');
  currentUser = ownerUser;
  const ownerDetail = await detailRoute.GET({}, params('p1'));
  assert.equal(ownerDetail.body.creatorEmail, null, 'detail: even the owner gets null (admin-only)');
  assert.equal(ownerDetail.body.viewerIsAdmin, false, 'detail: owner is not flagged admin');
  currentUser = adminUser;
  const legacyDetail = await detailRoute.GET({}, params('p3'));
  assert.equal(legacyDetail.body.creatorEmail, null, 'detail: unowned project -> null for admin too');

  console.log('project-creator-identity: all assertions passed');
})().catch(error => { console.error(error); process.exit(1); });
