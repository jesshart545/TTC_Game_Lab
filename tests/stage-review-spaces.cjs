const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// Set the Stage — review spaces (Jessica, 2026-11-04). For gameshow
// and talk at workflowStep 1 the page shows ONLY Jewel's conversation
// at the top and, immediately past her, the overlay and dashboard
// reviews sharing ONE spot on a toggle: the overlay review is the
// published overlay's own draft node, the dashboard review's buttons
// fire through the published runtime (including while the Overlay
// side is toggled away), adding/staging/wiring happen through Jewel,
// items drag across the reviews, and the page progress strip does
// not render. Radio/multiplayer keep BuildSpace.
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
assert(page.includes('{!talkBareFrame && !stageReviewView && <div className="workshop-flow-heading">'), 'the flow heading leaves the stage-review page — nothing pushes the surface down');
assert(page.includes('bare={talkBareFrame || stageReviewView}'), 'the stage nav renders bare (stage buttons only) in the review view — no explanatory note stacked above the surface');
assert(page.includes('{!stageReviewView && mediaPlayback &&'), 'the video-trim notice leaves the stage-review page');
assert(page.includes('{!stageReviewView && Boolean(project.pendingVideos?.length)'), 'pending-video blocks cannot sit above the review surface');
assert(page.includes('{!stageReviewView && backgroundDestinationKey&&'), 'the background-destination editor leaves the stage-review page');
assert(!page.includes('onEnterJewel={enterJewelFromScene} onAskJewel'), 'the page no longer hands the review surface a deck-shelf ask — deck staging goes through Jewel\'s conversation');
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
assert(!review.includes('sr-inspector') && !review.includes('Selected item settings') && !review.includes('sr-editbtn'), 'no inspector or editor panels on this page — selecting an item opens nothing; editing goes through Jewel');
assert(!review.includes('QuestionCardEditor') && !review.includes('GameToolEditor') && !review.includes('FontPicker') && !review.includes('CountdownDuration') && !review.includes('YouTubePlacementEditor'), 'no in-place editor components are mounted on the staging page (they live on in their own surfaces)');
assert(review.includes('setSelection({ kind: "control", id: c.id });'), 'firing a dashboard button points the overlay review at its result — its drag frame waits on the Overlay side');
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

// Card tools: the drag must write the placement the card renderer
// actually reads. FittedCard positions a card from its DESIGN
// geometry (config.questionCard / config.answerCard), never from
// config.placement or a control's overlayResult — a drag that wrote
// only those two moved the generic preview in-session and snapped
// back on reload (and the "card" vanished with the preview). The
// review now frames a card control at its design placement, writes
// the design on commit, and the appearance preview renders the real
// FittedCard for card tools.
assert(review.includes('cardDesignPlacement') && review.includes('withCardDesignPlacement') && review.includes('isCardTool'), 'the review drags card tools by their design placement and writes the design on commit');
const runtimeLayers = fs.readFileSync('components/RuntimeActionLayers.tsx', 'utf8');
assert(runtimeLayers.includes('isCardTool(tool)') && runtimeLayers.includes('<FittedCard'), 'the appearance preview renders the real fitted card for card tools, not the generic overlayResult run');

// ONE spot, on a toggle, immediately past Jewel — and the talk
// deck shelf is GONE from this page: staging deck moments happens
// through Jewel's conversation (her route context below keeps the
// deck), never through page furniture.
assert(review.indexOf('stage-review-jewel') >= 0 && review.indexOf('stage-review-jewel') < review.indexOf('stage-review-spot'), 'Jewel comes first; the review spot follows immediately');
assert(review.includes('role="tablist"') && review.includes('setReviewSide("overlay")') && review.includes('setReviewSide("dashboard")'), 'one toggle switches the two reviews in the same spot');
assert(review.includes('reviewSide === "overlay" ? ('), 'only one review side renders at a time');
assert(review.includes('body.dataset.stageReview'), 'the surface flags the page while mounted so the global Ask Jewel launcher leaves');
assert(!review.includes('sr-deck') && !review.includes('Your deck') && !review.includes('Ask Jewel to stage this') && !review.includes('deckMomentStaged(project, slide)'), 'the talk deck shelf is removed from the staging page');
assert(!review.includes('sr-hint') && !review.includes('stage-review-main'), 'no trailing hint, no stacked second column — the spot is the spot');
const reviewCss = fs.readFileSync('components/stage-review.css', 'utf8');
assert(!reviewCss.includes('.sr-inspector') && !reviewCss.includes('.sr-editbtn'), 'the stylesheet carries no inspector or edit-button furniture either');
assert(reviewCss.includes('body[data-stage-review="true"] .ttc-support-root'), 'the stylesheet hides the global Ask Jewel launcher while this page is mounted');
assert(reviewCss.includes('.sr-review-toggle') && reviewCss.includes('.stage-review-spot'), 'the toggle and the one review spot carry their own styling');

// Jewel's stage-1 instruction: place, wire, move, rename, remove —
// and the talk deck rules, including never connecting the sign.
assert(route.includes('JEWEL_STAGE_REVIEW_ADDENDUM'), 'the route carries the stage-review instruction');
assert(route.includes('body.workspaceStage === "build" && (body.project?.kind === "gameshow" || body.project?.kind === "talk")'), 'the instruction is scoped to gameshow/talk at the build stage');
assert(route.includes('deckMoments'), 'Jewel\'s talk context lists the deck moments with staged flags');
assert(route.includes('NEVER connect the sign or backdrop asset as a button'), 'Jewel is told never to connect the sign/backdrop (it would strip the background)');
console.log('PASS: source contracts — review surface scope, Jewel plus one toggled review spot, strip withheld, drag persistence paths, deck shelf removed, Jewel stage-1 instruction.');

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

// ---------- lib/question-cards: the card placement the renderer reads ----------
const { cardDesignPlacement, withCardDesignPlacement, isCardTool } = load('lib/question-cards.ts');
{
  const bare = { id: 'q1', type: 'question-card', config: {} };
  assert.deepEqual({ ...cardDesignPlacement(bare) }, { x: 17.5, y: 30, width: 65, height: 25 }, 'a card with no saved design sits at the renderer\'s own defaults');
  const designed = {
    id: 'q2', type: 'question-card',
    config: {
      placement: { x: 1, y: 2, width: 30, height: 30 },
      questionCard: { x: 10, y: 12, width: 50, height: 22, fontFamily: 'Georgia, serif', marginLeft: 5, marginTop: 6 },
      answerCard: { x: 10, y: 12, width: 50, height: 22, backgroundColor: '#123456' },
    },
  };
  assert.deepEqual({ ...cardDesignPlacement(designed) }, { x: 10, y: 12, width: 50, height: 22 }, 'the design placement wins over config.placement — it is what FittedCard reads');
  const moved = withCardDesignPlacement(designed, { x: 40, y: 44, width: 55, height: 26 });
  assert.deepEqual({ ...cardDesignPlacement(moved) }, { x: 40, y: 44, width: 55, height: 26 }, 'a drag commit lands in the design the renderer reads');
  assert.equal(moved.config.answerCard.x, 40, 'the answer design moves with the question design — one card, two faces');
  assert.equal(moved.config.questionCard.fontFamily, 'Georgia, serif', 'other design fields are preserved untouched');
  assert.equal(moved.config.answerCard.backgroundColor, '#123456', 'the answer design keeps its own look');
  assert.equal(moved.config.questionCard.marginLeft, 0, 'edge margins are zeroed so the dragged placement lands exactly (the card editor\'s own drag does the same)');
  assert.equal(isCardTool(designed), true, 'question-card is a card tool');
  assert.equal(isCardTool({ type: 'blank-card' }), true, 'blank-card is a card tool');
  assert.equal(isCardTool({ type: 'wheel' }), false, 'other tools keep the placement path they already had');
}
console.log('PASS: lib behavior — card design placement is the drag source and target for card tools.');

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
    onEnterJewel: noop,
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

  // Jewel first, then ONE review spot on its toggle: the Overlay
  // side shows first; the Dashboard side is one flip away, in the
  // same spot — never both at once, never stacked down the page.
  assert(container.querySelector('.wand-stub'), 'the wand doorway renders');
  assert(container.querySelector('.jewel-stub'), 'Jewel\'s conversation renders on the page');
  const toggleButtons = [...container.querySelectorAll('.sr-review-toggle button')];
  assert.deepEqual(toggleButtons.map(b => b.textContent), ['Overlay', 'Dashboard'], 'the toggle offers exactly the two reviews');
  assert(container.querySelector('[aria-label="Overlay review"]'), 'the overlay review renders first in the spot');
  assert(!container.querySelector('[aria-label="Dashboard review"]'), 'the dashboard review does not render until toggled to — one spot, one side at a time');
  assert.equal(document.body.dataset.stageReview, 'true', 'the global Ask Jewel launcher is flagged off while this page is mounted');
  assert(!container.querySelector('.sr-deck') && !container.querySelector('.build-space') && !container.querySelector('.workshop-assets'), 'no deck shelf, no Build Space workbench, no workshop shelf');
  await React.act(async () => toggleButtons[1].click());
  assert(container.querySelector('[aria-label="Dashboard review"]'), 'the dashboard review renders in the same spot after the flip');
  assert(!container.querySelector('[aria-label="Overlay review"]'), 'the overlay review leaves the spot while the dashboard shows — dashboard presses below land on the shared runtime with the Overlay side toggled away');

  // Every legacy control stays on the dashboard — including TRIGGER
  // EFFECT — and the hidden sequence step stays hidden, as published.
  const labels = [...container.querySelectorAll('.sr-buttonwrap > button:first-child')].map(b => b.textContent);
  for (const label of ['SHOW WINNER', 'TEST ALERT', 'TRIGGER EFFECT', 'WINNER PACKAGE'])
    assert(labels.some(t => t.includes(label)), `legacy control ${label} is present on the dashboard review`);
  assert(!labels.some(t => t.includes('HIDDEN STEP')), 'sequenceOnly steps stay off the dashboard, exactly as published');

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

  // Flip back to the Overlay side for the drag round-trip.
  const overlayToggle = [...container.querySelectorAll('.sr-review-toggle button')].find(b => b.textContent === 'Overlay');
  await React.act(async () => overlayToggle.click());
  assert(container.querySelector('[aria-label="Overlay review"]'), 'the overlay review returns to the same spot');
  assert([...container.querySelectorAll('.sr-dragbox-move')].some(b => (b.getAttribute('aria-label') || '').includes('Winner.gif')), 'the placed legacy asset is draggable in the overlay review');

  // Selecting the placed asset (a press that does not move) opens
  // NOTHING — no inspector, no editor panel; editing is Jewel's.
  const dragLayer = container.querySelector('.sr-draglayer');
  dragLayer.getBoundingClientRect = () => ({ left: 0, right: 960, top: 0, bottom: 540, width: 960, height: 540 });
  const assetBox = [...container.querySelectorAll('.sr-dragbox-move')].find(b => (b.getAttribute('aria-label') || '').includes('Winner.gif'));
  await React.act(async () => {
    assetBox.dispatchEvent(pointer('pointerdown', 100));
    assetBox.dispatchEvent(pointer('pointerup', 100));
  });
  assert(!container.querySelector('.sr-inspector') && !container.textContent.includes('Selected item settings'), 'selecting an item opens no page furniture');

  // Save round-trip through a real drag of the placed asset: press,
  // carry it +10% / +10% of the canvas, release — the commit writes
  // edits.placement through the same save the page persists.
  const changesBeforeAssetDrag = changes.length;
  const dragPointer = (type, x, y) => new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  await React.act(async () => {
    assetBox.dispatchEvent(dragPointer('pointerdown', 100, 100));
    assetBox.dispatchEvent(dragPointer('pointermove', 196, 154));
    assetBox.dispatchEvent(dragPointer('pointerup', 196, 154));
  });
  assert(changes.length > changesBeforeAssetDrag, 'the asset drag saves');
  const saved = changes[changes.length - 1];
  const savedAsset = saved.assets.find(a => a.storageKey === 'projects/legacy/winner.gif');
  assert(Math.abs(savedAsset.edits.placement.x - 20) < 0.01 && Math.abs(savedAsset.edits.placement.y - 22) < 0.01,
    `the drag moved the asset's placement from (10, 12) to (20, 22) — got (${savedAsset.edits.placement.x}, ${savedAsset.edits.placement.y})`);
  assert.equal(savedAsset.url, 'https://example.test/winner.gif', 'the dragged asset keeps its media');
  assert.deepEqual(saved.assets.map(a => a.storageKey), project.assets.map(a => a.storageKey), 'every asset survives the round-trip');
  assert.deepEqual(saved.gameTools.map(t => t.id), project.gameTools.map(t => t.id), 'every tool survives the round-trip');
  assert.deepEqual(saved.compositions.map(c => c.id), ['comp1'], 'the composition survives the round-trip');
  assert.deepEqual(saved.controls.map(c => c.id), reordered.controls.map(c => c.id), 'every control survives, including the hidden step');
  assert.deepEqual(saved.legacyEra, project.legacyEra, 'unknown legacy fields pass through untouched');
  assert.equal(saved.controls.find(c => c.id === 'c-effect').legacyButton, 'kept', 'unknown fields on a control pass through untouched');
  assert(!('talkDeck' in saved) && !('workflowProgress' in saved), 'the surface invents no fields the legacy project never had');
  await React.act(async () => root.unmount());
  assert.equal(document.body.dataset.stageReview, undefined, 'the launcher flag clears when the surface unmounts');
  console.log('PASS: legacy gameshow project — all controls (incl. TRIGGER EFFECT) present and firing, placed media draggable, save round-trip preserves every asset/tool/composition/control and unknown fields.');

  // Talk: NO deck shelf on this page. The deck lives in Jewel's
  // conversation context (the route contracts above), not in page
  // furniture — the talk staging page is Jewel plus the one toggled
  // review spot, exactly like gameshow.
  const dom2 = freshDom();
  const talkProject = {
    ...legacyProject(), id: 'talk-legacy', kind: 'talk', name: 'Legacy Talk',
    talkDeck: [
      { id: 'd1', kind: 'backdrop', label: 'Opening backdrop', refKey: 'projects/legacy/stage.png' },
      { id: 'd2', kind: 'media', label: 'Winner clip', refKey: 'projects/legacy/winner.gif' },
      { id: 'd3', kind: 'quiz', label: 'Warm-up quiz', refKey: 'quiz-missing' },
    ],
  };
  const root2 = createRoot(container);
  await React.act(async () => root2.render(React.createElement(StageReview, {
    jewelPanel: React.createElement('div', { className: 'jewel-stub' }, 'Jewel conversation'),
    onEnterJewel: noop,
    sequenceRunning: false, sequenceError: '', onStopSequence: noop, onResetGame: noop,
    cardStates: {}, onSelect: noop, focusControl: null,
    project: talkProject, onChange: noop,
    overlay: React.createElement('div', null, 'overlay'),
    onTrigger: noop, onWorkshop: noop,
    youtubeOpen: false, onOpenYoutube: noop, onCloseYoutube: noop,
    onYoutubeCommand: async () => null, youtubeState: null, youtubeFeedback: null,
    dashboardExtras: () => null, feedback: '',
  })));
  assert(!container.querySelector('.sr-deck') && !container.querySelector('.sr-slide'), 'no deck shelf renders for a talk project at Set the Stage');
  assert(!container.textContent.includes('Your deck'), 'the deck is not page furniture here');
  assert(container.querySelector('.jewel-stub') && container.querySelector('[aria-label="Overlay review"]'), 'the talk staging page is Jewel plus the toggled review spot');
  assert.deepEqual([...container.querySelectorAll('.sr-review-toggle button')].map(b => b.textContent), ['Overlay', 'Dashboard'], 'the talk review spot carries the same toggle');
  assert.equal(container.ownerDocument.body.dataset.stageReview, 'true', 'the launcher stays flagged off on the talk staging page');
  await React.act(async () => root2.unmount());
  console.log('PASS: talk at Set the Stage — no deck shelf; Jewel and the toggled review spot only.');
  console.log('PASS: stage review spaces — Jewel plus one toggled review spot, and legacy survival.');
})().catch(error => { console.error(error); process.exitCode = 1; });
