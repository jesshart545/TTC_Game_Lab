const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// --- CSS contract: the Library panel is height-capped and only its content area scrolls ---
const css = fs.readFileSync('app/project/[id]/workflow.css', 'utf8');
function ruleBody(selector) {
  // Base rules start at the beginning of a line; this skips scoped overrides
  // such as ".build-space-compact .build-library{...}" inside media queries.
  const start = css.indexOf('\n' + selector + '{');
  assert(start >= 0, `Missing CSS rule for ${selector}`);
  const open = css.indexOf('{', start);
  const end = css.indexOf('}', open);
  return css.slice(open + 1, end);
}
const libraryRule = ruleBody('.build-library');
assert(libraryRule.includes('max-height:calc(100dvh - 24px)'), 'Library panel has a viewport-relative height cap');
assert(libraryRule.includes('display:flex') && libraryRule.includes('flex-direction:column'), 'Library panel is a flex column so head/tabs stay above the scroll area');
assert(libraryRule.includes('min-height:0'), 'Library panel can shrink within its layout area');

const scrollRule = ruleBody('.build-library-scroll');
assert(scrollRule.includes('overflow-y:auto'), 'Library content area scrolls vertically');
assert(scrollRule.includes('min-height:0'), 'Library content area can shrink inside the capped panel');
assert(css.includes('.build-space-compact .build-library{max-height:min(100%,calc(100dvh - 24px))}'), 'On desktop the Library cap is also tied to the area beside the stage');

// --- Source structure: head and tabs live outside the scroll area; tab content lives inside it ---
const source = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
assert.equal((source.match(/build-library-scroll/g) || []).length, 1, 'Exactly one Library scroll area in the source');
const headAt = source.indexOf('<div className="build-library-head">');
const tabsAt = source.indexOf('<div className="build-library-tabs"');
const scrollAt = source.indexOf('<div className="build-library-scroll">');
const picturesAt = source.indexOf('{libraryFamily==="pictures"');
const effectsAt = source.indexOf('{libraryFamily==="effects"');
assert(headAt >= 0 && tabsAt > headAt && scrollAt > tabsAt, 'Library head and tabs come before (outside) the scroll area');
assert(picturesAt > scrollAt && effectsAt > picturesAt, 'Per-tab content renders inside the scroll area');

// --- Rendered structure ---
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
const project = { id: 'library-scroll-test', assets: [], assetPools: [], compositions: [], controls: [], overlay: {}, gameTools: [] };
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

  assert(container.querySelector('.build-library > .build-library-head'), 'Library heading is a direct child of the panel (outside the scroll area)');
  assert(container.querySelector('.build-library > .build-library-tabs'), 'Library tab row is a direct child of the panel (outside the scroll area)');
  assert(container.querySelector('.build-library > .build-library-scroll'), 'Library scroll area is a direct child of the panel');
  assert(!container.querySelector('.build-library-scroll .build-library-head'), 'Library heading is not inside the scroll area');
  assert(!container.querySelector('.build-library-scroll .build-library-tabs'), 'Library tab row is not inside the scroll area');
  assert(container.querySelector('.build-library-scroll .library-grid'), 'Pictures content renders inside the scroll area');

  const toolsTab = [...container.querySelectorAll('.build-library-tabs [role="tab"]')].find(button => button.textContent === 'Tools');
  assert(toolsTab, 'Tools tab still present');
  await React.act(async () => toolsTab.click());
  assert(container.querySelector('.build-library-scroll .library-create-tools'), 'Tools create row renders inside the scroll area');

  await React.act(async () => root.unmount());
  console.log('PASS: Library panel is height-capped with a flex column; head and tabs stay outside the single scroll area; tab content (Pictures grid, Tools create row) renders inside it.');
})().catch(error => { console.error(error); process.exitCode = 1; });
