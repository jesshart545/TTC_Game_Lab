const assert = require('node:assert/strict');
const fs = require('node:fs');

// --- CSS contract: the Build Space overlay stage fits the visible screen height ---
// The stage is sized by width alone (width + aspect-ratio), and the overlay preview
// scaler keys off the frame width, so the fit has to come from capping the WIDTH by
// the available screen height. Clamping the height instead would crop the frame.
const css = fs.readFileSync('app/project/[id]/workflow.css', 'utf8');
function ruleBody(selector) {
  // Base rules start at the beginning of a line; this skips scoped overrides
  // inside media queries.
  const start = css.indexOf('\n' + selector + '{');
  assert(start >= 0, `Missing CSS rule for ${selector}`);
  const open = css.indexOf('{', start);
  const end = css.indexOf('}', open);
  return css.slice(open + 1, end);
}

// The desktop Build Space is a height-capped frame the stage column lives inside.
assert(css.includes('.build-space-compact{height:calc(100dvh - 24px);min-height:540px;display:flex;flex-direction:column;overflow:hidden}'), 'Desktop Build Space is capped at the viewport height');
assert(css.includes('.build-space-compact .build-work-area{flex:1;min-height:0;overflow:hidden}'), 'Desktop work area takes the capped height left under the Build Space toolbar');

// The stage itself stays exactly 16:9 and is never height-clamped (no cropping).
const stageRule = ruleBody('.build-space-compact .assembly-canvas>.stage');
assert(stageRule.includes('aspect-ratio:16/9'), 'Overlay stage keeps its 16:9 aspect ratio');
assert(stageRule.includes('width:100%'), 'Overlay stage base sizing is width-driven');
assert(stageRule.includes('height:auto') && !stageRule.includes('max-height'), 'Overlay stage height is never clamped, so the frame cannot be cropped');

// Wide desktops (1200px+): the stage width is capped by the screen height left
// under the Build Space chrome, so the whole frame is visible at once.
assert(css.includes('@media(min-width:1200px)'), 'A wide-desktop band carries the height fit');
assert(css.includes('.build-space-compact .assembly-canvas>.stage{width:min(100%,calc((100dvh - 320px) * 16 / 9));margin:0 auto}'), 'Wide-desktop overlay stage width is capped by the screen height left under the chrome, centered in its canvas');

// The neighbouring bands keep their existing height caps (undisturbed).
assert(css.includes('.build-space-compact .assembly-canvas>.stage{width:min(100%,calc(32dvh * 16 / 9));margin:0 auto}'), 'The 1000-1199px band keeps its dvh stage cap');
assert(css.includes('.build-space-compact .assembly-canvas>.stage{width:min(100%,calc(35dvh * 16 / 9));margin:0 auto}'), 'The <=760px band keeps its dvh stage cap');

// The Dashboard preview side is untouched: its canvas still scrolls internally.
assert(css.includes('.build-space-compact .dashboard-canvas{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}'), 'Dashboard preview canvas still scrolls internally on desktop');
assert(css.includes('.build-space-compact .build-library{height:100%;max-height:min(100%,calc(100dvh - 24px))}'), 'Library column keeps its PR #98 height behaviour');

// --- Geometry: mirror the shipped calc at a 1920px-wide window (stage column ~1182px) ---
const columnWidth = 1182;
const uncappedHeight = columnWidth * 9 / 16; // ~665px, purely width-driven
function stageHeight(viewportHeight) {
  const width = Math.min(columnWidth, (viewportHeight - 320) * 16 / 9);
  return width * 9 / 16;
}
assert.equal(stageHeight(1080), uncappedHeight, 'At 1080px tall the cap does not shrink the stage');
for (const h of [900, 800, 700]) {
  assert(stageHeight(h) < uncappedHeight, `At ${h}px tall the cap scales the stage down`);
  assert(stageHeight(h) <= h - 320, `At ${h}px tall the whole frame height fits the space under the chrome`);
}

// --- Measured fit: on desktop the stage width is ALSO fitted from the canvas's
// real rendered size (ResizeObserver in BuildSpace), because the dvh estimates
// above cannot know the true space on any given screen. (PR #102 tried CSS
// container queries for this and broke the live preview; it was reverted, and
// container queries are banned here.)
const load = require('./load.cjs');
const { stageFitWidth } = load('lib/build-controls.ts');
const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');

assert(!css.includes('container-type') && !css.includes('cqh') && !css.includes('cqw'), 'workflow.css uses no container queries or container units');
assert(!buildSpace.includes('container-type') && !buildSpace.includes('cqh') && !buildSpace.includes('cqw'), 'BuildSpace uses no container queries or container units');

// The helper's contract: undefined = no usable measurement (keep the last
// width); null = measurable but no room (fall back to the CSS width); a number
// = the widest 16:9 stage that fits beside its siblings, never under 200px.
assert.equal(stageFitWidth(0, 420, 68), undefined, 'Hidden canvas (zero width) yields no measurement');
assert.equal(stageFitWidth(636, 0, 68), undefined, 'Hidden canvas (zero height) yields no measurement');
assert.equal(stageFitWidth(636, 60, 68), null, 'Canvas shorter than its siblings falls back to the CSS width');
assert.equal(stageFitWidth(636, 180, 68), null, 'Room for only a sub-200px stage falls back instead of squeezing');
assert.equal(stageFitWidth(300, 900, 68), 300, 'Width-bound canvas: the stage takes the full content width');
assert.equal(stageFitWidth(1182, 860, 68), 1182, 'Tall 1080p-class canvas: the fit does not shrink the stage below its column width');
assert.equal(stageFitWidth(636, 398, 68), 586, 'A 68px sibling load makes the fit height-bound at the same canvas size');
assert(586 * 9 / 16 + 68 <= 398, 'At the fitted width, the whole frame plus a 68px sibling load fits inside the canvas content box');
// The canvas's only sibling beside the stage is now its heading (~34px: 16px
// font plus its bottom margin) — the placed-items row moved to the inspector —
// so on the owner's laptop the fit turns width-bound and the stage grows.
assert.equal(stageFitWidth(636, 398, 34), 636, "Owner's 1366x768 laptop (canvas content ~398px tall, stage column ~636px wide): with only the heading beside the stage, the fitted width is the full column width");
assert(636 * 9 / 16 + 34 <= 398, 'At the fitted width, the whole frame plus its heading fit inside the canvas content box');

// The wiring: refs and state in BuildSpace, scoped to the compact overlay canvas.
assert(buildSpace.includes('stageFitWidth(contentWidth,contentHeight,siblingsHeight)'), 'BuildSpace computes the fit through the tested helper');
assert(buildSpace.includes('const overlayCanvasRef=useRef<HTMLElement>(null)'), 'BuildSpace holds a ref for the overlay canvas');
assert.equal((buildSpace.match(/ref=\{overlayCanvasRef\}/g) || []).length, 1, 'Exactly one element — the overlay canvas — carries the measuring ref; the dashboard canvas is untouched');
assert(buildSpace.includes('style={fittedStageWidth?{width:fittedStageWidth}:undefined}'), 'The stage takes the fitted width as an inline style, and no inline width until a fit is measured (CSS caps govern first paint)');
assert(buildSpace.includes('new Observer(measure);observer.observe(canvas)'), 'A ResizeObserver on the canvas keeps the fit live as the canvas resizes');
assert(!buildSpace.includes("querySelector(':scope > .placed-items')"), 'The fit observes only the canvas itself — no placed-items row lives in the canvas to observe');
assert(buildSpace.includes("if(!canvas.clientWidth||!canvas.clientHeight)return;"), 'Zero-size (hidden) measurements are ignored, keeping the last fitted width');
assert(buildSpace.includes("matchMedia?.('(min-width: 1000px)')"), 'The measured fit stays scoped to the desktop compact frame; narrower layouts keep the CSS behaviour');

// --- Placed-items row: the pills used to render inside the overlay canvas,
// directly after the stage, so the measured fit above reserved their height.
// But inside the preview card they render as rows of tabs — with ~15 placed
// items, three rows of pills under the frame eating the staging area and
// shrinking the actual stage to a small picture. Owner ruling (2026-11-01):
// the tabs must NOT be in the overlay preview area; the preview is the
// staging place. No placed item can be selected by clicking it on the stage
// itself (the background renders pointer-events:none, the layer container
// is pointer-events:none, tool layers carry no selection handlers, and
// placed audio has no stage presence at all), so the row is not deleted —
// it renders in the left "Items and editing" panel instead, with the same
// pills, the same click-to-select handlers and the same order. The canvas
// now holds only its heading and the stage, the measured fit reserves just
// the heading, and the stage grows into the freed space. The PR #106
// stage-area geometry stands unchanged: on desktop the stage area is a flex
// column, the toggle keeps its own height, the overlay canvas flexes into
// what is left, and the dashboard canvas keeps its full-height box.
const desktopBlock = css.slice(css.indexOf('@media(min-width:1000px){'), css.indexOf('@media(min-width:1000px) and (max-width:1199px)'));
assert(desktopBlock.includes('.build-space-compact .build-stage-area{display:flex;flex-direction:column;height:100%;min-height:0}'), 'On desktop the stage area is a full-height flex column, so the toggle takes its height off the top');
assert(desktopBlock.includes('.build-space-compact .assembly-canvas:nth-child(2){flex:1}'), 'The overlay canvas flexes into the space left under the toggle instead of taking the full stage-area height');
assert(desktopBlock.includes('.build-space-compact .assembly-canvas:nth-child(3){flex:none}'), 'The dashboard canvas keeps its existing full-height box (flex:none), untouched');
const canvasStart = buildSpace.indexOf('ref={overlayCanvasRef}');
assert(canvasStart >= 0, 'The overlay canvas section is present in BuildSpace');
const canvasJsx = buildSpace.slice(canvasStart, buildSpace.indexOf('</section>', canvasStart));
assert(canvasJsx.includes('className="stage"'), 'The stage still renders inside the overlay canvas the fit measures');
assert(!canvasJsx.includes('placed-items') && !canvasJsx.includes('Placed overlay items'), 'No placed-item pills render inside the overlay preview canvas — the preview card holds only the heading and the stage');
// The row's new home: the left inspector, ahead of the canvases, unchanged pills.
const rowStart = buildSpace.indexOf('aria-label="Placed overlay items"');
assert(rowStart >= 0, 'The Placed overlay items row still renders');
assert(buildSpace.indexOf('aria-label="Items and editing"') < rowStart && rowStart < buildSpace.indexOf('paired-canvases'), 'The Placed overlay items row renders in the left Items and editing panel, outside the preview area');
const rowJsx = buildSpace.slice(rowStart, buildSpace.indexOf('</section>', rowStart));
assert(rowJsx.includes('project.assets.filter(a=>a.inProject)') && rowJsx.includes('project.gameTools.filter(t=>t.inOverlayBuild)'), 'The relocated row lists the same placed assets and overlay tools');
assert(rowJsx.indexOf('project.assets.filter') < rowJsx.indexOf('project.gameTools.filter'), 'The relocated row keeps the same order: assets first, then tools');
assert(rowJsx.includes('setSelection({kind:"asset",id:key(a)})') && rowJsx.includes('setSelection({kind:"tool",id:t.id})'), 'The relocated pills keep the same click-to-select behaviour');

console.log('PASS: Build Space overlay stage is width-capped by the screen height left under the chrome on wide desktops (16:9 preserved, never cropped); the 1000-1199px and <=760px caps, the Dashboard preview internal scroll, and the Library column height behaviour are unchanged; on desktop the width is additionally fitted from the overlay canvas\u2019s measured content box (the canvas heading keeps its room and the stage takes the space the relocated placed-items row freed, 200px floor with CSS fallback, no container queries).');
