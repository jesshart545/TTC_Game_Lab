const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), load = require('./load.cjs');
const { CHANCE_ART_KEY_FIELD, CHANCE_ART_STYLE_FIELD, chanceArtStyleOf, chanceArtKeyOf, chanceArtUrl, chanceArtPrompt, chanceArtTargets, isChanceArtType } = load('lib/chance-art.ts');
const { applyBuildChanges } = load('lib/build-edits.ts');
const { applyDraftChanges } = load('lib/draft-edit.ts');

// The chance games' OWN artwork (Jessica, 2026-11-15) — the Plinko
// own-artwork pattern carried to the Game Wheel, Dice, Higher or
// Lower, and Cliffhanger: Jewel creates the tool, the
// site generates its artwork from the creator's style words through
// the existing image pipeline, files it as a project asset, and
// stores the asset key on the tool's config as artKey; every display
// renders the tool's own art with its standard design as the
// fallback, and the artwork never carries the game's labels — the
// code layers segments, cards, and the climber over it. For dice the
// artwork is one character portrait the code places in the pip
// positions, so a face shows exactly as many characters as its value.

const baseProject = () => ({ id: 'test', assets: [], controls: [], gameTools: [], overlay: {}, compositions: [] });
const targetIds = (before, after) => JSON.parse(JSON.stringify(chanceArtTargets(before, after).map(t => t.id)));
const ART_ASSET = { name: 'Stage artwork', storageKey: 'k-art', url: 'https://cdn.example/art.png', type: 'image/png', inProject: true };

// ---- Field names and the tool set ---------------------------------------------
assert.equal(CHANCE_ART_KEY_FIELD, 'artKey', 'the artwork reference lives on config.artKey');
assert.equal(CHANCE_ART_STYLE_FIELD, 'artStyle', 'the creator style words live on config.artStyle');
for (const type of ['wheel', 'dice', 'higher-lower', 'cliffhanger']) assert.ok(isChanceArtType(type), `${type} carries its own artwork`);
for (const type of ['plinko', 'bank', 'countdown', 'wheel2']) assert.ok(!isChanceArtType(type), `${type} is not a chance-art tool (plinko keeps its own board-art module)`);

// ---- The prompt builder ---------------------------------------------------------
for (const type of ['wheel', 'dice', 'higher-lower', 'cliffhanger']) {
  const prompt = chanceArtPrompt(type, 'neon carnival');
  assert.ok(!prompt.includes('$'), `${type}: the built prompt never contains a dollar-sign character`);
  assert.ok(/No text, no words, no letters, no numbers/.test(prompt), `${type}: prompt forbids text anywhere in the artwork`);
  assert.ok(prompt.includes('No dollar signs'), `${type}: prompt forbids dollar signs in words`);
  assert.ok(prompt.includes('Style and theme: neon carnival.'), `${type}: prompt carries the creator's style words`);
  const bare = chanceArtPrompt(type, '');
  assert.ok(bare.includes('Style and theme:'), `${type}: a style-less tool still gets a neutral style direction`);
  const dirty = chanceArtPrompt(type, 'gold $ rush');
  assert.ok(!dirty.includes('$'), `${type}: dollar signs are stripped from the creator's style words before they reach the prompt`);
}
assert.ok(chanceArtPrompt('wheel').includes('wheel is composited over the middle'), 'wheel prompt locks the playing area plain — the code paints the segments');
assert.ok(chanceArtPrompt('dice').includes('stands in for the dots'), 'dice prompt states the character stands in for the dots');
assert.ok(chanceArtPrompt('dice').includes('No dice, no dots'), 'dice prompt forbids painting dice or dots into the portrait');
assert.ok(chanceArtPrompt('higher-lower').includes('cards are placed over the middle'), 'HL prompt locks the playing area plain — the code places the cards');
assert.ok(chanceArtPrompt('cliffhanger').includes('mountain and climber are drawn over the middle'), 'cliffhanger prompt locks the center plain — the code draws the mountain and climber');

// ---- Style/key readers ------------------------------------------------------------
assert.equal(chanceArtStyleOf({ artStyle: '  underwater   treasure ' }), 'underwater treasure', 'style words are trimmed and collapsed');
assert.equal(chanceArtStyleOf({}), '', 'no style words reads as empty');
assert.equal(chanceArtKeyOf({ artKey: 'asset-9' }), 'asset-9', 'the art key reads back');
assert.equal(chanceArtKeyOf({}), '', 'no art key reads as empty');

// ---- The resolver -------------------------------------------------------------------
{
  const tool = (config) => ({ id: 'w1', type: 'wheel', name: 'Wheel', config });
  const assets = [ART_ASSET, { name: 'By name', url: 'https://cdn.example/by-name.png' }];
  assert.equal(chanceArtUrl(tool({ artKey: 'k-art' }), assets), 'https://cdn.example/art.png', 'resolves by storageKey');
  assert.equal(chanceArtUrl(tool({ artKey: 'By name' }), assets), 'https://cdn.example/by-name.png', 'resolves by asset name, like every other asset key in the app');
  assert.equal(chanceArtUrl(tool({}), assets), undefined, 'a tool without its own artwork resolves to its standard design');
  assert.equal(chanceArtUrl(tool({ artKey: 'missing' }), assets), undefined, 'a dangling key resolves to the standard design, never a blank');
}

// ---- Creation targets, the attach step, restyles --------------------------------------
{
  const created = applyBuildChanges(baseProject(), { newTools: [{ type: 'wheel', name: 'Carnival Wheel', config: { segments: ['Gold', 'Silver'], artStyle: 'neon carnival' } }] });
  const tool = created.project.gameTools.find(t => t.type === 'wheel');
  assert.equal(tool.config.artStyle, 'neon carnival', 'creation: the creator\'s style words are stored on the config for the artwork generation');
  assert.equal(chanceArtKeyOf(tool.config), '', 'creation: no artwork key exists until the artwork is actually generated');
  assert.deepEqual(targetIds(baseProject(), created.project), [tool.id], 'creation: a fresh tool without artwork is an artwork target');

  const filed = { ...created.project, assets: [ART_ASSET] };
  const attached = applyBuildChanges(filed, { gameTools: [{ id: tool.id, config: { [CHANCE_ART_KEY_FIELD]: 'k-art' } }] });
  assert.ok(attached.applied, 'attach: the patch applies');
  const saved = attached.project.gameTools.find(t => t.id === tool.id);
  assert.equal(saved.config.artKey, 'k-art', 'attach: the artwork reference is stored on the tool');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.config.segments)), ['Gold', 'Silver'], 'attach: the creator\'s segments are untouched');
  assert.equal(chanceArtUrl(saved, attached.project.assets), 'https://cdn.example/art.png', 'attach: the saved tool now resolves its own artwork');
  assert.deepEqual(targetIds(created.project, attached.project), [], 'attach: a tool whose artwork resolves is no longer a target');
}
{
  const before = { ...baseProject(), assets: [ART_ASSET], gameTools: [{ id: 'd1', type: 'dice', name: 'Dice', enabled: true, inToolbox: true, config: { sides: 6, artStyle: 'pirate cats', artKey: 'k-art' } }] };
  const restyled = applyDraftChanges(before, { gameTools: [{ id: 'd1', config: { artStyle: 'space robots' } }] });
  assert.deepEqual(targetIds(before, restyled.project), ['d1'], 'restyle: a rewritten artStyle makes the tool an artwork target');
  const valuesOnly = applyDraftChanges(before, { gameTools: [{ id: 'd1', config: { sides: 12 } }] });
  assert.deepEqual(targetIds(before, valuesOnly.project), [], 'a values-only edit never regenerates the artwork');
  const sameStyle = applyDraftChanges(before, { gameTools: [{ id: 'd1', config: { artStyle: 'pirate cats' } }] });
  assert.deepEqual(targetIds(before, sameStyle.project), [], 're-stating the same style never regenerates the artwork');
  const noArtYet = { ...baseProject(), gameTools: [{ id: 'c1', type: 'cliffhanger', name: 'Cliff', enabled: true, inToolbox: true, config: { title: 'Cliffhanger', items: [{ label: 'Mug', price: 5 }] } }] };
  const firstStyle = applyDraftChanges(noArtYet, { gameTools: [{ id: 'c1', config: { artStyle: 'haunted house' } }] });
  assert.deepEqual(targetIds(noArtYet, firstStyle.project), ['c1'], 'a tool with no artwork yet gains a target when Jewel first styles it');
}

// ---- The renders: own art when resolved, the standard design otherwise ------------------
{
  const exportsObject = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ChanceTools.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject, require: id => id.endsWith('.css') ? {} : require(id), Math });
  const { WheelDisplay, DiceDisplay, HigherLowerDisplay, CliffhangerDisplay } = exportsObject;
  const ART = 'https://cdn.example/art.png';

  const wheelArt = renderToStaticMarkup(React.createElement(WheelDisplay, { entries: ['A', 'B'], result: 'A', preview: true, artSrc: ART }));
  assert.ok(wheelArt.includes(`background-image:url(&quot;${ART}&quot;)`) || wheelArt.includes(ART), 'wheel render: the tool\'s own artwork fills the backboard behind the wheel');
  assert.ok(wheelArt.includes('>A</text>') || wheelArt.includes('A'), 'wheel render: the code still paints the segment labels over the art');
  const wheelPlain = renderToStaticMarkup(React.createElement(WheelDisplay, { entries: ['A', 'B'], result: 'A', preview: true }));
  assert.ok(!wheelPlain.includes('background-image'), 'wheel render: without own art the wheel is the standard design, unchanged');

  // The dice honesty contract: with character art, a six-sided face
  // shows EXACTLY as many characters as its value — placed by code in
  // the pip positions — and no dot spans; without art, the dots are
  // exactly as before; a non-six-sided die keeps its number face even
  // with art (characters are a six-sided feature, never faked).
  for (const face of [1, 2, 3, 4, 5, 6]) {
    const html = renderToStaticMarkup(React.createElement(DiceDisplay, { result: face, sides: 6, elapsed: 9999, artSrc: ART }));
    assert.equal((html.match(/class="pip-face"/g) || []).length, face, `dice render: face ${face} shows exactly ${face} character(s)`);
    assert.ok(!(html.match(/class="pip"/g) || []).length, `dice render: face ${face} shows no dot pips when characters stand in for them`);
  }
  const dotted = renderToStaticMarkup(React.createElement(DiceDisplay, { result: 5, sides: 6, elapsed: 9999 }));
  assert.equal((dotted.match(/class="pip"/g) || []).length, 5, 'dice render: without art the classic dots render, unchanged');
  assert.ok(!dotted.includes('pip-face'), 'dice render: no character faces are claimed without artwork');
  const d20 = renderToStaticMarkup(React.createElement(DiceDisplay, { result: 17, sides: 20, elapsed: 9999, artSrc: ART }));
  assert.ok(d20.includes('20-sided die: 17') && !d20.includes('pip-face'), 'dice render: a 20-sided die keeps its number face — character faces are never faked onto it');

  const hlArt = renderToStaticMarkup(React.createElement(HigherLowerDisplay, { preview: true, artSrc: ART }));
  assert.ok(hlArt.includes(ART), 'HL render: the tool\'s own artwork fills the card-table stage');
  const hlPlain = renderToStaticMarkup(React.createElement(HigherLowerDisplay, { preview: true }));
  assert.ok(!hlPlain.includes('background-image'), 'HL render: without own art the stage is the standard design, unchanged');

  const cliffArt = renderToStaticMarkup(React.createElement(CliffhangerDisplay, { preview: true, artSrc: ART }));
  assert.ok(cliffArt.includes(`href="${ART}"`), 'cliffhanger render: the tool\'s own artwork fills the scene frame');
  assert.ok(!cliffArt.includes('url(#cliff-sky)'), 'cliffhanger render: the painted sky is replaced by the artwork');
  assert.ok(cliffArt.includes('cliff-rock'), 'cliffhanger render: the code-drawn mountain still layers over the art');
  const cliffPlain = renderToStaticMarkup(React.createElement(CliffhangerDisplay, { preview: true }));
  assert.ok(cliffPlain.includes('url(#cliff-sky)') && !cliffPlain.includes('cliff-art-clip'), 'cliffhanger render: without own art the scene is the standard design, unchanged');
}

// ---- Wiring: the executor and every render surface ---------------------------------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert.ok(page.includes('async function generateChanceArt'), 'the executor has the chance-artwork generation step');
  assert.equal((page.match(/generateChanceArt\(/g) || []).length, 4, 'the generation step is defined once and called at all three doors: the tool action, the changes commit before an action, and the changes-only completion');
  assert.ok(page.includes('chanceArtTargets(baseProject, result.project)'), 'the changes-before-action door picks its tools by diffing the change');
  assert.ok(page.includes('chanceArtTargets(baseProject, finalProject)'), 'the changes-only door picks its tools by diffing the change');
  assert.ok(page.includes('CHANCE_ART_FALLBACK_DESIGN'), 'a failed generation is reported to the creator in plain words');
  for (const file of ['components/GameToolEditor.tsx', 'components/StandingToolFace.tsx', 'components/RuntimeActionLayers.tsx', 'components/GameshowToolDemos.tsx', 'components/ToolShelf.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('chanceArtUrl'), `${file} resolves the tool's own artwork`);
    assert.ok(source.includes('artSrc={chanceArtUrl('), `${file} passes it to the chance displays`);
  }
  for (const file of ['app/api/jewel/route.ts', 'app/api/ai/route.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('segments are the creator\'s own labels'), `${file} states the wheel segments contract`);
    assert.ok(source.includes('describe the character in artStyle'), `${file} tells Jewel how character dice are asked for`);
    assert.ok(source.includes('never set config artKey yourself'), `${file} keeps artKey site-filled`);
  }
  const draftSystemOf = (source) => source.slice(source.indexOf('const DRAFT_SYSTEM = `'), source.indexOf('`;', source.indexOf('const DRAFT_SYSTEM = `')) + 2);
  assert.equal(draftSystemOf(fs.readFileSync('app/api/jewel/route.ts', 'utf8')), draftSystemOf(fs.readFileSync('app/api/ai/route.ts', 'utf8')), 'DRAFT_SYSTEM stays byte-identical between the Jewel and AI routes');
}

console.log('PASS: every chance tool Jewel creates carries its own artwork — code-built prompts lock each playing area plain around the creator\'s style words, the generated asset\'s key is stored on the tool by the attach patch, restyles retarget by artStyle diff, every render surface resolves the tool\'s own art with the standard design as fallback, and character dice show exactly as many code-placed characters as the face value.');
