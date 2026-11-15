const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const chain = load('lib/word-chain.ts');
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

const STARTERS = [
  'Ocean', 'Mountain', 'River', 'Forest', 'Desert', 'Garden',
  'Winter', 'Summer', 'Harbor', 'Meadow', 'Canyon', 'Island',
];
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

function wordSnapshot() {
  return {
    name: 'Chain Night',
    theme: 'pink',
    gameTools: [cardList('words-1', 'Word Starters', STARTERS)],
  };
}

function makeRoom(snapshot, seed = 42) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, 'word-chain');
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

function play(room, players, player, text, now) {
  return engine.applyAction(room, players, player.id, { type: 'play', text }, now, mulberry32(5));
}

function tick(room, players, now) {
  engine.tickRoom(room, players, now, mulberry32(3));
}

// --- config extraction, deck identification & precedence --------------------
{
  same(Object.keys(engine.GAME_MODULES), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match', 'word-chain', 'draw-guess', 'property-tycoon'], 'registry order: bingo, quiz, survey, perfect match, word chain');

  const picked = engine.pickGame(wordSnapshot());
  assert.equal(picked.gameType, 'word-chain', 'a snapshot whose only content is a word deck is a chain game');
  assert.equal(picked.config.title, 'Chain Night');
  same(picked.config.starters, STARTERS);
  assert.equal(picked.config.turnMs, 10000, 'ten seconds a turn');

  // Deck identification is the name signal Jewel is taught to use.
  assert.equal(chain.cardListIsWordDeck('Word Starters'), true);
  assert.equal(chain.cardListIsWordDeck('WORD BANK'), true, 'the signal forgives case');
  assert.equal(chain.cardListIsWordDeck('Call Items'), false);
  assert.equal(chain.cardListIsWordDeck(undefined), false);
  assert.equal(chain.WORD_CHAIN_MIN_STARTERS, 10);

  // The largest word list is the deck when the resolver reads several.
  const twoDecks = wordSnapshot();
  twoDecks.gameTools.push(cardList('words-2', 'More Words', [...STARTERS, 'Volcano', 'Lagoon', 'Prairie']));
  assert.equal(chain.wordChainConfigFromSnapshot(twoDecks).config.starters.length, 15, 'the largest word list is the deck');
  // …but through pickGame, two word lists are two bingo candidates, so
  // bingo keeps the project exactly as today — the chain game only
  // claims a word deck that stands alone.
  assert.equal(engine.pickGame(twoDecks).gameType, 'bingo', 'two word lists are not a sole candidate — bingo plays, exactly as today');

  // config.items pools read exactly the way bingo reads them.
  const itemsShape = {
    name: 'Items Night', theme: 'purple',
    gameTools: [{ id: 'w', type: 'card-list', name: 'Word Pile', config: { items: STARTERS } }],
  };
  assert.equal(engine.pickGame(itemsShape).gameType, 'word-chain', 'config.items decks count, exactly as the bingo extraction reads them');

  // Too few starters for every game (under bingo's 5 and the chain's
  // 10) are refused with the plain five-game reason — the chain game's
  // wording, as the last module in the registry.
  const thin = { name: 'Thin Night', theme: 'purple', gameTools: [cardList('words-1', 'Word Starters', STARTERS.slice(0, 4))] };
  const refused = engine.pickGame(thin);
  assert(refused.error && refused.error.includes('Word Chain'), 'too few starters are refused with the plain reason');
  assert(refused.error.includes('Bingo') && refused.error.includes('Quiz Board') && refused.error.includes('Survey Showdown') && refused.error.includes('Perfect Match'), 'the refusal speaks for all six games');
  assert(!refused.error.includes('$'), 'the refusal carries no dollar sign');
  // Nine starters are a chain refusal at the resolver (and a bingo game
  // through pickGame — see the short-list case below).
  const nine = { name: 'Nine Night', theme: 'purple', gameTools: [cardList('words-1', 'Word Starters', STARTERS.slice(0, 9))] };
  assert(chain.wordChainConfigFromSnapshot(nine).error, 'nine starters are not a playable chain deck');

  // Duplicates do not pad a deck: 13 entries but only 9 different words
  // fail the resolver, and a pool that dedupes under every minimum is
  // refused by pickGame too.
  const dupes = { name: 'Dupe Night', theme: 'purple', gameTools: [cardList('words-1', 'Word Starters', [...STARTERS.slice(0, 9), 'ocean', 'OCEAN', 'River', 'river'])] };
  assert(chain.wordChainConfigFromSnapshot(dupes).error, 'a deck that dedupes below 10 starters is not playable');
  const dupePool = { name: 'Dupe Pool', theme: 'purple', gameTools: [cardList('words-1', 'Word Starters', ['Ocean', 'ocean', 'River', 'river', 'Forest', 'FOREST', 'Desert', 'desert'])] };
  assert(engine.pickGame(dupePool).error, 'a pool that dedupes below 5 items plays nothing');

  // A word-named list that does NOT qualify as a word deck (fewer than
  // 10 starters) is still bingo's, exactly as today — bingo needs only
  // 5 items and the chain game may not claim what it cannot play.
  const smallWord = { name: 'Small Words', theme: 'purple', gameTools: [cardList('words-1', 'Word Starters', STARTERS.slice(0, 6))] };
  assert.equal(engine.pickGame(smallWord).gameType, 'bingo', 'a short word list still plays bingo, exactly as today');
  same(bingo.bingoConfigFromSnapshot(smallWord).config.items, STARTERS.slice(0, 6), 'bingo reads the short word list as its call pool');

  // An ordinary single list is bingo, exactly as today.
  const ordinary = { name: 'Bingo Night', theme: 'purple', gameTools: [cardList('only', 'Call Items', ANSWERS.slice(0, 25))] };
  assert.equal(engine.pickGame(ordinary).gameType, 'bingo', 'one ordinary card list is bingo');

  // A word deck next to another list changes nothing: bingo keeps the
  // project and plays exactly as it always has (largest pool wins).
  const wordPlusOrdinary = {
    name: 'Mixed Night', theme: 'purple',
    gameTools: [cardList('words-1', 'Word Starters', STARTERS), cardList('calls', 'Call Items', ANSWERS.slice(0, 25))],
  };
  const mixedPick = engine.pickGame(wordPlusOrdinary);
  assert.equal(mixedPick.gameType, 'bingo', 'a word deck beside an ordinary list is still bingo');
  same(mixedPick.config.items, ANSWERS.slice(0, 25), 'bingo plays the larger ordinary pool');
  const wordLarger = {
    name: 'Mixed Night 2', theme: 'purple',
    gameTools: [cardList('words-1', 'Word Starters', [...STARTERS, ...ANSWERS.slice(0, 20)]), cardList('calls', 'Call Items', ANSWERS.slice(0, 25))],
  };
  assert.equal(engine.pickGame(wordLarger).gameType, 'bingo', 'even a larger word list beside another list is bingo, exactly as today');

  // The deck pair keeps its priority: word deck + prompt/answer decks
  // is a matching game (bingo leaves all three lists alone).
  const withDecks = wordSnapshot();
  withDecks.gameTools.push(cardList('prompts-1', 'Prompt Cards', PROMPTS), cardList('answers-1', 'Answer Cards', ANSWERS));
  assert.equal(engine.pickGame(withDecks).gameType, 'perfect-match', 'a playable deck pair still wins over a lone word deck');

  // A playable quiz keeps its priority over a lone word deck too.
  const q = (value, question, answer) => ({ value, question, answer });
  const withQuiz = wordSnapshot();
  withQuiz.gameTools.push({
    id: 'board-1', type: 'trivia-board', name: 'Quiz Board', enabled: true,
    config: { categories: [
      { name: 'Bible Basics', questions: [q(100, 'Who built the ark?', 'Noah'), q(200, 'How many disciples?', '12'), q(300, 'First book?', 'Genesis')] },
      { name: 'Food', questions: [q(100, 'Guacamole fruit?', 'Avocado'), q(200, 'Cups in a quart?', '4'), q(300, 'Orchid spice?', 'Vanilla')] },
    ] },
  });
  assert.equal(engine.pickGame(withQuiz).gameType, 'quiz-board', 'a playable quiz still wins over a lone word deck');

  // Nothing playable at all: the chain game's refusal is the one shown.
  const empty = engine.pickGame({ name: 'Empty', theme: 'purple', gameTools: [] });
  assert(empty.error && empty.error.includes('Word Chain') && !empty.error.includes('$'), 'an empty snapshot is refused in plain words with no dollar sign');
  console.log('PASS: word chain config extraction — deck name signal, minimums, dedupe, and bingo/quiz/perfect-match precedence.');
}

// --- the objective word check ------------------------------------------------
{
  assert.equal(chain.wordChainCheckWord('Ocean', []).ok, true);
  same(chain.wordChainCheckWord('  Ocean  ', []), { ok: true, word: 'Ocean' }, 'surrounding space is trimmed');
  assert.equal(chain.wordChainCheckWord('two words', []).result, 'invalid', 'two words are not one word');
  assert.equal(chain.wordChainCheckWord('wow!', []).result, 'invalid', 'punctuation is not letters');
  assert.equal(chain.wordChainCheckWord('abc123', []).result, 'invalid', 'digits are not letters');
  assert.equal(chain.wordChainCheckWord('', []).result, 'invalid', 'an empty play is invalid');
  assert.equal(chain.wordChainCheckWord('ocean', ['Ocean']).result, 'repeat', 'a repeat is a repeat in any case');
  assert.equal(chain.wordChainCheckWord('Ocean', ['ocean', 'Wave']).result, 'repeat');
  assert.equal(chain.wordChainCheckWord('Wave', ['Ocean']).ok, true);
  console.log('PASS: word chain word check — single word, letters only, no repeats in any case.');
}

// --- a full game: strikes, elimination, last one standing --------------------
{
  const room = makeRoom(wordSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  let now = startGame(room, players, ann, 10000);

  let v = view(room, players, ann, now);
  assert.equal(v.game.chainStage, 'play');
  assert.equal(v.game.chainLength, 1, 'the chain opens with the starter word');
  const starter = v.game.currentWord;
  assert(STARTERS.includes(starter), 'the starter comes from the deck');
  assert.equal(v.game.turnPlayerId, ann.id, 'the first seat opens the chain');
  assert.equal(v.game.turnEndsAt, now + 10000, 'ten seconds on the clock');
  assert(!JSON.stringify(v.game).includes('$'), 'the player view carries no dollar sign');

  // Out of turn is refused in plain words.
  const refused = play(room, players, ben, 'Alpha', now);
  assert(refused && refused.includes("Ann's turn"), 'a play out of turn is refused in plain words');

  // Ann plays two words: not one word — a strike, the chain unchanged.
  assert.equal(play(room, players, ann, 'two words', now), null);
  v = view(room, players, ann, now);
  assert.equal(v.game.chainLength, 1, 'a bad word never joins the chain');
  assert.equal(v.game.wordPlayers[ann.id].strikes, 1);
  assert.equal(v.game.lastPlay.result, 'invalid');
  assert.equal(v.game.turnPlayerId, ben.id, 'the turn moves on after a strike');

  // Ben repeats the starter, in a different case: a strike.
  assert.equal(play(room, players, ben, starter.toLowerCase(), now), null);
  v = view(room, players, ben, now);
  assert.equal(v.game.lastPlay.result, 'repeat', 'repeating the starter in another case is a repeat');
  assert.equal(v.game.wordPlayers[ben.id].strikes, 1);
  assert.equal(v.game.chainLength, 1);
  assert.equal(v.game.turnPlayerId, cleo.id);

  // Cleo links a good word.
  assert.equal(play(room, players, cleo, 'Alpha', now), null);
  v = view(room, players, cleo, now);
  same(v.game.chain, [starter, 'Alpha'], 'a good word joins the chain and becomes the current word');
  assert.equal(v.game.currentWord, 'Alpha');
  assert.equal(v.game.wordPlayers[cleo.id].added, 1);
  assert.equal(v.game.turnPlayerId, ann.id, 'the turn comes back around in join order');

  // Ann repeats Cleo's word in another case: second strike — she is out.
  assert.equal(play(room, players, ann, 'ALPHA', now), null);
  v = view(room, players, ann, now);
  assert.equal(v.game.wordPlayers[ann.id].strikes, 2);
  assert.equal(v.game.wordPlayers[ann.id].out, true, 'two strikes and you are out');
  assert.equal(v.game.turnPlayerId, ben.id, 'an eliminated seat is skipped');

  // An eliminated player cannot play.
  const outRefused = play(room, players, ann, 'Bravo', now);
  assert(outRefused && outRefused.includes('out of this chain'), 'an eliminated player is refused in plain words');

  // Ben and Cleo keep the chain growing without Ann.
  assert.equal(play(room, players, ben, 'Bravo', now), null);
  assert.equal(play(room, players, cleo, 'Charlie', now), null);
  v = view(room, players, ben, now);
  assert.equal(v.game.chainLength, 4);
  assert.equal(v.game.turnPlayerId, ben.id, 'the turn skips Ann\'s seat and comes to Ben');

  // Ben lets the clock run out: his second strike — he is out, and
  // Cleo is the last one standing.
  now += 10001;
  tick(room, players, now);
  v = view(room, players, ben, now);
  assert.equal(v.game.lastPlay.result, 'timeout');
  assert.equal(v.game.lastPlay.playerId, ben.id);
  assert.equal(v.game.wordPlayers[ben.id].strikes, 2);
  assert.equal(v.game.wordPlayers[ben.id].out, true, 'the timeout was Ben\'s second strike — he is out');
  assert.equal(room.status, 'finished', 'one player left standing ends the game');

  // Standings: the survivor first, then the eliminated by how long
  // they lasted (Ben went out on a longer chain than Ann).
  const standings = v.standings;
  assert(standings && standings.length === 3, 'everyone appears in the standings');
  assert.equal(standings[0].playerId, cleo.id);
  assert.equal(standings[0].winner, true);
  assert(standings[0].detail.includes('Last one standing'), 'the survivor is named last one standing');
  assert.equal(standings[0].score, 2, 'the score counts words added to the chain');
  assert.equal(standings[1].playerId, ben.id, 'Ben lasted longer than Ann, so Ben ranks above her');
  assert.equal(standings[1].score, 1);
  assert.equal(standings[1].winner, false);
  assert.equal(standings[2].playerId, ann.id);
  console.log('PASS: word chain full game — invalid and repeat strikes, timeout strike, elimination at two strikes, last one standing.');
}

// --- the 30-word finish, shared by everyone still in --------------------------
{
  const room = makeRoom(wordSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  let now = startGame(room, players, ann, 20000);
  const words = [
    'Amber', 'Birch', 'Coral', 'Drift', 'Ember', 'Flint', 'Grove', 'Hazel', 'Iris', 'Juniper',
    'Karma', 'Lumen', 'Maple', 'Nectar', 'Onyx', 'Pepper', 'Quartz', 'Rowan', 'Sable', 'Tulip',
    'Umber', 'Velvet', 'Walnut', 'Willow', 'Yonder', 'Zephyr', 'Alto', 'Basil', 'Cedar',
  ];
  const seats = [ann, ben];
  words.forEach((word, index) => {
    assert.equal(play(room, players, seats[index % 2], word, now), null, `play ${word}`);
  });
  assert.equal(room.status, 'finished', 'a 30-word chain ends the game');
  const v = view(room, players, ann, now);
  assert.equal(v.game.chainLength, 30);
  assert.equal(v.standings.length, 2);
  assert.equal(v.standings[0].playerId, ann.id, 'with no strikes, more words added ranks first');
  assert.equal(v.standings[0].score, 15);
  assert.equal(v.standings[1].score, 14);
  assert(v.standings.every(s => s.winner), 'everyone still in shares the finish');
  assert(v.standings.every(s => s.detail.includes('Finished the 30-word chain')), 'the shared finish is named in the standings');
  console.log('PASS: word chain 30-word finish — the chain fills, everyone standing shares the win.');

  // Play Again: a fresh starter, strikes wiped, everyone back in.
  assert.equal(engine.applyAction(room, players, ben.id, { type: 'play-again' }, now + 1000, mulberry32(11)), null);
  assert.equal(room.status, 'countdown');
  tick(room, players, now + 1000 + engine.COUNTDOWN_MS);
  assert.equal(room.status, 'playing');
  const fresh = view(room, players, ann, now + 1000 + engine.COUNTDOWN_MS);
  assert.equal(fresh.game.chainLength, 1, 'play again deals a fresh starter');
  assert.equal(fresh.game.wordPlayers[ann.id].strikes, 0);
  assert.equal(fresh.game.wordPlayers[ben.id].out, false);
  assert.equal(fresh.game.turnPlayerId, ann.id, 'the first seat opens the new chain');
  console.log('PASS: word chain play again — fresh starter, clean slates, everyone back in.');
}

// --- publish readiness ---------------------------------------------------------
{
  const MESSAGE = 'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, a prompt card list and an answer card list for a matching game, a word list with at least 10 starter words for a word chain game, a draw list with at least 12 words to draw for a drawing game, or a property list with at least 12 properties to trade for a property trading game — ask Jewel to build one for you.';
  const tool = (id, name, texts) => ({ id, type: 'card-list', name, enabled: true, inToolbox: true, config: { cards: texts.map((text, i) => ({ id: `${id}-c${i + 1}`, text })) } });

  const ready = { kind: 'multiplayer', name: 'Chain Night', theme: 'pink', assets: [], controls: [], gameTools: [tool('words-1', 'Word Starters', STARTERS)] };
  assert.equal(buildReadiness(ready).length, 0, 'a multiplayer project holding only a word deck is publish-ready');

  const thin = { kind: 'multiplayer', name: 'Thin Chain', theme: 'pink', assets: [], controls: [], gameTools: [tool('words-1', 'Word Starters', STARTERS.slice(0, 4))] };
  const thinIssues = buildReadiness(thin);
  assert.equal(thinIssues.length, 1, 'four starters are not a playable game night');
  assert.equal(thinIssues[0].message, MESSAGE, 'the blocked reason names every game in plain words');
  assert(!thinIssues[0].message.includes('$'), 'the blocked reason carries no dollar sign');

  // A short word list is still a bingo pool, so it is ready as bingo.
  const shortWords = { kind: 'multiplayer', name: 'Short Words', theme: 'pink', assets: [], controls: [], gameTools: [tool('words-1', 'Word Starters', STARTERS.slice(0, 6))] };
  assert.equal(buildReadiness(shortWords).length, 0, 'a six-word list is a playable bingo pool, exactly as today');
  console.log('PASS: publish readiness accepts a playable word chain, blocks an unplayable one in plain words.');
}
