const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
const start = page.indexOf('  async function generateAsset(');
const end = page.indexOf('\n  function placeSceneImage', start);
const code = ts.transpileModule('export ' + page.slice(start, end).trim(), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ pendingVideo, pollError } = {}) {
  const project = { id: 'owned-project', assets: [], pendingVideos: pendingVideo ? [pendingVideo] : [] };
  const projectRef = { current: project }, saveQueue = { current: Promise.resolve() };
  const exports = {}, calls = [], statuses = [];
  const context = { exports, Error, AbortSignal, project, projectRef, saveQueue, workspaceMounted: { current: true },
    assetBusy: false, videoReferenceKey: '', backgroundIntent: false,
    fetch: async () => { calls.push('submit'); return Response.json({ videoId: 'job', model: 'gen4.5', durationSeconds: 5 }); },
    persist(next) { calls.push('save-job'); projectRef.current = next; saveQueue.current = Promise.resolve(); },
    waitForGeneratedVideo: async (id) => {
      assert.ok(projectRef.current.pendingVideos.some(job => job.videoId === id));
      calls.push('poll');
      if (pollError) throw new Error(pollError);
      return 'https://fal.media/result.mp4';
    },
    storeGeneratedAsset: async () => { calls.push('store'); return { storageKey: 'projects/owned-project/video.mp4', name: 'Video 1', type: 'video/mp4' }; },
    saveProjectToServer: async () => calls.push('save-result'),
    setProject: next => { projectRef.current = next; },
    setAssetStatus: value => statuses.push(value),
  };
  for (const name of ['setShowGenerator','setAssetBusy','setBackgroundIntent','setGeneratorPrompt','setBackgroundDestinationKey']) context[name] = () => {};
  vm.runInNewContext(code, context);
  return { generate: exports.generateAsset, projectRef, calls, statuses };
}
test('video job is saved before polling and removed after storing its result', async () => {
  const h = harness();
  await h.generate('video', 'Game-show intro', { durationSeconds: 5 });
  assert.deepEqual(h.calls, ['submit','save-job','poll','store','save-result']);
  assert.equal(h.projectRef.current.pendingVideos.length, 0);
  assert.equal(h.projectRef.current.assets.length, 1);
});
test('reopened video job retrieves the result without another paid submission', async () => {
  const pendingVideo = { videoId: 'job', model: 'gen4.5', prompt: 'Game-show intro' };
  const h = harness({ pendingVideo });
  await h.generate('video', pendingVideo.prompt, { pendingVideo });
  assert.deepEqual(h.calls, ['poll','store','save-result']);
});
test('interrupted status retrieval retains the job for another check', async () => {
  const h = harness({ pollError: 'Provider timeout' });
  await assert.rejects(h.generate('video', 'Game-show intro', {}), /Provider timeout/);
  assert.equal(h.projectRef.current.pendingVideos[0].videoId, 'job');
  assert.equal(h.projectRef.current.assets.length, 0);
});
test('client status requests have a deadline and never advise duplicate generation', async () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/video-generation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, AbortSignal, setTimeout: resolve => resolve(), fetch: async (_, options) => {
    assert.ok(options.signal);
    throw new Error('Timeout');
  } });
  await assert.rejects(exports.waitForGeneratedVideo('job', 'gen4.5'), /Check video result/);
});
