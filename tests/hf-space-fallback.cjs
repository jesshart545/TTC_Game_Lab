const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real route/lib modules in a vm, in the style of
// tests/video-duration.cjs, with an injectable fetch and env.
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Buffer, URL, AbortSignal, AbortController, setTimeout, clearTimeout, console, Blob,
    process: { env: mocks.env || { FAL_KEY: 'test-fal' } },
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

function sseResponse(events) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// An SSE stream that emits its events and then hangs open, exactly like a
// still-running job's stream, until the caller's abort signal cuts it —
// the way a real fetch behaves when readSpaceQueue's budget expires.
function hangingSseFetch(events) {
  const encoder = new TextEncoder();
  return async (url, options) => new Response(new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      options?.signal?.addEventListener('abort', () => { try { controller.error(new Error('The operation was aborted.')); } catch { /* already closed */ } });
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const ACE_JOIN = 'https://ace-step-ace-step-v1-5.hf.space/gradio_api/queue/join';
const KOKORO_JOIN = 'https://hexgrad-kokoro-tts.hf.space/gradio_api/queue/join';
const KOKORO_DATA = 'https://hexgrad-kokoro-tts.hf.space/gradio_api/queue/data';

function post(route, body) {
  return route.POST(new Request('https://test/api/generate-asset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

test('music falls back to ACE-Step when fal reports the account locked, with mapped inputs', async () => {
  const calls = [];
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).startsWith('https://queue.fal.run/')) {
        return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
      }
      if (String(url) === ACE_JOIN) return Response.json({ event_id: 'evt-1' });
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  const response = await post(route, {
    type: 'music', prompt: 'Upbeat game-show song', durationSeconds: 25,
    lyrics: 'Welcome to the show\nWatch the prizes glow',
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.type, 'music');
  assert.equal(data.status, 'processing');
  assert.equal(data.provider, 'huggingface');
  assert.equal(data.model, 'ace-step/ace-step-v1.5');
  assert.match(data.requestId, /^ttcmusic[\w-]+$/);
  assert.equal(data.durationSeconds, 25);
  assert.ok(data.statusUrl.includes('session_hash=' + data.requestId));

  const join = calls.find(call => call.url === ACE_JOIN);
  assert.ok(join, 'ACE-Step join was called');
  const joinBody = JSON.parse(join.options.body);
  assert.equal(joinBody.fn_index, 77);
  assert.equal(joinBody.session_hash, data.requestId);
  assert.equal(joinBody.data.length, 54);
  assert.equal(joinBody.data[4], 'Upbeat game-show song'); // Prompt (style/tags)
  assert.equal(joinBody.data[5], 'Welcome to the show\nWatch the prizes glow'); // Lyrics
  assert.equal(joinBody.data[9], 'en'); // Vocal Language
  assert.equal(joinBody.data[15], 25); // Audio Duration
  assert.equal(joinBody.data[16], 1); // batch size
  assert.equal(join.options.headers.Authorization, undefined); // no HF_TOKEN configured
});

test('music falls back to ACE-Step on a fal connection failure, instrumental mapped', async () => {
  let joinBody;
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url, options) => {
      if (String(url).startsWith('https://queue.fal.run/')) throw new Error('socket hang up');
      if (String(url) === ACE_JOIN) { joinBody = JSON.parse(options.body); return Response.json({ event_id: 'evt-2' }); }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  const response = await post(route, { type: 'music', prompt: 'Upbeat instrumental intro', durationSeconds: 30, instrumental: true });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'huggingface');
  assert.equal(joinBody.data[5], '[instrumental]');
  assert.equal(joinBody.data[15], 30);
});

test('music uses fal when fal succeeds and never touches the fallback', async () => {
  const calls = [];
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url) => {
      calls.push(String(url));
      return Response.json({ request_id: 'song-job', status_url: 'https://queue.fal.run/minimax/music-3/requests/song-job/status', response_url: 'https://queue.fal.run/minimax/music-3/requests/song-job' });
    },
  });
  const response = await post(route, { type: 'music', prompt: 'Upbeat game-show song', durationSeconds: 25, lyrics: 'La la la' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'fal');
  assert.equal(data.model, 'minimax/music-3');
  assert.equal(data.requestId, 'song-job');
  assert.equal(calls.some(url => url.includes('hf.space')), false);
});

test('music input errors from fal do not fall back', async () => {
  const calls = [];
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url) => {
      calls.push(String(url));
      return Response.json({ detail: 'lyrics: value is not a valid list' }, { status: 422 });
    },
  });
  const response = await post(route, { type: 'music', prompt: 'Upbeat game-show song', durationSeconds: 25, lyrics: 'La la la' });
  assert.equal(response.status, 422);
  const data = await response.json();
  assert.match(data.error, /lyrics/);
  assert.equal(calls.some(url => url.includes('hf.space')), false);
});

test('HF_TOKEN is sent to the Space when configured', async () => {
  let joinHeaders;
  const route = load('app/api/generate-asset/route.ts', {
    env: { FAL_KEY: 'test-fal', HF_TOKEN: 'hf_test_token' },
    fetch: async (url, options) => {
      if (String(url).startsWith('https://queue.fal.run/')) return Response.json({ detail: 'Insufficient credits' }, { status: 402 });
      if (String(url) === ACE_JOIN) { joinHeaders = options.headers; return Response.json({ event_id: 'evt-3' }); }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  const response = await post(route, { type: 'music', prompt: 'Upbeat game-show song', durationSeconds: 25, lyrics: 'La la la' });
  assert.equal(response.status, 200);
  assert.equal(joinHeaders.Authorization, 'Bearer hf_test_token');
});

test('music-status holds a fallback Space job stream until it completes', async () => {
  const route = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async (url) => {
      assert.ok(String(url).startsWith('https://ace-step-ace-step-v1-5.hf.space/gradio_api/queue/data'));
      return sseResponse([
        { msg: 'estimation', rank: 0, queue_size: 1 },
        { msg: 'process_starts' },
        { msg: 'process_completed', success: true, output: { data: [{ path: '/tmp/gradio/xyz/song.mp3', url: 'https://ace-step-ace-step-v1-5.hf.space/gradio_api/file=/tmp/gradio/xyz/song.mp3' }, null] } },
      ]);
    },
  });
  const completed = await route.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicabc123&model=ace-step%2Face-step-v1.5'));
  assert.equal(completed.status, 200);
  assert.deepEqual(await completed.json(), { status: 'completed', url: 'https://ace-step-ace-step-v1-5.hf.space/gradio_api/file=/tmp/gradio/xyz/song.mp3' });
});

test('music-status fails a fallback job whose stream ends mid-run instead of reporting processing', async () => {
  // Proven live 2026-11-01: once a reader disconnects, this Space destroys
  // the session, so a job whose stream ends without a terminal event is
  // gone — answering "processing" would send the client back to a session
  // that answers session_not_found.
  const route = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async () => sseResponse([
      { msg: 'estimation', rank: 2, queue_size: 3 },
      { msg: 'process_starts' },
    ]),
  });
  const response = await route.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicabc123&model=ace-step%2Face-step-v1.5'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'failed');
  assert.match(data.error, /could not be found/);
});

test('music-status reads a Space failure from output.error and maps quota to the generic message', async () => {
  // The verbatim ZeroGPU failure captured from the ACE-Step Space
  // (2026-11-01): Gradio puts the message in output.error on the
  // process_completed event; event.error stays empty.
  const route = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async () => sseResponse([
      { msg: 'process_starts' },
      { msg: 'process_completed', success: false, title: 'ZeroGPU quota exceeded', output: { error: 'You have exceeded your ZeroGPU quota (180s requested vs. 153s left). Try again in 18:09:14. Authenticate with a Hugging Face token for more quota - https://huggingface.co/settings/tokens', duration: 10, visible: true, title: 'ZeroGPU quota exceeded' } },
    ]),
  });
  const response = await route.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicabc123&model=ace-step%2Face-step-v1.5'));
  const data = await response.json();
  assert.equal(data.status, 'failed');
  assert.equal(data.error, 'This generation is temporarily unavailable. The site administrator has been notified.');
});

test('fallback music poll abandons a still-running job at its budget with an honest timeout', async () => {
  const lib = load('lib/gradio-space.ts', {
    fetch: hangingSseFetch([
      { msg: 'estimation', rank: 0, queue_size: 1 },
      { msg: 'process_starts' },
      { msg: 'progress', progress_data: [{ index: null, length: null, unit: 'steps', progress: 0.1, desc: 'Phase 1: Generating CoT metadata (once for all items)...' }] },
    ]),
  });
  const result = await lib.pollAceStepMusic('ttcmusichang', 60);
  assert.equal(result.state, 'failed');
  assert.match(result.error, /timed out/);
});

test('fallback music poll reports processing only for a silent stream cut by the budget', async () => {
  const lib = load('lib/gradio-space.ts', { fetch: hangingSseFetch([]) });
  const result = await lib.pollAceStepMusic('ttcmusicsilent', 60);
  assert.equal(result.state, 'processing');
  assert.equal(result.queuePosition, null);
});

test('music-status reports a lost fallback job as failed and an unreachable Space as 502', async () => {
  const lost = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async () => sseResponse([{ msg: 'unexpected_error', session_not_found: true, message: '404: Not Found', success: false }]),
  });
  const lostResponse = await lost.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicgone&model=ace-step%2Face-step-v1.5'));
  const lostData = await lostResponse.json();
  assert.equal(lostData.status, 'failed');

  const down = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async () => { throw new Error('DNS failure'); },
  });
  const downResponse = await down.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicabc123&model=ace-step%2Face-step-v1.5'));
  assert.equal(downResponse.status, 502);
});

test('music-status still polls fal for fal jobs', async () => {
  const route = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async (url) => {
      if (String(url).endsWith('/status')) return Response.json({ status: 'COMPLETED', queue_position: 0 });
      return Response.json({ audio: { url: 'https://fal.media/song.mp3' } });
    },
  });
  const response = await route.GET(new Request('https://test/api/generate-asset/music-status?id=faljob1&model=minimax%2Fmusic-3'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'completed', url: 'https://fal.media/song.mp3' });
});

test('voice falls back to Kokoro when fal runs out of credit, mapping the voice by name', async () => {
  const calls = [];
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).startsWith('https://fal.run/')) return Response.json({ detail: 'Insufficient credits' }, { status: 402 });
      if (String(url) === KOKORO_JOIN) return Response.json({ event_id: 'voice-evt' });
      if (String(url).startsWith(KOKORO_DATA)) {
        return sseResponse([
          { msg: 'process_starts' },
          { msg: 'process_completed', success: true, output: { data: [{ path: '/tmp/gradio/v/out.wav', url: 'https://hexgrad-kokoro-tts.hf.space/gradio_api/file=/tmp/gradio/v/out.wav' }, ''] } },
        ]);
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  const response = await post(route, { type: 'voice', prompt: 'Welcome to the show!', voice: 'Sarah' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.type, 'voice');
  assert.equal(data.provider, 'huggingface-kokoro');
  assert.equal(data.model, 'hexgrad/Kokoro-82M');
  assert.equal(data.voice, 'af_sarah');
  assert.equal(data.url, 'https://hexgrad-kokoro-tts.hf.space/gradio_api/file=/tmp/gradio/v/out.wav');

  const join = calls.find(call => call.url === KOKORO_JOIN);
  const joinBody = JSON.parse(join.options.body);
  assert.equal(joinBody.fn_index, 4);
  assert.deepEqual(joinBody.data, ['Welcome to the show!', 'af_sarah', 1, true]);
});

test('voice fallback uses Kokoro af_heart for voices Kokoro does not offer', async () => {
  let joinBody;
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url, options) => {
      if (String(url).startsWith('https://fal.run/')) return Response.json({ detail: 'User is locked. Reason: TOP_UP' }, { status: 403 });
      if (String(url) === KOKORO_JOIN) { joinBody = JSON.parse(options.body); return Response.json({ event_id: 'voice-evt' }); }
      if (String(url).startsWith(KOKORO_DATA)) {
        return sseResponse([
          { msg: 'process_completed', success: true, output: { data: [{ url: 'https://hexgrad-kokoro-tts.hf.space/gradio_api/file=/tmp/gradio/v/a.wav' }, ''] } },
        ]);
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  const response = await post(route, { type: 'voice', prompt: 'Welcome to the show!', voice: 'Aria' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.voice, 'af_heart');
  assert.equal(joinBody.data[1], 'af_heart');
});

test('voice uses fal when fal succeeds and never touches Kokoro', async () => {
  const calls = [];
  const route = load('app/api/generate-asset/route.ts', {
    fetch: async (url) => {
      calls.push(String(url));
      return Response.json({ audio: { url: 'https://fal.media/voice.mp3' } });
    },
  });
  const response = await post(route, { type: 'voice', prompt: 'Welcome to the show!', voice: 'Aria' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.provider, 'fal-elevenlabs');
  assert.equal(data.url, 'https://fal.media/voice.mp3');
  assert.equal(calls.some(url => url.includes('hf.space')), false);
});

const KOKORO_WAV_URL = 'https://hexgrad-kokoro-tts.hf.space/gradio_api/file=/tmp/gradio/v/out.wav';

// The client-side half of a fallback voice save: the Space file is
// downloaded and re-uploaded through /api/assets presigning, exactly as
// storeGeneratedAsset does for every non-fal source.
function assetStoreFetch(download) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options });
    if (target === KOKORO_WAV_URL) return download;
    if (target === '/api/assets' && options.body && JSON.parse(options.body).presign === true) {
      const body = JSON.parse(options.body);
      return Response.json({ uploadUrl: 'https://storage.test/put', storageKey: 'projects/p1/stored', name: body.name, url: 'https://storage.test/get' });
    }
    if (target === 'https://storage.test/put') return { ok: true };
    throw new Error(`Unexpected fetch ${target}`);
  };
  return { fetch, calls };
}

test('a Kokoro voice download served as application/octet-stream is stored as audio/wav and files under Voice', async () => {
  // The exact shape the live run produced: the download's blob type is the
  // generic application/octet-stream, and that type is what used to be
  // stored — sorting the clip into "Other files" and out of Build Space's
  // Music & voice tab, whose filters read the stored type.
  const { fetch, calls } = assetStoreFetch({ ok: true, blob: async () => new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'application/octet-stream' }) });
  const store = load('lib/asset-store.ts', { fetch, modules: { './project': {} } });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Welcome to the show — Voice', type: 'hexgrad/Kokoro-82M', url: KOKORO_WAV_URL });
  assert.equal(stored.type, 'audio/wav');
  const presign = calls.find(call => call.url === '/api/assets');
  assert.equal(JSON.parse(presign.options.body).type, 'audio/wav', 'the upload itself carries the repaired type');

  // The classification the Workshop folders and Build Space tabs apply.
  const folders = load('lib/asset-folders.ts', { fetch });
  const board = load('lib/board-design.ts', { fetch });
  const asSaved = { ...stored, generation: { type: 'voice' } };
  assert.equal(board.mediaKind(asSaved), 'audio');
  assert.equal(folders.assetCategory(asSaved), 'voice');
  // The pre-fix stored shape — same asset, generic type kept — is "other":
  // that is the whole mechanism of the live misclassification.
  assert.equal(folders.assetCategory({ ...asSaved, type: 'application/octet-stream' }), 'other');
  assert.equal(board.mediaKind({ ...asSaved, type: 'application/octet-stream' }), 'unknown');
});

test('a generated download that already carries a real media type is stored untouched', async () => {
  const mp3Url = 'https://hexgrad-kokoro-tts.hf.space/gradio_api/file=/tmp/gradio/v/out.mp3';
  const calls = [];
  const fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options });
    if (target === mp3Url) return { ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }) };
    if (target === '/api/assets') return Response.json({ uploadUrl: 'https://storage.test/put', storageKey: 'projects/p1/stored', name: 'clip', url: 'https://storage.test/get' });
    if (target === 'https://storage.test/put') return { ok: true };
    throw new Error(`Unexpected fetch ${target}`);
  };
  const store = load('lib/asset-store.ts', { fetch, modules: { './project': {} } });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Clip — Voice', type: 'hexgrad/Kokoro-82M', url: mp3Url });
  assert.equal(stored.type, 'audio/mpeg');
});

test('fal-generated media still stores through the server route with the server-reported type', async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options });
    if (target === '/api/assets') {
      const body = JSON.parse(options.body);
      assert.equal(body.sourceUrl, 'https://fal.media/files/voice.mp3');
      return Response.json({ name: body.name, type: 'audio/mpeg', storageKey: 'projects/p1/fal', url: 'https://storage.test/fal' });
    }
    throw new Error(`Unexpected fetch ${target}`);
  };
  const store = load('lib/asset-store.ts', { fetch, modules: { './project': {} } });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Welcome — Voice', type: 'fal-ai/elevenlabs/tts/eleven-v3', url: 'https://fal.media/files/voice.mp3' });
  assert.equal(stored.type, 'audio/mpeg');
  assert.equal(calls.length, 1, 'the fal path never downloads the source in the browser');
});
