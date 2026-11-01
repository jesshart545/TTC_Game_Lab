const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

const source = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
const tabList = '[["pictures","Pictures"],["video","Video"],["music","Music & voice"],["sounds","Sound effects"],["tools","Tools"],["pools","Card pools"],["features","Features & scenes"],["templates","Templates"],["effects","Effects"]]';
assert(source.includes(tabList), 'Library tabs include Card pools between Tools and Features & scenes');

const toolsStart = source.indexOf('{libraryFamily==="tools"');
const poolsStart = source.indexOf('{libraryFamily==="pools"');
const featuresStart = source.indexOf('{libraryFamily==="features"');
const templatesStart = source.indexOf('{libraryFamily==="templates"');
assert(toolsStart >= 0 && poolsStart > toolsStart && featuresStart > poolsStart && templatesStart > featuresStart, 'Tools content is before Card pools content, which is immediately before Features & scenes content');
const poolsSource = source.slice(poolsStart, featuresStart);
assert(poolsSource.includes('poolCreations.map'), 'Card pools tab renders the pool creations as tiles');
assert(poolsSource.includes('onClick={e=>pickCreation(c,e)}'), 'Pool tiles route through the same pickCreation flow as the other families');
assert(poolsSource.includes('No card pools yet — create them in the Workshop.'), 'Card pools tab has the plain empty state');
assert(source.includes('t.type==="card-list"'), 'Pool creations are the card-list tools (the pools made in the Pool and card designer)');
assert(source.includes('v==="question-card"?"pools"'), 'Choosing Question & answer cards in the add guide points the Library at the Card pools tab');
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
const dom = new JSDOM('<!doctype html><html><body><main id="root"></main><div id="root2"></div><div id="root3"></div></body></html>', { url: 'https://example.test' });
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
  assert.deepEqual(tabs, ['Pictures', 'Video', 'Music & voice', 'Sound effects', 'Tools', 'Card pools', 'Features & scenes', 'Templates', 'Effects']);

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

  await clickButton('Card pools');
  assert(container.querySelector('.build-library').textContent.includes('No card pools yet — create them in the Workshop.'), 'Card pools tab shows the empty state when the project has no pools');

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

  // Card pools path: pools are card-list tools. An unconnected pool opens the same
  // two-choice pop-up; a connected pool reads "Set up this item"; pools never render
  // under Features & scenes.
  const poolProject = {
    id: 'library-pools-test', assets: [], assetPools: [], compositions: [], overlay: {},
    gameTools: [
      { id: 'pool-fresh', type: 'card-list', name: 'Fresh Pool', enabled: true, inToolbox: true, inOverlayBuild: false, config: { cards: [{ id: 'card-1', text: 'Alpha', design: {} }], entries: [] } },
      { id: 'pool-song', type: 'card-list', name: 'Song Pool', enabled: true, inToolbox: true, inOverlayBuild: false, config: { cards: [], entries: [] } },
      { id: 'pool-connected', type: 'card-list', name: 'Connected Pool', enabled: true, inToolbox: true, inOverlayBuild: true, config: { cards: [], entries: [] } },
      { id: 'dice-1', type: 'dice', name: 'My Dice', enabled: true, inToolbox: true, inOverlayBuild: false, config: { sides: 6 } },
    ],
    controls: [{ id: 'ctl-pool', label: 'Show Connected Pool', action: 'tool.pool-connected', toolIds: ['pool-connected'], detail: 'Show Connected Pool — stays on the overlay until Hide is pressed' }],
  };
  const container3 = document.getElementById('root3');
  const root3 = createRoot(container3);
  const changes3 = [];
  await React.act(async () => root3.render(React.createElement(BuildSpace, propsFor(poolProject, changes3))));

  const tileFor = (scope, name) => [...scope.querySelectorAll('.library-tile')].find(tile => tile.querySelector('strong')?.textContent === name);
  const clickTileButton = async (scope, name, text) => {
    const tile = tileFor(scope, name);
    assert(tile, `Missing library tile ${name}`);
    const button = [...tile.querySelectorAll('button')].find(candidate => candidate.textContent === text);
    assert(button, `Missing button ${text} on tile ${name}`);
    await React.act(async () => button.click());
  };

  await clickButton('Card pools', container3);
  assert(tileFor(container3, 'Fresh Pool'), 'Card pools tab lists the first pool');
  assert(tileFor(container3, 'Song Pool'), 'Card pools tab lists the second pool');
  assert(tileFor(container3, 'Connected Pool'), 'Card pools tab lists the connected pool');
  assert(!tileFor(container3, 'My Dice'), 'Card pools tab does not list non-pool tools');
  assert.equal(tileFor(container3, 'Fresh Pool').querySelector('small').textContent, 'Ready to set up', 'Unconnected pool reads Ready to set up');
  assert.equal(tileFor(container3, 'Connected Pool').querySelector('small').textContent, 'Controls connected', 'Connected pool reads Controls connected');

  // Overlay choice: pop-up at the click, then the pool is placed on the overlay.
  await clickTileButton(container3, 'Fresh Pool', 'Use this in my game');
  popup = container3.querySelector('.library-add-popup');
  assert(popup, 'Choosing a pool opens the add-choice pop-up');
  assert.equal(popup.querySelector('strong').textContent, 'Fresh Pool', 'Pop-up title is the pool name');
  assert.deepEqual([...popup.querySelectorAll('button')].map(button => button.textContent).filter(text => text.startsWith('Add to')), ['Add to overlay', 'Add to dashboard'], 'Pool pop-up offers exactly the two choices');
  assert.equal(changes3.length, 0, 'Nothing is added before the user chooses');
  await clickButton('Add to overlay', container3);
  let saved3 = changes3[changes3.length - 1];
  assert.equal(saved3.gameTools.find(tool => tool.id === 'pool-fresh').inOverlayBuild, true, 'Overlay choice puts the pool on the overlay');
  assert(saved3.controls.some(control => control.toolIds?.includes('pool-fresh')), 'Overlay choice wires the pool button');
  assert.equal(container3.querySelector('.build-stage-toggle [role="tab"][aria-selected="true"]').textContent, 'Overlay preview', 'Stage follows the pool choice to the Overlay preview');

  // Dashboard choice: button wired, stage follows to the Dashboard preview.
  await clickTileButton(container3, 'Song Pool', 'Use this in my game');
  assert(container3.querySelector('.library-add-popup'), 'Pop-up opens for the next pool');
  await clickButton('Add to dashboard', container3);
  saved3 = changes3[changes3.length - 1];
  assert(saved3.controls.some(control => control.action === 'tool.pool-song' && control.toolIds?.includes('pool-song')), 'Dashboard choice wires the pool button');
  assert.equal(container3.querySelector('.build-stage-toggle [role="tab"][aria-selected="true"]').textContent, 'Dashboard preview', 'Stage follows the pool choice to the Dashboard preview');

  // A connected pool goes to its controls, exactly like the other families.
  await clickTileButton(container3, 'Connected Pool', 'Set up this item');
  assert(container3.textContent.includes('Set up: Connected Pool'), 'Connected pool opens its settings');

  // Pools live in exactly one tab: Features & scenes shows other features, never pools.
  await clickButton('Features & scenes', container3);
  const libraryText = container3.querySelector('.build-library').textContent;
  assert(libraryText.includes('My Dice'), 'Features & scenes still lists its other features');
  assert(!libraryText.includes('Fresh Pool') && !libraryText.includes('Song Pool') && !libraryText.includes('Connected Pool'), 'Features & scenes does not list any pool');

  await React.act(async () => root3.unmount());
  console.log('PASS: Library renders a Tools tab; creating a tool or using a Library item opens a two-choice pop-up ("Add to overlay" / "Add to dashboard") at the click; overlay wires the buttons and shows the item, dashboard wires without showing, and dismissing adds nothing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
