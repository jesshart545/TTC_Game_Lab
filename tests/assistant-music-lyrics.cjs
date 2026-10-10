const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const load = require('./load.cjs');

function route(file, fetch) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, fetch, AbortSignal, URL, Buffer, console,
    process: { env: { FAL_KEY: 'test-only' } },
    require(id) {
      if (id === 'next/server') return { NextResponse: { json: (data, options) => Response.json(data, options) } };
      if (id.endsWith('/assistant-provider')) return { assistantProvider: () => ({ url: 'https://test/ai', key: 'test-only', models: ['test'] }) };
      return id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts')) : require(id);
    },
  });
  return exports;
}
const music = (lyrics, prompt = 'Upbeat game-show song', durationSeconds = 25) => ({
  reply: 'I will generate the song.', changes: {}, action: { type: 'music', prompt, durationSeconds, lyrics },
});
async function assistant(responses, request = 'Create an original 25-second game-show song', history = []) {
  const calls = [];
  const ai = route('app/api/ai/route.ts', async (_, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] });
  });
  const response = await ai.POST({ json: async () => ({ mode: 'draft-edit', request, history, project: { assets: [], gameTools: [], controls: [] } }) });
  return { status: response.status, data: await response.json(), calls };
}
test('missing short-song lyrics are repaired before executing and reach the music provider', async () => {
  const lyrics = 'Welcome to the show\nWatch the prizes glow';
  const result = await assistant([music(''), music(lyrics)]);
  assert.equal(result.status, 200);
  assert.equal(result.calls.length, 2);
  assert.match(result.calls[1].messages.at(-1).content, /missing lyrics/);
  assert.equal(result.data.action.lyrics, lyrics);
  let providerInput;
  const generator = route('app/api/generate-asset/route.ts', async (url, options) => {
    assert.ok(url.endsWith('/minimax/music-3'));
    providerInput = JSON.parse(options.body);
    return Response.json({ request_id: 'song-job' });
  });
  const generated = await generator.POST({ json: async () => result.data.action });
  assert.equal(generated.status, 200);
  assert.equal(providerInput.lyrics, lyrics);
  assert.equal(providerInput.duration, 25);
});
test('approved conversation lyrics are passed verbatim with a confirmation', async () => {
  const lyrics = 'Red team, blue team\nChase the winning dream';
  const result = await assistant([music(lyrics)], 'Yes, generate it', [{ role: 'user', content: lyrics }]);
  assert.equal(result.calls.length, 1);
  assert.equal(result.data.action.lyrics, lyrics);
  assert.equal(result.calls[0].messages[1].content.includes(lyrics.replaceAll('\n', '\\n')), true);
});
test('missing specific lyrics become a chat clarification without starting music', async () => {
  const result = await assistant([music(''), { reply: 'What lyrics would you like sung?', changes: {}, action: null, needsClarification: true }]);
  assert.equal(result.status, 200);
  assert.equal(result.data.action, null);
  assert.equal(result.data.outcome, 'clarification');
});
test('instrumental and provider-written full songs can omit lyrics', async () => {
  for (const action of [music('', 'Upbeat instrumental intro'), music('', 'Upbeat full song', 0)]) {
    const result = await assistant([action]);
    assert.equal(result.status, 200);
    assert.equal(result.calls.length, 1);
    assert.equal(result.data.action.type, 'music');
  }
});
test('repeated missing lyrics are rejected before the generator is called', async () => {
  const result = await assistant([music(''), music('')]);
  assert.equal(result.status, 502);
  assert.equal(result.data.action, undefined);
});
