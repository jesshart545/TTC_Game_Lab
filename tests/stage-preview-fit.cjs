const assert = require('node:assert/strict');
const fs = require('node:fs');

// --- CSS contract: the Build Space overlay stage fits inside its canvas ---
// The stage is sized by width alone (width + aspect-ratio), and the overlay preview
// scaler keys off the frame width, so the fit has to come from capping the WIDTH.
// Clamping the height instead would crop the frame. v1 capped the width from the
// viewport height minus an estimate of the chrome above the frame; the estimate's
// slack was eaten by real chrome variance and the frame's bottom was still cut off
// on a 1366x768 screen. v2 measures instead: at >=1000px the overlay canvas is a
// size container and the stage width is capped by the canvas's own height (cqh),
// with the dvh rules kept underneath as the fallback for older browsers.
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

// The overlay canvas — and only it — is a size container, and only at >=1000px,
// where the height:100% chain gives it a definite height. (In BuildSpace.tsx the
// overlay canvas is the first canvas in the stage area: nth-child(2), after the
// preview toggle; the dashboard canvas is nth-child(3) and is NOT a container.
// At <=999px the canvas height is content-driven and size containment would
// collapse it, so no container-type may appear outside the >=1000px block.)
const containerRule = '.build-space-compact .assembly-canvas:nth-child(2){container-type:size}';
assert(css.includes(containerRule), 'Overlay canvas is a size container on desktop');
assert.equal(css.split('container-type:size').length - 1, 1, 'container-type:size is declared exactly once (overlay canvas only)');
const desktopBlockStart = css.indexOf('@media(min-width:1000px){');
const desktopBlockEnd = css.indexOf('@media(min-width:1000px) and (max-width:1199px){');
assert(css.indexOf(containerRule) > desktopBlockStart && css.indexOf(containerRule) < desktopBlockEnd, 'The size container is declared inside the >=1000px block only');

// Fallback layer (kept, unchanged): the dvh width caps from v1.
const midDvhRule = '.build-space-compact .assembly-canvas>.stage{width:min(100%,calc(32dvh * 16 / 9));margin:0 auto}';
const wideDvhRule = '.build-space-compact .assembly-canvas>.stage{width:min(100%,calc((100dvh - 320px) * 16 / 9));margin:0 auto}';
assert(css.includes(midDvhRule), 'The 1000-1199px band keeps its dvh stage cap as the fallback');
assert(css.includes(wideDvhRule), 'The >=1200px band keeps its dvh stage cap as the fallback');
assert(css.includes('.build-space-compact .assembly-canvas>.stage{width:min(100%,calc(35dvh * 16 / 9));margin:0 auto}'), 'The <=760px band keeps its dvh stage cap (undisturbed)');

// Measured layer: in BOTH desktop bands the stage width is capped by the canvas
// height — width:min(100%, (100cqh - 54px) * 16 / 9) — and each cqh rule is
// declared AFTER its band's dvh fallback (same selector, later wins) so
// supporting browsers measure while older ones fall back to the estimate.
const cqhRule = '.build-space-compact .assembly-canvas>.stage{width:min(100%,calc((100cqh - 54px) * 16 / 9))}';
assert.equal(css.split(cqhRule).length - 1, 2, 'The container-height cap is declared in both desktop bands');
const firstCqh = css.indexOf(cqhRule);
const secondCqh = css.indexOf(cqhRule, firstCqh + 1);
assert(css.indexOf(midDvhRule) < firstCqh, 'In the 1000-1199px band the cqh cap is declared after the dvh fallback');
assert(css.indexOf(wideDvhRule) > firstCqh && css.indexOf(wideDvhRule) < secondCqh, 'In the >=1200px band the cqh cap is declared after the dvh fallback');

// The Dashboard preview side is untouched: its canvas still scrolls internally,
// and the Library column keeps its PR #98 height behaviour.
assert(css.includes('.build-space-compact .dashboard-canvas{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}'), 'Dashboard preview canvas still scrolls internally on desktop');
assert(css.includes('.build-space-compact .build-library{height:100%;max-height:min(100%,calc(100dvh - 24px))}'), 'Library column keeps its PR #98 height behaviour');

// --- Geometry: mirror the shipped calc ---
// RESERVE = 54px: canvas vertical padding 20 + the "Draft overlay" heading block
// ~29 (16px font, ~19px line, 10px bottom margin) + ~5px slack. (100cqh is the
// canvas content-box height, which already excludes the padding and border, so
// the real safety margin is larger than the arithmetic below assumes.)
const RESERVE = 54;
const HEADING = 29; // heading block above the stage inside the canvas
const CANVAS_FRAME = 22; // border (2) + vertical padding (20) around the content box
function frameHeight(canvasHeight, columnWidth) {
  const width = Math.min(columnWidth, (canvasHeight - RESERVE) * 16 / 9);
  return width * 9 / 16;
}
// The owner's 1366x768-class screen: canvas ~420px tall, stage column ~636px.
assert(frameHeight(420, 636) <= 420 - RESERVE, 'At canvas 420 the frame height leaves the full reserve above it');
assert(HEADING + frameHeight(420, 636) <= 420 - CANVAS_FRAME, 'At canvas 420 the heading plus the whole frame fit inside the canvas content box — fully visible, no scrolling');
// A mid-size canvas binds by height, not by the column.
assert.equal(frameHeight(500, 900), 500 - RESERVE, 'At canvas 500 the container cap is what sizes the frame');
// A tall 1920x1080 window: canvas ~860px, column ~1182px — the container cap
// (≈1433px wide) exceeds the column, so the frame is exactly as wide as today.
assert.equal(frameHeight(860, 1182), 1182 * 9 / 16, 'At canvas ~860 (1080p window) the cap does not shrink the stage — large screens unchanged');

console.log('PASS: Build Space overlay stage is sized from the overlay canvas\'s real height (size container + 100cqh cap, RESERVE 54px) in both desktop bands, layered over the unchanged dvh fallbacks; at the owner\'s canvas height the whole 16:9 frame fits inside the canvas, at 1080p nothing changes; the <=760px cap, the Dashboard preview internal scroll, and the Library column height behaviour are unchanged.');
