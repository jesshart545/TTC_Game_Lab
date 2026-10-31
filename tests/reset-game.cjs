// Reset game wiring: the dashboard Reset game button must return the overlay
// and every tool to the opening of the live, on both the draft (Build Space)
// and published surfaces, touching runtime state only.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = p => fs.readFileSync(p, 'utf8');

// Runtime hook: one reset that clears shown runs, the changed background,
// timers/coins/trivia counters, and every card/info tool back to a new game.
const runtime = read('components/RuntimeActionLayers.tsx');
assert(runtime.includes('const resetGame=useCallback('), 'runtime exposes resetGame');
assert(runtime.includes('setRuns([]);setBackgroundKey(null)'), 'reset clears runs and background');
assert(runtime.includes("cardTransition(p,tool,cardRef.current[tool.id]||freshCardState(),'new-game',Date.now())"), 'reset restarts every card/info tool');
assert(runtime.includes('resetGame };') || runtime.includes('resetGame }'), 'resetGame is returned from the hook');

// Draft: Build Space dashboard carries the button with an inline confirm,
// and the project page wires it to the runtime plus the YouTube stop.
const buildSpace = read('components/BuildSpace.tsx');
assert(buildSpace.includes('onResetGame?:(wipeEdits:boolean)=>void'), 'BuildSpace accepts onResetGame with the wipe choice');
assert(buildSpace.includes('>Reset game</button>'), 'BuildSpace renders the Reset game button');
assert(buildSpace.includes('Reset the whole game to its opening?'), 'BuildSpace confirms before resetting');
assert(buildSpace.includes('Yes, reset game') && buildSpace.includes('Keep playing'), 'BuildSpace confirm offers both choices');
assert(buildSpace.includes('Also put the wheel categories back to how the game was built'), 'BuildSpace confirm lets the host choose whether wheel categories are wiped');
assert(buildSpace.includes('onResetGame(resetWipe)'), 'BuildSpace passes the wipe choice to the handler');
const page = read('app/project/[id]/page.tsx');
assert(page.includes('onResetGame={resetDraftGame}'), 'project page passes the reset handler');
assert(page.includes('runtime.resetGame();'), 'draft reset calls the runtime reset');
assert(page.includes('previewYoutube({action:"stop"})'), 'draft reset stops the YouTube preview');
assert(page.includes('function resetDraftGame(wipeEdits:boolean)'), 'draft reset receives the wipe choice');
assert(page.includes('builtWheels') && page.includes('snap.segments[t.id]'), 'a wipe reset restores the wheel segments the game was built with');

// Published: the live route performs the reset server-side (card tools to a
// new game + a reset event) and the init snapshot ignores pre-reset events.
const route = read('app/api/live/[slug]/route.ts');
assert(route.includes('if(body.resetGame){'), 'live route handles resetGame posts');
assert(route.includes("changeCard(live.db,live.project,tool.id,'new-game')"), 'reset restarts published card tools server-side');
assert(route.includes("'reset-game','reset'"), 'reset records a reset event');
assert((route.match(/id > \$\{resetId\}/g) || []).length >= 8, 'init snapshot filters every event family to after the latest reset');
assert((route.match(/event_type='wheel-slots'[^`]*reset/g) || []).length === 2, 'wheel reads are bounded by resets (both the panel read and the spin read)');
assert(route.includes('wipe:!!body.wipeEdits'), 'the reset event records whether the host chose to wipe tool edits');
assert((route.match(/payload->>'wipe' = 'true'/g) || []).length === 2, 'wheel slot edits are wiped only by resets where the host chose to wipe them');

// Published overlay clears its local state when the reset event arrives.
const overlay = read('app/published/[slug]/overlay/page.tsx');
assert(overlay.includes('event.type === "reset"'), 'published overlay handles reset events');
assert(overlay.includes('setYoutubeState(null)'), 'published overlay hides YouTube on reset');

// Published dashboard carries the same button, confirm, and post.
const dashboard = read('app/published/[slug]/page.tsx');
assert(dashboard.includes('await post({ resetGame: true, wipeEdits: resetWipe });'), 'published dashboard posts the reset with the wipe choice');
assert(dashboard.includes('>Reset game</button>'), 'published dashboard renders the Reset game button');
assert(dashboard.includes('Reset the whole game to its opening?'), 'published dashboard confirms before resetting');
assert(dashboard.includes('Game reset. The overlay and every tool are back to the opening of the live.'), 'published dashboard reports the reset');
assert(dashboard.includes('Also put the wheel categories back to how the game was built'), 'published confirm lets the host choose whether wheel categories are wiped');
assert(dashboard.includes('wipeEdits: resetWipe'), 'published dashboard sends the wipe choice with the reset');

console.log('reset-game: all assertions passed');
