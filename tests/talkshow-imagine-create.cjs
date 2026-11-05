const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

// Talk Show or Classroom "Imagine and Create", FINAL design (Jessica,
// 2026-11-04): there is no guided path on the page. Jewel's conversation
// carries the sequence — background (with the title sign as part of that
// same work, always), opening prompt, then the optional research / quiz /
// media / anything-missed topics — she checks topics off from the
// workflow model's facts and records a skip when the creator declines an
// optional topic. On the page, the movement into Jewel lives inside
// the topic she is on: the background area shows its flat/animated
// examples first, and Jewel's conversation panel stands open directly
// after them — examples → step into Jewel → the shelf where the work
// is stored (components/TalkshowStage.tsx) — storage and demonstration
// for the topic she is on: the creator's real saved work when it
// exists, the honest examples until then — with only the genuine
// manual doors for that topic. The
// backdrop text layer (lib/backdrop-text.ts) is a validated DOM text
// spec, never lettering burned into artwork.

const { evaluateWorkflow, allCreateStepsComplete, validateNavigate } = load('lib/workflow-progress.ts');
const { cleanBackdropText, assetBackdropText, assetPromptText, promptPresent, findSignAsset, signPresent, backgroundAssets } = load('lib/backdrop-text.ts');
const { cleanTriviaQuestions, quizQuestionsOf, scrubQuizQuestionsForPublish } = load('lib/quiz.ts');
const { questionPool, publicCardState, cardDisplayText } = load('lib/question-cards.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');
const { applyBuildChanges, creatableTools } = load('lib/build-edits.ts');
const talkPath = load('lib/talkshow-path.ts');
const { TALK_CREATIVITY_BANNER, TALK_TOOL_TYPES, DEMO_FONTS } = talkPath;
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

// --- Kind gating: Jewel's topic model exists for talk projects only --------
{
  eq(evaluateWorkflow(baseProject()).stages[0].steps.map(s => s.id),
    ['theme', 'background', 'prompt', 'research', 'quiz', 'media', 'missed'],
    'the talk topic model, in Jewel\'s conversation order');
  assert.equal(evaluateWorkflow(baseProject()).stages[0].steps.some(s => s.id === 'sign'), false,
    'sign is NOT a step — the sign and the background always go together');
  // The optional topics are the skippable ones, marked on the model itself.
  for (const id of ['research', 'quiz', 'media', 'missed']) assert.equal(stepState(baseProject(), id).skippable, true, `${id}: skippable in the model`);
  for (const id of ['theme', 'background', 'prompt']) assert.equal(stepState(baseProject(), id).skippable, undefined, `${id}: never skippable`);
  // Other kinds keep their own paths, untouched.
  eq(evaluateWorkflow(baseProject({ kind: 'gameshow' })).stages[0].steps.map(s => s.id),
    ['plan', 'media', 'trivia-cards', 'board', 'tools', 'scenes', 'toolbox']);
  eq(evaluateWorkflow(baseProject({ kind: undefined })).stages[0].steps.map(s => s.id),
    ['plan', 'media', 'tools', 'scenes', 'toolbox']);
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('project.kind === "talk"') && page.includes('<TalkshowStage'), 'the page renders the Talk Show visual stage for talk projects');
  assert(!page.includes('<TalkshowWorkshop'), 'the old guided-path workshop is no longer the page\'s skeleton');
  assert(page.includes('project.kind === "gameshow"') && page.includes('<GameshowStage'), 'the Gameshow light stage renders for gameshow projects');
  console.log('PASS: kind gating — talk projects get Jewel\'s seven-step topic model (no sign step); the gameshow step model is unchanged and its page renders the light stage.');
}

// --- The page's shape: one visual stage, no path skeleton ------------------
// Jessica's correction of the #138 build: checking off and directing are
// Jewel's job, inside her conversation — piling them onto the page as
// area panels, a path row, ask strips and skip buttons confused the user.
{
  const stage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  // None of the guided-path machinery stands on the talk page anymore.
  assert(!stage.includes('gsw-path'), 'no area path row on the stage');
  assert(!stage.includes('TalkStepShell') && !stage.includes('TalkAskStrip'), 'no area panels, no "Make it with Jewel" strips');
  assert(!stage.includes('ChangeList') && !stage.includes('What you can change'), 'no per-area "What you can change" lists');
  assert(!stage.includes('Skip this') && !stage.includes('onSkipStep'), 'no skip buttons on the page — Jewel records skips in conversation');
  assert(!stage.includes('onOpenJewel') && !stage.includes('onAskJewel') && !stage.includes('Open Jewel'), 'no buttons whose job is opening Jewel — she is already there');
  assert(!page.includes('onSkipStep={skipTalkArea}'), 'the page no longer wires a skip button either');
  // The stage is keyed to the workflow model's current talk topic: the
  // first unfinished topic in Jewel's order (theme is a fact, never a
  // topic on the page) — at entry that is the background.
  assert(stage.includes('"background", "prompt", "research", "quiz", "media", "missed"'), 'the stage\'s topics stand in Jewel\'s order, background first');
  assert(stage.includes('!step.complete') && stage.includes('workflow.stages[0]'), 'the stage reads the current topic from the workflow model');
  assert(stage.includes('First let’s decide on a background (flat/animated)'), 'the background topic opens with Jessica\'s own line');
  assert(stage.includes('AnimatedExampleMedia') && stage.includes('ExampleStageMedia'), 'flat and animated examples stand side by side');
  // The animated example legitimately demonstrates an animated backdrop
  // (Jessica, 2026-11-04): a real talk-show set loop — skyline lights,
  // glowing set, drifting light, NO characters. The Jewel-wave character
  // clip is her portrait (it belongs to her avatar), never a backdrop
  // example, and no longer appears anywhere in the talk stage or steps.
  const stepsSrc = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  assert(!stage.includes('jewel-wave') && !stepsSrc.includes('jewel-wave'), 'the character clip is gone from the talk stage and the step library');
  assert(stepsSrc.includes('/redesign/talk-animated-backdrop.mp4'), 'the animated example is the real animated talk-show backdrop loop');
  assert(fs.existsSync('public/redesign/talk-animated-backdrop.mp4'), 'the animated backdrop asset is filed under public/redesign/');
  assert(stage.includes('Example · an animated talk-show backdrop, playing'), 'the animated card is labelled honestly — an animated talk-show backdrop');
  // Only the genuine manual doors for the current topic are controls.
  // The upload-your-own-sign concept is gone ENTIRELY (Jessica,
  // 2026-11-04): there is an area already in place to upload media, so
  // no sign-specific upload path exists anywhere — no block on the
  // stage, no button in the legacy steps, no door in the page's doors
  // object, no intent plumbing in the page's upload handler, and no
  // sign-upload line in Jewel's guidance. Uploads live in the media
  // upload area and the creator's library; Jewel builds the combined
  // background+sign piece, working with already-uploaded media like
  // any other asset.
  assert(!stage.includes('doors.uploadSign'), 'no upload-your-own-sign door on the stage');
  assert(!stage.includes('Upload your own sign') && !stage.includes('Have your own sign?'), 'the standalone sign-upload block is gone from the background topic');
  assert(!stepsSrc.includes('Upload your own sign') && !stepsSrc.includes('Have your own sign?'), 'the legacy steps carry no sign-upload button either');
  assert(!page.includes('signUploadIntent') && !page.includes('uploadSign'), 'the dead sign-upload plumbing is out of the page entirely');
  assert(!fs.readFileSync('lib/talkshow-path.ts', 'utf8').includes('Your own uploaded sign'), 'the legacy change lists offer no sign-upload path');
  assert(stage.includes('doors.applyBackground'), 'background keeps the backdrops shelf');
  assert(stage.includes('doors.uploadMedia'), 'media keeps the upload door');
  assert(stage.includes('doors.openCardEditor') && stage.includes('doors.createQuizCards'), 'quiz/follow-ups keep the card designer door');
  assert(!stage.includes('doors.addYoutube'), 'YouTube is added by Jewel in conversation — no duplicate door on the stage');
  // The movement into Jewel lives inside the topic (Jessica, 2026-11-04):
  // in the background area the flat/animated examples come first, and
  // Jewel's conversation panel stands open directly after them — the
  // eye flows examples → step into Jewel → the backdrops shelf where
  // the work is stored. The panel is NOT parked under the banner or
  // below all the content, and no "Open Jewel" button was added: the
  // panel itself, open and in place after the examples, is the movement.
  const bgAt = stage.indexOf('First let’s decide on a background');
  const bgPanelAt = stage.indexOf('{jewelPanel}', bgAt);
  assert(bgAt > -1 && bgPanelAt > bgAt, 'the conversation panel renders inside the background topic');
  assert(stage.indexOf('AnimatedExampleMedia', bgAt) < bgPanelAt, 'background: the flat/animated examples come before the conversation');
  assert(bgPanelAt < stage.indexOf('Your backdrops', bgAt), 'background: examples → conversation → the backdrops shelf');
  const bannerAt = stage.indexOf('{TALK_CREATIVITY_BANNER}');
  assert(!stage.slice(bannerAt, stage.indexOf('topic === "background"')).includes('{jewelPanel}'),
    'the conversation is not parked between the banner and the topics — it lives inside the current topic');
  assert((stage.match(/\{jewelPanel\}/g) || []).length >= 6, 'her panel stands inside every topic section, after that topic\'s examples');
  assert(page.includes('jewelPanel={jewelPanelElement}'), 'the page hands its one Jewel panel to the talk stage');
  assert(page.includes('talkCreateView || gameshowCreateView || stageReviewView ? null : jewelPanelElement'), 'in the talk create view (and the gameshow create and stage-review views) the grid does not render the panel a second time');
  assert.equal((page.match(/<WorkshopAiPanel/g) || []).length, 1, 'the panel element is built exactly once and placed, never duplicated');
  const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
  assert(panel.includes('hidden={workflowStep===1&&!buildAiOpen&&!stageReview}'), 'the panel can only be hidden in Set the Stage outside the review spaces — in Imagine and Create it stands open by default, and in the review spaces it always stands open');
  // And her presence there is FULL, not a token (Jessica, 2026-11-04):
  // the whole conversation panel — her heading, her greeting and
  // messages, the composer — at the full width of the content column.
  // Never a text link, a side tab, a small chip, or a collapsed strip
  // hiding the way in.
  assert(panel.includes('<CompactConversation') && panel.includes('AI CREATIVE DIRECTOR'),
    'what stands in the topic is Jewel\'s full conversation panel — heading, her messages, the composer — not a launcher');
  assert(!stage.includes('Ask Jewel') && !stage.includes('<details'), 'no side tab, text link, or collapsed strip stands in for her presence in the topic');
  // And Jewel herself is THERE at that entry — in the LANDING
  // PICTURE's own composition (Jessica, 2026-11-04: "Jewel is
  // nowhere near as big as the wand. Jewel is in a small bubble
  // that appears to have come from the tip of the wand — the wand
  // and the sparkles dominate the picture"). The entry is the first
  // Tips card's pictured scene itself (JewelWandScene): the wand
  // picture fills a pictured card, gently floating, twinkling
  // sparkles over it, and her small glowing bubble rides at the
  // wand's tip. PRs #140–#142 stood a lone avatar bubble here
  // instead (a plain 104px bubble with a 46px wand, then the
  // landing bubble alone at 112px with a tiny wand badge) — the
  // opposite composition: Jewel dominant, the wand a speck.
  const sceneAt = stage.indexOf('<JewelWandScene', bgAt);
  assert(sceneAt > bgAt && sceneAt < bgPanelAt, 'the landing wand scene stands in the background area, immediately before the conversation');
  assert(stage.indexOf('AnimatedExampleMedia', bgAt) < sceneAt, 'background: the examples come before the wand scene, the scene before the conversation');
  const bgSection = stage.slice(bgAt, stage.indexOf('Your backdrops', bgAt));
  assert(!bgSection.includes('<JewelAvatar'), 'no lone avatar bubble stands at the entry — the pictured scene replaced it');
  assert(!stage.includes('size={112}') && !stage.includes('size={104}') && !stage.includes('wandSize={46}'), 'the oversized entry treatments are gone: no 112px or 104px entry bubble, no 46px wand');
  const scene = fs.readFileSync('components/JewelWandScene.tsx', 'utf8');
  assert(scene.includes('/redesign/tip-jewel-wand.webp'), 'the scene is the landing picture itself — the wand and the sparkles that introduce her');
  assert(scene.includes('jewel-scene-bubble') && scene.includes('/redesign/jewel-wave.mp4'), 'her small glowing bubble rides on the scene, her waving portrait inside it');
  assert((scene.match(/jewel-scene-sparkle/g) || []).length >= 4, 'the twinkling sparkles stand over the scene as on the landing card');
  assert(scene.includes('import "./jewel-wand-scene.css"'), 'the scene imports its own stylesheet — its styling never depends on a page-level sheet');
  const sceneCss = fs.readFileSync('components/jewel-wand-scene.css', 'utf8');
  assert(sceneCss.includes('width: 112px') && sceneCss.includes('height: 112px') && sceneCss.includes('border: 3px solid #e9c979') && sceneCss.includes('0 0 34px 10px rgba(255, 215, 94, .45)'),
    'the bubble on the scene is the landing bubble at its own size — gold ring and landing glow, value for value (.rd-bubble)');
  assert(sceneCss.includes('@keyframes jewel-scene-bob') && sceneCss.includes('translateY(-7px)') && sceneCss.includes('3.2s'), 'the bubble bobs with the landing motion (rd-bob values)');
  assert(sceneCss.includes('@keyframes jewel-scene-floaty') && sceneCss.includes('translateY(-6px)') && sceneCss.includes('4s'), 'the pictured scene floats gently as the landing card does (rd-floaty values)');
  assert(sceneCss.includes('@keyframes jewel-scene-twinkle') && sceneCss.includes('1.6s'), 'the sparkles twinkle with the landing timing (rd-twinkle values)');
  const avatarSrc = fs.readFileSync('components/JewelAvatar.tsx', 'utf8');
  const avatarCss = fs.readFileSync('components/jewel-avatar.css', 'utf8');
  assert(!avatarSrc.includes('jewel-avatar-landing') && !avatarCss.includes('.jewel-avatar-landing'), 'JewelAvatar\'s landing variant is retired — the entry presentation is the wand scene, not a bigger bubble');
  // The bubble must carry its own box (live bug, 2026-11-04): the avatar
  // is a <span> — an inline box, which IGNORES width/height. In the flex
  // liberty banner the span was blockified and sized fine, but at this
  // entry (a plain block parent) it kept no box at all and the portrait
  // video ballooned to intrinsic size: a giant, ringless, bob-less
  // circle. Three pins keep that from ever coming back: the component
  // imports its own stylesheet, the base rule is display:inline-block,
  // and the critical box (display + explicit size on bubble AND video)
  // is carried inline in the component itself.
  assert(avatarSrc.includes('import "./jewel-avatar.css"'), 'JewelAvatar imports its own stylesheet — its styling no longer depends on a page-level sheet loading');
  const baseRule = avatarCss.slice(avatarCss.indexOf('.jewel-avatar {'), avatarCss.indexOf('}', avatarCss.indexOf('.jewel-avatar {')));
  assert(baseRule.includes('display: inline-block'), 'the .jewel-avatar base rule is display:inline-block — the bubble\'s box cannot depend on a flex parent to blockify it');
  assert(avatarSrc.includes('display: "inline-block"') && avatarSrc.includes('width: size, height: size, display: "block"'),
    'the component carries the critical box inline: display:inline-block on the bubble and an explicit size on the video');
  const talkCss = fs.readFileSync('components/talkshow-workshop.css', 'utf8');
  assert(!talkCss.includes('.jewel-avatar') && !talkCss.includes('jewel-bob'), 'the avatar rules are not in the talk workshop sheet — one home, imported by the component');
  console.log('PASS: page shape — one topic-keyed visual stage; no path row, panels, ask strips, change lists, or skip buttons on the page.');
}

// --- Storage, not a workbench: the stage prefers the real saved work -------
// (Jessica's refinement: any section visible on the page is where the
// work Jewel does in conversation is STORED — the creator's actual
// background, prompt, questions and media; examples only until then.)
{
  const stage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  // Background: their backdrop stands as the hero, title lettered on it —
  // the sign is part of the background piece, shown on it, never apart.
  assert(stage.includes('assetBackdropText(hero)') && stage.includes('Your background — stored here, sign and all'),
    'the stored background is shown with its title lettering on it');
  assert(stage.includes('demoTextSpec(project, null)'), 'until a background exists, the flat example carries the demo lettering — sign and background demonstrated together');
  assert(!stage.includes('SignStep') && !stage.includes('title sign?'), 'no sign step and no follow-on sign question anywhere on the stage');
  // Prompt: their real prompt layer rendered on their real background.
  assert(stage.includes('assetPromptText(target)') && stage.includes('Your opening prompt · '), 'a saved prompt is shown lettered on their own background');
  assert(stage.includes('SAMPLE_PROMPT'), 'until then, the sample prompt demonstrates bubble / frame / plain');
  // Quiz: their saved questions flip; the example quiz only stands in.
  assert(stage.includes('quizQuestionsOf(tool)') && stage.includes('EXAMPLE_QUIZ'), 'the flip cards prefer the saved quiz, examples as fallback');
  // Media: their filed media is the shelf; example tiles only when empty.
  assert(stage.includes('Your media — stored here'), 'filed media is stored on the media shelf');
  assert(stage.includes('Opening sequence') && stage.includes('theme song') && stage.includes('commercial cutscene'),
    'pictured examples — opening sequence & theme song, commercial cutscene — stand in only while the shelf is empty');
  assert(stage.includes('tsw-ytcenter'), 'the YouTube moment is pictured on a backdrop, play medallion centered');
  // Missed: their tools and their hand-arranged deck are what is stored.
  assert(stage.includes('<DeckArranger') && stage.includes('bare'), 'the deck arranger stands on the missed topic, bare of change lists');
  assert(stage.includes('TALK_TOOL_TYPES.includes(tool.type)'), 'the stored tools shelf pictures talk pieces only');
  console.log('PASS: storage — the stage shows the creator\'s real background+sign, prompt, quiz, media, tools and deck; examples only as fallback.');
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

// --- Talk topic evaluators ---------------------------------------------------
{
  // theme: the creation-seeded fact — answered when gamePlan.theme is set.
  assert.equal(stepState(baseProject(), 'theme').complete, false, 'no theme yet');
  assert.equal(stepState(baseProject({ gamePlan: { theme: 'a cozy life talk show' } }), 'theme').complete, true, 'the creation-seeded theme fact is present');
  assert.equal(stepState(baseProject({ gamePlan: { theme: '   ' } }), 'theme').complete, false, 'whitespace is not an answer');
  // background: any background-role asset — the combined background+sign
  // piece. Completion never waits on a separate sign fact.
  assert.equal(stepState(baseProject(), 'background').complete, false);
  assert.equal(stepState(baseProject({ assets: [bgAsset()] }), 'background').complete, true, 'a saved background completes the topic, sign lettering or not');
  assert.equal(stepState(baseProject({ assets: [bgAsset({ sign: true, textOverlay: { text: 'Galaxy Talk', fontFamily: FONT, textColor: '#ffd700' } })] }), 'background').complete, true, 'the lettered backdrop is the same one piece of work');
  assert.equal(stepState(baseProject({ assets: [bgAsset({ name: 'my-sign.png', sign: true })] }), 'background').complete, true, 'an uploaded sign is the combined piece too');
  assert.equal(stepState(baseProject({ assets: [{ name: 'x.png', type: 'Image', role: 'layer' }] }), 'background').complete, false, 'a layer is not a background');
  // prompt: a valid prompt layer on a background.
  assert.equal(stepState(baseProject({ assets: [bgAsset()] }), 'prompt').complete, false, 'a background alone carries no prompt');
  const withPrompt = baseProject({ assets: [bgAsset({ promptOverlay: { text: 'Tonight: habits', fontFamily: FONT, textColor: '#ffffff', presentation: 'bubble' } })] });
  assert.equal(stepState(withPrompt, 'prompt').complete, true, 'the prompt layer is set');
  const badPrompt = baseProject({ assets: [bgAsset({ promptOverlay: { text: 'Tonight', fontFamily: 'Nope', textColor: '#fff' } })] });
  assert.equal(stepState(badPrompt, 'prompt').complete, false, 'an invalid prompt spec reads as absent');
  // research: only the recorded fact completes it.
  assert.equal(stepState(baseProject(), 'research').complete, false);
  assert.equal(stepState(baseProject({ workflowProgress: { researched: true } }), 'research').complete, true, 'Jewel ran a search in this project');
  // quiz: an MCQ saved in a trivia list — plain trivia does not count;
  // the follow-up path (the creator's own question cards) completes it too.
  assert.equal(stepState(baseProject({ gameTools: [quizTool()] }), 'quiz').complete, true);
  const plain = quizTool({ config: { questions: [{ question: 'Q?', answer: 'A' }] } });
  assert.equal(stepState(baseProject({ gameTools: [plain] }), 'quiz').complete, false, 'plain Q&A alone is not a quiz — and no cards draw from it yet');
  assert.equal(stepState(baseProject({ gameTools: [quizTool({ enabled: false })] }), 'quiz').complete, false, 'a disabled quiz does not count');
  const followCards = { id: 'cards-1', type: 'question-card', name: 'Follow-ups', enabled: true, config: { poolId: 'quiz-1' } };
  assert.equal(stepState(baseProject({ gameTools: [plain, followCards] }), 'quiz').complete, true, 'follow-up cards drawing from the list complete the topic');
  // media: filed media beyond the background, or YouTube added.
  assert.equal(stepState(baseProject(), 'media').complete, false);
  assert.equal(stepState(baseProject({ assets: [bgAsset()] }), 'media').complete, false, 'a background alone is not media');
  assert.equal(stepState(baseProject({ assets: [bgAsset(), { name: 'song.mp3', type: 'Audio', storageKey: 'projects/p1/song.mp3', role: 'audio' }] }), 'media').complete, true, 'a filed theme song is media');
  assert.equal(stepState(baseProject({ gameTools: [{ id: 'y1', type: 'youtube', name: 'YouTube', enabled: true, config: {} }] }), 'media').complete, true, 'YouTube added to the dashboard completes media');
  // missed: the review was opened (the recorded toolbox fact).
  assert.equal(stepState(baseProject(), 'missed').complete, false);
  assert.equal(stepState(baseProject({ workflowProgress: { toolboxOpened: true } }), 'missed').complete, true, 'the Anything-we-missed review was opened');
  console.log('PASS: talk evaluators — theme fact, background (the combined piece), prompt layer, research fact, quiz or follow-up cards, media, missed review.');
}

// --- Skips count as complete — and only where skipping is offered -----------
{
  for (const id of ['research', 'quiz', 'media', 'missed']) {
    const state = stepState(baseProject({ workflowProgress: { skipped: [id] } }), id);
    assert.equal(state.complete, true, `${id}: a recorded skip completes the topic`);
    assert.equal(state.skipped, true, `${id}: the state remembers it was a skip, not work done`);
    assert(state.checkLine.includes('skip'), `${id}: Jewel's check-off line says it was skipped, honestly`);
  }
  for (const id of ['theme', 'background', 'prompt']) {
    const state = stepState(baseProject({ workflowProgress: { skipped: [id] } }), id);
    assert.equal(state.complete, false, `${id}: the core topics cannot be skipped into completeness`);
    assert.equal(state.skipped, undefined, `${id}: no skip state leaks onto a core topic`);
  }
  // Jewel records a skip inside her navigate directive (validated against
  // the model); the page applies it through the same client-side record.
  const talk = baseProject();
  eq(validateNavigate(talk, { stage: 0, stepId: 'media', skipStepId: 'quiz' }), { stage: 0, stepId: 'media', skipStepId: 'quiz' }, 'a decline rides the directive to the next topic');
  eq(validateNavigate(talk, { stage: 1, skipStepId: 'missed' }), { stage: 1, skipStepId: 'missed' }, 'the last decline rides along to Set the Stage');
  assert.equal(validateNavigate(talk, { stage: 0, stepId: 'prompt', skipStepId: 'background' }), null, 'a non-skippable topic cannot be skip-recorded');
  assert.equal(validateNavigate(talk, { stage: 0, stepId: 'media', skipStepId: 'sign' }), null, 'there is no sign step to skip');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('if (navigate.skipStepId) skipTalkArea(navigate.skipStepId)'), 'the page records Jewel\'s conversational skip on the project');
  assert(page.includes('skipped: [...(current.skipped || []), stepId]'), 'a skip persists in workflowProgress.skipped');
  // The gate: every topic done or skipped → Imagine and Create is complete.
  const allSkipped = baseProject({ gamePlan: { theme: 'x' }, name: 'Galaxy Talk', assets: [bgAsset({ sign: true, promptOverlay: { text: 'Hi', fontFamily: FONT, textColor: '#fff' } })], workflowProgress: { skipped: ['research', 'quiz', 'media', 'missed'] } });
  assert.equal(allCreateStepsComplete(evaluateWorkflow(allSkipped)), true, 'done-or-skipped everywhere unlocks Set the Stage');
  const oneOpen = baseProject({ gamePlan: { theme: 'x' }, workflowProgress: { skipped: ['research', 'quiz', 'media', 'missed'] } });
  assert.equal(allCreateStepsComplete(evaluateWorkflow(oneOpen)), false, 'a missing background keeps the gate closed');
  console.log('PASS: skips — optional topics complete by skip with an honest skipped flag; core topics never; Jewel records skips by directive; the gate reads done-or-skipped.');
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
  assert.equal(signPresent(baseProject({ name: 'New Project', assets: [bgAsset({ sign: true })] })), true, 'a flagged sign reads present as a backdrop-text fact');
  // The opening prompt's presentation variant rides the same validation.
  eq(cleanBackdropText({ text: 'Talking point', fontFamily: FONT, textColor: '#3b2a63', presentation: 'bubble' }),
    { text: 'Talking point', fontFamily: FONT, textColor: '#3b2a63', presentation: 'bubble' });
  eq(cleanBackdropText({ text: 'Talking point', fontFamily: FONT, textColor: '#ffffff', presentation: 'frame' }).presentation, 'frame');
  assert.equal(cleanBackdropText({ text: 'X', fontFamily: FONT, textColor: '#fff', presentation: 'sparkle' }), null, 'an unknown presentation is rejected whole');
  eq(assetPromptText(bgAsset({ promptOverlay: { text: 'Hi', fontFamily: FONT, textColor: '#abc', presentation: 'plain' } })),
    { text: 'Hi', fontFamily: FONT, textColor: '#abc', presentation: 'plain' });
  assert.equal(assetPromptText(bgAsset({ textOverlay: { text: 'Sign', fontFamily: FONT, textColor: '#abc' } })), null, 'the sign layer is not the prompt layer');
  assert.equal(promptPresent(baseProject({ assets: [bgAsset({ promptOverlay: { text: 'Hi', fontFamily: FONT, textColor: '#abc' } })] })), true);
  console.log('PASS: text-spec validation — catalog font required, hex colors only, length capped, presentation validated, prompt layer reads separately.');
}

// --- The text layer renders in all three background render sites -------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert.equal((page.match(/BackdropTextLayer spec=\{assetBackdropText\(bg\)!\}/g) || []).length, 2,
    'the draft preview AND its duplicated preview-panel copy both render the layer (Build Space reuses the same draft overlay)');
  assert.equal((page.match(/BackdropTextLayer spec=\{assetPromptText\(bg\)!\} placement="lower"/g) || []).length, 2,
    'both preview copies render the opening prompt layer too, low on the background');
  assert(page.includes('overlay={draftOverlay}'), 'Build Space preview is the same draft overlay construction');
  const published = fs.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
  assert.equal((published.match(/BackdropTextLayer spec=\{assetBackdropText\(backgroundAsset\)!\}/g) || []).length, 1,
    'the published overlay renders the layer over its background');
  assert.equal((published.match(/BackdropTextLayer spec=\{assetPromptText\(backgroundAsset\)!\} placement="lower"/g) || []).length, 1,
    'the published overlay renders the opening prompt layer over its background, low');
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
  // The opening prompt layer rides the same validated path, in its own field.
  const promptSet = applyDraftChanges(project, { assets: [{ storageKey: 'projects/p1/backdrop.png', promptOverlay: { text: 'Tonight: habits', fontFamily: FONT, textColor: '#3b2a63', presentation: 'bubble' } }] });
  eq(promptSet.project.assets[0].promptOverlay, { text: 'Tonight: habits', fontFamily: FONT, textColor: '#3b2a63', presentation: 'bubble' });
  assert.equal(promptSet.project.assets[0].textOverlay, undefined, 'setting the prompt never touches the sign layer');
  const promptBad = applyDraftChanges(project, { assets: [{ storageKey: 'projects/p1/backdrop.png', promptOverlay: { text: 'X', fontFamily: FONT, textColor: '#fff', presentation: 'neon' } }] });
  assert.equal(promptBad.project.assets[0].promptOverlay, undefined, 'an invalid prompt spec is dropped whole');
  const promptCleared = applyDraftChanges(promptSet.project, { assets: [{ storageKey: 'projects/p1/backdrop.png', promptOverlay: null }] });
  assert.equal(promptCleared.project.assets[0].promptOverlay, null, 'null clears the prompt layer');
  console.log('PASS: draft-edit path — Jewel can set, restyle, and clear the text layer and the prompt layer; invalid specs are refused.');
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
  assert.equal(stepState(result.project, 'quiz').complete, true, 'a Jewel-built quiz completes the quiz topic');
  const edited = applyDraftChanges(result.project, { gameTools: [{ id: list.id, config: { questions: [{ question: 'New?', options: ['X', 'Y'], correctIndex: 0, answer: 'Y' }] } }] });
  const editedList = edited.project.gameTools.find(t => t.id === list.id);
  assert.equal(editedList.config.questions[0].answer, 'X', 'draft edits of a quiz re-run the same cleaner');
  console.log('PASS: build changes — Jewel creates a sanitized quiz list and a wired card system pointed at it.');
}

// --- Jewel's guidance: the conversation carries the sequence -----------------
{
  const route = fs.readFileSync('app/api/jewel/route.ts', 'utf8');
  assert(route.includes('JEWEL_TALKSHOW_ADDENDUM'), 'the Jewel route carries Talk Show guidance');
  assert(route.includes('talkShow ? JEWEL_TALKSHOW_ADDENDUM : ""'), 'the guidance is added only for talk projects');
  assert(route.includes('talkShowContextBlock(body.project)'), 'the route computes the talkShow facts block');
  assert(route.includes('...(talkShow ? { talkShow } : {})'), 'her per-turn context carries the talkShow facts block');
  assert(route.includes('YOU carry the whole Imagine and Create sequence in this conversation'), 'the sequence lives in her conversation, not on the page');
  assert(route.includes('(a) BACKGROUND, (b) OPENING PROMPT, (c) RESEARCH (optional), (d) QUIZ OR FOLLOW-UP QUESTIONS (optional), (e) MEDIA (optional), (f) ANYTHING WE MISSED? (optional)'), 'her topic order: background first, the four optional topics after the prompt');
  assert(route.includes('were settled when the show was created'), 'title and theme were handled at creation — she never sends the creator back to them');
  assert(route.includes('RESEARCH COMPASS'), 'the theme & style is taught as her research compass');
  assert(route.includes('ONLY when the creator asks'), 'she helps with the name only when asked');
  assert(route.includes('NAME & THEME FIRST'), 'as a backstop for a project that lacks them, she asks for the title + theme first');
  assert(route.includes('Never invent a title or theme'), 'she never invents the title or theme for the creator');
  // The sign and the background always go together (Jessica, ruled and
  // restated 2026-11-04): one combined piece of work inside the
  // background topic — never a separate step, never a follow-on question.
  assert(route.includes('SIGN INCLUDED, ALWAYS'), 'the background topic carries the sign with it');
  assert(route.includes('ONE combined piece of work, always'), 'sign + background are one job');
  assert(route.includes('There is no separate sign step'), 'she is told there is no sign step');
  assert(!route.includes('gently suggest adding the title sign'), 'the old follow-on sign suggestion is gone');
  assert(route.includes('There is no sign upload anywhere') && route.includes('media upload area'),
    'no sign-specific upload path in her guidance either — uploads live in the media upload area and the library, and she works with already-uploaded media like any other asset');
  assert(!route.includes('uploads their own sign') && !route.includes('hand you a sign'), 'the old sign-upload wording is gone from the addendum');
  assert(route.includes('textOverlay'), 'she is taught the text-layer mechanism for the lettering');
  assert(route.includes('never ask the image or video generator to render the title'), 'generated lettering is forbidden — the text layer does the lettering');
  assert(route.includes('promptOverlay'), 'she is taught the opening prompt layer mechanism');
  assert(route.includes('RECORDING A SKIP') && route.includes('"skipStepId"'), 'she records a declined optional topic through her directive');
  assert(route.includes('ASK THE FORK FIRST'), 'she asks quiz-or-follow-ups before building questions');
  assert(route.includes('BASED ON the show\'s opening prompt'), 'follow-up suggestions grow from the initial prompt');
  assert(route.includes('DATA POINTS'), 'research answers are data points with sources');
  assert(route.includes('a skip counts as complete'), 'she knows the optional topics can be skipped, and that it counts');
  assert(route.includes('direct the creator on to Set the Stage'), 'when every topic is done or skipped, she directs them onward');
  assert(route.includes('skippedAreas'), 'her per-turn context carries the skipped topics');
  assert(route.includes('promptSet'), 'her per-turn context carries the opening prompt fact');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('recordWorkflowFact({ researched: true })'), 'a completed search records the researched fact');
  const researchAt = page.indexOf('recordWorkflowFact({ researched: true })');
  const evidenceAt = page.indexOf("if(!evidence.results?.length)");
  assert(evidenceAt > -1 && researchAt > evidenceAt, 'the fact is recorded only after the search returned results');
  console.log('PASS: Jewel\'s guidance — she carries the sequence in conversation, sign inside the background work, skips recorded by directive, research with sources.');
}

// --- The deck: a hand-arranged record, persisted through the page's save -----
{
  const steps = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  assert(steps.includes('talkDeck: next'), 'the deck (stored on the Anything-we-missed topic) persists changes as the talkDeck record');
  assert(steps.includes('onSaveProject'), 'deck writes go through the page save path handed to the stage');
  assert(!/controls:/.test(steps), 'the deck creates no dashboard controls — clickers belong to Set the Stage');
  console.log('PASS: deck — ordered talkDeck record on the project, hand-arranged only, no dashboard controls built.');
}

// --- Banner once; avatar in the banner + at the entry; no self-generation ----
{
  assert.equal(TALK_CREATIVITY_BANNER, 'These are examples, not limits. If you can describe it, Jewel will try to make it happen — this site exists to accommodate your creativity.');
  const files = ['components/TalkshowStage.tsx', 'components/TalkshowSteps.tsx', 'components/TalkshowWorkshop.tsx', 'lib/talkshow-path.ts'];
  const occurrences = files.reduce((count, file) => count + (fs.readFileSync(file, 'utf8').match(/accommodate your creativity/g) || []).length, 0);
  assert.equal(occurrences, 1, 'the banner wording lives in exactly one place across the talk files');
  const stage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  assert(stage.includes('{TALK_CREATIVITY_BANNER}'), 'the stage renders the banner once, above the topic visual');
  // Jewel's avatar and wand stand on the talk page (Jessica,
  // 2026-11-04): the liberty banner's continuity instance (58px,
  // unchanged) — and at the entry into Jewel in the background
  // area, the landing picture's scene itself (JewelWandScene):
  // the wand and the sparkles dominant, her small glowing bubble
  // at the wand's tip. A lone entry bubble (104px, then 112px)
  // was the opposite composition and is gone.
  // Never stamped on every control.
  assert.equal((stage.match(/<JewelAvatar/g) || []).length, 1, 'her avatar bubble stands in the banner only — the entry is the wand scene, not a second bubble');
  assert(stage.includes('<JewelWandScene'), 'the entry into Jewel in the background area is the landing wand scene');
  assert(!fs.readFileSync('components/TalkshowSteps.tsx', 'utf8').includes('JewelAvatar'), 'the avatar is not repeated across the step library');
  const avatar = fs.readFileSync('components/JewelAvatar.tsx', 'utf8');
  assert(avatar.includes('/redesign/jewel-wave.mp4'), 'the avatar is her real waving portrait, the Tips-card artwork');
  assert(avatar.includes('🪄'), 'her magic wand rides with the avatar');
  for (const file of ['components/TalkshowStage.tsx', 'components/TalkshowSteps.tsx']) {
    const src = fs.readFileSync(file, 'utf8');
    assert(!src.includes('fetch('), `${file}: no direct network calls`);
    assert(!src.includes('/api/'), `${file}: no API routes referenced`);
    assert(!src.includes('applyBuildChanges') && !src.includes('applyDraftChanges'), `${file}: no change appliers — Jewel is the only generation door`);
    assert(!src.includes('localStorage'), `${file}: no side-channel persistence`);
  }
  assert(backgroundAssets(baseProject({ assets: [bgAsset(), { name: 'x.png', type: 'Image', role: 'layer' }] })).length === 1, 'backgroundAssets counts background-role assets only');
  console.log('PASS: banner once; avatar in the banner (58px, unchanged) and the landing wand scene at the entry into Jewel; the stage components never fetch, generate, or persist behind Jewel’s back.');
}

// --- Presentation: pictured demonstrations, never a wall of words ------------
// (Jessica, after seeing PR #135 live: "a page with a bunch of words on
// it" fails. Empty projects demonstrate over the site's pictured Talk
// Show stage, research shows its sample findings with sources, the
// YouTube moment is a stage — not a framed paragraph — and the deck is
// pictured tiles, never text rows.)
{
  const stage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  const steps = fs.readFileSync('components/TalkshowSteps.tsx', 'utf8');
  const css = fs.readFileSync('components/talkshow-workshop.css', 'utf8');
  assert(steps.includes('/redesign/kind-talkshow.webp'), 'empty projects demonstrate over the pictured Talk Show stage artwork');
  assert(!steps.includes('tsw-stagefill') && !css.includes('tsw-stagefill'), 'the flat gradient stage void is gone');
  assert(!steps.includes('tsw-ytframe') && !css.includes('tsw-ytframe'), 'the YouTube text frame is gone — the moment renders on a stage visual');
  assert(stage.includes('tsw-ytcenter'), 'the YouTube play medallion centers on the stage');
  // Research on the stage is a demonstration, shown — its sample findings
  // stand with their sources; the interactive run lived on the old area
  // page and is not a control the storage stage carries.
  assert(stage.includes('SAMPLE_RESEARCH.findings'), 'the research topic shows the sample findings, pictured as cards with sources');
  assert(!stage.includes('Run the sample search'), 'no run-the-demo button on the stage — research itself happens in conversation');
  const sample = talkPath.SAMPLE_RESEARCH;
  assert(Array.isArray(sample.findings) && sample.findings.length >= 2, 'the sample answer is findings with sources');
  for (const finding of sample.findings) assert(finding.text && finding.source, 'every sample finding carries its source');
  assert(steps.includes('tsw-deckstrip') && steps.includes('Example deck'), 'the deck is a pictured tile strip, with a labelled example deck when empty');
  assert(steps.includes('kind: candidate.kind, label: candidate.label, refKey: candidate.refKey'),
    'adding to the deck still writes the same slide shape — the candidate thumbnail never leaks into talkDeck');
  console.log('PASS: presentation — pictured example stage, demonstrated research, stage YouTube, pictured deck.');
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

  // Fix 4 at the surface level: the talk storage shelf and the shared
  // assets panel picture/list talk pieces only; gameshow framing stays
  // for gameshow projects.
  const stageSrc = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  assert(stageSrc.includes('TALK_TOOL_TYPES.includes(tool.type)'), 'the talk storage shelf filters to talk pieces');
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

// --- Jessica's layout (2026-11-04): bare top, "Save project", the gate ------
// The bare top she dictated stays; what changed in the final design is
// what stands under it — Jewel's conversation plus the one visual stage,
// not the eight area screens. Reference case remains a from-scratch talk
// project (the Jewel Test Talk Show check) — never another project's data.
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  // The talk-create view exists and drives every frame removal.
  assert(page.includes('const talkCreateView = project.kind === "talk" && workflowStep === 0'), 'the page computes the talk Imagine and Create view');
  // Top of the page: Rename · Save project · Delete only — the Ask Jewel
  // header button, the status span, the kind picker, and the save-status
  // line come off the top in that view (they render for every other view).
  assert(page.includes('{!lightCreateFrame && <span>{project.status}</span>}'), 'the draft-status span leaves the talk top');
  assert(page.includes('const talkBareFrame = talkCreateView || (project.kind === "talk" && stageReviewView)'), 'the bare talk frame covers both the talk create view and talk at Set the Stage');
  assert(page.includes('const lightCreateFrame = talkBareFrame || gameshowCreateView'), 'the light create frame extends the bare top to the gameshow create view — same removals, same "Save project"');
  assert(page.includes('{!lightCreateFrame && <button type="button" className="build-btn ask-jewel-btn"'), 'the Ask Jewel header button leaves the talk top');
  assert(page.includes('{!lightCreateFrame && <small role="status"'), 'the save-status clutter leaves the talk top');
  assert(page.includes('✎ Rename') && page.includes('Delete Project'), 'Rename and Delete Project remain at the top');
  assert(page.includes('lightCreateFrame ? "Save project" : "Save progress"'), 'in the talk top the save button reads exactly "Save project"');
  // No generic frame above the stage: no Brainstorm & create heading
  // block, no Current Task entry guide, no section tab trio (bare nav),
  // and no gameshow-shaped game plan form — the theme was settled at
  // creation and never becomes a page area again.
  assert(page.includes('{!lightCreateFrame && !stageReviewView && <div className="workshop-flow-heading">'), 'the Brainstorm & create heading block leaves the talk view (and the stage-review views)');
  assert(page.includes('entryGuide={talkCreateView || gameshowCreateView || stageReviewView ? undefined :'), 'the Current Task card leaves the talk view (and the stage-review views)');
  assert(page.includes('bare={lightCreateFrame || stageReviewView}'), 'the nav renders bare for the talk views (and the stage-review views) — stage buttons only');
  assert(page.includes('{workflowStep === 0 && project.kind !== "talk" && <details key="game-plan"'), 'the gameshow-shaped game plan form leaves the talk view');
  const stage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  assert(!stage.includes('gamePlan') || !stage.includes('theme: event.target.value'), 'the stage carries no theme editing — theme is a fact from creation');
  assert(!stage.includes('<textarea'), 'the stage carries no typing boxes at all — words are settled in conversation');
  // The gate: Set the Stage and Showtime! lock until every topic is
  // complete (done or skipped); the nav carries the lock state.
  assert(page.includes('lockedStages={project.kind === "talk" && !talkCreateComplete ? [1, 2] : undefined}'), 'the page locks stages 1 and 2 for talk until the topics are complete');
  assert(page.includes('allCreateStepsComplete(evaluateWorkflow(project))'), 'the gate reads the workflow model, done-or-skipped');
  assert(page.includes('Set the Stage unlocks when Jewel has checked off every topic'), 'the lock note names Jewel as the one who checks topics off');
  const nav = fs.readFileSync('components/ProjectWorkflowNav.tsx', 'utf8');
  assert(nav.includes('lockedStages') && nav.includes('disabled={locked.has(index)}'), 'locked stages render disabled in the nav');
  assert(nav.includes('bare') && nav.includes('!bare && stage === 0'), 'bare mode hides the section tab trio');
  console.log('PASS: Jessica\'s layout — bare top with "Save project", no generic frame, no theme area, and the Set the Stage gate intact.');
}

// --- The scene is the doorway; no progress strip on the page ----------------
// (Jessica, 2026-11-04, live review of the #143 build: "there isn't
// anything where that picture is that takes the user to jewel —
// instead it is in an unnecessary area set below where that picture
// is." The chips row and the "Next: … / Go there →" line at the head
// of Jewel's panel were that unnecessary area: check-offs and
// directing are Jewel's, inside her conversation — her permanent
// rule. And the picture itself had no way in: the scene must BE the
// doorway.)
{
  const stage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  const scene = fs.readFileSync('components/JewelWandScene.tsx', 'utf8');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
  // The whole pictured card is one button into Jewel, with the one
  // short label naming the move carried ON the picture.
  assert(scene.includes('<button type="button" className="jewel-scene" onClick={onEnter}'),
    'the wand scene itself is the button — the whole pictured card is the move into Jewel');
  assert(scene.includes('jewel-scene-cta') && scene.includes('Create with Jewel'),
    'one short label on the picture itself names the move: Create with Jewel');
  assert(!scene.includes('aria-hidden'), 'the doorway is not hidden from assistive tech — it is the way in');
  const sceneCss = fs.readFileSync('components/jewel-wand-scene.css', 'utf8');
  assert(sceneCss.includes('button.jewel-scene') && sceneCss.includes('.jewel-scene-cta') && sceneCss.includes(':focus-visible'),
    'the scene stylesheet resets the button chrome, styles the on-picture label, and keeps a visible focus ring');
  // The wiring: stage hands the page's doorway handler to the scene;
  // the page reveals her conversation and lands on her input.
  assert(stage.includes('<JewelWandScene onEnter={onEnterJewel} />'), 'the background stage wires the doorway handler into the scene');
  assert(page.includes('onEnterJewel={enterJewelFromScene}'), 'the page hands its doorway handler to the talk stage');
  assert(page.includes('function enterJewelFromScene()') && page.includes('requestJewelOpen();') && page.includes('focusJewelPrompt();'),
    'stepping in through the picture reveals the conversation and scrolls to + focuses her input');
  const supportClient = fs.readFileSync('lib/support-client.ts', 'utf8');
  assert(supportClient.includes('export function requestJewelOpen()') && supportClient.includes('"ttc-open-jewel"'),
    'requestJewelOpen dispatches the doorway event');
  const conversation = fs.readFileSync('components/CompactConversation.tsx', 'utf8');
  assert(conversation.includes('"ttc-open-jewel"') && conversation.includes('setHidden(false)'),
    'a hidden conversation reveals itself when the doorway fires — the scene works whether the panel was open or collapsed');
  // The page-level progress strip is withheld in the talk create
  // view — and, since the Set the Stage review spaces (2026-11-04),
  // in the gameshow/talk stage-1 review views too: the chips row
  // and the Next/Go-there line no longer render there, while the
  // generic strip survives untouched for every other kind and
  // stage.
  assert(panel.includes('const talkCreateView = project.kind === "talk" && workflowStep === 0'),
    'the panel computes the talk create view to withhold the strip');
  assert(panel.includes('const stripWithheld = talkCreateView || gameshowCreateView || stageReview;') && panel.includes('{!stripWithheld && (()=>{const stageState=workflow.stages[workflowStep];'),
    'the progress strip renders only where it is not withheld (talk create, gameshow create, or the stage-review spaces)');
  assert(panel.includes('jewel-progress') && panel.includes('Next: {nextTask.label}') && panel.includes('Go there →'),
    'the generic progress strip itself is untouched — other kinds keep their chips and Next line');
  assert(panel.includes('<CompactConversation') && panel.includes('AI CREATIVE DIRECTOR'),
    'her conversation — heading, log, composer — stands in the talk view exactly as before');
  // The survey's other catch: the research topic carried its own
  // page-level check-off line. It is gone — whether research is done
  // is Jewel's to say, in conversation.
  assert(!stage.includes('checks this topic off') && !stage.includes('has researched in this project'),
    'no per-topic check-off status line stands on the stage anymore');
  // The model underneath is untouched: topics still complete by work
  // or by skip, and done-or-skipped still opens the gate.
  const gated = baseProject({ gamePlan: { theme: 'x' }, assets: [bgAsset({ promptOverlay: { text: 'Hi', fontFamily: FONT, textColor: '#fff' } })], workflowProgress: { skipped: ['research', 'quiz', 'media', 'missed'] } });
  assert.equal(allCreateStepsComplete(evaluateWorkflow(gated)), true, 'the Set the Stage gate still reads the model, done-or-skipped');
  assert(page.includes('lockedStages={project.kind === "talk" && !talkCreateComplete ? [1, 2] : undefined}'), 'the gate wiring on the page is unchanged');
  console.log('PASS: doorway + strip — the wand scene is the button into Jewel (label on the picture, reveal + focus wired); no chips/Next strip in the talk create view; the generic strip and the workflow gate are untouched.');
}

console.log('talkshow-imagine-create: all assertions passed');
