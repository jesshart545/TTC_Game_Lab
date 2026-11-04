const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

// Talk Show or Classroom "Imagine and Create" (components/TalkshowWorkshop.tsx
// + TalkshowSteps.tsx over lib/talkshow-path.ts), built on the Gameshow
// architecture: step state comes from evaluateWorkflow only, demonstrations
// render the project's real data, example asks only fill Jewel's input, and
// the one new mechanism — the backdrop text layer (lib/backdrop-text.ts) —
// is a validated DOM text spec, never lettering burned into artwork.

const { evaluateWorkflow } = load('lib/workflow-progress.ts');
const { cleanBackdropText, assetBackdropText, findSignAsset, signPresent, backgroundAssets } = load('lib/backdrop-text.ts');
const { cleanTriviaQuestions, quizQuestionsOf, scrubQuizQuestionsForPublish } = load('lib/quiz.ts');
const { questionPool, publicCardState, cardDisplayText } = load('lib/question-cards.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');
const { applyBuildChanges, creatableTools } = load('lib/build-edits.ts');
const talkPath = load('lib/talkshow-path.ts');
const { TALK_STEPS, TALK_STEP_ORDER, TALK_CREATIVITY_BANNER, TALK_TOOL_TYPES } = talkPath;
const { SIGN_CHANGES, BACKDROP_CHANGES, QUIZ_CHANGES, RESEARCH_CHANGES, YOUTUBE_CHANGES, SLIDES_CHANGES, DEMO_FONTS } = talkPath;
const { fontCatalog } = load('lib/fonts.ts');

const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
const FONT = fontCatalog[0].family;

function baseProject(overrides = {}) {
  return {
    id: 'p1', name: 'New Project', slug: 'p1-x', description: '', status: 'Draft', theme: 'cyan',
    updatedAt: 'now', prompt: '', messages: [], controls: [], assets: [], assetPools: [], compositions: [],
    overlay: { title: '', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    wheel: { enabled: false, title: '', segments: [], spinning: false, visible: false },
    gameTools: [], gamePlan: {}, kind: 'talk',
    ...overrides,
  };
}
const stepState = (project, id) => evaluateWorkflow(project).stages[0].steps.find(s => s.id === id);
const bgAsset = (overrides = {}) => ({ name: 'Backdrop.png', type: 'Image', storageKey: 'projects/p1/backdrop.png', role: 'background', inProject: false, ...overrides });
const quizTool = (overrides = {}) => ({
  id: 'quiz-1', type: 'trivia-list', name: 'Show Quiz', enabled: true,
  config: { questions: [{ question: 'Which planet is the Red Planet?', options: ['Venus', 'Mars'], correctIndex: 1, answer: 'Mars' }] },
  ...overrides,
});

// --- Kind gating: the talk path exists for talk projects only ---------------
{
  eq(evaluateWorkflow(baseProject()).stages[0].steps.map(s => s.id),
    ['sign', 'backdrops', 'research', 'quiz', 'youtube', 'slides', 'toolbox']);
  eq(TALK_STEP_ORDER, ['sign', 'backdrops', 'research', 'quiz', 'youtube', 'slides', 'toolbox']);
  eq(Object.keys(TALK_STEPS), TALK_STEP_ORDER, 'step copy covers exactly the evaluator steps, in order');
  for (const id of TALK_STEP_ORDER) assert(TALK_STEPS[id].asks.length >= 2, `${id} offers example asks for Jewel`);
  // Other kinds keep their own paths, untouched.
  eq(evaluateWorkflow(baseProject({ kind: 'gameshow' })).stages[0].steps.map(s => s.id),
    ['plan', 'media', 'trivia-cards', 'board', 'tools', 'scenes', 'toolbox']);
  eq(evaluateWorkflow(baseProject({ kind: undefined })).stages[0].steps.map(s => s.id),
    ['plan', 'media', 'tools', 'scenes', 'toolbox']);
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('project.kind === "talk"') && page.includes('<TalkshowWorkshop'), 'the page renders the Talkshow Workshop for talk projects');
  assert(page.includes('project.kind === "gameshow"') && page.includes('<GameshowWorkshop'), 'the Gameshow Workshop still renders for gameshow projects');
  console.log('PASS: kind gating — talk projects get the seven talk steps; gameshow and generic paths are unchanged.');
}

// --- Presentation grammar: the finished Gameshow pages are the guide --------
// The rework (Jessica, after seeing PR #135 live): every kind's steps are
// presented the way the Gameshow steps are — Gameshow-shaped step meta
// (kicker / one-subject intro / short done-when / short Jewel note),
// quoted example-ask chips, the SHARED ChangeList component rendering
// ChangeItem rows, pictured shelves, and brevity enforced as data.
{
  TALK_STEP_ORDER.forEach((id, i) => {
    const meta = TALK_STEPS[id];
    assert.equal(meta.kicker, `Step ${i + 1} of 7`, `${id}: the kicker counts the steps, Gameshow-style`);
    assert(typeof meta.intro === 'string' && meta.intro.length > 0, `${id}: an intro line`);
    if (id !== 'toolbox') assert(meta.intro.startsWith('One subject here:'), `${id}: the intro names its one subject, like every Gameshow step`);
    assert(typeof meta.doneWhen === 'string' && meta.doneWhen.length <= 160, `${id}: the done-when line stays a short line, not a paragraph`);
    assert(typeof meta.jewelNote === 'string' && meta.jewelNote.length <= 220, `${id}: Jewel's strip message stays short`);
    for (const ask of meta.asks) assert(ask.chip.startsWith('“'), `${id}: example asks read as quoted examples, Gameshow-style`);
  });
  // Change lists are ChangeItems (label / sub / tap-to-ask say), the shape
  // the Gameshow ChangeList renders — never bare strings.
  for (const [name, list] of Object.entries({ SIGN_CHANGES, BACKDROP_CHANGES, QUIZ_CHANGES, RESEARCH_CHANGES, YOUTUBE_CHANGES, SLIDES_CHANGES })) {
    assert(Array.isArray(list) && list.length >= 1, `${name}: a non-empty change list`);
    for (const item of list) assert(typeof item.label === 'string' && item.label.length > 0, `${name}: every row carries a label`);
  }
  assert(SIGN_CHANGES.some(item => item.say) && QUIZ_CHANGES.some(item => item.say) && RESEARCH_CHANGES.some(item => item.say),
    'rows that name a Jewel capability are tap-to-ask rows');
  // The components actually use the shared Gameshow presentation pieces.
  const shell = fs.readFileSync('components/TalkshowWorkshop.tsx', 'utf8');
  const steps = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  assert(steps.includes('import { ChangeList } from "./GameshowWorkshop"'), 'the talk steps render change lists with the Gameshow ChangeList component');
  assert(!shell.includes('TalkChangeList') && !steps.includes('TalkChangeList'), 'the old talk-only plain-string change list is gone');
  assert(steps.includes('AssetThumbnail'), 'shelves are pictured tiles over the real assets, like the Gameshow media shelf');
  assert(shell.includes('info.doneWhen') && shell.includes('info.kicker') && shell.includes('info.jewelNote'),
    'the step shell reads the Gameshow-shaped meta (kicker, intro, done-when, Jewel note)');
  console.log('PASS: presentation grammar — Gameshow-shaped meta, quoted ask chips, shared ChangeList, pictured shelves.');
}

// --- Sign step: name & theme come from the creator, through Jewel -----------
// (Jessica, 2026-11-03, superseding the PR #136 in-step fields: the title
// and the theme/vibe/subject are asked FIRST — at a new talk project's
// start, and by Jewel inside this step for any project that arrives
// without them. The step's face is the sign demonstration + the ask: no
// fields, no font/color pickers, no "short version" display block.)
{
  const steps = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  const signSpan = steps.slice(steps.indexOf('export function SignStep'), steps.indexOf('export function BackdropsStep'));
  assert(!signSpan.includes('name: event.target.value'), 'the sign step has no name field');
  assert(!signSpan.includes('theme: event.target.value'), 'the sign step has no theme field');
  assert(!signSpan.includes('Your name & theme'), 'no name & theme duplication block on the step');
  assert(!signSpan.includes('tsw-fields'), 'no field block remains on the sign step');
  assert(!signSpan.includes('LookControls'), 'no font/color picker controls on the sign step face — choosing happens by asking Jewel');
  assert(signSpan.includes('BackdropTextLayer'), 'the sign demonstration still letters for real');
  assert(signSpan.includes('Upload your own sign'), 'the uploaded-sign door stays on the step');
  assert(TALK_STEPS.sign.asks[0].say.startsWith("My show's title and theme are"), 'the first example ask is the title & theme answer');
  const backdropsSpan = steps.slice(steps.indexOf('export function BackdropsStep'), steps.indexOf('export function ResearchStep'));
  assert(backdropsSpan.includes('LookControls'), 'the backdrop lettering demonstration keeps its live look-switching');
  console.log('PASS: sign step face — demonstration + the ask; no fields, no pickers, no duplication block.');
}

// --- The lettering demonstration offers the site's real display fonts --------
// (Live-verification gap in PR #135: the font buttons were the catalog's
// opening system stacks — Arial, Georgia, Verdana, Trebuchet MS, Monospace.
// A sign is lettered in a display face: every offered font must be one of
// the catalog's self-hosted faces, the ones carrying a font file.)
{
  const systemStacks = ['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Monospace'];
  assert(DEMO_FONTS.length >= 4, 'the demonstration offers a real choice of display fonts');
  for (const demo of DEMO_FONTS) {
    assert(!systemStacks.includes(demo.name), `${demo.name}: no system stacks among the sign fonts`);
    const catalogFont = fontCatalog.find(font => font.name === demo.name);
    assert(catalogFont && 'file' in catalogFont, `${demo.name}: a self-hosted catalog face (carries a font file)`);
    assert.equal(demo.family, catalogFont.family, `${demo.name}: rendered in the catalog's own family string`);
  }
  console.log('PASS: demo fonts — the sign demonstration letters in the site’s real display fonts only.');
}

// --- Talk step evaluators ----------------------------------------------------
{
  // sign: real name + a sign present.
  assert.equal(stepState(baseProject(), 'sign').complete, false, 'placeholder name, no sign');
  assert.equal(stepState(baseProject({ name: 'Galaxy Talk' }), 'sign').complete, false, 'a name alone is not a sign');
  const jewelSign = baseProject({ name: 'Galaxy Talk', assets: [bgAsset({ sign: true, textOverlay: { text: 'Galaxy Talk', fontFamily: FONT, textColor: '#ffd700' } })] });
  assert.equal(stepState(jewelSign, 'sign').complete, true, 'Jewel-made sign: backdrop + title text layer');
  const letteredOnly = baseProject({ name: 'Galaxy Talk', assets: [bgAsset({ textOverlay: { text: 'galaxy talk', fontFamily: FONT, textColor: '#ffffff' } })] });
  assert.equal(stepState(letteredOnly, 'sign').complete, true, 'a backdrop lettered with the show name is the sign, flag or not');
  const uploaded = baseProject({ name: 'Galaxy Talk', assets: [bgAsset({ name: 'my-sign.png', sign: true })] });
  assert.equal(stepState(uploaded, 'sign').complete, true, 'an uploaded sign counts');
  // backdrops: any background-role asset.
  assert.equal(stepState(baseProject(), 'backdrops').complete, false);
  assert.equal(stepState(baseProject({ assets: [bgAsset()] }), 'backdrops').complete, true);
  assert.equal(stepState(baseProject({ assets: [{ name: 'x.png', type: 'Image', role: 'layer' }] }), 'backdrops').complete, false, 'a layer is not a backdrop');
  // research: only the recorded fact completes it.
  assert.equal(stepState(baseProject(), 'research').complete, false);
  assert.equal(stepState(baseProject({ workflowProgress: { researched: true } }), 'research').complete, true, 'Jewel ran a search in this project');
  // quiz: an MCQ saved in a trivia list — plain trivia does not count.
  assert.equal(stepState(baseProject({ gameTools: [quizTool()] }), 'quiz').complete, true);
  const plain = quizTool({ config: { questions: [{ question: 'Q?', answer: 'A' }] } });
  assert.equal(stepState(baseProject({ gameTools: [plain] }), 'quiz').complete, false, 'plain Q&A is not a multiple-choice quiz');
  assert.equal(stepState(baseProject({ gameTools: [quizTool({ enabled: false })] }), 'quiz').complete, false, 'a disabled quiz does not count');
  // youtube.
  assert.equal(stepState(baseProject({ gameTools: [{ id: 'y1', type: 'youtube', name: 'YouTube', enabled: true, config: {} }] }), 'youtube').complete, true);
  assert.equal(stepState(baseProject(), 'youtube').complete, false);
  // slides: the deck needs at least two slides.
  const slide = n => ({ id: `s${n}`, kind: 'backdrop', label: `Slide ${n}`, refKey: `k${n}` });
  assert.equal(stepState(baseProject({ talkDeck: [slide(1)] }), 'slides').complete, false, 'one slide is not a deck');
  assert.equal(stepState(baseProject({ talkDeck: [slide(1), slide(2)] }), 'slides').complete, true);
  // toolbox: every earlier step + the opened fact.
  const full = baseProject({
    name: 'Galaxy Talk',
    assets: [bgAsset({ sign: true, textOverlay: { text: 'Galaxy Talk', fontFamily: FONT, textColor: '#ffd700' } })],
    gameTools: [quizTool(), { id: 'y1', type: 'youtube', name: 'YouTube', enabled: true, config: {} }],
    workflowProgress: { researched: true },
    talkDeck: [slide(1), slide(2)],
  });
  assert.equal(stepState(full, 'toolbox').complete, false, 'not opened yet');
  assert.equal(stepState({ ...full, workflowProgress: { researched: true, toolboxOpened: true } }, 'toolbox').complete, true);
  console.log('PASS: talk evaluators — sign, backdrops, research fact, quiz, youtube, deck ≥ 2, toolbox gating.');
}

// --- The backdrop text spec: validation --------------------------------------
{
  eq(cleanBackdropText({ text: '  Galaxy   Talk ', fontFamily: FONT, textColor: '#FFD700', accentColor: '#b3123f' }),
    { text: 'Galaxy Talk', fontFamily: FONT, textColor: '#FFD700', accentColor: '#b3123f' });
  assert.equal(cleanBackdropText({ text: 'X', fontFamily: 'Comic Sans MS', textColor: '#fff' }), null, 'a font outside the catalog is rejected whole');
  assert.equal(cleanBackdropText({ text: 'X', fontFamily: FONT, textColor: 'gold' }), null, 'a non-hex color is rejected');
  assert.equal(cleanBackdropText({ text: 'X', fontFamily: FONT, textColor: '#fff', accentColor: 'red' }), null, 'a non-hex accent is rejected');
  assert.equal(cleanBackdropText({ text: 'x'.repeat(121), fontFamily: FONT, textColor: '#fff' }), null, 'overlong text is rejected');
  assert.equal(cleanBackdropText({ text: '   ', fontFamily: FONT, textColor: '#fff' }), null, 'empty text is rejected');
  assert.equal(cleanBackdropText(null), null);
  eq(assetBackdropText(bgAsset({ textOverlay: { text: 'Hi', fontFamily: FONT, textColor: '#abc' } })),
    { text: 'Hi', fontFamily: FONT, textColor: '#abc' });
  assert.equal(assetBackdropText(bgAsset({ textOverlay: { text: 'Hi', fontFamily: 'Nope', textColor: '#abc' } })), null, 'a stored spec with an unknown font reads as no layer');
  assert.equal(findSignAsset(baseProject({ assets: [bgAsset({ sign: true })] })).name, 'Backdrop.png');
  assert.equal(signPresent(baseProject({ name: 'New Project', assets: [bgAsset({ sign: true })] })), true, 'flagged sign reads present; the evaluator adds the real-name test');
  console.log('PASS: text-spec validation — catalog font required, hex colors only, length capped, invalid reads as absent.');
}

// --- The text layer renders in all three background render sites -------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert.equal((page.match(/BackdropTextLayer spec=\{assetBackdropText\(bg\)!\}/g) || []).length, 2,
    'the draft preview AND its duplicated preview-panel copy both render the layer (Build Space reuses the same draft overlay)');
  assert(page.includes('overlay={draftOverlay}'), 'Build Space preview is the same draft overlay construction');
  const published = fs.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
  assert.equal((published.match(/BackdropTextLayer spec=\{assetBackdropText\(backgroundAsset\)!\}/g) || []).length, 1,
    'the published overlay renders the layer over its background');
  const layer = fs.readFileSync('components/BackdropText.tsx', 'utf8');
  assert(layer.includes('spec.text') && layer.includes('spec.fontFamily') && layer.includes('document.fonts'),
    'the layer is real DOM text in the chosen font, auto-fitted like the cards');
  console.log('PASS: render presence — workshop draft (×2 copies), Build Space via the shared overlay, published overlay.');
}

// --- Jewel sets the text layer through her draft-edit machinery ---------------
{
  const project = baseProject({ assets: [bgAsset()] });
  const set = applyDraftChanges(project, { assets: [{ storageKey: 'projects/p1/backdrop.png', role: 'background', sign: true, textOverlay: { text: 'Galaxy Talk', fontFamily: FONT, textColor: '#ffd700', accentColor: '#b3123f' } }] });
  eq(set.project.assets[0].textOverlay, { text: 'Galaxy Talk', fontFamily: FONT, textColor: '#ffd700', accentColor: '#b3123f' });
  assert.equal(set.project.assets[0].sign, true);
  const badFont = applyDraftChanges(project, { assets: [{ storageKey: 'projects/p1/backdrop.png', textOverlay: { text: 'X', fontFamily: 'Wingdings', textColor: '#fff' } }] });
  assert.equal(badFont.project.assets[0].textOverlay, undefined, 'an invalid spec is dropped whole, never partially applied');
  const cleared = applyDraftChanges(set.project, { assets: [{ storageKey: 'projects/p1/backdrop.png', textOverlay: null }] });
  assert.equal(cleared.project.assets[0].textOverlay, null, 'null clears the layer');
  const untouched = applyDraftChanges(project, { assets: [{ storageKey: 'projects/p1/backdrop.png', inProject: true }] });
  assert.equal(untouched.project.assets[0].textOverlay, undefined, 'other asset edits leave the layer alone');
  console.log('PASS: draft-edit path — Jewel can set, restyle, and clear the text layer; invalid specs are refused.');
}

// --- The quiz shape: options + correct index, host-side until reveal ---------
{
  const cleaned = cleanTriviaQuestions([
    { question: 'Red planet?', options: ['Venus', 'Mars'], correctIndex: 1, answer: 'WRONG' },
    { question: 'Plain?', answer: 'Yes' },
    { question: 'Broken?', options: ['Only'], correctIndex: 0, answer: 'Only' },
    { question: 'Bad index?', options: ['A', 'B'], correctIndex: 5, answer: 'A' },
  ]);
  assert.equal(cleaned.length, 4);
  eq(cleaned[0].options, ['Venus', 'Mars']);
  assert.equal(cleaned[0].correctIndex, 1);
  assert.equal(cleaned[0].answer, 'Mars', 'the answer is forced to the correct option — one source of truth');
  assert.equal(cleaned[1].options, undefined, 'plain trivia stays plain');
  assert.equal(cleaned[2].options, undefined, 'a one-option "choice" is not a quiz question');
  assert.equal(cleaned[3].options, undefined, 'an out-of-range correctIndex drops the choice set');

  const tool = quizTool();
  eq(quizQuestionsOf(tool).length, 1);
  const cardTool = { id: 'cards-1', type: 'question-card', name: 'Cards', enabled: true, config: { poolId: 'quiz-1' } };
  const pool = questionPool(baseProject({ gameTools: [tool, cardTool] }), cardTool);
  assert.equal(pool.length, 1);
  eq(pool[0].options, ['Venus', 'Mars']);
  assert.equal(pool[0].correctIndex, 1, 'the pool carries the choices and the correct index for the host side');

  const question = pool[0];
  const shown = cardDisplayText(question, 'question');
  assert(shown.includes('A. Venus') && shown.includes('B. Mars'), 'the card shows the question and its lettered choices');
  assert.equal(cardDisplayText(question, 'answer'), 'Mars', 'the reveal shows the answer');

  const state = { version: 1, gameId: 'g', used: [], question, shownAt: 100, revealAt: null, cleared: false };
  const pub = publicCardState(baseProject({ gameTools: [tool, cardTool] }), cardTool, state, 200);
  assert.equal(pub.question.answer, '', 'the audience state blanks the answer before the reveal');
  assert.equal(pub.question.correctIndex, undefined, 'the audience state never carries which choice is correct before the reveal');
  eq(pub.question.options, ['Venus', 'Mars'], 'the choices themselves are public — the audience plays along');
  const revealed = publicCardState(baseProject({ gameTools: [tool, cardTool] }), cardTool, { ...state, revealAt: 150 }, 200);
  assert.equal(revealed.question.answer, 'Mars', 'after the reveal the answer is public');
  assert.equal(revealed.question.correctIndex, 1);

  // Publish scrub (the CCS precedent): the snapshot keeps choices, never correctness.
  const scrubbed = scrubQuizQuestionsForPublish(tool.config.questions);
  assert.equal(scrubbed[0].answer, undefined, 'snapshot drops the answer');
  assert.equal(scrubbed[0].correctIndex, undefined, 'snapshot drops the correct index');
  eq(scrubbed[0].options, ['Venus', 'Mars'], 'snapshot keeps the choices');
  const plainScrub = scrubQuizQuestionsForPublish([{ question: 'Q?', answer: 'A' }]);
  assert.equal(plainScrub[0].answer, 'A', 'plain trivia entries are untouched by the quiz scrub');
  const route = fs.readFileSync('app/api/projects/route.ts', 'utf8');
  assert(route.includes('scrubQuizQuestionsForPublish'), 'the projects route applies the quiz scrub beside the City Crime Scene scrub');
  console.log('PASS: quiz shape — options + correctIndex round-trip, answer forced to the correct option, host-side until reveal, scrubbed from the snapshot.');
}

// --- Jewel creates the quiz and its cards through build changes ---------------
{
  assert(creatableTools.includes('trivia-list') && creatableTools.includes('question-card'), 'Jewel can create quiz lists and card systems');
  const result = applyBuildChanges(baseProject(), {
    newTools: [
      { type: 'trivia-list', name: 'Show Quiz', config: { questions: [{ question: 'Red planet?', options: ['Venus', 'Mars'], correctIndex: 1, answer: 'Mars' }, { question: 'Bad?', options: ['Only'], correctIndex: 0 }] } },
      { type: 'question-card', name: 'Quiz Cards' },
    ],
  });
  const list = result.project.gameTools.find(t => t.type === 'trivia-list');
  assert(list, 'the quiz list was created');
  eq(list.config.questions.length, 1, 'the invalid entry lost its choice set and its missing answer dropped it');
  eq(list.config.questions[0].options, ['Venus', 'Mars']);
  const cards = result.project.gameTools.find(t => t.type === 'question-card');
  assert(cards, 'the card system was created');
  assert.equal(cards.config.poolId, list.id, 'the cards draw from the quiz list created in the same turn');
  assert(result.project.controls.some(c => c.action === `cards.show.${cards.id}`), 'the card system brings its Show control');
  assert(result.project.controls.some(c => c.action === `cards.reveal.${cards.id}`), 'the card system brings its Reveal control');
  assert.equal(stepState(result.project, 'quiz').complete, true, 'a Jewel-built quiz completes the quiz step');
  const edited = applyDraftChanges(result.project, { gameTools: [{ id: list.id, config: { questions: [{ question: 'New?', options: ['X', 'Y'], correctIndex: 0, answer: 'Y' }] } }] });
  const editedList = edited.project.gameTools.find(t => t.id === list.id);
  assert.equal(editedList.config.questions[0].answer, 'X', 'draft edits of a quiz re-run the same cleaner');
  console.log('PASS: build changes — Jewel creates a sanitized quiz list and a wired card system pointed at it.');
}

// --- Research wiring: her context carries the theme; the fact is recorded ----
{
  const route = fs.readFileSync('app/api/jewel/route.ts', 'utf8');
  assert(route.includes('JEWEL_TALKSHOW_ADDENDUM'), 'the Jewel route carries Talk Show guidance');
  assert(route.includes('talkShow ? JEWEL_TALKSHOW_ADDENDUM : ""'), 'the guidance is added only for talk projects');
  assert(route.includes('talkShowContextBlock(body.project)'), 'the route computes the talkShow facts block');
  assert(route.includes('...(talkShow ? { talkShow } : {})'), 'her per-turn context carries the talkShow facts block');
  assert(route.includes('RESEARCH COMPASS'), 'the theme & style is taught as her research compass');
  assert(route.includes('ONLY when the creator asks'), 'she helps with the name only when asked');
  assert(route.includes('NAME & THEME FIRST'), 'Jewel asks for the title + theme first when a talk project lacks them');
  assert(route.includes('Never invent a title or theme'), 'she never invents the title or theme for the creator');
  assert(route.includes('textOverlay'), 'she is taught the text-layer mechanism for the sign');
  assert(route.includes('never ask the image or video generator to render the title'), 'generated lettering is forbidden — the text layer does the lettering');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('recordWorkflowFact({ researched: true })'), 'a completed search records the researched fact');
  const researchAt = page.indexOf('recordWorkflowFact({ researched: true })');
  const evidenceAt = page.indexOf("if(!evidence.results?.length)");
  assert(evidenceAt > -1 && researchAt > evidenceAt, 'the fact is recorded only after the search returned results');
  console.log('PASS: research wiring — theme-compass guidance, talkShow context block, researched fact recorded on real results.');
}

// --- The deck: a hand-arranged record, persisted through the page's save -----
{
  const steps = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  assert(steps.includes('talkDeck: next'), 'the Slides step persists deck changes as the talkDeck record');
  assert(steps.includes('onSaveProject'), 'deck writes go through the page save path handed to the workshop');
  assert(!/controls:/.test(steps), 'the deck step creates no dashboard controls — clickers belong to Set the Stage');
  console.log('PASS: deck — ordered talkDeck record on the project, hand-arranged only, no dashboard controls built.');
}

// --- Banner once, asks fill-only, no generation in the new components ---------
{
  assert.equal(TALK_CREATIVITY_BANNER, 'These are examples, not limits. If you can describe it, Jewel will try to make it happen — this site exists to accommodate your creativity.');
  const files = ['components/TalkshowWorkshop.tsx', 'components/TalkshowSteps.tsx', 'lib/talkshow-path.ts'];
  const occurrences = files.reduce((count, file) => count + (fs.readFileSync(file, 'utf8').match(/accommodate your creativity/g) || []).length, 0);
  assert.equal(occurrences, 1, 'the banner wording lives in exactly one place across the talk files');
  const shell = fs.readFileSync('components/TalkshowWorkshop.tsx', 'utf8');
  assert(shell.includes('{TALK_CREATIVITY_BANNER}'), 'the shell renders the banner once, above the step screens');
  for (const file of ['components/TalkshowWorkshop.tsx', 'components/TalkshowSteps.tsx']) {
    const src = fs.readFileSync(file, 'utf8');
    assert(!src.includes('fetch('), `${file}: no direct network calls`);
    assert(!src.includes('/api/'), `${file}: no API routes referenced`);
    assert(!src.includes('applyBuildChanges') && !src.includes('applyDraftChanges'), `${file}: no change appliers — Jewel is the only generation door`);
    assert(!src.includes('localStorage'), `${file}: no side-channel persistence`);
  }
  assert(shell.includes('onAskJewel') || shell.includes('onAsk'), 'asks route to the Jewel input hand-off');
  assert(backgroundAssets(baseProject({ assets: [bgAsset(), { name: 'x.png', type: 'Image', role: 'layer' }] })).length === 1, 'backgroundAssets counts background-role assets only');
  console.log('PASS: banner exactly once; the new components never fetch, generate, or persist behind Jewel’s back.');
}

// --- Presentation, second half: every step demonstrates, pictured ----------
// After Jessica saw PR #135 live ("a page with a bunch of words on it"), the
// remaining text-shaped pieces were rebuilt to the Gameshow pattern: empty
// projects demonstrate over the site's pictured Talk Show stage, research
// runs as an interactive sample, the YouTube moment is a stage — not a
// framed paragraph — and the deck is pictured tiles, never text rows.
{
  const steps = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  const css = fs.readFileSync('components/talkshow-workshop.css', 'utf8');
  assert(steps.includes('/redesign/kind-talkshow.webp'), 'empty projects demonstrate over the pictured Talk Show stage artwork');
  assert(!steps.includes('tsw-stagefill') && !css.includes('tsw-stagefill'), 'the flat gradient stage void is gone');
  assert(!steps.includes('tsw-ytframe') && !css.includes('tsw-ytframe'), 'the YouTube text frame is gone — the moment renders on a stage visual');
  assert(steps.includes('tsw-ytcenter'), 'the YouTube play medallion centers on the stage');
  assert(steps.includes('Run the sample search'), 'research demonstrates by running a sample search, not by describing one');
  const sample = talkPath.SAMPLE_RESEARCH;
  assert(Array.isArray(sample.findings) && sample.findings.length >= 2, 'the sample answer is findings, revealed by the run');
  for (const finding of sample.findings) assert(finding.text && finding.source, 'every sample finding carries its source');
  assert(steps.includes('tsw-deckstrip') && steps.includes('Example deck'), 'the deck is a pictured tile strip, with a labelled example deck when empty');
  assert(steps.includes('kind: candidate.kind, label: candidate.label, refKey: candidate.refKey'),
    'adding to the deck still writes the same slide shape — the candidate thumbnail never leaks into talkDeck');
  console.log('PASS: presentation, second half — pictured example stage, interactive research, stage YouTube, pictured deck.');
}

// --- The 2026-11-03 fix build: stage names + space purity -------------------
// The reference case is a brand-new Talk Show project started from scratch
// (Jessica, 2026-11-03) — never an existing project's data.
{
  // Fix 1: the stage navigation carries the locked stage names.
  const nav = fs.readFileSync('components/ProjectWorkflowNav.tsx', 'utf8');
  assert(nav.includes('"Imagine and Create", "Set the Stage", "Showtime!"'), 'stage nav labels are the locked stage names');
  assert(!nav.includes('"Workshop", "Build Space", "Publish"'), 'the old stage labels are gone from the nav');

  // Fix 4 at the data level: a from-scratch talk project is seeded with
  // talk pieces only, and the theme given at project start lands in
  // gamePlan.theme.
  const { createProject } = load('lib/project.ts');
  const { applySetupPieces, defaultSetupPieces, setupPiecesForKind } = load('lib/project-kinds.ts');
  eq(setupPiecesForKind('talk').map(p => p.id), ['question-cards', 'video-clips'], 'the talk setup screen offers only talk pieces');
  assert.equal(setupPiecesForKind('gameshow').length, 6, 'gameshow keeps the full setup list');
  eq(defaultSetupPieces('talk'), ['question-cards', 'video-clips'], 'talk defaults are its own two pieces');
  const fresh = applySetupPieces({ ...createProject(''), kind: 'talk', name: 'My Talk Show', gamePlan: { theme: 'cozy faith-and-life chat' } }, defaultSetupPieces('talk'));
  assert(fresh.gameTools.length > 0, 'the from-scratch talk project is seeded with pieces');
  assert(fresh.gameTools.every(t => TALK_TOOL_TYPES.includes(t.type)), `a from-scratch talk project carries talk tools only (got ${[...new Set(fresh.gameTools.map(t => t.type))]})`);
  assert.equal(fresh.gamePlan.theme, 'cozy faith-and-life chat', 'the theme given at project start seeds gamePlan.theme');

  // Fix 4 at the surface level: the talk toolbox shelf and the shared
  // assets panel picture/list talk pieces only; gameshow framing stays
  // for gameshow projects.
  const stepsSrc = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  assert(stepsSrc.includes('TALK_TOOL_TYPES.includes(tool.type)'), 'the talk toolbox shelf filters to talk pieces');
  const panel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
  assert(panel.includes('visibleTools'), 'the assets panel lists a kind-scoped tool set');
  assert(panel.includes('!isTalk && <button type="button" onClick={() => openWorkshopTool("tools")}>'), 'the game-tools gallery button is gameshow-only');
  assert(panel.includes('!isTalk && <div className="detail-block" id="workshop-game-templates"'), 'game templates are not offered inside a talk project');
  assert(panel.includes('title={isTalk ? "Show tools & cards" : "Game tools & cards"}'), 'the tools folder takes talk framing for talk projects');
  const aiPanel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
  assert(aiPanel.includes('project.kind!=="talk"&&<div id="tool-templates"'), 'the pictured tool-template gallery never opens in a talk project');
  assert(aiPanel.includes('project.kind!=="talk"&&<div id="board-templates"'), 'board templates never open in a talk project');

  // Fix 3 refinement: a NEW talk project starts with the ask.
  const flow = fs.readFileSync('app/project/new/flow.tsx', 'utf8');
  assert(flow.includes('the title of your show') && flow.includes('its theme, vibe, or subject'), 'a new talk project starts with the title + theme ask');
  assert(flow.includes('setupPiecesForKind(kindInfo.id)'), 'the setup screen renders the kind’s own pieces');
  assert(flow.includes('project.gamePlan = { ...(project.gamePlan || {}), theme: start.theme }'), 'the theme answer seeds gamePlan.theme at creation');
  console.log('PASS: fix build — locked stage names; from-scratch talk projects seed, picture, and list talk pieces only; the ask comes first.');
}

console.log('talkshow-imagine-create: all assertions passed');
