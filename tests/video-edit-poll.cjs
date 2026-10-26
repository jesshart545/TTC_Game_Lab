const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// The poller is a dependency-free TypeScript module; transpile it in place
// (same pattern as tests/edit-layer-chain.cjs) so the tests exercise the
// exact code the project page and media editor execute.
const originalLoad = Module._load;
const pollFile = path.join(__dirname, "..", "lib", "video-edit-poll.ts");
const pollSource = fs.readFileSync(pollFile, "utf8");
const pollExports = (() => {
  const compiled = ts.transpileModule(pollSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", compiled)(mod, mod.exports, require);
  return mod.exports;
})();
Module._load = originalLoad;

const { pollForEditedVideoUrl, MAX_CONSECUTIVE_POLL_FAILURES } = pollExports;

const PROCESSING = { status: 200, body: { status: "processing" } };
const COMPLETED = { status: 200, body: { status: "completed", url: "https://cdn.example/edited.mp4" } };
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
  assert.equal(MAX_CONSECUTIVE_POLL_FAILURES, 10);
});

test("returns the finished url after processing polls, checking immediately first", async () => {
  const { fetchImpl, calls } = scriptedFetch([PROCESSING, PROCESSING, COMPLETED]);
  const sleeps = [];
  const url = await pollForEditedVideoUrl("vid 123", "fal-ai/wan-vace-apps/video-edit", {
    fetchImpl,
    sleep: async (ms) => { sleeps.push(ms); },
  });
  assert.equal(url, "https://cdn.example/edited.mp4");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "/api/generate-asset/status?id=vid%20123&model=fal-ai%2Fwan-vace-apps%2Fvideo-edit&provider=fal");
  assert.equal(calls[0].init.cache, "no-store");
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual(sleeps, [3000, 3000], "the first check is immediate; later checks wait one interval");
});

test("two network failures then completion still returns the url", async () => {
  const { fetchImpl, calls } = scriptedFetch([NETWORK_DROP, NETWORK_DROP, COMPLETED]);
  const url = await pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep });
  assert.equal(url, "https://cdn.example/edited.mp4");
  assert.equal(calls.length, 3);
});

test("a failed job throws the failed message at once, with no retries", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 200, body: { status: "failed" } }, COMPLETED]);
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep }),
    /Video editing failed\./,
  );
  assert.equal(calls.length, 1);
});

test("a job error message from the provider is carried through", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 200, body: { status: "error", error: "The render ran out of credits." } }]);
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep }),
    /The render ran out of credits\./,
  );
  assert.equal(calls.length, 1);
});

test("a 400 response throws the progress message immediately", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 400, body: {} }, COMPLETED]);
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep }),
    /Unable to check video editing progress\./,
  );
  assert.equal(calls.length, 1);
});

test("persistent 503s give up after exactly the failure cap", async () => {
  const { fetchImpl, calls } = scriptedFetch([{ status: 503, body: {} }]);
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep }),
    /Unable to check video editing progress\./,
  );
  assert.equal(calls.length, MAX_CONSECUTIVE_POLL_FAILURES);
});

test("persistent network failures give up after exactly the failure cap", async () => {
  const { fetchImpl, calls } = scriptedFetch([NETWORK_DROP]);
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep }),
    /Unable to check video editing progress\./,
  );
  assert.equal(calls.length, MAX_CONSECUTIVE_POLL_FAILURES);
});

test("a successful check resets the consecutive-failure streak", async () => {
  const script = [
    ...Array(9).fill(NETWORK_DROP),
    PROCESSING,
    ...Array(9).fill(NETWORK_DROP),
    COMPLETED,
  ];
  const { fetchImpl, calls } = scriptedFetch(script);
  const url = await pollForEditedVideoUrl("vid", "model", { fetchImpl, sleep: noSleep });
  assert.equal(url, "https://cdn.example/edited.mp4");
  assert.equal(calls.length, 20);
});

test("a job still processing at the deadline throws the still-processing message", async () => {
  const { fetchImpl, calls } = scriptedFetch([PROCESSING]);
  let clock = 0;
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", {
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
      deadlineMs: 9000,
      pollIntervalMs: 3000,
    }),
    /Video editing is still processing\. Please try again in a little while\./,
  );
  assert.equal(calls.length, 4, "checks run at t=0, 3000, 6000 and once more after the sleep that reaches the 9000ms deadline — the same loop shape as the original inline polls");
});

test("custom messages are honored", async () => {
  const { fetchImpl } = scriptedFetch([PROCESSING]);
  let clock = 0;
  await assert.rejects(
    pollForEditedVideoUrl("vid", "model", {
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
      deadlineMs: 3000,
      pollIntervalMs: 3000,
      messages: { progress: "Unable to check on your edit.", failed: "I couldn't make that edit.", stillProcessing: "Your edit is still processing. Please try again in a little while." },
    }),
    /Your edit is still processing\. Please try again in a little while\./,
  );
});
