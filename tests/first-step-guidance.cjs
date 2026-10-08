const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require(process.env.TTC_DOM_TEST_MODULE || 'jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://first-step.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
function moduleFrom(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require, window: dom.window, console });
  return exports;
}
const Guide = moduleFrom('components/WorkflowEntryGuide.tsx').default;
const { readEntryStages, rememberEntryStages, hasExistingEntryAction } = moduleFrom('lib/first-step-guidance.ts');
const project = { id: 'safe-local', name: 'New LIVE Experience', assets: [], gameTools: [], controls: [], gamePlan: {} };
const original = JSON.stringify(project);
assert.equal(hasExistingEntryAction(project, 0), false, 'A blank project title alone must not skip the first step.');
assert.equal(hasExistingEntryAction(project, 1), false);
assert.equal(hasExistingEntryAction(project, 2), false);
assert.equal(hasExistingEntryAction({ ...project, gamePlan: { theme: 'A music quiz' } }, 0), true);
assert.equal(hasExistingEntryAction({ ...project, assets: [{ name: 'Background', inProject: true, role: 'background' }] }, 1), true);
assert.equal(hasExistingEntryAction({ ...project, gameTools: [{ enabled: true, inOverlayBuild: true, type: 'blank-board' }] }, 1), true);
assert.equal(hasExistingEntryAction({ ...project, publishedSnapshot: { existing: true } }, 2), true);
assert.equal(JSON.stringify(project), original, 'Detecting prior entry actions must not modify a draft.');
rememberEntryStages('one', { 0: true, 1: false });
assert.equal(readEntryStages('one')[0], true);
assert.equal(readEntryStages('one')[1], false);
assert.equal(Object.keys(readEntryStages('two')).length, 0, 'Guide preferences must be per-project.');
dom.window.sessionStorage.setItem('ttc-entry-guide:broken', 'not-json');
assert.equal(Object.keys(readEntryStages('broken')).length, 0);
dom.window.sessionStorage.setItem('ttc-entry-guide:bad-shape', '[true,false]');
assert.equal(Object.keys(readEntryStages('bad-shape')).length, 0);
dom.window.sessionStorage.setItem('ttc-entry-guide:validated', '{"0":true,"1":"yes","9":true}');
assert.deepEqual(Object.keys(readEntryStages('validated')), ['0']);
const storagePrototype = dom.window.Storage.prototype;
const getItem = storagePrototype.getItem, setItem = storagePrototype.setItem;
try {
  storagePrototype.getItem = storagePrototype.setItem = () => { throw new Error('Storage blocked'); };
  assert.equal(Object.keys(readEntryStages('blocked')).length, 0);
  assert.doesNotThrow(() => rememberEntryStages('blocked', { 2: true }));
} finally { storagePrototype.getItem = getItem; storagePrototype.setItem = setItem; }
let entries = 0, choices = 0;
function Harness() {
  const [started, setStarted] = React.useState(false);
  return React.createElement(Guide, {
    stage: 'Workshop', started,
    firstTitle: 'Describe your game idea', firstDescription: 'Start with a name and one sentence.',
    firstAction: { label: 'Start my game plan', onClick: () => { entries++; setStarted(true); } },
    nextQuestion: 'What would you like to create?', nextDescription: 'Finish your current work, then choose a piece.',
    nextActions: [{ label: 'Create a background', onClick: () => choices++ }],
    onShowFirst: () => setStarted(false),
  });
}
const root = createRoot(document.getElementById('root'));
const byText = text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text);
(async () => {
  try {
    await React.act(async () => root.render(React.createElement(Harness)));
    assert.equal(document.querySelector('[data-entry-phase]').getAttribute('data-entry-phase'), 'first');
    assert.equal(document.querySelector('.entry-guide-kicker').textContent.includes('START HERE'), true);
    assert(!document.querySelector('[aria-label="What next actions"]'));
    assert.equal(document.querySelectorAll('[data-entry-phase] button').length, 1, 'The first view must have one obvious primary action.');
    await React.act(async () => byText('Start my game plan').click());
    assert.equal(entries, 1);
    assert.equal(document.querySelector('[data-entry-phase]').getAttribute('data-entry-phase'), 'next');
    assert(document.querySelector('[aria-label="What next actions"]'));
    assert.equal(document.querySelector('.entry-guide-options').open, false);
    assert.equal(document.querySelectorAll('[data-entry-phase] .build-btn').length, 1, 'There is exactly one visually primary follow-up action.');
    await React.act(async () => byText('Create a background').click());
    assert.equal(choices, 1, 'Follow-up choices must invoke actual supplied action callbacks.');
    await React.act(async () => { document.querySelector('.entry-guide-options').open = true; });
    await React.act(async () => byText('Show the first step').click());
    assert(!document.querySelector('[aria-label="What next actions"]'));
    assert.equal(entries, 1, 'Replaying the guide must not automatically perform any action.');
    assert.equal(JSON.stringify(project), original);
    console.log('PASS: one obvious first action, next questions only after entry, working follow-ups, replay, per-project/stage preferences, blocked storage, and no false completion or project mutation.');
  } finally { await React.act(async () => root.unmount()); }
})().catch(error => { console.error(error); process.exitCode = 1; });
