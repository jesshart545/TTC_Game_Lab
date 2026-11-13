// Game-night play routes are public: friends join by name only, no account.
// Regression test for the live-test bug where /play/<token> redirected
// signed-out visitors to /auth/sign-in because proxy.ts's public allowlist
// covered /published/ and /api/live/ but not /play/ or /api/play/.
const fs = require('fs'), vm = require('vm'), ts = require('typescript');
const assert = require('node:assert/strict');
const load = require('./load.cjs');

function loadProxy() {
  const exportsObject = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('proxy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    {
      exports: exportsObject,
      require: id => id === 'next/server'
        ? { NextResponse: { next: () => ({ type: 'next' }), rewrite: url => ({ type: 'rewrite', url }) } }
        : { auth: { middleware: () => () => ({ type: 'auth' }) } },
      process: { env: { PROJECT_BASE_DOMAIN: 'ttcgamelab.com' } },
      URL,
    },
  );
  return exportsObject.proxy;
}

function request(pathname, host = 'www.ttcgamelab.com') {
  return {
    headers: { get: name => (name === 'host' ? host : null) },
    nextUrl: { pathname, clone() { return { pathname }; } },
    url: 'https://' + host + pathname,
  };
}

(async () => {
  const proxy = loadProxy();

  // --- the play page and its API pass with no session -----------------------
  for (const path of ['/play/room-token-123', '/api/play/room-token-123', '/api/play/room-token-123/join', '/api/play/room-token-123/action']) {
    const result = await proxy(request(path));
    assert.equal(result.type, 'next', `${path} must be public (players join by name only)`);
  }

  // --- pre-existing public surfaces stay public ------------------------------
  assert.equal((await proxy(request('/published/my-show/overlay'))).type, 'next', 'published overlay stays public');
  assert.equal((await proxy(request('/api/live/my-show'))).type, 'next', 'live API stays public');

  // --- everything else stays behind sign-in ----------------------------------
  for (const path of ['/projects', '/project/project-123', '/api/projects', '/api/projects/project-123/game-room', '/assets']) {
    const result = await proxy(request(path));
    assert.equal(result.type, 'auth', `${path} must still require sign-in`);
  }

  // --- anonymous identity round-trips on the returned player id --------------
  // This mirrors exactly what the routes do: join returns a playerId, the
  // poll passes it back (?player=), actions carry it in the body. No session
  // participates at any step.
  const engine = load('lib/game-room.ts');
  const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);
  const snapshot = {
    name: 'Test Bingo', theme: 'purple',
    gameTools: [
      { id: 'list-1', type: 'card-list', name: 'Call Items', enabled: true, config: { cards: items.map((text, i) => ({ id: `c${i + 1}`, text, design: {} })) } },
      { id: 'picker-1', type: 'random-picker', name: 'Draw', enabled: true, config: { source: 'cards', listId: 'list-1' } },
    ],
  };
  const picked = engine.pickGame(snapshot);
  assert.equal(picked.error, undefined);
  const room = {
    id: 'room-1', token: 'room-token-123', projectId: 'proj-1', ownerId: 'owner-1',
    gameType: picked.gameType, title: picked.config.title, snapshot, config: picked.config,
    createdAt: 1000, ...engine.newRoomState(picked.gameType, picked.config),
  };
  const players = [];
  // Anonymous join: the join route passes isCreator=false when the request
  // carries no (owner) session.
  const anon = engine.joinPlayer(room, players, { name: 'Aunt May', isCreator: false }, 2000);
  assert(!('error' in anon), 'anonymous join by name succeeds');
  assert.equal(anon.player.isCreator, false, 'an anonymous player is never the creator');
  // Poll with only the returned id resolves the same seat, still not creator.
  const polled = engine.roomView(room, players, anon.player.id, 3000);
  assert(polled.me && polled.me.id === anon.player.id, 'poll by player id resolves the anonymous seat');
  assert.equal(polled.me.isCreator, false);
  // Anonymous players can act (ready) but can never start the game.
  assert.equal(engine.applyAction(room, players, anon.player.id, { type: 'ready', ready: true }, 3000), null, 'anonymous player can ready up');
  assert(engine.applyAction(room, players, anon.player.id, { type: 'start' }, 3000).includes('creator'), 'anonymous player cannot start');
  // A fabricated id is not a seat (the action route 401s these).
  assert.equal(engine.roomView(room, players, 'player-invented', 3000).me, null, 'an unknown player id resolves no seat');
  // The creator — and only the creator — starts.
  const creator = engine.joinPlayer(room, players, { name: 'Pastor Joy', isCreator: true }, 3500);
  assert.equal(creator.player.isCreator, true);
  assert.equal(engine.applyAction(room, players, creator.player.id, { type: 'start' }, 4000), null, 'creator can start');

  // --- route wiring: creator comes only from the owner session --------------
  const joinRoute = fs.readFileSync('app/api/play/[token]/join/route.ts', 'utf8');
  assert(joinRoute.includes('sessionUser()'), 'join route consults the session only for the creator flag');
  assert(joinRoute.includes('user.id === loaded.room.ownerId'), 'creator = the room owner session');
  assert(joinRoute.includes('playerId: result.player.id'), 'join returns the player id the client keeps');
  const pollRoute = fs.readFileSync('app/api/play/[token]/route.ts', 'utf8');
  assert(pollRoute.includes('searchParams.get("player")'), 'poll identifies the player by the returned id');
  assert(!pollRoute.includes('sessionUser'), 'poll identity never depends on a session');
  const actionRoute = fs.readFileSync('app/api/play/[token]/action/route.ts', 'utf8');
  assert(actionRoute.includes('body.playerId'), 'actions identify the player by the returned id');
  assert(!actionRoute.includes('sessionUser'), 'action identity never depends on a session');
  const helpers = fs.readFileSync('app/api/play/[token]/helpers.ts', 'utf8');
  assert(helpers.includes('catch') && helpers.includes('return null'), 'a missing/broken session means "not the creator", never a failed request');
  const playPage = fs.readFileSync('app/play/[token]/page.tsx', 'utf8');
  assert(playPage.includes('ttc-play-player-'), 'the play page persists the player id per room');
  assert(playPage.includes('localStorage.setItem(storageKey, data.playerId)'), 'the join response id is stored client-side');
  assert(!playPage.includes('/auth/sign-in'), 'the play page never routes anyone to sign-in');

  console.log('PASS: play page + play API are public for name-only joins; anonymous identity round-trips on the player id; creator flag comes only from the owner session; workspace routes stay protected.');
})().catch(error => { console.error(error); process.exitCode = 1; });
