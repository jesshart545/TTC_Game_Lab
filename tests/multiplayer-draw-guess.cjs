const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const draw = load('lib/draw-guess.ts');
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

const WORDS = [
  'Elephant', 'Bicycle', 'Castle', 'Rainbow', 'Guitar', 'Octopus',
  'Lighthouse', 'Pineapple', 'Snowman', 'Volcano', 'Butterfly', 'Treasure Chest',
];
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

function drawSnapshot() {
  return {
    name: 'Draw Night',
    theme: 'cyan',
    gameTools: [cardList('draw-1', 'Draw Words', WORDS)],
  };
}

function makeRoom(snapshot, seed = 42) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, 'draw-guess');
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

function act(room, players, player, action, now) {
  return engine.applyAction(room, players, player.id, action, now, mulberry32(5));
}

function tick(room, players, now) {
  engine.tickRoom(room, players, now, mulberry32(3));
}

const aStroke = () => ({ color: '#e11d48', width: 10, points: [[100, 100], [200, 150], [300, 120]] });

// --- config extraction, deck identification & precedence --------------------
{
  same(Object.keys(engine.GAME_MODULES), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match', 'word-chain', 'draw-guess', 'property-tycoon'], 'registry order: bingo, quiz, survey, perfect match, word chain, draw & guess');

  const picked = engine.pickGame(drawSnapshot());
  assert.equal(picked.gameType, 'draw-guess', 'a snapshot whose only content is a draw deck is a drawing game');
  assert.equal(picked.config.title, 'Draw Night');
  same(picked.config.words, WORDS);
  assert.equal(picked.config.roundMs, 60000, 'sixty seconds a round');

  // Deck identification is the name signal Jewel is taught to use.
  assert.equal(draw.cardListIsDrawDeck('Draw Words'), true);
  assert.equal(draw.cardListIsDrawDeck('DRAWING PROMPTS'), true, 'the signal forgives case');
  assert.equal(draw.cardListIsDrawDeck('Call Items'), false);
  assert.equal(draw.cardListIsDrawDeck(undefined), false);
  assert.equal(draw.DRAW_GUESS_MIN_WORDS, 12);

  // The draw signal wins over the word signal in one name: "Draw
  // Words" is a drawing deck, never a Word Chain starter deck.
  assert.equal(chain.cardListIsWordDeck('Draw Words'), false, 'a draw-named list is not a word deck');
  assert.equal(chain.cardListIsWordDeck('Word Starters'), true, 'a plain word name still signals the chain deck');

  // The largest draw list is the deck when the resolver reads several.
  const twoDecks = drawSnapshot();
  twoDecks.gameTools.push(cardList('draw-2', 'More Draw Words', [...WORDS, 'Compass', 'Waterfall', 'Pyramid']));
  assert.equal(draw.drawGuessConfigFromSnapshot(twoDecks).config.words.length, 15, 'the largest draw list is the deck');
  assert.equal(engine.pickGame(twoDecks).gameType, 'draw-guess', 'two draw decks are still a drawing game');

  // config.items pools read exactly the way bingo reads them.
  const itemsShape = {
    name: 'Items Night', theme: 'purple',
    gameTools: [{ id: 'd', type: 'card-list', name: 'Draw Pile', config: { items: WORDS } }],
  };
  assert.equal(engine.pickGame(itemsShape).gameType, 'draw-guess', 'config.items decks count, exactly as the bingo extraction reads them');

  // Too few words are refused with the plain six-game reason — the
  // drawing game's wording, as the last module in the registry.
  const thin = { name: 'Thin Night', theme: 'purple', gameTools: [cardList('draw-1', 'Draw Words', WORDS.slice(0, 4))] };
  const refused = engine.pickGame(thin);
  assert(refused.error && refused.error.includes('Draw & Guess'), 'too few words are refused with the plain reason');
  assert(refused.error.includes('Bingo') && refused.error.includes('Quiz Board') && refused.error.includes('Survey Showdown') && refused.error.includes('Perfect Match') && refused.error.includes('Word Chain'), 'the refusal speaks for all six games');
  assert(!refused.error.includes('$'), 'the refusal carries no dollar sign');
  const eleven = { name: 'Eleven Night', theme: 'purple', gameTools: [cardList('draw-1', 'Draw Words', WORDS.slice(0, 11))] };
  assert(draw.drawGuessConfigFromSnapshot(eleven).error, 'eleven words are not a playable draw deck');

  // Duplicates do not pad a deck: 14 entries but only 11 different words.
  const dupes = { name: 'Dupe Night', theme: 'purple', gameTools: [cardList('draw-1', 'Draw Words', [...WORDS.slice(0, 11), 'elephant', 'ELEPHANT', 'Castle'])] };
  assert(draw.drawGuessConfigFromSnapshot(dupes).error, 'a deck that dedupes below 12 words is not playable');

  // A draw deck beside an ordinary list changes nothing: bingo keeps
  // the project and plays from the ordinary list, exactly as today.
  const drawPlusOrdinary = {
    name: 'Mixed Night', theme: 'purple',
    gameTools: [cardList('draw-1', 'Draw Words', WORDS), cardList('calls', 'Call Items', ANSWERS.slice(0, 25))],
  };
  const mixedPick = engine.pickGame(drawPlusOrdinary);
  assert.equal(mixedPick.gameType, 'bingo', 'a draw deck beside an ordinary list is still bingo');
  same(mixedPick.config.items, ANSWERS.slice(0, 25), 'bingo plays the ordinary pool, not the draw deck');
  same(bingo.bingoConfigFromSnapshot(drawPlusOrdinary).config.items, ANSWERS.slice(0, 25), 'the draw deck is out of bingo\'s pool whenever it qualifies');

  // A draw deck beside a word deck: the drawing deck steps out of
  // bingo's pool, the word deck stands alone, and Word Chain — earlier
  // in the registry — claims the project.
  const drawPlusWord = {
    name: 'Two Decks Night', theme: 'purple',
    gameTools: [cardList('draw-1', 'Draw Words', WORDS), cardList('words-1', 'Word Starters', STARTERS)],
  };
  const chainPick = engine.pickGame(drawPlusWord);
  assert.equal(chainPick.gameType, 'word-chain', 'a draw deck beside a word deck is a chain game');
  same(chainPick.config.starters, STARTERS);

  // The deck pair keeps its priority over a draw deck.
  const withDecks = drawSnapshot();
  withDecks.gameTools.push(cardList('prompts-1', 'Prompt Cards', PROMPTS), cardList('answers-1', 'Answer Cards', ANSWERS));
  assert.equal(engine.pickGame(withDecks).gameType, 'perfect-match', 'a playable deck pair still wins over a draw deck');

  // A word deck alone is still a chain game, exactly as today.
  const wordAlone = { name: 'Chain Night', theme: 'pink', gameTools: [cardList('words-1', 'Word Starters', STARTERS)] };
  assert.equal(engine.pickGame(wordAlone).gameType, 'word-chain', 'a lone word deck is still Word Chain');

  // An ordinary single list is bingo, exactly as today.
  const ordinary = { name: 'Bingo Night', theme: 'purple', gameTools: [cardList('only', 'Call Items', ANSWERS.slice(0, 25))] };
  assert.equal(engine.pickGame(ordinary).gameType, 'bingo', 'one ordinary card list is bingo');

  // A draw-named list too small to draw from (but big enough for
  // bingo) is an ordinary bingo pool, exactly as today.
  const smallDraw = { name: 'Small Draw', theme: 'purple', gameTools: [cardList('draw-1', 'Draw Words', WORDS.slice(0, 6))] };
  assert.equal(engine.pickGame(smallDraw).gameType, 'bingo', 'a short draw list still plays bingo, exactly as today');
  same(bingo.bingoConfigFromSnapshot(smallDraw).config.items, WORDS.slice(0, 6), 'bingo reads the short draw list as its call pool');

  // Nothing playable at all: the drawing game's refusal is the one shown.
  const empty = engine.pickGame({ name: 'Empty', theme: 'purple', gameTools: [] });
  assert(empty.error && empty.error.includes('Draw & Guess') && !empty.error.includes('$'), 'an empty snapshot is refused in plain words with no dollar sign');
  console.log('PASS: draw & guess config extraction — deck name signal, minimums, dedupe, and bingo/perfect-match/word-chain precedence.');
}

// --- letter blanks and stroke cleaning ---------------------------------------
{
  assert.equal(draw.drawGuessBlanks('Elephant'), '________', 'one blank per letter');
  assert.equal(draw.drawGuessBlanks('Treasure Chest'), '________ _____', 'spaces stay spaces');
  assert.equal(draw.drawGuessBlanks(''), '');
  const blanks = draw.drawGuessBlanks('Pineapple');
  assert(!/[A-Za-z]/.test(blanks), 'the blanks never carry a letter');

  const good = draw.drawGuessCleanStroke({ color: '#22c55e', width: 22, points: [[10, 10], [20, 20]] });
  same(good, { color: '#22c55e', width: 22, points: [[10, 10], [20, 20]] }, 'a clean stroke passes through');
  const wild = draw.drawGuessCleanStroke({ color: 'hotpink', width: 99, points: [[1200, -5], [500, 800]] });
  same(wild, { color: draw.DRAW_GUESS_COLORS[0], width: draw.DRAW_GUESS_WIDTHS[1], points: [[1000, 0], [500, 750]] }, 'unknown colors and sizes fall back; points clamp into the canvas');
  assert.equal(draw.drawGuessCleanStroke({ color: '#22c55e', width: 10, points: 'nope' }), null, 'a non-array stroke is nothing');
  assert.equal(draw.drawGuessCleanStroke({ color: '#22c55e', width: 10, points: [] }), null, 'an empty stroke is nothing');
  assert.equal(draw.drawGuessCleanStroke(null), null);
  const longStroke = draw.drawGuessCleanStroke({ color: '#0ea5e9', width: 4, points: Array.from({ length: 500 }, (_, i) => [i, 10]) });
  assert(longStroke.points.length <= draw.DRAW_GUESS_MAX_POINTS_PER_STROKE, 'a fast hand is decimated to the per-stroke cap');
  assert(longStroke.points.length > 100, 'decimation keeps the shape of the line');
  same(longStroke.points[longStroke.points.length - 1], [499, 10], 'the last point always survives decimation');
  const dupes = draw.drawGuessCleanStroke({ color: '#0ea5e9', width: 4, points: [[5, 5], [5, 5], [9, 9]] });
  same(dupes.points, [[5, 5], [9, 9]], 'consecutive duplicate points carry no line and are dropped');
  console.log('PASS: draw & guess blanks and stroke cleaning — lengths only, palette and pen sizes, clamped and decimated points.');
}

// --- secrecy: the word reaches the drawer alone -------------------------------
{
  const room = makeRoom(drawSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  const cleo = join(room, players, 'Cleo');
  const now = startGame(room, players, ann, 10000);

  const annView = view(room, players, ann, now);
  assert.equal(annView.game.drawStage, 'draw');
  assert.equal(annView.game.drawerId, ann.id, 'the first seat draws first');
  const word = annView.me.state.drawWord;
  assert(word && WORDS.includes(word), 'the drawer privately holds a word from the deck');

  // The word is in NO other player's view, in full or anywhere.
  for (const other of [ben, cleo]) {
    const otherView = view(room, players, other, now);
    assert(!JSON.stringify(otherView).includes(word), `the word is nowhere in ${other.name}'s view`);
    assert.equal(otherView.me.state.drawWord, '', 'a guesser\'s own state holds no word');
  }
  // And it is not in the public state even on the drawer's own screen —
  // her word arrives only through her private player state.
  assert(!JSON.stringify(annView.game).includes(word), 'the public state never carries the word mid-round');

  // The guessers get the word's shape and nothing else.
  const benView = view(room, players, ben, now);
  assert.equal(benView.game.blanks, draw.drawGuessBlanks(word), 'guessers see the letter blanks');
  assert.equal(benView.game.blanks.length, word.length, 'the blanks are exactly the word\'s length');
  assert(!/[A-Za-z]/.test(benView.game.blanks.replace(/ /g, '')), 'the blanks leak no letter');
  assert(!JSON.stringify(benView.game).includes('$'), 'the player view carries no dollar sign');

  // A wrong guess changes nothing about the secret.
  assert.equal(act(room, players, ben, { type: 'guess', text: 'Banana' }, now), null);
  const afterGuess = view(room, players, cleo, now);
  assert(!JSON.stringify(afterGuess).includes(word), 'the word stays secret after a wrong guess');
  same(afterGuess.game.guesses.map(g => g.text), ['Banana'], 'the wrong guess is public in the feed');
  assert.equal(afterGuess.game.guesses[0].name, 'Ben', 'the feed names the guesser');

  // The right guess ends the round — and only THEN is the word public.
  assert.equal(act(room, players, cleo, { type: 'guess', text: word }, now), null);
  const revealed = view(room, players, ben, now);
  assert.equal(revealed.game.drawStage, 'reveal');
  assert.equal(revealed.game.drawReveal.word, word, 'the word is revealed to everyone once the round ends');
  assert.equal(revealed.game.drawReveal.guesserId, cleo.id);
  assert.equal(view(room, players, ann, now).me.state.drawWord, '', 'the private copy leaves the drawer\'s state at the reveal');
  console.log('PASS: draw & guess secrecy — the word lives only in the drawer\'s own state until the reveal.');
}

// --- a full game: rotation, scoring, timeout, two turns each -------------------
{
  const room = makeRoom(drawSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  let now = startGame(room, players, ann, 20000);
  const drawersSeen = [];

  // Round 1 — Ann draws.
  let v = view(room, players, ann, now);
  drawersSeen.push(v.game.drawerId);
  assert.equal(v.game.drawerId, ann.id);
  const word1 = v.me.state.drawWord;
  assert(word1, 'Ann holds the first word');
  // A guesser cannot draw, and the drawer cannot guess.
  const notDrawer = act(room, players, ben, { type: 'stroke', stroke: aStroke() }, now);
  assert(notDrawer && notDrawer.includes('Only the player drawing'), 'a guesser\'s stroke is refused in plain words');
  const drawerGuess = act(room, players, ann, { type: 'guess', text: 'Castle' }, now);
  assert(drawerGuess && drawerGuess.includes('You\'re drawing'), 'the drawer\'s guess is refused in plain words');
  // Ann draws; the stroke is public on Ben's screen at once.
  assert.equal(act(room, players, ann, { type: 'stroke', stroke: aStroke() }, now), null);
  v = view(room, players, ben, now);
  assert.equal(v.game.strokes.length, 1, 'the stroke is on the shared canvas');
  same(v.game.strokes[0], aStroke(), 'the stroke arrives as drawn');
  // Ben misses, then lands it with a forgiving match (case and a
  // trailing period never decide): guesser +3, drawer +1, round over.
  assert.equal(act(room, players, ben, { type: 'guess', text: 'Banana' }, now), null);
  assert.equal(act(room, players, ben, { type: 'guess', text: `${word1.toLowerCase()}.` }, now), null);
  v = view(room, players, ben, now);
  assert.equal(v.game.drawStage, 'reveal');
  assert.equal(v.game.drawReveal.word, word1);
  assert.equal(v.game.drawReveal.guesserName, 'Ben');
  assert.equal(v.game.scores[ben.id], 3, 'the first right guess scores 3');
  assert.equal(v.game.scores[ann.id], 1, 'the drawer scores 1');
  assert.equal(v.game.guesses.length, 1, 'only the wrong guess stays in the feed');

  // Round 2 — Ben draws; Ann guesses it.
  now += draw.DRAW_GUESS_REVEAL_MS;
  tick(room, players, now);
  v = view(room, players, ben, now);
  drawersSeen.push(v.game.drawerId);
  assert.equal(v.game.drawerId, ben.id, 'the easel passes in join order');
  assert.equal(v.game.drawStage, 'draw');
  assert.equal(v.game.strokes.length, 0, 'each round opens on a blank canvas');
  const word2 = v.me.state.drawWord;
  assert(word2 && word2 !== word1, 'a fresh word is dealt');
  assert.equal(act(room, players, ann, { type: 'guess', text: `the ${word2.toLowerCase()}` }, now), null, 'a leading "the" never decides a guess');
  v = view(room, players, ann, now);
  assert.equal(v.game.scores[ann.id], 4, 'Ann banks her 3 as guesser');
  assert.equal(v.game.scores[ben.id], 4, 'Ben banks his 1 as drawer');

  // Round 3 — Ann draws again; the clock runs out, nobody scores.
  now += draw.DRAW_GUESS_REVEAL_MS;
  tick(room, players, now);
  v = view(room, players, ann, now);
  drawersSeen.push(v.game.drawerId);
  assert.equal(v.game.drawerId, ann.id, 'the rotation comes back around');
  const endsAt = v.game.endsAt;
  assert.equal(endsAt, now + 60000, 'sixty seconds on the round clock');
  tick(room, players, endsAt);
  v = view(room, players, ben, endsAt);
  assert.equal(v.game.drawStage, 'reveal');
  assert.equal(v.game.drawReveal.guesserId, null, 'a timeout names no guesser');
  assert.equal(v.game.scores[ann.id], 4, 'a timeout scores nobody');
  assert.equal(v.game.scores[ben.id], 4);

  // Round 4 — Ben's second turn: he draws, clears, draws again; Ann
  // guesses it, and with everyone having drawn twice the game ends.
  now = endsAt + draw.DRAW_GUESS_REVEAL_MS;
  tick(room, players, now);
  v = view(room, players, ben, now);
  drawersSeen.push(v.game.drawerId);
  assert.equal(v.game.drawerId, ben.id);
  const word4 = v.me.state.drawWord;
  assert.equal(act(room, players, ben, { type: 'stroke', stroke: aStroke() }, now), null);
  assert.equal(act(room, players, ben, { type: 'clear' }, now), null);
  assert.equal(view(room, players, ann, now).game.strokes.length, 0, 'the drawer can clear the canvas');
  const clearRefused = act(room, players, ann, { type: 'clear' }, now);
  assert(clearRefused && clearRefused.includes('Only the player drawing'), 'a guesser cannot clear the canvas');
  assert.equal(act(room, players, ann, { type: 'guess', text: word4 }, now), null);
  now += draw.DRAW_GUESS_REVEAL_MS;
  tick(room, players, now);
  assert.equal(room.status, 'finished', 'everyone having drawn twice ends the game');
  same(drawersSeen, [ann.id, ben.id, ann.id, ben.id], 'the easel rotated in join order, twice each');

  const standings = view(room, players, ann, now).standings;
  assert.equal(standings.length, 2);
  assert.equal(standings[0].playerId, ann.id);
  assert.equal(standings[0].score, 7, 'Ann: two guesses (3+3) and one drawn word guessed (1)');
  assert.equal(standings[0].winner, true);
  assert(standings[0].detail.includes('Draw & Guess champion'));
  assert.equal(standings[1].playerId, ben.id);
  assert.equal(standings[1].score, 5, 'Ben: one guess (3) and two drawn words guessed (1+1)');
  assert.equal(standings[1].winner, false);
  console.log('PASS: draw & guess full game — stroke rights, forgiving match, 3-and-1 scoring, clear, timeout, rotation, two-turns-each finish.');

  // Play Again: fresh words, cleared canvas, scores reset.
  assert.equal(engine.applyAction(room, players, ben.id, { type: 'play-again' }, now + 1000, mulberry32(11)), null);
  assert.equal(room.status, 'countdown');
  tick(room, players, now + 1000 + engine.COUNTDOWN_MS);
  assert.equal(room.status, 'playing');
  const fresh = view(room, players, ann, now + 1000 + engine.COUNTDOWN_MS);
  assert.equal(fresh.game.drawStage, 'draw');
  assert.equal(fresh.game.scores[ann.id], 0, 'play again resets the scores');
  assert.equal(fresh.game.scores[ben.id], 0);
  assert.equal(fresh.game.strokes.length, 0, 'play again opens on a blank canvas');
  assert(fresh.me.state.drawWord, 'the first seat draws first again, word in hand');
  console.log('PASS: draw & guess play again — fresh words, clean canvas, scores reset.');
}

// --- the canvas cap -------------------------------------------------------------
{
  const room = makeRoom(drawSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  join(room, players, 'Ben');
  const now = startGame(room, players, ann, 30000);
  for (let i = 0; i < draw.DRAW_GUESS_MAX_STROKES; i++) {
    assert.equal(act(room, players, ann, { type: 'stroke', stroke: aStroke() }, now), null, `stroke ${i + 1}`);
  }
  assert.equal(view(room, players, ann, now).game.strokes.length, draw.DRAW_GUESS_MAX_STROKES);
  const overflow = act(room, players, ann, { type: 'stroke', stroke: aStroke() }, now);
  assert(overflow && overflow.includes('canvas is full'), 'the stroke past the cap is refused in plain words');
  assert.equal(act(room, players, ann, { type: 'clear' }, now), null, 'clearing makes room again');
  assert.equal(act(room, players, ann, { type: 'stroke', stroke: aStroke() }, now), null);
  console.log('PASS: draw & guess canvas cap — strokes stop at the cap until the drawer clears.');
}

// --- publish readiness ---------------------------------------------------------
{
  const MESSAGE = 'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, a prompt card list and an answer card list for a matching game, a word list with at least 10 starter words for a word chain game, a draw list with at least 12 words to draw for a drawing game, or a property list with at least 12 properties to trade for a property trading game — ask Jewel to build one for you.';
  const tool = (id, name, texts) => ({ id, type: 'card-list', name, enabled: true, inToolbox: true, config: { cards: texts.map((text, i) => ({ id: `${id}-c${i + 1}`, text })) } });

  const ready = { kind: 'multiplayer', name: 'Draw Night', theme: 'cyan', assets: [], controls: [], gameTools: [tool('draw-1', 'Draw Words', WORDS)] };
  assert.equal(buildReadiness(ready).length, 0, 'a multiplayer project holding only a draw deck is publish-ready');

  const thin = { kind: 'multiplayer', name: 'Thin Draw', theme: 'cyan', assets: [], controls: [], gameTools: [tool('draw-1', 'Draw Words', WORDS.slice(0, 4))] };
  const thinIssues = buildReadiness(thin);
  assert.equal(thinIssues.length, 1, 'four words are not a playable game night');
  assert.equal(thinIssues[0].message, MESSAGE, 'the blocked reason names every game in plain words');
  assert(!thinIssues[0].message.includes('$'), 'the blocked reason carries no dollar sign');

  // An 11-word draw list is still a bingo pool, so it is ready as bingo.
  const shortDraw = { kind: 'multiplayer', name: 'Short Draw', theme: 'cyan', assets: [], controls: [], gameTools: [tool('draw-1', 'Draw Words', WORDS.slice(0, 11))] };
  assert.equal(buildReadiness(shortDraw).length, 0, 'an eleven-word list is a playable bingo pool, exactly as today');
  console.log('PASS: publish readiness accepts a playable draw & guess, blocks an unplayable one in plain words.');
}
