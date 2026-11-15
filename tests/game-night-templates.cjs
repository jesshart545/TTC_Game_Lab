const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

const shelf = load('lib/game-night-templates.ts');
const { GAME_NIGHT_TEMPLATES, getGameNightTemplate, applyGameNightTemplate } = shelf;
const engine = load('lib/game-room.ts');
const { buildReadiness, publishReviewSummary } = load('lib/build-readiness.ts');
const { createProject } = load('lib/project.ts');
// Loaded modules run in the test loader's VM realm, so deepStrictEqual
// rejects their arrays on prototype grounds; compare structurally instead.
const same = (actual, expected, message) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

// Game Night templates (Jessica's design, 2026-11-15): the Game Night
// builder opens on pictured template cards — picture + name ONLY — one
// per game. Clicking a card opens it with a SHORT description and a
// prompt: continue with this template, or go back. Continue creates the
// project with the template's starter content, customized afterwards
// with Jewel. A build-from-scratch option sits alongside, like the
// Gameshow builder's. These pins hold the shelf data, the resolution of
// every template to its real engine game, multiplayer readiness, and
// the create-flow wiring.

// ---------------------------------------------------------------------------
// 1. The shelf: exactly the five games whose engine modules are live,
//    in registry order, each with a name and a SHORT description.
// ---------------------------------------------------------------------------
same(GAME_NIGHT_TEMPLATES.map(t => t.gameType), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match', 'word-chain'],
  'the shelf holds exactly the five live game-night games, in engine registry order');
same(GAME_NIGHT_TEMPLATES.map(t => t.name), ['Bingo', 'Quiz Board', 'Survey Showdown', 'Perfect Match', 'Word Chain'],
  'shelf names are the games’ own names');
assert.equal(new Set(GAME_NIGHT_TEMPLATES.map(t => t.id)).size, 5, 'template ids are unique');
for (const template of GAME_NIGHT_TEMPLATES) {
  assert(template.name.trim().length > 0, `${template.id}: has a name`);
  assert(template.description.trim().length > 0, `${template.id}: has a short description for the open view`);
  assert(template.description.length <= 280, `${template.id}: description stays short (${template.description.length} chars)`);
  assert((template.description.match(/\./g) || []).length <= 2, `${template.id}: description is at most two sentences`);
  assert(template.icon.trim().length > 0, `${template.id}: has an icon`);
  assert(template.image.startsWith('/'), `${template.id}: card artwork is a site image path`);
  assert.equal(getGameNightTemplate(template.id), template, `${template.id}: getGameNightTemplate round-trips`);
}
assert.equal(getGameNightTemplate('game-night-draw-guess'), undefined, 'Draw & Guess is not on the shelf until its engine module lands — no empty promises');
assert.equal(getGameNightTemplate('game-night-property-tycoon'), undefined, 'Property Tycoon is not on the shelf until its engine module lands — no empty promises');
console.log('PASS: the shelf exposes exactly the five live games, each with a name and a short description.');

// ---------------------------------------------------------------------------
// 2. Every template builds a project that resolves to its own game
//    through the real pickGame, passes multiplayer readiness, and
//    carries no dashboard wiring (a game night has no host).
// ---------------------------------------------------------------------------
function projectFromTemplate(template) {
  const project = createProject('');
  applyGameNightTemplate(project, template);
  return project;
}

for (const template of GAME_NIGHT_TEMPLATES) {
  const project = projectFromTemplate(template);
  assert.equal(project.kind, 'multiplayer', `${template.id}: project kind is multiplayer`);
  assert.equal(project.templateId, template.id, `${template.id}: project is stamped with the template id`);
  same(project.controls, [], `${template.id}: no dashboard controls — a game night has no host dashboard`);
  // The published snapshot is the project as saved JSON; the share route
  // runs pickGame over exactly that.
  const snapshot = JSON.parse(JSON.stringify(project));
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, `${template.id}: pickGame resolves (got error: ${picked.error})`);
  assert.equal(picked.gameType, template.gameType, `${template.id}: resolves to ${template.gameType}`);
  same(buildReadiness(project), [], `${template.id}: multiplayer buildReadiness is clean`);
  assert.equal(publishReviewSummary(project, buildReadiness(project)).checksOut, true, `${template.id}: publish review checks out on content alone`);
}
console.log('PASS: every template project resolves to its own game and is publish-ready on content alone.');

// ---------------------------------------------------------------------------
// 3. The starter content is real and playable-sized, per game.
// ---------------------------------------------------------------------------
const configOf = (id) => engine.pickGame(JSON.parse(JSON.stringify(projectFromTemplate(getGameNightTemplate(id))))).config;

const bingoConfig = configOf('game-night-bingo');
assert(bingoConfig.items.length >= 24, `bingo pool deals full 5x5 cards (${bingoConfig.items.length} items)`);

const quizConfig = configOf('game-night-quiz-board');
const quizTotal = quizConfig.categories.reduce((sum, c) => sum + c.questions.length, 0);
assert(quizConfig.categories.length >= 2 && quizTotal >= 6, `quiz board is playable (${quizConfig.categories.length} categories, ${quizTotal} questions)`);
for (const category of quizConfig.categories) {
  for (const q of category.questions) assert(q.prompt && q.answer, 'every quiz square carries a question and an answer');
}

const surveyConfig = configOf('game-night-survey-showdown');
assert(surveyConfig.questions.length >= 3, `survey has at least 3 questions (${surveyConfig.questions.length})`);
for (const question of surveyConfig.questions) {
  assert(question.answers.length >= 3, `survey question "${question.question}" has at least 3 answers`);
  const sum = question.answers.reduce((total, a) => total + a.points, 0);
  assert(sum >= 90 && sum <= 110, `survey points for "${question.question}" sum to about 100 (got ${sum})`);
}

const matchConfig = configOf('game-night-perfect-match');
assert(matchConfig.prompts.length >= 10, `perfect match has at least 10 prompts (${matchConfig.prompts.length})`);
assert(matchConfig.answers.length >= 30, `perfect match has at least 30 answers (${matchConfig.answers.length})`);

const chainConfig = configOf('game-night-word-chain');
assert(chainConfig.starters.length >= 10, `word chain has at least 10 starters (${chainConfig.starters.length})`);
console.log('PASS: starter content is real and playable-sized for all five games.');

// ---------------------------------------------------------------------------
// 4. No dollar signs anywhere in the shelf data or any template draft.
// ---------------------------------------------------------------------------
for (const template of GAME_NIGHT_TEMPLATES) {
  const everything = JSON.stringify({ shelf: { name: template.name, description: template.description }, draft: template.buildDraft() });
  assert(!everything.includes('$'), `${template.id}: no dollar sign in shelf data or draft content`);
}
console.log('PASS: no dollar signs in any game-night template.');

// ---------------------------------------------------------------------------
// 5. Create-flow wiring (source pins, the admin-multiplayer-create
//    pattern): the multiplayer start offers Build from Scratch AND the
//    template shelf; shelf cards render picture + name ONLY; the open
//    view carries the short description with Continue / Go back.
// ---------------------------------------------------------------------------
const flow = fs.readFileSync(path.join(__dirname, '..', 'app/project/new/flow.tsx'), 'utf8');
assert(flow.includes('GAME_NIGHT_TEMPLATES'), 'create flow renders the game-night shelf data');
assert(flow.includes('getGameNightTemplate'), 'create flow can start a project from a game-night template');
assert(flow.includes('applyGameNightTemplate'), 'create flow applies game-night templates through the shared helper');
assert(flow.includes('Build from Scratch'), 'the start popup still offers Build from Scratch');
assert(flow.includes('kind === "multiplayer" ? "gn-templates" : "templates"'), 'the multiplayer start routes to the game-night shelf; gameshow keeps its own');
assert(flow.includes('next === "gameshow" || next === "multiplayer"'), 'multiplayer gets the same two-ways-in popup as gameshow');

const shelfBlock = flow.slice(flow.indexOf('screen === "gn-templates"'), flow.indexOf('screen === "gn-detail"'));
assert(shelfBlock.includes('template.name'), 'shelf cards show the game name');
assert(shelfBlock.includes('template.image'), 'shelf cards show the game picture');
assert(!shelfBlock.includes('template.description'), 'shelf cards show picture + name ONLY — no description text on cards');
assert(!shelfBlock.includes('template.tagline'), 'shelf cards carry no tagline text');

const detailBlock = flow.slice(flow.indexOf('screen === "gn-detail"'), flow.indexOf('{popup &&'));
assert(detailBlock.includes('template.description'), 'the open view shows the short description');
assert(detailBlock.includes('Continue with this template'), 'the open view prompts: continue with this template');
assert(detailBlock.includes('Go back'), 'the open view prompts: or go back');
assert(detailBlock.includes('chooseTemplate(template.id)'), 'continue starts the project from that template');
console.log('PASS: create flow offers scratch + the pictured shelf; cards are picture + name only; the open view asks continue-or-go-back.');
