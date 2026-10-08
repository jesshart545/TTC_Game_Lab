const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require(process.env.TTC_DOM_TEST_MODULE || 'jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');
const load = require('./load.cjs');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function () {};

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

const Nav = component('components/ProjectWorkflowNav.tsx').default;
const BuildSpace = component('components/BuildSpace.tsx', {
  './CompositionPlayer': { defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60 } },
  './RuntimeActionLayers': { ControlAppearancePreview: () => null }
}).default;
const projectAPI = load('lib/project.ts');
const initial = {
  ...projectAPI.createProject('A safe local editor test'),
  id: 'local-review', name: 'Local editor review', assets: [], controls: [], gameTools: [],
  workflow: { stage: 0, workshopStep: 0, promptDraft: '' },
  publishedSnapshot: { marker: 'unchanged-live-version' }
};
const saves = [];
const noOp = () => {};
const runtime = { cardStates: {}, sequenceRunning: false, sequenceError: '', stopSequence: noOp, cardCommand: noOp };
const Workspace = component('app/project/[id]/page.tsx', {
  'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next/navigation': { useParams: () => ({ id: initial.id }) },
  '../../../lib/project': {
    ...projectAPI,
    loadProjectFromServer: async () => structuredClone(initial),
    saveProjectToServer: async (project, publish) => { assert(!publish, 'Navigation must never publish.'); saves.push(project); return { ok: true }; }
  },
  '../../../lib/asset-store': { hydrateProjectAssets: async project => project },
  '../../../components/ProjectWorkflowNav': { default: Nav },
  '../../../components/BuildSpace': { default: BuildSpace },
  '../../../components/RuntimeActionLayers': { default: () => null, useRuntimeActions: () => runtime },
  '../../../components/CompositionPlayer': { default: () => null, defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60 } }
}).default;

const root = createRoot(document.getElementById('root'));
const buttons = () => [...document.querySelectorAll('button')];
const byText = text => buttons().find(button => button.textContent.trim() === text);
function savePreview(name) {
  const directory = process.env.TTC_PREVIEW_DIR;
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  const styles = ['app/globals.css', 'app/feature.css', 'app/project/[id]/workflow.css', 'app/controls.css'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const navigation = ['workshop', 'build', 'publish'].map(page => `<a href="${page}.html">${page}</a>`).join(' · ');
  fs.writeFileSync(path.join(directory, `${name}.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TTCGameLab — design review</title><style>${styles}</style></head><body><div style="padding:16px;background:#112232;color:#dffaff;font-size:14px">Design review with sample data. Editing buttons are illustrative. ${navigation}</div>${document.getElementById('root').innerHTML}</body></html>`);
}
async function click(text) {
  const button = byText(text);
  assert(button, `Expected accessible action: ${text}`);
  assert(!button.disabled, `Editing/navigation action must remain available: ${text}`);
  await React.act(async () => button.click());
}

(async () => {
  try {
    await React.act(async () => root.render(React.createElement(Workspace)));
    assert.equal(document.querySelector('.workshop-flow h1').textContent, 'Brainstorm & create');
    assert.equal(document.querySelectorAll('nav[aria-label="Project stages"] button').length, 3);
    assert.equal(byText('Save progress') != null, true);
    assert.equal(buttons().filter(button => button.textContent === 'Save progress').length, 1);
    assert.deepEqual([...document.querySelectorAll('nav[aria-label="Workshop sections"] button')].map(button => button.textContent), ['Game plan', 'Assets & tools', 'Scenes & effects']);
    assert(document.getElementById('game-title'));
    assert(document.getElementById('game-rules'));
    await click('Assets & tools');
    for (const label of ['Create background artwork', 'Upload background image', 'Upload other assets', 'Generate media', 'Generate trivia', 'Create an interactive game board', 'Create game tools', 'Create list and cards', 'Organize assets & pools', 'Asset Composer']) assert(byText(label), `Preserve editing capability: ${label}`);
    savePreview('workshop');
    await click('2Build Space');
    assert.equal(document.querySelector('.workshop-flow h1').textContent, 'Build & implement');
    assert(document.querySelector('.workshop-next').textContent.includes('rehearse both together'));
    const tasks = document.querySelector('nav[aria-label="Build Space tasks"]');
    assert(tasks);
    assert.deepEqual([...tasks.querySelectorAll('button')].map(button => button.textContent), ['Background', 'Add items', 'Customize', 'Test', 'Review']);
    assert.equal(tasks.querySelectorAll('span').length, 0, 'Local tasks must not be another numbered wizard.');
    savePreview('build');
    await click('Review');
    assert(document.querySelector('[aria-label="Game readiness"]'));
    await click('3Publish');
    assert(document.querySelector('.workshop-next').textContent.includes('overlay and its controlling dashboard together'));
    assert(!document.querySelector('[aria-label="Build Space assembly"]'), 'Publish must not display the assembly editor beneath it.');
    assert(!document.querySelector('nav[aria-label="Build Space tasks"]'));
    assert(!byText('Final stage'), 'Do not show a non-actionable final-stage button.');
    assert(byText('Publish latest changes'));
    savePreview('publish');
    await click('Return to Build Space');
    assert(document.querySelector('[aria-label="Build Space assembly"]'));
    await click('1Workshop');
    await click('Game plan');
    assert(document.getElementById('game-rules'), 'Game-plan editing remains reachable after all stage transitions.');
    assert(saves.length > 0);
    for (const saved of saves) assert.deepEqual(saved.publishedSnapshot, initial.publishedSnapshot);
    console.log('PASS: one numbered stage track, one save action, unnumbered local tasks, focused Publish view, freely reachable editing tools, and unchanged live snapshot.');
  } finally {
    await React.act(async () => root.unmount());
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
