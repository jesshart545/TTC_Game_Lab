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
assert(toolsSource.includes('reviewCreation("tool",id,t)'), 'Tools buttons keep the existing create-to-review handler');
assert(!featuresSource.includes('library-create-tools'), 'Features & scenes no longer contains the create-tools block');
assert(!featuresSource.includes('Create a new tool'), 'Features & scenes no longer contains the create-a-new-tool heading');
assert.equal((source.match(/library-create-tools/g) || []).length, 1, 'The create-tools block appears exactly once');

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: 'https://example.test' });
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

(async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(BuildSpace, {
    project,
    sequenceRunning: false,
    sequenceError: '',
    cardStates: {},
    onSelect: noop,
    onChange: noop,
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
  })));

  const tabs = [...container.querySelectorAll('.build-library-tabs [role="tab"]')].map(button => button.textContent);
  assert.deepEqual(tabs, ['Pictures', 'Video', 'Music & voice', 'Sound effects', 'Tools', 'Features & scenes', 'Templates', 'Effects']);

  const clickButton = async text => {
    const button = [...container.querySelectorAll('button')].find(candidate => candidate.textContent === text);
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

  await clickButton('Create dice');
  assert(container.querySelector('.dashboard-button-review'), 'Creating a tool from Tools still opens DashboardButtonReview');
  assert(container.querySelector('.dashboard-button-review').textContent.includes('Choose buttons for Dice'));
  await clickButton('Cancel');

  await clickButton('Features & scenes');
  assert(!container.querySelector('.library-create-tools'), 'Features & scenes does not render the create-tools block');
  assert(![...container.querySelectorAll('button')].some(button => createButtons.includes(button.textContent)), 'Features & scenes does not render any create-tool buttons');
  assert(container.querySelector('.library-grid'), 'Features & scenes still renders its item grid');

  await React.act(async () => root.unmount());
  console.log('PASS: Library renders a Tools tab between Sound effects and Features & scenes; all create buttons and YouTube dashboard action live under Tools; creating Dice still opens button review; Features & scenes keeps its grid without the create row.');
})().catch(error => { console.error(error); process.exitCode = 1; });
