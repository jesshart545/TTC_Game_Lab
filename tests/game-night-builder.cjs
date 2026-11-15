const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require(process.env.TTC_DOM_TEST_MODULE || 'jsdom');
const React = require('react');
const load = require('./load.cjs');

// Game Night builder + Set the Stage (Jessica, 2026-11-15): a
// multiplayer project no longer opens the old shared workshop in
// either area. Stage 0 (Imagine & Create) is the light frame — the
// game shown as itself, the gold library door, Jewel as the doorway,
// the library below — with NO game-plan form, NO progress machinery,
// NO Gameshow gallery or Creation Tools, and NO dashboard/overlay
// language. Stage 1 (Set the Stage) is see it, test it, publish it,
// share it — the game first, a real test door, publish + the share
// panel in one place, Jewel below — with NONE of the livestream
// staging. Other kinds keep the old surfaces untouched.

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const { createRoot } = require('react-dom/client');

function component(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: id => {
      if (dependencies[id]) return dependencies[id];
      if (id === 'react' || id === 'react/jsx-runtime') return require(id);
      if (id.endsWith('.css')) return {};
      if (id.includes('/lib/')) return load('lib/' + path.basename(id) + '.ts');
      return { default: () => null };
    },
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    navigator: dom.window.navigator,
    crypto: require('node:crypto').webcrypto,
    requestAnimationFrame: fn => fn(),
    setTimeout,
    clearTimeout,
    console,
    process: { env: {} }
  });
  return exports;
}

// ---------------------------------------------------------------------------
// 1. Page wiring: the two Game Night views exist, the old workshop
//    stands down wholesale inside them, and Jewel's panel there is
//    the strip-free game-night clone. Other kinds' surfaces survive
//    verbatim (their own tests pin them; these pins prove the
//    multiplayer carve-out did not move them).
// ---------------------------------------------------------------------------
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
assert(page.includes('const gameNightCreateView = project.kind === "multiplayer" && workflowStep === 0;'), 'the page computes the Game Night Imagine & Create view');
assert(page.includes('const gameNightSetView = project.kind === "multiplayer" && workflowStep === 1;'), 'the page computes the Game Night Set the Stage view');
assert(page.includes('{!gameNightViews && <>\n      {!lightCreateFrame && !stageReviewView && <div className="workshop-flow-heading">'), 'the old flow content (heading, entry guide nav, game-plan form, publish machinery) stands down in the Game Night views');
assert(page.includes('{!gameNightViews && <div data-workshop-section='), 'the whole workspace grid (livestream preview, Build Space, assets panel) stands down in the Game Night views');
assert(page.includes('{!gameNightViews && workflowStep !== 2 && !stageReviewView && <details className="workshop-help">'), 'the workshop guide stands down in the Game Night views');
assert(page.includes('const gameNightJewelPanel = cloneElement(jewelPanelElement, { stageReview: true, gameNight: true });'), 'Jewel\'s panel in the Game Night views is her shared panel cloned strip-free with game-night words');
assert(page.includes('<GameNightStage') && page.includes('<GameNightSetStage'), 'both Game Night stages render from the page');
assert(page.includes('jewelPanel={gameNightJewelPanel}'), 'the Game Night stages receive the cloned panel');
assert(page.includes('{workflowStep===1 && !stageReviewView && <BuildSpace'), 'Build Space still stands for the kinds that keep it (radio)');
assert(page.includes('{workflowStep === 0 && project.kind !== "talk" && <details key="game-plan"'), 'the game-plan form still stands for the kinds that keep it');
console.log('PASS: page wiring — Game Night views carved out, old workshop stands down inside them only.');

// ---------------------------------------------------------------------------
// 2. The panel's game-night words: stage-1 help/asks/placeholder
//    speak game night only when the flag is set.
// ---------------------------------------------------------------------------
const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
assert(panel.includes('gameNight?: boolean;'), 'the panel accepts the game-night flag');
assert(panel.includes('gameNight?"Describe the change in your own words. I can add questions, cards and words to your game'), 'the stage-1 help line has a game-night wording with no overlay/dashboard language');
assert(panel.includes('["Publish my game","Publish my game and give me its play link and QR code so I can share it with my friends."]'), 'the stage-1 example asks include publishing the game');
console.log('PASS: Jewel\'s panel speaks game night in the Game Night views.');

// ---------------------------------------------------------------------------
// 3. Rendered stage 0 — a template project (Perfect Match, the
//    owner's own walkthrough project shape) shows the game as
//    itself: cards with their text, the library, Jewel's doorway —
//    and none of the old wall.
// ---------------------------------------------------------------------------
const { createProject } = load('lib/project.ts');
const { GAME_NIGHT_TEMPLATES, getGameNightTemplate, applyGameNightTemplate } = load('lib/game-night-templates.ts');
const { pickGame } = load('lib/game-room.ts');

function projectFromTemplate(template) {
  const project = createProject('');
  applyGameNightTemplate(project, template);
  return project;
}

const GameViewModule = component('components/GameNightGameView.tsx');
const GameNightStage = component('components/GameNightStage.tsx', {
  './GameNightGameView': GameViewModule,
  './JewelWandScene': { default: () => React.createElement('div', null, 'WAND-SCENE') },
  './JewelAvatar': { default: () => React.createElement('span', null, 'JEWEL') }
}).default;
const GameNightSetStage = component('components/GameNightSetStage.tsx', {
  './GameNightGameView': GameViewModule,
  './GameNightShare': { default: () => React.createElement('div', null, 'GAME-NIGHT-SHARE') },
  './JewelAvatar': { default: () => React.createElement('span', null, 'JEWEL') }
}).default;

const doors = {
  openListEditor: () => {}, openBoardDesigner: () => {}, openMediaEditor: () => {},
  upload: () => {}, deleteAsset: () => {}
};
const panelStub = React.createElement('div', null, 'JEWEL-PANEL');

async function render(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await React.act(async () => root.render(element));
  return host;
}

(async () => {
  const pmTemplate = getGameNightTemplate('game-night-perfect-match');
  const pm = projectFromTemplate(pmTemplate);
  assert.equal(pickGame(pm).gameType, 'perfect-match', 'the fixture resolves to Perfect Match through the real pickGame');
  const promptTool = pm.gameTools.find(t => t.type === 'card-list' && t.name.toLowerCase().includes('prompt'));
  const firstPrompt = promptTool.config.cards[0].text;
  const answerTool = pm.gameTools.find(t => t.type === 'card-list' && t.name.toLowerCase().includes('answer'));
  const firstAnswer = answerTool.config.cards[0].text;

  const stage0 = await render(React.createElement(GameNightStage, {
    project: pm, jewelPanel: panelStub, onEnterJewel: () => {}, onAskJewel: () => {}, doors
  }));
  const text0 = stage0.textContent;
  assert(text0.includes('Perfect Match'), 'stage 0 names the game it is');
  assert(text0.includes(firstPrompt), 'stage 0 shows a prompt card with its real text on it');
  assert(text0.includes(firstAnswer), 'stage 0 shows an answer card with its real text on it');
  assert(text0.includes(`Open “${promptTool.name}” in the card editor`), 'the prompt pieces open into their own card editor');
  assert(text0.includes('Your library & uploads'), 'stage 0 carries the gold library door');
  assert(text0.includes('Your library — everything in this project'), 'the library stands under its heading');
  assert(text0.includes('this site exists to accommodate your creativity'), 'the creative-liberty statement stands once in the area');
  assert(text0.includes('WAND-SCENE') && text0.includes('JEWEL-PANEL'), 'Jewel is the doorway: wand scene plus her conversation');
  for (const banned of ['Dashboard', 'dashboard', 'overlay', 'Overlay', 'Your progress', 'Go there', 'Your game plan', 'template gallery', 'Creation Tools']) {
    assert(!text0.includes(banned), `stage 0 never says "${banned}"`);
  }
  assert(!stage0.querySelector('form'), 'stage 0 has no form');
  assert(!stage0.querySelector('textarea') && !stage0.querySelector('input'), 'stage 0 has no form fields');
  assert(!stage0.querySelector('.jewel-progress'), 'no progress machinery stands on the page');
  console.log('PASS: stage 0 renders the game as itself — cards with text, library, Jewel — and none of the old wall.');

  // A from-scratch project: the pictured shelf of the seven games.
  const empty = createProject('');
  empty.kind = 'multiplayer';
  const shelf = await render(React.createElement(GameNightStage, {
    project: empty, jewelPanel: panelStub, onEnterJewel: () => {}, onAskJewel: () => {}, doors
  }));
  const shelfText = shelf.textContent;
  assert(shelfText.includes('Games you can build'), 'an empty project shows the pictured game shelf');
  for (const template of GAME_NIGHT_TEMPLATES) assert(shelfText.includes(template.name), `the shelf shows ${template.name}`);
  assert(!shelf.querySelector('form') && !shelf.querySelector('textarea') && !shelf.querySelector('input'), 'the shelf is examples and a direction to Jewel — not a form');
  assert(shelfText.includes('Your library — everything in this project'), 'the library stands even before a game exists');
  console.log('PASS: stage 0 with no game yet shows the seven-game pictured shelf, not a form.');

  // -------------------------------------------------------------------------
  // 4. Rendered Set the Stage — game first, honest test door,
  //    publish + share in one place, no livestream staging.
  // -------------------------------------------------------------------------
  const setUnpublished = await render(React.createElement(GameNightSetStage, {
    project: pm, jewelPanel: panelStub, doors, onPublish: () => {}, publishing: false, publishOutcome: null
  }));
  const setText = setUnpublished.textContent;
  assert(setText.includes('Perfect Match'), 'Set the Stage shows the game itself first');
  assert(setText.includes(firstPrompt), 'Set the Stage shows the game\'s pieces, same presentation as stage 0');
  assert(setText.includes('Test your game'), 'Set the Stage carries the test door');
  assert(setText.includes('Testing opens once your game is published'), 'an unpublished game gets the honest line — publishing first, no fake test');
  assert(setText.includes('Everything checks out'), 'readiness speaks in plain words');
  assert(setText.includes('Publish your game'), 'the real Publish action stands in the open');
  assert(!setText.includes('GAME-NIGHT-SHARE'), 'no share panel before publishing');
  for (const banned of ['Dashboard', 'dashboard', 'overlay', 'Overlay', 'Rehearse', 'background picker', 'Choose your starting background']) {
    assert(!setText.includes(banned), `Set the Stage never says "${banned}"`);
  }
  assert(setText.indexOf('Perfect Match') < setText.indexOf('Test your game'), 'the game stands before the test door');
  assert(setText.indexOf('Test your game') < setText.indexOf('JEWEL-PANEL'), 'Jewel stands below the game, test and share spots');
  console.log('PASS: Set the Stage (unpublished) — game, honest test line, publish, Jewel below; no staging.');

  const pmPublished = { ...pm, publishedSnapshot: { ...pm } };
  const setPublished = await render(React.createElement(GameNightSetStage, {
    project: pmPublished, jewelPanel: panelStub, doors, onPublish: () => {}, publishing: false, publishOutcome: null
  }));
  const pubText = setPublished.textContent;
  const testButton = [...setPublished.querySelectorAll('button')].find(b => b.textContent.includes('Test your game'));
  assert(testButton, 'a published game gets the real Test door button');
  assert(pubText.includes('GAME-NIGHT-SHARE'), 'once published, the share panel (play link + QR) stands front and center');
  assert(pubText.includes('Publish latest changes'), 're-publishing stays the same single action');
  console.log('PASS: Set the Stage (published) — real test door and the share panel in the open.');

  console.log('ALL GAME NIGHT BUILDER CHECKS PASSED');
})().catch(error => { console.error(error); process.exit(1); });
