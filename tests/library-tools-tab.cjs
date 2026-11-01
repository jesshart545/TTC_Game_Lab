const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

const source = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
const tabList = '[["pictures","Pictures"],["video","Video"],["music","Music & voice"],["sounds","Sound effects"],["tools","Tools"],["features","Features & scenes"],["templates","Templates"],["effects","Effects"]]';
assert(source.includes(tabList), 'Library tabs include Tools between Sound effects and Features & scenes');

const toolsStart = source.indexOf('{libraryFamily==="tools"');
const featuresStart = source.indexOf('{libraryFamily==="features"');
const templatesStart = source.indexOf('{libraryFamily==="templates"');
assert(toolsStart >= 0 && featuresStart > toolsStart && templatesStart > featuresStart, 'Tools content is immediately before Features & scenes content');
const toolsSource = source.slice(toolsStart, featuresStart);
const featuresSource = source.slice(featuresStart, templatesStart);
assert(toolsSource.includes('<div className="library-create-tools"><h4>Create a new tool</h4>'), 'Tools tab contains the create-a-new-tool row');
assert(toolsSource.includes('openAddChoice({kind:"tool",id,name:item.label},e,t)'), 'Tools buttons create the tool, then open the add-choice pop-up where it was clicked');
assert(!featuresSource.includes('library-create-tools'), 'Features & scenes no longer contains the create-tools block');
assert(!featuresSource.includes('Create a new tool'), 'Features & scenes no longer contains the create-a-new-tool heading');
assert.equal((source.match(/library-create-tools/g) || []).length, 1, 'The create-tools block appears exactly once');
assert(source.includes('>Add to overlay</button>'), 'Pop-up offers the simplified "Add to overlay" choice');
assert(source.includes('>Add to dashboard</button>'), 'Pop-up offers the simplified "Add to dashboard" choice');

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><main id="root"></main><div id="root2"></div></body></html>', { url: 'https://example.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function () {};

const React = require('react');
const { createRoot } = require('react-dom/client');

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
        : id === './RuntimeActionLayers' ? { ControlAppearancePreview: () => null }
        : id === './CompositionPlayer' ? { defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60 } }
        : { default: () => null }),
    crypto: require('node:crypto').webcrypto,
    console,
  });
  return exports;
}

const Review = compile('components/DashboardButtonReview.tsx').default;
const BuildSpace = compile('components/BuildSpace.tsx', { './DashboardButtonReview': { default: Review } }).default;
const project = { id: 'library-tools-test', assets: [], assetPools: [], compositions: [], controls: [], overlay: {}, gameTools: [] };
const noop = () => {};

function propsFor(testProject, changes) {
  return {
    project: testProject,
    sequenceRunning: false,
    sequenceError: '',
    cardStates: {},
    onSelect: noop,
    onChange: next => changes.push(next),
    overlay: null,
    onTrigger: noop,
    onWorkshop: noop,
    onStopSequence: noop,
    youtubeOpen: false,
    onOpenYoutube: noop,
    onCloseYoutube: noop,
    onYoutubeCommand: async () => null,
    youtubeState: null,
    youtubeFeedback: null,
    onPublishStep: noop,
    onAddTemplate: noop,
  };
}

(async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  const changes = [];
  await React.act(async () => root.render(React.createElement(BuildSpace, propsFor(project, changes))));

  const tabs = [...container.querySelectorAll('.build-library-tabs [role="tab"]')].map(button => button.textContent);
  assert.deepEqual(tabs, ['Pictures', 'Video', 'Music & voice', 'Sound effects', 'Tools', 'Features & scenes', 'Templates', 'Effects']);

  const clickButton = async (text, scope = container) => {
    const button = [...scope.querySelectorAll('button')].find(candidate => candidate.textContent === text);
    assert(button, `Missing button ${text}`);
    await React.act(async () => button.click());
  };

  await clickButton('Tools');
  const createButtons = [...container.querySelectorAll('.library-create-row button')].map(button => button.textContent);
  assert.deepEqual(createButtons, [
    'Create wheels',
    'Create random pickers',
    'Create coin toss',
    'Create dice',
    'Create plinko',
    'Create higher or lower',
    'Create cliffhanger',
    'Create big wheel',
    'Create timers',
    'Create polls',
    'Create scoreboard',
    'Create prize list',
    'Create tiktok gift guide',
    'Add YouTube search to dashboard',
  ]);

  // Creating a tool opens the pop-up at the click — not the button review — and adds nothing yet.
  await clickButton('Create dice');
  let popup = container.querySelector('.library-add-popup');
  assert(popup, 'Creating a tool from Tools opens the add-choice pop-up');
  assert(!container.querySelector('.dashboard-button-review'), 'Creating a tool from Tools no longer opens DashboardButtonReview');
  assert.equal(popup.querySelector('strong').textContent, 'Dice', 'Pop-up title is the item name');
  assert.deepEqual([...popup.querySelectorAll('button')].map(button => button.textContent).filter(text => text.startsWith('Add to')), ['Add to overlay', 'Add to dashboard'], 'Pop-up offers exactly the two choices');
  assert.equal(changes.length, 0, 'Nothing is added before the user chooses');

  // Dismissing with the close button adds nothing.
  await clickButton('×');
  assert(!container.querySelector('.library-add-popup'), 'Close button dismisses the pop-up');
  assert.equal(changes.length, 0, 'Dismissing the pop-up adds nothing');

  // Choosing "Add to dashboard" wires the button without showing the item.
  await clickButton('Create dice');
  assert(container.querySelector('.library-add-popup'), 'Pop-up reopens for the next create');
  await clickButton('Add to dashboard');
  assert(!container.querySelector('.library-add-popup'), 'Pop-up closes after the choice');
  assert.equal(changes.length, 1, 'Choosing saves the project once');
  const diceTool = changes[0].gameTools.find(tool => tool.type === 'dice');
  assert(diceTool, 'The new dice tool was created');
  assert(changes[0].controls.some(control => control.toolIds?.includes(diceTool.id)), 'The dashboard button is wired to the new tool');
  assert.equal(container.querySelector('.build-stage-toggle [role="tab"][aria-selected="true"]').textContent, 'Dashboard preview', 'Stage follows the choice to the Dashboard preview');

  await clickButton('Features & scenes');
  assert(!container.querySelector('.library-create-tools'), 'Features & scenes does not render the create-tools block');
  assert(![...container.querySelectorAll('button')].some(button => createButtons.includes(button.textContent)), 'Features & scenes does not render any create-tool buttons');
  assert(container.querySelector('.library-grid'), 'Features & scenes still renders its item grid');

  await React.act(async () => root.unmount());

  // Asset path: "Add to overlay" shows the item; "Add to dashboard" wires it without showing it.
  const assetProject = { id: 'library-add-asset-test', assets: [{ name: 'Red star.png', storageKey: 'red-star', type: 'image/png', url: 'https://example.test/red-star.png', inProject: false }], assetPools: [], compositions: [], controls: [], overlay: {}, gameTools: [] };
  const container2 = document.getElementById('root2');
  const root2 = createRoot(container2);
  const changes2 = [];
  await React.act(async () => root2.render(React.createElement(BuildSpace, propsFor(assetProject, changes2))));

  await clickButton('Use this in my game', container2);
  popup = container2.querySelector('.library-add-popup');
  assert(popup, 'Clicking a Library item opens the add-choice pop-up');
  assert.equal(popup.querySelector('strong').textContent, 'Red star.png', 'Pop-up title is the item name');
  assert.equal(changes2.length, 0, 'Nothing is added before the user chooses');

  await clickButton('Add to overlay', container2);
  let saved = changes2[changes2.length - 1];
  assert(saved.controls.some(control => control.action === 'asset.show.red-star'), 'Overlay choice wires the Show button');
  assert(saved.controls.some(control => control.action.startsWith('result.hide.')), 'Overlay choice wires the matching Hide button');
  assert.equal(saved.assets[0].inProject, true, 'Overlay choice puts the item on the overlay');
  assert.equal(container2.querySelector('.build-stage-toggle [role="tab"][aria-selected="true"]').textContent, 'Overlay preview', 'Stage follows the choice to the Overlay preview');

  await clickButton('Use this in my game', container2);
  assert(container2.querySelector('.library-add-popup'), 'Pop-up reopens for the item');
  await clickButton('Add to dashboard', container2);
  saved = changes2[changes2.length - 1];
  assert(saved.controls.some(control => control.action === 'asset.show.red-star'), 'Dashboard choice wires the Show button');
  assert.equal(saved.assets[0].inProject, false, 'Dashboard choice leaves the item off the overlay');

  // Dismissing by clicking away adds nothing.
  await clickButton('Use this in my game', container2);
  assert(container2.querySelector('.library-add-popup'), 'Pop-up opens again');
  const before = changes2.length;
  await React.act(async () => container2.querySelector('.library-add-backdrop').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  assert(!container2.querySelector('.library-add-popup'), 'Clicking away dismisses the pop-up');
  assert.equal(changes2.length, before, 'Clicking away adds nothing');

  await React.act(async () => root2.unmount());
  console.log('PASS: Library renders a Tools tab; creating a tool or using a Library item opens a two-choice pop-up ("Add to overlay" / "Add to dashboard") at the click; overlay wires the buttons and shows the item, dashboard wires without showing, and dismissing adds nothing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
