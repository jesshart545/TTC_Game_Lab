const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

const root = path.join(__dirname, '..');
const kinds = load('lib/project-kinds.ts');
const { isKindComingSoon, isKindGatedFor } = kinds;

// Multiplayer is LIVE for all users (Jessica, 2026-11-23: "make
// multiplayer game night live for all users"). The 2026-11-12
// admin-testing exception is retired with the gate itself: multiplayer
// carries no comingSoon flag, so no viewer is gated from it. Radio is
// now the only gated kind, and the per-viewer predicate carries one
// exemption again: the site admin may start radio projects to build
// and test that builder (Jessica, 2026-11-23; see
// tests/radio-create-flow.cjs).

// 1. Multiplayer is open to everyone; radio is gated for everyone
// except the admin building it.
assert.equal(isKindGatedFor('multiplayer', true), false, 'admin can start a multiplayer project');
assert.equal(isKindGatedFor('multiplayer', false), false, 'any user can start a multiplayer project — it is live');
assert.equal(isKindGatedFor('radio', true), false, 'admin can start a radio project to build and test it (Jessica, 2026-11-23)');
assert.equal(isKindGatedFor('radio', false), true, 'radio stays gated for non-admins');
assert.equal(isKindGatedFor('gameshow', false), false, 'gameshow stays open');
assert.equal(isKindGatedFor('gameshow', true), false, 'gameshow stays open for the admin too');
assert.equal(isKindGatedFor('talk', false), false, 'talk stays open');
assert.equal(isKindGatedFor(undefined, true), false, 'unset kind is never gated');
assert.equal(isKindGatedFor(undefined, false), false, 'unset kind is never gated for non-admins either');
console.log('PASS: multiplayer is gated for no one; radio is gated for everyone except the admin.');

// 2. The Coming Soon flags carry the state: multiplayer's flag is gone,
// radio's is untouched.
assert.equal(isKindComingSoon('multiplayer'), false, 'multiplayer is no longer a Coming Soon kind');
assert.equal(isKindComingSoon('radio'), true, 'radio is still a Coming Soon kind');
assert.equal(isKindComingSoon('gameshow'), false, 'gameshow was never gated');
console.log('PASS: comingSoon flag removed for multiplayer only; radio unchanged.');

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
// gate (now flag-driven), gated cards still render disabled with the
// band for the kinds that remain gated, and open cards — multiplayer
// included, for every viewer — are normal selectable cards.
const flow = fs.readFileSync(path.join(root, 'app/project/new/flow.tsx'), 'utf8');
assert(flow.includes('viewerIsAdmin = false'), 'flow defaults to non-admin when no verdict is passed');
assert(flow.includes('if (isKindGatedFor(next, viewerIsAdmin)) return;'), 'chooseKind refuses only kinds gated for this viewer');
assert(flow.includes('if (!kind || isKindGatedFor(kind, viewerIsAdmin)) return;'), 'startScratch refuses only kinds gated for this viewer');
assert(flow.includes('const gated = isKindGatedFor(info.id, viewerIsAdmin);'), 'picker card disabled state is per-viewer');
assert(flow.includes('np-kind soon') && flow.includes('disabled aria-disabled="true"'), 'gated cards still render disabled');
assert(flow.includes('np-soonband'), 'gated cards still carry the Coming Soon! band');
assert(flow.includes('np-adminchip') && flow.includes('Admin testing'), 'the Admin testing chip machinery remains for any future per-viewer exemption');
assert(flow.includes('onClick={() => chooseKind(info.id)}'), 'open cards (incl. multiplayer for everyone) keep click-to-choose');
const newCss = fs.readFileSync(path.join(root, 'app/project/new/new-project.css'), 'utf8');
assert(newCss.includes('.np-adminchip'), 'chip styling ships with the picker stylesheet');
console.log('PASS: create flow opens multiplayer for everyone; radio keeps the same gate.');

// 5. In-project kind dropdown: same per-viewer gate, current kind still
// exempt, so any user can switch a project TO multiplayer now.
const projectPage = fs.readFileSync(path.join(root, 'app/project/[id]/page.tsx'), 'utf8');
assert(projectPage.includes('isKindGatedFor(info.id, viewerIsAdmin) && project.kind !== info.id'), 'dropdown gate is per-viewer with the current-kind exemption');
console.log('PASS: kind dropdown lets any user convert to multiplayer; gated kinds unchanged.');

console.log('PASS: multiplayer game night is live for all users; the remaining gate is wired end to end.');
