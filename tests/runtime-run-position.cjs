const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// A fired run and the project's current control record
// (live-found ghost, 2026-11-04): a run used to render forever at
// the overlayResult its control carried when fired. After a drag
// in the Set the Stage review committed a new overlayResult, the
// already-showing run stayed at the fired position — a stranded
// copy that only a reload cleared. In the DRAFT surfaces a run now
// renders at its control's current record, so the showing copy
// moves with the commit. The PUBLISHED overlay (live) is
// untouched: it keeps the fire-time snapshot exactly.

const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');

const Null = () => null;
function compileRuntime() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('components/RuntimeActionLayers.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const stubs = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    './OverlayAsset': { overlayAssetStyle: () => ({}) },
    '../lib/sequences': { runSequence: async () => {} },
    '../lib/control-connections': { controlConnectionError: () => '' },
    '../lib/board-design': { mediaKind: () => 'image' },
    './ChanceTools': { WheelDisplay: Null, DiceDisplay: Null, CoinDisplay: Null, PlinkoDisplay: Null, HigherLowerDisplay: Null, CliffhangerDisplay: Null, PrizeWheelDisplay: Null },
    './CityCrimeSceneOverlay': { default: Null },
    '../lib/coin-cycle': { nextCoinPhase: () => 'show' },
    '../lib/timer-controls': { timerAction: () => null, timerTransition: () => ({ visible: false }) },
    '../lib/coin-toss': { coinOutcome: () => 'Heads' },
    './BoardDesigner': { BoardSurface: Null },
    './GameInfoTools': { GameInfoOverlay: Null },
    '../lib/game-tools': load('lib/game-tools.ts'),
    './QuestionCards': { default: Null, FittedCard: Null, StyledTimer: Null },
    '../lib/question-cards': load('lib/question-cards.ts'),
    '../lib/tool-style': load('lib/tool-style.ts'),
    './CompositionPlayer': { default: Null, defaultOverlayResult: { x: 0, y: 0, width: 100, height: 100, entrance: 'fade', exit: 'fade', entranceSeconds: 0.3, exitSeconds: 0.3, layer: 10 } },
    './GameToolEditor': { toolStyle: () => ({}), ToolArtwork: Null, overlayToolPlacement: () => ({}) },
  };
  vm.runInNewContext(code, {
    exports,
    require: id => {
      if (stubs[id]) return stubs[id];
      throw new Error('unstubbed import in RuntimeActionLayers harness: ' + id);
    },
    crypto: require('node:crypto').webcrypto,
    window: global.window,
    console,
    setInterval, clearInterval, setTimeout, clearTimeout,
  });
  return exports;
}

function projectWith(overlayResult) {
  return {
    id: 'run-pos-1', name: 'Run Position', kind: 'talk', status: 'Draft', updatedAt: 'now',
    assets: [], assetPools: [], compositions: [],
    gameTools: [{ id: 't1', type: 'trivia-list', name: 'Quiz — Small Habits', enabled: true, inToolbox: true, inOverlayBuild: false, config: { questions: [{ question: 'Which small habit?', answer: 'Making your bed' }] } }],
    controls: [{ id: 'c-quiz', label: 'Quiz — Small Habits', detail: 'Show the quiz', action: 'tool.t1', toolIds: ['t1'], overlayResult }],
    wheel: { segments: [], spinning: false, visible: false, enabled: false, title: '' },
    gamePlan: {},
  };
}
const firedAt = { x: 15, y: 12, width: 70, height: 30, layer: 10, entrance: 'fade', exit: 'fade', entranceSeconds: 0.3, exitSeconds: 0.3 };
const committed = { ...firedAt, x: 30, y: 31 };

(async () => {
  const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: 'https://example.test' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const { default: RuntimeActionLayers, useRuntimeActions } = compileRuntime();
  const api = {};
  function Harness({ project, live }) {
    const runtime = useRuntimeActions(project);
    api.fire = control => { try { runtime.fire(control); } catch { /* the page logs it */ } };
    api.reset = () => runtime.resetGame();
    return React.createElement(RuntimeActionLayers, { runtime, project, live });
  }
  const container = document.getElementById('root');
  const quizSections = () => [...container.querySelectorAll('section[aria-label="Quiz — Small Habits"]')];

  // Draft surface: fire, then commit a new overlayResult (what a
  // stage-review drag writes). The showing run must move to the
  // committed position — one copy, at the new spot, no reload.
  const root = createRoot(container);
  const draftV1 = projectWith(firedAt);
  await React.act(async () => root.render(React.createElement(Harness, { project: draftV1, live: false })));
  await React.act(async () => api.fire(draftV1.controls[0]));
  assert.equal(quizSections().length, 1, 'one quiz run renders after firing');
  assert.equal(quizSections()[0].style.left, '15%', 'the run sits at the fired position');
  assert.equal(quizSections()[0].style.top, '12%', 'the run sits at the fired height');
  const draftV2 = projectWith(committed);
  await React.act(async () => root.render(React.createElement(Harness, { project: draftV2, live: false })));
  assert.equal(quizSections().length, 1, 'still exactly one copy after the commit — no ghost at the fired position');
  assert.equal(quizSections()[0].style.left, '30%', 'the showing run moved to the committed position');
  assert.equal(quizSections()[0].style.top, '31%', 'the showing run moved to the committed height');
  await React.act(async () => { api.reset(); root.unmount(); });

  // Published overlay: the same commit must NOT move a live run —
  // the audience keeps the fire-time snapshot.
  const root2 = createRoot(container);
  const liveV1 = projectWith(firedAt);
  await React.act(async () => root2.render(React.createElement(Harness, { project: liveV1, live: true })));
  await React.act(async () => api.fire(liveV1.controls[0]));
  assert.equal(quizSections().length, 1, 'one quiz run renders on the published overlay');
  const liveV2 = projectWith(committed);
  await React.act(async () => root2.render(React.createElement(Harness, { project: liveV2, live: true })));
  assert.equal(quizSections().length, 1, 'still one copy on the published overlay');
  assert.equal(quizSections()[0].style.left, '15%', 'the published run keeps the fire-time snapshot position');
  assert.equal(quizSections()[0].style.top, '12%', 'the published run keeps the fire-time snapshot height');
  await React.act(async () => { api.reset(); root2.unmount(); });

  console.log('PASS: runtime run position — draft runs follow their control\'s current overlayResult after a commit (one copy, new position); published runs keep the fire-time snapshot.');
})().catch(error => { console.error(error); process.exitCode = 1; });
