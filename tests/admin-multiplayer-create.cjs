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
// now the only gated kind, and its exemption is an entitlement of
// exactly two accounts by email (Jessica, 2026-11-25:
// ladylovelace0627@gmail.com and sycoinc23@gmail.com; see
// tests/radio-create-flow.cjs). The admin role itself no longer
// exempts anyone from the radio gate.

// 1. Multiplayer is open to everyone; radio is gated for everyone
// except the two pilot accounts.
assert.equal(isKindGatedFor('multiplayer', 'ladylovelace0627@gmail.com'), false, 'a pilot account can start a multiplayer project');
assert.equal(isKindGatedFor('multiplayer', null), false, 'any user can start a multiplayer project — it is live');
assert.equal(isKindGatedFor('radio', 'ladylovelace0627@gmail.com'), false, 'Jessica can start a radio project (2026-11-25)');
assert.equal(isKindGatedFor('radio', 'sycoinc23@gmail.com'), false, 'sycoinc23 can start a radio project on his email alone (2026-11-25)');
assert.equal(isKindGatedFor('radio', 'fellow-admin@example.com'), true, 'radio stays gated for other admins — the role no longer exempts');
assert.equal(isKindGatedFor('radio', null), true, 'radio stays gated for everyone else');
assert.equal(isKindGatedFor('gameshow', null), false, 'gameshow stays open');
assert.equal(isKindGatedFor('gameshow', 'ladylovelace0627@gmail.com'), false, 'gameshow stays open for a pilot account too');
assert.equal(isKindGatedFor('talk', null), false, 'talk stays open');
assert.equal(isKindGatedFor(undefined, 'sycoinc23@gmail.com'), false, 'unset kind is never gated');
assert.equal(isKindGatedFor(undefined, null), false, 'unset kind is never gated for unknown viewers either');
console.log('PASS: multiplayer is gated for no one; radio is gated for everyone except the two pilot accounts.');

// 2. The Coming Soon flags carry the state: multiplayer's flag is gone,
// radio's is untouched.
assert.equal(isKindComingSoon('multiplayer'), false, 'multiplayer is no longer a Coming Soon kind');
assert.equal(isKindComingSoon('radio'), true, 'radio is still a Coming Soon kind');
assert.equal(isKindComingSoon('gameshow'), false, 'gameshow was never gated');
console.log('PASS: comingSoon flag removed for multiplayer only; radio unchanged.');

// 3. The gate's input is the viewer's own email, read from the session
// user on the server wrapper and handed to the flow as a plain value
// (the PR #126 pattern). The site's general admin notion still exists
// untouched — it simply no longer decides radio's gate.
const newPage = fs.readFileSync(path.join(root, 'app/project/new/page.tsx'), 'utf8');
assert(newPage.includes('requireCreator'), 'new-project wrapper reads the session user');
assert(newPage.includes('viewerEmail = user?.email ?? null'), 'viewer email computed server-side from the session user');
assert(newPage.includes('viewerEmail={viewerEmail}'), 'wrapper passes the email into the flow');
assert(!newPage.includes('isAdmin'), 'the new-project wrapper no longer consults the admin role for the gate');
const authServer = fs.readFileSync(path.join(root, 'lib/auth/server.ts'), 'utf8');
assert(authServer.includes('export function isAdmin'), 'the general admin notion in lib/auth/server is untouched');
console.log('PASS: the gate keys on the viewer email from the server wrapper; isAdmin itself is unchanged.');

// 4. Create flow wiring: both creation guards consult the per-viewer
// gate (now flag-driven), gated cards still render disabled with the
// band for the kinds that remain gated, and open cards — multiplayer
// included, for every viewer — are normal selectable cards.
const flow = fs.readFileSync(path.join(root, 'app/project/new/flow.tsx'), 'utf8');
assert(flow.includes('viewerEmail = null'), 'flow defaults to an unknown (gated) viewer when no email is passed');
assert(flow.includes('if (isKindGatedFor(next, viewerEmail)) return;'), 'chooseKind refuses only kinds gated for this viewer');
assert(flow.includes('if (!kind || isKindGatedFor(kind, viewerEmail)) return;'), 'startScratch refuses only kinds gated for this viewer');
assert(flow.includes('const gated = isKindGatedFor(info.id, viewerEmail);'), 'picker card disabled state is per-viewer');
assert(flow.includes('np-kind soon') && flow.includes('disabled aria-disabled="true"'), 'gated cards still render disabled');
assert(flow.includes('np-soonband'), 'gated cards still carry the Coming Soon! band');
assert(!flow.includes('np-adminchip') && !flow.includes('Admin testing'), 'no Admin testing chip: the two entitled accounts see a plain selectable card, exactly like an open kind');
assert(flow.includes('onClick={() => chooseKind(info.id)}'), 'open cards (incl. multiplayer for everyone) keep click-to-choose');
const newCss = fs.readFileSync(path.join(root, 'app/project/new/new-project.css'), 'utf8');
assert(newCss.includes('.np-soonband'), 'band styling ships with the picker stylesheet');
console.log('PASS: create flow opens multiplayer for everyone; radio opens for the two pilot accounts only.');

// 5. In-project kind dropdown: same per-viewer gate, current kind still
// exempt, so any user can switch a project TO multiplayer now, while
// radio converts only for the two pilot accounts.
const projectPage = fs.readFileSync(path.join(root, 'app/project/[id]/page.tsx'), 'utf8');
assert(projectPage.includes('isKindGatedFor(info.id, viewerEmail) && project.kind !== info.id'), 'dropdown gate is per-viewer with the current-kind exemption');
console.log('PASS: kind dropdown lets any user convert to multiplayer; radio converts for pilot accounts only.');

console.log('PASS: multiplayer game night is live for all users; the remaining gate is wired end to end.');
