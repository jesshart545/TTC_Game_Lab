const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

// Gameshow "Imagine and Create" demonstrations (components/GameshowWorkshop.tsx,
// GameshowSteps.tsx, GameshowToolDemos.tsx over lib/gameshow-path.ts).
// The guided path is a presentation layer over Piece 1's evaluator: step
// state comes from evaluateWorkflow only, demonstrations run the tools' real
// renderers on real configs/defaults, and every ask routes to Jewel's input.

const { evaluateWorkflow } = load('lib/workflow-progress.ts');
const { toolDefaults } = load('lib/game-tools.ts');
const gameshowPath = load('lib/gameshow-path.ts');
const { GAMESHOW_STEP_META, STEP_ASKS, CREATIVE_LIBERTY_TEXT, JEWEL_ONLY_TILES, demoTool, projectWheelSegmentSets } = gameshowPath;
// Values loaded through the vm test loader live in another realm, so
// structural comparisons go through JSON rather than deepStrictEqual.
const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);

function baseProject(overrides = {}) {
  return {
    id: 'p1', name: 'New Project', slug: 'p1-x', description: '', status: 'Draft', theme: 'cyan',
    updatedAt: 'now', prompt: '', messages: [], controls: [], assets: [], assetPools: [], compositions: [],
    overlay: { title: '', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    wheel: { enabled: false, title: '', segments: [], spinning: false, visible: false },
    gameTools: [], gamePlan: {},
    ...overrides,
  };
}

// --- The path's seven steps are the evaluator's seven steps, in order ------
{
  const evaluation = evaluateWorkflow(baseProject({ kind: 'gameshow' }));
  const evaluatorIds = evaluation.stages[0].steps.map(s => s.id);
  eq(evaluatorIds, ['plan', 'media', 'trivia-cards', 'board', 'tools', 'scenes', 'toolbox']);
  eq(Object.keys(GAMESHOW_STEP_META), evaluatorIds, 'step metadata covers exactly the evaluator steps, in order');
  for (const stepId of evaluatorIds) {
    assert(GAMESHOW_STEP_META[stepId].doneWhen.length > 0, `${stepId} names what Jewel checks`);
    assert(Array.isArray(STEP_ASKS[stepId]) && STEP_ASKS[stepId].length >= 2, `${stepId} offers example asks`);
    for (const ask of STEP_ASKS[stepId]) assert(ask.chip && ask.say, `${stepId} asks carry a chip and a full phrase for Jewel`);
  }
  console.log('PASS: the guided path mirrors evaluateWorkflow stage-0 steps exactly — no parallel step list.');
}

// --- The creative-freedom banner: Jessica's exact wording, stored once -----
{
  assert.equal(CREATIVE_LIBERTY_TEXT, 'These are examples, not limits. If you can describe it, Jewel will try to make it happen — this site exists to accommodate your creativity.');
  const files = ['components/GameshowWorkshop.tsx', 'components/GameshowSteps.tsx', 'components/GameshowToolDemos.tsx', 'lib/gameshow-path.ts'];
  const occurrences = files.reduce((count, file) => count + (fs.readFileSync(file, 'utf8').match(/accommodate your creativity/g) || []).length, 0);
  assert.equal(occurrences, 1, 'the banner wording lives in exactly one place');
  const shell = fs.readFileSync('components/GameshowWorkshop.tsx', 'utf8');
  assert(shell.includes('{CREATIVE_LIBERTY_TEXT}'), 'the shell renders the banner text once, above the step screens');
  console.log('PASS: creative-freedom banner wording is exact and rendered exactly once.');
}

// --- The four Jewel-only tools are tiles, in the demo's order ---------------
{
  eq(JEWEL_ONLY_TILES.map(tile => tile.type), ['plinko', 'prize-wheel', 'higher-lower', 'cliffhanger']);
  assert(JEWEL_ONLY_TILES.every(tile => tile.jewelMade), 'each of the four is badged as made by Jewel');
  console.log('PASS: Plinko, Big Prize Wheel, Higher or Lower and Cliffhanger surface as Jewel-made tiles.');
}

// --- Demonstrations run on real configs or the tools' real defaults --------
{
  const empty = baseProject({ kind: 'gameshow' });
  for (const type of ['plinko', 'prize-wheel', 'higher-lower', 'cliffhanger', 'wheel', 'dice', 'coin-toss', 'countdown', 'poll']) {
    const { tool, fromProject } = demoTool(empty, type);
    assert.equal(fromProject, false, `${type}: an empty project demonstrates the defaults, flagged as such`);
    eq(tool.config, toolDefaults(type), `${type}: demo config is the tool's own built-in defaults, nothing fabricated`);
  }
  const own = baseProject({ kind: 'gameshow', gameTools: [{ id: 'w1', type: 'wheel', name: 'My Wheel', enabled: true, config: { segments: ['A', 'B'] } }] });
  const found = demoTool(own, 'wheel');
  assert.equal(found.fromProject, true);
  eq(found.tool.config.segments, ['A', 'B'], 'a project wheel demonstrates its own real segments');
  const disabled = baseProject({ kind: 'gameshow', gameTools: [{ id: 'w1', type: 'wheel', name: 'Off', enabled: false, config: { segments: ['X'] } }] });
  assert.equal(demoTool(disabled, 'wheel').fromProject, false, 'a switched-off tool does not pose as the project’s live tool');
  console.log('PASS: demoTool prefers the project’s own enabled tool and otherwise falls back to real built-in defaults.');
}

// --- The wheel edit demo only ever cycles the project's own segment sets ---
{
  const two = baseProject({ kind: 'gameshow', gameTools: [
    { id: 'w1', type: 'wheel', name: 'One', enabled: true, config: { segments: ['A', 'B'] } },
    { id: 'w2', type: 'wheel', name: 'Two', enabled: true, config: { segments: ['C', 'D', 'E'] } },
  ] });
  eq(projectWheelSegmentSets(two), [['A', 'B'], ['C', 'D', 'E']]);
  const dupes = baseProject({ kind: 'gameshow', gameTools: [
    { id: 'w1', type: 'wheel', name: 'One', enabled: true, config: { segments: ['A', 'B'] } },
    { id: 'w2', type: 'wheel', name: 'Two', enabled: true, config: { segments: ['A', 'B'] } },
  ] });
  eq(projectWheelSegmentSets(dupes), [['A', 'B']], 'identical sets collapse — the cycle button needs two genuinely different sets');
  eq(projectWheelSegmentSets(baseProject({ kind: 'gameshow' })), []);
  console.log('PASS: projectWheelSegmentSets returns only the project’s own distinct segment sets.');
}

// --- Page wiring: gameshow-only, evaluator-driven, asks fill Jewel's input --
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(/workflowStep === 0 && project\.kind === "gameshow" && \(\s*<GameshowWorkshop/.test(page), 'the guided path renders only for gameshow projects in the Workshop stage');
  assert(page.includes('workflow={evaluateWorkflow(project)}'), 'the path receives the real evaluator output');
  assert(page.includes('activeStep={gameshowStep}'), 'the visible step is page state the evaluator seeds');
  assert(page.includes('const current = evaluateWorkflow(project).current;'), 'the initial step comes from the evaluator’s current step');
  assert(/function askJewel\(text: string\) \{\s*setDraft\(text\);\s*focusJewelPrompt\(\);/.test(page), 'example asks fill Jewel’s real input and focus it — fill only, never auto-send');
  assert(page.includes('openCityCrimeScene: ccssBuilder.openCityCrimeScene'), 'the CCS door is the existing builder opener');
  assert(page.includes('downloadTriviaPdf'), 'the trivia PDF door survives its move onto the saved list');
  console.log('PASS: page wiring gates on kind=gameshow, feeds the evaluator in, and routes asks to Jewel’s input.');
}

// --- New UI: no generation of its own, checks only from the evaluator -------
{
  const files = ['components/GameshowWorkshop.tsx', 'components/GameshowSteps.tsx', 'components/GameshowToolDemos.tsx'];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert(!source.includes('fetch('), `${file} makes no network calls`);
    assert(!source.includes('/api/'), `${file} names no API route`);
    assert(!source.includes('generateAsset'), `${file} never generates directly — Jewel is the only generation door`);
    assert(!source.includes('persist('), `${file} never writes the project — demonstrations are local and free to try`);
  }
  const shell = fs.readFileSync('components/GameshowWorkshop.tsx', 'utf8');
  assert(shell.includes('step.complete'), 'green checks read the evaluator’s step.complete');
  assert(!shell.includes('setGameshowStep') && !/useState\([^)]*complete/i.test(shell), 'the shell keeps no completion state of its own');
  const demos = fs.readFileSync('components/GameshowToolDemos.tsx', 'utf8');
  assert(demos.includes('ccssEntitled'), 'the City Crime Scene tile is gated on entitlement');
  assert(/ccssEntitled \? \[\{ type: "city-crime-scene"/.test(demos) && demos.includes('ccssEntitled && ('), 'no CCS tile exists at all for non-entitled accounts');
  assert(shell.includes('ChanceTools') === false, 'renderers are imported by the demo screens, not re-implemented in the shell');
  console.log('PASS: the new components generate nothing, save nothing, and take every check from the evaluator.');
}

// --- Preservation: every existing Workshop capability is still reachable ----
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  for (const anchor of ['WorkshopAssetsPanel', 'WorkshopAiPanel', 'key="game-plan"', 'Check video result', '<BoardDesigner', 'AssetComposer', 'MediaEditor']) {
    assert(page.includes(anchor), `preserved entry point still in the page: ${anchor}`);
  }
  const assetsPanel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
  assert(assetsPanel.includes('id="workshop-game-templates"'), 'the game-templates shelf the Plan step links to still exists in the assets panel');
  const steps = fs.readFileSync('components/GameshowSteps.tsx', 'utf8');
  for (const door of ['openBoardDesigner', 'openCardEditor', 'openListEditor', 'openMediaEditor', 'openComposer', 'openNewList', 'showSavedWork']) {
    assert(steps.includes(`doors.${door}`), `the toolbox/scenes steps keep the manual-editor door: ${door}`);
  }
  console.log('PASS: existing Workshop entry points remain in the page, and the new path links out to the manual editors.');
}

console.log('gameshow-imagine-create: all assertions passed');
