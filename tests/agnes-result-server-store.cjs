const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Server-side storing of Agnes fallback results (the fix after PR #120).
//
// Agnes generation succeeds server-side, but the finished file lives on
// platform-outputs.agnes-ai.space, which does not grant browsers CORS
// access. storeGeneratedAsset's generic branch downloads the result in the
// browser, so an Agnes image died with "Failed to fetch" and was never
// saved — while fal.media results, which are fetched server-side through
// POST /api/assets (sourceUrl), saved fine. These tests pin the fix: Agnes
// outputs URLs take the same server-side store path as fal.media on BOTH
// sides (the client's branch decision and the route's host allowlist),
// every other host keeps its existing behavior, and the route still
// rejects arbitrary hosts (the allowlist is the SSRF guard).
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Buffer, URL, AbortSignal, AbortController, setTimeout, clearTimeout, console: mocks.console || console, Blob,
    crypto: globalThis.crypto,
    process: { env: mocks.env || {} },
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

const AGNES_OUTPUT_URL = 'https://platform-outputs.agnes-ai.space/generated/neon-stage.png';
const AGNES_OUTPUT_SUBDOMAIN_URL = 'https://files.platform-outputs.agnes-ai.space/v/confetti.mp4';

// A fetch that serves only the /api/assets server-side store response and
// records every call; a direct fetch of the result URL throws, the way the
// browser's CORS-blocked fetch of the Agnes host fails in production.
function serverStoreFetch(calls, storedBody) {
  return async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target === '/api/assets') return Response.json(storedBody);
    throw new Error(`Direct fetch must not happen for ${target}`);
  };
}

test('storeGeneratedAsset sends an Agnes outputs URL through the server-side store', async () => {
  const calls = [];
  const store = load('lib/asset-store.ts', {
    fetch: serverStoreFetch(calls, { name: 'Neon stage — Image', type: 'image/png', storageKey: 'projects/p1/stored-agnes', url: 'https://storage.test/stored-agnes' }),
    modules: { './project': {} },
  });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Neon stage — Image', type: 'agnes-image-2.5-flash', url: AGNES_OUTPUT_URL });
  assert.equal(calls.length, 1, 'exactly one request: the server-side store, never a direct download');
  assert.equal(calls[0].target, '/api/assets');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.sourceUrl, AGNES_OUTPUT_URL);
  assert.equal(body.presign, undefined);
  assert.equal(body.projectId, 'p1');
  assert.equal(stored.storageKey, 'projects/p1/stored-agnes');
  assert.equal(stored.url, 'https://storage.test/stored-agnes');
  assert.equal(stored.type, 'image/png');
});

test('storeGeneratedAsset sends an Agnes outputs subdomain URL through the server-side store', async () => {
  const calls = [];
  const store = load('lib/asset-store.ts', {
    fetch: serverStoreFetch(calls, { name: 'Confetti — Video', type: 'video/mp4', storageKey: 'projects/p1/stored-video', url: 'https://storage.test/stored-video' }),
    modules: { './project': {} },
  });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Confetti — Video', type: 'agnes-video-2.5-flash', url: AGNES_OUTPUT_SUBDOMAIN_URL });
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).sourceUrl, AGNES_OUTPUT_SUBDOMAIN_URL);
  assert.equal(stored.storageKey, 'projects/p1/stored-video');
  assert.equal(stored.type, 'video/mp4');
});

test('storeGeneratedAsset still sends fal.media through the server-side store', async () => {
  const calls = [];
  const store = load('lib/asset-store.ts', {
    fetch: serverStoreFetch(calls, { name: 'Stage — Image', type: 'image/png', storageKey: 'projects/p1/stored-fal', url: 'https://storage.test/stored-fal' }),
    modules: { './project': {} },
  });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Stage — Image', type: 'fal-ai/nano-banana-2', url: 'https://fal.media/files/pic.png' });
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).sourceUrl, 'https://fal.media/files/pic.png');
  assert.equal(stored.storageKey, 'projects/p1/stored-fal');
});

test('storeGeneratedAsset keeps the generic browser-download branch for other https hosts (HF Space voice)', async () => {
  const hfUrl = 'https://hexgrad-kokoro-tts.hf.space/gradio_api/file=/tmp/gradio/deadbeef/voice.wav';
  const calls = [];
  const fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target === hfUrl) return { ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' }) };
    if (target === '/api/assets') {
      const body = JSON.parse(options.body);
      return Response.json({ uploadUrl: 'https://storage.test/put', storageKey: 'projects/p1/stored', name: body.name, url: 'https://storage.test/get' });
    }
    if (target === 'https://storage.test/put') return { ok: true };
    throw new Error(`Unexpected fetch ${target}`);
  };
  const store = load('lib/asset-store.ts', { fetch, modules: { './project': {} } });
  const stored = await store.storeGeneratedAsset('p1', { name: 'Welcome — Voice', type: 'hexgrad/Kokoro-82M', url: hfUrl });
  // The browser downloaded the file itself (first call is the source URL)…
  assert.equal(calls[0].target, hfUrl);
  // …and uploaded the bytes via the presign flow — no sourceUrl store.
  const assetsCall = calls.find(call => call.target === '/api/assets');
  assert.equal(JSON.parse(assetsCall.options.body).presign, true);
  assert.equal(JSON.parse(assetsCall.options.body).sourceUrl, undefined);
  // The octet-stream type repair from the URL extension still applies.
  assert.equal(stored.type, 'audio/wav');
});

// --- The /api/assets route's sourceUrl allowlist ---------------------------

function loadAssetsRoute(puts, fetchImpl) {
  return load('app/api/assets/route.ts', {
    fetch: fetchImpl,
    modules: {
      '../../../lib/music-wav': { capMusicWav: bytes => bytes },
      '../../../lib/object-storage': {
        putAsset: async (key, bytes, type) => { puts.push({ key, bytes, type }); },
        getAssetUrl: async key => `https://storage.test/${key}`,
        getAssetUploadUrl: async () => 'https://storage.test/put',
        deleteAssetsByPrefix: async () => {},
      },
    },
  });
}

function postSource(route, sourceUrl) {
  return route.POST(new Request('https://test/api/assets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'p1', name: 'Generated media', sourceUrl }),
  }));
}

function sourceBytesFetch(calls, contentType = 'image/png') {
  return async url => {
    calls.push(String(url));
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': contentType } });
  };
}

test('assets route stores a sourceUrl from the Agnes outputs host', async () => {
  const puts = [];
  const fetches = [];
  const route = loadAssetsRoute(puts, sourceBytesFetch(fetches));
  const response = await postSource(route, AGNES_OUTPUT_URL);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.storageKey.startsWith('projects/p1/'));
  assert.equal(puts.length, 1);
  assert.equal(puts[0].type, 'image/png');
  assert.deepEqual(fetches, [AGNES_OUTPUT_URL]);
});

test('assets route stores a sourceUrl from an Agnes outputs subdomain', async () => {
  const puts = [];
  const fetches = [];
  const route = loadAssetsRoute(puts, sourceBytesFetch(fetches, 'video/mp4'));
  const response = await postSource(route, AGNES_OUTPUT_SUBDOMAIN_URL);
  assert.equal(response.status, 200);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].type, 'video/mp4');
});

test('assets route still stores a fal.media sourceUrl', async () => {
  const puts = [];
  const fetches = [];
  const route = loadAssetsRoute(puts, sourceBytesFetch(fetches));
  const response = await postSource(route, 'https://fal.media/files/pic.png');
  assert.equal(response.status, 200);
  assert.equal(puts.length, 1);
});

test('assets route rejects an arbitrary host and never fetches it', async () => {
  const puts = [];
  const fetches = [];
  const route = loadAssetsRoute(puts, sourceBytesFetch(fetches));
  const response = await postSource(route, 'https://example.com/evil.png');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Unsupported generated media source.');
  assert.equal(puts.length, 0);
  assert.equal(fetches.length, 0);
});

test('assets route rejects a lookalike host that only ends with the Agnes domain as a suffix label', async () => {
  const puts = [];
  const fetches = [];
  const route = loadAssetsRoute(puts, sourceBytesFetch(fetches));
  const response = await postSource(route, 'https://platform-outputs.agnes-ai.space.evil.com/x.png');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Unsupported generated media source.');
  assert.equal(puts.length, 0);
  assert.equal(fetches.length, 0);
});
