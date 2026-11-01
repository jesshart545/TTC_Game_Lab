const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// Usability items 2 + 4: a click and its commit controls are one chain.
// Item 2 — Workshop Creation tools buttons open their forms in the opposite
// (Jewel) column; the opened form must scroll into view and flash the shared
// fix highlight. Item 4 — when a panel opens, its Add / Save / Generate /
// Cancel controls are in view: the Build Space button review scrolls its
// Add/Cancel into view, generator forms land with Generate in view, and the
// MediaEditor / AssetComposer modals keep their footers visible.

// ---------- Item 2 + generator commit (4b): source contract on page.tsx ----------
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
const openStart = page.indexOf('function openWorkshopTool');
const openEnd = page.indexOf('async function saveProgress', openStart);
assert(openStart >= 0 && openEnd > openStart, 'openWorkshopTool handler found');
const openSpan = page.slice(openStart, openEnd);
for (const id of ['generator-prompt', 'trivia-list-count', 'board-templates', 'tool-templates'])
  assert(openSpan.includes(`"${id}"`), `openWorkshopTool still targets #${id}`);
assert(openSpan.includes('closest<HTMLElement>(".idea-card")'), 'The opened form panel (its .idea-card) is the scroll/highlight target, whichever column it lives in');
assert(openSpan.includes('panel.scrollIntoView({ behavior: "smooth", block: "center" })'), 'The form panel scrolls into view when it opens');
assert(openSpan.includes('panel.classList.add("fix-highlight")') && openSpan.includes('panel.classList.remove("fix-highlight")') && openSpan.includes('1900'), 'The form flashes the shared .fix-highlight for the standard 1.9s');
assert(openSpan.includes('querySelector<HTMLElement>("button.build-btn")'), 'The form commit button is located inside the opened panel');
assert(openSpan.includes('commit.scrollIntoView({ behavior: "smooth", block: "nearest" })'), 'The Generate/commit button is scrolled into view in the same opening motion');
assert(openSpan.includes('focus({ preventScroll: true })'), 'Focus still lands on the form field without fighting the scroll');

const assetsPanel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
for (const call of ['openWorkshopTool("media")', 'openWorkshopTool("media",true)', 'openWorkshopTool("trivia")', 'openWorkshopTool("boards")', 'openWorkshopTool("tools")'])
  assert(assetsPanel.includes(call), `Creation tools entry ${call} still routes through the shared opener`);

// ---------- Item 4a: source contract on BuildSpace.tsx ----------
const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
assert(buildSpace.includes('if(!pendingAddition)return;') && buildSpace.includes('querySelector<HTMLElement>(".dashboard-button-review")'), 'Build Space watches the review opening and finds the review panel');
assert(buildSpace.includes('scrollIntoView({behavior:"smooth",block:"end"})'), 'The review scrolls so its bottom — the Add/Cancel controls — is in view');

// ---------- Item 4c: sticky-footer CSS contract ----------
const globals = fs.readFileSync('app/globals.css', 'utf8');
function ruleBody(source, selector) {
  const start = source.indexOf(selector + '{');
  assert(start >= 0, `Missing CSS rule for ${selector}`);
  const open = source.indexOf('{', start);
  const end = source.indexOf('}', open);
  return source.slice(open + 1, end);
}
const actionsRule = ruleBody(globals, '.media-editor-actions');
assert(actionsRule.includes('position:sticky') && actionsRule.includes('bottom:0'), 'MediaEditor footer bar is sticky at the bottom of the scrolling modal');
// Sticky geometry precondition (the PR #115 false pass): a sticky element is
// constrained to its containing block — the content box of its parent. When
// the footer was a direct child of the scrolling modal, that box was only the
// modal's visible height sitting at the top of the scrollable content, so the
// footer's natural position at the end of the content lay outside it and
// sticky could never pull it into view — the CSS said "sticky" and jsdom
// (no layout) passed, while the live dialog showed no pinned footer. The
// footer must therefore live inside a plain full-content-height wrapper (see
// the behavioral checks below). If a rule for the wrapper ever appears, it
// must not reintroduce a containing-block breaker.
const wrapRuleStart = globals.indexOf('.media-editor-scroll-content{');
if (wrapRuleStart >= 0) {
  const wrapRule = ruleBody(globals, '.media-editor-scroll-content');
  assert(!/overflow|transform|position/.test(wrapRule), 'The MediaEditor scroll-content wrapper stays a plain block box (no overflow/transform/position), so the sticky footer keeps the wrapper as its containing block');
}
const modalRule = ruleBody(globals, '.media-editor-modal');
assert(modalRule.includes('padding:22px 22px 0') && modalRule.includes('overflow:auto'), 'MediaEditor modal keeps its own scroll and drops bottom padding so the sticky footer sits flush');
const composerRule = ruleBody(globals, '.asset-composer');
assert(composerRule.includes('display:flex') && composerRule.includes('flex-direction:column') && composerRule.includes('max-height:calc(100vh - 48px)'), 'Asset Composer is a height-bounded flex column so its footer can stay put');
const composerScrollRule = ruleBody(globals, '.asset-composer-scroll');
assert(composerScrollRule.includes('overflow-y:auto') && composerScrollRule.includes('min-height:0'), 'Asset Composer body scrolls between its header and footer');
assert(ruleBody(globals, '.asset-composer>footer').includes('flex:none'), 'Asset Composer footer does not shrink or scroll away');

// ---------- jsdom behavioral checks ----------
const { JSDOM } = require('jsdom');
const React = require('react');
const { createRoot } = require('react-dom/client');

function freshDom() {
  const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: 'https://example.test' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.IS_REACT_ACT_ENVIRONMENT = true;
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
        : id === './RuntimeActionLayers' ? { ControlAppearancePreview: () => null }
        : id === './CompositionPlayer' ? { defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60 } }
        : { default: () => null }),
    crypto: require('node:crypto').webcrypto,
    window: global.window,
    console,
  });
  return exports;
}
const setValue = (dom, element, value) => {
  const proto = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};

(async () => {
  // ----- 4a behavioral: opening the review scrolls its Add/Cancel into view -----
  {
    const dom = freshDom();
    const scrollCalls = [];
    dom.window.HTMLElement.prototype.scrollIntoView = function (options) { scrollCalls.push({ element: this, options }); };
    const Review = compile('components/DashboardButtonReview.tsx').default;
    const BuildSpace = compile('components/BuildSpace.tsx', { './DashboardButtonReview': { default: Review } }).default;
    const project = { id: 'review-scroll-test', assets: [], assetPools: [], compositions: [], controls: [], overlay: {}, gameTools: [] };
    const noop = () => {};
    const container = document.getElementById('root');
    const root = createRoot(container);
    await React.act(async () => root.render(React.createElement(BuildSpace, {
      project, sequenceRunning: false, sequenceError: '', cardStates: {},
      onSelect: noop, onChange: noop, overlay: null, onTrigger: noop, onWorkshop: noop,
      onStopSequence: noop, youtubeOpen: false, onOpenYoutube: noop, onCloseYoutube: noop,
      onYoutubeCommand: async () => null, youtubeState: null, youtubeFeedback: null,
      onPublishStep: noop, onAddTemplate: noop,
    })));
    const addItems = [...container.querySelectorAll('.build-steps button')].find(b => b.textContent === 'Add items');
    assert(addItems, 'Add items step button renders');
    await React.act(async () => addItems.click());
    const typeSelect = container.querySelector('[aria-label="Addition type"]');
    assert(typeSelect, 'Addition type select renders on the Add items step');
    await React.act(async () => setValue(dom, typeSelect, 'dice'));
    const createButton = [...container.querySelectorAll('button')].find(b => b.textContent === 'Create dice');
    assert(createButton, 'Create dice button renders for a creatable addition type');
    scrollCalls.length = 0;
    await React.act(async () => createButton.click());
    const review = container.querySelector('.dashboard-button-review');
    assert(review, 'Opening a creation with no controls renders the button review');
    assert([...review.querySelectorAll('button')].some(b => b.textContent === 'Add selected buttons'), 'Review Add control renders');
    const reviewScroll = scrollCalls.find(call => call.element === review);
    assert(reviewScroll, 'Opening the review scrolls the review panel');
    assert.equal(reviewScroll.options && reviewScroll.options.block, 'end', 'The review scrolls by its end, so the Add/Cancel controls are in view');
    await React.act(async () => root.unmount());
    console.log('PASS: opening the Build Space button review scrolls the panel so its Add/Cancel controls land in view.');
  }

  // ----- 4c behavioral: MediaEditor Save + Cancel live in the sticky footer -----
  {
    const dom = freshDom();
    dom.window.HTMLElement.prototype.scrollTo = function () {};
    const MediaEditor = compile('components/MediaEditor.tsx', {
      '../lib/image-layout': load('lib/image-layout.ts'),
      '../lib/video-edit-poll': load('lib/video-edit-poll.ts'),
    }).default;
    let saved = null;
    const asset = { name: 'Portrait.png', url: 'https://example.test/original.png', type: 'image/png' };
    const container = document.getElementById('root');
    const root = createRoot(container);
    await React.act(async () => root.render(React.createElement(MediaEditor, {
      asset, onSave: () => {}, onClose: () => {}, onSaveAsNew: async value => { saved = value; },
    })));
    const actions = document.querySelector('.media-editor-actions');
    assert(actions, 'MediaEditor footer bar renders');
    const inFooter = text => [...actions.querySelectorAll('button')].some(b => b.textContent === text);
    assert(inFooter('Save edited copy') && inFooter('Cancel'), 'Save edited copy and Cancel both live in the footer bar');
    const fieldset = document.querySelector('.media-editor-fields fieldset');
    assert(fieldset && ![...fieldset.querySelectorAll('button')].some(b => b.textContent === 'Save edited copy'), 'Save edited copy no longer sits mid-form inside the fieldset');
    // The geometry that makes sticky actually pin (what the live check proved
    // missing): the footer must NOT be a direct child of the scrolling modal.
    // Its parent must be a plain wrapper that wraps ALL of the modal's
    // content, so the wrapper's height spans the full scrollable content and
    // the footer's containing block spans it too; the modal itself remains
    // the direct scroll container (the media-full-image scroll contract).
    const modal = document.querySelector('.media-editor-modal');
    const wrap = actions.parentElement;
    assert(wrap && wrap !== modal, 'The footer is not a direct child of the scrolling modal');
    assert(wrap.classList.contains('media-editor-scroll-content'), 'The footer lives in the scroll-content wrapper');
    assert(wrap.parentElement === modal, 'The wrapper is the modal\'s direct child, keeping the modal as the scroll container');
    for (const section of ['.media-editor-head', '.media-editor-preview-wrap', '.media-editor-fields'])
      assert(wrap.querySelector(section), `The wrapper spans the whole dialog content (${section} inside it), so its height is the full scrollable height`);
    assert(wrap.lastElementChild === actions, 'The footer bar is the last element inside the wrapper');
    await React.act(async () => [...actions.querySelectorAll('button')].find(b => b.textContent === 'Save edited copy').click());
    assert(saved && saved.name === 'Portrait.png', 'The footer Save button still saves the edited copy');
    await React.act(async () => root.unmount());
    console.log('PASS: MediaEditor footer holds Save edited copy and Cancel (the sticky bar), and Save still saves.');

    // The editor's other modes share this dialog: video and audio assets get
    // the same wrapper + footer structure (their fieldsets differ, the
    // footer does not).
    for (const modeAsset of [
      { name: 'Clip.mp4', url: 'https://example.test/clip.mp4', type: 'video/mp4' },
      { name: 'Theme.mp3', url: 'https://example.test/theme.mp3', type: 'audio/mpeg' },
    ]) {
      const modeRoot = createRoot(container);
      await React.act(async () => modeRoot.render(React.createElement(MediaEditor, {
        asset: modeAsset, onSave: () => {}, onClose: () => {}, onSaveAsNew: async () => {},
      })));
      const modeActions = document.querySelector('.media-editor-actions');
      assert(modeActions, `MediaEditor footer bar renders for ${modeAsset.type}`);
      assert([...modeActions.querySelectorAll('button')].some(b => b.textContent === 'Save edited copy')
        && [...modeActions.querySelectorAll('button')].some(b => b.textContent === 'Cancel'),
        `Save edited copy and Cancel live in the footer bar for ${modeAsset.type}`);
      assert(modeActions.parentElement && modeActions.parentElement.classList.contains('media-editor-scroll-content')
        && modeActions.parentElement.parentElement === document.querySelector('.media-editor-modal'),
        `The footer sits in the scroll-content wrapper for ${modeAsset.type}, like the image branch the live path uses`);
      await React.act(async () => modeRoot.unmount());
    }
    console.log('PASS: MediaEditor sticky geometry holds in the rendered DOM — footer inside the full-height scroll-content wrapper (not a direct child of the scroller), for image, video, and audio assets.');
  }

  // ----- 4c behavioral: AssetComposer footer stays outside the scrolling body -----
  {
    const dom = freshDom();
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    const AssetComposer = compile('components/AssetComposer.tsx', {
      '../lib/composition-export': { exportCompositionVideo: async () => {} },
      '../lib/composition-effects': { EFFECT_NAMES: ['Confetti'] },
      './CompositionEffect': { default: () => null },
    }).default;
    let saved = null;
    const assets = [{ name: 'Intro.mp4', type: 'video/mp4', url: 'https://example.test/intro.mp4', storageKey: 'intro' }];
    const container = document.getElementById('root');
    const root = createRoot(container);
    await React.act(async () => root.render(React.createElement(AssetComposer, {
      assets, compositions: [], onSave: value => { saved = value; }, onClose: () => {},
    })));
    const composer = document.querySelector('.asset-composer');
    assert(composer, 'Asset Composer renders');
    assert(document.querySelector('.asset-composer > header'), 'Composer header is a direct child, above the scroll area');
    const footer = document.querySelector('.asset-composer > footer');
    assert(footer, 'Composer footer is a direct child, below the scroll area');
    assert(document.querySelector('.asset-composer-scroll .timeline-scroll'), 'The timeline lives inside the scrolling body');
    assert(!footer.closest('.asset-composer-scroll'), 'The footer is not inside the scrolling body');
    const footerButtons = [...footer.querySelectorAll('button')].map(b => b.textContent);
    assert(footerButtons.includes('Cancel') && footerButtons.includes('Save Composition'), 'Footer keeps Cancel and Save Composition');
    const libraryButton = [...document.querySelectorAll('.composer-library button')].find(b => b.textContent.includes('Intro.mp4'));
    assert(libraryButton, 'Library asset button renders');
    await React.act(async () => libraryButton.click());
    const saveButton = [...footer.querySelectorAll('button')].find(b => b.textContent === 'Save Composition');
    assert(!saveButton.disabled, 'Save Composition enables once a clip is added');
    await React.act(async () => saveButton.click());
    assert(saved && saved.clips.length === 1, 'The footer Save Composition still saves the composition');
    await React.act(async () => root.unmount());
    console.log('PASS: Asset Composer keeps header and footer outside its scrolling body; Save Composition still saves.');
  }

  console.log('PASS: item 2 forms scroll into view with the shared highlight and their Generate button in view; item 4 review scroll and sticky editor footers verified in source, CSS, and rendered DOM.');
})().catch(error => { console.error(error); process.exitCode = 1; });
