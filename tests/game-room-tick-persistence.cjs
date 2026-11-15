const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const quiz = load('lib/quiz-board.ts');
const survey = load('lib/survey-showdown.ts');
// Loaded modules run in the test loader's VM realm, so deepStrictEqual
// rejects their arrays on prototype grounds; compare structurally instead.
const same = (actual, expected, message) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The request-cycle harness. Production play traffic is a series of HTTP
// requests against rows in game_rooms / game_players: every request loads
// the room, ticks it, and — for a plain poll — saves it back ONLY when
// tickRoom says something changed (app/api/play/[token]/helpers.ts,
// loadPlayRoom). The action route additionally applies the player's action
// and then always saves. The older game tests tick one in-memory room,
// which hides any bug in that save-on-change contract — this harness
// mirrors the real contract: the "database" below is JSON text, every
// request starts from a fresh parse of it, and a poll that reports no
// change leaves the stored copy exactly as it was.
// ---------------------------------------------------------------------------

function makeDb(room, players) {
  return { room: JSON.stringify(room), players: JSON.stringify(players) };
}

function loadDb(db) {
  return { room: JSON.parse(db.room), players: JSON.parse(db.players) };
}

// One poll (GET /api/play/[token]): load, tick, persist only on change.
function poll(db, now) {
  const { room, players } = loadDb(db);
  const changed = engine.tickRoom(room, players, now, mulberry32(99));
  if (changed) {
    db.room = JSON.stringify(room);
    db.players = JSON.stringify(players);
  }
  return { changed, room, players };
}

// One action (POST /api/play/[token]/action): the loadPlayRoom tick first
// (persisted when it changed something), then the action, then the
// route's unconditional save on success.
function act(db, playerId, action, now) {
  const { room, players } = loadDb(db);
  if (engine.tickRoom(room, players, now, mulberry32(99))) {
    db.room = JSON.stringify(room);
    db.players = JSON.stringify(players);
  }
  const error = engine.applyAction(room, players, playerId, action, now, mulberry32(5));
  assert.equal(error, null, `action ${action.type} should succeed: ${error}`);
  db.room = JSON.stringify(room);
  db.players = JSON.stringify(players);
  return { room, players };
}

// What a later request would actually load: the stored copy, viewed
// without any ticking. This is the assertion target — a transition that
// only ever existed in one request's memory is, in production, lost.
function persistedView(db, viewerId, now) {
  const { room, players } = loadDb(db);
  return engine.roomView(room, players, viewerId, now);
}

// --- fixtures ---------------------------------------------------------------

function boardSnapshot() {
  return {
    name: 'Church Quiz Night',
    theme: 'cyan',
    gameTools: [
      {
        id: 'board-1', type: 'trivia-board', name: 'Quiz Board', enabled: true,
        config: {
          categories: [
            {
              name: 'Bible Basics',
              questions: [
                { value: 100, question: 'Who built the ark?', answer: 'Noah' },
                { value: 200, question: 'How many disciples did Jesus have?', answer: '12' },
                { question: 'What is the first book of the Bible?', answer: 'Genesis' },
              ],
            },
            {
              name: 'Food',
              questions: [
                { value: 100, prompt: 'What fruit is mashed into guacamole?', answer: 'Avocado' },
                { value: 200, question: 'How many cups are in a quart?', answer: '4' },
                { value: 300, question: 'What spice comes from orchid pods?', answer: 'Vanilla' },
              ],
            },
          ],
        },
      },
    ],
  };
}

function surveySnapshot() {
  return {
    name: 'Family Survey Night',
    theme: 'pink',
    gameTools: [
      {
        id: 'survey-1', type: 'trivia-board', name: 'Survey Board', enabled: true,
        config: {
          categories: [
            {
              name: 'Name something you do before bed',
              questions: [
                { answer: 'Brush teeth', value: 34 },
                { answer: 'Lock the door', value: 27 },
                { answer: 'Pray', value: 21 },
                { answer: 'Set an alarm', value: 18 },
              ],
            },
            {
              name: 'Name a fruit in a pie',
              questions: [
                { answer: 'Apple', value: 45 },
                { answer: 'Cherry', value: 30 },
                { answer: 'Pecan', value: 25 },
              ],
            },
            {
              name: 'Name something kids play outside',
              questions: [
                { answer: 'Tag', value: 40 },
                { answer: 'Hide and seek', value: 33 },
                { answer: 'Jump rope', value: 27 },
              ],
            },
          ],
        },
      },
    ],
  };
}

function makeRoom(snapshot, gameType) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, gameType);
  const base = engine.newRoomState(picked.gameType, picked.config);
  return {
    id: 'room-1', token: 'tok', projectId: 'proj-1', ownerId: 'owner-1',
    gameType: picked.gameType, title: picked.config.title,
    snapshot, config: picked.config, createdAt: 1000,
    ...base,
  };
}

function join(room, players, name, isCreator = false, now = 2000) {
  const result = engine.joinPlayer(room, players, { name, isCreator }, now, mulberry32(7));
  assert.equal(result.error, undefined, `join ${name}: ${result.error}`);
  return result.player;
}

// Lobby setup happens in memory (joins and the start are writes of their
// own in production); the fake database starts from the moment the game
// is playing, which is where the timed transitions live.
function startDb(snapshot, gameType, names) {
  const room = makeRoom(snapshot, gameType);
  const players = [];
  const joined = names.map((name, index) => join(room, players, name, index === 0));
  const now = 10000;
  assert.equal(engine.applyAction(room, players, joined[0].id, { type: 'start' }, now, mulberry32(99)), null);
  assert.equal(room.status, 'countdown');
  engine.tickRoom(room, players, now + engine.COUNTDOWN_MS, mulberry32(99));
  assert.equal(room.status, 'playing');
  return { db: makeDb(room, players), players: joined, start: now + engine.COUNTDOWN_MS };
}

// --- Quiz Board: the reveal must persist, the score must land once ---------
{
  const { db, players: [creator, maya, sam], start } = startDb(boardSnapshot(), 'quiz-board', ['Pastor Joy', 'Maya', 'Sam']);

  let v = persistedView(db, creator.id, start);
  assert.equal(v.game.phase, 'pick');
  assert.equal(v.game.turnPlayerId, creator.id, 'the first player in picks first');

  // Pick Bible Basics for 100 and answer inside the window: the creator
  // right (+100), Maya wrong (-100), Sam silent.
  act(db, creator.id, { type: 'pick', category: 0, question: 0 }, start + 1000);
  v = persistedView(db, creator.id, start + 1000);
  assert.equal(v.game.phase, 'answer');
  assert.equal(v.game.current.prompt, 'Who built the ark?');
  act(db, creator.id, { type: 'answer', text: 'Noah' }, start + 2000);
  act(db, maya.id, { type: 'answer', text: 'Moses' }, start + 3000);

  // A poll inside the answer window changes nothing and stores nothing.
  const quiet = poll(db, start + 4000);
  assert.equal(quiet.changed, false, 'a poll with nothing due reports no change');
  assert.equal(persistedView(db, creator.id, start + 4000).game.phase, 'answer');

  // The answer window (20s from the pick) lapses: this poll closes the
  // question. The close MUST be reported as a change and stored — before
  // the fix this poll returned false, the stored room stayed in "answer"
  // forever, and every later poll re-closed (and re-scored) the question
  // in memory while players stared at a frozen reveal.
  const closed = poll(db, start + 1000 + quiz.QUIZ_DEFAULT_ANSWER_MS + 1);
  assert.equal(closed.changed, true, 'the poll that closes the question reports the change');
  v = persistedView(db, creator.id, start + 21001);
  assert.equal(v.game.phase, 'reveal', 'the stored room reached the reveal');
  same(v.game.scores, { [creator.id]: 100, [maya.id]: -100, [sam.id]: 0 }, 'scores applied exactly once at the close');

  // Polls through the whole 6s reveal: no change, no re-scoring, ever.
  const closeNow = start + 1000 + quiz.QUIZ_DEFAULT_ANSWER_MS + 1;
  for (let i = 0; i < 25; i++) {
    const at = closeNow + 200 + i * 200; // stays inside the reveal window
    const step = poll(db, at);
    assert.equal(step.changed, false, `reveal poll ${i} reports no change`);
    const pv = persistedView(db, creator.id, at);
    assert.equal(pv.game.phase, 'reveal');
    same(pv.game.scores, { [creator.id]: 100, [maya.id]: -100, [sam.id]: 0 }, `reveal poll ${i} never re-applies the score`);
  }

  // Past the reveal: the turn passes on AND the stored copy shows it.
  const advanced = poll(db, closeNow + quiz.QUIZ_REVEAL_MS + 1);
  assert.equal(advanced.changed, true, 'the poll that ends the reveal reports the change');
  v = persistedView(db, creator.id, closeNow + quiz.QUIZ_REVEAL_MS + 1);
  assert.equal(v.game.phase, 'pick', 'the stored room is back to picking');
  assert.equal(v.game.turnPlayerId, maya.id, 'the pick passed to the next player');
  same(v.game.scores, { [creator.id]: 100, [maya.id]: -100, [sam.id]: 0 }, 'scores survive the reveal untouched');

  // And it stays that way: an idle board is a fixed point of the cycle.
  for (let i = 0; i < 25; i++) {
    const at = closeNow + quiz.QUIZ_REVEAL_MS + 2000 + i * 1000;
    const step = poll(db, at);
    assert.equal(step.changed, false, `idle poll ${i} reports no change`);
    const pv = persistedView(db, creator.id, at);
    assert.equal(pv.game.phase, 'pick');
    assert.equal(pv.game.turnPlayerId, maya.id);
    same(pv.game.scores, { [creator.id]: 100, [maya.id]: -100, [sam.id]: 0 });
  }
  assert(!JSON.stringify(v).includes('$'), 'no dollar sign anywhere in the player view');
  console.log('PASS: quiz persistence — the close and the reveal-end survive the request cycle; the score lands exactly once.');
}

// --- Survey Showdown: a face-off timeout must persist exactly once ---------
{
  const { db, players: [ann, ben, cleo, dan], start } = startDb(surveySnapshot(), 'survey-showdown', ['Ann', 'Ben', 'Cleo', 'Dan']);

  let v = persistedView(db, ann.id, start);
  assert.equal(v.game.stage, 'faceoff');
  same(v.game.faceoff.playerIds, [ann.id, ben.id], 'the first seats face off');
  assert.equal(v.game.questionIndex, 0);

  // Nobody answers the face-off. The poll that crosses the 15s window
  // resolves it — the next pair steps up — and that resolution MUST be
  // stored, not re-derived (and re-run) by every later poll.
  const resolved = poll(db, start + survey.SURVEY_FACEOFF_MS + 1);
  assert.equal(resolved.changed, true, 'the poll that resolves the face-off reports the change');
  v = persistedView(db, ann.id, start + survey.SURVEY_FACEOFF_MS + 1);
  assert.equal(v.game.stage, 'faceoff', 'a fresh face-off opens for the next pair');
  same(v.game.faceoff.playerIds, [cleo.id, dan.id], 'the next pair stepped up in the stored room');
  assert.equal(v.game.questionIndex, 0, 'the same question is still live');
  same(v.game.teams.map(t => t.score), [0, 0], 'a silent face-off banks no points');

  // Polls inside the new pair's window: the resolution must not run a
  // second time (a re-run would burn this pair too and skip the question).
  for (let i = 0; i < 10; i++) {
    const at = start + survey.SURVEY_FACEOFF_MS + 2000 + i * 1000; // < the new deadline
    const step = poll(db, at);
    assert.equal(step.changed, false, `face-off poll ${i} reports no change`);
    const pv = persistedView(db, ann.id, at);
    assert.equal(pv.game.stage, 'faceoff');
    same(pv.game.faceoff.playerIds, [cleo.id, dan.id], `face-off poll ${i} keeps the same pair`);
    assert.equal(pv.game.questionIndex, 0);
  }
  assert(!JSON.stringify(v).includes('$'), 'no dollar sign anywhere in the player view');
  console.log('PASS: survey persistence — a face-off timeout resolves once, is stored, and never re-runs on later polls.');
}

console.log('game-room tick persistence: all scenarios passed');
