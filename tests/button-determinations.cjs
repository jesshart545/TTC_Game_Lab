const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript');
function load(path, requires = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: id => requires[id], crypto: require('node:crypto').webcrypto, Date, Math, Set }); return exports; }
const cards = load('lib/question-cards.ts');
const connections = load('lib/control-connections.ts', { './timer-controls': require('./load.cjs')('lib/timer-controls.ts'), './question-cards': cards, './sequences': require('./load.cjs')('lib/sequences.ts') });
const { addCreationControl, buttonFacts, controlEffectResult } = load('lib/build-controls.ts', { './control-connections': connections, './board-design': load('lib/board-design.ts') });

const base = () => ({ assets: [], gameTools: [], controls: [], compositions: [] });
const factsEq = (actual, expected) => { assert.equal(actual.does, expected.does); assert.equal(actual.clicks, expected.clicks); assert.equal(actual.effect, expected.effect); };

// Show/hide pair: dice fires again on every click; its Hide button is a separate one-click button.
const dice = { id: 'dice1', name: 'Dice', type: 'dice', enabled: true, config: {} };
const diceResult = addCreationControl({ ...base(), gameTools: [dice] }, 'tool', 'dice1');
const diceProject = diceResult.project;
const roll = diceProject.controls.find(c => c.id === diceResult.controlId);
const hideDice = diceProject.controls.find(c => c.action.startsWith('result.hide.'));
factsEq(buttonFacts(roll, diceProject), { does: 'Rolls the dice', clicks: 'Every click rolls again', effect: true });
factsEq(buttonFacts(hideDice, diceProject), { does: 'Hides: Dice', clicks: 'One click hides it', effect: false });
console.log('PASS: dice button states what it rolls, that every click rolls again, and that its effect is settable; the Hide button is one-click and carries no effect.');

// One toggle button: scoreboard shows and hides with the same button.
const scoreboard = { id: 'score1', name: 'Scoreboard', type: 'scoreboard', enabled: true, config: {} };
const scoreResult = addCreationControl({ ...base(), gameTools: [scoreboard] }, 'tool', 'score1');
const toggle = scoreResult.project.controls.find(c => c.id === scoreResult.controlId);
assert.equal(toggle.action, 'cards.toggle.score1');
factsEq(buttonFacts(toggle, scoreResult.project), { does: 'Shows: Scoreboard', clicks: 'Click to show · click again to hide', effect: false });
console.log('PASS: a toggle button says the same button hides what it shows.');

// Timer buttons: show is one click; start/pause toggles per click.
const timer = { id: 'timer1', name: 'Timer', type: 'countdown', enabled: true, config: { seconds: 30 } };
const timerResult = addCreationControl({ ...base(), gameTools: [timer] }, 'tool', 'timer1');
const timerProject = timerResult.project;
const timerShow = timerProject.controls.find(c => c.action === 'timer.show.timer1');
const timerToggle = timerProject.controls.find(c => c.action === 'timer.toggle.timer1');
factsEq(buttonFacts(timerShow, timerProject), { does: 'Shows the timer', clicks: 'One click shows it', effect: false });
factsEq(buttonFacts(timerToggle, timerProject), { does: 'Starts / pauses the timer', clicks: 'Click to start · click again to pause', effect: false });
console.log('PASS: timer buttons state show vs start/pause honestly.');

// Media: image shows with one click, video plays with one click and stops with its own button.
const image = { name: 'Star.png', type: 'Generated', url: 'https://example.test/star.png', inProject: false };
const imageResult = addCreationControl({ ...base(), assets: [image] }, 'asset', 'Star.png');
const showImage = imageResult.project.controls.find(c => c.id === imageResult.controlId);
factsEq(buttonFacts(showImage, imageResult.project), { does: 'Shows: Star.png', clicks: 'One click shows it', effect: true });
const video = { name: 'Clip.webm', type: 'Generated', url: 'https://example.test/clip.webm', inProject: false };
const videoResult = addCreationControl({ ...base(), assets: [video] }, 'asset', 'Clip.webm');
const playVideo = videoResult.project.controls.find(c => c.id === videoResult.controlId);
const stopVideo = videoResult.project.controls.find(c => c.action.startsWith('result.hide.'));
factsEq(buttonFacts(playVideo, videoResult.project), { does: 'Plays: Clip.webm', clicks: 'One click plays it', effect: true });
factsEq(buttonFacts(stopVideo, videoResult.project), { does: 'Stops: Clip.webm', clicks: 'One click stops it', effect: false });
console.log('PASS: picture and video buttons state show/play and the separate stop.');

// Coin flip re-fires per click; YouTube never touches the overlay; sequences state their press mode.
const coin = { id: 'coin', name: 'Coin Toss', type: 'coin-toss', enabled: true, config: {} };
const coinResult = addCreationControl({ ...base(), gameTools: [coin] }, 'tool', 'coin');
const flip = coinResult.project.controls.find(c => c.id === coinResult.controlId);
factsEq(buttonFacts(flip, coinResult.project), { does: 'Flips the coin', clicks: 'Every click flips again', effect: true });
const youtube = { id: 'yt', name: 'YouTube search', type: 'youtube', enabled: true, config: {} };
const ytResult = addCreationControl({ ...base(), gameTools: [youtube] }, 'tool', 'yt');
const ytControl = ytResult.project.controls.find(c => c.id === ytResult.controlId);
factsEq(buttonFacts(ytControl, ytResult.project), { does: 'Opens YouTube search', clicks: 'Search stays on the dashboard', effect: false });
const seqProject = base();
factsEq(buttonFacts({ id: 's1', label: 'Big moment', action: 'sequence', sequenceMode: 'per-press', chain: [] }, seqProject), { does: 'Runs its steps', clicks: 'One step per click', effect: false });
factsEq(buttonFacts({ id: 's2', label: 'Big moment', action: 'sequence', chain: [] }, seqProject), { does: 'Runs its steps', clicks: 'One click runs all its steps', effect: false });
console.log('PASS: coin, YouTube, and sequence buttons state their real click behavior.');

// Changing the effect writes the control's overlayResult — the same state the Effects tab reads.
const faded = controlEffectResult(roll, diceProject, 'fade');
assert.equal(faded.entrance, 'fade');
assert.equal(faded.entranceSeconds, 0.3, 'picking an effect with no duration set gives it the standard 0.3s so it really animates');
assert.deepEqual([faded.x, faded.y, faded.width, faded.height, faded.layer], [15, 20, 70, 60, 20], 'placement is preserved');
const custom = { ...roll, overlayResult: { ...roll.overlayResult, entranceSeconds: 0.8 } };
assert.equal(controlEffectResult(custom, diceProject, 'zoom').entranceSeconds, 0.8, 'an existing duration is kept');
assert.equal(controlEffectResult(custom, diceProject, 'none').entrance, 'none');
const legacy = { id: 'legacy', label: 'Roll Dice', action: 'tool.dice1', toolIds: ['dice1'] };
const placedDice = { ...dice, config: { placement: { x: 5, y: 6, width: 50, height: 40 } } };
const seeded = controlEffectResult(legacy, { ...base(), gameTools: [placedDice] }, 'slide');
assert.deepEqual([seeded.x, seeded.y, seeded.width, seeded.height], [5, 6, 50, 40], 'a control without a saved result inherits the tool placement instead of jumping');
const written = diceProject.controls.map(c => c.id === roll.id ? { ...c, overlayResult: controlEffectResult(c, diceProject, 'fade') } : c);
assert.equal(written.find(c => c.id === roll.id).overlayResult.entrance, 'fade', 'the strip writes overlayResult.entrance, the exact field the Effects tab reads as fxResult');
console.log('PASS: the effect choice writes the shared overlayResult state, preserves placement and durations.');

// The strip itself: three short determinations at the selected button, old prose line gone.
const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
assert(buildSpace.includes('aria-label="What this button does"'), 'the determination strip is labelled');
assert(buildSpace.includes('<strong>Does:</strong>') && buildSpace.includes('<strong>Clicks:</strong>'), 'the strip states what it does and how its clicks work');
assert(buildSpace.includes('>No effect</option>') && buildSpace.includes('>Fade in</option>') && buildSpace.includes('>Slide in</option>') && buildSpace.includes('>Zoom in</option>'), 'the effect choice uses short words');
assert(buildSpace.includes('setControlEffect') && buildSpace.includes('controlEffectResult(target,current,entrance)'), 'the strip changes the effect through the shared helper');
assert(!buildSpace.includes('<strong>What this button does:</strong>'), 'the old buried prose line is replaced by the strip');
const runtime = fs.readFileSync('components/RuntimeActionLayers.tsx', 'utf8');
const toolRun = runtime.slice(runtime.indexOf('function ToolRun'), runtime.indexOf('function motionStyle'));
assert(toolRun.includes('...motionStyle(run)'), 'tool layers honor the entrance/exit effect the strip sets');
console.log('PASS: the strip renders at the selected button and tool layers honor the effect it sets.');
