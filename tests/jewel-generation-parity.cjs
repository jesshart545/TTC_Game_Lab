const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

const { GENERATOR_VOICES, GENERATOR_VOICE_NAMES, isGeneratorVoice } = load('lib/generator-voices.ts');
const { checkedGenerationAction, checkedTriviaAction, checkedBoardRegenerateAction } = load('lib/jewel-generation.ts');
const { createProject } = load('lib/project.ts');
// Loaded modules run in the loader's VM realm; normalize before deepEqual.
const plain = (v) => JSON.parse(JSON.stringify(v));

// --- The shared voice catalog: exactly the panel's list, one source --------
assert.deepEqual(plain(GENERATOR_VOICE_NAMES), ['Aria', 'Sarah', 'Charlotte', 'Alice', 'Jessica', 'Roger', 'George', 'Brian', 'Liam', 'Bill']);
assert.deepEqual(plain(GENERATOR_VOICES.map(v => v.label)), [
  'Aria — warm female', 'Sarah — clear female', 'Charlotte — soft female', 'Alice — bright female',
  'Jessica — friendly female', 'Roger — deep male', 'George — warm male', 'Brian — steady male',
  'Liam — young male', 'Bill — older male',
]);
assert.equal(isGeneratorVoice('Sarah'), true);
assert.equal(isGeneratorVoice('Bill'), true);
assert.equal(isGeneratorVoice('Morgan'), false);
assert.equal(isGeneratorVoice(''), false);
assert.equal(isGeneratorVoice(undefined), false);

// The Jewel route reads the shared catalog and the action checkers. The
// panel's own generator — the catalog's other consumer in Half A — was
// removed in Piece 2 Half B: generation lives in Jewel herself now, so the
// panel carries no voice picker (and no generator) at all.
const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
assert.ok(!panel.includes('GENERATE ASSET'), 'Half B: the panel no longer hosts a generator');
assert.ok(!panel.includes('generator-voices'), 'Half B: no voice picker remains in the panel for the catalog to feed');
const route = fs.readFileSync('app/api/jewel/route.ts', 'utf8');
assert.ok(route.includes('from "../../../lib/jewel-generation"'), 'jewel route uses the generation checkers');
assert.ok(route.includes('GENERATOR_VOICES'), 'jewel route builds its voice list from the shared catalog');
assert.ok(!route.includes('["Aria", "Roger"]'), 'jewel route no longer restricts voices to Aria/Roger');
assert.ok(route.includes('JEWEL_GENERATION_ADDENDUM'), 'jewel route carries the generation-options addendum');
// The shared /api/ai twin keeps the identical contract: same DRAFT_SYSTEM
// (byte-identical, as tests/jewel-agent.cjs enforces) and the same checkers.
const aiRoute = fs.readFileSync('app/api/ai/route.ts', 'utf8');
assert.ok(aiRoute.includes('checkedGenerationAction') && aiRoute.includes('checkedBoardRegenerateAction'), 'ai route mirrors the generation checkers');
assert.ok(!aiRoute.includes('["Aria","Roger"]'), 'ai route no longer restricts voices to Aria/Roger');
const draftSystemOf = (source) => source.slice(source.indexOf('const DRAFT_SYSTEM = `'), source.indexOf('`;', source.indexOf('const DRAFT_SYSTEM = `')) + 2);
assert.equal(draftSystemOf(route), draftSystemOf(aiRoute), 'DRAFT_SYSTEM stays byte-identical between the routes');

// --- Image: shape + reference image pass through like the panel ------------
assert.deepEqual(
  plain(checkedGenerationAction({ type: 'image', prompt: 'a neon stage', aspectRatio: '9:16', sourceKey: 'img-1' }, 'make it portrait')),
  { type: 'image', prompt: 'a neon stage', sourceKey: 'img-1', aspectRatio: '9:16' });
assert.equal(checkedGenerationAction({ type: 'image', prompt: 'x', aspectRatio: '1:1' }, '').aspectRatio, '1:1');
assert.equal(checkedGenerationAction({ type: 'image', prompt: 'x', aspectRatio: '3:4' }, '').aspectRatio, '3:4');
assert.equal(checkedGenerationAction({ type: 'image', prompt: 'x', aspectRatio: '7:5', sourceKey: 'img-1' }, '').aspectRatio, 'auto');
assert.equal(checkedGenerationAction({ type: 'image', prompt: 'x', aspectRatio: '7:5' }, '').aspectRatio, '16:9');
assert.equal(checkedGenerationAction({ type: 'image', prompt: 'x' }, '').sourceKey, null);

// --- Video: length + reference image, panel validation ---------------------
assert.equal(checkedGenerationAction({ type: 'video', prompt: 'waves', durationSeconds: 30 }, '').durationSeconds, 30);
assert.equal(checkedGenerationAction({ type: 'video', prompt: 'waves', durationSeconds: 12, sourceKey: 'img-9' }, '').sourceKey, 'img-9');
assert.equal(checkedGenerationAction({ type: 'video', prompt: 'waves' }, 'make a 12 second clip').durationSeconds, 12);
assert.equal(checkedGenerationAction({ type: 'video', prompt: 'waves' }, '').durationSeconds, 5);
assert.throws(() => checkedGenerationAction({ type: 'video', prompt: 'waves', durationSeconds: 45 }, ''));

// --- Voice: full catalog + stability slider range ---------------------------
for (const name of GENERATOR_VOICE_NAMES) {
  assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello', voice: name }, '').voice, name);
}
assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello', voice: 'Narrator' }, '').voice, null);
assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello', voice: 'George', stability: 0.8 }, '').stability, 0.8);
assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello', stability: 1.7 }, '').stability, 1);
assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello', stability: -0.2 }, '').stability, 0);
assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello', stability: 'high' }, '').stability, null);
assert.equal(checkedGenerationAction({ type: 'voice', prompt: 'hello' }, '').stability, null);

// --- Music: length modes, lyrics, instrumental toggle -----------------------
const song = checkedGenerationAction({ type: 'music', prompt: 'theme', durationSeconds: 25, lyrics: 'la la', instrumental: false }, '');
assert.deepEqual(plain(song), { type: 'music', prompt: 'theme', sourceKey: null, durationSeconds: 25, lyrics: 'la la', instrumental: false });
assert.equal(checkedGenerationAction({ type: 'music', prompt: 'theme', durationSeconds: 0 }, '').durationSeconds, null); // full song
assert.equal(checkedGenerationAction({ type: 'music', prompt: 'calm piano', instrumental: true }, '').instrumental, true);
assert.equal(checkedGenerationAction({ type: 'music', prompt: 'calm piano' }, '').instrumental, false);
assert.equal(checkedGenerationAction({ type: 'music', prompt: 'x', lyrics: 'a'.repeat(4000) }, '').lyrics.length, 3500);

// --- SFX: length clamped to the panel's 2–30 seconds ------------------------
assert.equal(checkedGenerationAction({ type: 'sfx', prompt: 'ding', durationSeconds: 10 }, '').durationSeconds, 10);
assert.equal(checkedGenerationAction({ type: 'sfx', prompt: 'ding', durationSeconds: 45 }, '').durationSeconds, 30);
assert.equal(checkedGenerationAction({ type: 'sfx', prompt: 'ding', durationSeconds: 1 }, '').durationSeconds, 2);
assert.equal(checkedGenerationAction({ type: 'sfx', prompt: 'ding', durationSeconds: 7.6 }, '').durationSeconds, 8);
assert.equal(checkedGenerationAction({ type: 'sfx', prompt: 'ding' }, '').durationSeconds, 5);

// --- Malformed generation actions fall through to null ----------------------
assert.equal(checkedGenerationAction(null, ''), null);
assert.equal(checkedGenerationAction({}, ''), null);
assert.equal(checkedGenerationAction({ type: 'tool', prompt: 'x' }, ''), null);
assert.equal(checkedGenerationAction({ type: 'image', prompt: 42 }, ''), null);
assert.equal(checkedGenerationAction({ type: 'image', prompt: 'y'.repeat(13000) }, '').prompt.length, 12000);

// The checked actions carry exactly the GenerateOptions fields the panel
// passes for each type, so the executor builds the same generate-asset call.
assert.deepEqual(Object.keys(checkedGenerationAction({ type: 'image', prompt: 'x' }, '')).sort(), ['aspectRatio', 'prompt', 'sourceKey', 'type']);
assert.deepEqual(Object.keys(checkedGenerationAction({ type: 'video', prompt: 'x' }, '')).sort(), ['durationSeconds', 'prompt', 'sourceKey', 'type']);
assert.deepEqual(Object.keys(checkedGenerationAction({ type: 'voice', prompt: 'x' }, '')).sort(), ['prompt', 'sourceKey', 'stability', 'type', 'voice']);
assert.deepEqual(Object.keys(checkedGenerationAction({ type: 'music', prompt: 'x' }, '')).sort(), ['durationSeconds', 'instrumental', 'lyrics', 'prompt', 'sourceKey', 'type']);
assert.deepEqual(Object.keys(checkedGenerationAction({ type: 'sfx', prompt: 'x' }, '')).sort(), ['durationSeconds', 'prompt', 'sourceKey', 'type']);

// --- Trivia: count + categories pass through, panel bounds ------------------
assert.deepEqual(plain(checkedTriviaAction({ type: 'trivia', count: 50, categories: ['music', 'science'] })),
  { type: 'trivia', count: 50, categories: ['music', 'science'] });
assert.equal(checkedTriviaAction({ type: 'trivia', count: 1 }).count, 1);
assert.equal(checkedTriviaAction({ type: 'trivia', count: 500 }).count, 500);
assert.equal(checkedTriviaAction({ type: 'trivia', count: 0 }), null);
assert.equal(checkedTriviaAction({ type: 'trivia', count: 501 }), null);
assert.equal(checkedTriviaAction({ type: 'trivia', count: 2.5 }), null);
assert.equal(checkedTriviaAction({ type: 'trivia', count: '50' }), null);
assert.deepEqual(plain(checkedTriviaAction({ type: 'trivia', count: 10, categories: ['a', 7, 'b'] }).categories), ['a', 'b']);
assert.equal(checkedTriviaAction({ type: 'trivia', count: 10, categories: Array.from({ length: 30 }, (_, i) => `c${i}`) }).categories.length, 20);
assert.equal(checkedTriviaAction({ type: 'image', count: 10 }), null);

// --- Board regenerate: same operations the buttons run ----------------------
const boardProject = createProject('Board test');
boardProject.gameTools = [{
  id: 'board-1', type: 'trivia-board', name: 'Trivia Board', enabled: true, inToolbox: false,
  config: { categories: [{ name: 'Music', questions: [] }, { name: 'Movies', questions: [] }] },
}];
assert.deepEqual(plain(checkedBoardRegenerateAction({ type: 'board-regenerate', mode: 'generate' }, boardProject)),
  { type: 'board-regenerate', mode: 'generate', category: null });
assert.deepEqual(plain(checkedBoardRegenerateAction({ type: 'board-regenerate', mode: 'source' }, boardProject)),
  { type: 'board-regenerate', mode: 'source', category: null });
assert.deepEqual(plain(checkedBoardRegenerateAction({ type: 'board-regenerate', mode: 'generate', category: 'Music' }, boardProject)),
  { type: 'board-regenerate', mode: 'generate', category: 'Music' });
assert.throws(() => checkedBoardRegenerateAction({ type: 'board-regenerate', mode: 'shuffle' }, boardProject));
assert.throws(() => checkedBoardRegenerateAction({ type: 'board-regenerate', mode: 'generate', category: 'Sports' }, boardProject));
assert.throws(() => checkedBoardRegenerateAction({ type: 'board-regenerate', mode: 'generate' }, createProject('No board')));
assert.equal(checkedBoardRegenerateAction({ type: 'trivia', mode: 'generate' }, boardProject), null);
assert.equal(checkedBoardRegenerateAction(null, boardProject), null);

// --- Executor wiring: options reach generateAsset; board action runs the
// --- identical page function the removed buttons used to call --------------
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
assert.ok(page.includes('stability: mediaAction.stability'), 'executor passes stability to generateAsset');
assert.ok(page.includes('instrumental: mediaAction.instrumental'), 'executor passes instrumental to generateAsset');
assert.ok(page.includes('action.type === "board-regenerate"'), 'executor handles the board-regenerate action');
assert.ok(page.includes('regenerateTrivia(action.mode === "source" ? "source" : "generate", action.category || undefined)'),
  'executor runs the same regenerateTrivia function the removed buttons used to call');
const assetsPanel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
assert.ok(!assetsPanel.includes('regenerateTrivia(') && !assetsPanel.includes('Regenerate sourced board') && !assetsPanel.includes('Refresh sources'),
  'Half B: the board regenerate/refresh buttons are gone — regeneration runs through Jewel');

console.log('jewel-generation-parity: all assertions passed');
