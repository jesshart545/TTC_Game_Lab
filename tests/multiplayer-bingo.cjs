const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const bingo = load('lib/bingo.ts');
// Loaded modules run in the test loader's VM realm, so deepStrictEqual
// rejects their arrays on prototype grounds; compare structurally instead.
const same = (actual, expected, message) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

// Deterministic rng so cards and draw orders are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ITEMS = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);

function snapshot(items, pickerConfig = {}) {
  return {
    name: 'Holy Guacamole Bingo',
    theme: 'purple',
    gameTools: [
      { id: 'list-1', type: 'card-list', name: 'Call Items', enabled: true, config: { cards: items.map((text, i) => ({ id: `c${i + 1}`, text, design: {} })) } },
      { id: 'picker-1', type: 'random-picker', name: 'Draw', enabled: true, config: { source: 'cards', listId: 'list-1', ...pickerConfig } },
    ],
  };
}

function makeRoom(items = ITEMS, pickerConfig = {}, seed = 42) {
  const picked = engine.pickGame(snapshot(items, pickerConfig));
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  const base = engine.newRoomState(picked.gameType, picked.config);
  return {
    id: 'room-1', token: 'tok', projectId: 'proj-1', ownerId: 'owner-1',
    gameType: picked.gameType, title: picked.config.title,
    snapshot: snapshot(items, pickerConfig), config: picked.config, createdAt: 1000,
    ...base,
  };
}

function join(room, players, name, isCreator = false, now = 2000, rng = mulberry32(7)) {
  const result = engine.joinPlayer(room, players, { name, isCreator }, now, rng);
  assert.equal(result.error, undefined, `join ${name}: ${result.error}`);
  return result.player;
}

function startGame(room, players, creator, now, rng = mulberry32(99)) {
  assert.equal(engine.applyAction(room, players, creator.id, { type: 'start' }, now, rng), null);
  assert.equal(room.status, 'countdown');
  engine.tickRoom(room, players, now + engine.COUNTDOWN_MS, rng);
  assert.equal(room.status, 'playing');
  return room.state.startedAt;
}

// --- config extraction -----------------------------------------------------
{
  const picked = engine.pickGame(snapshot(ITEMS));
  assert.equal(picked.gameType, 'bingo');
  same(picked.config.items, ITEMS);
  assert.equal(picked.config.drawIntervalMs, 6000, 'default draw interval is 6s');
  assert.equal(picked.config.title, 'Holy Guacamole Bingo');

  const fast = engine.pickGame(snapshot(ITEMS, { drawIntervalSeconds: 4 }));
  assert.equal(fast.config.drawIntervalMs, 4000, 'picker config sets the interval');

  const tooFew = engine.pickGame(snapshot(['a', 'b', 'c']));
  assert(tooFew.error && tooFew.error.includes(String(bingo.BINGO_MIN_ITEMS)), 'tiny pools are refused with the plain reason');

  // No picker: the largest card list is the pool.
  const noPicker = {
    name: 'Loose Bingo', theme: 'cyan',
    gameTools: [
      { id: 'small', type: 'card-list', config: { cards: ITEMS.slice(0, 6).map(text => ({ text })) } },
      { id: 'big', type: 'card-list', config: { cards: ITEMS.map(text => ({ text })) } },
    ],
  };
  const loose = engine.pickGame(noPicker);
  same(loose.config.items, ITEMS, 'largest card list wins without a picker');
  assert.equal(loose.config.accent, '#22d3ee', 'theme drives the accent');
}

// --- card dealing ----------------------------------------------------------
{
  const rng = mulberry32(5);
  const card = bingo.dealBingoCard(ITEMS, rng);
  assert.equal(card.length, 25);
  assert.equal(card[12], '', 'center is the free square');
  assert.equal(new Set(card.filter(Boolean)).size, 24, 'a full-size pool deals 24 unique items');

  const padded = bingo.dealBingoCard(ITEMS.slice(0, 10), mulberry32(6));
  assert.equal(padded.length, 25);
  assert(padded.filter(Boolean).every(item => ITEMS.slice(0, 10).includes(item)), 'small pools pad by cycling the pool');
  assert.equal(padded.filter(Boolean).length, 24);
}

// --- lobby, joins, readiness, start permissions ----------------------------
{
  const room = makeRoom();
  const players = [];
  assert.equal(engine.joinPlayer(room, players, { name: '   ' }, 1).error, 'Tell everyone your name first.');
  assert.equal(engine.joinPlayer(room, players, { name: 'x'.repeat(25) }, 1).error, 'Names are up to 24 characters.');

  const creator = join(room, players, 'Pastor Joy', true);
  const may = join(room, players, 'Aunt May');
  const resumed = engine.joinPlayer(room, players, { name: 'aunt may' }, 3000);
  assert.equal(resumed.player.id, may.id, 'rejoining by the same name resumes the same seat');
  assert.equal(resumed.joined, false);
  assert.equal(players.length, 2, 'no duplicate seat is created');

  assert(engine.applyAction(room, players, may.id, { type: 'start' }, 4000).includes('creator'), 'only the creator can start');
  assert.equal(engine.applyAction(room, players, may.id, { type: 'ready', ready: true }, 4000), null);
  assert.equal(may.ready, true);
  assert.equal(engine.applyAction(room, players, creator.id, { type: 'start' }, 5000), null);
  assert.equal(room.status, 'countdown');
  assert(engine.applyAction(room, players, may.id, { type: 'ready', ready: false }, 5000).includes('already started'), 'ready is a lobby-only action');
}

// --- countdown → playing: cards dealt, unique, covered ---------------------
{
  const room = makeRoom();
  const players = [];
  const creator = join(room, players, 'Creator', true);
  const names = ['Ana', 'Bea', 'Cid', 'Dee', 'Eli', 'Fay', 'Gus'];
  const friends = names.map(name => join(room, players, name));
  engine.applyAction(room, players, creator.id, { type: 'start' }, 10000, mulberry32(3));
  engine.tickRoom(room, players, 10000 + engine.COUNTDOWN_MS - 1, mulberry32(3));
  assert.equal(room.status, 'countdown', 'no early start before the countdown ends');
  assert.equal(bingo.bingoPlayerState(friends[0].state).card.length, 0, 'no cards during the countdown');
  engine.tickRoom(room, players, 10000 + engine.COUNTDOWN_MS, mulberry32(3));
  assert.equal(room.status, 'playing');

  const seen = new Set();
  for (const player of players) {
    const state = bingo.bingoPlayerState(player.state);
    assert.equal(state.card.length, 25);
    assert.equal(state.card[12], '');
    same(state.markedCells, [12], 'only the free square starts marked');
    assert(state.card.filter(Boolean).every(item => ITEMS.includes(item)), 'every cell comes from the pool');
    const key = state.card.join('');
    assert(!seen.has(key), 'every player gets a unique card');
    seen.add(key);
  }
}

// --- draw schedule: time-derived, without replacement ----------------------
{
  const room = makeRoom(ITEMS, { drawIntervalSeconds: 4 });
  const players = [];
  const creator = join(room, players, 'Creator', true);
  join(room, players, 'Ana');
  const startedAt = startGame(room, players, creator, 50000);
  const viewAt = now => engine.roomView(room, players, creator.id, now);
  assert.equal(viewAt(startedAt).game.drawCount, 1, 'the first call lands the moment the game starts');
  assert.equal(viewAt(startedAt + 3999).game.drawCount, 1);
  assert.equal(viewAt(startedAt + 8500).game.drawCount, 3, 'one new call per interval');
  const drawn = viewAt(startedAt + 8500).game.drawnItems;
  assert.equal(new Set(drawn).size, drawn.length, 'draws never repeat');
  assert(drawn.every(item => ITEMS.includes(item)));
  assert.equal(viewAt(startedAt).game.currentItem, drawn[0]);
}

// --- marking: only called items, and a completed line wins -----------------
{
  const room = makeRoom(ITEMS, { drawIntervalSeconds: 4 });
  const players = [];
  const creator = join(room, players, 'Creator', true);
  const ana = join(room, players, 'Ana');
  const startedAt = startGame(room, players, creator, 100000);

  const card = bingo.bingoPlayerState(ana.state).card;
  // Nothing is markable except what has been called: at start+0 only draw #1 exists.
  const drawnNow = engine.roomView(room, players, ana.id, startedAt).game.drawnItems;
  const uncalledCell = card.findIndex((item, cell) => cell !== 12 && item && !drawnNow.includes(item));
  assert(engine.applyAction(room, players, ana.id, { type: 'mark', cell: uncalledCell }, startedAt).includes('called yet'), 'un-called squares refuse');
  assert(engine.applyAction(room, players, ana.id, { type: 'mark', cell: 12 }, startedAt).includes('free'), 'the free square refuses politely');
  const calledCell = card.findIndex((item, cell) => cell !== 12 && drawnNow.includes(item));
  if (calledCell >= 0) {
    assert.equal(engine.applyAction(room, players, ana.id, { type: 'mark', cell: calledCell }, startedAt), null);
    assert.equal(engine.applyAction(room, players, ana.id, { type: 'mark', cell: calledCell }, startedAt), null, 'double-tap is harmless');
    assert.equal(room.status, 'playing', 'one mark is not a win');
  }

  // Hand Ana a nearly-complete top row and make its last item the next call.
  const mine = bingo.bingoPlayerState(ana.state);
  const lastItem = mine.card[4];
  const lastIndex = room.config.items.indexOf(lastItem);
  const rest = room.state.drawOrder.filter(index => index !== lastIndex);
  room.state.drawOrder = [lastIndex, ...rest];
  room.state.startedAt = startedAt; // draw #1 is now the needed item
  ana.state = { card: mine.card, markedCells: [12, 0, 1, 2, 3] };
  assert.equal(engine.applyAction(room, players, ana.id, { type: 'mark', cell: 4 }, startedAt), null);
  assert.equal(room.status, 'finished', 'completing the line ends the game the moment it happens');
  const view = engine.roomView(room, players, ana.id, startedAt);
  assert.equal(view.standings[0].playerId, ana.id, 'the winner stands first');
  assert.equal(view.standings[0].winner, true);
  assert(view.standings[0].detail.includes('BINGO'));
  assert.equal(view.standings[1].winner, false);

  // Play Again: same game, fresh everything, anyone may press it.
  assert.equal(engine.applyAction(room, players, creator.id, { type: 'play-again' }, startedAt + 5000), null);
  assert.equal(room.status, 'countdown');
  assert.equal(room.round, 2);
  assert.equal(bingo.bingoPlayerState(ana.state).card.length, 0, 'cards are cleared until the new round starts');
  engine.tickRoom(room, players, startedAt + 5000 + engine.COUNTDOWN_MS, mulberry32(11));
  assert.equal(room.status, 'playing');
  assert.equal(bingo.bingoPlayerState(ana.state).card.length, 25, 'fresh cards are dealt for the new round');
  same(room.config.items, ITEMS, 'Play Again replays the same game');
}

// --- exhaustion: no line, most marks wins -----------------------------------
{
  const five = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
  const room = makeRoom(five, { drawIntervalSeconds: 4 }, 1234);
  const players = [];
  const creator = join(room, players, 'Creator', true);
  const ana = join(room, players, 'Ana');
  const startedAt = startGame(room, players, creator, 200000);

  // Ana marks two called squares during the last call's moment on
  // screen; the creator marks none.
  const anaCard = bingo.bingoPlayerState(ana.state).card;
  const allDrawnAt = startedAt + 4 * 4000 + 1000; // all 5 called, final interval still running
  const cells = [];
  anaCard.forEach((item, cell) => { if (cell !== 12 && item && cells.length < 2) cells.push(cell); });
  for (const cell of cells) {
    assert.equal(engine.applyAction(room, players, ana.id, { type: 'mark', cell }, allDrawnAt), null);
  }
  assert.equal(room.status, 'playing', 'marks alone do not finish early');
  engine.tickRoom(room, players, startedAt + 5 * 4000 + 1000); // the final interval has now passed
  assert.equal(room.status, 'finished', 'running out of calls ends the game');
  assert.equal(room.state.finishReason, 'exhausted');
  const view = engine.roomView(room, players, creator.id, allDrawnAt);
  assert.equal(view.standings[0].playerId, ana.id, 'most marks wins when the calls run out');
  assert.equal(view.standings[0].score, 2);
  assert.equal(view.game.drawCount, 5, 'every item was called exactly once');
}

// --- views: your card is yours alone ----------------------------------------
{
  const room = makeRoom();
  const players = [];
  const creator = join(room, players, 'Creator', true);
  const ana = join(room, players, 'Ana');
  startGame(room, players, creator, 300000);
  const anaView = engine.roomView(room, players, ana.id, 300000);
  assert.equal(anaView.me.state.card.length, 25, 'a player sees their own card');
  assert(anaView.players.every(player => !('state' in player)), 'the roster never leaks cards');
  const lobbyPeek = engine.roomView(room, players, null, 300000);
  assert.equal(lobbyPeek.me, null, 'a link-holder who has not joined sees no card');
  assert.equal(lobbyPeek.standings, null, 'no standings before the finish');
}

console.log('PASS: multiplayer engine + bingo — config from the snapshot pool, name-only joins with resume, creator-only start, countdown, unique covered cards, time-derived no-repeat draws, called-only marking, line win the moment it completes, exhaustion standings by marks, Play Again with the same game, and private cards in the view.');
