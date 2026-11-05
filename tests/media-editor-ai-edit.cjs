const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');

// The MediaEditor's AI Edit + Text sections (Jessica, 2026-11-04).
// She clicked "✦ Edit / AI Edit" in the Asset Library, got only manual
// tools, and directed: "I would rather it offer the AI edit in there
// also, since the AI is the main editing tool." So the dialog now
// offers a real AI Edit — on the SAME pipeline Jewel's media edits use
// (lib/ai-edit) — saving through the dialog's save-as-new path, plus a
// Text section for assets carrying a lettering layer. These pins hold
// that contract:
//   * lib/ai-edit speaks to the shared endpoints with the shared
//     request shapes and polls through the shared pollers;
//   * the dialog's AI apply saves the finished result as a new copy
//     (source name in, host applies nextEditName) and a failure saves
//     nothing and says so;
//   * the Text section renders only when a text spec exists, its fonts
//     come from lib/fonts.ts, and a font/color change round-trips
//     through the spec unchanged in shape;
//   * both save hosts carry the copy's textOverlay, so an edited
//     backdrop keeps its lettering.

// ---------- Source pins ----------
const editor = fs.readFileSync('components/MediaEditor.tsx', 'utf8');
const aiEditLib = fs.readFileSync('lib/ai-edit.ts', 'utf8');
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
const assetsPage = fs.readFileSync('app/assets/page.tsx', 'utf8');
const fontPicker = fs.readFileSync('components/FontPicker.tsx', 'utf8');

for (const kept of ['/api/generate-asset', 'promptImage', 'pollImageGeneration', '/api/edit-video', 'pollForEditedVideoUrl']) {
  assert.ok(aiEditLib.includes(kept), `lib/ai-edit uses the shared pipeline: ${kept}`);
}
assert.ok(editor.includes('aiEditImage') && editor.includes('aiEditVideo'), 'the dialog runs lib/ai-edit');
assert.ok(editor.indexOf('AI EDIT') < editor.indexOf('Direct edits · save as a new copy'),
  'the AI Edit section is first-class: it sits before the manual Direct edits');
assert.ok(editor.includes('edits: undefined'), 'the AI result saves through save-as-new as finished media (edits: undefined)');
assert.ok(editor.includes('assetBackdropText'), 'the Text section is gated on the asset\u2019s text spec');
assert.ok(editor.includes('FontPicker'), 'the Text section picks fonts through the shared FontPicker');
assert.ok(fontPicker.includes('fontCatalog'), 'FontPicker\u2019s choices come from the lib/fonts.ts catalog');
assert.ok(assetsPage.includes('✦ Edit / AI Edit'), 'the library button keeps the name its dialog now lives up to');
assert.ok((page.match(/textOverlay: nextAsset\.textOverlay/g) || []).length >= 4,
  'every save-as-new branch in the project page carries the copy\u2019s text layer');
assert.ok((assetsPage.match(/textOverlay: nextAsset\.textOverlay/g) || []).length >= 1,
  'the library save-as-new carries the copy\u2019s text layer');

// ---------- lib/ai-edit behavior (shared pollers stubbed) ----------
{
  const pollCalls = [];
  const videoPollCalls = [];
  let fetchImpl = async () => { throw new Error('fetch not set'); };
  const exportsBox = {};
  const code = ts.transpileModule(aiEditLib, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, {
    exports: exportsBox,
    require: id => id === './poll-image-generation'
      ? { pollImageGeneration: async (...args) => { pollCalls.push(args); return 'https://example.test/polled.png'; } }
      : id === './video-edit-poll'
        ? { pollForEditedVideoUrl: async (...args) => { videoPollCalls.push(args); return 'https://example.test/edited.mp4'; } }
        : require(id),
    fetch: (...args) => fetchImpl(...args),
    // A no-op signal: the real AbortSignal.timeout would park a
    // three-minute timer per call and hold the test process open.
    AbortSignal: { timeout: () => ({ aborted: false }) },
  });
  const { aiEditImage, aiEditVideo } = exportsBox;

  (async () => {
    // Queued image edit: same request shape as the project page's
    // generateAsset funnel for one of Jewel's image actions, then the
    // shared poller receives the job's coordinates untouched.
    let seen;
    fetchImpl = async (url, options) => { seen = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ requestId: 'req-9', statusUrl: 'https://status', responseUrl: 'https://resp', model: 'fal-ai/nano-banana-2/edit' }) }; };
    const url = await aiEditImage('https://example.test/src.png', 'make it gold');
    assert.equal(seen.url, '/api/generate-asset');
    assert.equal(seen.body.type, 'image');
    assert.equal(seen.body.promptImage, 'https://example.test/src.png');
    assert.equal(seen.body.prompt, 'make it gold');
    assert.deepEqual(pollCalls[0].slice(0, 4), ['req-9', 'https://status', 'https://resp', 'fal-ai/nano-banana-2/edit']);
    assert.equal(url, 'https://example.test/polled.png');

    // Direct-URL result (the Agnes fallback's shape): returned as-is,
    // no polling.
    pollCalls.length = 0;
    fetchImpl = async () => ({ ok: true, json: async () => ({ url: 'data:image/png;base64,AAAA' }) });
    assert.equal(await aiEditImage('https://example.test/src.png', 'make it gold'), 'data:image/png;base64,AAAA');
    assert.equal(pollCalls.length, 0);

    // Provider failure: the error propagates, nothing is invented.
    fetchImpl = async () => ({ ok: false, json: async () => ({ error: 'Provider said no' }) });
    await assert.rejects(() => aiEditImage('https://example.test/src.png', 'make it gold'), /Provider said no/);

    // Video edit: /api/edit-video with {prompt, videoUrl}, then the
    // shared video poller with the job id and model.
    fetchImpl = async (u, options) => { seen = { url: u, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ videoId: 'vid-3', model: 'fal-ai/wan-vace-apps/video-edit' }) }; };
    assert.equal(await aiEditVideo('https://example.test/src.mp4', 'gold lights'), 'https://example.test/edited.mp4');
    assert.equal(seen.url, '/api/edit-video');
    assert.deepEqual(seen.body, { prompt: 'gold lights', videoUrl: 'https://example.test/src.mp4' });
    assert.deepEqual(videoPollCalls[0], ['vid-3', 'fal-ai/wan-vace-apps/video-edit']);
  })().then(() => dialogBehavior()).catch(e => { console.error(e); process.exitCode = 1; });
}

// ---------- Dialog behavior (jsdom render; lib/ai-edit doubled) ----------
function dialogBehavior() {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>');
  global.window = dom.window; global.document = dom.window.document; global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLElement.prototype.scrollTo = function () {};
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const loadLib = file => require('./load.cjs')(file);
  const fontPickerExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/FontPicker.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: fontPickerExports, require: id => id === '../lib/fonts' ? loadLib('lib/fonts.ts') : require(id) });
  const aiCalls = [];
  const aiBehavior = { mode: 'ok' };
  const aiEditDouble = {
    aiEditImage: async (url, prompt) => { aiCalls.push({ kind: 'image', url, prompt }); if (aiBehavior.mode === 'fail') throw new Error('The AI editor is unavailable.'); return 'https://example.test/ai-result.png'; },
    aiEditVideo: async (url, prompt) => { aiCalls.push({ kind: 'video', url, prompt }); return 'https://example.test/ai-result.mp4'; },
  };
  const loaded = {};
  vm.runInNewContext(ts.transpileModule(editor, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: loaded, require: id => id === '../lib/image-layout' ? loadLib('lib/image-layout.ts')
      : id === '../lib/backdrop-text' ? loadLib('lib/backdrop-text.ts')
      : id === '../lib/ai-edit' ? aiEditDouble
      : id === './FontPicker' ? fontPickerExports
      : require(id), fetch: async () => { throw new Error('the dialog must not fetch directly'); } });
  const MediaEditor = loaded.default;
  const { fontCatalog } = loadLib('lib/fonts.ts');
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text);
  const setValue = (el, value, proto) => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const flush = () => React.act(async () => { await new Promise(r => setTimeout(r, 10)); });

  (async () => {
    let root = null;
    let saved;
    // Each case opens the dialog fresh, exactly as the app does (the
    // editor is mounted per open and unmounts on close) — its state
    // initializers run per asset, never carried across cases.
    const render = async (asset, withSave = true) => {
      saved = undefined;
      if (root) await React.act(async () => root.unmount());
      document.getElementById('root').innerHTML = '';
      root = createRoot(document.getElementById('root'));
      await React.act(async () => root.render(React.createElement(MediaEditor, { asset, onSave: () => {}, onClose: () => {}, ...(withSave ? { onSaveAsNew: async v => { saved = v; } } : {}) })));
    };

    // --- Text section: present only with a spec; catalog fonts; round-trip.
    const spec = { text: 'The Cozy Corner', fontFamily: fontCatalog[0].family, textColor: '#f5f0e6', accentColor: '#c9a227' };
    await render({ name: 'Stage backdrop', url: 'https://example.test/stage.png', type: 'image/png', textOverlay: { ...spec } });
    const fontSelect = document.querySelector('.font-picker select');
    assert.ok(fontSelect, 'Text section renders a font picker for a lettered asset');
    assert.equal(fontSelect.querySelectorAll('option').length, fontCatalog.length, 'font choices are exactly the lib/fonts.ts catalog');
    assert.equal(fontSelect.value, fontCatalog[0].family, 'the picker starts on the spec\u2019s font');
    const otherFont = fontCatalog[fontCatalog.length - 1].family;
    setValue(fontSelect, otherFont, dom.window.HTMLSelectElement.prototype);
    const colorInput = document.querySelector('input[aria-label="Text color"]');
    assert.ok(colorInput, 'Text section renders a text color control');
    assert.ok(document.querySelector('input[aria-label="Accent color"]'), 'Text section renders the accent color the spec carries');
    setValue(colorInput, '#112233', dom.window.HTMLInputElement.prototype);
    await React.act(async () => button('Save edited copy').click());
    assert.equal(saved.textOverlay.fontFamily, otherFont, 'the font change saves through the spec');
    assert.equal(saved.textOverlay.textColor, '#112233', 'the color change saves through the spec');
    assert.equal(saved.textOverlay.text, 'The Cozy Corner', 'the spec\u2019s text is untouched by a font/color edit');
    assert.equal(saved.textOverlay.accentColor, '#c9a227', 'the spec keeps its shape: accent color preserved');

    // --- No text layer: no Text section.
    await render({ name: 'Plain photo', url: 'https://example.test/plain.png', type: 'image/png' });
    assert.equal(document.querySelector('.font-picker'), null, 'no Text section without a text layer');
    assert.equal(document.querySelector('input[aria-label="Text color"]'), null, 'no color controls without a text layer');

    // --- AI apply: the finished result saves as a new copy.
    const aiInput = document.querySelector('input[aria-label="Describe the AI edit"]');
    assert.ok(aiInput, 'AI Edit section renders its prompt input');
    setValue(aiInput, 'make the sky a sunset', dom.window.HTMLInputElement.prototype);
    await React.act(async () => button('Apply AI edit').click());
    await flush();
    assert.deepEqual(aiCalls, [{ kind: 'image', url: 'https://example.test/plain.png', prompt: 'make the sky a sunset' }], 'apply runs the shared AI edit on this asset');
    assert.equal(saved.url, 'https://example.test/ai-result.png', 'the AI result is what saves');
    assert.equal(saved.edits, undefined, 'the AI result saves as finished media, not a manual render');
    assert.equal(saved.name, 'Plain photo', 'the copy goes in under the source name — the host applies nextEditName');

    // --- AI failure: plain error, nothing saved, dialog stays open.
    aiBehavior.mode = 'fail';
    await render({ name: 'Plain photo', url: 'https://example.test/plain.png', type: 'image/png' });
    setValue(document.querySelector('input[aria-label="Describe the AI edit"]'), 'make it gold', dom.window.HTMLInputElement.prototype);
    await React.act(async () => button('Apply AI edit').click());
    await flush();
    assert.equal(saved, undefined, 'a failed AI edit saves nothing');
    // The double's Error is born in the test's realm, so the dialog's
    // instanceof check hands it the dialog's own plain failure line —
    // in the browser's single realm the provider's message itself is
    // what shows. Either way: a plain error, never a fake success.
    assert.match(document.querySelector('.media-editor-error')?.textContent || '', /The AI edit could not be completed\. Nothing was saved\./, 'the failure shows as a plain error');
    assert.ok(button('Save edited copy'), 'the dialog stays open after a failed AI edit');
    aiBehavior.mode = 'ok';

    // --- No save-as-new host: the AI section says so instead of faking it.
    await render({ name: 'Plain photo', url: 'https://example.test/plain.png', type: 'image/png' }, false);
    assert.match(document.body.textContent, /AI editing isn't available in this view/, 'without a save path the section carries a plain note');
    assert.equal(button('Apply AI edit').disabled, true, 'and its apply action is disabled');

    await React.act(async () => root.unmount());
    console.log('media-editor-ai-edit: all assertions passed');
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
