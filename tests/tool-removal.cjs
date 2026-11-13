const assert = require('node:assert/strict');
const load = require('./load.cjs');
const { removeGameTool } = load('lib/tool-removal.ts');

// A project shaped like the real duplicate pile-up: a question-card tool
// drawing from a separate card-list tool, a wheel, and the dashboard
// buttons each one grew.
function fixture() {
  return {
    id: 'p1', name: 'Show', slug: 'show', description: '', status: 'Draft', theme: 'cyan',
    updatedAt: 'now', prompt: '', messages: [],
    assets: [{ name: 'Theme.mp3', type: 'Audio' }],
    assetPools: [{ id: 'pool1', name: 'Songs', assetKeys: ['Theme.mp3'] }],
    compositions: [{ id: 'comp1', name: 'Intro', duration: 3, clips: [], createdAt: 'now' }],
    overlay: { title: 'SHOW', subtitle: '', showChat: true, showAlerts: true, showCharacter: true },
    wheel: { enabled: false, title: 'Game Wheel', segments: [], spinning: false, visible: false },
    gameTools: [
      { id: 'list1', type: 'card-list', name: 'Trivia Question List (150)', enabled: true, config: { cards: [] } },
      { id: 'qc1', type: 'question-card', name: 'Question Cards', enabled: true, inToolbox: true, inOverlayBuild: true, config: { listId: 'list1', placement: { x: 15, y: 20, width: 70, height: 60 } } },
      { id: 'wheel1', type: 'wheel', name: 'Game Wheel', enabled: true, inToolbox: true, inOverlayBuild: true, config: { segments: ['A', 'B'] } },
    ],
    controls: [
      { id: 'c-show', label: 'Show Question', action: 'cards.show.qc1', detail: '', toolIds: ['qc1'] },
      { id: 'c-reveal', label: 'Reveal Answer', action: 'cards.reveal.qc1', detail: '', toolIds: ['qc1'] },
      { id: 'c-clear', label: 'Clear Question Cards', action: 'cards.clear.qc1', detail: '', toolIds: ['qc1'] },
      { id: 'c-toggle', label: 'Question Cards', action: 'cards.toggle.qc1', detail: '', toolIds: ['qc1'] },
      { id: 'c-wheel', label: 'Show Game Wheel', action: 'tool.wheel1', detail: '', toolIds: ['wheel1'], overlayResult: { x: 15, y: 20, width: 70, height: 60, entrance: 'none', exit: 'none', entranceSeconds: 0, exitSeconds: 0, layer: 20 } },
      { id: 'c-wheel-hide', label: 'Hide Game Wheel', action: 'result.hide.c-wheel', detail: '' },
      // A control shared by the question cards and the wheel: kept, with
      // the deleted tool's id dropped from its toolIds.
      { id: 'c-shared', label: 'Shared', action: 'custom.shared', detail: '', toolIds: ['qc1', 'wheel1'] },
      // A sequence that presses the question card, then a removed
      // control, then the wheel: only the wheel step survives.
      { id: 'c-seq', label: 'Sequence', action: 'sequence', detail: '', buttonMode: 'chain', toolIds: ['wheel1'], chain: [
        { id: 's1', kind: 'tool', refId: 'qc1', label: 'Cards', timing: { mode: 'immediate' } },
        { id: 's2', kind: 'control', refId: 'c-show', label: 'Show', timing: { mode: 'immediate' } },
        { id: 's3', kind: 'tool', refId: 'wheel1', label: 'Wheel', timing: { mode: 'immediate' } },
      ] },
      { id: 'c-alert', label: 'TEST ALERT', action: 'alert.test', detail: '' },
    ],
    cardPreviewStates: {
      qc1: { phase: 'question', used: ['q1'] },
      wheel1: { phase: 'cleared', used: [] },
    },
  };
}

// --- Deleting the question-card tool ---
{
  const project = fixture();
  const next = removeGameTool(project, 'qc1');

  // The tool itself is gone; every other tool is untouched.
  assert.deepEqual(next.gameTools.map(t => t.id), ['list1', 'wheel1']);
  // The linked question list is a separate tool and is NOT deleted.
  assert.equal(next.gameTools[0].type, 'card-list');
  assert.equal(next.gameTools[0].name, 'Trivia Question List (150)');

  // Its own dashboard buttons are gone (show / reveal / clear / toggle).
  const actions = next.controls.map(c => c.action);
  assert.ok(!actions.some(a => a.endsWith('.qc1')), 'no per-tool card actions remain');
  assert.ok(!next.controls.some(c => c.id === 'c-show' || c.id === 'c-reveal' || c.id === 'c-clear' || c.id === 'c-toggle'));

  // The shared control survives with only the wheel's id left.
  const shared = next.controls.find(c => c.id === 'c-shared');
  assert.deepEqual(shared.toolIds, ['wheel1']);

  // The sequence keeps its wheel step; the tool step and the step that
  // pressed a removed control are dropped.
  const seq = next.controls.find(c => c.id === 'c-seq');
  assert.deepEqual(seq.chain.map(s => s.id), ['s3']);

  // The wheel's own buttons and unrelated controls are untouched.
  assert.ok(next.controls.some(c => c.id === 'c-wheel'));
  assert.ok(next.controls.some(c => c.id === 'c-wheel-hide'));
  assert.ok(next.controls.some(c => c.id === 'c-alert'));

  // The tool's preview card state is cleared; the wheel's stays.
  assert.deepEqual(Object.keys(next.cardPreviewStates), ['wheel1']);

  // Assets, pools and compositions are never touched.
  assert.equal(next.assets.length, 1);
  assert.equal(next.assetPools.length, 1);
  assert.equal(next.compositions.length, 1);

  // The input project is not mutated.
  assert.equal(project.gameTools.length, 3);
  assert.equal(project.controls.length, 9);
  assert.deepEqual(project.controls.find(c => c.id === 'c-shared').toolIds, ['qc1', 'wheel1']);
  console.log('PASS: deleting a question-card tool removes the tool, its buttons and its card state; its question list, shared controls, sequences, assets and other tools survive.');
}

// --- Deleting the wheel removes its Hide button too ---
{
  const next = removeGameTool(fixture(), 'wheel1');
  assert.deepEqual(next.gameTools.map(t => t.id), ['list1', 'qc1']);
  assert.ok(!next.controls.some(c => c.id === 'c-wheel'), 'tool control removed');
  assert.ok(!next.controls.some(c => c.id === 'c-wheel-hide'), 'its result.hide control removed with it');
  assert.ok(next.controls.some(c => c.id === 'c-show'), 'question card buttons untouched');
  assert.deepEqual(next.controls.find(c => c.id === 'c-shared').toolIds, ['qc1']);
  assert.deepEqual(Object.keys(next.cardPreviewStates), ['qc1']);
  console.log('PASS: deleting a tool also removes the Hide control minted for its button.');
}

// --- Deleting the list tool never cascades into other tools ---
{
  const next = removeGameTool(fixture(), 'list1');
  assert.deepEqual(next.gameTools.map(t => t.id), ['qc1', 'wheel1']);
  assert.equal(next.controls.length, 9, 'no control belonged to the list tool');
  console.log('PASS: deleting a card-list tool removes only that tool; tools that referenced it are left for their owner to repoint.');
}

// --- Unknown tool id is a no-op returning the same project ---
{
  const project = fixture();
  assert.equal(removeGameTool(project, 'nope'), project);
  console.log('PASS: an unknown tool id returns the project unchanged.');
}
