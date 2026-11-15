const assert = require('node:assert/strict'), load = require('./load.cjs');
const engine = load('lib/game-room.ts');
const tycoon = load('lib/property-tycoon.ts');
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

const PROPS = [
  'Palm Drive', 'Coral Way', 'Harbor Lane', 'Sunset Strip', 'Maple Row', 'Willow Court',
  'Cedar Point', 'Birch Hollow', 'Juniper Bend', 'Magnolia Mile', 'Cypress Cove', 'Aspen Alley',
];
const STARTERS = [
  'Ocean', 'Mountain', 'River', 'Forest', 'Desert', 'Garden',
  'Winter', 'Summer', 'Harbor', 'Meadow', 'Canyon', 'Island',
];
const WORDS = [
  'Elephant', 'Bicycle', 'Castle', 'Rainbow', 'Guitar', 'Octopus',
  'Lighthouse', 'Pineapple', 'Snowman', 'Volcano', 'Butterfly', 'Treasure Chest',
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

function tycoonSnapshot(extraTools = []) {
  return {
    name: 'Tycoon Night',
    theme: 'purple',
    gameTools: [cardList('props-1', 'Properties', PROPS), ...extraTools],
  };
}

function makeRoom(snapshot, seed = 8) {
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined, 'pickGame should succeed');
  assert.equal(picked.gameType, 'property-tycoon');
  const base = engine.newRoomState(picked.gameType, picked.config);
  return {
    room: {
      id: 'room-1', token: 'tok', projectId: 'proj-1', ownerId: 'owner-1',
      gameType: picked.gameType, title: picked.config.title,
      snapshot, config: picked.config, createdAt: 1000,
      ...base,
    },
    seed,
  };
}

function join(room, players, name, isCreator = false, now = 2000) {
  const result = engine.joinPlayer(room, players, { name, isCreator }, now, mulberry32(7));
  assert.equal(result.error, undefined, `join ${name}: ${result.error}`);
  return result.player;
}

function startGame(room, players, creator, now, seed = 8) {
  assert.equal(engine.applyAction(room, players, creator.id, { type: 'start' }, now, mulberry32(seed)), null);
  assert.equal(room.status, 'countdown');
  engine.tickRoom(room, players, now + engine.COUNTDOWN_MS, mulberry32(seed));
  assert.equal(room.status, 'playing');
  return now + engine.COUNTDOWN_MS;
}

function view(room, players, player, now = 9000) {
  return engine.roomView(room, players, player.id, now);
}

function act(room, players, player, action, now = 9000) {
  return engine.applyAction(room, players, player.id, action, now, mulberry32(5));
}

/** Roll for whoever's turn it is; if a property is offered, settle it
 * with the given policy. Returns { roller, rollEvent, view } — the
 * event as it stood right after the roll, and the view after the turn. */
function takeTurn(room, players, viewer, buy = true) {
  const before = view(room, players, viewer);
  const roller = players.find(p => p.id === before.game.turnPlayerId);
  assert(roller, 'someone holds the turn');
  assert.equal(act(room, players, roller, { type: 'roll' }), null, `roll for ${roller.name}`);
  let after = view(room, players, viewer);
  const rollEvent = after.game.lastEvent;
  if (after.game.tycoonStage === 'decide') {
    assert.equal(act(room, players, roller, { type: 'decide', buy }), null, `decide for ${roller.name}`);
    after = view(room, players, viewer);
  }
  return { roller, rollEvent, view: after };
}

function balances(v) {
  return Object.fromEntries(Object.entries(v.game.tycoonPlayers).map(([id, s]) => [id, s.balance]));
}

// --- config extraction, name signals & precedence ----------------------------
{
  same(Object.keys(engine.GAME_MODULES), ['bingo', 'quiz-board', 'survey-showdown', 'perfect-match', 'word-chain', 'draw-guess', 'property-tycoon'], 'registry order: bingo, quiz, survey, perfect match, word chain, draw & guess, property tycoon');

  const picked = engine.pickGame(tycoonSnapshot());
  assert.equal(picked.gameType, 'property-tycoon', 'a snapshot whose only content is a property list is a trading game');
  assert.equal(picked.config.title, 'Tycoon Night');
  assert.equal(picked.config.properties.length, 12);
  same(picked.config.properties.map(p => p.name), PROPS, 'the properties keep the list order — that order is the board');

  // Board identification is the name signal Jewel is taught to use.
  assert.equal(tycoon.cardListIsPropertyList('Properties'), true);
  assert.equal(tycoon.cardListIsPropertyList('PROPERTY BOARD'), true, 'the signal forgives case');
  assert.equal(tycoon.cardListIsPropertyList('Chance Cards'), false);
  assert.equal(tycoon.cardListIsPropertyList(undefined), false);
  assert.equal(tycoon.cardListIsChanceList('Chance Cards'), true);
  assert.equal(tycoon.cardListIsChanceList('Properties'), false);
  assert.equal(tycoon.TYCOON_MIN_PROPERTIES, 12);

  // The largest property list is the board when the resolver reads several.
  const twoBoards = tycoonSnapshot([cardList('props-2', 'More Properties', [...PROPS, 'Extra One', 'Extra Two', 'Extra Three'])]);
  assert.equal(tycoon.propertyTycoonConfigFromSnapshot(twoBoards).config.properties.length, 15, 'the largest property list is the board');

  // config.items pools read exactly the way bingo reads them.
  const itemsShape = {
    name: 'Items Night', theme: 'cyan',
    gameTools: [{ id: 'p', type: 'card-list', name: 'Property Pile', config: { items: PROPS } }],
  };
  assert.equal(engine.pickGame(itemsShape).gameType, 'property-tycoon', 'config.items boards count, exactly as the bingo extraction reads them');

  // Too few properties are refused with the plain seven-game reason —
  // the trading game's wording, as the last module in the registry.
  const thin = { name: 'Thin Night', theme: 'purple', gameTools: [cardList('props-1', 'Properties', PROPS.slice(0, 4))] };
  const refused = engine.pickGame(thin);
  assert(refused.error && refused.error.includes('Property Tycoon'), 'too few properties are refused with the plain reason');
  assert(refused.error.includes('Bingo') && refused.error.includes('Quiz Board') && refused.error.includes('Survey Showdown') && refused.error.includes('Perfect Match') && refused.error.includes('Word Chain') && refused.error.includes('Draw & Guess'), 'the refusal speaks for all seven games');
  assert(!refused.error.includes('$'), 'the refusal carries no dollar sign');
  const eleven = { name: 'Eleven Night', theme: 'purple', gameTools: [cardList('props-1', 'Properties', PROPS.slice(0, 11))] };
  assert(tycoon.propertyTycoonConfigFromSnapshot(eleven).error, 'eleven properties are not a playable board');

  // Duplicates do not pad a board: 14 entries but only 11 different names.
  const dupes = { name: 'Dupe Night', theme: 'purple', gameTools: [cardList('props-1', 'Properties', [...PROPS.slice(0, 11), 'palm drive', 'PALM DRIVE', 'Coral Way'])] };
  assert(tycoon.propertyTycoonConfigFromSnapshot(dupes).error, 'a board that dedupes below 12 properties is not playable');

  // A property list beside an ordinary list changes nothing: bingo
  // keeps the project and plays from the ordinary list, exactly as today.
  const propertyPlusOrdinary = {
    name: 'Mixed Night', theme: 'purple',
    gameTools: [cardList('props-1', 'Properties', PROPS), cardList('calls', 'Call Items', ANSWERS.slice(0, 25))],
  };
  const mixedPick = engine.pickGame(propertyPlusOrdinary);
  assert.equal(mixedPick.gameType, 'bingo', 'a property list beside an ordinary list is still bingo');
  same(mixedPick.config.items, ANSWERS.slice(0, 25), 'bingo plays the ordinary pool, not the property list');
  same(bingo.bingoConfigFromSnapshot(propertyPlusOrdinary).config.items, ANSWERS.slice(0, 25), 'the property list is out of bingo\'s pool whenever it qualifies');

  // A property list beside a draw deck: both step out of bingo's
  // pool, and Draw & Guess — earlier in the registry — claims it.
  const propertyPlusDraw = {
    name: 'Draw Night', theme: 'purple',
    gameTools: [cardList('props-1', 'Properties', PROPS), cardList('draw-1', 'Draw Words', WORDS)],
  };
  assert.equal(engine.pickGame(propertyPlusDraw).gameType, 'draw-guess', 'a property list beside a draw deck is a drawing game');

  // A property list beside a word deck: the property list steps out,
  // the word deck stands alone, and Word Chain claims the project.
  const propertyPlusWord = {
    name: 'Chain Night', theme: 'purple',
    gameTools: [cardList('props-1', 'Properties', PROPS), cardList('words-1', 'Word Starters', STARTERS)],
  };
  const chainPick = engine.pickGame(propertyPlusWord);
  assert.equal(chainPick.gameType, 'word-chain', 'a property list beside a word deck is a chain game');
  same(chainPick.config.starters, STARTERS);

  // The deck pair keeps its priority over a property list.
  const withDecks = tycoonSnapshot([cardList('prompts-1', 'Prompt Cards', PROMPTS), cardList('answers-1', 'Answer Cards', ANSWERS)]);
  assert.equal(engine.pickGame(withDecks).gameType, 'perfect-match', 'a playable deck pair still wins over a property list');

  // A property-named list too small to trade on (but big enough for
  // bingo) is an ordinary bingo pool, exactly as today.
  const smallProps = { name: 'Small Board', theme: 'purple', gameTools: [cardList('props-1', 'Properties', PROPS.slice(0, 6))] };
  assert.equal(engine.pickGame(smallProps).gameType, 'bingo', 'a short property list still plays bingo, exactly as today');
  same(bingo.bingoConfigFromSnapshot(smallProps).config.items, PROPS.slice(0, 6), 'bingo reads the short property list as its call pool');

  // A chance list alone is no board at all — just an ordinary pool.
  const chanceAlone = { name: 'Chance Night', theme: 'purple', gameTools: [cardList('chance-1', 'Chance Cards', ANSWERS.slice(0, 20))] };
  assert.equal(engine.pickGame(chanceAlone).gameType, 'bingo', 'a chance list without a property list is a bingo pool');

  // Nothing playable at all: the trading game's refusal is the one shown.
  const empty = engine.pickGame({ name: 'Empty', theme: 'purple', gameTools: [] });
  assert(empty.error && empty.error.includes('Property Tycoon') && !empty.error.includes('$'), 'an empty snapshot is refused in plain words with no dollar sign');
  console.log('PASS: property tycoon config extraction — board name signal, minimums, dedupe, and bingo/draw/word/perfect-match precedence.');
}

// --- the chance deck: the creator's own cards, or the built-in set ------------
{
  // Without a chance list, the built-in deck plays.
  const plain = tycoon.propertyTycoonConfigFromSnapshot(tycoonSnapshot());
  same(plain.config.chanceCards, tycoon.TYCOON_BUILTIN_CHANCE, 'no chance list means the built-in cards');
  assert.equal(plain.config.chanceCards.length, 6);

  // With one, the creator's texts carry the fixed effect rotation.
  const mine = tycoonSnapshot([cardList('chance-1', 'Chance Cards', ['A fan sends you a gift', 'Your cart breaks down', 'A parade route opens', 'Found money in a coat'])]);
  const custom = tycoon.propertyTycoonConfigFromSnapshot(mine);
  same(custom.config.chanceCards.map(c => c.text), ['A fan sends you a gift', 'Your cart breaks down', 'A parade route opens', 'Found money in a coat'], 'the creator\'s texts are the cards');
  same(custom.config.chanceCards.map(c => c.effect), [
    { kind: 'money', amount: 100 }, { kind: 'money', amount: -75 }, { kind: 'move', steps: 3 }, { kind: 'money', amount: 50 },
  ], 'effects pair with the texts in the fixed rotation');

  // The board list itself never doubles as the chance deck, even when
  // its name carries both signals.
  const bothSignals = {
    name: 'Both Night', theme: 'purple',
    gameTools: [cardList('props-1', 'Property Chance Board', PROPS)],
  };
  const both = tycoon.propertyTycoonConfigFromSnapshot(bothSignals);
  same(both.config.chanceCards, tycoon.TYCOON_BUILTIN_CHANCE, 'the board list is not its own chance deck');
  console.log('PASS: property tycoon chance deck — creator texts on the fixed rotation, built-in cards otherwise.');
}

// --- board layout: spaces, quarters, prices, color sets -----------------------
{
  const board = tycoon.tycoonBuildBoard(PROPS);
  assert.equal(board.spaces.length, 17, 'twelve properties plus five special spaces');
  same(board.spaces.map(s => s.kind), [
    'start',
    'property', 'property', 'property', 'chance',
    'property', 'property', 'property', 'rest',
    'property', 'property', 'property', 'tax',
    'property', 'property', 'property', 'timeout',
  ], 'START first, then Chance, Rest, Tax and Go to Time-Out at the quarters');
  same(board.spaces.filter(s => s.kind === 'property').map(s => s.property), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'the properties run in list order around the loop');
  assert.equal(board.timeoutSpace, 8, 'the Rest space is the Time-Out corner');
  same(board.properties.map(p => p.price), [60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280], 'prices ladder by position');
  same(board.properties.map(p => p.set), [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3], 'four sets of three');
  same(board.properties.map(p => p.color), [
    tycoon.TYCOON_SET_COLORS[0], tycoon.TYCOON_SET_COLORS[0], tycoon.TYCOON_SET_COLORS[0],
    tycoon.TYCOON_SET_COLORS[1], tycoon.TYCOON_SET_COLORS[1], tycoon.TYCOON_SET_COLORS[1],
    tycoon.TYCOON_SET_COLORS[2], tycoon.TYCOON_SET_COLORS[2], tycoon.TYCOON_SET_COLORS[2],
    tycoon.TYCOON_SET_COLORS[3], tycoon.TYCOON_SET_COLORS[3], tycoon.TYCOON_SET_COLORS[3],
  ], 'each set wears its palette color');

  same(tycoon.tycoonSetSizes(12), [3, 3, 3, 3]);
  same(tycoon.tycoonSetSizes(13), [3, 3, 3, 2, 2], 'thirteen properties: the fuller sets come first');
  same(tycoon.tycoonSetSizes(14), [3, 3, 3, 3, 2]);
  same(tycoon.tycoonSetSizes(24), [3, 3, 3, 3, 3, 3, 3, 3]);

  const board13 = tycoon.tycoonBuildBoard([...PROPS, 'Extra End']);
  assert.equal(board13.spaces.length, 18, 'thirteen properties plus five specials');
  assert.equal(board13.timeoutSpace, 10, 'the quarter rest moves with the board size');

  // Rent: a fifth of the price, doubled on a full set.
  const owners = Array(12).fill(null);
  assert.equal(tycoon.tycoonRent(board, owners, 0), 12, 'rent on the 60 property is 12');
  owners[3] = 'player-a';
  assert.equal(tycoon.tycoonRent(board, owners, 3), 24, 'a lone set member rents single');
  owners[4] = 'player-a'; owners[5] = 'player-a';
  assert.equal(tycoon.tycoonOwnsSet(board, owners, 4), true);
  assert.equal(tycoon.tycoonRent(board, owners, 3), 48, 'the whole set doubles the rent');
  assert.equal(tycoon.tycoonNetWorth(board, owners, 'player-a', 1000), 1000 + 120 + 140 + 160, 'net worth counts the hand plus what the properties cost');
  console.log('PASS: property tycoon board layout — quarter specials, price ladder, color sets, rent and set doubling, net worth.');
}

// --- action validation -----------------------------------------------------------
{
  const { room } = makeRoom(tycoonSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  startGame(room, players, ann, 10000);

  const notYourTurn = act(room, players, ben, { type: 'roll' });
  assert(notYourTurn && notYourTurn.includes("It's Ann's turn"), 'only the turn player can roll');
  const noOffer = act(room, players, ann, { type: 'decide', buy: true });
  assert(noOffer && noOffer.includes('no property on offer'), 'a decision with no offer open is refused in plain words');
  const foreign = act(room, players, ann, { type: 'guess', text: 'Palm Drive' });
  assert(foreign && foreign.includes("isn't part of this game"), 'a foreign move is refused in plain words');

  // Ann's first roll (seed 8: 2 and 1) lands on Harbor Lane and opens the offer.
  assert.equal(act(room, players, ann, { type: 'roll' }), null);
  const offered = view(room, players, ann);
  assert.equal(offered.game.tycoonStage, 'decide');
  same(offered.game.offer, { space: 3, name: 'Harbor Lane', price: 100 }, 'the offer names the space, the property and the price');
  assert(!JSON.stringify(offered).includes('$'), 'the player view carries no dollar sign');

  const wrongDecider = act(room, players, ben, { type: 'decide', buy: true });
  assert(wrongDecider && wrongDecider.includes('on the table for the player whose turn it is'), 'only the offered player can settle the offer');
  const rollDuringOffer = act(room, players, ben, { type: 'roll' });
  assert(rollDuringOffer && rollDuringOffer.includes('Settle the property offer first'), 'no one can roll while the offer is open');
  const annRollDuringOffer = act(room, players, ann, { type: 'roll' });
  assert(annRollDuringOffer && annRollDuringOffer.includes('Settle the property offer first'), 'the offered player cannot roll past their own offer');

  assert.equal(act(room, players, ann, { type: 'decide', buy: true }), null);
  const settled = view(room, players, ben);
  assert.equal(settled.game.tycoonPlayers[ann.id].balance, 1400, 'buying pays the price out of the hand');
  assert.equal(settled.game.spaces[3].ownerId, ann.id, 'the board shows the new owner');
  assert.equal(settled.game.spaces[3].ownerName, 'Ann');
  assert.equal(settled.game.turnPlayerId, ben.id, 'the turn passes once the offer settles');
  console.log('PASS: property tycoon validation — turn-only rolls, offer-only decisions, plain-word refusals.');
}

// --- a full game: the seed-8 script ----------------------------------------------
{
  const { room } = makeRoom(tycoonSnapshot());
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  startGame(room, players, ann, 20000, 8);

  const rollers = [];
  const turn = (buy = true) => {
    const result = takeTurn(room, players, ann, buy);
    rollers.push(result.roller.name);
    return result;
  };
  const bal = v => ({ ann: v.game.tycoonPlayers[ann.id].balance, ben: v.game.tycoonPlayers[ben.id].balance });

  let t = turn(); // 1 Ann buys Harbor Lane
  assert.equal(t.rollEvent, 'Ann rolled 2 and 1. Ann lands on Harbor Lane — 100 to buy it.', 'turn 1 opens the Harbor Lane offer');
  assert.equal(t.view.game.lastEvent, 'Ann buys Harbor Lane for 100.', 'the buy settles the offer');
  let v = t.view;
  t = turn(); // 2 Ben rests
  assert(t.rollEvent.includes('Ben rests at the Rest Stop'));
  turn(); // 3 Ann buys Birch Hollow
  turn(); // 4 Ben buys Juniper Bend
  t = turn(); // 5 Ann is sent to Time-Out
  v = t.view;
  assert(t.rollEvent.includes('Ann is sent to Time-Out'), 'turn 5 sends Ann to Time-Out');
  assert.equal(v.game.tycoonPlayers[ann.id].position, 8, 'her token moves to the Time-Out corner (the Rest Stop)');
  assert.equal(v.game.tycoonPlayers[ann.id].skipNext, true, 'she owes a missed turn');
  t = turn(); // 6 Ben buys Coral Way — and Ann's skip is consumed
  assert(t.view.game.lastEvent.includes('Ann misses a turn in Time-Out'), 'the skip is consumed as the turn reaches her');
  assert.equal(t.view.game.tycoonPlayers[ann.id].skipNext, false);
  t = turn(); // 7 Ben rolls AGAIN — the skip gave him two turns in a row
  assert.equal(rollers[6], 'Ben', 'after a skip the turn comes back to the other player');
  turn(); // 8 Ann is sent to Time-Out again
  turn(); // 9 Ben buys Palm Drive (Ann misses again)
  turn(); // 10 Ben buys Maple Row
  turn(); // 11 Ann buys Aspen Alley

  let before = bal(view(room, players, ann));
  t = turn(); // 12 Ben lands on Ann's Aspen Alley — rent 56
  let after = bal(t.view);
  assert.equal(after.ben, before.ben - 56, 'rent leaves the lander\'s hand');
  assert.equal(after.ann, before.ann + 56, 'rent lands in the owner\'s hand');
  assert(t.rollEvent.includes('rent 56 to Ann'));

  turn(); // 13 Ann pays rent on Maple Row
  turn(); // 14 Ben buys Sunset Strip, completing set 1 (Sunset Strip, Maple Row, Willow Court)

  before = bal(view(room, players, ann));
  turn(); // 15 Ann pays single rent on Juniper Bend
  turn(); // 16 Ben lands on his own Willow Court
  t = turn(); // 17 Ann lands on Sunset Strip — full set, rent doubled to 48
  after = bal(t.view);
  assert.equal(after.ann, before.ann + 200 - 44 - 48, 'salary in, single rent out, then the doubled rent out');
  assert(t.rollEvent.includes('rent 48 to Ben (full set — rent doubled)'), 'the doubled rent is announced');

  before = bal(view(room, players, ann));
  t = turn(); // 18 Ben lands on Tax
  after = bal(t.view);
  assert.equal(after.ben, before.ben - 50, 'tax takes a flat 50');
  assert(t.rollEvent.includes('Ben lands on Tax and pays 50'));

  turn(); // 19 Ann buys Magnolia Mile
  turn(); // 20 Ben is sent to Time-Out

  before = bal(view(room, players, ann));
  t = turn(); // 21 Ann passes Start and draws the first chance card (+100)
  after = bal(t.view);
  assert.equal(after.ann, before.ann + 300, 'salary 200 and the chance card\'s 100 both land');
  assert(t.rollEvent.includes('Ann draws Chance: Lucky day!'), 'the built-in chance card shows its text');
  assert(t.rollEvent.includes('Ben misses a turn in Time-Out'), 'Ben\'s skip is consumed on the same advance');

  turn(); // 22 Ann pays rent on Juniper Bend again
  turn(); // 23 Ben lands on his own Palm Drive
  t = turn(); // 24 Ann's twelfth turn ends the game
  v = t.view;
  assert.equal(room.status, 'finished', 'twelve turns each ends the game');
  same(rollers, ['Ann', 'Ben', 'Ann', 'Ben', 'Ann', 'Ben', 'Ben', 'Ann', 'Ben', 'Ben', 'Ann', 'Ben', 'Ann', 'Ben', 'Ann', 'Ben', 'Ann', 'Ben', 'Ann', 'Ben', 'Ann', 'Ann', 'Ben', 'Ann'], 'the turn order, skips and all');
  assert.equal(v.game.tycoonPlayers[ann.id].turnsTaken, 12);
  assert.equal(v.game.tycoonPlayers[ben.id].turnsTaken, 12);

  const standings = v.standings;
  assert.equal(standings.length, 2);
  assert.equal(standings[0].playerId, ben.id);
  assert.equal(standings[0].score, 2370, 'Ben: the richest net worth takes it');
  assert.equal(standings[0].winner, true);
  assert(standings[0].detail.includes('Property Tycoon champion'));
  assert.equal(standings[1].playerId, ann.id);
  assert.equal(standings[1].score, 2280);
  assert.equal(standings[1].winner, false);
  assert(!JSON.stringify(v).includes('$'), 'the finished view carries no dollar sign');
  console.log('PASS: property tycoon full game — buys, salary, rent, doubled set rent, tax, chance, time-out skips, twelve-turn finish and net-worth standings.');

  // Play Again: full pockets, empty board, same first turn.
  assert.equal(engine.applyAction(room, players, ben.id, { type: 'play-again' }, 9500, mulberry32(11)), null);
  assert.equal(room.status, 'countdown');
  engine.tickRoom(room, players, 9500 + engine.COUNTDOWN_MS, mulberry32(11));
  assert.equal(room.status, 'playing');
  const fresh = view(room, players, ann, 9600);
  assert.equal(fresh.game.tycoonPlayers[ann.id].balance, 1500, 'play again refills the hand');
  assert.equal(fresh.game.tycoonPlayers[ben.id].balance, 1500);
  assert.equal(fresh.game.tycoonPlayers[ann.id].position, 0, 'tokens back on Start');
  assert(fresh.game.spaces.every(s => s.kind !== 'property' || s.ownerId === null), 'every property is back on the market');
  assert.equal(fresh.game.turnPlayerId, ann.id, 'the first seat rolls first again');
  console.log('PASS: property tycoon play again — full pockets, empty board, fresh turns.');
}

// --- bankruptcy: properties return, the last one standing wins -------------------
{
  const bigProps = Array.from({ length: 24 }, (_, i) => `Property ${i + 1}`);
  const bigSnapshot = { name: 'Big Board Night', theme: 'cyan', gameTools: [cardList('props-1', 'Properties', bigProps)] };
  const { room } = makeRoom(bigSnapshot);
  const players = [];
  const ann = join(room, players, 'Ann', true);
  const ben = join(room, players, 'Ben');
  startGame(room, players, ann, 30000, 8);

  let sawUnaffordable = false;
  let guard = 0;
  while (room.status === 'playing' && guard++ < 40) {
    const { view: v } = takeTurn(room, players, ann, true);
    if (v.game.lastEvent && v.game.lastEvent.includes('more than they have — it stays on the market')) sawUnaffordable = true;
  }
  assert.equal(room.status, 'finished', 'the game ends the moment one player is left standing');
  assert(sawUnaffordable, 'a property priced past a player\'s hand stays on the market, announced in plain words');

  const end = view(room, players, ben);
  const annState = end.game.tycoonPlayers[ann.id];
  assert.equal(annState.out, true, 'Ann is out');
  assert.equal(annState.balance, 0, 'she paid what she had');
  assert.equal(annState.properties, 0, 'her properties are released');
  assert(end.game.spaces.every(s => s.kind !== 'property' || s.ownerId !== ann.id), 'nothing on the board is hers anymore');
  assert(end.game.lastEvent.includes('Ann is bankrupt and out'), 'the bankruptcy is announced in plain words');

  const standings = end.standings;
  assert.equal(standings[0].playerId, ben.id);
  assert.equal(standings[0].score, 1830);
  assert.equal(standings[0].winner, true, 'the last one standing is the champion');
  assert.equal(standings[1].playerId, ann.id);
  assert.equal(standings[1].score, 0);
  assert.equal(standings[1].detail, 'Bankrupt — out of the game');
  assert.equal(standings[1].winner, false);
  console.log('PASS: property tycoon bankruptcy — the charge takes what she had, her properties return to the market, and the last one standing wins.');
}

// --- the creator's chance cards in a live game -----------------------------------
{
  const snapshot = tycoonSnapshot([cardList('chance-1', 'Chance Cards', ['A fan sends you a gift', 'Your cart breaks down', 'A parade route opens'])]);
  const { room } = makeRoom(snapshot);
  const players = [];
  const ann = join(room, players, 'Ann', true);
  join(room, players, 'Ben');
  startGame(room, players, ann, 40000, 8);

  // Nobody buys: the dice walk is the seed-8 walk, and the first
  // chance landing (Ann, turn 21) draws the creator's first card.
  let chanceEvent = null;
  let guard = 0;
  while (room.status === 'playing' && guard++ < 24 && !chanceEvent) {
    const { view: v } = takeTurn(room, players, ann, false);
    if (v.game.lastEvent && v.game.lastEvent.includes('draws Chance')) chanceEvent = v.game.lastEvent;
  }
  assert(chanceEvent, 'a chance card is drawn during the game');
  assert(chanceEvent.includes('A fan sends you a gift'), 'the creator\'s own card text is what shows');
  assert(chanceEvent.includes('collects 100'), 'the first card carries the rotation\'s first effect');
  console.log('PASS: property tycoon creator chance deck — her words on the cards, the rotation underneath.');
}

// --- publish readiness -------------------------------------------------------------
{
  const MESSAGE = 'Your game night needs something to play: add a card list with at least 5 items, a quiz board with questions, a survey board with questions and answers, a prompt card list and an answer card list for a matching game, a word list with at least 10 starter words for a word chain game, a draw list with at least 12 words to draw for a drawing game, or a property list with at least 12 properties to trade for a property trading game — ask Jewel to build one for you.';
  const tool = (id, name, texts) => ({ id, type: 'card-list', name, enabled: true, inToolbox: true, config: { cards: texts.map((text, i) => ({ id: `${id}-c${i + 1}`, text })) } });

  const ready = { kind: 'multiplayer', name: 'Tycoon Night', theme: 'purple', assets: [], controls: [], gameTools: [tool('props-1', 'Properties', PROPS)] };
  assert.equal(buildReadiness(ready).length, 0, 'a multiplayer project holding only a property list is publish-ready');

  const thin = { kind: 'multiplayer', name: 'Thin Board', theme: 'purple', assets: [], controls: [], gameTools: [tool('props-1', 'Properties', PROPS.slice(0, 4))] };
  const thinIssues = buildReadiness(thin);
  assert.equal(thinIssues.length, 1, 'four properties are not a playable game night');
  assert.equal(thinIssues[0].message, MESSAGE, 'the blocked reason names every game in plain words');
  assert(!thinIssues[0].message.includes('$'), 'the blocked reason carries no dollar sign');

  // An 11-property list is still a bingo pool, so it is ready as bingo.
  const shortBoard = { kind: 'multiplayer', name: 'Short Board', theme: 'purple', assets: [], controls: [], gameTools: [tool('props-1', 'Properties', PROPS.slice(0, 11))] };
  assert.equal(buildReadiness(shortBoard).length, 0, 'an eleven-property list is a playable bingo pool, exactly as today');
  console.log('PASS: publish readiness accepts a playable property tycoon, blocks an unplayable one in plain words.');
}
