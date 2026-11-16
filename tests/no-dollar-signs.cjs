const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');

// Jessica's hard rule (2026-11-14): no dollar signs should ever show on
// anything. Values render as plain numbers; no other currency symbol is
// substituted. This guard pins the display spots fixed in the
// no-dollar-signs build and scans the in-scope display surface for the
// escaped-dollar rendering pattern ($${...}) coming back.
//
// Out of scope here (owned by parallel builds): the published overlay
// page, ChanceTools, GameInfoTools, RuntimeActionLayers, QuestionCards.

const read = (file) => fs.readFileSync(file, 'utf8');

const fixedFiles = [
  'app/project/[id]/page.tsx',
  'app/published/[slug]/page.tsx',
  'app/landing.tsx',
  'components/CliffhangerHostPanel.tsx',
  'components/GameshowToolDemos.tsx',
  'components/GameToolEditor.tsx',
];

for (const file of fixedFiles) {
  const src = read(file);
  assert(!src.includes('$$'), `${file}: no escaped-dollar ($$) rendering remains`);
  assert(!/\$[0-9]/.test(src), `${file}: no $-before-number display text remains`);
  assert(!src.includes('($)'), `${file}: no ($) unit label remains`);
}

// ---- Project page trivia previews (BOTH copies of the duplicated JSX) --
{
  const src = read('app/project/[id]/page.tsx');
  assert(!src.includes('runtime-trivia-value">${'), 'project page: no $ before the clue value in either preview copy');
  const copies = src.split('runtime-trivia-value">{q.value}').length - 1;
  assert.equal(copies, 2, 'project page: both preview copies (draftOverlay + preview panel) show the plain value');
}

// ---- Published host dashboard trivia board -------------------------------
{
  const src = read('app/published/[slug]/page.tsx');
  assert(!src.includes('$${question.value}'), 'published dashboard: board buttons no longer prefix clue values with $');
  assert(src.includes('used ? "USED" : question.value'), 'published dashboard: board buttons show the plain value');
}

// ---- Landing page trivia tiles --------------------------------------------
{
  const src = read('app/landing.tsx');
  assert(!src.includes('triviaTile}>${v}'), 'landing: trivia tiles no longer prefix values with $');
  assert(src.includes('triviaTile}>{v}</div>'), 'landing: trivia tiles show the plain value');
}

// ---- Cliffhanger host panel: the status text builds without a $ ----------
{
  const src = read('components/CliffhangerHostPanel.tsx');
  const line = src.split('\n').find((l) => l.includes('setStatus(o.fell'));
  assert(line, 'cliffhanger host panel: status line found');
  const expr = line.slice(line.indexOf('setStatus(') + 'setStatus('.length, line.lastIndexOf(')'));
  const build = new Function('o', `return (${expr})`);
  const climbed = build({ fell: false, diff: 3, steps: 2 });
  assert.equal(climbed, 'Off by 3 — he climbs 2 steps.');
  assert(!climbed.includes('$'), 'cliffhanger host status has no dollar sign');
  const fell = build({ fell: true, diff: 5, steps: 7 });
  assert.equal(fell, 'Off by 5 — he climbs 7 steps and FALLS!');
  assert(!fell.includes('$'), 'cliffhanger host fall status has no dollar sign');
  assert(src.includes("Player's guess"), 'cliffhanger host panel: guess label present');
  assert(!src.includes("Player's guess ($"), 'cliffhanger host panel: guess label carries no ($)');
}

// ---- Gameshow demos: cliffhanger outcome prose --------------------------
{
  const src = read('components/GameshowToolDemos.tsx');
  const line = src.split('\n').find((l) => l.includes('Off by ${'));
  assert(line, 'gameshow demos: cliffhanger outcome line found');
  const tpl = line.match(/`Off by[^`]*`/)[0];
  const build = new Function('outcome', 'stepsToFall', 'position', `return (${tpl})`);
  const text = build({ diff: 4, steps: 3 }, 25, 3);
  assert.equal(text, 'Off by 4 → 3 steps up. 22 from the edge.');
  assert(!text.includes('$'), 'cliffhanger demo outcome has no dollar sign');
  assert(!src.includes('Price the {item.label}: $'), 'cliffhanger demo: price chip carries no trailing $');
  assert(src.includes('Price the {item.label}:'), 'cliffhanger demo: price chip present');
}

// ---- Game tool editor: cliffhanger section --------------------------------
{
  const src = read('components/GameToolEditor.tsx');
  assert(!src.includes('Real price ($)'), 'editor: cliffhanger price label carries no ($)');
  assert(src.includes('Classic rules: 1 off = 1 step.'), 'editor: cliffhanger rules note shows the plain number');
}

// ---- Broad scan: no escaped-dollar rendering anywhere on the in-scope ----
// ---- display surface (all .tsx under app/ and components/) ---------------
{
  const excluded = new Set([
    'app/published/[slug]/overlay/page.tsx',
    'components/ChanceTools.tsx',
    'components/GameInfoTools.tsx',
    'components/RuntimeActionLayers.tsx',
    'components/QuestionCards.tsx',
  ]);
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.tsx') && !excluded.has(p) && read(p).includes('$$')) offenders.push(p);
    }
  };
  walk('app'); walk('components');
  assert.deepEqual(offenders, [], `no $${'${...}'} literal-dollar rendering on the in-scope display surface`);
}

console.log('PASS: no dollar signs render in the project-page trivia previews (both copies), the published dashboard board, the landing tiles, the cliffhanger host panel and demo text, or the game tool editor; values show as plain numbers.');
