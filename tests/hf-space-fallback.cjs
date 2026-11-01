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
    exports, Buffer, URL, AbortSignal, AbortController, setTimeout, clearTimeout, console,
    process: { env: mocks.env || { FAL_KEY: 'test-fal' } },
    require(name) {
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

test('music-status polls a fallback Space job: processing, then completed', async () => {
  const route = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async (url) => {
      assert.ok(String(url).startsWith('https://ace-step-ace-step-v1-5.hf.space/gradio_api/queue/data'));
      return sseResponse([
        { msg: 'estimation', rank: 2, queue_size: 3 },
        { msg: 'process_starts' },
      ]);
    },
  });
  const processing = await route.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicabc123&model=ace-step%2Face-step-v1.5'));
  assert.equal(processing.status, 200);
  assert.deepEqual(await processing.json(), { status: 'processing', queuePosition: 2 });

  const done = load('app/api/generate-asset/music-status/route.ts', {
    fetch: async () => sseResponse([
      { msg: 'estimation', rank: 0, queue_size: 1 },
      { msg: 'process_starts' },
      { msg: 'process_completed', success: true, output: { data: [{ path: '/tmp/gradio/xyz/song.mp3', url: 'https://ace-step-ace-step-v1-5.hf.space/gradio_api/file=/tmp/gradio/xyz/song.mp3' }, null] } },
    ]),
  });
  const completed = await done.GET(new Request('https://test/api/generate-asset/music-status?id=ttcmusicabc123&model=ace-step%2Face-step-v1.5'));
  assert.equal(completed.status, 200);
  assert.deepEqual(await completed.json(), { status: 'completed', url: 'https://ace-step-ace-step-v1-5.hf.space/gradio_api/file=/tmp/gradio/xyz/song.mp3' });
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
