const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

// Values loaded through the vm test loader live in another realm, so
// structural comparisons go through JSON rather than deepStrictEqual.
const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);

const root = path.join(__dirname, '..');
const kinds = load('lib/project-kinds.ts');
const { isKindComingSoon, isKindGatedFor, setupPiecesForKind, projectKindInfo } = kinds;
const projectLib = load('lib/project.ts');
const flow = fs.readFileSync(path.join(root, 'app/project/new/flow.tsx'), 'utf8');
const projectTs = fs.readFileSync(path.join(root, 'lib/project.ts'), 'utf8');

// Radio create flow (Jessica, 2026-11-23): the format question comes
// FIRST — radio/DJ live stream or karaoke live — then the title (both
// branches), then, on the radio/DJ branch only, what kind of music show
// it is (that answer is the theme that seeds Jewel). No pieces step.
// The kind stays Coming Soon for everyone except the site admin, who
// can create and open radio projects to build and test the builder —
// the multiplayer admin exemption (PR #181) extended to radio.

// 1. The gate: admin can create radio; non-admins stay gated. The raw
// Coming Soon flags do not move, and no other kind's gate changes.
assert.equal(isKindGatedFor('radio', true), false, 'admin can start a radio project to build and test it');
assert.equal(isKindGatedFor('radio', false), true, 'non-admin still cannot start a radio project');
assert.equal(isKindGatedFor('multiplayer', true), false, 'multiplayer stays open to the admin');
assert.equal(isKindGatedFor('multiplayer', false), false, 'multiplayer is live for all users (PR #222) and stays that way');
assert.equal(isKindGatedFor('gameshow', false), false, 'gameshow stays open');
assert.equal(isKindGatedFor('talk', false), false, 'talk stays open');
assert.equal(isKindGatedFor(undefined, false), false, 'unset kind is never gated');
assert.equal(isKindComingSoon('radio'), true, 'radio is still a Coming Soon kind');
assert.equal(isKindComingSoon('multiplayer'), false, 'multiplayer is no longer a Coming Soon kind (PR #222)');
console.log('PASS: radio is open to the admin only; every other viewer and kind is gated exactly as before.');

// 2. Card copy: every radio show is a music show (Jessica, 2026-11-23) —
// talk programs belong to Talk Show, so the card never advertises talk.
const radioInfo = projectKindInfo('radio');
assert(radioInfo, 'radio kind card exists');
assert(!/talk radio/i.test(radioInfo.description), 'radio card no longer advertises talk radio');
assert(/music/i.test(radioInfo.description), 'radio card copy is music-only');
console.log('PASS: radio kind card advertises music shows only — no talk radio.');

// 3. The format question comes before the title in radio's flow, the
// title is asked on both branches, and the music-show question exists
// only on the radio/DJ branch.
const radioBranchStart = flow.indexOf(') : kind === "radio" ? (');
assert(radioBranchStart >= 0, 'the scratch screen has a dedicated radio branch');
const radioScreen = flow.slice(radioBranchStart, radioBranchStart + 4000);
const formatAt = radioScreen.indexOf('is this a radio/DJ live stream, or a karaoke live?');
const titleAt = radioScreen.indexOf('aria-label="Show title"');
const musicAt = radioScreen.indexOf('aria-label="What kind of music show"');
assert(formatAt >= 0, 'radio asks the format question');
assert(titleAt > formatAt, 'the title is asked AFTER the format question');
assert(musicAt > titleAt, 'the music-show question follows the title');
assert(radioScreen.includes('setRadioBranch("radio-dj")'), 'the radio/DJ choice sets the radio-dj branch');
assert(radioScreen.includes('setRadioBranch("karaoke")'), 'the karaoke choice sets the karaoke branch');
assert(radioScreen.includes('radioBranch === "radio-dj" && ('), 'the music-show question renders only on the radio/DJ branch');
assert(flow.includes('if (kind === "radio" && !radioBranch) return;'), 'creation cannot start until a branch is picked');
assert(flow.includes('disabled={(kind === "radio" && !radioBranch) || (kind === "talk" && !talkBranch)}'), 'the Next button stays disabled until a branch is picked (radio, and talk likewise since the talk branch build)');
console.log('PASS: format question first, then title on both branches, music-show question on the radio/DJ branch only.');

// 4. No pieces step for radio — the kind offers no setup pieces, the
// scratch screen renders no pieces grid for radio, and a radio scratch
// start carries no pieces. Other kinds keep their pieces untouched.
eq(setupPiecesForKind('radio'), [], 'radio offers no setup pieces');
assert.equal(setupPiecesForKind('gameshow').length, 6, 'gameshow still offers the full shared list');
eq(setupPiecesForKind('talk').map(p => p.id), ['question-cards', 'video-clips'], 'talk still offers only its own pieces');
assert(flow.includes('{kind !== "radio" && kind !== "talk" && ('), 'the pieces grid is not rendered for radio (nor for talk, which folded its pieces step into the Jewel flow in the talk branch build)');
assert(flow.includes('scratch.pieces = [];'), 'a radio scratch start carries no pieces');
console.log('PASS: radio has no pieces step; gameshow and talk pieces are unchanged.');

// 5. The chosen branch is stored on the created project: the scratch
// start carries it, creation stamps it onto the project record, and
// the field survives the project's JSON round trip.
assert(flow.includes('scratch.branch = radioBranch ?? undefined;'), 'the scratch start carries the picked branch');
assert(flow.includes('if (start.branch) project.radioBranch = start.branch;'), 'creation stamps the branch onto the project');
assert(projectTs.includes('export type RadioBranch = "radio-dj" | "karaoke";'), 'the branch type is defined with the project record');
assert(projectTs.includes('radioBranch?: RadioBranch;'), 'the project record carries the branch field');
const created = projectLib.createProject('');
created.kind = 'radio';
created.radioBranch = 'karaoke';
const roundTripped = JSON.parse(JSON.stringify(created));
assert.equal(roundTripped.kind, 'radio', 'kind survives the round trip');
assert.equal(roundTripped.radioBranch, 'karaoke', 'the stored branch survives the round trip');
console.log('PASS: the chosen branch is stored on the created project.');

// 6. Theme seeding: on the radio/DJ branch the music-show answer is the
// theme, seeded into gamePlan.theme at creation exactly like a talk or
// gameshow theme (that is what seeds Jewel). Karaoke carries no theme.
assert(flow.includes('scratch.theme = radioBranch === "radio-dj" ? theme.trim() || undefined : undefined;'), 'the radio/DJ music-show answer becomes the scratch theme');
const radioSeedAt = flow.indexOf('if (start.kind === "radio") {');
assert(radioSeedAt >= 0, 'creation has a radio stamping block');
const radioSeed = flow.slice(radioSeedAt, radioSeedAt + 400);
assert(radioSeed.includes('project.radioBranch = start.branch'), 'the radio block stamps the branch');
assert(radioSeed.includes('project.gamePlan = { ...(project.gamePlan || {}), theme: start.theme }'), 'the radio block seeds gamePlan.theme like the other kinds');
console.log('PASS: the radio/DJ music-show answer seeds the project theme; karaoke carries none.');

console.log('PASS: radio create flow — format first, branch stored, no pieces, admin-only gate.');
