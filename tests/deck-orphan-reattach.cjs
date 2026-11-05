// Deck-orphan re-attach — the follow-up repair to PR #158's save
// lineage. The lineage fix stopped stale saves from erasing asset
// entries, but projects saved before it can still carry the wound:
// project-1793770257912 ("Jewel Test Talk Show") lost its generated
// backdrop's ENTRY from project.assets while the image file stayed in
// storage and the talkDeck's sign slide kept referencing its storage
// key — so the deck rendered a placeholder for a picture that was
// never deleted, and no screen could attach the file back.
//
// The heal (lib/deck-orphans.ts, run on project load in
// app/project/[id]/page.tsx) is narrow on purpose:
//  (a) an orphaned deck refKey whose file still resolves through the
//      app's own asset-url resolution gets exactly one re-attached
//      entry — storage key, a name rebuilt from the key's tail, the
//      image type its generated label states, the background role,
//      inProject — and nothing fabricated beyond what the key proves
//      (no text layer, no generation record);
//  (b) a refKey whose file does not resolve is skipped silently — no
//      entry is ever created for a missing file, and nothing is saved;
//  (c) a project whose deck references all have entries is completely
//      untouched (the resolver is never even consulted, no save);
//  (d) the heal is idempotent: loading the healed project again finds
//      the entry present and does nothing.
// The page wires the heal into the load path and persists a healed
// project exactly once, through PR #158's guarded enqueueSave queue.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

const { deckOrphanRefKeys, deckOrphanName, deckOrphanEntry, reattachDeckOrphans } = load('lib/deck-orphans.ts');
// Values built inside the vm sandbox carry its realm's prototypes, which
// deepStrictEqual rejects against host literals — clone into this realm
// (the same JSON round-trip the other suites use) before comparing.
const clone = value => JSON.parse(JSON.stringify(value));

const PROJECT_ID = 'project-1793770257912';
const BACKDROP_KEY = 'projects/project-1793770257912/5ebad4f2-5181-43ac-bbd4-4a3ec3c90cff-Cozy-television-talk-show-studio-backdrop-for-a-Image';
const BACKDROP_NAME = 'Cozy television talk show studio backdrop for a Image';
const GONE_KEY = 'projects/project-1793770257912/6ebad4f2-5181-43ac-bbd4-4a3ec3c90cff-Vanished-studio-backdrop-Image';
const VIDEO_KEY = 'projects/project-1793770257912/7ebad4f2-5181-43ac-bbd4-4a3ec3c90cff-Opening-clip-Video';

const stickerA = { name: 'Gold star sticker', type: 'image/png', storageKey: `projects/${PROJECT_ID}/sticker-a`, inProject: false };
const stickerB = { name: 'Purple note sticker', type: 'image/png', storageKey: `projects/${PROJECT_ID}/sticker-b`, inProject: true };

function woundedProject(overrides = {}) {
  return {
    id: PROJECT_ID,
    name: 'Jewel Test Talk Show',
    assets: [stickerA, stickerB],
    talkDeck: [
      { id: 'slide-sign', kind: 'sign', label: 'Your sign — Jewel Test Talk Show', refKey: BACKDROP_KEY },
    ],
    ...overrides,
  };
}

function countingResolver(behavior) {
  const calls = [];
  const resolver = async asset => { calls.push(asset.storageKey); return behavior(asset); };
  resolver.calls = calls;
  return resolver;
}
const resolvesWithUrl = countingResolver(async asset => ({ ...asset, url: `https://storage.test/${asset.storageKey}` }));
const neverResolves = countingResolver(async () => { throw new Error('Could not refresh the asset URL.'); });

test('the re-attached name and entry come from the key alone', () => {
  assert.equal(deckOrphanName(BACKDROP_KEY), BACKDROP_NAME, 'the UUID and key punctuation fall away; the name the generator gave the backdrop reads back');
  assert.deepEqual(clone(deckOrphanEntry(BACKDROP_KEY)), {
    name: BACKDROP_NAME,
    type: 'image/png',
    storageKey: BACKDROP_KEY,
    role: 'background',
    inProject: true,
  }, 'exactly the fields the key proves — no textOverlay, no generation record, nothing fabricated');
  assert.equal(deckOrphanEntry(VIDEO_KEY), null, 'a non-image tail is not re-attached: its original type and role cannot be derived from the key, so the heal makes no claim about it');
});

test('(a) an orphaned deck refKey with an existing file gets exactly one re-attached entry', async () => {
  const project = woundedProject({
    talkDeck: [
      { id: 'slide-sign', kind: 'sign', label: 'Your sign — Jewel Test Talk Show', refKey: BACKDROP_KEY },
      { id: 'slide-backdrop', kind: 'backdrop', label: 'Backdrop', refKey: BACKDROP_KEY },
    ],
  });
  assert.deepEqual(Array.from(deckOrphanRefKeys(project)), [BACKDROP_KEY], 'two slides sharing one orphaned key are one orphan');
  const healed = await reattachDeckOrphans(project, resolvesWithUrl);
  assert.ok(healed, 'the heal returns the repaired project');
  assert.notEqual(healed, project, 'the loaded project is a new object — the server copy is never mutated in place');
  assert.equal(project.assets.length, 2, 'the input project keeps its two sticker entries untouched');
  assert.equal(healed.assets.length, 3, 'exactly one entry is re-attached');
  assert.deepEqual(clone(healed.assets.slice(0, 2)), [stickerA, stickerB], 'the surviving entries carry over unchanged');
  assert.deepEqual(clone(healed.assets[2]), {
    name: BACKDROP_NAME,
    type: 'image/png',
    storageKey: BACKDROP_KEY,
    role: 'background',
    inProject: true,
    url: `https://storage.test/${BACKDROP_KEY}`,
  }, 'the re-attached entry is the key-derived entry, carrying the fresh url the app resolution returned');
  assert.equal(healed.talkDeck, project.talkDeck, 'the deck itself is not rewritten — only the missing entry returns');
});

test('(b) a refKey whose file does not resolve is skipped — no entry, no healed project', async () => {
  const callsBefore = neverResolves.calls.length;
  const project = woundedProject({
    talkDeck: [{ id: 'slide-sign', kind: 'sign', label: 'Your sign', refKey: GONE_KEY }],
  });
  const healed = await reattachDeckOrphans(project, neverResolves);
  assert.equal(healed, null, 'nothing re-attached means no healed project — and the page saves nothing');
  assert.deepEqual(neverResolves.calls.slice(callsBefore), [GONE_KEY], 'the file was actually checked through the resolution path before being skipped');
  assert.equal(project.assets.length, 2, 'no entry was created for the missing file');
});

test('a mix of orphans re-attaches only the ones whose files resolve', async () => {
  const selective = countingResolver(async asset => {
    if (asset.storageKey === GONE_KEY) throw new Error('Could not refresh the asset URL.');
    return { ...asset, url: `https://storage.test/${asset.storageKey}` };
  });
  const project = woundedProject({
    talkDeck: [
      { id: 'slide-sign', kind: 'sign', label: 'Your sign — Jewel Test Talk Show', refKey: BACKDROP_KEY },
      { id: 'slide-gone', kind: 'backdrop', label: 'Gone', refKey: GONE_KEY },
      { id: 'slide-video', kind: 'media', label: 'Clip', refKey: VIDEO_KEY },
    ],
  });
  const healed = await reattachDeckOrphans(project, selective);
  assert.ok(healed);
  assert.deepEqual(Array.from(healed.assets, asset => asset.storageKey), [stickerA.storageKey, stickerB.storageKey, BACKDROP_KEY], 'only the resolving image orphan returns');
  assert.deepEqual([...selective.calls].sort(), [BACKDROP_KEY, GONE_KEY].sort(), 'the video key is never even resolved — the heal makes no claim about non-image references');
});

test('(c) a project whose deck refs all exist in assets is completely untouched', async () => {
  const resolver = countingResolver(async asset => ({ ...asset, url: 'https://storage.test/unused' }));
  const healthy = woundedProject({
    assets: [stickerA, stickerB, { name: BACKDROP_NAME, type: 'image/png', storageKey: BACKDROP_KEY, role: 'background', inProject: true }],
  });
  assert.deepEqual(Array.from(deckOrphanRefKeys(healthy)), [], 'no orphans when the deck reference has its entry');
  assert.equal(await reattachDeckOrphans(healthy, resolver), null, 'no healed project — the page will not save');
  assert.equal(resolver.calls.length, 0, 'the resolver is never consulted for a healthy project');

  const foreign = woundedProject({
    talkDeck: [
      { id: 'slide-quiz', kind: 'quiz', label: 'Quiz', refKey: 'trivia-list-1' },
      { id: 'slide-other', kind: 'media', label: 'Not ours', refKey: 'projects/someone-elses-project/5ebad4f2-5181-43ac-bbd4-4a3ec3c90cff-Backdrop-Image' },
      { id: 'slide-none', kind: 'youtube', label: 'Clip moment' },
    ],
  });
  assert.deepEqual(Array.from(deckOrphanRefKeys(foreign)), [], 'tool ids, other projects’ keys and ref-less slides are never orphans');
  assert.equal(await reattachDeckOrphans(foreign, resolver), null);
  assert.equal(resolver.calls.length, 0);
});

test('(d) loading the healed project again is a no-op', async () => {
  const healed = await reattachDeckOrphans(woundedProject(), resolvesWithUrl);
  assert.ok(healed);
  const resolver = countingResolver(async asset => ({ ...asset, url: 'https://storage.test/unused' }));
  assert.equal(await reattachDeckOrphans(healed, resolver), null, 'the re-attached entry is present, so the second load heals nothing');
  assert.equal(resolver.calls.length, 0, 'and consults nothing — no second save');
});

test('the page wires the heal into load and saves a healed project once through the guarded queue', () => {
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('import { reattachDeckOrphans } from "../../../lib/deck-orphans";'), 'the page imports the heal');
  const start = page.indexOf('let hydrated = found;');
  const end = page.indexOf('setWorkflowStep(', start);
  assert(start >= 0 && end > start, 'the load-path heal block is found');
  const loadBlock = page.slice(start, end);
  assert(loadBlock.includes('reattachDeckOrphans(hydrated, hydrateAsset)'), 'the existence check reuses hydrateAsset — the client resolution behind GET /api/assets?key= — not a new probe');
  assert(loadBlock.includes('const loadedProject = removeLegacyCardTimers({ ...clarifyYoutubeSearch(healed)'), 'the page renders the healed project, so the deck slide resolves its picture on first paint');
  assert(loadBlock.includes('if (healed !== hydrated) void enqueueSave(loadedProject);'), 'a healed project is saved exactly once, through PR #158’s guarded enqueueSave — and an unhealed project is not saved at all');
  assert(!loadBlock.includes('saveProjectToServer'), 'the heal never direct-saves around the guarded queue');
});
