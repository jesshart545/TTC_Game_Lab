const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), load = require('./load.cjs');
const { PLINKO_BOARD_ART_FIELD, PLINKO_ART_STYLE_FIELD, PLINKO_DEFAULT_BOARD_ART, plinkoArtStyleOf, plinkoBoardArtKeyOf, plinkoBoardArtUrl, plinkoBoardArtPrompt, plinkoArtTargets } = load('lib/plinko-art.ts');
const { applyBuildChanges } = load('lib/build-edits.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');

// A Plinko board's OWN artwork (Jessica, 2026-11-15): every board
// Jewel creates is the creator's own — the site generates its artwork
// from the creator's style words at creation time, files it into the
// project, and stores the asset key on the tool's config as
// boardArtKey; PlinkoDisplay renders that artwork with the same
// title/slot layering as the neutral house board, which remains the
// fallback. The artwork never carries values or text — the prompt
// builder's composition locks (blank marquee, nine EMPTY slot boxes,
// no text, no dollar signs) are what the layering relies on.

const baseProject = () => ({ id: 'test', assets: [], controls: [], gameTools: [], overlay: {}, compositions: [] });
// Loaded modules run in the harness's vm realm, so arrays they build
// fail strict prototype comparison against this realm's literals;
// compare id lists by value through a JSON round-trip (the pattern
// tests/plinko-creation.cjs uses for the same reason).
const targetIds = (before, after) => JSON.parse(JSON.stringify(plinkoArtTargets(before, after).map(t => t.id)));
const plinkoTool = (over = {}) => ({ id: 'plinko-1', type: 'plinko', name: 'My Board', enabled: true, inToolbox: true, config: { title: 'Plinko', slots: ['10', '50', '100'], rows: 9 }, ...over });

// ---- Field names -----------------------------------------------------------
assert.equal(PLINKO_BOARD_ART_FIELD, 'boardArtKey', 'the artwork reference lives on config.boardArtKey');
assert.equal(PLINKO_ART_STYLE_FIELD, 'artStyle', 'the creator style words live on config.artStyle');
assert.equal(PLINKO_DEFAULT_BOARD_ART, '/game-art/plinko-board-default.webp', 'the neutral house board is the fallback artwork');
assert.notEqual(PLINKO_DEFAULT_BOARD_ART, '/game-art/plinko-board.webp', 'the fallback is NOT Jessica\u2019s uploaded neon board — her board is not the face of every Plinko');

// ---- The prompt builder ----------------------------------------------------
{
  const prompt = plinkoBoardArtPrompt('neon carnival');
  assert.ok(prompt.includes('exactly nine empty open slot boxes'), 'prompt locks exactly nine slot boxes');
  assert.ok(prompt.includes('nothing inside them'), 'prompt locks the slot boxes empty — values are layered by code, never painted');
  assert.ok(prompt.includes('marquee band'), 'prompt locks the marquee band');
  assert.ok(prompt.includes('no lettering'), 'prompt locks the marquee blank');
  assert.ok(/No text, no words, no letters, no numbers/.test(prompt), 'prompt forbids text anywhere in the artwork');
  assert.ok(prompt.includes('No dollar signs'), 'prompt forbids dollar signs in words');
  assert.ok(!prompt.includes('$'), 'the built prompt never contains a dollar-sign character');
  assert.ok(prompt.includes('Style and theme: neon carnival.'), 'prompt carries the creator\'s style words');
  assert.ok(prompt.includes('Quality floor, whatever the theme'), 'prompt carries the unconditional quality-floor clause');
  assert.ok(prompt.includes('glowing marquee bulbs') && prompt.includes('richly illustrated'), 'the quality floor demands richly illustrated art with glowing marquee bulbs, whatever the theme');
  assert.ok(prompt.includes('illustrated game-show art') && prompt.includes('not a photograph'), 'the art direction is illustrated game-show art, never a photograph of a physical cabinet');
  assert.ok(prompt.includes('living world') && prompt.includes('drawn from the theme itself'), 'the theme is realized as a living world — characters, props, scenery and atmosphere drawn from the theme itself');
  assert.ok(prompt.includes('built out of the theme'), 'the board itself — frame, peg-field surround, slot row — is built out of the theme');
  assert.ok(prompt.includes('saturated color'), 'the art direction demands saturated color');
  assert.ok(prompt.includes('trapezoidal'), 'prompt locks the front-facing trapezoidal board');
  assert.ok(prompt.includes('no balls anywhere in the peg field'), 'prompt keeps balls out of the peg field — the ball is drawn by code');
  assert.ok(prompt.includes('always an original design built from the creator\'s own specification'), 'generated boards are original designs from the creator’s own spec');
  const bare = plinkoBoardArtPrompt('');
  assert.ok(bare.includes('Quality floor, whatever the theme'), 'the quality floor holds without style words too');
  assert.ok(!/dial/i.test(bare) && !/neon/i.test(bare) && !/standard board/i.test(bare) && !/uploaded/i.test(bare), 'the built prompt never evokes Jessica\u2019s board — no dial, no neon identity, no reference to her board at all; her board is the detail bar only, never a look to resemble');
  assert.ok(!/clown/i.test(bare) && !/zombie/i.test(bare) && !/rainbow/i.test(bare) && !bare.includes('TTC Game Lab'), 'the built prompt never evokes Jessica\u2019s specific exemplar boards — they set the standard, they are not designs to copy');
  assert.ok(bare.includes('illustrated') && bare.includes('living world'), 'the illustrated themed-scene direction holds without style words too');
  assert.ok(bare.includes('exactly nine empty open slot boxes'), 'composition locks hold without style words');
  assert.ok(bare.includes('Style and theme:'), 'a style-less board still gets a neutral style direction');
  const dirty = plinkoBoardArtPrompt('gold $ rush');
  assert.ok(!dirty.includes('$'), 'dollar signs are stripped from the creator\'s style words before they reach the prompt');
  assert.ok(dirty.includes('gold  rush') || dirty.includes('gold rush'), 'the rest of the style words survive');
}

// ---- Style/key readers -------------------------------------------------------
assert.equal(plinkoArtStyleOf({ artStyle: '  underwater   treasure ' }), 'underwater treasure', 'style words are trimmed and collapsed');
assert.equal(plinkoArtStyleOf({}), '', 'no style words reads as empty');
assert.equal(plinkoArtStyleOf({ artStyle: 42 }), '', 'a non-string style reads as empty');
assert.equal(plinkoBoardArtKeyOf({ boardArtKey: 'asset-9' }), 'asset-9', 'the art key reads back');
assert.equal(plinkoBoardArtKeyOf({}), '', 'no art key reads as empty');

// ---- The resolver ------------------------------------------------------------
{
  const assets = [
    { name: 'Other', storageKey: 'k-other', url: 'https://cdn.example/other.png' },
    { name: 'Board art', storageKey: 'k-board', url: 'https://cdn.example/board.png' },
    { name: 'Nameless key art', url: 'https://cdn.example/by-name.png' },
  ];
  assert.equal(plinkoBoardArtUrl(plinkoTool({ config: { boardArtKey: 'k-board' } }), assets), 'https://cdn.example/board.png', 'resolves by storageKey');
  assert.equal(plinkoBoardArtUrl(plinkoTool({ config: { boardArtKey: 'Nameless key art' } }), assets), 'https://cdn.example/by-name.png', 'resolves by asset name, like every other asset key in the app');
  assert.equal(plinkoBoardArtUrl(plinkoTool(), assets), undefined, 'a board without its own artwork resolves to the house board');
  assert.equal(plinkoBoardArtUrl(plinkoTool({ config: { boardArtKey: 'missing' } }), assets), undefined, 'a dangling key resolves to the house board, never a blank');
  assert.equal(plinkoBoardArtUrl(plinkoTool({ config: { boardArtKey: 'k-board' } }), []), undefined, 'no assets, no own art');
}

// ---- Creation: the style words survive, and the board is an art target -------
{
  const created = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'Carnival Plinko', config: { slots: ['10', '20', '30'], rows: 9, artStyle: 'neon carnival' } }] });
  const tool = created.project.gameTools.find(t => t.type === 'plinko');
  assert.ok(tool, 'creation: the board is created');
  assert.equal(tool.config.artStyle, 'neon carnival', 'creation: the creator\'s style words are stored on the config for the artwork generation');
  assert.equal(plinkoBoardArtKeyOf(tool.config), '', 'creation: no artwork key exists until the artwork is actually generated');
  assert.deepEqual(targetIds(baseProject(), created.project), [tool.id], 'creation: a fresh board without artwork is an artwork target');
}

// ---- The attach step the executor runs after generation succeeds -------------
{
  const created = applyBuildChanges(baseProject(), { newTools: [{ type: 'plinko', name: 'Carnival Plinko', config: { slots: ['10', '20', '30'], rows: 9, artStyle: 'neon carnival' } }] });
  const tool = created.project.gameTools.find(t => t.type === 'plinko');
  const filed = { ...created.project, assets: [{ name: 'Plinko board artwork', storageKey: 'projects/test/board-art.png', url: 'https://cdn.example/board-art.png', type: 'image/png', inProject: true }] };
  // Exactly the patch generatePlinkoBoardArt applies once the stored
  // asset identity exists (the ccssAttach pattern).
  const attached = applyBuildChanges(filed, { gameTools: [{ id: tool.id, config: { [PLINKO_BOARD_ART_FIELD]: 'projects/test/board-art.png' } }] });
  assert.ok(attached.applied, 'attach: the patch applies');
  const saved = attached.project.gameTools.find(t => t.id === tool.id);
  assert.equal(saved.config.boardArtKey, 'projects/test/board-art.png', 'attach: the artwork reference is stored on the tool');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.config.slots)), ['10', '20', '30'], 'attach: the creator\'s slots are untouched');
  assert.equal(plinkoBoardArtUrl(saved, attached.project.assets), 'https://cdn.example/board-art.png', 'attach: the saved board now resolves its own artwork');
  assert.deepEqual(targetIds(created.project, attached.project), [], 'attach: a board with artwork is no longer a target');
}

// ---- Restyle: an artStyle edit is a target; other edits are not --------------
{
  const before = { ...baseProject(), gameTools: [plinkoTool({ config: { title: 'Plinko', slots: ['10', '50', '100'], rows: 9, artStyle: 'neon carnival', boardArtKey: 'k-old' } })] };
  const restyled = applyDraftChanges(before, { gameTools: [{ id: 'plinko-1', config: { artStyle: 'underwater treasure' } }] });
  assert.equal(restyled.project.gameTools[0].config.artStyle, 'underwater treasure', 'restyle: the new style words land on the config');
  assert.deepEqual(targetIds(before, restyled.project), ['plinko-1'], 'restyle: a rewritten artStyle makes the board an artwork target');
  const slotsOnly = applyDraftChanges(before, { gameTools: [{ id: 'plinko-1', config: { slots: ['5', '15', '25'] } }] });
  assert.deepEqual(targetIds(before, slotsOnly.project), [], 'a slots-only edit never regenerates the artwork');
  const sameStyle = applyDraftChanges(before, { gameTools: [{ id: 'plinko-1', config: { artStyle: 'neon carnival' } }] });
  assert.deepEqual(targetIds(before, sameStyle.project), [], 're-stating the same style never regenerates the artwork');
  const noStyleYet = { ...baseProject(), gameTools: [plinkoTool()] };
  const firstStyle = applyDraftChanges(noStyleYet, { gameTools: [{ id: 'plinko-1', config: { artStyle: 'haunted house' } }] });
  assert.deepEqual(targetIds(noStyleYet, firstStyle.project), ['plinko-1'], 'a board with no artwork yet gains a target when Jewel first styles it');
}

// ---- The render: own art when resolved, the house board otherwise ----------
{
  const exportsObject = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ChanceTools.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject, require: id => id.endsWith('.css') ? {} : require(id), Math });
  const { PlinkoDisplay } = exportsObject;
  const own = renderToStaticMarkup(React.createElement(PlinkoDisplay, { slots: ['10', '50', '100'], preview: true, artSrc: 'https://cdn.example/board-art.png' }));
  assert.ok(own.includes('href="https://cdn.example/board-art.png"'), 'render: the board\'s own artwork fills the board');
  assert.ok(own.includes('preserveAspectRatio="none"'), 'render: generated art fills the exact frame the layering is mapped to');
  const shipped = renderToStaticMarkup(React.createElement(PlinkoDisplay, { slots: ['10', '50', '100'], preview: true }));
  assert.ok(shipped.includes('href="/game-art/plinko-board-default.webp"'), 'render: without own art the neutral house board renders, unchanged');
  assert.ok(!shipped.includes('preserveAspectRatio'), 'render: the house board\'s markup carries no new attributes');
}

// ---- Wiring: the executor and every render surface ---------------------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert.ok(page.includes('async function generatePlinkoBoardArt'), 'the executor has the board-artwork generation step');
  assert.equal((page.match(/generatePlinkoBoardArt\(/g) || []).length, 4, 'the generation step is defined once and called at all three doors: the tool action, the changes commit before an action, and the changes-only completion');
  assert.ok(page.includes('plinkoArtTargets(baseProject, result.project)'), 'the changes doors pick their boards by diffing the change');
  const plinkoFn = page.slice(page.indexOf('async function generatePlinkoBoardArt'), page.indexOf('async function generateChanceArt'));
  assert.ok(plinkoFn.length > 0, 'the board-artwork generation step body is found for the reference check');
  assert.ok(!plinkoFn.includes('referenceUrl'), 'board artwork generation passes NO reference image — text-to-image, so the creator\'s style words direct the art instead of the shipped board dominating it');
  assert.ok(!plinkoFn.includes('PLINKO_DEFAULT_BOARD_ART'), 'the house board is not wired into generation at all — it remains only the display fallback');
  assert.ok(plinkoFn.includes('generateAsset("image", plinkoBoardArtPrompt(plinkoArtStyleOf(tool.config)), { sourceKey: null, baseProject: current, aspectRatio: "auto", backdropEligible: false })'), 'the board artwork call mirrors the chance tools\' text-to-image call shape exactly');
  assert.ok(page.includes('backdropEligible: false'), 'board artwork is filed as a layer, never made the project background');
  for (const file of ['components/GameToolEditor.tsx', 'components/StandingToolFace.tsx', 'components/RuntimeActionLayers.tsx', 'components/GameshowToolDemos.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('plinkoBoardArtUrl'), `${file} resolves the board's own artwork`);
    assert.ok(source.includes('artSrc={plinkoBoardArtUrl(') || source.includes('artSrc={plinkoBoardArtUrl('), `${file} passes it to PlinkoDisplay`);
  }
  for (const file of ['app/api/jewel/route.ts', 'app/api/ai/route.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('config artStyle holding the creator\'s own style or theme words'), `${file} tells Jewel to pass the creator's style words at creation`);
    assert.ok(source.includes('the artwork never carries the slot values'), `${file} states the artwork never carries the values`);
    assert.ok(source.includes('never set config boardArtKey yourself'), `${file} keeps boardArtKey site-filled on restyles`);
  }
}

console.log('PASS: a Plinko board Jewel creates carries its own artwork — the prompt builder locks the composition (blank marquee, nine empty slots, no text, no dollar signs) around the creator\'s style words, the generated asset\'s key is stored on the tool by the attach patch, restyles retarget by artStyle diff, and every render surface resolves the board\'s own art with the neutral house board as fallback.');
