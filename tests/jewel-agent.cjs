const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const repoLoad = require('./load.cjs');

const root = path.resolve(__dirname, '..');

// Loads lib/muse-client.ts, lib/assistant-provider.ts and
// app/api/jewel/route.ts in a shared sandbox so the route uses the REAL Muse
// client and the REAL fallback provider against a mocked fetch. Heavy pure
// libs are loaded through the repo's own tests/load.cjs; next/server, the
// creator auth, and admin-alerts are stubbed (admin-alerts with its exact
// credit pattern, recording notifications instead of touching the database).
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
      if (name.startsWith('../../../lib/')) return repoLoad(path.join(root, name.replace(/^\.\.\/\.\.\/\.\.\//, '') + '.ts'));
      if (name.startsWith('.')) return loadModule(path.resolve(path.dirname(file), name + '.ts'), sandbox, stubs);
      return require(name);
    },
  });
  return exports;
}

function makeStack({ env = {}, email = 'creator@example.com' } = {}) {
  const calls = [];
  const alerts = [];
  let handler = async () => { throw new Error('No Muse response was queued for this test.'); };
  const sandbox = {
    process: { env },
    fetch: async (url, options) => { calls.push({ url: String(url), options }); return handler(String(url), options); },
  };
  const client = loadModule(path.join(root, 'lib/muse-client.ts'), sandbox, {});
  const provider = loadModule(path.join(root, 'lib/assistant-provider.ts'), sandbox, {});
  const stubs = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '../../../lib/auth/server': { requireCreator: async () => ({ email }) },
    '../../../lib/admin-alerts': {
      isCreditError: (status, message) => status === 402 || /insufficient credit|not enough credit|credit balance|out of credit|exceeded.*quota|quota.*exceeded|billing|payment required/i.test(String(message || '')),
      notifyAdminOfCreditIssue: async (source, detail) => { alerts.push({ source, detail }); },
    },
    '../../../lib/muse-client': client,
    '../../../lib/assistant-provider': provider,
  };
  const route = loadModule(path.join(root, 'app/api/jewel/route.ts'), sandbox, stubs);
  return { client, provider, route, calls, alerts, respond(fn) { handler = fn; } };
}

const okMuse = (content) => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }) });
function queueMuse(responses) {
  const queue = [...responses];
  return async () => {
    const next = queue.shift();
    if (!next) throw new Error('Muse was called more times than expected.');
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof next === 'string' ? next : JSON.stringify(next) } }] }) };
  };
}
const post = (route, body) => route.POST(new Request('https://test/api/jewel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const project = { id: 'project-1', assets: [], controls: [], gameTools: [] };

const META_URL = 'https://api.meta.ai/v1/chat/completions';
const AGNES_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
// Routes the mocked fetch by provider URL so a test can fail Muse and serve
// the fallback (or the reverse) independently. A provider left undefined
// throws if it is called at all.
function byProvider({ muse, agnes }) {
  return async (url, options) => {
    if (url === META_URL) { if (!muse) throw new Error('Muse was called unexpectedly.'); return muse(url, options); }
    if (url === AGNES_URL) { if (!agnes) throw new Error('The fallback provider was called unexpectedly.'); return agnes(url, options); }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
}
const creditDown = async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'Insufficient credit balance for this account' } }) });
const answer = (reply) => ({ reply, changes: {}, manualSteps: [], needsClarification: false, outcome: 'answer', action: null });

test('POST with no Meta key returns 503 configured:false, and GET reports unconfigured', async () => {
  const { route } = makeStack({ env: {} });
  const getResponse = await route.GET();
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), { configured: false });
  const response = await post(route, { mode: 'draft-edit', request: 'Make a wheel', history: [], project });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.configured, false);
  assert.match(data.error, /META_API_KEY/);
});

test('muse-client targets the Meta API with the Standard model and types HTTP errors', async () => {
  const stack = makeStack({ env: { META_API_KEY: ' "test-key-123" ' } });
  assert.equal(stack.client.museConfigured(), true);
  stack.respond(okMuse('hello'));
  const content = await stack.client.museChatCompletion([{ role: 'user', content: 'hi' }], { jsonObject: true });
  assert.equal(content, 'hello');
  assert.equal(stack.calls.length, 1);
  assert.equal(stack.calls[0].url, 'https://api.meta.ai/v1/chat/completions');
  const sent = JSON.parse(stack.calls[0].options.body);
  assert.equal(sent.model, 'muse-wonder-1.0');
  assert.deepEqual(sent.response_format, { type: 'json_object' });
  assert.equal(stack.calls[0].options.headers.Authorization, 'Bearer test-key-123');
  stack.respond(async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'You do not have enough credits' } }) }));
  await assert.rejects(
    () => stack.client.museChatCompletion([{ role: 'user', content: 'hi' }]),
    (error) => error.name === 'MuseApiError' && error.status === 402 && /credits/.test(error.providerMessage),
  );
  const fallback = makeStack({ env: { MODEL_API_KEY: 'fallback-key' } });
  assert.equal(fallback.client.museConfigured(), true);
  const playgroundOnly = makeStack({ env: { META_PLAYGROUND: 'playground-key' } });
  assert.equal(playgroundOnly.client.museConfigured(), true);
  const playgroundFirst = makeStack({ env: { META_PLAYGROUND: 'playground-key', META_API_KEY: 'main-key', MODEL_API_KEY: 'fallback-key' } });
  playgroundFirst.respond(okMuse('hi'));
  await playgroundFirst.client.museChatCompletion([{ role: 'user', content: 'hi' }]);
  assert.equal(playgroundFirst.calls[0].options.headers.Authorization, 'Bearer playground-key');
});

test('a valid Muse draft-edit response flows through validation into the standard contract', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  stack.respond(okMuse({ reply: 'Love it — I will create that hero image for your stage.', changes: {}, manualSteps: [], needsClarification: false, action: { type: 'image', prompt: 'A neon game show stage with gold spotlights', sourceKey: null, voice: null, aspectRatio: '16:9' } }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Generate a hero image of a neon game show stage', history: [], project });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.configured, true);
  assert.equal(data.outcome, 'action');
  assert.equal(data.action.type, 'image');
  assert.equal(data.action.aspectRatio, '16:9');
  assert.match(data.reply, /hero image/);
  assert.deepEqual(data.changes, {});
  const sent = JSON.parse(stack.calls[0].options.body);
  assert.match(sent.messages[0].content, /You are Jewel/);
  const context = JSON.parse(sent.messages[1].content);
  assert.ok(context.executionGuide, 'draft context carries the execution guide like /api/ai');
  assert.equal(context.generationFeedback, undefined);
});

test('a City Crime Scene tool action from a non-entitled user is rejected like in /api/ai', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' }, email: 'someone@example.com' });
  const ccss = { reply: 'I will add a City Crime Scene game.', changes: {}, manualSteps: [], needsClarification: false, action: { type: 'tool', toolType: 'city-crime-scene', name: 'Mystery Night', config: {} } };
  stack.respond(queueMuse([ccss, ccss]));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Add a city crime scene mystery game', history: [], project });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.match(data.error, /City Crime Scene is only available to select accounts/);
  assert.equal(stack.calls.length, 2, 'initial call plus exactly one validation retry');
});

test('a generationFeedback turn returns the adjusted action Muse chose', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  stack.respond(okMuse({ reply: 'Video is having a moment, so I made you a still frame of the same scene instead — you can animate it or use it with motion treatment.', changes: {}, manualSteps: [], needsClarification: false, action: { type: 'image', prompt: 'A neon-lit still frame of a dancing cat mid-leap, wide shot', sourceKey: null, voice: null, aspectRatio: '16:9' } }));
  const response = await post(stack.route, {
    mode: 'draft-edit', request: 'The video generation you asked for failed. Decide the next step.', history: [], project,
    generationFeedback: { kind: 'video', prompt: 'A dancing cat in neon lights', error: 'Video generation failed.' },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.outcome, 'action');
  assert.equal(data.action.type, 'image');
  assert.match(data.action.prompt, /still frame/);
  const sent = JSON.parse(stack.calls[0].options.body);
  assert.match(sent.messages[0].content, /GENERATION FEEDBACK/);
  const context = JSON.parse(sent.messages[1].content);
  assert.equal(context.generationFeedback.kind, 'video');
  assert.equal(context.generationFeedback.prompt, 'A dancing cat in neon lights');
});

test('an identical resubmission of the failed generation is rejected, then the adjusted retry succeeds', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  const identical = { reply: 'Trying that video again.', changes: {}, manualSteps: [], needsClarification: false, action: { type: 'video', prompt: 'A dancing cat in neon lights', sourceKey: null, voice: null, durationSeconds: 5 } };
  const adjusted = { reply: 'Simplifying it instead.', changes: {}, manualSteps: [], needsClarification: false, action: { type: 'video', prompt: 'A cat dancing under neon lights, simple loop', sourceKey: null, voice: null, durationSeconds: 5 } };
  stack.respond(queueMuse([identical, adjusted]));
  const response = await post(stack.route, {
    mode: 'draft-edit', request: 'The video generation you asked for failed. Decide the next step.', history: [], project,
    generationFeedback: { kind: 'video', prompt: 'A dancing cat in neon lights', error: 'Video generation failed.' },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.action.type, 'video');
  assert.equal(data.action.prompt, 'A cat dancing under neon lights, simple loop');
  assert.equal(stack.calls.length, 2, 'identical answer triggered exactly one validation retry');
});

test('a Muse credit failure with no fallback configured alerts the admin and returns the generic unavailable response', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  stack.respond(async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'Insufficient credit balance for this account' } }) }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Make a wheel', history: [], project });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.error, 'The AI assistant is temporarily unavailable. The site administrator has been notified. No changes were made.');
  assert.equal(stack.alerts.length, 1);
  assert.equal(stack.alerts[0].source, 'jewel/muse');
});

test('a Muse credit failure falls back to the original AI chat, and the admin credit alert still fires once', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key', AGNES_API_KEY: 'agnes-key' } });
  stack.respond(byProvider({
    muse: creditDown,
    agnes: okMuse(answer('The fallback kept your streak going.')),
  }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Give me an encouraging line for my show open', history: [], project });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.configured, true);
  assert.equal(data.outcome, 'answer');
  assert.equal(data.reply, 'The fallback kept your streak going.');
  assert.deepEqual(data.changes, {});
  assert.equal(data.action, null);
  assert.equal(stack.alerts.length, 1, 'the credit alert fires once even though the fallback served the creator');
  assert.equal(stack.alerts[0].source, 'jewel/muse');
  const metaCall = stack.calls.find((call) => call.url === META_URL);
  const agnesCall = stack.calls.find((call) => call.url === AGNES_URL);
  assert.ok(metaCall && agnesCall, 'Muse was tried and the fallback was called');
  assert.ok(stack.calls.indexOf(metaCall) < stack.calls.indexOf(agnesCall), 'Muse first, fallback second');
  assert.equal(agnesCall.options.headers.Authorization, 'Bearer agnes-key');
  const sentToFallback = JSON.parse(agnesCall.options.body);
  assert.match(sentToFallback.messages[0].content, /You are Jewel/, 'the fallback receives the same Jewel system prompt');
  assert.equal(sentToFallback.model, 'agnes-2.5-flash');
  assert.deepEqual(sentToFallback.response_format, { type: 'json_object' });
});

test('with no Meta key configured, the original AI chat serves Jewel and GET reports configured', async () => {
  const stack = makeStack({ env: { AGNES_API_KEY: 'agnes-key' } });
  const getResponse = await stack.route.GET();
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), { configured: true });
  stack.respond(byProvider({ agnes: okMuse(answer('Served without Muse.')) }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Give me an encouraging line for my show open', history: [], project });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.reply, 'Served without Muse.');
  assert.equal(stack.calls.filter((call) => call.url === META_URL).length, 0, 'Muse is never called while unconfigured');
  assert.equal(stack.alerts.length, 0);
});

test('a Muse connection failure falls back to the original AI chat without an admin alert', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key', AGNES_API_KEY: 'agnes-key' } });
  stack.respond(byProvider({
    muse: async () => { throw new Error('socket hang up'); },
    agnes: okMuse(answer('Still here — the fallback answered.')),
  }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Give me an encouraging line for my show open', history: [], project });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.reply, 'Still here — the fallback answered.');
  assert.equal(stack.alerts.length, 0, 'connection failures never raised a credit alert');
});

test('when both providers fail on credit, the route keeps the unavailable response and alerts exactly once', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key', AGNES_API_KEY: 'agnes-key' } });
  stack.respond(byProvider({ muse: creditDown, agnes: creditDown }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Make a wheel', history: [], project });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.error, 'The AI assistant is temporarily unavailable. The site administrator has been notified. No changes were made.');
  assert.equal(stack.alerts.length, 1);
  assert.equal(stack.alerts[0].source, 'jewel/muse');
});

test('when Muse answers, the fallback provider is never called', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key', AGNES_API_KEY: 'agnes-key' } });
  stack.respond(byProvider({
    muse: okMuse(answer('Muse handled this one.')),
    agnes: okMuse(answer('The fallback must not answer.')),
  }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'Give me an encouraging line for my show open', history: [], project });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.reply, 'Muse handled this one.');
  assert.equal(stack.calls.filter((call) => call.url === AGNES_URL).length, 0, 'the fallback stays idle while Muse is healthy');
  assert.equal(stack.alerts.length, 0);
});

const layeredProject = { id: 'project-1', controls: [], gameTools: [], assets: [
  { name: 'Intro.mp4', type: 'video/mp4', storageKey: 'intro.mp4' },
  { name: 'Intro-edited.mp4', type: 'video/mp4', storageKey: 'intro-edited.mp4' },
] };
const editResultBody = (overrides = {}) => ({ mode: 'draft-edit', request: 'Step 1 of the video edit is finished and saved as "Intro-edited.mp4". Continue with the next step of my original request, or finish with a brief summary if every change is done.', history: [], project: layeredProject, selectedAssetKey: 'intro-edited.mp4', editResult: { sourceKey: 'intro.mp4', prompt: 'Make it black and white', resultKey: 'intro-edited.mp4', resultName: 'Intro-edited.mp4', layer: 1 }, ...overrides });

test("Jewel's prompt carries the layering and act-don't-just-talk guidance; the shared draft prompt is untouched", async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  stack.respond(okMuse({ reply: 'Try the Workshop tab.', changes: {}, manualSteps: [], needsClarification: false, outcome: 'answer', action: null }));
  const response = await post(stack.route, { mode: 'draft-edit', request: 'How do I add a logo?', history: [], project });
  assert.equal(response.status, 200);
  const system = JSON.parse(stack.calls[0].options.body).messages[0].content;
  assert.match(system, /VIDEO EDIT LAYERING/);
  assert.match(system, /At most 5 steps/, 'the five-layer cap is part of Jewel\'s instructions');
  assert.match(system, /Never send a plan without its first action/, 'a multi-change reply must pair its plan with the first layer\'s action');
  assert.match(system, /no commentary-only turns/i, 'mid-chain turns must carry the next action, not commentary alone');
  assert.match(system, /If you can act, act/);
  assert.match(system, /black and white, like an old film/, 'a single coherent change stays one layer');
  const jewelRoute = fs.readFileSync(path.join(root, 'app/api/jewel/route.ts'), 'utf8');
  const aiRoute = fs.readFileSync(path.join(root, 'app/api/ai/route.ts'), 'utf8');
  assert.doesNotMatch(aiRoute, /VIDEO EDIT LAYERING|editResult|JEWEL_LAYERING/, 'the shared /api/ai route must not gain Jewel\'s layering behavior');
  assert.match(jewelRoute, /JEWEL_EDIT_RESULT_ADDENDUM/);
  const draftSystemOf = (source) => source.slice(source.indexOf('const DRAFT_SYSTEM = `'), source.indexOf('`;', source.indexOf('const DRAFT_SYSTEM = `')) + 2);
  assert.equal(draftSystemOf(jewelRoute), draftSystemOf(aiRoute), 'DRAFT_SYSTEM stays byte-identical between the Jewel and AI routes');
});

test('an edit result turn returns the next layer against the newest saved video', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  stack.respond(okMuse({ reply: 'Now the title text.', changes: {}, manualSteps: [], needsClarification: false, outcome: 'action', action: { type: 'edit-video', sourceKey: 'intro-edited.mp4', prompt: 'Add the title text' } }));
  const response = await post(stack.route, editResultBody());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.action?.type, 'edit-video');
  assert.equal(data.action.sourceKey, 'intro-edited.mp4', 'the next layer targets the newest saved copy');
  assert.equal(data.action.prompt, 'Add the title text');
  const sent = JSON.parse(stack.calls[0].options.body);
  assert.match(sent.messages[0].content, /EDIT RESULT/, 'edit result turns get the continuation addendum');
  const context = JSON.parse(sent.messages[1].content);
  assert.equal(context.editResult.resultKey, 'intro-edited.mp4');
  assert.equal(context.editResult.layer, 1);
});

test('a byte-identical repeated layer is corrected once, then dropped instead of looping', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  const repeat = { reply: 'Applying that step.', changes: {}, manualSteps: [], needsClarification: false, outcome: 'action', action: { type: 'edit-video', sourceKey: 'intro.mp4', prompt: 'Make it black and white' } };
  stack.respond(queueMuse([repeat, repeat]));
  const response = await post(stack.route, editResultBody());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(stack.calls.length, 2, 'the first repeat is a validation error Muse gets one chance to correct');
  assert.equal(data.action, null, 'a second identical repeat is dropped so the chain ends instead of resubmitting forever');
  const retryMessages = JSON.parse(stack.calls[1].options.body).messages;
  assert.match(retryMessages[3].content, /Never resubmit the completed step/);
});

test('the fifth layer is the last: a further edit action is dropped at the cap', async () => {
  const stack = makeStack({ env: { META_API_KEY: 'test-key' } });
  stack.respond(okMuse({ reply: 'One more step.', changes: {}, manualSteps: [], needsClarification: false, outcome: 'action', action: { type: 'edit-video', sourceKey: 'intro-edited.mp4', prompt: 'Add a soft glow' } }));
  const response = await post(stack.route, editResultBody({ editResult: { sourceKey: 'intro.mp4', prompt: 'Make it black and white', resultKey: 'intro-edited.mp4', resultName: 'Intro-edited.mp4', layer: 5 } }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.action, null, 'no sixth layer may be issued for one request');
});
