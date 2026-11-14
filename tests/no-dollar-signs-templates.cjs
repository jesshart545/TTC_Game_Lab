const assert = require('node:assert/strict'), fs = require('node:fs');

// Jessica's hard rule (2026-11-14): no dollar signs should ever show on
// anything — "the amounts are fine the dollar signs have to go." This
// guard pins the template / change-list / help-text surfaces swept in
// the dollar-sweep-templates build: every amount stays, only the "$"
// character is gone, and no other currency symbol is substituted.
//
// Scan allowlist (syntax, not display text — none of these can render
// as a dollar sign for a user):
//   - "${"  template-literal interpolation starts
//   - "$/"  regex end anchors (e.g. /^cards\.toggle\.(.+)$/.exec(...))
//   - full-line "//" code comments (not string literals, never shown;
//     the Million Quiz section header comment is the one instance)

const read = (file) => fs.readFileSync(file, 'utf8');

const sweptFiles = [
  'lib/game-templates.ts',
  'lib/gameshow-path.ts',
  'lib/build-guide.ts',
  'lib/dashboard-actions.ts',
  'lib/game-tools.ts',
];

function displayText(src) {
  return src
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')
    .replace(/\$\{/g, '')
    .replace(/\$\//g, '');
}

for (const file of sweptFiles) {
  const src = read(file);
  assert(!src.includes('$$'), `${file}: no escaped-dollar ($$) rendering remains`);
  assert(!displayText(src).includes('$'), `${file}: no $ remains outside interpolation / regex anchors / comments`);
}

// ---- Million Quiz template: amounts survive as plain numbers ------------
{
  const src = read('lib/game-templates.ts');
  assert(!src.includes('"$100"') && !src.includes('"$1,000,000"') && !src.includes('"$25 Gift Card"'),
    'game-templates: no $-prefixed ladder values or prize names remain');
  assert(src.includes('tagline: "Climb the money ladder to 1,000,000"'), 'game-templates: tagline keeps the amount, no $');
  assert(src.includes('subtitle: "ONE QUESTION AWAY FROM 1,000,000"'), 'game-templates: overlay subtitle keeps the amount, no $');
  assert(src.includes('"25 Gift Card"'), 'game-templates: prize name keeps its amount, no $');
  const ladder = ['100', '200', '500', '1,000', '5,000', '10,000', '50,000', '100,000', '500,000', '1,000,000'];
  for (const value of ladder) {
    assert(src.includes(`value: "${value}"`), `game-templates: ladder value ${value} still present as a plain number`);
  }
}

// ---- Gameshow change lists ----------------------------------------------
{
  const src = read('lib/gameshow-path.ts');
  assert(!src.includes('$1.00') && !src.includes('$1 off'), 'gameshow-path: no $ amounts remain');
  assert(src.includes('sub: "From 5¢ up to 1.00"'), 'gameshow-path: wheel values line keeps the amount, no $');
  assert(src.includes('sub: "Classic rules: 1 off = 1 step"'), 'gameshow-path: cliffhanger rules line keeps the amount, no $');
  assert(src.includes('description: "Spin money values to 1.00"'), 'gameshow-path: prize wheel description keeps the amount, no $');
}

// ---- Build guide + dashboard action help --------------------------------
{
  const guide = read('lib/build-guide.ts');
  assert(!guide.includes('$1.00'), 'build-guide: no $ amounts remain');
  assert(guide.includes('from 5¢ to 1.00. Spin for the closest to 1.00 without going over.'),
    'build-guide: big wheel help keeps the amounts, no $');

  const actions = read('lib/dashboard-actions.ts');
  assert(!actions.includes('$1.00'), 'dashboard-actions: no $ amounts remain');
  assert(actions.includes('from 5¢ to 1.00. Closest to 1.00 without going over wins.'),
    'dashboard-actions: spin description keeps the amounts, no $');
}

// ---- Tool defaults (prize wheel values) ----------------------------------
{
  const src = read('lib/game-tools.ts');
  assert(!src.includes("'$1.00'"), 'game-tools: prize-wheel default values carry no $');
  assert(src.includes("'95¢','1.00'"), 'game-tools: prize-wheel default ladder intact as plain values');
}

console.log('no-dollar-signs-templates: all assertions passed');
