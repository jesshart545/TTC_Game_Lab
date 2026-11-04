const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

const root = path.join(__dirname, '..');
const kinds = load('lib/project-kinds.ts');
const { toolDefaults } = load('lib/game-tools.ts');
const { PROJECT_KINDS, SETUP_PIECES, applySetupPieces, projectKindInfo } = kinds;
// Values loaded through the vm test loader live in another realm, so
// structural comparisons go through JSON rather than deepStrictEqual.
const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);

// 1. The four kinds carry Jessica's approved demo wording, in demo order.
eq(PROJECT_KINDS.map(k => k.id), ['gameshow', 'talk', 'radio', 'multiplayer']);
eq(PROJECT_KINDS.map(k => k.title), [
  'Host a Gameshow Live',
  'Talk Show or Classroom',
  'Radio, DJ, or Karaoke',
  'Off-Stream Multiplayer Game Night',
]);
eq(PROJECT_KINDS.map(k => k.kicker), [
  'Design, Produce, and Host',
  'Talk · Teach · Live',
  'Voice & music · Always live',
  'Play together · No stream',
]);
assert.equal(PROJECT_KINDS[0].description, 'Custom built from scratch by you, or easy-to-build templates for fun games that will keep your audience coming back for more.');
assert.equal(PROJECT_KINDS[3].description, 'All the fun of a gameshow that even a host can enjoy on their night off — friends join by link, the game runs itself, you play along.');
for (const info of PROJECT_KINDS) {
  assert(info.image.startsWith('/redesign/'), 'kind image is a shipped static asset: ' + info.id);
  assert(fs.existsSync(path.join(root, 'public', info.image)), 'kind image file exists: ' + info.image);
  assert(projectKindInfo(info.id) === info);
}
assert.equal(projectKindInfo(undefined), undefined);
assert(fs.existsSync(path.join(root, 'public/redesign/tip-jewel-wand.webp')), 'wand tip image shipped');
assert(fs.existsSync(path.join(root, 'public/redesign/jewel-wave.mp4')), 'jewel wave video shipped');
console.log('PASS: four kinds carry the approved wording and shipped artwork.');

// 2. Setup pieces map only to tools that honestly exist — no invented
// "Effects" or "Music & sounds" tool tiles.
eq(SETUP_PIECES.map(p => p.label), ['Question cards', 'Prize wheel', 'Dice', 'Timer', 'Scoreboard', 'Video clips']);
assert(!SETUP_PIECES.some(p => /effect|music/i.test(p.label)), 'no fake Effects / Music & sounds tiles');
console.log('PASS: setup tiles map only to real tools.');

const baseProject = () => ({
  id: 'test-project', name: 'Test', slug: 'test', description: '', status: 'Draft', theme: 'cyan',
  updatedAt: '', prompt: '', messages: [], controls: [], assets: [],
  overlay: { title: 'TEST', subtitle: '', showChat: true, showAlerts: true, showCharacter: false },
  wheel: { enabled: false, title: 'Game Wheel', segments: [], spinning: false, visible: false },
  gameTools: [],
});

// 3. No tapped pieces -> nothing added, nothing wired.
const untouched = applySetupPieces(baseProject(), []);
assert.equal(untouched.gameTools.length, 0);
assert.equal(untouched.controls.length, 0);
const unknown = applySetupPieces(baseProject(), ['not-a-piece']);
assert.equal(unknown.gameTools.length, 0);
console.log('PASS: untapped pieces add nothing.');

// 4. Every piece mints its real tool with the Workshop's own defaults.
const full = applySetupPieces(baseProject(), SETUP_PIECES.map(p => p.id));
eq(full.gameTools.map(t => t.type), ['question-card', 'wheel', 'dice', 'countdown', 'scoreboard', 'youtube']);
for (const tool of full.gameTools) {
  assert.equal(tool.enabled, true, tool.type + ' enabled');
  assert.equal(tool.inToolbox, true, tool.type + ' in toolbox');
}
const byType = Object.fromEntries(full.gameTools.map(t => [t.type, t]));
eq(byType.wheel.config, toolDefaults('wheel'));
eq(byType.dice.config, toolDefaults('dice'));
eq(byType.countdown.config, toolDefaults('countdown'));
eq(byType.scoreboard.config, toolDefaults('scoreboard'));
eq(byType.youtube.config, toolDefaults('youtube'));
assert.equal(byType['question-card'].name, 'Question Cards');
// Only the card system brings its own Show/Reveal controls (exactly what
// the Workshop's card creator does); the minted tools add no dashboard
// wiring of their own — connecting stays the user's Library choice.
assert.equal(full.controls.length, 2);
assert(full.controls.every(c => (c.toolIds || []).includes(byType['question-card'].id)));
console.log('PASS: pieces mint real tools with default configs and no extra wiring.');

// 5. A subset adds only that subset.
const subset = applySetupPieces(baseProject(), ['timer', 'dice']);
eq(subset.gameTools.map(t => t.type), ['dice', 'countdown']);
assert.equal(subset.controls.length, 0);
console.log('PASS: subset selection adds only the tapped pieces.');

// 6. Kind is plain project data: it rides through a save-shaped JSON
// round trip untouched, and stays absent when never set.
const stamped = { ...baseProject(), kind: 'radio' };
assert.equal(JSON.parse(JSON.stringify(stamped)).kind, 'radio');
assert.equal('kind' in JSON.parse(JSON.stringify(baseProject())), false);
console.log('PASS: kind persists as project data and is absent by default.');

// 7. Source-level guards on the two rebuilt surfaces.
const home = fs.readFileSync(path.join(root, 'app/workspace-home.tsx'), 'utf8');
assert(!home.includes('Tell me what you want to create'), 'landing chat block is gone');
assert(!home.includes('Build with AI'), 'landing AI prompt bar is gone');
assert(home.includes('Meet Jewel — your magic wand'), 'Jewel tip card present');
assert(home.includes('/redesign/jewel-wave.mp4'), 'waving Jewel bubble video present');
assert(home.includes('project.name || project.overlay?.title'), 'card title still leads with project.name (PR #127)');
assert(home.includes('Shared reference project'), 'reference project section kept');
assert(home.includes('/terms'), 'footer keeps the /terms link');
console.log('PASS: landing rebuilt without the chat block, footer and references kept.');

const flow = fs.readFileSync(path.join(root, 'app/project/new/flow.tsx'), 'utf8');
const newPage = fs.readFileSync(path.join(root, 'app/project/new/page.tsx'), 'utf8');
assert(newPage.includes('canUseCityCrimeScene'), 'CCS option decided by the server-side entitlement check');
assert(/ccssEntitled && \([\s\S]{0,400}City Crime Scene/.test(flow), 'CCS popup option renders only when entitled');
assert(flow.includes('!template.restricted'), 'template gallery still excludes restricted templates (CCS stays out)');
assert(flow.includes('applySetupPieces'), 'scratch creation adds pieces through the shared factory');
assert(flow.includes('project.kind = "gameshow"'), 'template starts are stamped gameshow');
console.log('PASS: new-project flow gates City Crime Scene and reuses existing creation paths.');

// 8. Coming Soon kinds (Jessica, 2026-11-04): radio and multiplayer are
// shown in the picker under a "Coming Soon!" band and cannot be chosen;
// gameshow and talk stay open. The gate is on STARTING only.
eq(PROJECT_KINDS.filter(k => k.comingSoon).map(k => k.id), ['radio', 'multiplayer']);
assert(kinds.isKindComingSoon('radio') && kinds.isKindComingSoon('multiplayer'), 'radio and multiplayer are coming-soon');
assert(!kinds.isKindComingSoon('gameshow') && !kinds.isKindComingSoon('talk'), 'gameshow and talk are not gated');
assert(!kinds.isKindComingSoon(undefined), 'unset kind is not gated');
assert(flow.includes('np-soonband') && flow.includes('Coming Soon!'), 'picker pastes a Coming Soon! band across gated cards');
assert(flow.includes('np-kind soon') && flow.includes('disabled aria-disabled="true"'), 'gated cards render disabled, not clickable');
assert(flow.includes('onClick={() => chooseKind(info.id)}'), 'open kinds keep their click-to-choose card');
assert(flow.includes('if (isKindComingSoon(next)) return;'), 'chooseKind refuses gated kinds');
assert(flow.includes('if (!kind || isKindComingSoon(kind)) return;'), 'startScratch refuses to create a gated kind');
const projectPage = fs.readFileSync(path.join(root, 'app/project/[id]/page.tsx'), 'utf8');
assert(projectPage.includes('isKindComingSoon(info.id) && project.kind !== info.id'), 'kind dropdown blocks converting a project INTO a gated kind, current kind exempt');
const newCss = fs.readFileSync(path.join(root, 'app/project/new/new-project.css'), 'utf8');
assert(newCss.includes('.np-soonband'), 'band styling ships with the picker stylesheet');
console.log('PASS: radio and multiplayer carry the Coming Soon! band and cannot be started; gameshow and talk unchanged.');
