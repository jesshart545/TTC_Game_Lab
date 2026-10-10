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
const { videoDuration } = load('lib/video-duration.ts');
test('length parsing preserves requests and rejects unsupported lengths', () => {
  assert.equal(videoDuration('Animate the background'), 5);
  assert.equal(videoDuration('Make a 10-second animation'), 10);
  assert.equal(videoDuration('Make a 15 second video'), 15);
  assert.equal(videoDuration('Make a 5 second video', 12), 12);
  for (const value of [0, 1, 31, 5.5, 'bad', Infinity]) assert.throws(() => videoDuration('Animate', value));
  assert.throws(() => videoDuration('Make a 1 minute commercial'));
  assert.throws(() => videoDuration('Make a 31-second video'));
});
for (const reference of [false, true]) {
  for (const duration of Array.from({length:29}, (_,i)=>i+2)) {
    test(`${reference ? 'image' : 'text'} video submits ${duration}s to a supported provider`, async () => {
      const calls = [];
      const route = load('app/api/generate-asset/route.ts', { fetch: async (url, options) => {
        calls.push({ url, input: JSON.parse(options.body) });
        return Response.json(url.includes('queue.fal.run') ? { request_id: 'job', status_url: 'https://queue.fal.run/fal-ai/wan/requests/job/status', response_url: 'https://queue.fal.run/fal-ai/wan/requests/job' } : { id: 'job' });
      } });
      const response = await route.POST(new Request('https://test/api/generate-asset', { method: 'POST', body: JSON.stringify({ type: 'video', prompt: 'Animate glowing stars', durationSeconds: duration, ...(reference ? { promptImage: 'https://test/image.png' } : {}) }) }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).durationSeconds, duration);
      assert.equal(calls.length, 1);
      const { url, input } = calls[0];
      if (reference && duration === 5) assert.ok(url.endsWith('v2.2-a14b/image-to-video/turbo'));
      else if (!reference && duration <= 10) { assert.equal(url, 'https://api.dev.runwayml.com/v1/text_to_video'); assert.equal(input.promptImage, undefined); assert.equal(input.duration, duration); }
      else { assert.ok(url.endsWith(`wan-3.0/${reference ? 'image' : 'text'}-to-video`)); assert.equal(Number(input.duration), duration); assert.equal(input.enable_safety_checker, true); assert.equal(input.enable_prompt_expansion, false); }
      assert.equal(input.start_image_url || input.image_url || input.promptImage || '', reference ? 'https://test/image.png' : '');
    });
  }
}
test('description length reaches provider; invalid length never submits a paid request', async () => {
  const calls=[];
  const route=load('app/api/generate-asset/route.ts',{fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({id:'job'});}});
  assert.equal((await route.POST(new Request('https://test',{method:'POST',body:JSON.stringify({type:'video',prompt:'Make a 10-second video'})}))).status,200);
  assert.equal(calls[0].duration,10);
  for(const durationSeconds of [1,31,10.5,'bad']) assert.equal((await route.POST(new Request('https://test',{method:'POST',body:JSON.stringify({type:'video',prompt:'Animate',durationSeconds})}))).status,400);
  assert.equal(calls.length,1);
});
test('longer Wan tasks poll through to the finished video URL', async () => {
  const task={id:'job-123',status:'https://queue.fal.run/fal-ai/wan/requests/job-123/status',result:'https://queue.fal.run/fal-ai/wan/requests/job-123'};
  const id=Buffer.from(JSON.stringify(task)).toString('base64url');
  const route=load('app/api/generate-asset/status/route.ts',{fetch:async url=>Response.json(url===task.status?{status:'COMPLETED'}:{video:{url:'https://fal.media/finished.mp4'}})});
  const result=await route.GET(new Request(`https://test/api/generate-asset/status?id=${id}&provider=fal&model=fal-ai/wan/v2.7/image-to-video`));
  assert.equal(result.status,200);const data=await result.json();assert.equal(data.status,'completed');assert.equal(data.url,'https://fal.media/finished.mp4');
});
test('Wan 3 tasks poll with the fal provider through to the result', async () => {
  const task={id:'job-30',status:'https://queue.fal.run/alibaba/wan-3.0/requests/job-30/status',result:'https://queue.fal.run/alibaba/wan-3.0/requests/job-30'};
  const id=Buffer.from(JSON.stringify(task)).toString('base64url');
  const route=load('app/api/generate-asset/status/route.ts',{fetch:async url=>Response.json(url===task.status?{status:'COMPLETED'}:{video:{url:'https://fal.media/30-seconds.mp4'}})});
  const result=await route.GET(new Request(`https://test/api/generate-asset/status?id=${id}&provider=fal&model=alibaba/wan-3.0/image-to-video`));
  assert.equal(result.status,200);assert.equal((await result.json()).url,'https://fal.media/30-seconds.mp4');
  let provider;
  const polling=load('lib/video-generation.ts',{fetch:async url=>{provider=new URL(url,'https://test').searchParams.get('provider');return Response.json({status:'completed',url:'https://fal.media/30-seconds.mp4'});}});
  assert.equal(await polling.waitForGeneratedVideo(id,'alibaba/wan-3.0/image-to-video'),'https://fal.media/30-seconds.mp4');assert.equal(provider,'fal');
});
test('unapproved fal task endpoints are rejected before fetching',async()=>{
  let calls=0;
  const route=load('app/api/generate-asset/status/route.ts',{fetch:async()=>{calls++;throw Error('Must not fetch');}});
  for(const status of ['https://example.com/alibaba/wan-3.0/requests/job/status','https://queue.fal.run/unrelated/requests/job/status']){
    const id=Buffer.from(JSON.stringify({id:'job',status,result:status})).toString('base64url');
    assert.equal((await route.GET(new Request(`https://test?id=${id}&provider=fal`))).status,400);
  }
  assert.equal(calls,0);
});

test('short text-video limits reject oversized descriptions before a paid request', async () => {
  let submitted = false;
  const route = load('app/api/generate-asset/route.ts', { fetch: async () => { submitted = true; } });
  const response = await route.POST(new Request('https://test/api/generate-asset', { method: 'POST', body: JSON.stringify({ type: 'video', prompt: 'x'.repeat(1001), durationSeconds: 5 }) }));
  assert.equal(response.status, 400);
  assert.equal(submitted, false);
});
test('Runway validation errors name the rejected field', async () => {
  const route = load('app/api/generate-asset/route.ts', { fetch: async () => Response.json({ error: 'Validation of body failed', issues: [{ path: ['promptText'], message: 'Too long' }] }, { status: 400 }) });
  const response = await route.POST(new Request('https://test/api/generate-asset', { method: 'POST', body: JSON.stringify({ type: 'video', prompt: 'Neon music notes', durationSeconds: 5 }) }));
  assert.equal((await response.json()).error, 'promptText: Too long');
});

test('an explicitly credit-rejected Runway task falls back once to Fal at the same length', async () => {
  for (const status of [400, 402]) {
    const calls = [];
    const route = load('app/api/generate-asset/route.ts', { fetch: async (url, options) => {
      calls.push({url, input: JSON.parse(options.body)});
      if (url.includes('runwayml')) return Response.json({error:'You do not have enough credits to run this task.'}, {status});
      return Response.json({request_id:'fallback-job', status_url:'https://queue.fal.run/alibaba/wan-3.0/requests/fallback-job/status',response_url:'https://queue.fal.run/alibaba/wan-3.0/requests/fallback-job'});
    } });
    const response = await route.POST(new Request('https://test/api/generate-asset', {method:'POST', body:JSON.stringify({type:'video',prompt:'Neon music notes',durationSeconds:2})}));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, 'fal');
    assert.equal(data.durationSeconds, 2);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].input.duration, 2);
    assert.ok(calls[1].url.endsWith('/alibaba/wan-3.0/text-to-video'));
  }
});
test('ambiguous Runway server failures do not submit a duplicate job to another provider', async () => {
  let calls = 0;
  const route = load('app/api/generate-asset/route.ts', {fetch:async () => {calls++;return Response.json({error:'Server unavailable'},{status:503});}});
  const response = await route.POST(new Request('https://test/api/generate-asset', {method:'POST',body:JSON.stringify({type:'video',prompt:'Neon music notes',durationSeconds:2})}));
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});
