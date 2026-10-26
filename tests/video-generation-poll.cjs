const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// The generation poller is a dependency-free TypeScript module; transpile it
// in place (same pattern as tests/video-edit-poll.cjs) so the tests exercise
// the exact code the project page's generate flow executes.
const originalLoad = Module._load;
const pollFile = path.join(__dirname, "..", "lib", "video-generation.ts");
const pollSource = fs.readFileSync(pollFile, "utf8");
const pollExports = (() => {
  const compiled = ts.transpileModule(pollSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", compiled)(mod, mod.exports, require);
  return mod.exports;
})();
Module._load = originalLoad;

const { waitForGeneratedVideo, MAX_CONSECUTIVE_GENERATION_POLL_FAILURES } = pollExports;

const processing = (progress = 0) => ({ status: 200, body: { status: "processing", progress } });
const COMPLETED = { status: 200, body: { status: "completed", progress: 100, url: "https://cdn.example/generated.mp4" } };
const NETWORK_DROP = { throw: new TypeError("Failed to fetch") };

// A fake status endpoint that plays back a scripted sequence of responses;
// the last entry repeats if the script runs out. Entries are { status, body }
// for an HTTP response or { throw } for a network-level failure.
function scriptedFetch(script) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    if (step.throw) throw step.throw;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      json: async () => step.body || {},
    };
  };
  return { fetchImpl, calls };
}

const noSleep = async () => {};

test("the consecutive-failure cap is ten", () => {
  assert.equal(MAX_CONSECUTIVE_GENERATION_POLL_FAILURES, 10);
});

test("returns the finished url after processing polls, checking immediately first, reporting progress", async () => {
  const { fetchImpl, calls } = scriptedFetch([processing(25), processing(60), COMPLETED]);
  const sleeps = [];
  const progressSeen = [];
  const url = await waitForGeneratedVideo("job 7", "gen4.5", value => progressSeen.push(value), {
    fetchImpl,
    sleep: async (ms) => { sleeps.push(ms); },
  });
  assert.equal(url, "https://cdn.example/generated.mp4");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "/api/generate-asset/status?id=job%207&model=gen4.5&provider=runway");
  assert.equal(calls[0].init.cache, "no-store");
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual(sleeps, [2000, 2000], "the first check is immediate; later checks wait one interval");
  assert.deepEqual(progressSeen, [25, 60, 100], "progress fires for every successful status response, including the completed one");
});

test("the provider is derived from the model exactly as before", async () => {
  for (const [model, provider] of [
    ["fal-ai/wan/v2.7/image-to-video", "fal"],
    ["alibaba/wan-3.0/text-to-video", "fal"],
    ["gen4.5", "runway"],
    ["agnes-video-2.5-flash", "agnes"],
  ]) {
    const { fetchImpl, calls } = scriptedFetch([COMPLETED]);
    await waitForGeneratedVideo("job", model, undefined, { fetchImpl, sleep: noSleep });
    assert.ok(calls[0].url.endsWith(`&provider=${provider}`), `${model} should poll provider ${provider}, got ${calls[0].url}`);
  }
});

test("completion after transient network failures still returns the url", async () => {
  const { fetchImpl, calls } = scriptedFetch([NETWORK_DROP, NETWORK_DROP, COMPLETED]);
  const url = await waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep });
  assert.equal(url, "https://cdn.example/generated.mp4");
  assert.equal(calls.length, 3);
});

test("persistent network failures give up after exactly the failure cap, with the resume message", async () => {
  const { fetchImpl, calls } = scriptedFetch([NETWORK_DROP]);
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep }),
    /Video status could not be checked\. Use Check video result to resume the saved request; do not generate another copy\./,
  );
  assert.equal(calls.length, MAX_CONSECUTIVE_GENERATION_POLL_FAILURES);
});

test("persistent 503s give up after exactly the failure cap", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 503, body: {} }]);
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep }),
    /Unable to check video generation status\./,
  );
  assert.equal(calls.length, MAX_CONSECUTIVE_GENERATION_POLL_FAILURES);
});

test("a failed job throws at once, with no retries", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 200, body: { status: "failed" } }, COMPLETED]);
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep }),
    /Video generation failed\./,
  );
  assert.equal(calls.length, 1);
});

test("a job error message from the provider is carried through", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 200, body: { status: "error", error: "The provider ran out of credits." } }]);
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep }),
    /The provider ran out of credits\./,
  );
  assert.equal(calls.length, 1);
});

test("a job completed without a URL throws at once", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 200, body: { status: "completed" } }, COMPLETED]);
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep }),
    /The provider finished without a video URL\. Use Check video result to retry retrieval\./,
  );
  assert.equal(calls.length, 1);
});

test("a 400 response throws immediately", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 400, body: {} }, COMPLETED]);
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep }),
    /Unable to check video generation status\./,
  );
  assert.equal(calls.length, 1);
});

test("a successful check resets the consecutive-failure streak", async () => {
  const script = [
    ...Array(9).fill(NETWORK_DROP),
    processing(10),
    ...Array(9).fill(NETWORK_DROP),
    COMPLETED,
  ];
  const { fetchImpl, calls } = scriptedFetch(script);
  const url = await waitForGeneratedVideo("job", "gen4.5", undefined, { fetchImpl, sleep: noSleep });
  assert.equal(url, "https://cdn.example/generated.mp4");
  assert.equal(calls.length, 20);
});

test("a job still processing at the deadline throws the still-processing resume message", async () => {
  const { fetchImpl, calls } = scriptedFetch([processing(50)]);
  let clock = 0;
  await assert.rejects(
    waitForGeneratedVideo("job", "gen4.5", undefined, {
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
      deadlineMs: 8000,
      pollIntervalMs: 2000,
    }),
    /The video is still processing\. Use Check video result to resume the saved request; do not generate another copy\./,
  );
  assert.equal(calls.length, 5, "checks run at t=0, 2000, 4000, 6000 and once more after the sleep that reaches the 8000ms deadline — the same loop shape as the edit poller");
});
