const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const React = require('react'), { createRoot } = require('react-dom/client');
const { JSDOM } = require(process.env.TTC_DOM_TEST_MODULE || 'jsdom');
const load = require('./load.cjs');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.test' });
global.window = dom.window; global.document = dom.window.document; global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const cache = {};
function component(file) {
  if (cache[file]) return cache[file];
  const exports = {}; cache[file] = exports;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { exports, require: id => {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id);
    if (id.includes('/lib/')) return load('lib/' + path.basename(id) + '.ts');
    if (id === './AssetThumbnail') return { default: ({ asset }) => React.createElement('span', { 'data-preview': asset.name }) };
    if (id.startsWith('.')) return component(path.join(path.dirname(file), id + '.tsx'));
    return require(id);
  }, window: dom.window, document: dom.window.document, console });
  return exports;
}
const Folder = component('components/CollapsibleFolder.tsx').default;
const Media = component('components/AssetFolders.tsx').default;
const Backgrounds = component('components/BackgroundBrowser.tsx').default;
const { groupAssets } = load('lib/asset-folders.ts');
const assets = [
  { name: 'shared.png', type: 'image/png', storageKey: 'a', edits: { zoom: 1.3 }, inProject: true, role: 'background' },
  { name: 'shared.png', type: 'image/png', storageKey: 'b', edits: { opacity: 0.5 } },
  { name: 'Neon intro.mp4', type: 'video/mp4', storageKey: 'video' },
  { name: 'Applause.mp3', type: 'audio/mpeg', storageKey: 'audio' },
  { name: 'Rules.txt', type: 'text/plain', storageKey: 'other' }
];
const original = JSON.stringify(assets), choices = [];
const grouped = groupAssets(assets);
assert.deepEqual([...grouped].map(group => group.kind), ['image', 'video', 'audio', 'other']);
for (const group of grouped) for (const item of group.items) assert.strictEqual(item.asset, assets[item.index]);
const root = createRoot(document.getElementById('root'));
let setSearch;
function Host() {
  const [search, updateSearch] = React.useState(''); setSearch = updateSearch;
  const shown = assets.filter(asset => !search || asset.name.toLowerCase().includes(search.toLowerCase()));
  return React.createElement(Media, { assets: shown, scope: 'test-media', searchKey: search,
    renderAsset: (asset, index) => React.createElement('button', { key: asset.storageKey, onClick: () => choices.push({ asset, index }) }, asset.name) });
}
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === text);
const folderButton = name => document.querySelector(`[data-folder-title="${name}"] > button`);
const expanded = name => folderButton(name).getAttribute('aria-expanded');
async function click(target) { assert(target); await React.act(async () => target.click()); }
async function render(element) { await React.act(async () => root.render(element)); }

(async () => {
  try {
    await render(React.createElement(Host));
    assert.equal(document.querySelectorAll('.asset-folder').length, 4);
    assert([...document.querySelectorAll('.asset-folder-toggle')].every(item => item.getAttribute('aria-expanded') === 'false'));
    assert.equal(document.querySelectorAll('[data-preview]').length, 0);
    await click(folderButton('Images'));
    const imageRegion = document.getElementById(folderButton('Images').getAttribute('aria-controls'));
    assert.equal(imageRegion.hidden, false);
    assert.equal(imageRegion.getAttribute('aria-labelledby'), folderButton('Images').id);
    const imageButtons = [...imageRegion.querySelectorAll('button')];
    assert.equal(imageButtons.length, 2, 'Same-named files must not be deduplicated.');
    await click(imageButtons[1]); assert.strictEqual(choices[0].asset, assets[1]); assert.equal(choices[0].index, 1);
    await click(button('Collapse all media')); assert.equal(expanded('Images'), 'false');
    await click(button('Expand all media')); assert([...document.querySelectorAll('.asset-folder-toggle')].every(item => item.getAttribute('aria-expanded') === 'true'));
    await click(button('Collapse all media'));
    await React.act(async () => setSearch('Neon'));
    assert.equal(expanded('Videos'), 'true'); assert(button('Neon intro.mp4'));
    await click(button('Collapse all media')); assert.equal(expanded('Videos'), 'false', 'Explicit collapse remains possible during search.');
    await React.act(async () => setSearch('Neon intro'));
    assert.equal(expanded('Videos'), 'true', 'Changing the search reveals the matching folder again.');
    await React.act(async () => setSearch(''));
    assert.equal(expanded('Images'), 'false', 'Clearing search restores the manual folder preference.');
    assert.equal(JSON.stringify(assets), original, 'Grouping and folder browsing must never modify asset data.');

    dom.window.sessionStorage.setItem('ttc-folder:restore', 'closed');
    await render(React.createElement(Folder, { key: 'restore', title: 'Restored folder', storageKey: 'restore', defaultOpen: true, bulkAction: { open: true, sequence: 1 } }, 'Asset previews'));
    assert.equal(expanded('Restored folder'), 'false', 'Reopening a parent must not replay a stale expand-all action over the saved manual preference.');

    await render(React.createElement(Folder, { title: 'Persistent editor', storageKey: 'editor', keepMounted: true }, React.createElement('input', { 'aria-label': 'Draft setting', defaultValue: 'original' })));
    const input = document.querySelector('input'); input.value = 'unsaved local setting';
    await click(folderButton('Persistent editor')); await click(folderButton('Persistent editor')); await click(folderButton('Persistent editor'));
    assert.strictEqual(document.querySelector('input'), input); assert.equal(input.value, 'unsaved local setting');
    const storage = Object.getOwnPropertyDescriptor(dom.window, 'sessionStorage');
    Object.defineProperty(dom.window, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    await render(React.createElement(Folder, { title: 'Without storage', storageKey: 'blocked' }, 'Available content'));
    await click(folderButton('Without storage')); assert.equal(expanded('Without storage'), 'true');
    Object.defineProperty(dom.window, 'sessionStorage', storage);

    const project = { id: 'safe-build', assets, gameTools: [
      { id: 'board', name: 'Prize board', type: 'blank-board', enabled: true, inOverlayBuild: false, config: {} },
      { id: 'disabled', name: 'Disabled board', type: 'blank-board', enabled: false, config: {} }
    ] };
    const selected = []; let workshop = 0;
    await render(React.createElement(Backgrounds, { project, onChoose: (...args) => selected.push(args), onWorkshop: () => workshop++ }));
    assert.equal(folderButton('Image backgrounds').getAttribute('aria-expanded'), 'false');
    assert.equal(folderButton('Animated / video backgrounds').getAttribute('aria-expanded'), 'false');
    assert.equal(folderButton('Interactive boards').querySelector('.asset-folder-count').textContent, '1');
    await click(folderButton('Interactive boards')); await click(button('Use as initial board'));
    assert.deepEqual(selected[0], ['board', true]);
    await click(folderButton('Image backgrounds')); await click(button('Use as initial background'));
    assert.deepEqual(selected[1], ['b']);
    await click(button('Create or design in Workshop')); assert.equal(workshop, 1);
    assert.equal(JSON.stringify(assets), original);
    console.log('PASS: stable media identities, accessible collapsed folders, bulk/search precedence, blocked storage, preserved editor state, and original background/board callbacks.');
  } finally { await React.act(async () => root.unmount()); }
})().catch(error => { console.error(error); process.exitCode = 1; });
