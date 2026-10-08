const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require(process.env.TTC_DOM_TEST_MODULE || 'jsdom');

const rootDir = path.resolve(__dirname, '..');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://asset-library.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const React = require('react');
const { createRoot } = require('react-dom/client');

const clone = value => JSON.parse(JSON.stringify(value));
let database = [
  {
    id: 'alpha', name: 'Duplicate Project', assets: [
      { name: 'Duplicate.png', type: 'image/png', url: 'https://cdn.test/alpha-first.png', storageKey: 'alpha-first' },
      { name: 'Alpha clip.mp4', type: 'video/mp4', url: 'https://cdn.test/alpha-video.mp4', storageKey: 'alpha-video' },
      { name: 'Alpha voice.mp3', type: 'audio/mpeg', url: 'https://cdn.test/alpha-audio.mp3', storageKey: 'alpha-audio' },
      { name: 'Alpha notes.pdf', type: 'application/pdf', storageKey: 'alpha-other' },
      { name: 'Duplicate.png', type: 'image/png', url: 'https://cdn.test/alpha-second.png', storageKey: 'alpha-second' },
      { name: 'Shared Signal.png', type: 'image/png', url: 'https://cdn.test/alpha-shared.png', storageKey: 'alpha-shared' },
    ]
  },
  {
    id: 'bravo', name: 'Duplicate Project', assets: [
      { name: 'Shared Signal.png', type: 'image/png', url: 'https://cdn.test/bravo-shared.png', storageKey: 'bravo-shared' },
      { name: 'Bravo music.wav', type: 'audio/wav', url: 'https://cdn.test/bravo-audio.wav', storageKey: 'bravo-audio' },
    ]
  }
];
const saved = [];
const fetchCalls = [];
async function fakeFetch(input, init = {}) {
  fetchCalls.push({ input: String(input), init });
  assert.equal(String(input), '/api/projects', 'The regression test permits only its fake projects API.');
  assert.equal((init.method || 'GET').toUpperCase(), 'GET', 'Page saves must use the injected fake save API.');
  return { ok: true, json: async () => ({ projects: database.map(data => ({ data: clone(data) })) }) };
}
const projectAPI = {
  saveProjectToServer: async project => {
    const next = clone(project);
    const index = database.findIndex(item => item.id === next.id);
    assert.notEqual(index, -1, 'Saves must target an existing project.');
    database[index] = next;
    saved.push(next);
    return { ok: true };
  }
};
const assetStoreAPI = {
  hydrateProjectAssets: async project => project,
  deleteStoredAsset: async () => {},
  storeUploadedAsset: async () => { throw new Error('The edit-copy upload path is outside this folder regression test.'); }
};
const overrides = {
  'lib/project.ts': projectAPI,
  'lib/asset-store.ts': assetStoreAPI,
};
const moduleCache = new Map();
function resolveFile(request, parentFile) {
  const base = path.resolve(path.dirname(parentFile), request);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${request} from ${parentFile}`);
}
function loadModule(file) {
  const full = path.resolve(file);
  const relative = path.relative(rootDir, full).replaceAll(path.sep, '/');
  if (overrides[relative]) return overrides[relative];
  if (moduleCache.has(full)) return moduleCache.get(full);
  const exports = {};
  moduleCache.set(full, exports);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: request => {
      if (request === 'react' || request === 'react/jsx-runtime') return require(request);
      if (request === 'next/link') return { default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) };
      if (request.startsWith('.')) return loadModule(resolveFile(request, full));
      return require(request);
    },
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    navigator: dom.window.navigator,
    fetch: fakeFetch,
    File: dom.window.File,
    crypto: require('node:crypto').webcrypto,
    requestAnimationFrame: callback => callback(),
    setTimeout,
    clearTimeout,
    console,
    process: { env: {} }
  });
  return exports;
}

const AssetLibraryPage = loadModule(path.join(rootDir, 'app/assets/page.tsx')).default;
const root = createRoot(document.getElementById('root'));
const sections = title => [...document.querySelectorAll('[data-folder-title]')].filter(section => section.getAttribute('data-folder-title') === title);
const toggle = section => section.querySelector(':scope > .asset-folder-toggle');
const buttons = () => [...document.querySelectorAll('button')];
const button = label => buttons().find(item => item.textContent.trim() === label);
const cardNamed = (name, occurrence = 0) => [...document.querySelectorAll('.library-card')].filter(card => card.querySelector('.library-body > strong')?.textContent === name)[occurrence];
async function settle() {
  await React.act(async () => { await Promise.resolve(); await Promise.resolve(); });
}
async function click(element, description) {
  assert(element, `Expected ${description}.`);
  await React.act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
  await settle();
}
async function typeSearch(value) {
  const input = document.querySelector('input[aria-label="Search assets or projects"]');
  assert(input, 'Search must have an accessible label.');
  await React.act(async () => {
    input.focus();
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    setValue.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await Promise.resolve();
  });
  await settle();
}
async function selectValue(select, value) {
  assert(select, 'Expected the card copy control.');
  await React.act(async () => {
    select.value = value;
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await Promise.resolve();
  });
  await settle();
}

(async () => {
  const originalPrompt = dom.window.prompt;
  const originalConfirm = dom.window.confirm;
  try {
    dom.window.prompt = () => 'Renamed original-index-four.png';
    dom.window.confirm = () => true;
    await React.act(async () => root.render(React.createElement(AssetLibraryPage)));
    await settle();

    assert.equal(sections('Duplicate Project').length, 2, 'Projects with duplicate names must remain separate folders keyed by project id.');
    assert.equal(document.querySelectorAll('.library-card').length, 0, 'Project folders must start collapsed without mounting cards.');
    assert(sections('Duplicate Project').every(section => toggle(section).getAttribute('aria-expanded') === 'false'), 'Every project folder starts collapsed.');
    assert.equal(saved.length, 0);

    await click(button('Expand all folders'), 'the expand-all folders control');
    assert(sections('Duplicate Project').every(section => toggle(section).getAttribute('aria-expanded') === 'true'), 'Expand all must open project folders.');
    assert([...document.querySelectorAll('[data-folder-title="Images"] > .asset-folder-toggle')].every(item => item.getAttribute('aria-expanded') === 'true'), 'The shared media folders receive the same bulk expand action.');
    assert.equal(saved.length, 0, 'Expanding folders is a presentation-only action and must not save.');

    await click(button('Collapse all folders'), 'the collapse-all folders control');
    assert(sections('Duplicate Project').every(section => toggle(section).getAttribute('aria-expanded') === 'false'), 'Collapse all must close project folders.');
    assert.equal(document.querySelectorAll('.library-card').length, 0, 'Closed project folders unmount their card grids.');
    assert.equal(saved.length, 0, 'Collapsing folders must never save project data.');

    await click(button('Expand all folders'), 'expand-all after a prior collapse');
    assert.equal(document.querySelectorAll('.library-card').length, 8, 'Repeated expand-all must reopen every media folder, even when parent folders remount.');
    await click(button('Collapse all folders'), 'collapse-all after the repeated expansion');

    await click(toggle(sections('Duplicate Project')[0]), 'the first duplicate-named project folder');
    const images = sections('Images')[0];
    assert.equal(toggle(images).getAttribute('aria-expanded'), 'false', 'Media folders also start collapsed.');
    await click(toggle(images), 'the Images media folder');
    assert.equal(document.querySelectorAll('.library-card').length, 3, 'The image folder renders all matching cards after expansion.');
    const secondDuplicate = cardNamed('Duplicate.png', 1);
    assert(secondDuplicate, 'Duplicate asset names must keep both cards.');
    for (const label of ['+ Add to Project', 'Rename', '✦ Edit / AI Edit', 'Open project to edit', 'Delete asset']) {
      assert([...secondDuplicate.querySelectorAll('button, a')].some(item => item.textContent.trim() === label), `Expanded cards must retain the ${label} action.`);
    }
    assert(secondDuplicate.querySelector('select.library-project-select'), 'Expanded cards must retain copy-to-project controls.');
    assert.equal(saved.length, 0, 'Individual group toggles must never save project data.');

    await click([...secondDuplicate.querySelectorAll('button')].find(item => item.textContent.trim() === 'Rename'), 'rename for the second duplicate');
    const renamedSave = saved.at(-1);
    assert.equal(renamedSave.id, 'alpha', 'Rename must save the source project, not a filtered/card position target.');
    assert.equal(renamedSave.assets[4].name, 'Renamed original-index-four.png', 'Rename must retain the true original assetIndex for duplicate names.');
    assert.equal(renamedSave.assets[0].name, 'Duplicate.png', 'Rename must not alter the first duplicate asset.');

    const renamedCard = cardNamed('Renamed original-index-four.png');
    await selectValue(renamedCard.querySelector('select.library-project-select'), 'bravo');
    const copiedSave = saved.at(-1);
    assert.equal(copiedSave.id, 'bravo', 'Copy must save the selected target project.');
    assert.equal(copiedSave.assets.at(-1).storageKey, 'alpha-second', 'Copy must use the selected source card rather than a filtered media index.');
    assert.equal(copiedSave.assets.at(-1).inProject, false, 'Copied assets retain the existing safe non-preview default.');

    await typeSearch('Shared Signal');
    assert.equal(sections('Duplicate Project').length, 2, 'Search results must retain both duplicate-named project folders.');
    assert(sections('Duplicate Project').every(section => toggle(section).getAttribute('aria-expanded') === 'true'), `Search must auto-expand every matching project folder (got ${sections('Duplicate Project').map(section => toggle(section).getAttribute('aria-expanded')).join(',')}).`);
    assert.equal(sections('Images').length, 2, 'Search results must expose matching media folders in both projects.');
    assert(sections('Images').every(section => toggle(section).getAttribute('aria-expanded') === 'true'), 'Search must auto-expand matching media folders.');
    assert.equal(document.querySelectorAll('.library-card').length, 2, 'Search must show matching cards across projects.');

    await typeSearch('');
    await click(button('Other files'), 'the Other files filter');
    assert.equal(sections('Other files').length, 1, 'The Other files filter must use the shared media category.');
    assert.equal(toggle(sections('Other files')[0]).getAttribute('aria-expanded'), 'true', 'Filtering must auto-expand the matching media folder.');
    assert(document.body.textContent.includes('No preview available for this file'), 'Files without a usable preview must explain the unavailable preview.');
    assert.equal(fetchCalls.every(call => call.input === '/api/projects'), true, 'The test must use only its fake fetch implementation.');
    console.log('PASS: real collapsible project/media folders default closed, retain cards and original indices, search/filter expand matches, and keep copy/rename saves correctly scoped.');
  } finally {
    dom.window.prompt = originalPrompt;
    dom.window.confirm = originalConfirm;
    await React.act(async () => root.unmount());
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
