// Tier-1 security fixes (audit Q-1 + Q-2):
//  1. DELETE /api/assets had NO auth or ownership check — anyone could
//     delete any project's stored media by key. It now requires a signed-in
//     creator who owns the project the key belongs to (admins keep their
//     broader access), and fails closed otherwise.
//  2. Trivia-board answers shipped in the published snapshot to anyone who
//     could read the overlay payload. They are now scrubbed at publish
//     (lib/quiz.ts scrubTriviaBoardForPublish, applied in the projects
//     route's snapshot loop beside the quiz/CCS scrubs); the reveal still
//     works because the host-gated live route reads the answer from the
//     draft server-side and puts it only in the reveal ("answer") event,
//     and Game Night room creation restores the answers from the draft on
//     the server (lib/quiz-board.ts restoreTriviaBoardAnswers).
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript'), load = require('./load.cjs');
// Modules loaded through load.cjs run in a VM realm; compare structurally.
const same = (actual, expected, message) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);

/* ------------------------------------------------------------------ */
/* Fix 1 — the asset DELETE route, exercised with stubbed neighbours   */
/* ------------------------------------------------------------------ */
const scenario = { user: null, adminEmails: [], db: null, deleted: [] };
function fakeDb(projects) {
  return (strings, ...values) => {
    const sql = strings.join(' ? ');
    if (/SELECT id, owner_id FROM projects WHERE id =/.test(sql)) {
      const row = projects.find(p => p.id === values[0]);
      if (!row) return Promise.resolve([]);
      if (sql.includes('AND owner_id =')) {
        return Promise.resolve(row.owner_id === values[1] ? [{ id: row.id, owner_id: row.owner_id }] : []);
      }
      return Promise.resolve([{ id: row.id, owner_id: row.owner_id }]);
    }
    return Promise.resolve([]);
  };
}
function compileAssetsRoute() {
  const code = ts.transpileModule(fs.readFileSync('app/api/assets/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  const stubs = {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    '../../../lib/music-wav': { capMusicWav: bytes => bytes },
    '../../../lib/db': { getDb: () => scenario.db },
    '../../../lib/auth/server': {
      requireCreator: async () => scenario.user,
      isAdmin: u => !!u && (u.role === 'admin' || scenario.adminEmails.includes((u.email || '').toLowerCase())),
    },
    '../../../lib/object-storage': {
      deleteAssetsByPrefix: async key => { scenario.deleted.push(key); return 3; },
      getAssetUploadUrl: async () => '', getAssetUrl: async () => '', putAsset: async () => {},
    },
  };
  vm.runInNewContext(code, { exports, require: id => stubs[id] ?? require(id), URL, crypto: require('node:crypto').webcrypto, console });
  return exports;
}
const assetsRoute = compileAssetsRoute();
const req = key => ({ url: `https://example.test/api/assets?key=${encodeURIComponent(key)}`, headers: { get: () => null } });
const KEY = 'projects/proj-1/uuid-file.png';
const PROJECTS = [{ id: 'proj-1', owner_id: 'user-owner' }, { id: 'proj-2', owner_id: 'user-other' }];

(async () => {
  // Unauthenticated: rejected, nothing deleted.
  scenario.user = null; scenario.db = fakeDb(PROJECTS); scenario.deleted = [];
  let res = await assetsRoute.DELETE(req(KEY));
  assert.equal(res.status, 401); assert.equal(res.body.error, 'Unauthorized.');
  assert.equal(scenario.deleted.length, 0, 'unauthenticated delete must not touch storage');

  // Signed in but not the owner: fails closed as "not found", nothing deleted.
  scenario.user = { id: 'user-other', email: 'other@example.test', role: 'user' }; scenario.deleted = [];
  res = await assetsRoute.DELETE(req(KEY));
  assert.equal(res.status, 404); assert.equal(res.body.error, 'Project not found.');
  assert.equal(scenario.deleted.length, 0, 'wrong-owner delete must not touch storage');

  // The owner: the legitimate delete works exactly as before.
  scenario.user = { id: 'user-owner', email: 'owner@example.test', role: 'user' }; scenario.deleted = [];
  res = await assetsRoute.DELETE(req(KEY));
  assert.equal(res.status, 200); same(res.body, { deleted: 3 });
  same(scenario.deleted, [KEY], 'owner delete removes the requested key');

  // An admin by role keeps the broader access other routes grant.
  scenario.user = { id: 'admin-1', email: 'boss@example.test', role: 'admin' }; scenario.deleted = [];
  res = await assetsRoute.DELETE(req('projects/proj-2/uuid-other.png'));
  assert.equal(res.status, 200); same(scenario.deleted, ['projects/proj-2/uuid-other.png']);

  // An admin by the ADMIN_EMAILS list likewise.
  scenario.adminEmails = ['listed@example.test'];
  scenario.user = { id: 'admin-2', email: 'Listed@Example.test', role: 'user' }; scenario.deleted = [];
  res = await assetsRoute.DELETE(req('projects/proj-2/uuid-other.png'));
  assert.equal(res.status, 200); assert.equal(scenario.deleted.length, 1);
  scenario.adminEmails = [];

  // A project that does not exist: 404 even for a signed-in user.
  scenario.user = { id: 'user-owner', email: 'owner@example.test', role: 'user' }; scenario.deleted = [];
  res = await assetsRoute.DELETE(req('projects/proj-gone/uuid-file.png'));
  assert.equal(res.status, 404); assert.equal(scenario.deleted.length, 0);

  // No database configured: fail closed with the codebase's 503 shape.
  scenario.db = null; scenario.deleted = [];
  res = await assetsRoute.DELETE(req(KEY));
  assert.equal(res.status, 503); assert.equal(res.body.error, 'DATABASE_URL is not configured.');
  assert.equal(scenario.deleted.length, 0);

  // Malformed keys keep the route's original 400, before any auth work.
  scenario.user = null; scenario.db = fakeDb(PROJECTS);
  res = await assetsRoute.DELETE(req('not-a-project-key'));
  assert.equal(res.status, 400); assert.equal(res.body.error, 'Invalid asset key.');

  /* ---------------------------------------------------------------- */
  /* Fix 2 — publish scrub, draft preservation, room-creation restore */
  /* ---------------------------------------------------------------- */
  const { scrubTriviaBoardForPublish } = load('lib/quiz.ts');
  const { restoreTriviaBoardAnswers, quizConfigFromSnapshot } = load('lib/quiz-board.ts');

  const categories = [
    { name: 'General', questions: [
      { value: 100, question: 'Largest planet?', answer: 'Jupiter', used: false },
      { value: 200, question: 'How many continents?', answer: 'Seven', used: false },
      { value: 300, prompt: 'Berlin Wall fell when?', answer: '1989', source: 'History', sourceUrl: 'https://example.test/wall' },
    ] },
    { name: 'Movies', questions: [
      { value: 100, question: 'King of Pop?', answer: 'Michael Jackson', used: false },
      { value: 200, question: 'Forrest Gump star?', answer: 'Tom Hanks', used: false },
      { value: 300, question: 'Titanic song?', answer: 'My Heart Will Go On', used: false },
    ] },
  ];
  const draftBefore = JSON.parse(JSON.stringify(categories));
  const scrubbed = scrubTriviaBoardForPublish(categories);

  // No answer survives anywhere in the scrubbed (published) payload…
  const scrubbedJson = JSON.stringify(scrubbed);
  for (const secret of ['Jupiter', 'Seven', '1989', 'Michael Jackson', 'Tom Hanks', 'My Heart Will Go On']) {
    assert(!scrubbedJson.includes(secret), `published payload must not contain the answer "${secret}"`);
  }
  for (const category of scrubbed) for (const q of category.questions) assert(!('answer' in q), 'no answer key on any published question');
  // …while everything the board renders stays: names, questions, values, sources.
  assert.equal(scrubbed[0].name, 'General');
  assert.equal(scrubbed[0].questions[0].question, 'Largest planet?');
  assert.equal(scrubbed[0].questions[0].value, 100);
  assert.equal(scrubbed[0].questions[2].source, 'History');
  // The draft (input) is never mutated by the scrub — the host keeps full answers.
  same(categories, draftBefore, 'scrub must not mutate the draft categories');
  assert.equal(categories[0].questions[0].answer, 'Jupiter');
  // Malformed shapes pass through untouched, mirroring the quiz scrub's contract.
  assert.equal(scrubTriviaBoardForPublish(undefined), undefined);
  assert.equal(scrubTriviaBoardForPublish('nope'), 'nope');
  same(scrubTriviaBoardForPublish([{ name: 'NoQuestions' }]), [{ name: 'NoQuestions' }]);

  // A scrubbed board alone can no longer build a Quiz Board room…
  const boardTool = cats => ({ id: 'board-1', type: 'trivia-board', name: 'Board', enabled: true, config: { categories: cats } });
  const scrubbedSnapshot = { name: 'Quiz Night', theme: 'purple', gameTools: [boardTool(scrubbed)] };
  assert('error' in quizConfigFromSnapshot(scrubbedSnapshot), 'scrubbed snapshot alone must not yield a playable quiz');
  // …but restoring the answers from the draft on the server makes the room
  // play exactly the published board, answers included.
  const draftProject = { gameTools: [boardTool(draftBefore)] };
  const restored = restoreTriviaBoardAnswers(scrubbedSnapshot, draftProject);
  const quizConfig = quizConfigFromSnapshot(restored);
  assert(!('error' in quizConfig), 'restored snapshot must build the quiz config');
  const allAnswers = quizConfig.config.categories.flatMap(c => c.questions.map(q => q.answer)).sort();
  same(allAnswers, ['1989', 'Jupiter', 'Michael Jackson', 'My Heart Will Go On', 'Seven', 'Tom Hanks'].sort(), 'room config carries every answer');
  // The restore works on a copy: the stored snapshot stays scrubbed and the draft is untouched.
  assert(!JSON.stringify(scrubbedSnapshot).includes('Jupiter'), 'restore must not un-scrub the stored snapshot');
  same(draftProject.gameTools[0].config.categories, draftBefore, 'restore must not mutate the draft');

  /* ---------------------------------------------------------------- */
  /* Fix 2 — the wiring: publish loop, live reveal path, overlay merge */
  /* ---------------------------------------------------------------- */
  const projectsRoute = fs.readFileSync('app/api/projects/route.ts', 'utf8');
  assert(projectsRoute.includes('scrubTriviaBoardForPublish'), 'projects route imports the trivia-board scrub');
  assert(/t\?\.type === "trivia-board"[\s\S]{0,240}scrubTriviaBoardForPublish\(t\.config\.categories\)/.test(projectsRoute),
    'the published snapshot loop scrubs trivia-board categories beside the quiz scrub');

  const liveRoute = fs.readFileSync('app/api/live/[slug]/route.ts', 'utf8');
  assert(!liveRoute.includes('answer: question.answer'), 'the live trivia payload must not copy the snapshot answer');
  assert(liveRoute.includes('payload.answer = await triviaBoardAnswer('), 'the reveal event reads its answer from the draft server-side');
  assert(/if \(action === "answer"\) \{\s*\/\/[\s\S]{0,400}payload\.answer = await triviaBoardAnswer/.test(liveRoute),
    'the answer is attached only for the reveal (answer) action');
  assert(/async function triviaBoardAnswer[\s\S]{0,400}SELECT data FROM projects WHERE id =/.test(liveRoute),
    'triviaBoardAnswer follows the City Crime Scene draft-read pattern');

  const overlayPage = fs.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
  assert(overlayPage.includes('current ? { ...current, ...payload } : payload'),
    'the overlay merges the reveal event into the on-screen question so the answer renders');

  const shareRoute = fs.readFileSync('app/api/projects/[id]/game-room/route.ts', 'utf8');
  assert(shareRoute.includes('restoreTriviaBoardAnswers(storedSnapshot, project)'),
    'Game Night room creation restores board answers from the draft on the server');

  console.log('PASS: asset DELETE requires the owning creator (or an admin) and fails closed otherwise; trivia-board answers are scrubbed from the published snapshot while the draft keeps them, the live reveal reads the answer from the draft only at reveal time, and Game Night room creation restores answers server-side.');
})().catch(error => { console.error(error); process.exitCode = 1; });
