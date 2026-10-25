const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, URL, AbortSignal, process: { env: { FAL_KEY: 'test', RUNWAYML_API_SECRET: 'test' } },
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'), mocks);
      return require(name);
    }, ...mocks });
  return exports;
}

const QUEUE_SUBMIT = 'https://queue.fal.run/fal-ai/wan-vace-apps/video-edit';
const TASK = {
  id: 'edit-job',
  status: 'https://queue.fal.run/fal-ai/wan-vace-apps/video-edit/requests/edit-job/status',
  result: 'https://queue.fal.run/fal-ai/wan-vace-apps/video-edit/requests/edit-job',
};
const editRequest = (body) => new Request('https://test/api/edit-video', { method: 'POST', body: JSON.stringify(body) });

test('video edit submits to the fal queue (not the sync endpoint) and returns a decodable task handle', async () => {
  const calls = [];
  const route = load('app/api/edit-video/route.ts', { fetch: async (url, options) => {
    calls.push({ url, options });
    return Response.json({ request_id: TASK.id, status_url: TASK.status, response_url: TASK.result });
  } });
  const response = await route.POST(editRequest({ prompt: 'Make it night', videoUrl: 'https://test/source.mp4' }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, QUEUE_SUBMIT);
  assert.ok(!calls.some(call => call.url.startsWith('https://fal.run/')), 'must not call the synchronous fal.run endpoint');
  assert.deepEqual(JSON.parse(calls[0].options.body), { prompt: 'Make it night', video_url: 'https://test/source.mp4' });
  assert.equal(calls[0].options.headers.Authorization, 'Key test');
  const data = await response.json();
  assert.equal(data.status, 'processing');
  assert.equal(data.provider, 'fal');
  assert.equal(data.model, 'fal-ai/wan-vace-apps/video-edit');
  assert.deepEqual(JSON.parse(Buffer.from(data.videoId, 'base64url').toString('utf8')), TASK);
});

test('video edit keeps its validation, missing-key, provider-error and incomplete-task behavior', async () => {
  let calls = 0;
  const noKey = load('app/api/edit-video/route.ts', { process: { env: {} }, fetch: async () => { calls += 1; } });
  const missing = await noKey.POST(editRequest({ prompt: 'Make it night', videoUrl: 'https://test/source.mp4' }));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error, 'FAL_KEY is not configured in Vercel.');
  assert.equal(calls, 0);

  const route = load('app/api/edit-video/route.ts', { fetch: async () => Response.json({ request_id: TASK.id, status_url: TASK.status, response_url: TASK.result }) });
  const noPrompt = await route.POST(editRequest({ prompt: '  ', videoUrl: 'https://test/source.mp4' }));
  assert.equal(noPrompt.status, 400);
  assert.equal((await noPrompt.json()).error, 'Tell me what you want changed.');
  const noVideo = await route.POST(editRequest({ prompt: 'Make it night' }));
  assert.equal(noVideo.status, 400);
  assert.equal((await noVideo.json()).error, 'A source video is required.');

  const rejected = load('app/api/edit-video/route.ts', { fetch: async () => Response.json({ detail: 'video_url is not reachable' }, { status: 422 }) });
  const rejectedResponse = await rejected.POST(editRequest({ prompt: 'Make it night', videoUrl: 'https://test/source.mp4' }));
  assert.equal(rejectedResponse.status, 422);
  assert.equal((await rejectedResponse.json()).error, 'video_url is not reachable');

  const incomplete = load('app/api/edit-video/route.ts', { fetch: async () => Response.json({ request_id: TASK.id, status_url: TASK.status }) });
  const incompleteResponse = await incomplete.POST(editRequest({ prompt: 'Make it night', videoUrl: 'https://test/source.mp4' }));
  assert.equal(incompleteResponse.status, 502);
  assert.equal((await incompleteResponse.json()).error, 'The video editor returned an incomplete task.');
});

test('a queued video edit polls through the status route to the finished video URL', async () => {
  const id = Buffer.from(JSON.stringify(TASK)).toString('base64url');
  let statusPayload = { status: 'IN_PROGRESS' };
  const route = load('app/api/generate-asset/status/route.ts', { fetch: async (url) =>
    Response.json(url === TASK.status ? statusPayload : { video: { url: 'https://fal.media/edited.mp4' }, seed: 7 }) });
  const statusUrl = `https://test/api/generate-asset/status?id=${id}&provider=fal&model=fal-ai/wan-vace-apps/video-edit`;
  const pending = await route.GET(new Request(statusUrl));
  assert.equal(pending.status, 200);
  assert.deepEqual(await pending.json(), { status: 'processing', progress: 50 });
  statusPayload = { status: 'COMPLETED' };
  const done = await route.GET(new Request(statusUrl));
  assert.equal(done.status, 200);
  const data = await done.json();
  assert.equal(data.status, 'completed');
  assert.equal(data.progress, 100);
  assert.equal(data.url, 'https://fal.media/edited.mp4');
  assert.equal(data.provider, 'fal');
});

test('the status route still rejects fal task endpoints outside the allowlist', async () => {
  let calls = 0;
  const route = load('app/api/generate-asset/status/route.ts', { fetch: async () => { calls += 1; throw new Error('Must not fetch'); } });
  const rejected = [
    // Right model family, wrong origin.
    { id: 'edit-job', status: 'https://example.com/fal-ai/wan-vace-apps/video-edit/requests/edit-job/status', result: 'https://example.com/fal-ai/wan-vace-apps/video-edit/requests/edit-job' },
    // Right origin, unapproved model path.
    { id: 'job', status: 'https://queue.fal.run/fal-ai/other-model/requests/job/status', result: 'https://queue.fal.run/fal-ai/other-model/requests/job' },
    // Allowlisted path but the URLs do not belong to the claimed request id.
    { id: 'edit-job', status: 'https://queue.fal.run/fal-ai/wan-vace-apps/video-edit/requests/someone-else/status', result: 'https://queue.fal.run/fal-ai/wan-vace-apps/video-edit/requests/someone-else' },
  ];
  for (const task of rejected) {
    const id = Buffer.from(JSON.stringify(task)).toString('base64url');
    const response = await route.GET(new Request(`https://test/api/generate-asset/status?id=${id}&provider=fal&model=fal-ai/wan-vace-apps/video-edit`));
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('both video edit clients submit then poll the status route', () => {
  const editor = fs.readFileSync('components/MediaEditor.tsx', 'utf8');
  const editFlow = editor.slice(editor.indexOf('async function editMedia'), editor.indexOf('async function saveCopy'));
  assert.ok(editFlow.includes('"/api/edit-video"'), 'MediaEditor still submits video edits');
  assert.ok(editFlow.includes('/api/generate-asset/status'), 'MediaEditor polls the status route for the edit result');
  assert.ok(editFlow.includes('provider=fal'), 'MediaEditor polls with the fal provider');

  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const submitAt = page.indexOf('fetch("/api/edit-video"');
  assert.ok(submitAt > -1, 'project page still submits video edits');
  const editBranch = page.slice(submitAt, submitAt + 3000);
  assert.ok(editBranch.includes('/api/generate-asset/status'), 'project page polls the status route for the edit result');
  assert.ok(editBranch.includes('provider=fal'), 'project page polls with the fal provider');
  assert.ok(editBranch.includes('saveAssetAsNew'), 'project page still stores the finished edit as a new asset');
});
