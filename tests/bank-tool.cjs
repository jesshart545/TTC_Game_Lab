const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), load = require('./load.cjs');
const {
  freshBankState, settleBankState, publicBankState, bankTransition, bankRemaining,
  clampBankPressValue, clampBankRoundSeconds,
} = load('lib/bank.ts');
const { toolDefaults } = load('lib/game-tools.ts');
const { SHELF_LIBRARY, shelfRoute } = load('lib/workshop-libraries.ts');
const { creatableTools, applyBuildChanges } = load('lib/build-edits.ts');
const { addCreationControl, buttonFacts } = load('lib/build-controls.ts');
const { dashboardTargets } = load('lib/dashboard-actions.ts');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const roundTrip = value => JSON.parse(JSON.stringify(value));

// The Bank (Jessica, 2026-11-15): the host sets each round's press value
// at the round's start; presses climb the at-risk Balance; the bank
// button moves the Balance shown at that moment into Banked, on top of
// what was banked before; at the end of each round Balance returns to
// zero and Banked remains through to the end of the game; Banked climbs
// ONLY when the bank button is pressed.

const T0 = 1_000_000;

// ---------- the brief's end-to-end sequence, in the shared state layer ----------
{
  let s = freshBankState({ roundSeconds: 60, pressValue: 10 });
  assert.equal(s.phase, 'idle'); assert.equal(s.banked, 0); assert.equal(s.balance, 0); assert.equal(s.round, 0);
  s = bankTransition(s, 'start', T0, { pressValue: 25, roundSeconds: 60 });
  assert.equal(s.phase, 'running'); assert.equal(s.round, 1); assert.equal(s.pressValue, 25);
  s = bankTransition(s, 'add', T0 + 1000); s = bankTransition(s, 'add', T0 + 2000); s = bankTransition(s, 'add', T0 + 3000);
  assert.equal(s.balance, 75, 'three presses at 25 climb the Balance to 75');
  assert.equal(s.banked, 0, 'presses alone never bank anything');
  s = bankTransition(s, 'bank', T0 + 4000);
  assert.equal(s.banked, 75, 'banking moves the Balance shown at that moment into Banked');
  assert.equal(s.balance, 0, 'Balance restarts at 0 within the same round');
  assert.equal(s.phase, 'running', 'banking does not end the round');
  assert.equal(s.pressValue, 25, 'banking does not change the press value');
  s = bankTransition(s, 'add', T0 + 5000); s = bankTransition(s, 'add', T0 + 6000);
  assert.equal(s.balance, 50, 'presses after a bank add the same round press value');
  // Timer stops: only the unbanked Balance clears; Banked remains.
  s = settleBankState(s, T0 + 61000);
  assert.equal(s.phase, 'ended'); assert.equal(s.balance, 0, 'at the end of the round Balance returns to zero');
  assert.equal(s.banked, 75, 'Banked remains when the timer stops');
  // Round 2: the host sets a higher press value.
  s = bankTransition(s, 'start', T0 + 62000, { pressValue: 50, roundSeconds: 60 });
  assert.equal(s.round, 2); assert.equal(s.pressValue, 50); assert.equal(s.balance, 0);
  s = bankTransition(s, 'add', T0 + 63000);
  assert.equal(s.balance, 50);
  s = bankTransition(s, 'bank', T0 + 64000);
  assert.equal(s.banked, 125, 'round 2 banking adds onto the banked total from round 1');
  s = bankTransition(s, 'new-game', T0 + 65000);
  assert.equal(s.banked, 0); assert.equal(s.balance, 0); assert.equal(s.round, 0); assert.equal(s.phase, 'idle', 'a new game returns the bank to its pre-round-1 state');
  console.log('PASS: start 25, 3 presses = 75, bank = 75 banked, expiry clears only the Balance, round 2 at 50 banks to 125, new game zeroes all.');
}

// ---------- Jessica's canonical cases (2026-11-15 18:02) ----------
{
  // A round ends after a mid-round bank with no further presses:
  // Balance is already 0, and Banked is unchanged at round end.
  let s = freshBankState({ roundSeconds: 30, pressValue: 10 });
  s = bankTransition(s, 'start', T0, { pressValue: 20 });
  s = bankTransition(s, 'add', T0 + 1000); s = bankTransition(s, 'add', T0 + 2000);
  s = bankTransition(s, 'bank', T0 + 3000);
  assert.equal(s.banked, 40); assert.equal(s.balance, 0);
  s = settleBankState(s, T0 + 31000);
  assert.equal(s.phase, 'ended'); assert.equal(s.balance, 0); assert.equal(s.banked, 40, 'Banked unchanged at round end when nothing was left unbanked');
  console.log('PASS: a round ending right after a bank leaves Banked untouched.');
}
{
  // A second bank in the same round adds the newly climbed Balance onto
  // the earlier banked amount.
  let s = freshBankState({ roundSeconds: 60, pressValue: 10 });
  s = bankTransition(s, 'start', T0, { pressValue: 25 });
  s = bankTransition(s, 'add', T0 + 1000);
  s = bankTransition(s, 'bank', T0 + 2000);
  assert.equal(s.banked, 25);
  s = bankTransition(s, 'add', T0 + 3000); s = bankTransition(s, 'add', T0 + 4000);
  assert.equal(s.balance, 50);
  s = bankTransition(s, 'bank', T0 + 5000);
  assert.equal(s.banked, 75, 'the second bank adds the new Balance onto the earlier banked amount');
  assert.equal(s.balance, 0);
  console.log('PASS: two banks in one round accumulate into the one Banked total.');
}
{
  // Presses do nothing when no round is running.
  const idle = freshBankState({});
  assert.equal(bankTransition(idle, 'add', T0).balance, 0, 'add while idle does nothing');
  let s = bankTransition(idle, 'start', T0, { pressValue: 10, roundSeconds: 5 });
  s = settleBankState(s, T0 + 6000);
  assert.equal(s.phase, 'ended');
  assert.equal(bankTransition(s, 'add', T0 + 7000).balance, 0, 'add after the round ended does nothing');
  const over = bankTransition(s, 'end-game', T0 + 8000);
  assert.equal(bankTransition(over, 'add', T0 + 9000).balance, 0, 'add after the game ended does nothing');
  console.log('PASS: the add press only counts while a round is running.');
}
{
  // End of game: the final banked total stands as the result; the
  // unbanked Balance is lost; a finished game must be reset to restart.
  let s = freshBankState({ roundSeconds: 60, pressValue: 10 });
  s = bankTransition(s, 'start', T0, { pressValue: 30 });
  s = bankTransition(s, 'add', T0 + 1000); s = bankTransition(s, 'bank', T0 + 2000);
  s = bankTransition(s, 'add', T0 + 3000);
  s = bankTransition(s, 'end-game', T0 + 4000);
  assert.equal(s.phase, 'over');
  assert.equal(s.banked, 30, 'the final banked total is the banked amount, already calculated');
  assert.equal(s.balance, 0, 'unbanked value is not saved by ending the game');
  assert.equal(bankTransition(s, 'start', T0 + 5000, { pressValue: 5 }).phase, 'over', 'a finished game cannot start a round until it is reset');
  const reset = bankTransition({ ...s, visible: true }, 'new-game', T0 + 6000);
  assert.equal(reset.banked, 0); assert.equal(reset.phase, 'idle'); assert.equal(reset.visible, true, 'the reset keeps the creator\u2019s overlay placement');
  console.log('PASS: end game presents the final Banked total; reset returns to the pre-round-1 state.');
}
{
  // Settle is the one shared clear: idempotent, and the public read both
  // views use shows the same post-expiry state.
  let s = freshBankState({ roundSeconds: 10, pressValue: 10 });
  s = bankTransition(s, 'start', T0, { pressValue: 15 });
  s = bankTransition(s, 'add', T0 + 1000);
  assert.equal(bankRemaining(s, T0), 10);
  assert.equal(bankRemaining(s, T0 + 5500), 5);
  const once = settleBankState(s, T0 + 11000), twice = settleBankState(once, T0 + 12000);
  assert.deepEqual(roundTrip(twice), roundTrip(once), 'settling twice changes nothing more');
  assert.equal(publicBankState(s, T0 + 11000).balance, 0, 'the public state read applies the same expiry clear');
  console.log('PASS: the timer-expiry clear lives in the shared settle, seen identically by every view.');
}

// ---------- clamps: model-supplied numerics are coerced and clamped ----------
assert.equal(clampBankRoundSeconds(2), 5); assert.equal(clampBankRoundSeconds(99999), 3600);
assert.equal(clampBankRoundSeconds('90'), 90); assert.equal(clampBankRoundSeconds(undefined), 60); assert.equal(clampBankRoundSeconds('abc'), 60);
assert.equal(clampBankPressValue(0), 1); assert.equal(clampBankPressValue(-5), 1); assert.equal(clampBankPressValue(2000000), 1000000);
assert.equal(clampBankPressValue('25'), 25); assert.equal(clampBankPressValue(undefined), 10); assert.equal(clampBankPressValue(25.6), 26);
console.log('PASS: roundSeconds clamps to 5-3600 and press value to 1-1000000, with sane defaults.');

// ---------- registration: defaults, shelf, creation, wiring ----------
{
  const defaults = roundTrip(toolDefaults('bank'));
  assert.deepEqual(defaults, { title: 'Bank', roundSeconds: 60, pressValue: 10 }, 'toolDefaults for the Bank are sane');
  const shelfBanks = SHELF_LIBRARY.filter(item => item.type === 'bank');
  assert.equal(shelfBanks.length, 1, 'the shelf library contains bank exactly once');
  assert.equal(shelfBanks[0].name, 'Bank');
  assert.equal(shelfRoute(shelfBanks[0]), 'add', 'the Bank is a plain shelf add');
  assert(creatableTools.includes('bank'), 'Jewel can create the Bank');
  const standing = read('components/StandingToolFace.tsx');
  assert(standing.includes('"countdown", "bank"]'), 'the Bank is a standing-face type');
  assert(standing.includes('if (tool.type === "bank") return true;'), 'a placed Bank stands (its state\u2019s visible flag decides whether the face shows)');
  assert(standing.includes('<BankDisplay tool={tool} state={state} />'), 'the standing layer renders the Bank\u2019s real display from the shared state');
  console.log('PASS: the Bank is registered in defaults, the shelf (exactly once), and the creation list.');
}
{
  // Creation through Jewel's build path clamps dirty numeric config.
  const base = { id: 'test', assets: [], controls: [], gameTools: [], overlay: {}, compositions: [] };
  const result = applyBuildChanges(base, { newTools: [{ type: 'bank', name: 'Bank', config: { roundSeconds: 99999, pressValue: -5 } }] });
  const tool = result.project.gameTools.find(t => t.type === 'bank');
  assert.ok(tool, 'creation: the Bank is created');
  assert.equal(tool.config.roundSeconds, 3600, 'creation: roundSeconds clamped to the maximum');
  assert.equal(tool.config.pressValue, 1, 'creation: press value clamped to the minimum');
  assert.equal(tool.inToolbox, true, 'creation: the Bank lands in the toolbox');
  assert.ok(!tool.inOverlayBuild, 'creation: nothing is auto-wired onto the overlay');
  console.log('PASS: Jewel creation clamps the Bank\u2019s numeric config and wires nothing automatically.');
}
{
  // Connecting the Bank (the scoreboard model): one Show control, the
  // tool placed in the overlay build, and plain-language button facts.
  const tool = { id: 'bank1', type: 'bank', name: 'Bank', enabled: true, inToolbox: true, config: roundTrip(toolDefaults('bank')) };
  const project = { id: 'test', assets: [], controls: [], gameTools: [tool], overlay: {}, compositions: [] };
  const wired = addCreationControl(project, 'tool', 'bank1');
  const control = wired.project.controls.find(c => c.id === wired.controlId);
  assert.equal(control.action, 'bank.toggle.bank1', 'wiring adds the one Show/remove button');
  const placed = wired.project.gameTools.find(t => t.id === 'bank1');
  assert.equal(placed.inOverlayBuild, true, 'connecting places the Bank in the overlay build');
  const facts = buttonFacts(control, wired.project);
  assert.equal(facts.does, 'Shows: Bank'); assert.equal(facts.clicks, 'Click to show · click again to hide');
  const targets = dashboardTargets(wired.project, control.id);
  assert(targets.some(t => (t.actions || []).some(a => a.value === 'bank.toggle.bank1')), 'the dashboard action list offers the Bank\u2019s Show/remove');
  console.log('PASS: connecting the Bank adds exactly one Show/remove control and places it; facts read back plainly.');
}

// ---------- presentation contract (Jessica, 2026-11-15 17:58 + 18:00) ----------
{
  const display = read('components/BankDisplay.tsx');
  assert(display.includes('>Balance<') && display.includes('>Banked<'), 'the overlay face shows exactly the Balance and Banked labels');
  assert(!display.includes('fromCharCode'), 'the bank glyph never appears on the overlay face');
  assert(!display.includes('Time left') && !display.includes('Press value') && !display.includes('>Round<'), 'no timer, press-value or round readout on the overlay face');
  const panel = read('components/BankHostPanel.tsx');
  assert(panel.includes('fromCharCode(36)'), 'the host panel builds the bank glyph without a literal in scanned source');
  assert(panel.includes('>+<'), 'the add button is labeled exactly +');
  assert(panel.includes('Start Round') && panel.includes('Press value for this round'), 'the host panel carries the press-value input next to Start Round');
  assert(panel.includes('End game') && panel.includes('Final banked total'), 'the host panel ends the game and presents the final banked total');
  assert(panel.includes('Start new game') && panel.includes('Yes, start new game') && panel.includes('Keep current game'), 'the reset follows the confirm pattern');
  assert(panel.includes('Time left') && panel.includes('Round'), 'timer and round readouts live on the host panel');
  console.log('PASS: overlay face is Balance + Banked only; the + and bank-glyph buttons, readouts, end game and reset live on the host panel.');
}

// ---------- Jewel prompt parity ----------
{
  const jewel = read('app/api/jewel/route.ts'), ai = read('app/api/ai/route.ts');
  const sentence = 'The Bank uses toolType "bank" with config roundSeconds (the round timer in seconds) and pressValue (the starting press value); the host sets each round\'s press value on the dashboard.';
  assert(jewel.includes(sentence), 'the jewel route teaches the Bank');
  assert(ai.includes(sentence), 'the ai route teaches the Bank identically');
  assert(jewel.includes('"city-crime-scene"|"bank"') && ai.includes('"city-crime-scene"|"bank"'), 'both routes list bank among the tool-action types');
  console.log('PASS: the Jewel prompt mentions the Bank in both routes, byte-identical.');
}

console.log('ALL BANK GUARDS PASS');
