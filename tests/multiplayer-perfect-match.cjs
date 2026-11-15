const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const perfect = load('lib/perfect-match.ts');
const bingo = load('lib/bingo.ts');
const quiz = load('lib/quiz-board.ts');
const survey = load('lib/survey-showdown.ts');
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

const PROMPTS = [
  'Spooky', 'Worth a million followers', 'Smells amazing', 'Best birthday surprise',
  'Loud', 'Impossible to ignore', 'Cozy', 'Lightning fast', "From grandma's kitchen",
  'Pure chaos', 'Tiny but mighty', 'Better at midnight',
];
const ANSWERS = [
  'A haunted house', "Grandma's chili", 'A marching band', 'Bubble wrap', 'A thunderstorm',
  'Fresh-baked bread', 'A karaoke machine', 'Hot sauce', 'A sleepy cat', 'Roller skates',
  'A treasure map', 'Glitter', 'A fog machine', 'Pickles', 'A disco ball',
  'Thunder', 'A warm blanket', 'Espresso', 'A trumpet', 'Confetti',
  'A lighthouse', 'Popcorn', 'A robot vacuum', 'Fireworks', 'A hammock',
  'Chili peppers', 'A drum kit', 'Moonlight', 'A waffle iron', 'Sparklers',
  'A wool sweater', 'A siren', 'Honey', 'A trampoline', 'Stage lights',
  'A campfire', 'A megaphone', 'Velvet curtains', 'A snow globe', 'A bass guitar',
];
const cardList = (id, name, texts) => ({
  id, type: 'card-list', name, enabled: true,
  config: { cards: texts.map((text, i) => ({ id: `${id}-c${i + 1}`, text })) },
});

function matchSnapshot() {
  return {
    name: 'Match Night',
    theme: 'cyan',
    gameTools: [
      cardList('prompts-1', 'Prompt Cards', PROMPTS),
      cardList('answers-1', 'Answer Cards', ANSWERS),
    ],
  };
}

function makeRoom(snapshot, seed = 42) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, 'perfect-match');
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

function tick(room, players, now) {
  engine.tickRoom(room, players, now, mulberry32(3));
}

/** Submit the first card of a player's hand; returns the card's text. */
function submitFirst(room, players, player, now) {
  const card = view(room, players, player, now).me.state.hand[0];
  assert(card, `${player.name} should hold a card to play`);
  assert.equal(engine.applyAction(room, players, player.id, { type: 'submit', card }, now, mulberry32(5)), null);
  return card;
}

// --- config extraction, deck identification & precedence --------------------
{
  same(Object.keys(engine.GAME_MODULES), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match'], 'registry order: bingo, quiz, survey, perfect match');

  const picked = engine.pickGame(matchSnapshot());
  assert.equal(picked.gameType, 'perfect-match', 'a snapshot holding both decks is a matching game, not bingo');
  assert.equal(picked.config.title, 'Match Night');
  same(picked.config.prompts, PROMPTS);
  same(picked.config.answers, ANSWERS);

  // Deck identification is the name signal Jewel is taught to use.
  assert.equal(perfect.cardListDeckKind('Prompt Cards'), 'prompt');
  assert.equal(perfect.cardListDeckKind('PARTY PROMPTS'), 'prompt', 'the signal forgives case');
  assert.equal(perfect.cardListDeckKind('the ANSWER deck'), 'answer');
  assert.equal(perfect.cardListDeckKind('Prompts & Answers'), 'prompt', 'a name with both words is the prompt deck');
  assert.equal(perfect.cardListDeckKind('Call Items'), null);
  assert.equal(perfect.cardListDeckKind(undefined), null);

  // The largest list of each kind plays when several signal the same deck.
  const morePrompts = [...PROMPTS, 'Extra one', 'Extra two', 'Extra three'];
  const twoPromptLists = matchSnapshot();
  twoPromptLists.gameTools.push(cardList('prompts-2', 'More Prompts', morePrompts));
  assert.equal(engine.pickGame(twoPromptLists).config.prompts.length, 15, 'the largest prompt list is the deck');

  // config.items pools read exactly the way bingo reads them.
  const itemsShape = {
    name: 'Items Night', theme: 'purple',
    gameTools: [
      { id: 'p', type: 'card-list', name: 'Prompt Pile', config: { items: PROMPTS } },
      { id: 'a', type: 'card-list', name: 'Answer Pile', config: { items: ANSWERS } },
    ],
  };
  assert.equal(engine.pickGame(itemsShape).gameType, 'perfect-match', 'config.items decks count, exactly as the bingo extraction reads them');

  // Too little of either deck is refused with the plain four-game reason.
  const thinPrompts = matchSnapshot();
  thinPrompts.gameTools[0] = cardList('prompts-1', 'Prompt Cards', PROMPTS.slice(0, 9));
  const refused = engine.pickGame(thinPrompts);
  assert(refused.error && refused.error.includes('Perfect Match'), 'too few prompts are refused with the plain reason');
  assert(refused.error.includes('Survey Showdown') && refused.error.includes('Quiz Board') && refused.error.includes('Bingo'), 'the refusal speaks for all four games');
  assert(!refused.error.includes('$'), 'the refusal carries no dollar sign');
  const thinAnswers = matchSnapshot();
  thinAnswers.gameTools[1] = cardList('answers-1', 'Answer Cards', ANSWERS.slice(0, 29));
  assert(engine.pickGame(thinAnswers).error, 'too few answers are refused');
  // Duplicates do not pad a deck: 34 entries but only 29 different answers.
  const dupeAnswers = matchSnapshot();
  dupeAnswers.gameTools[1] = cardList('answers-1', 'Answer Cards', [...ANSWERS.slice(0, 29), 'thunder', 'THUNDER', 'Glitter', 'glitter', 'Popcorn']);
  assert(engine.pickGame(dupeAnswers).error, 'a deck that dedupes below 30 answers is not playable');

  // Precedence: a single card list — even a deck-named one — is Bingo
  // exactly as today, because bingo needs only one list and comes first.
  const oneGeneric = { name: 'Bingo Night', theme: 'purple', gameTools: [cardList('only', 'Call Items', ANSWERS.slice(0, 25))] };
  assert.equal(engine.pickGame(oneGeneric).gameType, 'bingo', 'one generic card list is bingo');
  const onePrompt = { name: 'Prompts Only', theme: 'purple', gameTools: [cardList('only', 'Prompt Cards', PROMPTS)] };
  assert.equal(engine.pickGame(onePrompt).gameType, 'bingo', 'a lone prompt list still plays bingo, exactly as today');
  const oneAnswer = { name: 'Answers Only', theme: 'purple', gameTools: [cardList('only', 'Answer Cards', ANSWERS)] };
  assert.equal(engine.pickGame(oneAnswer).gameType, 'bingo', 'a lone answer list still plays bingo, exactly as today');

  // Both decks plus an ordinary list: bingo plays from the ordinary list
  // and leaves the decks out of its call pool entirely.
  const withGeneric = matchSnapshot();
  const genericItems = Array.from({ length: 25 }, (_, i) => `Call item ${i + 1}`);
  withGeneric.gameTools.push(cardList('calls', 'Call Items', genericItems));
  const bingoPicked = engine.pickGame(withGeneric);
  assert.equal(bingoPicked.gameType, 'bingo', 'bingo still wins when an ordinary list is present');
  same(bingoPicked.config.items, genericItems, 'the deck lists never leak into the bingo call pool');

  // Quiz Board and Survey Showdown keep their priority over the decks.
  const q = (value, question, answer) => ({ value, question, answer });
  const withQuiz = matchSnapshot();
  withQuiz.gameTools.push({
    id: 'board-1', type: 'trivia-board', name: 'Quiz Board', enabled: true,
    config: { categories: [
      { name: 'Bible Basics', questions: [q(100, 'Who built the ark?', 'Noah'), q(200, 'How many disciples?', '12'), q(300, 'First book?', 'Genesis')] },
      { name: 'Food', questions: [q(100, 'Guacamole fruit?', 'Avocado'), q(200, 'Cups in a quart?', '4'), q(300, 'Orchid spice?', 'Vanilla')] },
    ] },
  });
  assert.equal(engine.pickGame(withQuiz).gameType, 'quiz-board', 'a playable quiz still wins over the decks');
  const withSurvey = matchSnapshot();
  withSurvey.gameTools.push({
    id: 'survey-1', type: 'trivia-board', name: 'Survey Board', enabled: true,
    config: { categories: [
      { name: 'Name something you do before bed', questions: [{ answer: 'Brush teeth', value: 34 }, { answer: 'Lock the door', value: 27 }, { answer: 'Pray', value: 21 }] },
      { name: 'Name a fruit in a pie', questions: [{ answer: 'Apple', value: 45 }, { answer: 'Cherry', value: 30 }, { answer: 'Pecan', value: 25 }] },
      { name: 'Name something kids play outside', questions: [{ answer: 'Tag', value: 40 }, { answer: 'Hide and seek', value: 33 }, { answer: 'Jump rope', value: 27 }] },
    ] },
  });
  assert.equal(engine.pickGame(withSurvey).gameType, 'survey-showdown', 'a playable survey still wins over the decks');
  console.log('PASS: perfect match config extraction — deck names, minimums, dedupe, and bingo/quiz/survey precedence.');
}

// --- a full game, start to standings -----------------------------------------
{
  const room = makeRoom(matchSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  const dan = join(room, players, 'Dan');
  let now = startGame(room, players, ann, 10000);

  // The creator judges first — a player like everyone else.
  let v = view(room, players, ann, now);
  assert.equal(v.game.matchStage, 'submit');
  assert.equal(v.game.judgeId, ann.id, 'the first seat judges the first round');
  assert.equal(v.game.judgeName, 'Ann');
  assert.equal(v.game.promptNumber, 1);
  assert.equal(v.game.promptCount, PROMPTS.length);
  assert(PROMPTS.includes(v.game.prompt), 'the prompt comes from the prompt deck');
  assert(!JSON.stringify(v).includes('$'), 'no dollar sign anywhere in the player view');

  // Hands: 7 each from a 40-card deck, all different cards.
  const hands = players.map(player => view(room, players, player, now).me.state.hand);
  for (const hand of hands) assert.equal(hand.length, 7, 'each player is dealt 7 cards');
  const dealt = hands.flat();
  assert.equal(new Set(dealt).size, dealt.length, 'no card is in two hands');
  same(v.game.handCounts, Object.fromEntries(players.map(p => [p.id, 7])), 'everyone sees hand counts');

  // Hand secrecy: no other player's card text appears anywhere in my view.
  for (const [index, player] of players.entries()) {
    const mine = JSON.stringify(view(room, players, player, now));
    for (const [otherIndex, other] of players.entries()) {
      if (otherIndex === index) continue;
      for (const card of hands[otherIndex]) {
        assert(!mine.includes(card), `${player.name}'s view never shows ${other.name}'s card "${card}"`);
      }
    }
  }

  // The judge plays no card; a card that isn't yours can't be played.
  const judgeSubmit = engine.applyAction(room, players, ann.id, { type: 'submit', card: hands[0][0] }, now, mulberry32(5));
  assert(judgeSubmit && judgeSubmit.includes('judge'), 'the judge submitting is refused in plain words');
  const foreign = engine.applyAction(room, players, ben.id, { type: 'submit', card: hands[2][0] }, now, mulberry32(5));
  assert(foreign && foreign.includes("isn't in your hand"), 'playing someone else\u2019s card is refused');

  // Round 1: Ben and Cleo play; Dan is still thinking.
  const benCard = submitFirst(room, players, ben, now + 100);
  const cleoCard = submitFirst(room, players, cleo, now + 200);
  tick(room, players, now + 300);
  v = view(room, players, ann, now + 300);
  assert.equal(v.game.matchStage, 'submit', 'the round waits for the last card');
  same(v.game.submittedIds, [ben.id, cleo.id]);
  assert.equal(v.game.waitingOn, 1);
  assert.equal(view(room, players, ben, now + 300).me.state.hand.length, 6, 'a played card leaves the hand');
  assert.equal(view(room, players, ben, now + 300).me.state.submittedCard, benCard, 'the player can see their own played card');

  // Dan plays: the window closes early and the cards come up shuffled,
  // with NO owner attached anywhere a player can see.
  const danCard = submitFirst(room, players, dan, now + 400);
  tick(room, players, now + 500);
  now += 500;
  for (const player of players) {
    const pv = view(room, players, player, now);
    assert.equal(pv.game.matchStage, 'judge');
    assert.equal(pv.game.revealedCards.length, 3);
    for (const entry of pv.game.revealedCards) {
      same(Object.keys(entry), ['text'], 'a revealed card carries its text and nothing else — no owner');
    }
    same(pv.game.revealedCards.map(c => c.text).sort(), [benCard, cleoCard, danCard].sort(), 'the played cards are all on the table');
    const gameJson = JSON.stringify(pv.game.revealedCards);
    for (const p of players) assert(!gameJson.includes(p.id), 'no player id rides along with a revealed card');
  }

  // Only the judge picks.
  const notJudge = engine.applyAction(room, players, cleo.id, { type: 'pick', index: 0 }, now, mulberry32(5));
  assert(notJudge && notJudge.includes('judge'), 'a pick from anyone but the judge is refused in plain words');
  const benIndex = view(room, players, ann, now).game.revealedCards.findIndex(c => c.text === benCard);
  assert(benIndex >= 0);
  assert.equal(engine.applyAction(room, players, ann.id, { type: 'pick', index: benIndex }, now + 100), null);
  v = view(room, players, dan, now + 100);
  assert.equal(v.game.matchStage, 'reveal');
  assert.equal(v.game.lastRound.winnerName, 'Ben', 'the winner is named only after the pick');
  assert.equal(v.game.lastRound.winningCard, benCard);
  assert.equal(v.game.scores[ben.id], 1, 'the winning card\u2019s owner scores 1 point');
  assert.equal(v.game.scores[ann.id], 0);
  const winnerEntry = v.game.revealedCards.find(c => c.text === benCard);
  assert.equal(winnerEntry.winner, true);
  assert.equal(winnerEntry.ownerName, 'Ben', 'owners are named in the reveal, after the pick');
  now += 100;

  // The reveal moment ends: hands refill, the judge rotates to Ben.
  tick(room, players, now + perfect.PERFECT_MATCH_REVEAL_MS);
  now += perfect.PERFECT_MATCH_REVEAL_MS;
  v = view(room, players, ann, now);
  assert.equal(v.game.matchStage, 'submit');
  assert.equal(v.game.promptNumber, 2);
  assert.equal(v.game.judgeId, ben.id, 'the judge role rotates to the next player');
  assert.equal(view(room, players, ben, now).me.state.hand.length, 7, 'hands refill to 7');
  assert.equal(view(room, players, ben, now).me.state.submittedCard, '', 'last round\u2019s played card is cleared');

  // Play rounds to a finish: Dan wins every round he doesn't judge;
  // Ann takes the round Dan judges. Judges rotate Ann, Ben, Cleo, Dan…
  const expectedJudges = [ben.id, cleo.id, dan.id, ann.id, ben.id, cleo.id];
  const roundWinners = [dan, dan, ann, dan, dan, dan];
  for (let round = 0; round < roundWinners.length; round++) {
    const winner = roundWinners[round];
    const judgeId = view(room, players, ann, now).game.judgeId;
    assert.equal(judgeId, expectedJudges[round], `round ${round + 2} judge rotation`);
    assert.notEqual(winner.id, judgeId, 'the scripted winner never judges their own round');
    const played = new Map();
    for (const player of players) {
      if (player.id === judgeId) continue;
      played.set(player.id, submitFirst(room, players, player, now + 100));
    }
    tick(room, players, now + 200);
    const judge = players.find(p => p.id === judgeId);
    const jv = view(room, players, judge, now + 200);
    assert.equal(jv.game.matchStage, 'judge');
    for (const entry of jv.game.revealedCards) same(Object.keys(entry), ['text'], 'anonymity holds every round');
    const pickIndex = jv.game.revealedCards.findIndex(c => c.text === played.get(winner.id));
    assert(pickIndex >= 0, 'the winner\u2019s card is on the table');
    assert.equal(engine.applyAction(room, players, judge.id, { type: 'pick', index: pickIndex }, now + 300, mulberry32(5)), null);
    tick(room, players, now + 300 + perfect.PERFECT_MATCH_REVEAL_MS);
    now += 300 + perfect.PERFECT_MATCH_REVEAL_MS;
  }

  // Dan reached 5: the game is over, standings name every player's count.
  assert.equal(room.status, 'finished', 'reaching 5 points ends the game');
  v = view(room, players, ann, now);
  same(v.standings.map(s => [s.name, s.score, s.winner]), [
    ['Dan', 5, true], ['Ann', 1, false], ['Ben', 1, false], ['Cleo', 0, false],
  ], 'final standings: winner first, every player\u2019s points shown');
  assert.equal(v.standings[0].detail, '5 winning cards — Perfect Match champion');
  assert(!JSON.stringify(v.standings).includes('$'), 'standings carry no dollar sign');

  // Play Again: full reshuffle, fresh hands, scores reset, prompts restart.
  assert.equal(engine.applyAction(room, players, cleo.id, { type: 'play-again' }, now, mulberry32(5)), null);
  assert.equal(room.status, 'countdown');
  tick(room, players, now + engine.COUNTDOWN_MS);
  assert.equal(room.status, 'playing');
  v = view(room, players, ann, now + engine.COUNTDOWN_MS);
  assert.equal(v.round, 2);
  assert.equal(v.game.matchStage, 'submit');
  assert.equal(v.game.promptNumber, 1, 'the prompts restart');
  assert.equal(v.game.judgeId, ann.id, 'the rotation restarts with the first seat');
  same(v.game.scores, Object.fromEntries(players.map(p => [p.id, 0])), 'scores reset');
  for (const player of players) assert.equal(view(room, players, player, now + engine.COUNTDOWN_MS).me.state.hand.length, 7, 'fresh hands are dealt');
  console.log('PASS: a full perfect match game — deal, judge rotation, anonymous reveal, scoring, refill, win at 5, standings, play again.');
}

// --- windows running out: a quiet table, and a single card played ------------
{
  const room = makeRoom(matchSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  const started = startGame(room, players, ann, 10000);
  const submitMs = room.config.submitMs;
  assert.equal(submitMs, perfect.PERFECT_MATCH_DEFAULT_SUBMIT_MS, 'the submit window defaults to a generous 90 seconds');

  // Nobody plays a card: the window runs out and the round is a wash.
  tick(room, players, started + submitMs);
  let v = view(room, players, ann, started + submitMs);
  assert.equal(v.game.matchStage, 'reveal', 'an unplayed round skips the pick');
  assert.equal(v.game.lastRound.winnerId, null);
  assert.equal(v.game.lastRound.winnerName, null);
  same(v.game.revealedCards, [], 'no cards, no reveal');

  // The next round starts on its own, judge rotated.
  tick(room, players, started + submitMs + perfect.PERFECT_MATCH_REVEAL_MS);
  const roundTwo = started + submitMs + perfect.PERFECT_MATCH_REVEAL_MS;
  v = view(room, players, ann, roundTwo);
  assert.equal(v.game.matchStage, 'submit');
  assert.equal(v.game.judgeId, ben.id);
  assert.equal(v.game.promptNumber, 2);

  // A late joiner is dealt in and can play the very round they land in.
  const eve = join(room, players, 'Eve', false, roundTwo + 50);
  assert.equal(view(room, players, eve, roundTwo + 50).me.state.hand.length, 7, 'a late joiner is dealt a hand');
  const eveCard = submitFirst(room, players, eve, roundTwo + 100);
  assert.equal(view(room, players, ben, roundTwo + 100).game.waitingOn, 2, 'the table waits on the two original players');

  // Only Eve's card makes the window: the judge picks from a table of one.
  tick(room, players, roundTwo + submitMs);
  v = view(room, players, ben, roundTwo + submitMs);
  assert.equal(v.game.matchStage, 'judge');
  same(v.game.revealedCards, [{ text: eveCard }], 'players who sat the round out simply have no card on the table');
  assert.equal(engine.applyAction(room, players, ben.id, { type: 'pick', index: 0 }, roundTwo + submitMs + 10, mulberry32(5)), null);
  v = view(room, players, ann, roundTwo + submitMs + 10);
  assert.equal(v.game.lastRound.winnerName, 'Eve');
  assert.equal(v.game.scores[eve.id], 1);
  console.log('PASS: timed-out windows — an unplayed round is a wash, a lone card can still win, late joiners are dealt in.');
}

// --- prompts running out ends the game on points ------------------------------
{
  const snapshot = matchSnapshot();
  snapshot.gameTools[0] = cardList('prompts-1', 'Prompt Cards', PROMPTS.slice(0, 10));
  const room = makeRoom(snapshot);
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  let now = startGame(room, players, ann, 10000);
  // The wins are spread so nobody reaches 5: the game ends when the 10
  // prompts are gone, and the highest score wins.
  const winners = [ben, cleo, ann, ben, cleo, ann, cleo, ann, ben, ben];
  for (let round = 0; round < 10; round++) {
    const judgeId = view(room, players, ann, now).game.judgeId;
    const judge = players.find(p => p.id === judgeId);
    const winner = winners[round];
    assert.notEqual(winner.id, judgeId, 'the scripted winner never judges their own round');
    const played = new Map();
    for (const player of players) {
      if (player.id === judgeId) continue;
      played.set(player.id, submitFirst(room, players, player, now + 100));
    }
    tick(room, players, now + 200);
    const jv = view(room, players, judge, now + 200);
    const pickIndex = jv.game.revealedCards.findIndex(c => c.text === played.get(winner.id));
    assert.equal(engine.applyAction(room, players, judge.id, { type: 'pick', index: pickIndex }, now + 300, mulberry32(5)), null);
    tick(room, players, now + 300 + perfect.PERFECT_MATCH_REVEAL_MS);
    now += 300 + perfect.PERFECT_MATCH_REVEAL_MS;
  }
  assert.equal(room.status, 'finished', 'the game ends when the prompts run out');
  const v = view(room, players, ann, now);
  // Judges rotate Ann, Ben, Cleo: Ben takes 4 rounds, Ann and Cleo 3 each.
  same(v.standings.map(s => [s.name, s.score, s.winner]), [
    ['Ben', 4, true], ['Ann', 3, false], ['Cleo', 3, false],
  ], 'highest score wins when the prompts run out');
  console.log('PASS: prompts exhausted — the game ends on points with the leader as champion.');
}

// --- publish readiness ---------------------------------------------------------
{
  const unwired = [
    { id: 'wheel1', type: 'wheel', name: 'Game Wheel', enabled: true, inToolbox: true, config: {} },
    { id: 'cd1', type: 'countdown', name: 'Countdown', enabled: true, inToolbox: true, config: {} },
  ];
  const decks = matchSnapshot().gameTools;
  const matchReady = { kind: 'multiplayer', name: 'Match Night', theme: 'cyan', assets: [], controls: [], gameTools: [...unwired, ...decks] };
  assert.equal(buildReadiness(matchReady).length, 0, 'a multiplayer project with both decks publishes with no dashboard wiring');

  const MESSAGE = 'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, or a prompt card list and an answer card list for a matching game — ask Jewel to build one for you.';
  const thinDecks = [
    cardList('prompts-1', 'Prompt Cards', PROMPTS.slice(0, 9)),
    cardList('answers-1', 'Answer Cards', ANSWERS),
  ];
  const blocked = { kind: 'multiplayer', name: 'Thin Night', theme: 'cyan', assets: [], controls: [], gameTools: thinDecks };
  const issues = buildReadiness(blocked);
  assert.equal(issues.length, 1, 'a game night with unplayable decks is blocked by exactly one issue');
  assert.equal(issues[0].id, 'playable-game');
  assert.equal(issues[0].message, MESSAGE);
  assert.equal(issues[0].targetId, 'prompts-1', 'the issue points at the first card list');
  assert(!issues[0].message.includes('$'), 'the blocked reason carries no dollar sign');

  // A lone prompt list is a playable bingo pool, so it is NOT blocked —
  // readiness and the share route agree, exactly as both read it.
  const promptOnly = { kind: 'multiplayer', name: 'Prompts Night', theme: 'purple', assets: [], controls: [], gameTools: [cardList('prompts-1', 'Prompt Cards', PROMPTS)] };
  assert.equal(buildReadiness(promptOnly).length, 0, 'a lone prompt list publishes as the bingo game it is');

  // Readiness and the share route agree by construction for match projects.
  for (const project of [matchReady, blocked, promptOnly]) {
    const unplayable = 'error' in bingo.bingoConfigFromSnapshot(project)
      && 'error' in quiz.quizConfigFromSnapshot(project)
      && 'error' in survey.surveyConfigFromSnapshot(project)
      && 'error' in perfect.perfectMatchConfigFromSnapshot(project);
    assert.equal(unplayable, buildReadiness(project).some(i => i.id === 'playable-game'), 'readiness and the perfect match extraction agree for every fixture');
  }
  console.log('PASS: publish readiness accepts both decks, blocks thin decks in plain words.');
}

console.log('multiplayer-perfect-match: all assertions passed');
