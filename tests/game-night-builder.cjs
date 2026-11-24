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
// either area. Each area does its ONE job. Stage 0 (Imagine &
// Create) is CUSTOMIZING, only: Jewel's doorway FIRST (she is the
// first thing on the page), then the game's pieces as a workbench —
// each family led by its own editor door — then the gold library
// door and the library. Stage 1 (Set the Stage) is see it, test it,
// publish it, share it: Jewel's panel FIRST, then the game pictured
// (the exhibit framing), a real test door, publish + the share
// panel in one place — with NONE of the livestream staging. And NO
// liberty text banner stands in either area: creative freedom is
// SHOWN (Jewel present, able to change anything; pictured examples;
// pieces that open into editing), never written — the statement in
// words was never authorized. NO game-plan form, NO progress
// machinery, NO Gameshow gallery or Creation Tools, and NO
// dashboard/overlay language anywhere. Other kinds keep the old
// surfaces untouched.

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
assert(page.includes('{workflowStep===1 && !stageReviewView && <BuildSpace'), 'Build Space still stands for the kinds that keep it (kind-unset projects)');
assert(page.includes('{workflowStep === 0 && project.kind !== "talk" && project.kind !== "radio" && <details key="game-plan"'), 'the game-plan form still stands for the kinds that keep it');
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
// 2b. No liberty text banner in either Game Night view: the
//     statement in words was never authorized — creative freedom
//     is shown (Jewel present, pictured examples, pieces that open
//     into editing), never written.
// ---------------------------------------------------------------------------
for (const viewFile of ['components/GameNightStage.tsx', 'components/GameNightSetStage.tsx']) {
  const viewSource = fs.readFileSync(viewFile, 'utf8');
  assert(!viewSource.includes('CREATIVE_LIBERTY_TEXT'), `${viewFile} never renders the liberty text banner`);
  assert(!viewSource.includes('Your creative liberty'), `${viewFile} carries no liberty banner heading`);
}
console.log('PASS: neither Game Night view carries the liberty text banner.');

// ---------------------------------------------------------------------------
// 2c. The banner's other homes can never reach a Game Night page
//     either (live check after PR #206: the banner was still seen
//     on the owner's multiplayer project, above the stage buttons).
//     The banner JSX lives only in the Gameshow/Talk frames and
//     their legacy workshops. Page wiring: the page mounts those
//     frames only for their own kinds. Render site: every banner
//     block is itself gated on the project not being multiplayer,
//     so no present or future mount can put the words on a Game
//     Night page — while gameshow and talk keep the banner exactly
//     as before (their own tests pin its presence there).
// ---------------------------------------------------------------------------
assert(page.includes('{workflowStep === 0 && project.kind === "gameshow" && (\n        <GameshowStage'), 'the page mounts the Gameshow stage only for gameshow projects');
assert(page.includes('{workflowStep === 0 && project.kind === "talk" && (\n        <TalkshowStage'), 'the page mounts the Talk stage only for talk projects');
for (const bannerFile of ['components/GameshowStage.tsx', 'components/TalkshowStage.tsx', 'components/GameshowWorkshop.tsx', 'components/TalkshowWorkshop.tsx']) {
  const bannerSource = fs.readFileSync(bannerFile, 'utf8');
  const gateAt = bannerSource.indexOf('kind !== "multiplayer"');
  const bannerAt = bannerSource.indexOf('className="gsw-liberty"');
  assert(gateAt !== -1, `${bannerFile} gates its liberty banner on the project kind`);
  assert(bannerAt !== -1 && gateAt < bannerAt, `${bannerFile} renders its liberty banner only inside the not-multiplayer gate`);
  assert(bannerSource.includes('Your creative liberty'), `${bannerFile} still carries the banner for its own kinds`);
}
console.log('PASS: the liberty banner is gated away from multiplayer at the page wiring and at every render site.');

// ---------------------------------------------------------------------------
// 3. Rendered stage 0 — a template project (Perfect Match, the
//    owner's own walkthrough project shape). The area's one job is
//    customizing: Jewel's doorway first, the game's pieces as a
//    workbench (cards with their text, each family led by its
//    editor door), the library below — and none of the old wall,
//    no exhibit pitch, no liberty text.
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
  assert(text0.includes('WAND-SCENE') && text0.includes('JEWEL-PANEL'), 'Jewel is the doorway: wand scene plus her conversation');
  assert(text0.indexOf('WAND-SCENE') < text0.indexOf('Perfect Match'), 'Jewel\'s doorway stands before the game pieces — she is the first thing on the page');
  assert(text0.indexOf('JEWEL-PANEL') < text0.indexOf('Perfect Match'), 'Jewel\'s conversation stands before the workbench');
  assert(text0.indexOf(`Open “${promptTool.name}” in the card editor`) < text0.indexOf(firstPrompt), 'the workbench framing: the prompt family\'s editor door LEADS its pieces, prominent above them');
  assert(text0.indexOf(`Open “${answerTool.name}” in the card editor`) < text0.indexOf(firstAnswer), 'the workbench framing: the answer family\'s editor door LEADS its pieces too');
  assert(!text0.includes(pmTemplate.description), 'no exhibit pitch in stage 0 — the game\'s description is Set the Stage material, not the workbench\'s');
  assert(!text0.includes('this site exists to accommodate your creativity'), 'no liberty statement in words anywhere in stage 0 — creative freedom is shown, not written');
  for (const banned of ['Dashboard', 'dashboard', 'overlay', 'Overlay', 'Your progress', 'Go there', 'Your game plan', 'template gallery', 'Creation Tools', 'Your creative liberty', 'Preview', 'preview', 'Exhibit', 'exhibit']) {
    assert(!text0.includes(banned), `stage 0 never says "${banned}"`);
  }
  assert(!stage0.querySelector('form'), 'stage 0 has no form');
  assert(!stage0.querySelector('textarea') && !stage0.querySelector('input'), 'stage 0 has no form fields');
  assert(!stage0.querySelector('.jewel-progress'), 'no progress machinery stands on the page');
  console.log('PASS: stage 0 renders its one job — Jewel\'s doorway first, the workbench pieces led by their editor doors, the library — no exhibit pitch, no liberty text, none of the old wall.');

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
  assert(shelfText.indexOf('WAND-SCENE') < shelfText.indexOf('Games you can build'), 'Jewel\'s doorway stands before the shelf — she is first even before a game exists');
  assert(shelfText.indexOf('JEWEL-PANEL') < shelfText.indexOf('Games you can build'), 'Jewel\'s conversation stands before the shelf');
  assert(!shelfText.includes('this site exists to accommodate your creativity'), 'no liberty statement in words on the shelf either');
  console.log('PASS: stage 0 with no game yet shows Jewel first, then the seven-game pictured shelf, not a form.');

  // -------------------------------------------------------------------------
  // 4. Rendered Set the Stage — Jewel first, then the game pictured
  //    (exhibit framing), honest test door, publish + share in one
  //    place, no livestream staging, no liberty text.
  // -------------------------------------------------------------------------
  const setUnpublished = await render(React.createElement(GameNightSetStage, {
    project: pm, jewelPanel: panelStub, doors, onPublish: () => {}, publishing: false, publishOutcome: null
  }));
  const setText = setUnpublished.textContent;
  assert(setText.includes('Perfect Match'), 'Set the Stage shows the game itself');
  assert(setText.includes(firstPrompt), 'Set the Stage shows the game\'s pieces, in the exhibit framing');
  assert(setText.includes(pmTemplate.description), 'the exhibit framing carries the game\'s description — seeing the game is this area\'s job');
  assert(setText.indexOf(firstPrompt) < setText.indexOf(`Open “${promptTool.name}” in the card editor`), 'the exhibit framing: the editor door trails quietly below the pieces here');
  assert(setText.includes('Test your game'), 'Set the Stage carries the test door');
  assert(setText.includes('Testing opens once your game is published'), 'an unpublished game gets the honest line — publishing first, no fake test');
  assert(setText.includes('Everything checks out'), 'readiness speaks in plain words');
  assert(setText.includes('Publish your game'), 'the real Publish action stands in the open');
  assert(!setText.includes('GAME-NIGHT-SHARE'), 'no share panel before publishing');
  for (const banned of ['Dashboard', 'dashboard', 'overlay', 'Overlay', 'Rehearse', 'background picker', 'Choose your starting background', 'Your creative liberty']) {
    assert(!setText.includes(banned), `Set the Stage never says "${banned}"`);
  }
  assert(!setText.includes('this site exists to accommodate your creativity'), 'no liberty statement in words in Set the Stage either');
  assert(setText.indexOf('JEWEL-PANEL') < setText.indexOf('Perfect Match'), 'Jewel stands FIRST in Set the Stage — before the game, not hidden below it');
  assert(setText.indexOf('Perfect Match') < setText.indexOf('Test your game'), 'the game stands before the test door');
  assert(setText.indexOf('Test your game') < setText.indexOf('Publish & share'), 'the test door stands before publish & share');
  console.log('PASS: Set the Stage (unpublished) — Jewel first, then game, honest test line, publish; no staging, no liberty text.');

  const pmPublished = { ...pm, publishedSnapshot: { ...pm } };
  const setPublished = await render(React.createElement(GameNightSetStage, {
    project: pmPublished, jewelPanel: panelStub, doors, onPublish: () => {}, publishing: false, publishOutcome: null
  }));
  const pubText = setPublished.textContent;
  const testButton = [...setPublished.querySelectorAll('button')].find(b => b.textContent.includes('Test your game'));
  assert(testButton, 'a published game gets the real Test door button');
  assert(pubText.includes('GAME-NIGHT-SHARE'), 'once published, the share panel (play link + QR) stands front and center');
  assert(pubText.includes('Publish latest changes'), 're-publishing stays the same single action');
  assert(pubText.indexOf('JEWEL-PANEL') < pubText.indexOf('GAME-NIGHT-SHARE'), 'Jewel stands before the share panel here too — she is never at the bottom');
  console.log('PASS: Set the Stage (published) — real test door and the share panel in the open.');

  console.log('ALL GAME NIGHT BUILDER CHECKS PASSED');
})().catch(error => { console.error(error); process.exit(1); });
