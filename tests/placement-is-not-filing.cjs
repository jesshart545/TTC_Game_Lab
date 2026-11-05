const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

const { assetPlaced, fileEditedCopy, fileGeneratedAsset, placedBackground } = load('lib/asset-filing.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');
const { addCreationControl } = load('lib/build-controls.ts');
const { evaluateWorkflow } = load('lib/workflow-progress.ts');
const { deckMomentStaged } = load('lib/stage-review.ts');

// Placement is not filing (Jessica, 2026-11-05). One flag, inProject,
// used to mean both "filed in this project" and "placed on the
// overlay", and the conflation corrupted work in both directions:
// generating a backdrop during Imagine and Create staged it on the
// overlay uninvited (filing placed it), and Jewel taking a backdrop
// off the stage the way her doctrine taught — inProject false —
// un-filed it from every project shelf. Now inProject is filing only
// (sticky against every placement operation) and inOverlayBuild is
// placement only. Assets saved before the split carry no
// inOverlayBuild; assetPlaced reads those by the inProject value they
// were written with, so nothing already built changes meaning.

const BG = 'projects/p1/backdrop.png';
const STAR = 'projects/p1/star.png';

function project(overrides = {}) {
  return {
    id: 'p1', slug: 'p1', name: 'Test Show', kind: 'talk',
    status: 'Draft', theme: 'cyan', prompt: '', description: '',
    overlay: { title: 'Test Show', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    gamePlan: { theme: 'small habits', loop: '', rules: '', rewards: '', extras: '', winning: 'most points' },
    assets: [], compositions: [], controls: [], gameTools: [], assetPools: [], messages: [],
    wheel: { enabled: false, title: '', segments: [], spinning: false, visible: false },
    ...overrides,
  };
}
const backdrop = (overrides = {}) => ({ name: 'Backdrop', type: 'image/png', storageKey: BG, url: 'https://x/bg.png', role: 'background', ...overrides });
const step = (evaluation, stageId, stepId) => evaluation.stages.find(s => s.id === stageId).steps.find(s => s.id === stepId);

// --- Legacy read: no placement field, placement follows the old flag --------
test('assetPlaced reads legacy assets by the flag they were written with', () => {
  assert.equal(assetPlaced({ name: 'a', type: 'image/png', inProject: true }), true, 'legacy on-overlay asset stays placed');
  assert.equal(assetPlaced({ name: 'a', type: 'image/png', inProject: false }), false, 'legacy library asset stays unplaced');
  assert.equal(assetPlaced({ name: 'a', type: 'image/png', inProject: true, inOverlayBuild: false }), false, 'an explicit placement field wins over filing');
  assert.equal(assetPlaced({ name: 'a', type: 'image/png', inProject: false, inOverlayBuild: true }), true);
});

// --- (c) Generation files, never places -------------------------------------
test('a generated backdrop is filed (inProject, role background) and NOT placed', () => {
  const filed = fileGeneratedAsset(project(), { name: 'Neon set', type: 'image/png', url: 'https://x/n.png' });
  assert.equal(filed.inProject, true);
  assert.equal(filed.role, 'background');
  assert.equal(filed.inOverlayBuild, false, 'generation stamps placement off — Imagine and Create never stages');
  assert.equal(assetPlaced(filed), false);
  const filedStored = { ...filed, storageKey: 'projects/p1/n.png' };
  const withFiled = project({ assets: [filedStored] });
  assert.equal(placedBackground(withFiled), undefined, 'no background stands on the overlay yet');

  // Placing is a separate, explicit action — through Jewel's changes here.
  const placed = applyDraftChanges(withFiled, { assets: [{ storageKey: 'projects/p1/n.png', inOverlayBuild: true }] }).project;
  assert.equal(assetPlaced(placed.assets[0]), true, 'an explicit placement change is what puts it on the overlay');
  assert.equal(placed.assets[0].inProject, true, 'placing keeps the filing it already had');
});

// --- (a) A changes patch can never un-file; off-overlay still works ---------
test('a changes.assets patch with inProject:false does not un-file, and still clears placement', () => {
  const before = project({ assets: [backdrop({ inProject: true, inOverlayBuild: true })] });
  const result = applyDraftChanges(before, { assets: [{ storageKey: BG, inProject: false }] });
  const asset = result.project.assets[0];
  assert.equal(asset.inProject, true, 'filing is sticky: the patch cannot remove the backdrop from its project');
  assert.equal(asset.inOverlayBuild, false, 'the legacy off-the-overlay shape is honored as placement only');
  assert.equal(assetPlaced(asset), false);

  const viaField = applyDraftChanges(before, { assets: [{ storageKey: BG, inOverlayBuild: false }] });
  assert.equal(viaField.project.assets[0].inProject, true, 'the placement field never touches filing either');
  assert.equal(viaField.project.assets[0].inOverlayBuild, false);
});

test('Jewel can file through changes (inProject:true) but has no un-file', () => {
  const before = project({ assets: [backdrop({ inProject: false })] });
  const filed = applyDraftChanges(before, { assets: [{ storageKey: BG, inProject: true }] });
  assert.equal(filed.project.assets[0].inProject, true);
});

// --- Wiring a control is a placement operation, never a filing one ----------
test('wiring an asset to its button leaves filing untouched and clears standing placement', () => {
  const before = project({ assets: [{ name: 'Star', type: 'image/png', storageKey: STAR, url: 'https://x/s.png', inProject: true, inOverlayBuild: true }] });
  const result = addCreationControl(before, 'asset', STAR);
  const asset = result.project.assets[0];
  assert.equal(asset.inProject, true, 'the asset stays filed in its project');
  assert.equal(asset.inOverlayBuild, false, 'it leaves the standing overlay — its button shows it now');
  assert.ok(result.project.controls.some(c => c.action === `asset.show.${STAR}`), 'the Show button was created');
});

// --- (d) Copies file themselves ----------------------------------------------
test('a save-as-new copy of an un-filed source comes out filed, with the source role, unplaced', () => {
  const source = backdrop({ inProject: false });
  const copy = fileEditedCopy({ name: 'Backdrop (edit 1)', type: 'image/png', storageKey: 'projects/p1/copy.png', url: 'https://x/c.png' }, source);
  assert.equal(copy.inProject, true, 'a copy made inside a project belongs to the project');
  assert.equal(copy.role, 'background', 'the copy keeps its source\'s role — same shelf');
  assert.equal(copy.inOverlayBuild, false, 'placement is not inherited: the copy is not on the overlay');
  const placedSource = backdrop({ inProject: true, inOverlayBuild: true });
  const copy2 = fileEditedCopy({ name: 'Backdrop (edit 1)', type: 'image/png', storageKey: 'projects/p1/copy2.png' }, placedSource);
  assert.equal(copy2.inOverlayBuild, false, 'even a placed source\'s copy starts unplaced');
});

// --- (e) Evaluator honesty: create reads filing, stage reads placement -------
test('talk create:background completes on a FILED backdrop; stage:background requires a PLACED one', () => {
  const filedOnly = project({ assets: [backdrop({ inProject: true, inOverlayBuild: false })] });
  const evalFiled = evaluateWorkflow(filedOnly);
  assert.equal(step(evalFiled, 'create', 'background').complete, true, 'filed on the shelf completes the create step');
  assert.equal(step(evalFiled, 'stage', 'background').complete, false, 'but nothing stands on the overlay yet');

  const placed = project({ assets: [backdrop({ inProject: true, inOverlayBuild: true })] });
  const evalPlaced = evaluateWorkflow(placed);
  assert.equal(step(evalPlaced, 'create', 'background').complete, true);
  assert.equal(step(evalPlaced, 'stage', 'background').complete, true, 'placed on the overlay completes the stage step');

  const unfiled = project({ assets: [backdrop({ inProject: false, inOverlayBuild: false })] });
  assert.equal(step(evaluateWorkflow(unfiled), 'create', 'background').complete, false, 'a backdrop that is not filed in the project completes nothing');
});

test('gameshow stage:background also requires placement, not mere filing', () => {
  const filedOnly = project({ kind: 'gameshow', assets: [backdrop({ inProject: true, inOverlayBuild: false })] });
  assert.equal(step(evaluateWorkflow(filedOnly), 'stage', 'background').complete, false);
  const placed = project({ kind: 'gameshow', assets: [backdrop({ inProject: true, inOverlayBuild: true })] });
  assert.equal(step(evaluateWorkflow(placed), 'stage', 'background').complete, true);
});

test('a deck sign/backdrop moment is staged only when its backdrop is placed', () => {
  const slide = { kind: 'sign', label: 'Your sign', refKey: BG };
  const filedOnly = project({ assets: [backdrop({ inProject: true, inOverlayBuild: false })], talkDeck: [slide] });
  assert.equal(deckMomentStaged(filedOnly, slide), false, 'filed on the shelf is not the opening scene');
  const placed = project({ assets: [backdrop({ inProject: true, inOverlayBuild: true })], talkDeck: [slide] });
  assert.equal(deckMomentStaged(placed, slide), true, 'the placed backdrop IS the opening scene');
});

// --- Source contracts: writers and renderers honor the split ------------------
test('source contracts: overlay renderers read placement; placement writers never un-file', () => {
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert.equal(page.split('project.assets.filter(a => assetPlaced(a) && a.url)').length - 1, 2, 'both draft-overlay copies render placed assets only');
  assert(!/inProject:\s*false/.test(page), 'the project page contains no inProject:false write anymore');
  assert(page.includes('inOverlayBuild: true, role: "background" as const'), 'the Talk backdrop door places through the placement field');
  const published = fs.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
  assert(published.includes('assetPlaced(asset) && asset.url'), 'the published overlay renders placed assets only');
  const stageReview = fs.readFileSync('components/StageReview.tsx', 'utf8');
  assert(stageReview.includes('assetPlaced(a) && a.url'), 'the stage review renders placed assets only');
  const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
  assert(!/inProject:\s*false/.test(buildSpace), 'Build Space contains no inProject:false write anymore');
  assert(buildSpace.includes('updateAsset(key(asset),{inOverlayBuild:false})'), 'Build Space takes an item off the overlay through the placement field');
});

test('source contracts: Jewel\'s doctrine teaches placement, never un-filing', () => {
  const jewel = fs.readFileSync('app/api/jewel/route.ts', 'utf8');
  assert(!jewel.includes('previous background inProject false'), 'the old background doctrine is gone');
  assert(jewel.includes('inOverlayBuild true through changes.assets'), 'placing a backdrop is taught as a placement change');
  assert(jewel.includes('never set inProject false'), 'the off-the-overlay doctrine forbids un-filing');
  assert(jewel.includes('the item itself stays saved in their project'), 'and promises the item stays saved — now literally true');
  const ai = fs.readFileSync('app/api/ai/route.ts', 'utf8');
  assert(!ai.includes('previous background inProject false'), 'the sibling route carries the same correction');
});

console.log('PASS: placement is not filing — generation files without placing, changes can never un-file, wiring and backdrop switches move placement only, copies file themselves, and the evaluators read create from filing and stage from placement.');
