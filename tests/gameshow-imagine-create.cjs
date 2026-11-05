const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

// Gameshow "Imagine and Create" (components/GameshowStage.tsx over the
// demonstration library in GameshowWorkshop.tsx, GameshowSteps.tsx,
// GameshowToolDemos.tsx, over lib/gameshow-path.ts).
// The light stage is a presentation layer over Piece 1's evaluator: the
// area shown comes from evaluateWorkflow only, the checklist is Jewel's
// (held in her conversation — no path, step list or progress machinery
// stands on the page), demonstrations run the tools' real renderers on
// real configs/defaults, and every ask routes to Jewel's input.

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
  const files = ['components/GameshowWorkshop.tsx', 'components/GameshowSteps.tsx', 'components/GameshowToolDemos.tsx', 'components/GameshowStage.tsx', 'lib/gameshow-path.ts'];
  const occurrences = files.reduce((count, file) => count + (fs.readFileSync(file, 'utf8').match(/accommodate your creativity/g) || []).length, 0);
  assert.equal(occurrences, 1, 'the banner wording lives in exactly one place');
  const stage = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
  assert(stage.includes('{CREATIVE_LIBERTY_TEXT}'), 'the light stage renders the banner text once, above the areas');
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
  assert(/workflowStep === 0 && project\.kind === "gameshow" && \(\s*<GameshowStage/.test(page), 'the light stage renders only for gameshow projects in the Workshop stage');
  assert(page.includes('workflow={evaluateWorkflow(project)}'), 'the stage receives the real evaluator output');
  assert(!page.includes('activeStep={gameshowStep}'), 'no user-navigated step state feeds the stage — the area comes from the workflow model, as on the Talk stage');
  assert(page.includes('const current = evaluateWorkflow(project).current;'), 'the initial step comes from the evaluator’s current step');
  assert(/function askJewel\(text: string\) \{\s*setDraft\(text\);\s*focusJewelPrompt\(\);/.test(page), 'example asks fill Jewel’s real input and focus it — fill only, never auto-send');
  assert(page.includes('openCityCrimeScene: ccssBuilder.openCityCrimeScene'), 'the CCS door is the existing builder opener');
  assert(page.includes('downloadTriviaPdf'), 'the trivia PDF door survives its move onto the saved list');
  assert(page.includes('showPlanForm: () => openGamePlanEntry()'), 'the plan form stays reachable as a manual door, opened the same way as today');
  console.log('PASS: page wiring gates on kind=gameshow, feeds the evaluator in, and routes asks to Jewel’s input.');
}

// --- The light stage: Jewel's checklist, pictured examples, no machinery ---
// Jessica's live review (2026-11-04): the old gameshow page carried a
// guided path, a duplicate progress list in the sidebar, change piles
// and Jewel buried at the bottom — and its empty-project demos were
// empty frames and dark panels. The stage now mirrors the Talk stage
// she approved: demonstrations first, Jewel's doorway + conversation
// in the work area, shelves and doors after — and the checklist lives
// only in her conversation.
{
  const stage = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
  // No user-handled checklist machinery anywhere in the stage's own
  // composition: no path row, no Back/Next row, no change piles, no
  // ask strips, no done-when or checked-off strips.
  for (const machinery of ['gsw-path', 'gsw-nextrow', 'ChangeList', 'AskStrip', 'gsw-donewhen', 'gsw-jcheck', 'Your progress', 'Go there']) {
    assert(!stage.includes(machinery), `the light stage carries none of the page machinery: ${machinery}`);
  }
  // The screens stand down their furniture under the stage's context.
  const library = fs.readFileSync('components/GameshowWorkshop.tsx', 'utf8');
  assert(library.includes('export const BareStageContext'), 'the stage context exists for the shared screens');
  assert((library.match(/useContext\(BareStageContext\)/g) || []).length >= 3, 'the step shell, the change list and the ask strip all stand down under the stage');
  // Jewel is prominent: her wand-scene doorway and her conversation
  // stand inside the work area, starting at the plan.
  assert(stage.includes('<JewelWandScene onEnter={onEnterJewel} />'), 'the plan area opens the way into Jewel with her landing-page wand scene');
  assert(stage.includes('{jewelPanel}'), 'her conversation renders inside the areas, in the work area');
  assert(page.includes('talkCreateView || gameshowCreateView || stageReviewView ? null : jewelPanelElement'), 'the sidebar does not render a second copy of her panel in the gameshow create view');
  assert(panel.includes('const gameshowCreateView = project.kind === "gameshow" && workflowStep === 0') && panel.includes('const stripWithheld = talkCreateView || gameshowCreateView || stageReview;'),
    'her panel carries no progress strip in the gameshow create view — no duplicate list, no Next/Go there');
  assert(page.includes('const gameshowCreateView = project.kind === "gameshow" && workflowStep === 0') && page.includes('entryGuide={talkCreateView || gameshowCreateView || stageReviewView ? undefined :'),
    'no Current Task entry guide stands over the gameshow create view');
  // The area shown is the model's first unfinished gameshow step, in
  // Jewel's order; the toolbox is the resting area when all are done.
  assert(stage.includes('"plan", "media", "trivia-cards", "board", "tools", "scenes", "toolbox"'), 'the stage’s areas stand in Jewel’s order, plan first');
  assert(stage.includes('!step.complete') && stage.includes('workflow.stages[0]'), 'the stage reads the current area from the workflow model');
  // Empty projects demonstrate with PICTURES: the plan visual, the
  // backdrop demo and the effects stage all stand over the pictured
  // example stage — never an empty frame, gradient void or dark panel.
  assert(library.includes('export function GameshowExampleStage()') && library.includes('/redesign/kind-gameshow.webp'), 'the pictured example stage exists and is the site’s own Gameshow artwork');
  assert(library.includes('<GameshowExampleStage />'), 'the plan visual and the backdrop demo stand over the pictured example while the project is empty');
  assert(!library.includes('Example stage · yours will appear here'), 'the old text-placeholder chip is gone');
  assert(!library.includes('linear-gradient(140deg,#251739,#154c69 60%,#1d1607)'), 'the old gradient-void backdrop demo is gone');
  const steps = fs.readFileSync('components/GameshowSteps.tsx', 'utf8');
  assert(steps.includes('/redesign/kind-gameshow.webp'), 'the effects stage fires over the pictured example stage on an empty project');
  assert(!steps.includes('{backdrop?.url && <img src={backdrop.url}'), 'the effects stage no longer renders an empty panel when there is no backdrop');
  assert(steps.includes('GameshowExampleStage'), 'the board area shows the pictured example stage while no board exists');
  console.log('PASS: the light stage — Jewel holds the checklist invisibly, her doorway and conversation stand in the work area, and empty projects demonstrate with pictures.');
}

// --- Creation asks both inputs; the stage carries no plan showpiece --------
// Jessica's universal creation start (2026-11-04): a gameshow, like a
// talk show, is created from exactly the title and the theme/vibe/
// subject the user gives. The project page therefore carries NO giant
// plan visual — Jewel holds the stored plan in conversation — and the
// template shelf is picture + name only, never a paragraph card.
{
  const flow = fs.readFileSync('app/project/new/flow.tsx', 'utf8');
  assert(flow.includes('kind === "talk" || kind === "gameshow" ? ('), 'the gameshow scratch screen shares the talk title + theme ask');
  assert(flow.includes('theme: kind === "talk" || kind === "gameshow" ? theme.trim() || undefined : undefined'), 'starting a gameshow scratch project carries the theme answer forward');
  assert(flow.includes('if ((start.kind === "talk" || start.kind === "gameshow") && start.theme)'), 'gameshow creation seeds the theme exactly like talk creation');
  assert(flow.includes('project.gamePlan = { ...(project.gamePlan || {}), theme: start.theme }'), 'the creation theme lands in gamePlan.theme');

  const stage = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
  const planArea = stage.slice(stage.indexOf('function PlanArea'), stage.indexOf('/* ---------------- Media'));
  assert(!stage.includes('<PlanVisual'), 'the light stage renders no plan visual showpiece');
  assert(!stage.includes('Your game plan — as it stands'), 'the giant “Your game plan” card is off the stage');
  assert(planArea.indexOf('<JewelWandScene') < planArea.indexOf('{jewelPanel}'), 'the plan area opens with Jewel’s wand-scene doorway');
  assert(planArea.indexOf('{jewelPanel}') < planArea.indexOf('<PlanTemplates'), 'her conversation comes before the template shelf');
  assert(planArea.includes('<span>Prefer to type it yourself?</span>'), 'the plan door is one short line');
  assert(planArea.includes('>Open the plan form</button>'), 'the plan door keeps its working button');
  assert(!planArea.includes('<p>'), 'the plan area carries no explanatory paragraph');
  assert(!planArea.includes('title, theme, purpose, rules, rounds, turns, scoring, winning'), 'the old plan-form paragraph is gone');

  const library = fs.readFileSync('components/GameshowWorkshop.tsx', 'utf8');
  const templates = library.slice(library.indexOf('export function PlanTemplates'), library.indexOf('function PlanStep'));
  assert(templates.includes('<span className="gsw-an">{template.name}</span>'), 'a template card is its picture plus the template name');
  assert(templates.includes('<span className="gsw-an">All {GAME_TEMPLATES.length} templates →</span>'), 'the all-templates tile is picture-led and name-only');
  assert(!templates.includes('template.description'), 'template cards carry no description paragraph');
  assert(!templates.includes('gsw-ak'), 'template cards carry no kicker/label to collide with the name');
  assert(!templates.includes('GAME_TEMPLATES.slice(3, 9)'), 'the all-templates tile is not a text list of names');
  assert((templates.match(/\/redesign\/kind-gameshow\.webp/g) || []).length >= 2, 'the featured templates and the all-templates tile are both pictured');
  const css = fs.readFileSync('components/gameshow-workshop.css', 'utf8');
  assert(css.includes('.gsw-asset.gsw-template-card .gsw-an') && css.includes('white-space:nowrap'), 'template names stay on one line inside their cards — no header collision');

  const steps = fs.readFileSync('components/GameshowSteps.tsx', 'utf8');
  const demos = fs.readFileSync('components/GameshowToolDemos.tsx', 'utf8');
  for (const wordy of ['Where packages get used', 'Your questions, in your own words', 'Give Jewel a topic and a count']) {
    assert(!steps.includes(wordy), `the swept steps carry no paragraph block: ${wordy}`);
  }
  for (const wordy of ['Every tool above demonstrates itself', 'A whole mystery game: a storyline', 'A YouTube video isn’t a game tool']) {
    assert(!demos.includes(wordy), `the swept tool demos carry no paragraph block: ${wordy}`);
  }
  assert(!steps.includes('{tile.description}') && !demos.includes('{tile.description}'), 'tool and editor tiles render icon + name, not description lines');
  console.log('PASS: gameshow creation asks title + theme, the stage opens on Jewel (no plan showpiece), and template cards are picture + name only.');
}

// --- The two user inputs keep a compact, visible home on the stage --------
// Jessica (2026-11-04 19:22 CST), looking at the live page: she could
// not see where the user inputs the two pieces of information —
// creation asks them, but inside the project the theme lived only
// inside the collapsed plan form. The stage now opens its work area
// with one compact block holding exactly those two inputs, bound to
// the same fields creation seeds (the project name, gamePlan.theme)
// and saved through the page's existing save path.
{
  const stage = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
  const block = stage.slice(stage.indexOf('function YourShow'), stage.indexOf('/* ---------------- Plan'));
  assert(block.length > 0, 'the stage carries the Your show block');
  // Exactly two inputs and nothing else — no textarea, select or button.
  assert.equal((block.match(/<input/g) || []).length, 2, 'the Your show block holds exactly two inputs');
  assert(!block.includes('<textarea') && !block.includes('<select') && !block.includes('<button'), 'the block holds nothing but the two inputs — no save button, no extra controls');
  assert(block.includes('>Your show</div>'), 'the block heading is one short line');
  assert(block.includes('<span>Title of your show</span>'), 'the first input is the title, labeled exactly as creation labels it');
  assert(block.includes('<span>Theme, vibe, or subject</span>'), 'the second input is the theme, labeled exactly as creation labels it');
  // Bound to the creation-seeded fields, pre-filled from them; a
  // project without a theme shows the theme input empty.
  assert(block.includes('const savedTitle = project.name') && block.includes('useState(savedTitle)'), 'the title input starts from the project name');
  assert(block.includes('project.gamePlan?.theme || ""'), 'the theme input starts from gamePlan.theme, empty when unset');
  // Writes go through the page's save path and touch only the two
  // seeded fields, preserving every other plan field.
  assert(block.includes('onSaveProject({ ...project, name: title, updatedAt: "just now" })'), 'a title edit saves the project name through the page save path');
  assert(block.includes('gamePlan: { ...(project.gamePlan || {}), theme }'), 'a theme edit writes gamePlan.theme and preserves the rest of the plan');
  assert(block.includes('onBlur={saveTitle}') && block.includes('onBlur={saveTheme}'), 'both inputs save on blur — no save button needed');
  assert(block.includes('event.currentTarget.blur()'), 'Enter saves too, by leaving the field');
  // Placement: the first block of the work area — under the banner
  // (never above it), ahead of every area, so in the plan area it
  // stands before Jewel's wand-scene doorway.
  const render = stage.slice(stage.indexOf('return (\n    <section'));
  assert(render.indexOf('gsw-liberty') < render.indexOf('<YourShow'), 'the block is not above the creative-liberty banner');
  assert(render.indexOf('<YourShow') < render.indexOf('<BareStageContext.Provider'), 'the block stands ahead of the areas — before the wand-scene doorway in the plan area');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const stageElement = page.slice(page.indexOf('<GameshowStage'), page.indexOf('/>', page.indexOf('<GameshowStage')));
  assert(stageElement.includes('onSaveProject={persist}'), 'the page wires the stage to its existing persist — the same save the plan form and the rename use');
  console.log('PASS: the two user inputs — title and theme — sit in one compact block at the start of the stage and save through the page’s existing save path.');
}

// --- Preservation round-trip: a full project survives the model intact -----
// Music Showdown's shape: 38 assets, 24 tools, 203 Jewel messages.
// Evaluation and demonstration lookups are reads — nothing about the
// project changes by being shown on the light stage.
{
  const assets = Array.from({ length: 38 }, (_, i) => ({ name: `asset-${i}`, type: i % 3 ? 'image' : 'audio', role: i === 0 ? 'background' : undefined, url: `https://example.invalid/${i}`, inProject: i === 0 }));
  const gameTools = Array.from({ length: 24 }, (_, i) => ({ id: `t${i}`, type: i === 0 ? 'wheel' : 'scoreboard', name: `Tool ${i}`, enabled: true, config: i === 0 ? { segments: ['A', 'B'] } : {} }));
  const messages = Array.from({ length: 203 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `message ${i}` }));
  const full = baseProject({ kind: 'gameshow', assets, gameTools, messages, gamePlan: { theme: 'neon music', purpose: 'A music showdown' } });
  const before = JSON.stringify([full.assets.length, full.gameTools.length, full.messages.length]);
  const evaluation = evaluateWorkflow(full);
  eq(evaluation.stages[0].steps.map(s => s.id), ['plan', 'media', 'trivia-cards', 'board', 'tools', 'scenes', 'toolbox']);
  demoTool(full, 'wheel');
  const after = JSON.stringify([full.assets.length, full.gameTools.length, full.messages.length]);
  assert.equal(after, before, 'assets, tools and messages counts are intact after evaluation and demo lookups');
  assert.equal(full.messages[202].text, 'message 202', 'the conversation itself is untouched');
  console.log('PASS: preservation round-trip — a Music-Showdown-shaped project keeps every asset, tool and message.');
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
  // The stage itself: no network, no generation — and it never calls
  // the page's save directly. Its one write is the user's two inputs,
  // through the onSaveProject prop the page wires to that same save
  // (pinned in the Your show block above).
  const stageSource = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
  assert(!stageSource.includes('fetch(') && !stageSource.includes('/api/') && !stageSource.includes('generateAsset'), 'the light stage makes no network calls and generates nothing itself');
  assert(!stageSource.includes('persist('), 'the light stage writes only through the onSaveProject prop — never the page save directly');
  const shell = fs.readFileSync('components/GameshowWorkshop.tsx', 'utf8');
  assert(shell.includes('step.complete'), 'green checks read the evaluator’s step.complete');
  assert(!shell.includes('setGameshowStep') && !/useState\([^)]*complete/i.test(shell), 'the shell keeps no completion state of its own');
  const demos = fs.readFileSync('components/GameshowToolDemos.tsx', 'utf8');
  assert(demos.includes('ccssEntitled'), 'the City Crime Scene tile is gated on entitlement');
  assert(/ccssEntitled \? \[\{ type: "city-crime-scene"/.test(demos) && demos.includes('ccssEntitled && ('), 'no CCS tile exists at all for non-entitled accounts');
  assert(shell.includes('ChanceTools') === false, 'renderers are imported by the demo screens, not re-implemented in the shell');
  console.log('PASS: the new components generate nothing of their own, write only the two user inputs through the page save, and take every check from the evaluator.');
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
