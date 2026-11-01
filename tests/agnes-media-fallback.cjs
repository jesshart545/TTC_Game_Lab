const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real route/lib modules in a vm, in the style of
// tests/hf-space-fallback.cjs, with an injectable fetch and env.
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Buffer, URL, AbortSignal, AbortController, setTimeout, clearTimeout, console: mocks.console || console, Blob,
    process: { env: mocks.env || { FAL_KEY: 'test-fal', AGNES_API_KEY: 'test-agnes' } },
    require(name) {
      if (mocks.modules && Object.prototype.hasOwnProperty.call(mocks.modules, name)) return mocks.modules[name];
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'), mocks);
      return require(name);
    },
    fetch: mocks.fetch,
  });
  return exports;
}

// A counting stand-in for lib/admin-alerts with the real isCreditError
// semantics, so tests can prove the alert fires exactly once — or never.
function alertMock(alerts) {
  return {
    isCreditError: (status, message) => status === 402
      || /insufficient credit|not enough credit|credit balance|out of credit|exceeded.*quota|quota.*exceeded|billing|payment required/i.test(String(message || '')),
    notifyAdminOfCreditIssue: async (source, detail) => { alerts.push({ source, detail }); },
  };
}

function loadRoute(alerts, fetch, env) {
  return load('app/api/generate-asset/route.ts', {
    env: env || { FAL_KEY: 'test-fal', AGNES_API_KEY: 'test-agnes', RUNWAYML_API_SECRET: 'test-runway' },
    fetch,
    modules: { '../../../lib/admin-alerts': alertMock(alerts) },
  });
}

function post(route, body) {
  return route.POST(new Request('https://test/api/generate-asset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

const AGNES_IMAGE_URL = 'https://apihub.agnes-ai.com/v1/images/generations';
const AGNES_VIDEO_URL = 'https://apihub.agnes-ai.com/v1/videos';
const AGNES_RESULT_URL = 'https://media.agnes-ai.com/generated/neon-stage.png';

test('image falls back to Agnes when fal reports the account locked, and image-status completes the job', async () => {
  const alerts = [];
  const calls = [];
  const route = loadRoute(alerts, async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
    }
    if (String(url) === AGNES_IMAGE_URL) {
      return Response.json({ created: 1, data: [{ url: AGNES_RESULT_URL, b64_json: null, revised_prompt: null }] });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
  const response = await post(route, { type: 'image', prompt: 'A neon stage sign', aspectRatio: '16:9' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.type, 'image');
  assert.equal(data.status, 'processing');
  assert.equal(data.provider, 'agnes');
  assert.equal(data.model, 'agnes-image-2.5-flash');
  // The request id carries the finished result back to image-status.
  assert.equal(Buffer.from(data.requestId, 'base64url').toString('utf8'), AGNES_RESULT_URL);

  const agnes = calls.find(call => call.url === AGNES_IMAGE_URL);
  assert.ok(agnes, 'Agnes image generation was called');
  assert.equal(agnes.options.headers.Authorization, 'Bearer test-agnes');
  const body = JSON.parse(agnes.options.body);
  assert.equal(body.model, 'agnes-image-2.5-flash');
  assert.equal(body.prompt, 'A neon stage sign');
  assert.equal(body.size, '2K'); // the site's fal default resolution, same tier on Agnes
  assert.equal(body.ratio, '16:9');
  assert.deepEqual(body.extra_body, { response_format: 'url' });
  assert.equal(body.image, undefined); // no reference image in this request

  assert.equal(alerts.length, 1, 'the fal lock alerts the admin exactly once');
  assert.equal(alerts[0].source, 'generate-asset/image');

  // The client poll completes through the image-status route's Agnes branch.
  const status = load('app/api/generate-asset/image-status/route.ts', {
    fetch: async () => { throw new Error('image-status must not call fal for an Agnes job'); },
  });
  const polled = await status.GET(new Request(`https://test/api/generate-asset/image-status?id=${encodeURIComponent(data.requestId)}&statusUrl=&responseUrl=&model=${encodeURIComponent('agnes-image-2.5-flash')}`));
  assert.equal(polled.status, 200);
  assert.deepEqual(await polled.json(), { status: 'completed', url: AGNES_RESULT_URL });

  const garbage = await status.GET(new Request('https://test/api/generate-asset/image-status?id=not-a-result&model=agnes-image-2.5-flash'));
  assert.equal(garbage.status, 400);
});

test('image fallback maps the reference image, resolution tier, and ratio onto Agnes', async () => {
  const alerts = [];
  let agnesBody;
  const route = loadRoute(alerts, async (url, options) => {
    if (String(url).startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'Insufficient credits' }, { status: 402 });
    }
    if (String(url) === AGNES_IMAGE_URL) {
      agnesBody = JSON.parse(options.body);
      return Response.json({ data: [{ url: AGNES_RESULT_URL }] });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
  const response = await post(route, {
    type: 'image', prompt: 'Restyle this stage', promptImage: 'https://example.com/ref.png',
    resolution: '1K', aspectRatio: '9:16',
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'agnes');
  assert.deepEqual(agnesBody.image, ['https://example.com/ref.png']);
  assert.equal(agnesBody.size, '1K');
  assert.equal(agnesBody.ratio, '9:16');
  assert.equal(alerts.length, 1);
});

test('image uses fal when fal succeeds and never touches Agnes', async () => {
  const alerts = [];
  const calls = [];
  const route = loadRoute(alerts, async (url) => {
    calls.push(String(url));
    return Response.json({
      request_id: 'img-job',
      status_url: 'https://queue.fal.run/fal-ai/nano-banana-2/requests/img-job/status',
      response_url: 'https://queue.fal.run/fal-ai/nano-banana-2/requests/img-job',
    });
  });
  const response = await post(route, { type: 'image', prompt: 'A neon stage sign' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'fal');
  assert.equal(data.model, 'fal-ai/nano-banana-2');
  assert.equal(data.requestId, 'img-job');
  assert.equal(calls.some(url => url.includes('apihub.agnes-ai.com')), false);
  assert.equal(alerts.length, 0);
});

test('image input errors from fal do not fall back', async () => {
  const alerts = [];
  const calls = [];
  const route = loadRoute(alerts, async (url) => {
    calls.push(String(url));
    return Response.json({ detail: 'prompt: value is not valid' }, { status: 422 });
  });
  const response = await post(route, { type: 'image', prompt: 'A neon stage sign' });
  assert.equal(response.status, 422);
  const data = await response.json();
  assert.match(data.error, /prompt/);
  assert.equal(calls.some(url => url.includes('apihub.agnes-ai.com')), false);
  assert.equal(alerts.length, 0);
});

test('image falls back to Agnes on a fal connection failure', async () => {
  const alerts = [];
  const route = loadRoute(alerts, async (url) => {
    if (String(url).startsWith('https://queue.fal.run/')) throw new Error('socket hang up');
    if (String(url) === AGNES_IMAGE_URL) return Response.json({ data: [{ url: AGNES_RESULT_URL }] });
    throw new Error(`Unexpected fetch ${url}`);
  });
  const response = await post(route, { type: 'image', prompt: 'A neon stage sign' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'agnes');
  assert.equal(alerts.length, 0, 'a connection failure is not a billing event');
});

test('image Base64 results from Agnes return directly and store classified as an image', async () => {
  const alerts = [];
  const route = loadRoute(alerts, async (url) => {
    if (String(url).startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
    }
    if (String(url) === AGNES_IMAGE_URL) {
      return Response.json({ data: [{ url: null, b64_json: 'aGVsbG8=' }] });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
  const response = await post(route, { type: 'image', prompt: 'A neon stage sign' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'agnes');
  assert.equal(data.model, 'agnes-image-2.5-flash');
  assert.equal(data.url, 'data:image/png;base64,aGVsbG8=');
  assert.equal(data.requestId, undefined, 'a synchronous result has no job to poll');

  // The client stores the data URI through storeGeneratedAsset's generic
  // branch; a browser fetch of a data:image/png URI yields an image/png
  // blob, which is what must reach storage and the library classification.
  const storeFetch = async (url, options = {}) => {
    const target = String(url);
    if (target === data.url) return { ok: true, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) };
    if (target === '/api/assets') {
      const body = JSON.parse(options.body);
      return Response.json({ uploadUrl: 'https://storage.test/put', storageKey: 'projects/p1/stored', name: body.name, url: 'https://storage.test/get' });
    }
    if (target === 'https://storage.test/put') return { ok: true };
    throw new Error(`Unexpected fetch ${target}`);
  };
  const store = load('lib/asset-store.ts', { fetch: storeFetch, modules: { './project': {} } });
  const stored = await store.storeGeneratedAsset('p1', { name: 'A neon stage sign — Image', type: data.model, url: data.url });
  assert.equal(stored.type, 'image/png');
  const folders = load('lib/asset-folders.ts', { fetch: storeFetch });
  const board = load('lib/board-design.ts', { fetch: storeFetch });
  const asSaved = { ...stored, generation: { type: 'image' } };
  assert.equal(board.mediaKind(asSaved), 'image');
  assert.equal(folders.assetCategory(asSaved), 'image');
});

test('an Agnes image URL result stores classified as an image even when served as octet-stream', async () => {
  // Same repair as the Kokoro voice fix (PR #118): a generated download
  // served with a generic type is re-typed from the URL's extension
  // before upload, so it files under Images, not Other files.
  const storeFetch = async (url, options = {}) => {
    const target = String(url);
    if (target === AGNES_RESULT_URL) return { ok: true, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'application/octet-stream' }) };
    if (target === '/api/assets') {
      const body = JSON.parse(options.body);
      return Response.json({ uploadUrl: 'https://storage.test/put', storageKey: 'projects/p1/stored', name: body.name, url: 'https://storage.test/get' });
    }
    if (target === 'https://storage.test/put') return { ok: true };
    throw new Error(`Unexpected fetch ${target}`);
  };
  const store = load('lib/asset-store.ts', { fetch: storeFetch, modules: { './project': {} } });
  const stored = await store.storeGeneratedAsset('p1', { name: 'A neon stage sign — Image', type: 'agnes-image-2.5-flash', url: AGNES_RESULT_URL });
  assert.equal(stored.type, 'image/png');
  const folders = load('lib/asset-folders.ts', { fetch: storeFetch });
  const board = load('lib/board-design.ts', { fetch: storeFetch });
  const asSaved = { ...stored, generation: { type: 'image' } };
  assert.equal(board.mediaKind(asSaved), 'image');
  assert.equal(folders.assetCategory(asSaved), 'image');
});

test('video chain: Runway credit failure, then fal lock, then Agnes Flash serves the request', async () => {
  const alerts = [];
  const calls = [];
  let agnesBody;
  const route = loadRoute(alerts, async (url, options) => {
    const target = String(url);
    calls.push(target);
    if (target.startsWith('https://api.dev.runwayml.com/')) {
      return Response.json({ error: { message: 'You do not have enough credits' } }, { status: 402 });
    }
    if (target.startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
    }
    if (target === AGNES_VIDEO_URL) {
      agnesBody = JSON.parse(options.body);
      return Response.json({ id: 'task-1', task_id: 'task-1', video_id: 'vid-123', status: 'queued' });
    }
    throw new Error(`Unexpected fetch ${target}`);
  });
  const response = await post(route, { type: 'video', prompt: 'Neon dragons over a game stage', durationSeconds: 8 });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.type, 'video');
  assert.equal(data.status, 'processing');
  assert.equal(data.provider, 'agnes');
  assert.equal(data.videoId, 'vid-123');
  assert.equal(data.model, 'agnes-video-2.5-flash'); // the Flash model — never the paid non-Flash
  assert.equal(data.durationSeconds, 8);

  assert.equal(calls[0].startsWith('https://api.dev.runwayml.com/'), true, 'Runway is tried first');
  assert.equal(calls[1].startsWith('https://queue.fal.run/'), true, 'fal is tried second');
  assert.equal(calls[2], AGNES_VIDEO_URL, 'Agnes is the final rung');
  assert.equal(agnesBody.model, 'agnes-video-2.5-flash');
  assert.equal(agnesBody.mode, 'text');
  assert.equal(agnesBody.seconds, '8');
  assert.equal(agnesBody.size, '720P'); // Flash supports only 720P
  assert.equal(agnesBody.aspect_ratio, '16:9');
  assert.equal(agnesBody.first_frame, undefined);
  assert.equal(alerts.length, 1, 'only the fal billing failure alerts, exactly once');
  assert.equal(alerts[0].source, 'generate-asset/video');
});

test('video fal-first failure engages Agnes keyframe with the duration clamped to 12 seconds', async () => {
  const alerts = [];
  const calls = [];
  let agnesBody;
  const route = loadRoute(alerts, async (url, options) => {
    const target = String(url);
    calls.push(target);
    if (target.startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'Internal error' }, { status: 500 });
    }
    if (target === AGNES_VIDEO_URL) {
      agnesBody = JSON.parse(options.body);
      return Response.json({ video_id: 'vid-124', status: 'queued' });
    }
    throw new Error(`Unexpected fetch ${target}`);
  });
  const response = await post(route, {
    type: 'video', prompt: 'Animate this stage', promptImage: 'https://example.com/frame.png', durationSeconds: 20,
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'agnes');
  assert.equal(data.model, 'agnes-video-2.5-flash');
  assert.equal(data.durationSeconds, 12, 'the clamped duration is what the response reports');
  assert.equal(calls.some(url => url.includes('runwayml')), false, 'reference/longer requests still go to fal first');
  assert.equal(agnesBody.mode, 'keyframe');
  assert.equal(agnesBody.first_frame, 'https://example.com/frame.png');
  assert.equal(agnesBody.seconds, '12');
  assert.equal(alerts.length, 0, 'a plain 5xx is not a billing event');
});

test('video fal connection failure engages Agnes', async () => {
  const alerts = [];
  const route = loadRoute(alerts, async (url) => {
    const target = String(url);
    if (target.startsWith('https://queue.fal.run/')) throw new Error('socket hang up');
    if (target === AGNES_VIDEO_URL) return Response.json({ video_id: 'vid-125', status: 'queued' });
    throw new Error(`Unexpected fetch ${target}`);
  });
  const response = await post(route, {
    type: 'video', prompt: 'Animate this stage', promptImage: 'https://example.com/frame.png', durationSeconds: 6,
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'agnes');
  assert.equal(data.videoId, 'vid-125');
  assert.equal(alerts.length, 0);
});

test('video uses Runway when Runway succeeds and never touches fal or Agnes', async () => {
  const alerts = [];
  const calls = [];
  const route = loadRoute(alerts, async (url) => {
    calls.push(String(url));
    return Response.json({ id: 'runway-task-1', status: 'PENDING' });
  });
  const response = await post(route, { type: 'video', prompt: 'Neon dragons over a game stage', durationSeconds: 8 });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'runway');
  assert.equal(data.videoId, 'runway-task-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].startsWith('https://api.dev.runwayml.com/'), true);
  assert.equal(alerts.length, 0);
});

test('video input errors from fal do not fall back', async () => {
  const alerts = [];
  const calls = [];
  const route = loadRoute(alerts, async (url) => {
    calls.push(String(url));
    return Response.json({ detail: 'prompt: invalid value' }, { status: 400 });
  });
  const response = await post(route, {
    type: 'video', prompt: 'Animate this stage', promptImage: 'https://example.com/frame.png', durationSeconds: 6,
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /invalid value/);
  assert.equal(calls.some(url => url.includes('apihub.agnes-ai.com')), false);
  assert.equal(alerts.length, 0);
});

test('video surfaces the fal billing failure unchanged when Agnes cannot take the request either', async () => {
  const alerts = [];
  const route = loadRoute(alerts, async (url) => {
    const target = String(url);
    if (target.startsWith('https://api.dev.runwayml.com/')) {
      return Response.json({ error: { message: 'You do not have enough credits' } }, { status: 402 });
    }
    if (target.startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
    }
    if (target === AGNES_VIDEO_URL) return Response.json({ error: { message: 'Service unavailable' } }, { status: 503 });
    throw new Error(`Unexpected fetch ${target}`);
  });
  const response = await post(route, { type: 'video', prompt: 'Neon dragons over a game stage', durationSeconds: 8 });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.error, 'Video generation is temporarily unavailable. The site administrator has been notified.');
  assert.equal(alerts.length, 1, 'the admin is still alerted exactly once');
});

test('video with a non-HTTPS reference never silently drops it for Agnes', async () => {
  // Agnes keyframe mode needs a publicly reachable first frame; a data
  // URI reference cannot be fetched by Agnes, so the fal failure must
  // surface rather than a different, reference-less video being made.
  const alerts = [];
  const calls = [];
  const route = loadRoute(alerts, async (url) => {
    calls.push(String(url));
    return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
  });
  const response = await post(route, {
    type: 'video', prompt: 'Animate this stage', promptImage: 'data:image/png;base64,aGVsbG8=', durationSeconds: 6,
  });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.error, 'Video generation is temporarily unavailable. The site administrator has been notified.');
  assert.equal(calls.some(url => url.includes('apihub.agnes-ai.com')), false);
  assert.equal(alerts.length, 1);
});

test('the generate-asset route carries a maxDuration ceiling above the synchronous fallback waits', async () => {
  // Diagnosis of the live image failure: generateAgnesImage waits
  // synchronously for up to its 150s abort bound, but this route exported
  // no maxDuration, so the platform default killed the function mid-wait
  // and the browser fetch died with no response ("Failed to fetch"). The
  // ceiling must cover the wait; both clients allow the POST 180s, which
  // is itself above the 150s worst-case Agnes wait.
  const route = loadRoute([], async () => { throw new Error('no fetch expected'); });
  assert.equal(route.maxDuration, 300);
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert.match(page, /AbortSignal\.timeout\(type === "video" \? 60000 : 180000\)/);
  const ccs = fs.readFileSync('lib/city-crime-scene-media.ts', 'utf8');
  assert.match(ccs, /AbortSignal\.timeout\(request\.kind === "video" \? 60000 : 180000\)/);
});

test('a refused Agnes video create is logged with its HTTP status and provider reason', async () => {
  // The rung used to swallow every failure, so a refused create (e.g. an
  // account not eligible for the Flash promotion) was invisible. The
  // client still sees only the fal failure, exactly as before, but the
  // server log now names the Agnes status and message.
  const alerts = [];
  const errorLines = [];
  const fakeConsole = { error: (...args) => errorLines.push(args.join(' ')), log() {}, warn() {} };
  const route = load('app/api/generate-asset/route.ts', {
    env: { FAL_KEY: 'test-fal', AGNES_API_KEY: 'test-agnes', RUNWAYML_API_SECRET: 'test-runway' },
    console: fakeConsole,
    fetch: async (url) => {
      const target = String(url);
      if (target.startsWith('https://queue.fal.run/')) {
        return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
      }
      if (target === AGNES_VIDEO_URL) {
        return Response.json({ error: { message: 'Video model is not available for this account.' } }, { status: 403 });
      }
      throw new Error(`Unexpected fetch ${target}`);
    },
    modules: { '../../../lib/admin-alerts': alertMock(alerts) },
  });
  const response = await post(route, { type: 'video', prompt: 'Golden confetti over a stage', durationSeconds: 15 });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.error, 'Video generation is temporarily unavailable. The site administrator has been notified.');
  assert.equal(alerts.length, 1);
  const logged = errorLines.join('\n');
  assert.match(logged, /\[agnes-video\] create refused \(HTTP 403\): Video model is not available for this account\./);
});

test('the status route logs Agnes poll refusals and failed tasks with their reasons', async () => {
  const errorLines = [];
  const fakeConsole = { error: (...args) => errorLines.push(args.join(' ')), log() {}, warn() {} };
  let poll = 0;
  const status = load('app/api/generate-asset/status/route.ts', {
    env: { AGNES_API_KEY: 'test-agnes' },
    console: fakeConsole,
    fetch: async (url) => {
      const target = String(url);
      assert.ok(target.startsWith('https://apihub.agnes-ai.com/agnesapi?'), `poll target ${target}`);
      poll += 1;
      if (poll === 1) return Response.json({ error: { message: 'Video ID does not exist' } }, { status: 404 });
      return Response.json({ id: 'task-9', status: 'failed', error: { message: 'generation failed upstream' } });
    },
  });
  const refused = await status.GET(new Request('https://test/api/generate-asset/status?id=vid-gone&model=agnes-video-2.5-flash&provider=agnes'));
  assert.equal(refused.status, 404);
  const failed = await status.GET(new Request('https://test/api/generate-asset/status?id=vid-999&model=agnes-video-2.5-flash&provider=agnes'));
  assert.equal(failed.status, 200);
  assert.equal((await failed.json()).status, 'failed');
  const logged = errorLines.join('\n');
  assert.match(logged, /\[agnes-video-status\] status request refused \(HTTP 404\) for video vid-gone: Video ID does not exist/);
  assert.match(logged, /\[agnes-video-status\] Agnes reported video vid-999 failed: generation failed upstream/);
});

test('video seam: a fallback submit flows through the real client poller and status route to the finished URL', async () => {
  // PR #119's tests mocked the pieces separately; this one proves the
  // seams fit end to end with the REAL client code and the REAL status
  // route: generate-asset submit response -> the exact status URL
  // lib/video-generation.ts builds from it -> the status route's Agnes
  // branch -> Agnes /agnesapi answers -> the finished video URL.
  const alerts = [];
  const RESULT_URL = 'https://media.agnes-ai.com/generated/confetti.mp4';
  const route = loadRoute(alerts, async (url, options) => {
    const target = String(url);
    if (target.startsWith('https://queue.fal.run/')) {
      return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
    }
    if (target === AGNES_VIDEO_URL) {
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'agnes-video-2.5-flash');
      assert.equal(body.mode, 'text');
      assert.equal(body.seconds, '12'); // the 15s request clamps to the Flash ceiling
      // The documented create response shape (wiki.agnes-ai.com Agnes
      // Video 2.5): id/task_id identify the task, video_id retrieves it.
      return Response.json({ id: 'task-9', task_id: 'task-9', video_id: 'vid-999', object: 'video', model: 'agnes-video-2.5-flash', status: 'queued', progress: 0, created_at: 1, seconds: '12', size: '720P' });
    }
    throw new Error(`Unexpected fetch ${target}`);
  });
  const response = await post(route, { type: 'video', prompt: 'Golden confetti falling over a concert stage', durationSeconds: 15 });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'agnes');
  assert.equal(data.videoId, 'vid-999');
  assert.equal(data.model, 'agnes-video-2.5-flash');
  assert.equal(data.durationSeconds, 12);
  assert.equal(alerts.length, 1);

  let agnesPolls = 0;
  const status = load('app/api/generate-asset/status/route.ts', {
    env: { AGNES_API_KEY: 'test-agnes' },
    fetch: async (url, options) => {
      const target = String(url);
      agnesPolls += 1;
      assert.equal(target, 'https://apihub.agnes-ai.com/agnesapi?video_id=vid-999&model_name=agnes-video-2.5-flash');
      assert.equal(options.headers.Authorization, 'Bearer test-agnes');
      if (agnesPolls === 1) return Response.json({ id: 'task-9', object: 'video', status: 'in_progress', progress: 40 });
      // The documented completed shape: the finished video is the
      // top-level `url` field.
      return Response.json({ id: 'task-9', object: 'video', status: 'completed', progress: 100, url: RESULT_URL, seconds: '12', size: '720P', error: null });
    },
  });

  const poller = load('lib/video-generation.ts', {});
  const pollUrls = [];
  const url = await poller.waitForGeneratedVideo(String(data.videoId), String(data.model), undefined, {
    sleep: async () => {},
    pollIntervalMs: 1,
    fetchImpl: async (pollUrl) => {
      pollUrls.push(pollUrl);
      return status.GET(new Request(`https://test${pollUrl}`));
    },
  });
  assert.equal(url, RESULT_URL);
  assert.deepEqual(pollUrls, [
    '/api/generate-asset/status?id=vid-999&model=agnes-video-2.5-flash&provider=agnes',
    '/api/generate-asset/status?id=vid-999&model=agnes-video-2.5-flash&provider=agnes',
  ]);
  assert.equal(agnesPolls, 2);
});
