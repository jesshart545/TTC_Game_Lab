const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// The six-fix batch (2026-11-15), from Jessica's rule-by-rule audit:
// the full tool shelf in Imagine and Create, beginBlank's pre-wired
// controls, the template path's missing two-input start, trivia
// branding on the published overlay, template cards that tell instead
// of show, and Jewel standing below the fold in Gameshow/Talk I&C.

// ---------- Fix 1: the shelf offers EVERY game tool ----------
const { BOARD_LIBRARY, TOOL_LIBRARY, SHELF_LIBRARY, shelfRoute } = load('lib/workshop-libraries.ts');
const projectSrc = read('lib/project.ts');
const typeUnion = projectSrc.match(/export type GameToolType = ([^;]+);/)[1];
const allTypes = [...typeUnion.matchAll(/"([^"]+)"/g)].map(m => m[1]);
assert.equal(allTypes.length, 20, 'the site has 20 game tool types');
const shelfTypes = SHELF_LIBRARY.map(item => item.type);
assert.deepEqual([...shelfTypes].sort(), [...allTypes].sort(), 'the shelf covers every GameToolType exactly once');
assert.equal(new Set(shelfTypes).size, 20, 'no tool appears twice on the shelf');
for (const missing of ['plinko', 'higher-lower', 'cliffhanger', 'youtube', 'question-card', 'blank-card', 'card-list', 'trivia-list']) {
  assert(shelfTypes.includes(missing), `the shelf offers ${missing} (it was missing before this batch)`);
}
const ccs = SHELF_LIBRARY.find(item => item.type === 'city-crime-scene');
assert(ccs && ccs.restricted === true, 'City Crime Scene stays entitled-accounts-only on the shelf');
assert.equal(BOARD_LIBRARY.length + TOOL_LIBRARY.length, 20, 'boards + tools libraries together are the whole shelf');
console.log('PASS: the Imagine and Create shelf offers all 20 game tools, CCS still gated.');

// Routed tiles keep their own creation machinery; the rest are plain adds.
for (const [type, route] of [['question-card', 'question-card'], ['blank-card', 'blank-card'], ['card-list', 'card-list'], ['trivia-list', 'trivia-list']]) {
  assert.equal(shelfRoute(SHELF_LIBRARY.find(item => item.type === type)), route, `${type} routes to its existing creator`);
}
for (const type of ['plinko', 'higher-lower', 'cliffhanger', 'youtube', 'wheel', 'dice']) {
  assert.equal(shelfRoute(SHELF_LIBRARY.find(item => item.type === type)), 'add', `${type} is a plain shelf add`);
}
const panel = read('components/WorkshopAiPanel.tsx');
assert(panel.includes('<ShelfCards items={BOARD_LIBRARY}') && panel.includes('<ShelfCards items={TOOL_LIBRARY}'), 'the panel renders the pictured shelf for both template groups');
assert(panel.includes('onCreateCard') && panel.includes('onNewList') && panel.includes('onGenerateTriviaList'), 'the panel receives the routed-tile creators');
assert((panel.match(/project\.kind!=="talk"/g) || []).length >= 2, 'talk projects keep NO game-tool shelf (both shelf blocks stay kind-gated)');
assert(panel.includes('!stageReview'), 'the shelf stays withheld from the Set the Stage review panel (Game Night keeps its module model)');
const shelf = read('components/ToolShelf.tsx');
assert(shelf.includes('handlers.onCreateCard("question")') && shelf.includes('handlers.onCreateCard("blank")'), 'card tiles route to the card-system creator');
assert(shelf.includes('handlers.onNewList()'), 'the card-list tile routes to the list door');
assert(shelf.includes('handlers.onGenerateTriviaList()'), 'the trivia-list tile routes to the trivia generation entry');
assert(shelf.includes('handlers.addGameTool(item.type)'), 'plain tiles add through addGameTool');
console.log('PASS: routed tiles use the existing creators; plain tiles use addGameTool; talk and review stay shelf-free.');

// Shelf cards are picture + name only, each with its own visual.
assert(shelf.includes('/game-art/plinko-board.webp'), 'the Plinko card carries the shipped board artwork');
assert(!shelf.includes('item.description'), 'no description text is rendered on a shelf card');
assert(shelf.includes('shelf-name') && shelf.includes('{item.name}'), 'the card face is its picture and its name');
for (const face of ['WheelDisplay', 'DiceDisplay', 'CoinDisplay', 'HigherLowerDisplay', 'CliffhangerDisplay', 'StyledTimer', 'GameInfoOverlay', 'StandingToolFace', 'BoardArtwork', 'FittedCard']) {
  assert(shelf.includes(face), `the shelf renders the tool's own face: ${face}`);
}
console.log('PASS: every shelf card is pictured with the tool\u2019s own face; no text-only cards.');

// ---------- Fix 1c: a shelf-made chance game IS a Jewel-made one ----------
// Both creation paths build the tool's config from the one shared
// toolDefaults construction; addGameTool files it in the toolbox,
// unwired, off the overlay.
const { toolDefaults } = load('lib/game-tools.ts');
const page = read('app/project/[id]/page.tsx');
assert(page.includes('const config = {...toolDefaults(type),'), 'addGameTool builds from toolDefaults');
const buildEdits = read('lib/build-edits.ts');
assert(buildEdits.includes('config:{...toolDefaults(item.type)'), 'Jewel\u2019s creation path builds from the same toolDefaults');
for (const type of ['plinko', 'higher-lower', 'cliffhanger']) {
  const info = [...BOARD_LIBRARY, ...TOOL_LIBRARY].find(t => t.type === type);
  assert(info, `addGameTool can find ${type} in the libraries (previously unavailable)`);
  assert(Object.keys(toolDefaults(type)).length > 0, `${type} has starting defaults`);
}
assert.equal(JSON.stringify(toolDefaults('plinko').slots), JSON.stringify(['10', '50', '100', '500', '1000', '500', '100', '50', '10']), 'the shelf-made Plinko starts with the same slots as a Jewel-made one');
assert(page.includes('inToolbox: type !== "trivia-board" && type !== "blank-board"'), 'shelf adds land in the toolbox, not on the overlay');
console.log('PASS: shelf-made chance games share Jewel\u2019s exact construction and land in the toolbox, unwired.');

// ---------- Fix 2: beginBlank starts with zero controls ----------
const beginBlank = page.match(/async function beginBlank\(\) \{[^}]+\}/);
assert(beginBlank, 'beginBlank exists');
assert(beginBlank[0].includes('controls: []'), 'a project created via beginBlank starts with controls = []');
const { createProject } = load('lib/project.ts');
assert(createProject('x').controls.length === 2, 'createProject itself is unchanged for its other callers');
console.log('PASS: beginBlank projects start clean; createProject is untouched.');

// ---------- Fix 3 + 5a: the template path asks the two inputs; cards show, don't tell ----------
const flow = read('app/project/new/flow.tsx');
const gridBlock = flow.slice(flow.indexOf('screen === "templates"'), flow.indexOf('screen === "tpl-detail"'));
assert(gridBlock.includes('setTplDetail(template.id); setScreen("tpl-detail")'), 'clicking a template card opens its detail view');
assert(!gridBlock.includes('chooseTemplate(template.id)'), 'a card click no longer creates the project immediately');
assert(!gridBlock.includes('template.description'), 'the create-flow card carries no description text');
const detailBlock = flow.slice(flow.indexOf('screen === "tpl-detail"'), flow.indexOf('screen === "gn-templates"'));
assert(detailBlock.includes('{template.description}'), 'the description lives in the click-open detail view');
assert(detailBlock.includes('the title of your show') && detailBlock.includes('its theme, vibe, or subject'), 'the detail view asks the two inputs');
assert(detailBlock.includes('aria-label="Show title"') && detailBlock.includes('aria-label="Theme, vibe, or subject"'), 'the detail view carries both input fields');
assert(detailBlock.includes('chooseTemplate(template.id)'), 'Continue creates the project from the detail view');
assert(flow.includes('const creatorTheme = theme.trim();'), 'creation reads the creator\u2019s theme');
assert(flow.includes('project.description = creatorTheme || draft.description;'), 'the theme seeds the project idea');
assert(flow.includes('project.gamePlan = { ...(project.gamePlan || {}), theme: creatorTheme };'), 'the theme seeds gamePlan.theme, as the scratch path does');
console.log('PASS: template cards open a two-input detail view; Continue creates with the creator\u2019s title and theme.');

// ---------- Fix 5b: TemplateBrowser cards carry a picture, no tagline ----------
const browser = read('components/TemplateBrowser.tsx');
assert(browser.includes('<img src="/redesign/kind-gameshow.webp"'), 'TemplateBrowser cards render the template picture (the same picture PlanTemplates uses)');
assert(!browser.includes('<small>{template.tagline}</small>'), 'no tagline text on the TemplateBrowser card face');
assert(browser.includes('<strong>{template.name}</strong>'), 'the card still names the template');
console.log('PASS: TemplateBrowser cards are picture + name.');

// ---------- Fix 4: the published overlay carries no site branding ----------
const overlay = read('app/published/[slug]/overlay/page.tsx');
assert(!overlay.includes('TTCGameLab'), 'the published overlay render contains no TTCGameLab string');
assert(!overlay.includes('Choose a clue'), 'the published overlay carries no host-dashboard instruction');
assert(overlay.includes('runtime-jeopardy-grid') && overlay.includes('cat.name'), 'the board still shows the creator\u2019s own categories and values');
console.log('PASS: the published trivia overlay shows only what the creator put there.');

// ---------- Fix 6: Jewel stands FIRST in Gameshow and Talk I&C ----------
const gameshowStage = read('components/GameshowStage.tsx');
assert.equal((gameshowStage.match(/\{props\.jewelPanel\}/g) || []).length, 1, 'the Gameshow frame renders Jewel\u2019s panel exactly once');
assert(gameshowStage.indexOf('{props.jewelPanel}') < gameshowStage.indexOf('gsw-liberty'), 'in the Gameshow frame Jewel stands before the banner, the door and the show block');
const talkStage = read('components/TalkshowStage.tsx');
assert.equal((talkStage.match(/\{jewelPanel\}/g) || []).length, 1, 'the Talk frame renders Jewel\u2019s panel exactly once');
assert(talkStage.indexOf('{jewelPanel}') < talkStage.indexOf('gsw-liberty'), 'in the Talk frame Jewel stands before the banner and the topics');
assert(gameshowStage.includes('CREATIVE_LIBERTY_TEXT') && talkStage.includes('TALK_CREATIVITY_BANNER'), 'the liberty banner content still renders on both frames (its wording is Jessica\u2019s pending call, untouched)');
console.log('PASS: Jewel\u2019s panel heads both Imagine and Create frames; the banner still renders after her.');

console.log('ALL SIX-FIX GUARDS PASS');
