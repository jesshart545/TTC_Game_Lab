const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), load = require('./load.cjs');
const { PLINKO_DEFAULT_BOARD_ART, plinkoBoardArtPrompt } = load('lib/plinko-art.ts');

// On the published overlay a Plinko is THE BOARD ITSELF (Jessica,
// 2026-11-15, after the live "dark panel" frame): its artwork filling
// its box, fitted to the board's wide shape and centered, ball/slots/
// result over it — no panel slab, no heading, no scrollbar at any
// placement size, and the artwork NEVER renders blank. The live
// failure had three stacked causes, each pinned below:
//  (1) the fired-tool wrapper (ToolRun) dressed every tool in a panel
//      — dark background, border, padding, an <h3> title, a separate
//      artwork strip — with overflow:auto, so content taller than
//      the placement box scrolled;
//  (2) the board was capped at 600px wide inside whatever box it was
//      given, floating in the panel instead of filling it;
//  (3) the artwork <image> trusted its URL blindly: the published
//      snapshot's asset record still resolved after the stored object
//      behind it was deleted (verified NoSuchKey), so the board
//      rendered with no artwork at all.
// And the fallback board itself: the neutral house board, never the
// first board Jessica uploaded — she ruled her board is not the face
// of every Plinko game.

const OLD_BOARD = '/game-art/plinko-board.webp';
const HOUSE_BOARD = '/game-art/plinko-board-default.webp';

// ---- The default board is the neutral house board ---------------------------
assert.equal(PLINKO_DEFAULT_BOARD_ART, HOUSE_BOARD, 'the default/fallback board is the neutral house board');
assert.notEqual(PLINKO_DEFAULT_BOARD_ART, OLD_BOARD, 'the default board is NOT Jessica\u2019s uploaded neon board');
assert.ok(fs.existsSync('public/game-art/plinko-board-default.webp'), 'the neutral house board ships in public/game-art');
{
  const chance = fs.readFileSync('components/ChanceTools.tsx', 'utf8');
  assert.ok(chance.includes(`const PLINKO_HOUSE_BOARD = "${HOUSE_BOARD}"`), 'the display\u2019s local fallback literal matches the shared default constant');
}

// ---- The generation prompt carries the quality floor -------------------------
{
  for (const words of ['underwater coral reef', '']) {
    const prompt = plinkoBoardArtPrompt(words);
    assert.ok(prompt.includes('Quality floor, whatever the theme'), 'the quality-floor clause is unconditional');
    assert.ok(prompt.includes('glowing marquee bulbs') && prompt.includes('flagship television game-show cabinet'), 'the floor benchmarks detail and finish against a generic flagship cabinet');
    assert.ok(prompt.includes('exactly nine empty open slot boxes'), 'the composition locks stay');
  }
  const barePrompt = plinkoBoardArtPrompt('');
  assert.ok(barePrompt.includes('always an original design built from the creator\'s own specification'), 'generated boards are original designs from the requesting creator’s own spec');
  assert.ok(!/dial/i.test(barePrompt) && !/neon/i.test(barePrompt) && !/standard board/i.test(barePrompt) && !/uploaded/i.test(barePrompt), 'the built prompt never evokes Jessica\u2019s board — her board is the detail bar only, never a look to resemble');
}

// ---- The artwork never renders blank -----------------------------------------
{
  const chance = fs.readFileSync('components/ChanceTools.tsx', 'utf8');
  assert.ok(chance.includes('artBroken') && chance.includes('probe.onerror') && chance.includes('onError={()=>setArtBroken(true)}'), 'a failed artwork load swaps in the house board (probe + image error)');
  assert.ok(chance.includes('const boardSrc=ownArt?artSrc:PLINKO_HOUSE_BOARD'), 'the rendered image source is the tool\u2019s own art only while it loads — otherwise the house board');

  const exportsObject = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ChanceTools.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject, require: id => id.endsWith('.css') ? {} : require(id), Math });
  const { PlinkoDisplay } = exportsObject;
  const bare = renderToStaticMarkup(React.createElement(PlinkoDisplay, { slots: ['10', '50'], preview: true }));
  assert.ok(bare.includes(`href="${HOUSE_BOARD}"`), 'render: no own art renders the house board');
  assert.ok(!bare.includes('chance-tool-fill'), 'render: without fill the display keeps its standard (editor) layout');
  const own = renderToStaticMarkup(React.createElement(PlinkoDisplay, { slots: ['10', '50'], preview: true, artSrc: 'https://cdn.example/own.png' }));
  assert.ok(own.includes('href="https://cdn.example/own.png"'), 'render: a resolved own artwork renders');
  const filled = renderToStaticMarkup(React.createElement(PlinkoDisplay, { slots: ['10', '50'], preview: true, fill: true }));
  assert.ok(filled.includes('chance-tool-fill'), 'render: fill mode carries the board-fill class');
}

// ---- No scrollbar, board fitted to its box ------------------------------------
{
  const css = fs.readFileSync('components/chance-tools.css', 'utf8');
  assert.ok(css.includes('.chance-tool-fill{display:flex;flex-direction:column;width:100%;height:100%'), 'fill mode is exactly the box\u2019s height');
  assert.ok(css.includes('.chance-tool-fill .chance-plinko{flex:1 1 auto;min-height:0;width:100%;max-width:none'), 'the board area fills the width and shrinks to fit — no 600px cap in fill mode');
  assert.ok(css.includes('.chance-tool-fill .chance-plinko svg{width:100%;height:100%'), 'the board scales to fit both dimensions (its own meet fitting centers it)');
  const fillCss = css.slice(css.indexOf('.chance-tool-fill'));
  assert.ok(!/overflow\s*:\s*(auto|scroll)/.test(fillCss), 'fill mode never scrolls');

  const runtime = fs.readFileSync('components/RuntimeActionLayers.tsx', 'utf8');
  const toolRun = runtime.slice(runtime.indexOf('function ToolRun'), runtime.indexOf('export function ControlAppearancePreview'));
  assert.ok(toolRun.includes('overflow:isPlinko?"hidden":"auto"'), 'the fired Plinko\u2019s overlay wrapper cannot scroll (other tools unchanged)');
  assert.ok(toolRun.includes('...(isPlinko?{backgroundColor:"transparent",border:"none",padding:0}:{})'), 'the fired Plinko gets no panel background, border, or padding');
  assert.ok(toolRun.includes('{!isPlinko && <ToolArtwork') && toolRun.includes('{!isPlinko && toolShowsTitle(tool) && <h3>'), 'no artwork strip and no heading slab around a fired Plinko — the only title is inside the board graphic');
  assert.ok(toolRun.includes('<PlinkoDisplay fill '), 'the fired Plinko renders in board-fill mode');

  const overlay = fs.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
  assert.ok(overlay.includes('<StandingToolFace tool={activeTool} project={project} fill/>'), 'a standing Plinko on the published overlay renders in board-fill mode');
  assert.ok(overlay.includes('backgroundColor:"transparent",border:"none",padding:0,overflow:"hidden"'), 'the standing Plinko\u2019s overlay wrapper is panel-free and cannot scroll');
  const face = fs.readFileSync('components/StandingToolFace.tsx', 'utf8');
  assert.ok(face.includes('<PlinkoDisplay fill={fill} '), 'the standing face passes fill through to the board');
}

// ---- Jessica's boards stay hers ------------------------------------------------
// Her first uploaded board (the neon cabinet) may be referenced ONLY
// by the flagged home-page news card (app/home-page.tsx, "Plinko's
// neon board" — a news item about that specific board, left for her
// word; the shipped file stays only because that card uses it). Every
// playable/shelf/default surface uses the neutral house board. Her
// rainbow board uploaded into the "Update Proof Night" project is
// confined to that project: no code path, template, demo, or shipped
// asset may reference it at all.
{
  const skipDirs = new Set(['node_modules', '.git']);
  const binaryExt = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.mp3', '.mp4', '.zip']);
  const allowed = new Map([
    ['app/home-page.tsx', 'flagged news card about her specific board — hers to retire'],
    ['tests/plinko-own-art.cjs', 'the not-equal pin naming the old path'],
    ['tests/plinko-overlay-board.cjs', 'this guard'],
  ]);
  const offenders = [];
  const rainbowRefs = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative('.', full);
      if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(full); continue; }
      if (binaryExt.has(path.extname(entry.name).toLowerCase())) continue;
      let text; try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
      if (text.includes(OLD_BOARD) && !allowed.has(rel)) offenders.push(rel);
      if (text.includes('plinko_gameshow_board')) rainbowRefs.push(rel);
    }
  };
  walk('.');
  assert.deepEqual(offenders, [], `the old board path is referenced only where flagged: ${offenders.join(', ')}`);
  assert.deepEqual(rainbowRefs.filter(r => r !== 'tests/plinko-overlay-board.cjs'), [], 'the rainbow board from Update Proof Night is referenced nowhere in the repo');
  assert.ok(!fs.existsSync('public/game-art/plinko-board.webp') || fs.readFileSync('app/home-page.tsx', 'utf8').includes(OLD_BOARD), 'the shipped copy of her board exists only while the flagged news card uses it');
}

console.log('PASS: on the overlay a Plinko is the board itself — artwork always resolvable (own art, else the neutral house board, with a load-failure swap), fitted to its box on both axes, no panel, no heading, no scrollbar; her boards stay hers.');
