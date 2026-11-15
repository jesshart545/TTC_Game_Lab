const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const survey = load('lib/survey-showdown.ts');
const bingo = load('lib/bingo.ts');
const quiz = load('lib/quiz-board.ts');
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

// A survey-shaped trivia board: each category is ONE survey question and
// its entries are the ranked answers — answer + points, no question text.
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

// A quiz-shaped board (the multiplayer-quiz-board fixture's shape).
function quizSnapshot() {
  const q = (value, question, answer) => ({ value, question, answer });
  return {
    name: 'Church Quiz Night',
    theme: 'cyan',
    gameTools: [
      {
        id: 'board-1', type: 'trivia-board', name: 'Quiz Board', enabled: true,
        config: {
          categories: [
            { name: 'Bible Basics', questions: [q(100, 'Who built the ark?', 'Noah'), q(200, 'How many disciples?', '12'), q(300, 'First book?', 'Genesis')] },
            { name: 'Food', questions: [q(100, 'Guacamole fruit?', 'Avocado'), q(200, 'Cups in a quart?', '4'), q(300, 'Orchid spice?', 'Vanilla')] },
          ],
        },
      },
    ],
  };
}

function makeRoom(snapshot, seed = 42) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, 'survey-showdown');
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

function guess(room, players, player, text, now) {
  return engine.applyAction(room, players, player.id, { type: 'guess', text }, now, mulberry32(5));
}

function tick(room, players, now) {
  engine.tickRoom(room, players, now, mulberry32(3));
}

// --- config extraction & precedence ----------------------------------------
{
  same(Object.keys(engine.GAME_MODULES), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match', 'word-chain', 'draw-guess', 'property-tycoon'], 'registry order: bingo, quiz, survey, perfect match, word chain');

  const picked = engine.pickGame(surveySnapshot());
  assert.equal(picked.gameType, 'survey-showdown');
  assert.equal(picked.config.title, 'Family Survey Night');
  assert.equal(picked.config.questions.length, 3);
  same(picked.config.questions[0].answers.map(a => a.text), ['Brush teeth', 'Lock the door', 'Pray', 'Set an alarm']);
  same(picked.config.questions[0].answers.map(a => a.points), [34, 27, 21, 18], 'ranked answers keep their points');
  assert.equal(picked.config.questions[0].answers.reduce((sum, a) => sum + a.points, 0), 100, 'a classic board adds up to about 100');
  // Answers ARE in the server-side config — that is where they live.
  assert.equal(picked.config.questions[2].answers[0].text, 'Tag');

  // A missing value falls back to points by rank; explicit values win.
  const sparse = surveySnapshot();
  sparse.gameTools[0].config.categories = [
    { name: 'Q one', questions: [{ answer: 'Alpha' }, { answer: 'Beta', value: 10 }, { answer: 'Gamma' }] },
    { name: 'Q two', questions: [{ answer: 'One', value: 50 }, { answer: 'Two', value: 30 }, { answer: 'Three', value: 20 }] },
    { name: 'Q three', questions: [{ answer: 'Red', value: 40 }, { answer: 'Blue', value: 35 }, { answer: 'Green', value: 25 }] },
  ];
  const sparsePicked = engine.pickGame(sparse);
  assert.equal(sparsePicked.gameType, 'survey-showdown');
  same(sparsePicked.config.questions[0].answers.map(a => a.points), [32, 10, 17], 'missing points fall back by rank');

  // Quiz Board keeps priority: a quiz-shaped board is a quiz, never a
  // survey — even with a survey board in the same project.
  assert.equal(engine.pickGame(quizSnapshot()).gameType, 'quiz-board', 'a quiz-shaped board still resolves as Quiz Board');
  const bothBoards = quizSnapshot();
  bothBoards.gameTools.push(surveySnapshot().gameTools[0]);
  assert.equal(engine.pickGame(bothBoards).gameType, 'quiz-board', 'quiz wins when a project holds both boards');
  const mixed = quizSnapshot();
  mixed.gameTools[0].config.categories.push(...surveySnapshot().gameTools[0].config.categories);
  assert.equal(engine.pickGame(mixed).gameType, 'quiz-board', 'one board holding both shapes plays as the quiz it can be');

  // Bingo keeps priority over a survey board too.
  const withBingo = surveySnapshot();
  const items = Array.from({ length: 25 }, (_, i) => `Item ${i + 1}`);
  withBingo.gameTools.push({ id: 'cards-1', type: 'card-list', config: { cards: items.map(text => ({ text })) } });
  assert.equal(engine.pickGame(withBingo).gameType, 'bingo', 'bingo still wins when both games are present');

  // Quiz-shaped entries are never survey answers.
  assert('error' in survey.surveyConfigFromSnapshot(quizSnapshot()), 'a quiz board alone holds no survey');

  // Too little survey: too few questions, or a question with too few answers.
  const twoQuestions = surveySnapshot();
  twoQuestions.gameTools[0].config.categories = twoQuestions.gameTools[0].config.categories.slice(0, 2);
  const refused = engine.pickGame(twoQuestions);
  assert(refused.error && refused.error.includes('Survey Showdown'), 'too few survey questions are refused with the plain reason');
  assert(!refused.error.includes('$'), 'the refusal carries no dollar sign');

  const thinAnswers = surveySnapshot();
  thinAnswers.gameTools[0].config.categories[0].questions = thinAnswers.gameTools[0].config.categories[0].questions.slice(0, 2);
  assert(engine.pickGame(thinAnswers).error, 'a question with only 2 answers does not count, leaving too few questions');
  console.log('PASS: survey config extraction — survey shape, rank points, quiz and bingo precedence untouched.');
}

// --- a full game, start to standings ---------------------------------------
{
  const room = makeRoom(surveySnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  const dan = join(room, players, 'Dan');
  let now = startGame(room, players, ann, 10000);

  // Teams are dealt by join order, alternating — the creator is simply
  // on the team her seat gives her.
  let v = view(room, players, ann, now);
  same(v.game.teams.map(t => [t.name, t.color, t.members.map(m => m.name)]), [
    ['Gold Team', '#f59e0b', ['Ann', 'Cleo']],
    ['Teal Team', '#2dd4bf', ['Ben', 'Dan']],
  ], 'teams dealt automatically in the lobby order');
  assert.equal(v.game.stage, 'faceoff');
  assert.equal(v.game.question, 'Name something you do before bed');
  same(v.game.faceoff.playerIds, [ann.id, ben.id], 'the first seats face off');
  assert(!JSON.stringify(v).includes('$'), 'no dollar sign anywhere in the player view');

  // Answer secrecy: before anyone plays, NO survey answer reaches any
  // player's view — only the question and the covered slots.
  for (const player of players) {
    const pv = JSON.stringify(view(room, players, player, now));
    for (const secret of ['Brush teeth', 'Lock the door', 'Pray', 'Set an alarm']) {
      assert(!pv.includes(secret), `unrevealed answer "${secret}" never reaches players`);
    }
  }
  assert(v.game.board.every(slot => slot.open === false && slot.text === undefined), 'every slot starts covered');

  // Only the two face-off players may answer the face-off.
  const refused = guess(room, players, cleo, 'Brush teeth', now + 600);
  assert(refused && refused.includes('face-off'), 'a face-off guess from the sidelines is refused in plain words');

  // Face-off: Ann names the #1 answer, Ben names #3. Both flip open
  // into the pot; the higher one (Ann's) wins control for Gold.
  assert.equal(guess(room, players, ann, 'brush teeth', now + 1000), null, 'matching forgives case');
  assert.equal(guess(room, players, ben, 'Pray', now + 1500), null);
  tick(room, players, now + 2000);
  now += 2000;
  v = view(room, players, dan, now);
  assert.equal(v.game.stage, 'play');
  assert.equal(v.game.controlTeam, 0, 'the higher face-off answer wins control');
  assert.equal(v.game.pot, 55, 'both face-off answers bank into the pot: 34 + 21');
  same(v.game.board.map(s => s.open), [true, false, true, false], 'the two matched answers flipped open');
  assert.equal(v.game.board[0].text, 'Brush teeth');
  assert.equal(v.game.board[0].points, 34);
  assert.equal(v.game.guesser.playerId, cleo.id, 'play passes to the next player on the controlling team');
  // Still secret: the two covered answers stay off every screen.
  for (const player of players) {
    const pv = JSON.stringify(view(room, players, player, now));
    assert(!pv.includes('Lock the door') && !pv.includes('Set an alarm'), 'covered answers stay secret mid-round');
  }

  // Play rotates within the team; only the named guesser may guess.
  const outOfTurn = guess(room, players, ben, 'Lock the door', now + 500);
  assert(outOfTurn && outOfTurn.includes("Cleo's guess"), 'a guess out of turn is refused in plain words');
  assert.equal(guess(room, players, cleo, 'Lock the door', now + 1000), null);
  v = view(room, players, ann, now + 1000);
  assert.equal(v.game.pot, 82, 'a match banks its points: 55 + 27');
  assert.equal(v.game.guesser.playerId, ann.id, 'the guess rotates to the next team member');

  assert.equal(guess(room, players, ann, 'Water the plants', now + 2000), null);
  assert.equal(view(room, players, ann, now + 2000).game.strikes, 1, 'a miss is a strike');
  assert.equal(guess(room, players, cleo, 'Read a book', now + 3000), null);
  assert.equal(view(room, players, ann, now + 3000).game.strikes, 2);
  assert.equal(guess(room, players, ann, 'Watch TV', now + 4000), null);
  v = view(room, players, ben, now + 4000);
  assert.equal(v.game.strikes, 3);
  assert.equal(v.game.stage, 'steal', 'three strikes hand the other team one steal guess');
  assert.equal(v.game.guesser.playerId, dan.id, 'the steal goes to the other team\'s next player in rotation');
  now += 4000;

  // The steal lands: the last answer flips, its points join the pot, and
  // the stealing team takes the whole thing.
  assert.equal(guess(room, players, dan, 'Set an alarm', now + 1000), null);
  v = view(room, players, ann, now + 1000);
  assert.equal(v.game.stage, 'reveal');
  same(v.game.teams.map(t => t.score), [0, 100], 'the steal takes the whole pot: 82 + 18');
  assert.equal(v.game.lastRound.winnerName, 'Teal Team');
  assert.equal(v.game.lastRound.potAwarded, 100);
  assert.equal(v.game.lastRound.stolen, true);
  assert(v.game.board.every(slot => slot.open), 'the whole board opens when the round ends');
  now += 1000;

  // Question 2 — a face-off where nobody matches: the next pair steps up.
  // (Rotation never resets: the cursors carry from question to question.)
  tick(room, players, now + survey.SURVEY_REVEAL_MS);
  now += survey.SURVEY_REVEAL_MS;
  v = view(room, players, ann, now);
  assert.equal(v.game.stage, 'faceoff');
  assert.equal(v.game.questionIndex, 1);
  assert.equal(v.game.question, 'Name a fruit in a pie');
  assert.equal(v.game.pot, 0, 'a new question starts with an empty pot');
  same(v.game.faceoff.playerIds, [cleo.id, ben.id], 'rotation carries across questions');
  assert.equal(guess(room, players, cleo, 'Banana', now + 1000), null);
  assert.equal(guess(room, players, ben, 'Peach', now + 1500), null);
  tick(room, players, now + 2000);
  v = view(room, players, ann, now + 2000);
  assert.equal(v.game.stage, 'faceoff', 'no match — the face-off repeats');
  same(v.game.faceoff.playerIds, [ann.id, dan.id], 'the next pair in rotation steps up');
  assert.equal(guess(room, players, ann, 'apple', now + 3000), null);
  assert.equal(guess(room, players, dan, 'Cherry', now + 3500), null);
  tick(room, players, now + 4000);
  now += 4000;
  v = view(room, players, ann, now);
  assert.equal(v.game.stage, 'play');
  assert.equal(v.game.controlTeam, 0);
  assert.equal(v.game.pot, 75, 'Apple 45 + Cherry 30 bank into the pot');
  assert.equal(v.game.guesser.playerId, cleo.id);

  // Clearing the board takes the pot without any strikes.
  assert.equal(guess(room, players, cleo, 'Pecan', now + 1000), null);
  v = view(room, players, ann, now + 1000);
  assert.equal(v.game.stage, 'reveal');
  same(v.game.teams.map(t => t.score), [100, 100], 'clearing the board banks the pot: 75 + 25');
  assert.equal(v.game.lastRound.stolen, false);
  now += 1000;

  // Question 3 — only one face-off answer matches, so that team controls.
  tick(room, players, now + survey.SURVEY_REVEAL_MS);
  now += survey.SURVEY_REVEAL_MS;
  v = view(room, players, ann, now);
  assert.equal(v.game.questionIndex, 2);
  same(v.game.faceoff.playerIds, [ann.id, ben.id], 'rotation carries across questions');
  assert.equal(guess(room, players, ann, 'Soccer', now + 1000), null);
  assert.equal(guess(room, players, ben, 'Tag', now + 1500), null);
  tick(room, players, now + 2000);
  now += 2000;
  v = view(room, players, ann, now);
  assert.equal(v.game.controlTeam, 1, 'the only match takes control');
  assert.equal(v.game.pot, 40);
  assert.equal(v.game.guesser.playerId, dan.id);

  // Teal plays and misses three times; a late joiner is dealt into the
  // smaller team mid-game; Gold's steal guess misses, so Teal keeps the pot.
  assert.equal(guess(room, players, dan, 'Basketball', now + 1000), null);
  assert.equal(guess(room, players, ben, 'Swimming', now + 2000), null);
  const eve = join(room, players, 'Eve', false, now + 2500);
  v = view(room, players, eve, now + 2500);
  same(v.game.teams[0].members.map(m => m.name), ['Ann', 'Cleo', 'Eve'], 'a late joiner is dealt into the smaller team');
  assert.equal(guess(room, players, dan, 'Video games', now + 3000), null);
  v = view(room, players, ann, now + 3000);
  assert.equal(v.game.stage, 'steal');
  assert.equal(v.game.guesser.playerId, cleo.id, 'the steal goes to the controlling team\'s next player in rotation');
  assert.equal(guess(room, players, cleo, 'Hopscotch', now + 4000), null);
  v = view(room, players, ann, now + 4000);
  assert.equal(v.game.stage, 'reveal');
  same(v.game.teams.map(t => t.score), [100, 140], 'a missed steal gives the pot to the controlling team');
  assert.equal(v.game.lastRound.winnerName, 'Teal Team');
  assert.equal(v.game.lastRound.potAwarded, 40);
  assert.equal(v.game.lastRound.stolen, false);
  now += 4000;

  // The last reveal ends the game: team standings, winners first.
  tick(room, players, now + survey.SURVEY_REVEAL_MS);
  now += survey.SURVEY_REVEAL_MS;
  assert.equal(room.status, 'finished', 'the last question ends the game');
  v = view(room, players, ann, now);
  same(v.standings.map(s => [s.name, s.score, s.winner]), [
    ['Ben', 140, true], ['Dan', 140, true],
    ['Ann', 100, false], ['Cleo', 100, false], ['Eve', 100, false],
  ], 'final standings are team standings, winning team first');
  assert.equal(v.standings[0].detail, 'Teal Team · 140 points — champions!');
  assert(!JSON.stringify(v.standings).includes('$'), 'standings carry no dollar sign');

  // Play Again: same teams, fresh board, scores reset.
  assert.equal(engine.applyAction(room, players, ben.id, { type: 'play-again' }, now, mulberry32(5)), null);
  assert.equal(room.status, 'countdown');
  tick(room, players, now + engine.COUNTDOWN_MS);
  assert.equal(room.status, 'playing');
  v = view(room, players, ann, now + engine.COUNTDOWN_MS);
  same(v.game.teams.map(t => [t.score, t.members.map(m => m.name)]), [
    [0, ['Ann', 'Cleo', 'Eve']],
    [0, ['Ben', 'Dan']],
  ], 'play again keeps the teams and resets the scores');
  assert.equal(v.game.questionIndex, 0);
  assert.equal(v.game.stage, 'faceoff');
  console.log('PASS: a full survey game — teams, face-offs, rotation, strikes, a steal won and a steal missed, standings, play again.');
}

// --- windows running out: face-off repeats, a quiet guess is a strike,
// --- and a quiet steal hands the pot to the controlling team ---------------
{
  const room = makeRoom(surveySnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  const dan = join(room, players, 'Dan');
  const started = startGame(room, players, ann, 10000);

  // Nobody answers the face-off: the window runs out and the next pair steps up.
  tick(room, players, started + survey.SURVEY_FACEOFF_MS);
  let v = view(room, players, ann, started + survey.SURVEY_FACEOFF_MS);
  assert.equal(v.game.stage, 'faceoff');
  same(v.game.faceoff.playerIds, [cleo.id, dan.id], 'a silent face-off rotates to the next pair');

  // Cleo alone answers before this window ends: her match takes control.
  const secondEnds = started + survey.SURVEY_FACEOFF_MS * 2;
  assert.equal(guess(room, players, cleo, 'Brush teeth', started + survey.SURVEY_FACEOFF_MS + 1000), null);
  tick(room, players, secondEnds);
  v = view(room, players, ann, secondEnds);
  assert.equal(v.game.stage, 'play');
  assert.equal(v.game.controlTeam, 0);
  assert.equal(v.game.pot, 34);
  assert.equal(v.game.guesser.playerId, ann.id);

  // Ann never guesses: the window running out is a strike, and play rotates.
  const guessEnds = secondEnds + survey.SURVEY_GUESS_MS;
  tick(room, players, guessEnds);
  v = view(room, players, ann, guessEnds);
  assert.equal(v.game.strikes, 1, 'a timed-out guess counts as a strike');
  assert.equal(v.game.guesser.playerId, cleo.id);

  assert.equal(guess(room, players, cleo, 'Lock the door', guessEnds + 1000), null);
  assert.equal(view(room, players, ann, guessEnds + 1000).game.pot, 61);
  assert.equal(guess(room, players, ann, 'Nope one', guessEnds + 2000), null);
  assert.equal(guess(room, players, cleo, 'Nope two', guessEnds + 3000), null);
  v = view(room, players, ben, guessEnds + 3000);
  assert.equal(v.game.stage, 'steal');
  assert.equal(v.game.guesser.playerId, ben.id, 'the steal rotates to the other team\'s next player');

  // Ben never guesses either: the pot stays with the controlling team.
  tick(room, players, guessEnds + 3000 + survey.SURVEY_GUESS_MS);
  v = view(room, players, ann, guessEnds + 3000 + survey.SURVEY_GUESS_MS);
  assert.equal(v.game.stage, 'reveal');
  same(v.game.teams.map(t => t.score), [61, 0], 'a timed-out steal gives the pot to the controlling team');
  assert.equal(v.game.lastRound.stolen, false);
  console.log('PASS: timed-out windows — face-off rotates, a quiet guess strikes, a quiet steal keeps the pot put.');
}

// --- publish readiness -------------------------------------------------------
{
  const unwired = [
    { id: 'wheel1', type: 'wheel', name: 'Game Wheel', enabled: true, inToolbox: true, config: {} },
    { id: 'cd1', type: 'countdown', name: 'Countdown', enabled: true, inToolbox: true, config: {} },
  ];
  const surveyTool = surveySnapshot().gameTools[0];
  const surveyReady = { kind: 'multiplayer', name: 'Survey Night', theme: 'pink', assets: [], controls: [], gameTools: [...unwired, surveyTool] };
  assert.equal(buildReadiness(surveyReady).length, 0, 'a multiplayer project with a playable survey board publishes with no dashboard wiring');

  const MESSAGE = 'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, a prompt card list and an answer card list for a matching game, a word list with at least 10 starter words for a word chain game, a draw list with at least 12 words to draw for a drawing game, or a property list with at least 12 properties to trade for a property trading game — ask Jewel to build one for you.';
  const thinTool = surveySnapshot().gameTools[0];
  thinTool.config = { categories: thinTool.config.categories.slice(0, 2) };
  const blocked = { kind: 'multiplayer', name: 'Thin Night', theme: 'pink', assets: [], controls: [], gameTools: [thinTool] };
  const issues = buildReadiness(blocked);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, 'playable-game');
  assert.equal(issues[0].message, MESSAGE);
  assert(!issues[0].message.includes('$'), 'the blocked reason carries no dollar sign');

  // Readiness and the share route agree by construction for survey projects.
  for (const project of [surveyReady, blocked]) {
    const unplayable = 'error' in bingo.bingoConfigFromSnapshot(project) && 'error' in quiz.quizConfigFromSnapshot(project) && 'error' in survey.surveyConfigFromSnapshot(project);
    assert.equal(unplayable, buildReadiness(project).some(i => i.id === 'playable-game'), 'readiness and the survey extraction agree for every fixture');
  }
  console.log('PASS: publish readiness accepts a playable survey, blocks an unplayable one in plain words.');
}

console.log('multiplayer-survey-showdown: all assertions passed');
