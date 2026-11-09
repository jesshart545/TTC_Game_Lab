const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// Multi-part coverage (owner ruling, 2026-11-09): Jewel must account for
// EVERY part of a request out loud. Live evidence after PR #166: asked
// for a game sequence AND a scoreboard in one message, Jewel built the
// scoreboard and replied as if the job were done — the sequence was
// never built and never mentioned. These tests drive the real
// /api/jewel route with a stubbed model: a response carrying build work
// that silently drops a detectable part (sequence / scoreboard) spends
// the route's one validation retry with coverage feedback; if the retry
// still leaves the part silent, the valid work is returned with a plain
// line appended naming the missing part. A response that names the
// missing part does not retry; single-part, clarification, and media
// flows are untouched.
const root = path.resolve(__dirname, '..');
function loadModule(file, sandbox, stubs) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Buffer, URL, AbortSignal, console, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto,
    process: sandbox.process, fetch: sandbox.fetch,
    require(name) {
      if (stubs && name in stubs) return stubs[name];
      if (name.startsWith('../../../lib/')) return load(path.join(root, name.replace(/^\.\.\/\.\.\/\.\.\//, '') + '.ts'));
      if (name.startsWith('.')) return loadModule(path.resolve(path.dirname(file), name + '.ts'), sandbox, stubs);
      return require(name);
    },
  });
  return exports;
}

const fixture = {
  id: 'project-1', assets: [], compositions: [], overlay: {}, assetPools: [],
  controls: [
    { id: 'start', label: 'Start Answer Timer', action: 'tool.answer-timer', toolIds: ['answer-timer'] },
    { id: 'hide', label: 'Hide Answer Timer', action: 'result.hide.start' },
  ],
  gameTools: [{ id: 'answer-timer', name: 'Answer Timer', type: 'countdown', enabled: true, inToolbox: true, inOverlayBuild: true, config: { seconds: 30, triggerOnly: true, appearance: { backgroundColor: '#352768', textColor: '#fff2d6', accentColor: '#57c1d6' } } }],
};
const TWO_PART_REQUEST = 'Please build me a game sequence that shows a question, waits a few seconds, then reveals the answer — and also add a floating scoreboard for two teams.';
const scoreboardTool = { type: 'scoreboard', name: 'Scoreboard', config: { entries: [{ id: 'team-1', name: 'Team 1', score: 0 }, { id: 'team-2', name: 'Team 2', score: 0 }] }, connect: true };
const scoreboardOnly = (reply) => ({ reply, changes: { newTools: [scoreboardTool] }, manualSteps: [], needsClarification: false, outcome: 'edit', action: null });
const bothParts = (reply) => ({
  reply,
  changes: {
    sequences: [{ name: 'Question Flow', sequenceMode: 'all', steps: [{ controlId: 'start', delaySeconds: 0 }, { controlId: 'hide', delaySeconds: 5 }] }],
    newTools: [scoreboardTool],
  },
  manualSteps: [], needsClarification: false, outcome: 'edit', action: null,
});
// The exact reply from the live failure: scoreboard announced, sequence
// never mentioned.
const LIVE_DROP_REPLY = 'Scoreboard is saved in Imagine and Create. Customize its entries and appearance, then add it in Set the Stage.';

(async () => {
  const calls = [];
  let queue = [];
  const sandbox = {
    process: { env: { META_API_KEY: 'test-key' } },
    fetch: async (url, options) => {
      calls.push({ url: String(url), body: String(options?.body || '') });
      const next = queue.shift();
      if (!next) throw new Error('Model was called more times than expected.');
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(next) } }] }) };
    },
  };
  const client = loadModule(path.join(root, 'lib/muse-client.ts'), sandbox, {});
  const provider = loadModule(path.join(root, 'lib/assistant-provider.ts'), sandbox, {});
  const stubs = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '../../../lib/auth/server': { requireCreator: async () => ({ email: 'creator@example.com' }) },
    '../../../lib/admin-alerts': {
      isCreditError: (status, message) => status === 402 || /insufficient credit|not enough credit|credit balance|out of credit|exceeded.*quota|quota.*exceeded|billing|payment required/i.test(String(message || '')),
      notifyAdminOfCreditIssue: async () => {},
    },
    '../../../lib/muse-client': client,
    '../../../lib/assistant-provider': provider,
  };
  const route = loadModule(path.join(root, 'app/api/jewel/route.ts'), sandbox, stubs);
  const post = async (request) => {
    const response = await route.POST(new Request('https://test/api/jewel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'draft-edit', request, history: [], project: fixture }) }));
    return { response, data: await response.json() };
  };
  const run = async (request, responses) => { calls.length = 0; queue = [...responses]; return post(request); };

  // 1. The live failure shape: a two-part ask answered with only the
  // scoreboard, the sequence never mentioned. The route spends its one
  // retry with coverage feedback naming the sequence, and the retried
  // response that builds both parts is what the creator gets.
  {
    const { response, data } = await run(TWO_PART_REQUEST, [
      scoreboardOnly(LIVE_DROP_REPLY),
      bothParts('Both parts are ready: the game sequence is set up, and the scoreboard is saved in Imagine and Create.'),
    ]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2, 'a silently dropped part spends the one retry');
    assert(calls[1].body.includes('neither built nor mentioned the game sequence'), 'the retry feedback names the dropped part');
    assert.equal(data.changes.sequences.length, 1, 'the retried response includes the sequence');
    assert.equal(data.changes.newTools.length, 1, 'the scoreboard survives the retry');
    console.log('PASS: a two-part response that silently drops the sequence spends the one retry with feedback naming the part, and the covered response is returned.');
  }

  // 2. A response that names the unbuilt part plainly is already
  // accounting for it: no retry, reply passes through untouched.
  {
    const ackReply = 'The scoreboard is saved in Imagine and Create. I have not built the game sequence yet — ask me and I will build it next.';
    const { response, data } = await run(TWO_PART_REQUEST, [scoreboardOnly(ackReply)]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1, 'an acknowledged omission does not retry');
    assert.equal(data.reply, ackReply);
    assert.equal(data.changes.newTools.length, 1);
    console.log('PASS: a response that plainly names the unbuilt sequence does not retry.');
  }

  // 3. Both parts built on the first pass: no retry, both returned.
  {
    const { response, data } = await run(TWO_PART_REQUEST, [bothParts('Both parts are ready: the game sequence is set up, and the scoreboard is saved in Imagine and Create.')]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1, 'a fully covered response does not retry');
    assert.equal(data.changes.sequences.length, 1);
    assert.equal(data.changes.newTools.length, 1);
    console.log('PASS: a two-part response that builds both parts does not retry.');
  }

  // 4. The retry still drops the sequence silently: the valid scoreboard
  // work is returned (not a failure), with a plain line appended naming
  // the part that is not built.
  {
    const { response, data } = await run(TWO_PART_REQUEST, [
      scoreboardOnly(LIVE_DROP_REPLY),
      scoreboardOnly('The scoreboard is ready in Imagine and Create.'),
    ]);
    assert.equal(response.status, 200, 'valid partial work is returned, not failed');
    assert.equal(calls.length, 2);
    assert.equal(data.changes.newTools.length, 1, 'the built scoreboard is kept');
    assert(!data.changes.sequences, 'no sequence was fabricated');
    assert(data.reply.includes("One part of your request isn't built yet: the game sequence."), 'the reply names the missing part in plain language');
    console.log('PASS: when the retry still drops the sequence, the valid work is returned with a plain line naming the unbuilt part.');
  }

  // 5. A single-part ask is untouched by the coverage check.
  {
    const { response, data } = await run('Add a floating scoreboard for two teams.', [scoreboardOnly(LIVE_DROP_REPLY)]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1, 'a single-part response does not retry');
    assert.equal(data.reply, LIVE_DROP_REPLY);
    console.log('PASS: a single-part scoreboard response is unchanged.');
  }

  // 6. A clarification answer to a two-part ask is untouched: asking
  // before building is not a silent drop.
  {
    const clarification = { reply: 'Quick question before I build: how long should the pause be before the answer is revealed?', changes: {}, manualSteps: [], needsClarification: true, outcome: 'clarification', action: null };
    const { response, data } = await run(TWO_PART_REQUEST, [clarification]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1, 'a clarification does not retry');
    assert.equal(data.needsClarification, true);
    console.log('PASS: a clarification response to a two-part ask is unchanged.');
  }

  // 7. A media action answering chain wording ("shows a question, waits,
  // then reveals") is a generation turn, not a draft build: untouched.
  {
    const video = { reply: 'I will create that video.', changes: {}, manualSteps: [], needsClarification: false, outcome: 'action', action: { type: 'video', prompt: 'A trivia question card appears on a game show stage, pauses, then flips to reveal the answer.', sourceKey: null, durationSeconds: 5 } };
    const { response, data } = await run('Make me a short video that shows a question, waits a few seconds, then reveals the answer.', [video]);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1, 'a media action does not retry');
    assert.equal(data.action?.type, 'video');
    console.log('PASS: a media action answering chain wording is unchanged.');
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
