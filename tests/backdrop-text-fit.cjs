const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

// Backdrop text sizing (lib/backdrop-text.ts fitBackdropTextSize, used by
// components/BackdropText.tsx). The SIGN letters as large as the frame
// allows — a title's job. The opening PROMPT (placement "lower") is a
// talking-point sentence worn low on the background; it shares the
// layer but must fit like a broadcast lower-third, capped per line and
// per block. Live defects this guards: on the test talk project the
// prompt "Tonight's talking point: small habits, big change" fitted
// under the title's rules at ~180px a line, four lines deep — over
// three quarters of the frame — burying the sign and the backdrop;
// and, after the caps, a script-font sign whose line box fit the
// frame while its painted glyphs crossed the top edge and cropped —
// the fit now budgets the font's painted (bounding-box) extent, not
// the line box.

const {
  fitBackdropTextSize, cleanBackdropText,
  PROMPT_LINE_MAX_RATIO, PROMPT_BLOCK_MAX_RATIO,
} = load('lib/backdrop-text.ts');
const { fontCatalog } = load('lib/fonts.ts');
const FONT = fontCatalog[0].family;

// Deterministic stand-in for a heavy display font's measure: every
// character (spaces included) advances 0.52em, and the font's ink
// extents span 0.9em — the proportions the real canvas fit sees,
// fixed so the assertions are exact. The fit budgets the block's
// PAINTED height: (lines - 1) line heights plus one line's ink.
const measure = (text, px) => ({ width: text.length * px * 0.52, inkAscent: px * 0.75, inkDescent: px * 0.15 });
const wrapLines = (text, px, width) => {
  const maxWidth = width * 0.88;
  let lines = 1, line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word;
    if (measure(trial, px).width > maxWidth && line) { lines += 1; line = word; } else line = trial;
  }
  return lines;
};
const blockShare = (text, px, width, height) => ((wrapLines(text, px, width) - 1) * px * 1.16 + px * 0.9) / height;

const SAMPLE_PROMPT = "Tonight's talking point: small habits, big change";
const LINE_CAP_1080 = Math.floor(1080 * PROMPT_LINE_MAX_RATIO);

// --- The live defect, corrected ---------------------------------------------
{
  const size = fitBackdropTextSize({ text: SAMPLE_PROMPT, width: 1920, height: 1080, lower: true, measure });
  assert.equal(size, LINE_CAP_1080, 'the prompt fits AT its lower-third line cap, not at title scale');
  assert.equal(wrapLines(SAMPLE_PROMPT, size, 1920), 2, 'the sample prompt wraps to two caption lines');
  assert.ok(blockShare(SAMPLE_PROMPT, size, 1920, 1080) <= PROMPT_BLOCK_MAX_RATIO, 'the prompt block stays within its share of the frame');
  assert.ok(size >= 40, 'corrected, not crushed — still a bold, legible lower-third');
  console.log('PASS: the oversized case — the sample prompt now fits at the corrected caption scale.');
}

// --- The sign's fit is untouched --------------------------------------------
{
  const sign = fitBackdropTextSize({ text: 'Jewel Test Talk Show', width: 1920, height: 1080, measure });
  assert.ok(sign > 300, `the sign still letters at title scale (got ${sign})`);
  const promptTextAsTitle = fitBackdropTextSize({ text: SAMPLE_PROMPT, width: 1920, height: 1080, measure });
  assert.ok(promptTextAsTitle > 150, 'the title fit itself is unchanged — only the prompt role is capped');
  console.log('PASS: title role unchanged — the sign keeps its maximize-to-fill lettering.');
}

// --- The cap binds even when the box could fit more --------------------------
{
  const lower = fitBackdropTextSize({ text: 'Welcome!', width: 1920, height: 1080, lower: true, measure });
  const center = fitBackdropTextSize({ text: 'Welcome!', width: 1920, height: 1080, measure });
  assert.equal(lower, LINE_CAP_1080, 'even a short prompt caps at the line ratio');
  assert.ok(center > 300, 'the same words as a title still fill the frame');
  for (const height of [400, 720, 1080, 1440]) {
    for (const text of [SAMPLE_PROMPT, 'Welcome!', Array(20).fill('habits').join(' ')]) {
      const size = fitBackdropTextSize({ text, width: height * 16 / 9, height, lower: true, measure });
      assert.ok(size <= Math.floor(height * PROMPT_LINE_MAX_RATIO), `prompt line cap holds at height ${height}`);
      assert.ok(blockShare(text, size, height * 16 / 9, height) <= PROMPT_BLOCK_MAX_RATIO + 1e-9, `prompt block budget holds at height ${height}`);
    }
  }
  console.log('PASS: the prompt caps hold across texts and frame sizes.');
}

// --- The cap scales with the box (a smaller canvas, a smaller caption) -------
{
  const size = fitBackdropTextSize({ text: SAMPLE_PROMPT, width: 960, height: 540, lower: true, measure });
  assert.equal(size, Math.floor(540 * PROMPT_LINE_MAX_RATIO), 'the caption scales with its canvas');
  console.log('PASS: box scaling — the fit is proportional, never a fixed pixel size.');
}

// --- No stored size exists to override ---------------------------------------
// BackdropTextSpec carries text/font/colors/presentation only — Jewel
// sets exactly those (lib/draft-edit.ts), so the render-time cap never
// overrides a size anyone chose, and saved projects need no rewrite:
// they simply render corrected on open.
{
  const spec = cleanBackdropText({ text: SAMPLE_PROMPT, fontFamily: FONT, textColor: '#ffffff', accentColor: '#e9c979', presentation: 'plain', fontSize: 400 });
  assert.deepEqual(Object.keys(spec).sort(), ['accentColor', 'fontFamily', 'presentation', 'text', 'textColor'],
    'a cleaned prompt spec stores no size — the fit is render-time only');
  console.log('PASS: no size is stored in the spec — nothing user-set is overridden, no saved data rewritten.');
}

// --- Tall-ink fonts: the fit budgets the PAINT, not the line box -------------
// Measured live in a real browser at the review canvas: in Sacramento
// the sample sign's line box sat fully inside the canvas while its
// painted extent (the font's ~1.46em bounding box, against a 1.16em
// line height) crossed the canvas top and was cropped. A line-box
// fit picks ~363px for this face; the ink-budgeted fit must pick
// less, so the whole painted block — (lines - 1) line heights plus
// one line's ink — stays within the same 78% title budget.
{
  const scriptMeasure = (text, px) => ({ width: text.length * px * 0.30, inkAscent: px * 1.0, inkDescent: px * 0.46 });
  const inkBlock = (text, px, width) => (wrapLines(text, px, width) - 1) * px * 1.16 + px * 1.46;
  const size = fitBackdropTextSize({ text: 'Jewel Test Talk Show', width: 1920, height: 1080, measure: scriptMeasure });
  assert.ok(size < 363, `the tall-ink sign fits below the old line-box size (got ${size})`);
  assert.ok(inkBlock('Jewel Test Talk Show', size, 1920) <= 1080 * 0.78, 'the painted block stays inside the title budget — nothing left to crop');
  const promptSize = fitBackdropTextSize({ text: SAMPLE_PROMPT, width: 1920, height: 1080, lower: true, measure: scriptMeasure });
  assert.equal(promptSize, LINE_CAP_1080, 'the prompt line cap still sets the prompt size');
  assert.ok(inkBlock(SAMPLE_PROMPT, promptSize, 1920) <= 1080 * PROMPT_BLOCK_MAX_RATIO, 'the prompt\'s painted block stays inside its lower-third budget even in a tall-ink face');
  console.log('PASS: tall-ink fonts — the fit budgets painted extent, so script signs are fully visible and the prompt stays a lower-third.');
}

// --- Wiring: every prompt render goes through the capped fit ------------------
{
  const component = fs.readFileSync('components/BackdropText.tsx', 'utf8');
  assert(component.includes('fitBackdropTextSize'), 'the layer fits through the shared lib fit');
  assert(component.includes('fontBoundingBoxAscent') && component.includes('fontBoundingBoxDescent'), 'the component measures the font\'s full bounding extents — the reach of its paint');
  assert(component.includes('lower: placement === "lower"'), 'the caps key off the prompt placement, and only it');
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const published = fs.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
  assert.equal(page.split('assetPromptText(bg)!} placement="lower"').length - 1, 2, 'both draft renders letter the prompt as the lower layer');
  assert(published.includes('assetPromptText(backgroundAsset)!} placement="lower"'), 'the published overlay letters the prompt as the lower layer — same capped fit');
  console.log('PASS: wiring — draft (both copies), stage review (via the draft overlay), and published all share the capped fit.');
}

console.log('backdrop-text-fit: all assertions passed');
