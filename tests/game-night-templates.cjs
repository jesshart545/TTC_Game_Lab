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
// 1. The shelf: exactly the seven games whose engine modules are live,
//    in registry order, each with a name and a SHORT description.
// ---------------------------------------------------------------------------
same(GAME_NIGHT_TEMPLATES.map(t => t.gameType), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match', 'word-chain', 'draw-guess', 'property-tycoon'],
  'the shelf holds exactly the seven live game-night games, in engine registry order');
same(GAME_NIGHT_TEMPLATES.map(t => t.name), ['Bingo', 'Quiz Board', 'Survey Showdown', 'Perfect Match', 'Word Chain', 'Draw & Guess', 'Property Tycoon'],
  'shelf names are the games’ own names');
assert.equal(new Set(GAME_NIGHT_TEMPLATES.map(t => t.id)).size, 7, 'template ids are unique');
for (const template of GAME_NIGHT_TEMPLATES) {
  assert(template.name.trim().length > 0, `${template.id}: has a name`);
  assert(template.description.trim().length > 0, `${template.id}: has a short description for the open view`);
  assert(template.description.length <= 280, `${template.id}: description stays short (${template.description.length} chars)`);
  assert((template.description.match(/\./g) || []).length <= 2, `${template.id}: description is at most two sentences`);
  assert(template.icon.trim().length > 0, `${template.id}: has an icon`);
  assert(template.image.startsWith('/'), `${template.id}: card artwork is a site image path`);
  assert.equal(getGameNightTemplate(template.id), template, `${template.id}: getGameNightTemplate round-trips`);
}
console.log('PASS: the shelf exposes exactly the seven live games, each with a name and a short description.');

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

const drawConfig = configOf('game-night-draw-guess');
assert(drawConfig.words.length >= 12, `draw & guess has at least 12 words to draw (${drawConfig.words.length})`);

const tycoonConfig = configOf('game-night-property-tycoon');
assert(tycoonConfig.properties.length >= 12, `property tycoon has at least 12 properties (${tycoonConfig.properties.length})`);
// The template carries no chance list of its own on purpose: a
// chance-named list with five or more cards is a Bingo call pool to the
// engine, and the project would resolve to Bingo instead of Property
// Tycoon. The engine's built-in chance deck plays — six cards paired
// with the fixed effect rotation. (If a chance list ever is added to
// the draft, this pin is the one that has to be revisited.)
assert(tycoonConfig.chanceCards.length >= 6, `property tycoon plays a full chance deck (${tycoonConfig.chanceCards.length} cards)`);
const tycoonDraft = getGameNightTemplate('game-night-property-tycoon').buildDraft();
const chanceLists = tycoonDraft.gameTools.filter(tool => tool.type === 'card-list' && tool.name.toLowerCase().includes('chance'));
for (const list of chanceLists) {
  assert(list.config.cards.length >= 6, 'a chance list in the tycoon draft holds at least 6 chance-card texts');
}
console.log('PASS: starter content is real and playable-sized for all seven games.');

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

// ---------------------------------------------------------------------------
// 6. The universal two-input start (Jessica, 2026-11-15): EVERY category
//    begins with exactly two inputs from the creator — (1) the title of
//    their game and (2) its theme / vibe / subject — asked FIRST, before
//    Jewel. The Game Night template's open view asks both, Continue
//    carries them into the project as its name and its theme/idea (NOT
//    the template's name or stock description), and the from-scratch
//    screen asks both the same way the Gameshow screen does. Blanks
//    fall back the Gameshow way: template name / template description.
// ---------------------------------------------------------------------------
assert(detailBlock.includes('the title of your game'), 'the open view asks for the title of the creator’s game');
assert(detailBlock.includes('aria-label="Game title"'), 'the open view carries a game title input');
assert(detailBlock.includes('aria-label="Theme, vibe, or subject"'), 'the open view carries a theme input, labeled as creation labels it');
assert(detailBlock.includes('value={name}') && detailBlock.includes('value={theme}'), 'the open view’s two inputs bind the same title/theme state the Gameshow ask uses');
assert(flow.includes('applyGameNightTemplate(project, gnTemplate, name, theme)'), 'continue passes the creator’s title AND theme into the template helper');

const scratchBlock = flow.slice(flow.indexOf('screen === "scratch"'), flow.indexOf('screen === "templates"'));
assert(scratchBlock.includes(') : kind === "multiplayer" ? ('), 'the scratch screen gives multiplayer its own two-input branch');
assert(scratchBlock.includes('the title of your game'), 'the scratch screen asks a game night for its title and theme, like a show');
assert(flow.includes('if (kind === "multiplayer") scratch.theme = theme.trim() || undefined;'), 'starting a game night from scratch carries the theme answer forward');
assert(flow.includes('if (start.kind === "multiplayer" && start.theme) {'), 'game-night scratch creation seeds the theme into gamePlan.theme');

const matchTemplate = getGameNightTemplate('game-night-perfect-match');
const matchDraft = matchTemplate.buildDraft();

// With the creator's two inputs: their title is the project name, their
// theme is the project idea and its gamePlan.theme, Jewel greets THEM —
// and the template's game content is untouched.
const creatorProject = createProject('');
applyGameNightTemplate(creatorProject, matchTemplate, 'Haunted Manor Night', 'spooky Halloween sleepover');
assert.equal(creatorProject.name, 'Haunted Manor Night', 'the creator’s title is the project name, not the template’s name');
assert.equal(creatorProject.description, 'spooky Halloween sleepover', 'the creator’s theme is the project idea, not the template’s stock description');
assert.equal(creatorProject.gamePlan && creatorProject.gamePlan.theme, 'spooky Halloween sleepover', 'the creator’s theme seeds gamePlan.theme, the slot Jewel works from');
const greeting = creatorProject.messages[0].text;
assert(greeting.includes('"Haunted Manor Night"'), 'Jewel’s greeting speaks to the creator’s title');
assert(greeting.includes('spooky Halloween sleepover'), 'Jewel’s greeting speaks to the creator’s theme');
assert(!greeting.includes(matchTemplate.description), 'the greeting does not recite the template’s shelf description as the idea');
assert(!greeting.includes(matchDraft.description), 'the greeting does not recite the template’s stock draft description as the idea');
assert(!creatorProject.description.includes(matchDraft.description), 'the project idea is not the template’s stock description');
same(creatorProject.gameTools, matchDraft.gameTools, 'the template’s game content is unchanged by the two inputs');
assert.equal(creatorProject.kind, 'multiplayer', 'two-input project kind is still multiplayer');
same(creatorProject.controls, [], 'two-input project still carries no dashboard controls');
assert.equal(engine.pickGame(JSON.parse(JSON.stringify(creatorProject))).gameType, 'perfect-match', 'two-input project still resolves to its template’s game');

// Blanks (and whitespace) fall back exactly as before this change: the
// template’s name, the template’s descriptions, the same greeting.
for (const template of GAME_NIGHT_TEMPLATES) {
  const draft = template.buildDraft();
  for (const args of [[], ['  ', '   ']]) {
    const blankProject = createProject('');
    applyGameNightTemplate(blankProject, template, ...args);
    assert.equal(blankProject.name, draft.name, `${template.id}: a blank title keeps the template’s name`);
    assert.equal(blankProject.description, draft.description, `${template.id}: a blank theme keeps the template’s description as the idea`);
    assert(!(blankProject.gamePlan && blankProject.gamePlan.theme), `${template.id}: a blank theme stamps no gamePlan.theme`);
    assert(blankProject.messages[0].text.startsWith(`Your "${template.name}" game night is ready! ${template.description} `), `${template.id}: the blank-case greeting is the one the site has always given`);
  }
}
console.log('PASS: the two-input start — the template view and the scratch screen both ask title + theme; the creator’s words become the project’s name and idea; blanks fall back to the template’s own.');
