const assert = require('node:assert/strict'), fs = require('node:fs');
const load = require('./load.cjs');

// The second wheel is gone (Jessica, 2026-11-15: "there is no need for
// a second big wheel"). The site keeps ONE wheel — the selector Game
// Wheel (tool type "wheel"), whose segments are any labels the
// creator decides. The Big Prize Wheel (tool type "prize-wheel", the
// ¢/number closest-to-100 accumulation game) is removed entirely:
// the type, its defaults, its shelf/editor/demo faces, its live
// scoring, its Jewel prompt contract, and its value-reading module.
// A saved prize-wheel tool does not die with it: on load it converts,
// losslessly, into a selector wheel carrying its own labels.

const read = (file) => fs.readFileSync(file, 'utf8');
const val = (x) => JSON.parse(JSON.stringify(x));

const { toolDefaults, convertPrizeWheelTools } = load('lib/game-tools.ts');
const { creatableTools, applyBuildChanges } = load('lib/build-edits.ts');
const { SHELF_LIBRARY, TOOL_LIBRARY } = load('lib/workshop-libraries.ts');
const { dashboardTargets } = load('lib/dashboard-actions.ts');

// ---- The type is gone from every registry -------------------------------
assert(!read('lib/project.ts').includes('"prize-wheel"'), 'the GameToolType union no longer carries prize-wheel');
assert.deepEqual(val(toolDefaults('prize-wheel')), {}, 'no tool defaults remain for prize-wheel');
assert(!creatableTools.includes('prize-wheel'), 'Jewel can no longer create a prize-wheel');
assert.equal(creatableTools.length, 20, 'the creatable list lost exactly the removed type (20 since the radio music tools joined, slice 3)');
assert(!SHELF_LIBRARY.some(entry => entry.type === 'prize-wheel'), 'the Imagine and Create shelf has no prize-wheel card');
assert(!TOOL_LIBRARY.some(entry => entry.type === 'prize-wheel'), 'the workshop library has no prize-wheel entry');
assert(!fs.existsSync('lib/prize-wheel.ts'), 'the prize-wheel value-reading module is deleted');
assert.equal(load('lib/game-tools.ts').cleanPrizeWheelValues, undefined, 'the prize-wheel-only label cleaner is gone');
assert.equal(typeof load('lib/game-tools.ts').cleanWheelSegments, 'function', 'the selector wheel cleaner stays');
console.log('PASS: prize-wheel is absent from the type union, defaults, creatable list, shelf and library.');

// ---- Both Jewel prompt contracts dropped it, and stay in parity ---------
for (const route of ['app/api/jewel/route.ts', 'app/api/ai/route.ts']) {
  const src = read(route);
  assert(!src.includes('prize-wheel'), `${route}: the prompt no longer names the removed tool type`);
  assert(!src.includes('Big Prize Wheel'), `${route}: the prompt no longer describes a second wheel`);
}
console.log('PASS: both prompt routes dropped prize-wheel (DRAFT_SYSTEM parity is pinned by its own guard).');

// ---- The conversion: a saved second wheel becomes the selector wheel ----
const savedWheel = {
  id: 'bw-1', type: 'prize-wheel', name: 'Big Wheel', enabled: true,
  inToolbox: true, inOverlayBuild: true,
  config: {
    title: 'Big Wheel', values: ['$100', '50', 'Bankrupt', '25¢'],
    slotColor: '#b3123f', alternateSlotColor: '#0f6b4f',
    alwaysVisible: true, placement: { x: 5, y: 6, width: 40, height: 50 },
    artStyle: 'neon carnival', artKey: 'asset-bw-art',
    appearance: { textColor: '#ffd700' },
  },
};
const otherTool = { id: 'w-1', type: 'wheel', name: 'Game Wheel', enabled: true, inToolbox: true, inOverlayBuild: false, config: { title: 'Game Wheel', segments: ['A', 'B'] } };
const plinkoTool = { id: 'p-1', type: 'plinko', name: 'Plinko', enabled: true, inToolbox: true, inOverlayBuild: true, config: { title: 'Plinko', slots: ['10', '50'] } };
const project = {
  id: 'proj-1', name: 'Saved Show', kind: 'gameshow', status: 'Draft',
  assets: [], assetPools: [], compositions: [], controls: [],
  gameTools: [savedWheel, otherTool, plinkoTool],
  publishedSnapshot: {
    id: 'proj-1', name: 'Saved Show', kind: 'gameshow', status: 'Published',
    assets: [], assetPools: [], compositions: [], controls: [],
    gameTools: [JSON.parse(JSON.stringify(savedWheel))],
  },
};

const converted = convertPrizeWheelTools(project);
assert.notEqual(converted, project, 'a project holding a prize-wheel converts to a new project object');
const wheel = converted.gameTools[0];
assert.equal(wheel.type, 'wheel', 'the saved prize-wheel becomes the selector wheel');
assert.equal(wheel.id, 'bw-1', 'conversion keeps the tool id');
assert.equal(wheel.name, 'Big Wheel', 'conversion preserves the tool\'s own name as stored');
assert.equal(wheel.enabled, true, 'conversion preserves the enabled state');
assert.equal(wheel.inToolbox, true, 'conversion preserves the toolbox state');
assert.equal(wheel.inOverlayBuild, true, 'conversion preserves the overlay placement state');
assert.deepEqual(val(wheel.config.segments), ['100', '50', 'Bankrupt', '25¢'], 'its values become the wheel\'s segments, cleaned like any Jewel-written labels (dollar signs stripped, order and names preserved)');
assert.equal(wheel.config.values, undefined, 'the consumed values list does not linger on the wheel');
assert.equal(wheel.config.title, 'Big Wheel', 'conversion preserves the tool title');
assert.equal(wheel.config.slotColor, '#b3123f', 'the wheel colors carry over — the selector wheel reads the same slotColor field');
assert.equal(wheel.config.alternateSlotColor, '#0f6b4f', 'the alternate wheel color carries over too');
assert.equal(wheel.config.alwaysVisible, true, 'conversion preserves the standing opt-in');
assert.deepEqual(val(wheel.config.placement), { x: 5, y: 6, width: 40, height: 50 }, 'conversion preserves the overlay placement');
assert.equal(wheel.config.artStyle, 'neon carnival', 'conversion preserves the tool\'s own-art style words');
assert.equal(wheel.config.artKey, 'asset-bw-art', 'conversion preserves the tool\'s own artwork — the wheel is a chance-art tool too');
assert.deepEqual(val(wheel.config.appearance), { textColor: '#ffd700' }, 'conversion preserves the appearance');
// No other tool is touched — same objects, not copies.
assert.equal(converted.gameTools[1], otherTool, 'an existing selector wheel is untouched by the conversion');
assert.equal(converted.gameTools[2], plinkoTool, 'every other tool is untouched by the conversion');
// The published snapshot converts the same way.
assert.equal(converted.publishedSnapshot.gameTools[0].type, 'wheel', 'a prize-wheel inside the published snapshot converts too');
assert.deepEqual(val(converted.publishedSnapshot.gameTools[0].config.segments), ['100', '50', 'Bankrupt', '25¢'], 'the snapshot\'s converted wheel carries the same cleaned segments');
console.log('PASS: a saved prize-wheel converts losslessly — labels cleaned into segments, name, title, colors, artwork, placement and visibility all preserved, other tools untouched.');

// ---- Idempotent, and a no-op (same object) when nothing converts --------
assert.equal(convertPrizeWheelTools(converted), converted, 'converting an already-converted project changes nothing further — the same object comes back');
const clean = { id: 'proj-2', gameTools: [otherTool] };
assert.equal(convertPrizeWheelTools(clean), clean, 'a project with no prize-wheel loads exactly as before (same object — no save-back owed)');
console.log('PASS: the conversion is idempotent and identity-preserving when there is nothing to convert.');

// ---- The converted wheel works as the selector wheel ---------------------
// Jewel build-edits edit it as a wheel (its segments patch in place),
// and the dashboard offers the wheel's own actions for it — spin and
// hide, never a prizewheel action or a running-total game.
{
  const edited = applyBuildChanges(converted, { gameTools: [{ id: 'bw-1', config: { segments: ['Gold', 'Silver'] } }] });
  assert.deepEqual(val(edited.project.gameTools[0].config.segments), ['Gold', 'Silver', 'Bankrupt', '25¢'], 'the converted wheel takes wheel segment edits exactly like a native selector wheel (positional merge: patched positions change, the rest keep the tool\'s own labels)');
  const targets = dashboardTargets(converted, 'control-1');
  const target = targets.find(t => t.id === 'tool:bw-1');
  assert(target, 'the converted wheel is a dashboard target');
  assert(target.actions.some(a => a.label === 'Spin wheel' && a.value === 'tool.bw-1'), 'the converted wheel gets the selector wheel\'s spin action');
  assert(!target.actions.some(a => a.value.startsWith('prizewheel.')), 'no prizewheel action survives for the converted tool');
  assert(!target.actions.some(a => /next player/i.test(a.label)), 'the closest-to-100 next-player action is gone with the tool');
}
console.log('PASS: the converted tool plays as the one selector wheel — no scoring grafted on.');

console.log('PASS: the second wheel is removed everywhere, and saved second wheels live on as selector wheels.');
