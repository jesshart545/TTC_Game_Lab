const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), load = require('./load.cjs');
const { cleanSoundPads, soundPadsOf, freshSoundBoardState, soundBoardTransition } = load('lib/sound-board.ts');
const { clampDjCrossfadeSeconds, cleanDeckKeyList, deckTracks, deckTrackKeys, freshDjState, djTransition, walkDjPlayback } = load('lib/dj-deck.ts');
const { toolDefaults } = load('lib/game-tools.ts');
const { SHELF_LIBRARY, shelfRoute } = load('lib/workshop-libraries.ts');
const { creatableTools, applyBuildChanges } = load('lib/build-edits.ts');
const { addCreationControl, buttonFacts } = load('lib/build-controls.ts');
const { dashboardTargets } = load('lib/dashboard-actions.ts');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const roundTrip = value => JSON.parse(JSON.stringify(value));

// Radio slice 3 — the music core (Jessica, 2026-11-23): "the full
// sound board and the availability for the user to use their own
// music and the dj uses jewel to create their backgrounds video
// cutscenes and the dj should be able to merge and play their songs
// with dj functions." Two new tool types on the shared architecture:
// the Sound Board (pads bound to the project's own audio, fired from
// the host dashboard, heard on the overlay) and the DJ Deck (the
// project's own songs with play / pause / previous / next and MERGE —
// a crossfade blend into the next song). Plus the radio-worded Jewel
// greeting and composer placeholder Jessica directed the same night.

const T0 = 1_000_000;

// ---------- registration: catalog, defaults, shelf, Jewel's vocabulary ----------
{
  const union = read('lib/project.ts').match(/export type GameToolType = ([^;]+);/)[1];
  assert(union.includes('"sound-board"') && union.includes('"dj-deck"'), 'the GameToolType union carries both music tools');
  assert.deepEqual(roundTrip(toolDefaults('sound-board')), { title: 'Sound Board', pads: [] }, 'sound board defaults are sane');
  assert.deepEqual(roundTrip(toolDefaults('dj-deck')), { title: 'DJ Deck', tracks: [], poolIds: [], crossfadeSeconds: 4 }, 'DJ deck defaults carry the 4-second merge blend');
  for (const type of ['sound-board', 'dj-deck']) {
    const entries = SHELF_LIBRARY.filter(item => item.type === type);
    assert.equal(entries.length, 1, `the shelf library contains ${type} exactly once`);
    assert.equal(shelfRoute(entries[0]), 'add', `${type} is a plain shelf add`);
    assert(creatableTools.includes(type), `Jewel can create the ${type}`);
  }
  console.log('PASS: both music tools are registered in the type union, defaults, shelf and Jewel\'s creatable list; the merge blend defaults to 4 seconds.');
}

// ---------- Jewel's prompt vocabulary in both routes ----------
{
  for (const route of ['app/api/jewel/route.ts', 'app/api/ai/route.ts']) {
    const src = read(route);
    assert(src.includes('"bank"|"sound-board"|"dj-deck","config"'), `${route}: the tool action vocabulary names both music tools`);
    assert(src.includes('"city-crime-scene"|"sound-board"|"dj-deck",name,config,connect:true'), `${route}: changes.newTools names both music tools`);
    assert(src.includes('toolType "sound-board" with config pads'), `${route}: the prompt teaches the sound board config`);
    assert(src.includes('toolType "dj-deck" with config tracks'), `${route}: the prompt teaches the DJ deck config`);
  }
  console.log('PASS: both Jewel routes teach the sound board and DJ deck tool types and their configs.');
}

// ---------- creation through Jewel's build path sanitizes config ----------
{
  const base = { id: 'test', assets: [], controls: [], gameTools: [], overlay: {}, compositions: [] };
  const result = applyBuildChanges(base, { newTools: [
    { type: 'sound-board', name: 'Board', config: { title: 'Board', pads: [
      { id: 'p1', label: '$ Cash $ register', assetKey: 'sting-1' },
      { id: 'p2', label: 'Unbound pad' },
      { label: 'Applause', assetKey: 'applause-1' },
    ] } },
    { type: 'dj-deck', name: 'Deck', config: { title: 'Deck', tracks: ['song-1', 'song-1', 'song-2'], poolIds: ['pool-1'], crossfadeSeconds: 99 } },
  ] });
  const board = result.project.gameTools.find(t => t.type === 'sound-board');
  const deck = result.project.gameTools.find(t => t.type === 'dj-deck');
  assert.ok(board && deck, 'creation: both music tools are created');
  assert.equal(board.config.pads.length, 2, 'creation: the unbound pad is dropped, bound pads kept');
  assert.equal(board.config.pads[0].id, 'p1', 'creation: pad ids are preserved');
  assert(!board.config.pads[0].label.includes('$'), 'creation: pad labels carry no dollar signs');
  assert.equal(deck.config.crossfadeSeconds, 30, 'creation: the merge blend is clamped to the 30-second maximum');
  assert.deepEqual(roundTrip(deck.config.tracks), ['song-1', 'song-2'], 'creation: the track list is deduped in order');
  for (const tool of [board, deck]) {
    assert.equal(tool.inToolbox, true, 'creation: the tool lands in the toolbox');
    assert.ok(!tool.inOverlayBuild, 'creation: nothing is auto-wired onto the overlay');
  }
  console.log('PASS: Jewel creation cleans pads (ids kept, unbound dropped, no dollar signs), dedupes tracks, clamps the blend, and places nothing by default.');
}

// ---------- connecting a music tool: one Show control, plain facts ----------
{
  for (const [type, name] of [['sound-board', 'Sound Board'], ['dj-deck', 'DJ Deck']]) {
    const tool = { id: 'music1', type, name, enabled: true, inToolbox: true, config: JSON.parse(JSON.stringify(toolDefaults(type))) };
    const project = { id: 'test', assets: [], controls: [], gameTools: [tool], overlay: {}, compositions: [] };
    const wired = addCreationControl(project, 'tool', 'music1');
    const control = wired.project.controls.find(c => c.id === wired.controlId);
    assert.equal(control.action, 'audio.toggle.music1', `wiring the ${type} adds the one Show/remove button`);
    assert.equal(wired.project.gameTools.find(t => t.id === 'music1').inOverlayBuild, true, 'connecting places the tool in the overlay build');
    const facts = buttonFacts(control, wired.project);
    assert.equal(facts.does, `Shows: ${name}`); assert.equal(facts.clicks, 'Click to show · click again to hide');
    const targets = dashboardTargets(wired.project, control.id);
    assert(targets.some(t => (t.actions || []).some(a => a.value === 'audio.toggle.music1')), `the dashboard action list offers the ${type}'s Show/remove`);
  }
  console.log('PASS: connecting either music tool adds exactly one Show/remove control; facts read back plainly.');
}

// ---------- the sound board state layer ----------
{
  const pads = cleanSoundPads([
    { id: 'p1', label: 'Intro', assetKey: 'intro-1' },
    { id: 'p2', label: 'Sting', assetKey: 'sting-1' },
    { label: 'No asset bound' },
  ]);
  assert.equal(pads.length, 2, 'cleanSoundPads keeps only bound pads');
  assert.equal(soundPadsOf({ pads }).length, 2, 'soundPadsOf reads the saved pads');
  let s = freshSoundBoardState();
  assert.equal(s.visible, false, 'a fresh board face is hidden until the host shows it');
  s = soundBoardTransition(s, 'play-pad', T0, 'p1');
  assert.equal(s.pads.p1.playing, true, 'firing a pad plays it');
  const again = soundBoardTransition(s, 'play-pad', T0 + 100, 'p1');
  assert.equal(again, s, 'firing a playing pad through play-pad changes nothing (the panel sends stop)');
  s = soundBoardTransition(s, 'stop-pad', T0 + 200, 'p1');
  assert.equal(s.pads.p1.playing, false, 'stopping a pad silences it');
  s = soundBoardTransition(s, 'play-pad', T0 + 300, 'p2');
  assert.equal(s.pads.p2.playing, true, 'pads sound independently');
  s = soundBoardTransition(s, 'toggle', T0 + 400);
  assert.equal(s.visible, true, 'toggle shows the board face');
  console.log('PASS: sound board pads play and stop independently; the face toggles.');
}

// ---------- the DJ deck state layer: DJ controls + song blending ----------
{
  assert.equal(clampDjCrossfadeSeconds(undefined), 4, 'the merge blend defaults to 4 seconds');
  assert.equal(clampDjCrossfadeSeconds(99), 30, 'the merge blend clamps at 30 seconds');
  assert.equal(clampDjCrossfadeSeconds(-2), 0, 'the merge blend clamps at 0 (a hard cut)');
  assert.deepEqual(roundTrip(cleanDeckKeyList(['a', 'a', 'b', ''])), ['a', 'b'], 'deck key lists dedupe and drop blanks');
  const keys = ['song-a', 'song-b', 'song-c'];
  const cfg = { crossfadeSeconds: 6 };
  let s = freshDjState();
  assert.equal(s.status, 'stopped');
  s = djTransition(s, 'play', T0, keys, cfg);
  assert.equal(s.status, 'playing'); assert.equal(s.trackKey, 'song-a', 'play starts the first song');
  // MERGE — the song blending: a crossfade into the next song over
  // the configured seconds, the outgoing song named with its live
  // position so the overlay can fade it out.
  s = djTransition(s, 'merge', T0 + 10_000, keys, cfg);
  assert.equal(s.trackKey, 'song-b', 'merge moves the deck to the next song');
  assert.deepEqual(roundTrip(s.fade), { fromKey: 'song-a', fromPosition: 10, startedAt: T0 + 10_000, seconds: 6 }, 'merge records the blend: outgoing song, its position, the configured seconds');
  s = djTransition(s, 'pause', T0 + 12_000, keys, cfg);
  assert.equal(s.status, 'paused'); assert.equal(s.position, 2, 'pause settles the incoming song at its live position');
  assert.equal(s.fade, null, 'pause completes a merge in progress');
  s = djTransition(s, 'play', T0 + 20_000, keys, cfg);
  assert.equal(s.status, 'playing', 'play resumes a paused deck');
  s = djTransition(s, 'next', T0 + 21_000, keys, cfg);
  assert.equal(s.trackKey, 'song-c', 'next skips forward');
  s = djTransition(s, 'previous', T0 + 22_000, keys, cfg);
  assert.equal(s.trackKey, 'song-b', 'previous skips back');
  s = djTransition(s, 'play-track', T0 + 23_000, keys, cfg, 'song-a');
  assert.equal(s.trackKey, 'song-a', 'play-track jumps to a chosen song');
  s = djTransition(s, 'stop', T0 + 24_000, keys, cfg);
  assert.equal(s.status, 'stopped'); assert.equal(s.position, 0, 'stop rewinds');
  s = djTransition(s, 'toggle', T0 + 25_000, keys, cfg);
  assert.equal(s.visible, true, 'toggle shows the deck face');
  const cut = djTransition(djTransition(freshDjState(), 'play', T0, keys, { crossfadeSeconds: 0 }), 'merge', T0 + 1000, keys, { crossfadeSeconds: 0 });
  assert.equal(cut.trackKey, 'song-b'); assert.equal(cut.fade, null, 'a zero-second blend is a hard cut to the next song');
  console.log('PASS: the deck plays, pauses, resumes, skips both ways, jumps to a song, stops — and MERGE blends into the next song over the configured seconds (default 4).');
}

// ---------- the playback walk: every view agrees where the music is ----------
{
  const tracks = [{ key: 'song-a', duration: 10 }, { key: 'song-b', duration: 10 }, { key: 'song-c', duration: 5 }];
  let s = djTransition(freshDjState(), 'play', T0, ['song-a', 'song-b', 'song-c'], {});
  let walk = walkDjPlayback(s, tracks, T0 + 12_000);
  assert.equal(walk.index, 1); assert.equal(walk.position, 2); assert.equal(walk.status, 'playing', 'the walk crosses a finished song into the next');
  walk = walkDjPlayback(s, tracks, T0 + 26_000);
  assert.equal(walk.index, 2); assert.equal(walk.status, 'ended', 'the last song ending ends the show (no loop)');
  console.log('PASS: the playback walk crosses track ends and ends the show after the last song.');
}

// ---------- the deck's track list resolves from the project's own music ----------
{
  const project = {
    id: 'test',
    assets: [
      { name: 'song-one.mp3', type: 'audio/mpeg', storageKey: 'k-song-1', url: 'https://example/1' },
      { name: 'song-two.wav', type: 'audio/wav', storageKey: 'k-song-2', url: 'https://example/2' },
      { name: 'song-three.m4a', type: 'audio/mp4', storageKey: 'k-song-3', url: 'https://example/3' },
      { name: 'cover.png', type: 'image/png', storageKey: 'k-pic', url: 'https://example/4' },
    ],
    assetPools: [{ id: 'pool-1', name: 'Night pool', assetKeys: ['k-song-3', 'k-song-1', 'k-pic'] }],
    controls: [], gameTools: [], overlay: {}, compositions: [],
  };
  const tool = { id: 'deck1', type: 'dj-deck', name: 'Deck', enabled: true, config: { tracks: ['k-song-2', 'k-song-1', 'k-pic'], poolIds: ['pool-1'] } };
  assert.deepEqual(roundTrip(deckTrackKeys(project, tool)), ['k-song-2', 'k-song-1', 'k-song-3'],
    'explicit tracks first in order, pool songs after, duplicates and non-audio excluded');
  assert.equal(deckTracks(project, tool)[0].name, 'song-two.wav', 'tracks resolve to the project\'s own assets');
  console.log('PASS: the deck plays the project\'s own music — saved tracks first, then its playlist pools, audio only.');
}

// ---------- surfaces: panels on dashboards, playback only on overlays ----------
{
  const deckPanel = read('components/DjDeckHostPanel.tsx');
  const boardPanel = read('components/SoundBoardHostPanel.tsx');
  for (const [src, label] of [[deckPanel, 'DJ deck panel'], [boardPanel, 'sound board panel']]) {
    assert(!src.includes('<audio'), `the ${label} holds no audio element — dashboards send commands only`);
  }
  for (const action of ['play', 'pause', 'previous', 'next', 'merge', 'stop']) {
    assert(deckPanel.includes(`run("${action}"`), `the DJ deck's dashboard controls include ${action}`);
  }
  assert(deckPanel.includes('Merge ⤵'), 'the deck panel\'s Merge button names the blend');
  assert(boardPanel.includes('"play-pad"') && boardPanel.includes('"stop-pad"'), 'the sound board panel fires and stops pads');
  const publishedDash = read('app/published/[slug]/page.tsx');
  assert(publishedDash.includes('DjDeckHostPanel') && publishedDash.includes('SoundBoardHostPanel'), 'the published host dashboard renders both music panels');
  assert(publishedDash.includes('useLiveAudio'), 'the published dashboard reads the shared audio state');
  const publishedOverlay = read('app/published/[slug]/overlay/page.tsx');
  assert(publishedOverlay.includes('DjDeckEngine') && publishedOverlay.includes('SoundBoardEngine'), 'the published overlay mounts both playback engines');
  assert(publishedOverlay.includes('useLiveAudio'), 'the published overlay reads the shared audio state');
  const draftRuntime = read('components/RuntimeActionLayers.tsx');
  assert(draftRuntime.includes('deckCommand') && draftRuntime.includes('soundCommand'), 'the draft runtime carries both music commands');
  assert(draftRuntime.includes('audio\\.toggle'), 'the draft runtime answers the Show/remove buttons');
  const standing = read('components/StandingToolFace.tsx');
  assert(standing.includes('"sound-board", "dj-deck"'), 'both music tools are standing-face types');
  assert(standing.includes('<DjDeckVisual') && standing.includes('<SoundBoardVisual'), 'the standing layer renders both faces from the shared state');
  const liveRoute = read('app/api/live/[slug]/route.ts');
  assert(liveRoute.includes("control.action.startsWith('audio.toggle.')"), 'the live events route dispatches the audio Show/remove');
  const audioRoute = read('app/api/live/[slug]/audio/route.ts');
  assert(audioRoute.includes("'merge'"), 'the live audio route accepts the merge command');
  console.log('PASS: host panels exist for both tools with the full DJ controls and no audio elements; playback engines live on the overlay pages; the live routes carry the commands.');
}

// ---------- Jewel's radio addendum: music tools offered, the rest withheld ----------
{
  const jewel = read('app/api/jewel/route.ts');
  const addendum = jewel.slice(jewel.indexOf('const JEWEL_RADIO_ADDENDUM'), jewel.indexOf('function radioAddendum'));
  assert(addendum.includes('THE SOUND BOARD AND THE DJ DECK ARE YOUR MUSIC TOOLS'), 'the addendum offers the sound board and DJ deck as built');
  assert(addendum.includes('BACKGROUNDS AND VIDEO CUTSCENES'), 'the addendum teaches backgrounds and video cutscenes through normal generation');
  assert(addendum.includes('no break timer, requests and shout-outs board, running order or singer queue tool to add'), 'the addendum still withholds the four next-slice pieces');
  assert(addendum.includes('Never promise one'), 'the honesty rule for the withheld pieces stands');
  console.log('PASS: the radio addendum offers the sound board, the DJ deck, backgrounds and cutscenes — and still promises none of the four later pieces.');
}

// ---------- RadioStage asks: playlist, background, cutscene for the DJ branch ----------
{
  const stage = read('components/RadioStage.tsx');
  const djAsks = stage.slice(stage.indexOf('const DJ_ASKS'), stage.indexOf('const KARAOKE_ASKS'));
  const playlistAt = djAsks.indexOf('Build my playlist');
  const backgroundAt = djAsks.indexOf('background');
  const cutsceneAt = djAsks.indexOf('video cutscene');
  assert(playlistAt >= 0 && backgroundAt > playlistAt, 'the DJ asks keep the playlist first, then a background ask');
  assert(cutsceneAt > backgroundAt, 'the DJ asks offer a video cutscene after the background');
  console.log('PASS: the radio/DJ stage asks run playlist first, then background, then video cutscene.');
}

// ---------- the radio greeting and placeholder (Jessica's directed fix) ----------
{
  const flow = read('app/project/new/flow.tsx');
  assert(flow.includes('start with the trivia generator, board and tool templates, uploads, or Asset Composer'), 'the shared greeting seed is untouched for the other kinds');
  const radioGreeting = flow.slice(flow.indexOf('The canned Jewel greeting is radio-worded'));
  assert(radioGreeting.includes('set up a DJ deck to play and merge your songs'), 'the radio/DJ greeting names the deck and merging');
  assert(radioGreeting.includes('sound board'), 'the radio greeting names the sound board');
  assert(radioGreeting.includes('video cutscene'), 'the radio greeting names video cutscenes');
  const greetings = [...flow.matchAll(/"Tell me about your (?:karaoke night|show) — [^"]+"/g)].map(m => m[0]);
  assert.equal(greetings.length, 3, 'three radio greetings are seeded (karaoke, radio/DJ, branch unset)');
  for (const greeting of greetings) {
    assert(!greeting.includes('trivia'), 'the radio greetings carry no trivia wording');
    assert(!greeting.includes('Asset Composer'), 'the radio greetings carry no Asset Composer wording');
    assert(!greeting.includes('templates'), 'the radio greetings carry no template wording');
  }
  const panel = read('components/WorkshopAiPanel.tsx');
  assert(panel.includes('Example: Build my playlist and set up a sound board with my intro and effects.'), 'the radio composer placeholder is radio-worded');
  assert(panel.includes('Example: Help me create a music quiz with easy host controls.'), 'the other kinds\' placeholder is unchanged');
  console.log('PASS: a radio project greets and prompts in radio words; every other kind\'s greeting and placeholder are byte-identical.');
}

console.log('RADIO MUSIC CORE: ALL PASS');
