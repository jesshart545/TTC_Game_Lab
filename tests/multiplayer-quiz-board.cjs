const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const quiz = load('lib/quiz-board.ts');
const bingo = load('lib/bingo.ts');
const { buildReadiness } = load('lib/build-readiness.ts');
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

// A trivia-board snapshot: 2 categories, 6 questions. One question uses
// the `prompt` field name, one carries no value (laddered by position).
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

// A trivia-list snapshot whose questions carry categories.
function listSnapshot() {
  const q = (question, answer, category) => ({ question, answer, category });
  return {
    name: 'List Quiz Night',
    theme: 'purple',
    gameTools: [
      {
        id: 'list-1', type: 'trivia-list', name: 'Questions', enabled: true,
        config: {
          questions: [
            q('What do bees make?', 'Honey', 'Animals'),
            q('What is a baby frog called?', 'Tadpole', 'Animals'),
            q('What bird cannot fly but swims?', 'Penguin', 'Animals'),
            q('What planet is called the Red Planet?', 'Mars', 'Space'),
            q('What star is closest to Earth?', 'The Sun', 'Space'),
            q('What force keeps us on the ground?', 'Gravity', 'Space'),
          ],
        },
      },
    ],
  };
}

function makeRoom(snapshot, seed = 42) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, 'quiz-board');
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

function startGame(room, players, creator, now) {
  assert.equal(engine.applyAction(room, players, creator.id, { type: 'start' }, now, mulberry32(99)), null);
  assert.equal(room.status, 'countdown');
  engine.tickRoom(room, players, now + engine.COUNTDOWN_MS, mulberry32(99));
  assert.equal(room.status, 'playing');
  return now + engine.COUNTDOWN_MS;
}

function view(room, players, player, now) {
  return engine.roomView(room, players, player.id, now);
}

function pick(room, players, player, category, question, now) {
  return engine.applyAction(room, players, player.id, { type: 'pick', category, question }, now, mulberry32(5));
}

function answer(room, players, player, text, now) {
  return engine.applyAction(room, players, player.id, { type: 'answer', text }, now, mulberry32(5));
}

function scores(room, players, now) {
  return view(room, players, players[0], now).game.scores;
}

// --- config extraction -----------------------------------------------------
{
  const picked = engine.pickGame(boardSnapshot());
  assert.equal(picked.gameType, 'quiz-board');
  assert.equal(picked.config.title, 'Church Quiz Night');
  same(picked.config.categories.map(c => c.name), ['Bible Basics', 'Food']);
  same(picked.config.categories[0].questions.map(q => q.value), [100, 200, 300], 'a missing value ladders by position');
  assert.equal(picked.config.categories[1].questions[0].prompt, 'What fruit is mashed into guacamole?', 'the prompt field name works too');
  assert.equal(picked.config.answerMs, quiz.QUIZ_DEFAULT_ANSWER_MS, 'default answer window');
  // Answers ARE in the server-side config — that is where they live.
  assert.equal(picked.config.categories[0].questions[0].answer, 'Noah');

  const fromList = engine.pickGame(listSnapshot());
  assert.equal(fromList.gameType, 'quiz-board', 'a categorized trivia list is a playable quiz');
  same(fromList.config.categories.map(c => c.name), ['Animals', 'Space']);
  same(fromList.config.categories[0].questions.map(q => q.value), [100, 200, 300], 'list questions ladder by position');

  // Not enough: too few questions, or everything in one category.
  const tooFew = {
    name: 'Tiny', theme: 'purple',
    gameTools: [{ id: 'b', type: 'trivia-board', config: { categories: [
      { name: 'A', questions: [{ value: 100, question: 'Q1', answer: 'A1' }, { value: 200, question: 'Q2', answer: 'A2' }] },
      { name: 'B', questions: [{ value: 100, question: 'Q3', answer: 'A3' }, { value: 200, question: 'Q4', answer: 'A4' }] },
    ] } }],
  };
  const refused = engine.pickGame(tooFew);
  assert(refused.error && refused.error.includes(String(quiz.QUIZ_MIN_QUESTIONS)), 'too few questions are refused with the plain reason');
  assert(!refused.error.includes('$'), 'the refusal carries no dollar sign');

  const flat = {
    name: 'Flat', theme: 'purple',
    gameTools: [{ id: 'l', type: 'trivia-list', config: { questions: Array.from({ length: 8 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })) } }],
  };
  assert(engine.pickGame(flat).error, 'one flat uncategorized list is not a quiz board');

  // Bingo keeps priority when a project holds both games — bingo rooms
  // behave exactly as before.
  const both = boardSnapshot();
  const items = Array.from({ length: 25 }, (_, i) => `Item ${i + 1}`);
  both.gameTools.push({ id: 'cards-1', type: 'card-list', config: { cards: items.map(text => ({ text })) } });
  assert.equal(engine.pickGame(both).gameType, 'bingo', 'bingo still wins when both games are present');
  console.log('PASS: quiz config extraction — board first, categorized lists second, bingo untouched.');
}

// --- a full game, start to standings ---------------------------------------
{
  const room = makeRoom(boardSnapshot());
  const players = [];
  const creator = join(room, players, 'Pastor Joy', true);
  const maya = join(room, players, 'Maya');
  const sam = join(room, players, 'Sam');
  let now = startGame(room, players, creator, 10000);

  let v = view(room, players, creator, now);
  assert.equal(v.game.phase, 'pick');
  assert.equal(v.game.turnPlayerId, creator.id, 'the first player in picks first');
  same(v.game.categories.map(c => c.squares.map(s => s.value)), [[100, 200, 300], [100, 200, 300]]);
  assert(!JSON.stringify(v).includes('$'), 'no dollar sign anywhere in the player view');

  // Only the turn player may pick.
  const refused = pick(room, players, maya, 0, 0, now);
  assert(refused && refused.includes('turn'), 'a pick out of turn is refused in plain words');

  // Q1: Bible Basics for 100 — "Who built the ark?"
  now += 1000;
  assert.equal(pick(room, players, creator, 0, 0, now), null);
  v = view(room, players, sam, now);
  assert.equal(v.game.phase, 'answer');
  assert.equal(v.game.current.prompt, 'Who built the ark?');
  assert.equal(v.game.current.value, 100);
  assert.equal(v.game.current.endsAt, now + quiz.QUIZ_DEFAULT_ANSWER_MS);
  assert(!JSON.stringify(v).includes('Noah'), 'the answer never reaches players before the reveal');
  assert.equal(answer(room, players, maya, 'noah', now + 100), null, 'answers match without case mattering');
  assert.equal(answer(room, players, maya, 'Jonah', now + 150), null, 'a second tap keeps the first answer');
  assert.equal(answer(room, players, creator, 'Moses', now + 200), null);
  // Sam never answers; the window closing scores what is in.
  engine.tickRoom(room, players, now + quiz.QUIZ_DEFAULT_ANSWER_MS, mulberry32(3));
  v = view(room, players, sam, now + quiz.QUIZ_DEFAULT_ANSWER_MS);
  assert.equal(v.game.phase, 'reveal');
  assert.equal(v.game.reveal.answer, 'Noah', 'the answer is public at the reveal');
  same(scores(room, players, now), { [creator.id]: -100, [maya.id]: 100, [sam.id]: 0 }, 'right gains the points, wrong loses them, silent loses nothing');
  assert.equal(v.game.categories[0].squares[0].used, true, 'the played square empties');

  // The pick passes to the next player.
  engine.tickRoom(room, players, now + quiz.QUIZ_DEFAULT_ANSWER_MS + quiz.QUIZ_REVEAL_MS, mulberry32(3));
  now += quiz.QUIZ_DEFAULT_ANSWER_MS + quiz.QUIZ_REVEAL_MS + 1000;
  v = view(room, players, maya, now);
  assert.equal(v.game.phase, 'pick');
  assert.equal(v.game.turnPlayerId, maya.id, 'the turn rotates');

  // Q2: Bible Basics for 200 — everyone answers, so the window closes early.
  assert.equal(pick(room, players, maya, 0, 1, now), null);
  assert.equal(answer(room, players, creator, '12', now + 100), null);
  assert.equal(answer(room, players, maya, '12', now + 100), null);
  assert.equal(answer(room, players, sam, '12', now + 100), null);
  engine.tickRoom(room, players, now + 1000, mulberry32(3));
  assert.equal(view(room, players, sam, now + 1000).game.phase, 'reveal', 'when everyone is in, the reveal comes early');
  same(scores(room, players, now), { [creator.id]: 100, [maya.id]: 300, [sam.id]: 200 });
  engine.tickRoom(room, players, now + 1000 + quiz.QUIZ_REVEAL_MS, mulberry32(3));
  now += 1000 + quiz.QUIZ_REVEAL_MS + 1000;

  // Q3: Food for 100 (Sam's pick) — nobody answers; the window just runs out.
  assert.equal(view(room, players, sam, now).game.turnPlayerId, sam.id);
  assert.equal(pick(room, players, sam, 1, 0, now), null);
  engine.tickRoom(room, players, now + quiz.QUIZ_DEFAULT_ANSWER_MS, mulberry32(3));
  same(scores(room, players, now), { [creator.id]: 100, [maya.id]: 300, [sam.id]: 200 }, 'no answers, no score change');
  engine.tickRoom(room, players, now + quiz.QUIZ_DEFAULT_ANSWER_MS + quiz.QUIZ_REVEAL_MS, mulberry32(3));
  now += quiz.QUIZ_DEFAULT_ANSWER_MS + quiz.QUIZ_REVEAL_MS + 1000;

  // Q4: Bible Basics for 300 (Creator's pick) — articles and case forgiven.
  assert.equal(pick(room, players, creator, 0, 2, now), null);
  assert.equal(answer(room, players, creator, 'Genesis', now + 100), null);
  assert.equal(answer(room, players, maya, 'The Genesis', now + 100), null);
  assert.equal(answer(room, players, sam, 'Exodus', now + 100), null);
  engine.tickRoom(room, players, now + 1000, mulberry32(3));
  same(scores(room, players, now), { [creator.id]: 400, [maya.id]: 600, [sam.id]: -100 });
  engine.tickRoom(room, players, now + 1000 + quiz.QUIZ_REVEAL_MS, mulberry32(3));
  now += 1000 + quiz.QUIZ_REVEAL_MS + 1000;

  // Q5: Food for 200 (Maya's pick) — everyone right.
  assert.equal(pick(room, players, maya, 1, 1, now), null);
  for (const player of players) assert.equal(answer(room, players, player, '4', now + 100), null);
  engine.tickRoom(room, players, now + 1000, mulberry32(3));
  same(scores(room, players, now), { [creator.id]: 600, [maya.id]: 800, [sam.id]: 100 });
  engine.tickRoom(room, players, now + 1000 + quiz.QUIZ_REVEAL_MS, mulberry32(3));
  now += 1000 + quiz.QUIZ_REVEAL_MS + 1000;

  // Q6: Food for 300 (Sam's pick) — the last square. Punctuation forgiven;
  // Sam sits it out.
  assert.equal(pick(room, players, sam, 1, 2, now), null);
  assert.equal(answer(room, players, creator, 'Vanilla', now + 100), null);
  assert.equal(answer(room, players, maya, 'vanilla.', now + 100), null);
  engine.tickRoom(room, players, now + quiz.QUIZ_DEFAULT_ANSWER_MS, mulberry32(3));
  engine.tickRoom(room, players, now + quiz.QUIZ_DEFAULT_ANSWER_MS + quiz.QUIZ_REVEAL_MS, mulberry32(3));
  now += quiz.QUIZ_DEFAULT_ANSWER_MS + quiz.QUIZ_REVEAL_MS + 1000;
  assert.equal(room.status, 'finished', 'an emptied board ends the game');
  v = view(room, players, maya, now);
  same(v.standings.map(s => [s.name, s.score, s.winner]), [['Maya', 1100, true], ['Pastor Joy', 900, false], ['Sam', 100, false]], 'final standings, winner first');
  assert.equal(v.standings[0].detail, '1100 points — quiz champion');
  assert(!JSON.stringify(v.standings).includes('$'), 'standings carry no dollar sign');

  // Play Again: same game, fresh board, scores reset.
  assert.equal(engine.applyAction(room, players, maya.id, { type: 'play-again' }, now, mulberry32(5)), null);
  assert.equal(room.status, 'countdown');
  engine.tickRoom(room, players, now + engine.COUNTDOWN_MS, mulberry32(5));
  assert.equal(room.status, 'playing');
  v = view(room, players, maya, now + engine.COUNTDOWN_MS);
  same(v.game.scores, { [creator.id]: 0, [maya.id]: 0, [sam.id]: 0 }, 'play again resets the scores');
  assert.equal(v.game.remaining, 6, 'play again restores every square');
  console.log('PASS: a full quiz — turns, answer windows, +/− scoring, standings, play again.');
}

// --- late joiner -------------------------------------------------------------
{
  const room = makeRoom(boardSnapshot());
  const players = [];
  const creator = join(room, players, 'Pastor Joy', true);
  const maya = join(room, players, 'Maya');
  let now = startGame(room, players, creator, 50000);
  assert.equal(pick(room, players, creator, 0, 0, now), null);
  const lou = join(room, players, 'Late Lou', false, now + 500);
  assert.equal(answer(room, players, lou, 'Noah', now + 600), null, 'a late joiner can answer the open question');
  assert.equal(answer(room, players, maya, 'Noah', now + 600), null);
  assert.equal(answer(room, players, creator, 'Noah', now + 600), null);
  engine.tickRoom(room, players, now + 1000, mulberry32(3));
  assert.equal(scores(room, players, now)[lou.id], 100, 'the late joiner scores like everyone else');
  console.log('PASS: joining mid-game deals you in with a fresh score.');
}

// --- publish readiness -------------------------------------------------------
{
  const unwired = [
    { id: 'wheel1', type: 'wheel', name: 'Game Wheel', enabled: true, inToolbox: true, config: {} },
    { id: 'cd1', type: 'countdown', name: 'Countdown', enabled: true, inToolbox: true, config: {} },
  ];
  const boardTool = boardSnapshot().gameTools[0];
  const quizReady = { kind: 'multiplayer', name: 'Quiz Night', theme: 'cyan', assets: [], controls: [], gameTools: [...unwired, boardTool] };
  assert.equal(buildReadiness(quizReady).length, 0, 'a multiplayer project with a playable quiz board publishes with no dashboard wiring');

  const listTool = listSnapshot().gameTools[0];
  const listReady = { kind: 'multiplayer', name: 'List Quiz Night', theme: 'purple', assets: [], controls: [], gameTools: [listTool] };
  assert.equal(buildReadiness(listReady).length, 0, 'a categorized trivia list is a playable game night too');

  const MESSAGE = 'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, a prompt card list and an answer card list for a matching game, a word list with at least 10 starter words for a word chain game, a draw list with at least 12 words to draw for a drawing game, or a property list with at least 12 properties to trade for a property trading game — ask Jewel to build one for you.';
  const flatTool = { id: 'flat-1', type: 'trivia-list', name: 'Flat', enabled: true, config: { questions: Array.from({ length: 8 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })) } };
  const blocked = { kind: 'multiplayer', name: 'Flat Night', theme: 'purple', assets: [], controls: [], gameTools: [flatTool] };
  const issues = buildReadiness(blocked);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, 'playable-game');
  assert.equal(issues[0].message, MESSAGE);
  assert(!issues[0].message.includes('$'), 'the blocked reason carries no dollar sign');

  // Readiness and the share route agree by construction for quiz projects.
  for (const project of [quizReady, listReady, blocked]) {
    const unplayable = 'error' in bingo.bingoConfigFromSnapshot(project) && 'error' in quiz.quizConfigFromSnapshot(project);
    assert.equal(unplayable, buildReadiness(project).some(i => i.id === 'playable-game'), 'readiness and the quiz extraction agree for every fixture');
  }
  console.log('PASS: publish readiness accepts a playable quiz, blocks an unplayable one in plain words.');
}

console.log('multiplayer-quiz-board: all assertions passed');
