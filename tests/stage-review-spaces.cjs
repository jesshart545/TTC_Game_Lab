const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// Set the Stage — review spaces (Jessica, 2026-11-04). For gameshow
// and talk at workflowStep 1 the page shows ONLY the overlay review,
// the dashboard review, and Jewel's conversation: the overlay review
// is the published overlay's own draft node, the dashboard review's
// buttons fire through the published runtime, adding/staging/wiring
// happen through Jewel, items drag across the reviews, and the page
// progress strip does not render. Radio/multiplayer keep BuildSpace.
// Existing projects — including legacy-shaped ones saved by older
// code — must open here with every piece of generated media intact,
// and a save round-trip must not drop fields the surface doesn't
// know about.

// ---------- Source contracts ----------
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
const review = fs.readFileSync('components/StageReview.tsx', 'utf8');
const route = fs.readFileSync('app/api/jewel/route.ts', 'utf8');

assert(page.includes('const stageReviewView = workflowStep === 1 && (project.kind === "gameshow" || project.kind === "talk")'),
  'the stage-review view is scoped to gameshow + talk at workflowStep 1');
assert(page.includes('{workflowStep===1 && stageReviewView && <StageReview'), 'the review surface renders for gameshow/talk at stage 1');
assert(page.includes('{workflowStep===1 && !stageReviewView && <BuildSpace'), 'BuildSpace still serves stage 1 for the other kinds (radio/multiplayer untouched)');
assert(page.includes('{!stageReviewView && <WorkshopAssetsPanel'), 'the workshop shelf leaves the stage-review page');
assert(page.includes('workflowStep !== 2 && !stageReviewView && <details className="workshop-help">'), 'the guide details leave the stage-review page');
assert(page.includes('entryGuide={talkCreateView || stageReviewView ? undefined :'), 'the entry guide leaves the stage-review views');
assert(page.includes('stageReview={stageReviewView}'), 'the page passes the review flag to Jewel\'s panel');
assert(page.includes('<StageReview ccssEntitled={ccssEntitled} jewelPanel={jewelPanelElement} onEnterJewel={enterJewelFromScene}'), 'the review surface gets the one Jewel panel and the wand-scene entry');
assert(page.includes('overlay={draftOverlay} onTrigger={trigger}'), 'the review receives the same draft overlay node and trigger the preview uses');

assert(panel.includes('const stripWithheld = talkCreateView || stageReview;'), 'the progress strip is withheld in the review spaces as in talk create');
assert(panel.includes('{!stripWithheld && (()=>{const stageState=workflow.stages[workflowStep];'), 'the strip renders only when not withheld');
assert(panel.includes('hidden={workflowStep===1&&!buildAiOpen&&!stageReview}'), 'in the review spaces Jewel\'s panel is never hidden behind Ask Jewel');
assert(panel.includes('workflowStep===1&&!stageReview&&<button type="button" className="outline-btn"'), 'the Back to Set the Stage button belongs to the old Build Space page, not the review');

// The review surface itself: exactly the three things.
assert(review.includes('<JewelWandScene onEnter={onEnterJewel} />') && review.includes('{jewelPanel}'), 'the conversation begins through the wand scene, the stage-0 way');
assert(review.includes('aria-label="Overlay review"') && review.includes('<BuildOverlayPreview>') && review.includes('{overlay}'), 'the overlay review renders the draft overlay node inside the published preview frame');
assert(review.includes('aria-label="Dashboard review"'), 'the dashboard review is present');
assert(review.includes('onTrigger(c)'), 'pressing a dashboard review button fires it through the page runtime');
assert(review.includes('Reset game') && review.includes('onResetGame(resetWipe)'), 'Reset game stays on the dashboard as the approved fixed control');
assert(!review.includes('DashboardActionPicker') && !review.includes('DashboardSequenceEditor'), 'no manual wiring editors on this page — wiring is Jewel\'s job');
assert(review.includes('QuestionCardEditor') && review.includes('GameToolEditor') && review.includes('FontPicker'), 'the existing in-place editors are preserved in the inspector');
assert(review.includes('stage-review.css'), 'the surface carries its own stylesheet');

// Drag and drop lives here: drag boxes persist through the placement
// model; dashboard drags reorder through the shared helper.
assert(review.includes('movePlacement') && review.includes('resizePlacement') && review.includes('normalizePlacement'), 'overlay drags go through the placement model');
assert(review.includes('edits: { ...a.edits, placement }'), 'an asset drag persists to edits.placement');
assert(review.includes('config: { ...') && review.includes('placement }'), 'a tool drag persists to config.placement');
assert(review.includes('overlayResult: { ...(control.overlayResult || defaultOverlayResult), ...placement }'), 'a control-result drag persists to overlayResult');
assert(review.includes('reorderVisibleControls'), 'dashboard drag-reorder writes through the shared helper');
assert(review.includes('Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6'), 'a movement threshold keeps drag and click-to-fire apart');
assert(review.includes('suppressClick'), 'a completed drag never also fires the button');

// Talk's deck is visible and stageable at this stage (it was orphaned).
assert(review.includes('deckMomentStaged(project, slide)'), 'the deck shelf reads the shared staged definition');
assert(review.includes('Ask Jewel to stage this') && review.includes('onAskJewel'), 'an unstaged moment can be handed to Jewel from the shelf');
assert(review.includes('Your opening scene'), 'sign/backdrop moments read as the opening scene, not as clickers');

// Jewel's stage-1 instruction: place, wire, move, rename, remove —
// and the talk deck rules, including never connecting the sign.
assert(route.includes('JEWEL_STAGE_REVIEW_ADDENDUM'), 'the route carries the stage-review instruction');
assert(route.includes('body.workspaceStage === "build" && (body.project?.kind === "gameshow" || body.project?.kind === "talk")'), 'the instruction is scoped to gameshow/talk at the build stage');
assert(route.includes('deckMoments'), 'Jewel\'s talk context lists the deck moments with staged flags');
assert(route.includes('NEVER connect the sign or backdrop asset as a button'), 'Jewel is told never to connect the sign/backdrop (it would strip the background)');
console.log('PASS: source contracts — review surface scope, three surfaces only, strip withheld, drag persistence paths, deck shelf, Jewel stage-1 instruction.');

// ---------- lib/stage-review behavior ----------
const { reorderVisibleControls, deckMomentStaged, deckSlideCreation } = load('lib/stage-review.ts');
{
  const a = { id: 'a' }, b = { id: 'b', sequenceOnly: true }, c = { id: 'c' }, d = { id: 'd' };
  const controls = [a, b, c, d];
  const out = reorderVisibleControls(controls, ['d', 'a', 'c']);
  assert.deepEqual(out.map(x => x.id), ['d', 'b', 'a', 'c'], 'visible buttons reorder; the sequenceOnly step keeps its slot');
  assert.equal(out[1], b, 'hidden controls keep their object identity — nothing rebuilt or stripped');
  assert.equal(out.length, 4, 'no control is created or dropped by a reorder');
}
{
  const project = {
    assets: [
      { name: 'Backdrop.png', storageKey: 'bg1', role: 'background', inProject: true },
      { name: 'Clip.mp4', storageKey: 'clip1', role: 'media', inProject: true },
    ],
    controls: [{ id: 'c1', action: 'asset.show.clip1' }],
    gameTools: [{ id: 'quiz1', type: 'question-card' }],
    compositions: [],
  };
  assert.equal(deckMomentStaged(project, { id: 's1', kind: 'backdrop', label: 'Backdrop', refKey: 'bg1' }), true, 'the current background backdrop is staged by definition');
  assert.equal(deckMomentStaged(project, { id: 's2', kind: 'sign', label: 'Sign', refKey: 'other' }), false, 'a sign that is not the background and has no control is not staged');
  assert.equal(deckMomentStaged(project, { id: 's3', kind: 'media', label: 'Clip', refKey: 'clip1' }), true, 'a media moment with a clicker is staged');
  assert.equal(deckMomentStaged(project, { id: 's4', kind: 'quiz', label: 'Quiz', refKey: 'quiz1' }), false, 'a quiz moment without a clicker is not staged');
  assert.equal(deckSlideCreation({ id: 's5', kind: 'sign', label: 'Sign', refKey: 'x' }), null, 'sign moments never map to a clicker creation');
  const quizCreation = deckSlideCreation({ id: 's6', kind: 'quiz', label: 'Q', refKey: 'quiz1' });
  assert(quizCreation && quizCreation.kind === 'tool' && quizCreation.id === 'quiz1' && quizCreation.name === 'Q', 'quiz moments map to their tool');
}
console.log('PASS: lib behavior — reorder preserves hidden controls; deck staged definition holds.');

// ---------- jsdom: a LEGACY project through the new surface ----------
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');

function freshDom() {
  const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: 'https://example.test' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLElement.prototype.setPointerCapture = function () {};
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  return dom;
}
function compile(file, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: id => id === 'react' ? React
      : id === 'react/jsx-runtime' ? require(id)
      : deps[id]
      || (id.startsWith('../lib/') ? load('lib/' + path.basename(id) + '.ts')
        : id === './CompositionPlayer' ? { defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60, layer: 20 } }
        : id === './RuntimeActionLayers' ? { ControlAppearancePreview: () => null }
        : id === './BuildOverlayPreview' ? { default: ({ children }) => React.createElement('div', { className: 'bop' }, children) }
        : id === './JewelWandScene' ? { default: ({ onEnter }) => React.createElement('button', { className: 'wand-stub', onClick: onEnter }, 'wand') }
        : id.endsWith('.css') ? {}
        : { default: () => null }),
    crypto: require('node:crypto').webcrypto,
    window: global.window,
    console,
  });
  return exports;
}

// A project saved by OLD code: no workflowProgress, no talkDeck,
// default-era controls (including TRIGGER EFFECT, whose action the
// current runtime only flashes for), an unknown legacy field on the
// project and on a control, media in older shapes.
function legacyProject() {
  return {
    id: 'legacy-1', name: 'Legacy Show', kind: 'gameshow', status: 'Draft', updatedAt: 'long ago',
    legacyEra: { oldFlag: true, note: 'from the default-seeded era' },
    overlay: {},
    assets: [
      { name: 'Stage.png', storageKey: 'projects/legacy/stage.png', url: 'https://example.test/stage.png', type: 'image/png', role: 'background', inProject: true },
      { name: 'Winner.gif', storageKey: 'projects/legacy/winner.gif', url: 'https://example.test/winner.gif', type: 'image/gif', role: 'media', inProject: true, edits: { placement: { x: 10, y: 12, width: 30, height: 30 } } },
      { name: 'Theme.mp3', storageKey: 'projects/legacy/theme.mp3', url: 'https://example.test/theme.mp3', type: 'audio/mpeg', role: 'media', inProject: false },
    ],
    assetPools: [],
    compositions: [{ id: 'comp1', name: 'Winner Package', inProject: true, clips: [] }],
    gameTools: [
      { id: 'wheel1', type: 'wheel', name: 'Prize Wheel', enabled: true, inToolbox: true, inOverlayBuild: false, config: { segments: ['A', 'B'] } },
      { id: 'yt1', type: 'youtube', name: 'YouTube', enabled: true, inToolbox: false, inOverlayBuild: false, config: {} },
    ],
    controls: [
      { id: 'c-winner', label: 'SHOW WINNER', detail: 'Show winner result', action: 'asset.show.projects/legacy/winner.gif' },
      { id: 'c-alert', label: 'TEST ALERT', detail: 'Show test alert', action: 'alert.show' },
      { id: 'c-effect', label: 'TRIGGER EFFECT', detail: 'Trigger effect', action: 'effect.trigger', legacyButton: 'kept' },
      { id: 'c-comp', label: 'WINNER PACKAGE', detail: 'Play composition', action: 'composition.play.comp1', compositionId: 'comp1' },
      { id: 'c-hidden', label: 'HIDDEN STEP', detail: 'Sequence step', action: 'asset.show.projects/legacy/winner.gif', sequenceOnly: true },
    ],
    wheel: { segments: [], spinning: false, visible: false },
    gamePlan: {},
  };
}

(async () => {
  const dom = freshDom();
  const StageReview = compile('components/StageReview.tsx').default;
  const project = legacyProject();
  const changes = [];
  const fired = [];
  const container = document.getElementById('root');
  const root = createRoot(container);
  const noop = () => {};
  // The harness plays the page's role: every save is fed back as the
  // new project prop, exactly as persist() does on the real page.
  const renderWith = p => root.render(React.createElement(StageReview, {
    jewelPanel: React.createElement('div', { className: 'jewel-stub' }, 'Jewel conversation'),
    onEnterJewel: noop, onAskJewel: noop,
    sequenceRunning: false, sequenceError: '', onStopSequence: noop, onResetGame: noop,
    cardStates: {}, onSelect: noop, focusControl: null,
    project: p, onChange: next => changes.push(next),
    overlay: React.createElement('div', { className: 'draft-overlay-stub' }, 'overlay'),
    onTrigger: control => fired.push(control),
    onWorkshop: noop,
    youtubeOpen: false, onOpenYoutube: noop, onCloseYoutube: noop,
    onYoutubeCommand: async () => null, youtubeState: null, youtubeFeedback: null,
    dashboardExtras: () => null, feedback: '',
  }));
  await React.act(async () => renderWith(project));

  // Only the three surfaces render.
  assert(container.querySelector('.wand-stub'), 'the wand doorway renders');
  assert(container.querySelector('.jewel-stub'), 'Jewel\'s conversation renders on the page');
  assert(container.querySelector('[aria-label="Overlay review"]'), 'the overlay review renders');
  assert(container.querySelector('[aria-label="Dashboard review"]'), 'the dashboard review renders');
  assert(!container.querySelector('.build-space') && !container.querySelector('.workshop-assets'), 'no Build Space workbench, no workshop shelf');

  // Every legacy control stays on the dashboard — including TRIGGER
  // EFFECT — and the hidden sequence step stays hidden, as published.
  const labels = [...container.querySelectorAll('.sr-buttonwrap > button:first-child')].map(b => b.textContent);
  for (const label of ['SHOW WINNER', 'TEST ALERT', 'TRIGGER EFFECT', 'WINNER PACKAGE'])
    assert(labels.some(t => t.includes(label)), `legacy control ${label} is present on the dashboard review`);
  assert(!labels.some(t => t.includes('HIDDEN STEP')), 'sequenceOnly steps stay off the dashboard, exactly as published');
  // The placed legacy asset gets a drag frame on the overlay review.
  assert([...container.querySelectorAll('.sr-dragbox-move')].some(b => (b.getAttribute('aria-label') || '').includes('Winner.gif')), 'the placed legacy asset is draggable in the overlay review');

  // A press fires — even the legacy no-handler control is handed to
  // the same runtime path, exactly as it behaves today.
  const effectButton = [...container.querySelectorAll('.sr-buttonwrap > button:first-child')].find(b => b.textContent.includes('TRIGGER EFFECT'));
  await React.act(async () => effectButton.click());
  assert(fired.some(c => c.id === 'c-effect'), 'TRIGGER EFFECT stays present and fires through the runtime like any control — not deleted, not "fixed"');
  const winnerButton = [...container.querySelectorAll('.sr-buttonwrap > button:first-child')].find(b => b.textContent.includes('SHOW WINNER'));
  await React.act(async () => winnerButton.click());
  assert(fired.some(c => c.id === 'c-winner'), 'a wired legacy control fires');

  // Dashboard drag-to-reorder: stub the buttons' geometry, press the
  // first button, carry it past the third, release. The drag must
  // reorder (through onChange) and must NOT fire the button.
  const wraps = [...container.querySelectorAll('.sr-buttonwrap > button:first-child')];
  wraps.forEach((el, i) => { el.getBoundingClientRect = () => ({ left: 0, right: 300, top: i * 50, bottom: i * 50 + 40, width: 300, height: 40 }); });
  const firedBeforeDrag = fired.length, changesBeforeDrag = changes.length;
  const pointer = (type, y) => new dom.window.MouseEvent(type, { bubbles: true, clientX: 100, clientY: y });
  await React.act(async () => {
    wraps[0].dispatchEvent(pointer('pointerdown', 10));
    wraps[0].dispatchEvent(pointer('pointermove', 130));
    wraps[0].dispatchEvent(pointer('pointerup', 130));
    wraps[0].dispatchEvent(pointer('click', 130));
  });
  assert.equal(fired.length, firedBeforeDrag, 'a completed drag does not also fire the button');
  assert(changes.length > changesBeforeDrag, 'the drag saves a new order');
  const reordered = changes[changes.length - 1];
  assert.deepEqual(reordered.controls.map(c => c.id), ['c-alert', 'c-effect', 'c-winner', 'c-comp', 'c-hidden'],
    'the dragged button lands in its new slot; the hidden sequence step keeps its place at the end');
  await React.act(async () => renderWith(reordered));

  // Save round-trip through an in-place edit: select the placed
  // asset on the overlay review (a press that does not move selects
  // it), then use its media-fit editor.
  const dragLayer = container.querySelector('.sr-draglayer');
  dragLayer.getBoundingClientRect = () => ({ left: 0, right: 960, top: 0, bottom: 540, width: 960, height: 540 });
  const assetBox = [...container.querySelectorAll('.sr-dragbox-move')].find(b => (b.getAttribute('aria-label') || '').includes('Winner.gif'));
  await React.act(async () => {
    assetBox.dispatchEvent(pointer('pointerdown', 100));
    assetBox.dispatchEvent(pointer('pointerup', 100));
  });
  const fitButton = [...container.querySelectorAll('.sr-inspector button')].find(b => b.textContent === 'Show full media');
  assert(fitButton, 'selecting the placed asset opens its in-place editors');
  await React.act(async () => fitButton.click());
  const saved = changes[changes.length - 1];
  const savedAsset = saved.assets.find(a => a.storageKey === 'projects/legacy/winner.gif');
  assert.equal(savedAsset.edits.fit, 'contain', 'the in-place edit landed');
  assert.equal(savedAsset.url, 'https://example.test/winner.gif', 'the edited asset keeps its media');
  assert.deepEqual(saved.assets.map(a => a.storageKey), project.assets.map(a => a.storageKey), 'every asset survives the round-trip');
  assert.deepEqual(saved.gameTools.map(t => t.id), project.gameTools.map(t => t.id), 'every tool survives the round-trip');
  assert.deepEqual(saved.compositions.map(c => c.id), ['comp1'], 'the composition survives the round-trip');
  assert.deepEqual(saved.controls.map(c => c.id), reordered.controls.map(c => c.id), 'every control survives, including the hidden step');
  assert.deepEqual(saved.legacyEra, project.legacyEra, 'unknown legacy fields pass through untouched');
  assert.equal(saved.controls.find(c => c.id === 'c-effect').legacyButton, 'kept', 'unknown fields on a control pass through untouched');
  assert(!('talkDeck' in saved) && !('workflowProgress' in saved), 'the surface invents no fields the legacy project never had');
  await React.act(async () => root.unmount());
  console.log('PASS: legacy gameshow project — all controls (incl. TRIGGER EFFECT) present and firing, placed media draggable, save round-trip preserves every asset/tool/composition/control and unknown fields.');

  // Talk: the deck is on the staging page, staged state honest.
  const dom2 = freshDom();
  const talkProject = {
    ...legacyProject(), id: 'talk-legacy', kind: 'talk', name: 'Legacy Talk',
    talkDeck: [
      { id: 'd1', kind: 'backdrop', label: 'Opening backdrop', refKey: 'projects/legacy/stage.png' },
      { id: 'd2', kind: 'media', label: 'Winner clip', refKey: 'projects/legacy/winner.gif' },
      { id: 'd3', kind: 'quiz', label: 'Warm-up quiz', refKey: 'quiz-missing' },
    ],
  };
  const asked = [];
  const root2 = createRoot(container);
  await React.act(async () => root2.render(React.createElement(StageReview, {
    jewelPanel: React.createElement('div', { className: 'jewel-stub' }, 'Jewel conversation'),
    onEnterJewel: noop, onAskJewel: text => asked.push(text),
    sequenceRunning: false, sequenceError: '', onStopSequence: noop, onResetGame: noop,
    cardStates: {}, onSelect: noop, focusControl: null,
    project: talkProject, onChange: noop,
    overlay: React.createElement('div', null, 'overlay'),
    onTrigger: noop, onWorkshop: noop,
    youtubeOpen: false, onOpenYoutube: noop, onCloseYoutube: noop,
    onYoutubeCommand: async () => null, youtubeState: null, youtubeFeedback: null,
    dashboardExtras: () => null, feedback: '',
  })));
  const slides = [...container.querySelectorAll('.sr-slide')];
  assert.equal(slides.length, 3, 'all three deck moments render at Set the Stage');
  assert(slides[0].textContent.includes('Your opening scene'), 'the backdrop moment reads as the opening scene (it is the current background)');
  assert(slides[1].textContent.includes('On your dashboard'), 'the media moment with an existing clicker reads staged');
  assert(slides[2].textContent.includes('Not staged yet'), 'the quiz moment without a clicker reads unstaged');
  const askBtn = slides[2].querySelector('.sr-stage-ask');
  assert(askBtn, 'the unstaged moment offers the Jewel ask');
  await React.act(async () => askBtn.click());
  assert(asked.length === 1 && asked[0].includes('Warm-up quiz'), 'the ask hands the moment to Jewel by name');
  await React.act(async () => root2.unmount());
  console.log('PASS: talk deck at Set the Stage — moments visible in order, staged state honest, unstaged moments go to Jewel.');
  console.log('PASS: stage review spaces — the three surfaces, legacy survival, and the talk deck.');
})().catch(error => { console.error(error); process.exitCode = 1; });
