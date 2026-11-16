const assert = require('node:assert/strict'), fs = require('node:fs'), load = require('./load.cjs');
const { applyBuildChanges } = load('lib/build-edits.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');
const { cleanWheelSegments, cleanHigherLowerCards, cleanCliffhangerItems, cleanLabelText, toolDefaults } = load('lib/game-tools.ts');

// The Plinko fix, applied to every other chance tool (Jessica,
// 2026-11-15): when Jewel creates a Game Wheel, Higher or Lower, or
// Cliffhanger, the tool carries the creator's OWN labels — dollar
// signs stripped at every Jewel write door (creation through
// changes.newTools, the {type:'tool'} action executor, and
// draft-edit config patches), supplied values preserved in position,
// and the stock defaults never padded into a supplied list. Dice have
// no label list; their title takes the same cleaning.

const baseProject = () => ({ id: 'test', assets: [], controls: [], gameTools: [], overlay: {}, compositions: [] });
// Loaded modules run in the harness's vm realm; compare by value
// through a JSON round-trip (the plinko-creation pattern).
const val = (x) => JSON.parse(JSON.stringify(x));
const created = (type, config) => {
  const result = applyBuildChanges(baseProject(), { newTools: [{ type, name: 'My Tool', config }] });
  const tool = result.project.gameTools.find(t => t.type === type);
  assert.ok(tool, `creation: the ${type} tool is created`);
  assert.ok(!JSON.stringify(tool.config).includes('$'), `creation: no dollar sign anywhere in the ${type} outcome`);
  return tool;
};

// ---- The sanitizers themselves ---------------------------------------------
assert.deepEqual(val(cleanWheelSegments(['$100', ' Gold ', '$5'])), ['100', 'Gold', '5'], 'wheel segments: dollar signs stripped, trimmed, positions preserved');
assert.deepEqual(val(cleanWheelSegments('1,2,3')), [], 'sanitizer: non-array input yields an empty list, never the defaults');
assert.deepEqual(val(cleanHigherLowerCards([{ label: '$K', value: 13 }, { label: '7', value: '7' }])), [{ label: 'K', value: 13 }, { label: '7', value: 7 }], 'HL cards: labels stripped, values coerced, positions preserved');
assert.deepEqual(val(cleanCliffhangerItems([{ label: 'Es$presso maker', price: 49 }])), [{ label: 'Espresso maker', price: 49 }], 'cliffhanger items: dollar sign stripped from inside a label');
assert.equal(cleanLabelText(' $Big Wheel '), 'Big Wheel', 'a title is stripped and trimmed');
assert.equal(cleanLabelText(42), '42', 'a numeric label stringifies');

// ---- Creation: the dirty lists that shipped the defect ----------------------
{
  const tool = created('wheel', { segments: ['$100', 'Gold', '$5'] });
  assert.deepEqual(val(tool.config.segments), ['100', 'Gold', '5'], 'wheel creation: segments cleaned, creator labels preserved in position');
  for (const stock of ['Prize', 'Challenge', 'Bonus', 'Mystery']) assert.ok(!tool.config.segments.includes(stock), `wheel creation: stock default ${stock} is never padded in`);
}
{
  const tool = created('higher-lower', { cards: [{ label: '$K', value: 13 }, { label: '$Q', value: 12 }] });
  assert.deepEqual(val(tool.config.cards), [{ label: 'K', value: 13 }, { label: 'Q', value: 12 }], 'HL creation: card labels cleaned, the creator deck kept');
}
{
  const tool = created('cliffhanger', { items: [{ label: '$100 blender', price: 100 }] });
  assert.deepEqual(val(tool.config.items), [{ label: '100 blender', price: 100 }], 'cliffhanger creation: item labels cleaned, the creator items kept');
}
{
  const tool = created('wheel', { segments: ['A', 'B'], title: '$Million Wheel' });
  assert.equal(tool.config.title, 'Million Wheel', 'creation: a dollar-signed title is cleaned — titles render on the overlay');
  const dice = created('dice', { sides: 6, title: '$Dice' });
  assert.equal(dice.config.title, 'Dice', 'creation: dice titles take the same cleaning');
}

// ---- Creation: absent lists keep the stock defaults --------------------------
{
  const wheel = created('wheel', {});
  assert.deepEqual(val(wheel.config.segments), val(toolDefaults('wheel').segments), 'wheel creation: absent segments fall back to the defaults — nothing of the creator\'s exists to preserve');
}

// ---- Draft edit: positional merge for the string lists -----------------------
{
  const project = { ...baseProject(), gameTools: [{ id: 'w1', type: 'wheel', name: 'Wheel', enabled: true, inToolbox: true, config: { title: 'Game Wheel', segments: ['Gold', 'Silver', 'Bronze'] } }] };
  const result = applyDraftChanges(project, { gameTools: [{ id: 'w1', config: { segments: ['$100', ''] } }] });
  assert.deepEqual(val(result.project.gameTools[0].config.segments), ['100', 'Silver', 'Bronze'], 'wheel draft edit: real values land cleaned; a blank and the unreached tail keep the tool\'s own labels');
}

// ---- Draft edit: card and item labels cleaned entry by entry ------------------
{
  const project = { ...baseProject(), gameTools: [{ id: 'h1', type: 'higher-lower', name: 'HL', enabled: true, inToolbox: true, config: { title: 'Higher or Lower', cards: [{ label: '4', value: 4 }] } }] };
  const result = applyDraftChanges(project, { gameTools: [{ id: 'h1', config: { cards: [{ label: '$A', value: 1 }, { label: 'K', value: 13 }] } }] });
  assert.deepEqual(val(result.project.gameTools[0].config.cards), [{ label: 'A', value: 1 }, { label: 'K', value: 13 }], 'HL draft edit: the patched deck lands with labels cleaned');
  const items = { ...baseProject(), gameTools: [{ id: 'c1', type: 'cliffhanger', name: 'Cliff', enabled: true, inToolbox: true, config: { title: 'Cliffhanger', items: [{ label: 'Mug', price: 12 }] } }] };
  const result2 = applyDraftChanges(items, { gameTools: [{ id: 'c1', config: { items: [{ label: '$5 mug', price: 5 }] } }] });
  assert.deepEqual(val(result2.project.gameTools[0].config.items), [{ label: '5 mug', price: 5 }], 'cliffhanger draft edit: the patched items land with labels cleaned');
}

// ---- The third door: the page's tool-action executor cleans too ---------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  for (const call of ['cleanWheelSegments(action.config.segments)', 'cleanHigherLowerCards(action.config.cards)', 'cleanCliffhangerItems(action.config.items)', 'cleanLabelText(toolConfig.title)']) {
    assert.ok(page.includes(call), `the tool-action executor applies ${call}`);
  }
}

console.log('PASS: every chance tool Jewel creates carries the creator\'s own labels — dollar signs stripped at creation, in the tool-action executor, and on draft patches; supplied lists preserved in position with stock defaults never padded in.');
