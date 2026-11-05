const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

const { applyBuildChanges } = load('lib/build-edits.ts');
const { detailedChangeLines } = load('lib/jewel-change-summary.ts');

// Set the Stage placement persistence (2026-11-04). Live evidence on the
// "Jewel Test Talk Show" project: Jewel generated a gold star, then placed
// it "as its own draggable overlay item" — her change report stated size
// 269x151 at position 38,22 and the dashboard buttons were created — but
// the item rendered LARGE and CENTERED over the title, and after the
// page's Save + a reload it was gone from the overlay entirely.
//
// Root cause, in applyBuildChanges: draft changes run first and the
// connections run after. The asset's edits.placement — the only field
// that can carry a placement for an item whose button does not exist
// yet — was applied to the asset, and then addCreationControl created
// the button with the generic default frame (70% x 60% at 15,20) as its
// overlayResult and flipped the asset to inProject:false. The overlay
// and the review render a connected item ONLY at its control's
// overlayResult, and with inProject false no render path read the
// asset's placement either — so the stated placement existed in the
// saved bytes but was honored nowhere, before or after a reload.
//
// The fix: a placement stated in the same edit — on the connection
// itself (overlayResult / placement) or as the asset's placement —
// becomes the connected button's shown-result placement. These tests
// pin that round trip: Jewel change -> page save (the wire JSON) ->
// reload -> the placement the review and the overlay resolve.

const STAR = 'projects/test/gold-star.png';
// Jewel's stated placement, converted from her report (size 269x151 px,
// at 38,22 px on the 1920x1080 canvas) to percentages.
const STATED = { x: 1.98, y: 2.04, width: 14.01, height: 13.98 };
const DEFAULT_FRAME = { x: 15, y: 20, width: 70, height: 60 };

function fixture(kind) {
  return {
    id: 'test-' + kind, slug: 'test-' + kind, name: 'Placement Test', kind,
    status: 'Draft', theme: 'cyan', prompt: '', description: '',
    overlay: { title: 'Placement Test', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    gamePlan: { theme: 'small habits', loop: '', rules: '', rewards: '', extras: '' },
    assets: [
      { name: 'Studio backdrop', type: 'image/png', storageKey: 'projects/test/backdrop.png', url: 'https://example.test/backdrop.png', role: 'background', inProject: true, edits: { fit: 'cover' } },
      { name: 'Gold star', type: 'image/png', storageKey: STAR, url: 'https://example.test/star.png', inProject: false, edits: { fit: 'contain' } },
    ],
    compositions: [], controls: [], gameTools: [], assetPools: [], messages: [],
    wheel: { enabled: false, title: '', segments: [], spinning: false, visible: false },
  };
}
const plain = value => JSON.parse(JSON.stringify(value));
const showControl = project => project.controls.find(c => c.action === `asset.show.${STAR}`);
const frameOf = control => ({ x: control.overlayResult.x, y: control.overlayResult.y, width: control.overlayResult.width, height: control.overlayResult.height });
// The save/reload wire: the page POSTs the project JSON and the loader
// GETs it back verbatim; nothing else transforms it in between.
const roundTrip = project => JSON.parse(JSON.stringify(project));

for (const kind of ['talk', 'gameshow']) {
  test(`Jewel's stated placement (${kind}) lands on the button's shown result and survives save + reload`, () => {
    const before = fixture(kind);
    // The evidence-shaped edit: the placement rides on the asset (the
    // only field available before the button exists), plus the connection.
    const result = applyBuildChanges(before, {
      assets: [{ storageKey: STAR, edits: { placement: { ...STATED } } }],
      connections: [{ kind: 'asset', id: STAR, label: 'Show Gold Star' }],
    });
    assert.equal(result.warnings.length, 0, 'no warnings: ' + result.warnings.join(' '));
    assert.ok(result.applied > 0);
    const control = showControl(result.project);
    assert.ok(control, 'the connection created the Show button');
    assert.deepEqual(frameOf(control), STATED, 'the shown result carries the stated placement, not the default frame');

    // The receipt Jewel's creator sees must state the same numbers that render.
    const lines = detailedChangeLines(before, result.project);
    assert.ok(lines.some(line => line.includes('"Gold star": size 269 × 151, placed at 38, 22')), 'receipt states the asset placement: ' + lines.join(' | '));
    assert.ok(lines.some(line => line.includes('Added button "Show Gold Star"') && line.includes('269 × 151') && line.includes('38, 22')), 'receipt states the button result placement: ' + lines.join(' | '));

    const reloaded = roundTrip(result.project);
    const reloadedControl = showControl(reloaded);
    assert.ok(reloadedControl, 'the button survives the save + reload round trip');
    assert.deepEqual(frameOf(reloadedControl), STATED, 'the placement survives the save + reload round trip');
    // What the review resolves for this item after reload: the button's
    // shown result at the stated placement.
    const star = reloaded.assets.find(a => a.storageKey === STAR);
    assert.ok(star, 'the asset itself survives');
    assert.deepEqual(plain(star.edits.placement), STATED, 'the asset keeps the same placement record');
  });
}

test('a placement stated on the connection itself is honored', () => {
  const result = applyBuildChanges(fixture('talk'), {
    connections: [{ kind: 'asset', id: STAR, label: 'Show Gold Star', overlayResult: { ...STATED } }],
  });
  assert.equal(result.warnings.length, 0, 'no warnings: ' + result.warnings.join(' '));
  assert.deepEqual(frameOf(showControl(result.project)), STATED);
  const reloaded = roundTrip(result.project);
  assert.deepEqual(frameOf(showControl(reloaded)), STATED);
});

test('a placement stated as the connection\'s placement field is honored', () => {
  const result = applyBuildChanges(fixture('gameshow'), {
    connections: [{ kind: 'asset', id: STAR, placement: { ...STATED } }],
  });
  assert.equal(result.warnings.length, 0, 'no warnings: ' + result.warnings.join(' '));
  assert.deepEqual(frameOf(showControl(result.project)), STATED);
});

test('a connection with no stated placement keeps the established default frame', () => {
  const result = applyBuildChanges(fixture('talk'), {
    connections: [{ kind: 'asset', id: STAR, label: 'Show Gold Star' }],
  });
  assert.equal(result.warnings.length, 0, 'no warnings: ' + result.warnings.join(' '));
  const control = showControl(result.project);
  assert.deepEqual(frameOf(control), DEFAULT_FRAME, 'unstated placements behave exactly as before');
  assert.equal(result.project.assets.find(a => a.storageKey === STAR).inProject, false, 'wiring leaves the asset\'s filing exactly as it was');
  assert.equal(result.project.assets.find(a => a.storageKey === STAR).inOverlayBuild, false, 'a connected asset still waits for its button — off the standing overlay');
});

test('an unrelated later edit never stomps a placement the creator dragged', () => {
  const placed = applyBuildChanges(fixture('talk'), {
    assets: [{ storageKey: STAR, edits: { placement: { ...STATED } } }],
    connections: [{ kind: 'asset', id: STAR, label: 'Show Gold Star' }],
  }).project;
  // The creator drags the item in the review: the drag commits to the
  // control's overlayResult through the page (the StageReview path).
  const draggedFrame = { x: 55, y: 48, width: 20, height: 22 };
  const control = showControl(placed);
  const dragged = {
    ...placed,
    controls: placed.controls.map(c => c.id === control.id ? { ...c, overlayResult: { ...c.overlayResult, ...draggedFrame } } : c),
  };
  // A later Jewel edit connects another item and says nothing about the star.
  const other = { name: 'Moon', type: 'image/png', storageKey: 'projects/test/moon.png', url: 'https://example.test/moon.png', inProject: false, edits: {} };
  const withMoon = { ...dragged, assets: [...dragged.assets, other] };
  const edited = applyBuildChanges(withMoon, { connections: [{ kind: 'asset', id: 'projects/test/moon.png', label: 'Show Moon' }] });
  assert.equal(edited.warnings.length, 0, 'no warnings: ' + edited.warnings.join(' '));
  assert.deepEqual(frameOf(showControl(roundTrip(edited.project))), draggedFrame, 'the dragged placement survives the unrelated edit and a round trip');
});

test('re-placing an already connected item honors the newly stated placement only', () => {
  const placed = applyBuildChanges(fixture('talk'), {
    connections: [{ kind: 'asset', id: STAR, overlayResult: { ...STATED } }],
  }).project;
  const moved = { x: 70, y: 5, width: 25, height: 25 };
  const replaced = applyBuildChanges(placed, {
    assets: [{ storageKey: STAR, edits: { placement: { ...moved } } }],
    connections: [{ kind: 'asset', id: STAR }],
  });
  assert.equal(replaced.warnings.length, 0, 'no warnings: ' + replaced.warnings.join(' '));
  assert.deepEqual(frameOf(showControl(replaced.project)), moved, 'a stated re-placement updates the shown result');
  const untouched = applyBuildChanges(placed, { connections: [{ kind: 'asset', id: STAR }] });
  assert.deepEqual(frameOf(showControl(untouched.project)), STATED, 'a bare re-connection changes nothing');
});

test('the page Save reads the same store Jewel writes (source contract)', () => {
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const start = page.indexOf('async function saveProgress()');
  const end = page.indexOf('\n  }', page.indexOf('setSaveStatus("All changes saved.")', start));
  assert.ok(start >= 0 && end > start, 'saveProgress found');
  const span = page.slice(start, end);
  const drain = span.indexOf('await saveQueue.current;');
  const read = span.indexOf('projectRef.current || project');
  assert.ok(drain >= 0 && read > drain, 'saveProgress drains the queue, then bases the save on projectRef (the copy persist maintains)');
  assert.ok(span.includes('projectRef.current = next;'), 'saveProgress leaves the ref holding exactly what it saved');
});
