const assert = require('node:assert/strict'), load = require('./load.cjs');
const { applyBuildChanges } = load('lib/build-edits.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');
const { cleanPlinkoSlots, toolDefaults } = load('lib/game-tools.ts');

// Jessica's rules for a Plinko board Jewel creates (2026-11-14 +
// 2026-11-15): no dollar signs ever (absolute), and the board carries
// the creator's OWN slot labels — the stock defaults are never padded
// into a creator-supplied list, because boards must not all come out
// the same. The exactly-9-labels instruction lives in the Jewel
// prompt; the code layer deliberately does not reject a partial list,
// because partial boards are legitimate, guarded behavior (the
// standing-tools guard pins a 2-label board stored verbatim, and the
// renderer spreads any list across the painted slots). On an existing
// board, a patch position left blank — or not reached — keeps the
// tool's own value there.

const baseProject = () => ({ id: 'test', assets: [], controls: [], gameTools: [], overlay: {}, compositions: [] });
// Loaded modules run in the harness's vm realm, so arrays they build
// fail strict prototype comparison against literals from this realm;
// compare slot lists by value through a JSON round-trip (the pattern
// tests/ai-combined-controls.cjs uses for the same reason).
const slotsOf = (tool) => JSON.parse(JSON.stringify(tool.config.slots));
const cleanedOf = (input) => JSON.parse(JSON.stringify(cleanPlinkoSlots(input)));
const STOCK = ['10', '50', '100', '500', '1000', '500', '100', '50', '10'];
const DIRTY_SEVEN = ['$0.25', '$1', '', '$5', '', '$10', '$0.25'];

// ---- The sanitizer itself -------------------------------------------------
assert.deepEqual(cleanedOf(DIRTY_SEVEN), ['0.25', '1', '', '5', '', '10', '0.25'],
  'sanitizer strips every dollar sign and trims, preserving positions and blanks');
assert.deepEqual(cleanedOf('10,50,100'), [], 'sanitizer: non-array input yields an empty list, never the defaults');
assert.deepEqual(cleanedOf(undefined), [], 'sanitizer: missing input yields an empty list, never the defaults');

// ---- Creation: the dirty 7-value list that shipped the defect --------------
{
  const result = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'Plinko Board', config: { slots: DIRTY_SEVEN, rows: 9 } }] });
  const tool = result.project.gameTools.find(t => t.type === 'plinko');
  assert.ok(tool, 'creation: the board is created');
  assert.deepEqual(slotsOf(tool), ['0.25', '1', '', '5', '', '10', '0.25'],
    'creation: dollar signs stripped, the creator\'s own real values preserved in position');
  assert.ok(!JSON.stringify(result.project.gameTools).includes('$'), 'creation: no dollar sign anywhere in the outcome');
  for (const stock of ['100', '500', '1000']) assert.ok(!tool.config.slots.includes(stock), `creation: stock default ${stock} is never padded in`);
}

// ---- Creation: a complete list keeps the creator's own values --------------
{
  const result = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'My Board', config: { slots: ['$10', '$20', '30', '$40', '50', '60', '70', '80', '$90'] } }] });
  const tool = result.project.gameTools.find(t => t.type === 'plinko');
  assert.ok(tool, 'creation: a complete 9-label list creates the board');
  assert.deepEqual(slotsOf(tool), ['10', '20', '30', '40', '50', '60', '70', '80', '90'],
    'creation: dollar signs stripped, creator values preserved in position, no stock defaults substituted');
}

// ---- Creation: a clean creator list passes through byte-identical ----------
{
  const mine = ['Gold', 'Silver', 'Bronze', 'Star', 'Moon', 'Sun', 'Gem', 'Pearl', 'Ruby'];
  const result = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'Words Board', config: { slots: mine } }] });
  const tool = result.project.gameTools.find(t => t.type === 'plinko');
  assert.deepEqual(slotsOf(tool), mine, 'creation: a clean creator 9-list is untouched');
}

// ---- Creation: slots absent entirely keep the stock defaults ---------------
{
  const result = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'Plain Board', config: { rows: 9 } }] });
  const tool = result.project.gameTools.find(t => t.type === 'plinko');
  assert.ok(tool, 'creation: no slots supplied still creates the board');
  assert.deepEqual(slotsOf(tool), STOCK, 'creation: absent slots fall back to the defaults — nothing of the creator\'s exists to preserve');
  assert.deepEqual(JSON.parse(JSON.stringify(toolDefaults('plinko').slots)), STOCK, 'toolDefaults plinko slots are unchanged');
}

// ---- Creation: non-array slots supplied clean to an empty list --------------
{
  const result = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'Bad Board', config: { slots: '10,50,100' } }] });
  const tool = result.project.gameTools.find(t => t.type === 'plinko');
  assert.ok(tool, 'creation: the board is still created');
  assert.deepEqual(slotsOf(tool), [], 'creation: a non-array slots value yields no labels — never the stock defaults in their place');
}

// ---- Draft edit: the dirty 7-value patch on an existing board ---------------
{
  const mine = ['Gold', 'Silver', 'Bronze', 'Star', 'Moon', 'Sun', 'Gem', 'Pearl', 'Ruby'];
  const project = { ...baseProject(), gameTools: [{ id: 'plinko-1', type: 'plinko', name: 'My Board', enabled: true, inToolbox: true, config: { title: 'Plinko', slots: [...mine], rows: 9 } }] };
  const result = applyDraftChanges(project, { gameTools: [{ id: 'plinko-1', config: { slots: DIRTY_SEVEN } }] });
  const tool = result.project.gameTools.find(t => t.id === 'plinko-1');
  assert.deepEqual(slotsOf(tool), ['0.25', '1', 'Bronze', '5', 'Moon', '10', '0.25', 'Pearl', 'Ruby'],
    'draft edit: real values land in position with dollar signs stripped; blanks and the unreached tail keep the tool\'s own values');
  assert.ok(!tool.config.slots.some(s => s.includes('$')), 'draft edit: no dollar sign survives the patch');
  for (const stock of ['100', '500', '1000']) assert.ok(!tool.config.slots.includes(stock), `draft edit: stock default ${stock} is never injected`);
}

// ---- Draft edit: a complete dollar list is stripped in place ----------------
{
  const project = { ...baseProject(), gameTools: [{ id: 'plinko-1', type: 'plinko', name: 'My Board', enabled: true, inToolbox: true, config: { slots: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] } }] };
  const result = applyDraftChanges(project, { gameTools: [{ id: 'plinko-1', config: { slots: ['$5', '$10', '$15', '$20', '$25', '$30', '$35', '$40', '$45'] } }] });
  assert.deepEqual(slotsOf(result.project.gameTools[0]), ['5', '10', '15', '20', '25', '30', '35', '40', '45'],
    'draft edit: a complete supplied list replaces the board, dollar signs stripped');
}

// ---- Draft edit: a patch that never mentions slots leaves the board alone ---
{
  const mine = ['Gold', 'Silver', 'Bronze', 'Star', 'Moon', 'Sun', 'Gem', 'Pearl', 'Ruby'];
  const project = { ...baseProject(), gameTools: [{ id: 'plinko-1', type: 'plinko', name: 'My Board', enabled: true, inToolbox: true, config: { slots: [...mine], rows: 9 } }] };
  const result = applyDraftChanges(project, { gameTools: [{ id: 'plinko-1', config: { rows: 11 } }] });
  assert.deepEqual(slotsOf(result.project.gameTools[0]), mine, 'draft edit: slots untouched when the patch does not set them');
  assert.equal(result.project.gameTools[0].config.rows, 11, 'draft edit: the rest of the patch still applies');
}

console.log('PASS: Plinko boards Jewel creates carry the creator\'s own labels — dollar signs stripped at creation and on draft edits, supplied values preserved in position, blanks on an existing board keep that board\'s own values, and the stock defaults are never padded into a supplied list.');
