const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

const root = path.join(__dirname, '..');
const kinds = load('lib/project-kinds.ts');
const { isKindComingSoon, isKindGatedFor } = kinds;

// Admin multiplayer creation (Jessica, 2026-11-12): the site admin may
// create Off-Stream Multiplayer Game Night projects for testing while
// the Coming Soon gate stays exactly as it is for everyone else. Radio
// stays gated for everyone, admin included. The gate predicate is
// per-viewer; the underlying comingSoon flags do not move.

// 1. The exception: admin + multiplayer is open; every other gated
// combination stays shut.
assert.equal(isKindGatedFor('multiplayer', true), false, 'admin can start a multiplayer project for testing');
assert.equal(isKindGatedFor('multiplayer', false), true, 'non-admin still cannot start a multiplayer project');
assert.equal(isKindGatedFor('radio', true), true, 'radio stays gated even for the admin');
assert.equal(isKindGatedFor('radio', false), true, 'radio stays gated for non-admins');
assert.equal(isKindGatedFor('gameshow', false), false, 'gameshow stays open');
assert.equal(isKindGatedFor('gameshow', true), false, 'gameshow stays open for the admin too');
assert.equal(isKindGatedFor('talk', false), false, 'talk stays open');
assert.equal(isKindGatedFor(undefined, true), false, 'unset kind is never gated');
assert.equal(isKindGatedFor(undefined, false), false, 'unset kind is never gated for non-admins either');
console.log('PASS: only admin + multiplayer passes the gate; radio is gated for everyone.');

// 2. The raw Coming Soon flags are untouched — the exception lives in
// the per-viewer predicate, not in the kind data.
assert.equal(isKindComingSoon('multiplayer'), true, 'multiplayer is still a Coming Soon kind');
assert.equal(isKindComingSoon('radio'), true, 'radio is still a Coming Soon kind');
assert.equal(isKindComingSoon('gameshow'), false, 'gameshow was never gated');
console.log('PASS: comingSoon flags unchanged; the exception is viewer-scoped.');

// 3. Admin determination is the site's existing notion, computed on the
// server wrapper and handed to the flow as a plain boolean (the PR #126
// pattern the CCS entitlement already uses).
const newPage = fs.readFileSync(path.join(root, 'app/project/new/page.tsx'), 'utf8');
assert(newPage.includes('requireCreator, isAdmin'), 'new-project wrapper imports the shared isAdmin');
assert(newPage.includes('viewerIsAdmin = isAdmin(user)'), 'admin verdict computed server-side from the session user');
assert(newPage.includes('viewerIsAdmin={viewerIsAdmin}'), 'wrapper passes the boolean into the flow');
const authServer = fs.readFileSync(path.join(root, 'lib/auth/server.ts'), 'utf8');
assert(authServer.includes('export function isAdmin'), 'the reused admin notion is lib/auth/server isAdmin');
console.log('PASS: admin is the existing server-side isAdmin, passed down as viewerIsAdmin.');

// 4. Create flow wiring: both creation guards consult the per-viewer
// gate, gated cards still render disabled with the band, and the
// admin-open card is a normal selectable card with the small chip.
const flow = fs.readFileSync(path.join(root, 'app/project/new/flow.tsx'), 'utf8');
assert(flow.includes('viewerIsAdmin = false'), 'flow defaults to non-admin when no verdict is passed');
assert(flow.includes('if (isKindGatedFor(next, viewerIsAdmin)) return;'), 'chooseKind refuses only kinds gated for this viewer');
assert(flow.includes('if (!kind || isKindGatedFor(kind, viewerIsAdmin)) return;'), 'startScratch refuses only kinds gated for this viewer');
assert(flow.includes('const gated = isKindGatedFor(info.id, viewerIsAdmin);'), 'picker card disabled state is per-viewer');
assert(flow.includes('np-kind soon') && flow.includes('disabled aria-disabled="true"'), 'gated cards still render disabled');
assert(flow.includes('np-soonband'), 'gated cards still carry the Coming Soon! band');
assert(flow.includes('np-adminchip') && flow.includes('Admin testing'), 'admin-open card carries the small Admin testing chip');
assert(flow.includes('onClick={() => chooseKind(info.id)}'), 'open cards (incl. admin multiplayer) keep click-to-choose');
const newCss = fs.readFileSync(path.join(root, 'app/project/new/new-project.css'), 'utf8');
assert(newCss.includes('.np-adminchip'), 'chip styling ships with the picker stylesheet');
console.log('PASS: create flow opens multiplayer for the admin only; everyone else sees the same gate.');

// 5. In-project kind dropdown: same per-viewer gate, current kind still
// exempt, so an existing multiplayer project keeps working and an admin
// can switch a project TO multiplayer for testing.
const projectPage = fs.readFileSync(path.join(root, 'app/project/[id]/page.tsx'), 'utf8');
assert(projectPage.includes('isKindGatedFor(info.id, viewerIsAdmin) && project.kind !== info.id'), 'dropdown gate is per-viewer with the current-kind exemption');
console.log('PASS: kind dropdown lets the admin convert to multiplayer; non-admins unchanged.');

console.log('PASS: admin multiplayer creation exception is wired end to end.');
