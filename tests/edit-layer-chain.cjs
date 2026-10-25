const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// The chain runner is a dependency-free TypeScript module; transpile it in
// place (same pattern as tests/crime-scene-access.cjs) so the tests exercise
// the exact code the project page executes.
const originalLoad = Module._load;
const chainFile = path.join(__dirname, "..", "lib", "edit-layer-chain.ts");
const chainSource = fs.readFileSync(chainFile, "utf8");
const chainExports = (() => {
  const compiled = ts.transpileModule(chainSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", compiled)(mod, mod.exports, require);
  return mod.exports;
})();
Module._load = originalLoad;

const { runEditLayerChain, MAX_EDIT_LAYERS } = chainExports;
const action = (sourceKey, prompt) => ({ type: "edit-video", sourceKey, prompt });

test("the layer cap is five", () => {
  assert.equal(MAX_EDIT_LAYERS, 5);
});

test("a two-layer sequence runs the second edit against the first layer's saved asset", async () => {
  const submissions = [];
  const asked = [];
  const result = await runEditLayerChain(action("intro.mp4", "Make it black and white"), {
    runLayer: async (layerAction) => {
      submissions.push(layerAction);
      const name = layerAction.sourceKey.replace(/\.mp4$/, "") + "-edited.mp4";
      return { resultKey: name, resultName: name };
    },
    askNext: async (completed) => {
      asked.push(completed);
      if (completed.layer === 1) return { action: action(completed.outcome.resultKey, "Add the title text"), reply: "First the black-and-white look — now the title text." };
      return { action: null, reply: "Both looks are on the newest copy in your draft assets." };
    },
  });
  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].sourceKey, "intro.mp4");
  assert.equal(submissions[1].sourceKey, "intro-edited.mp4", "layer 2 must target layer 1's saved output");
  assert.equal(submissions[1].prompt, "Add the title text");
  assert.equal(asked.length, 2);
  assert.equal(asked[0].outcome.resultName, "intro-edited.mp4");
  assert.equal(result.layers, 2);
  assert.equal(result.finalName, "intro-edited-edited.mp4");
  assert.equal(result.finalReply, "Both looks are on the newest copy in your draft assets.");
});

test("the chain stops when Jewel returns no further action", async () => {
  let ran = 0;
  const result = await runEditLayerChain(action("intro.mp4", "Make it black and white"), {
    runLayer: async () => { ran += 1; return { resultKey: "intro-edited.mp4", resultName: "Intro-edited.mp4" }; },
    askNext: async () => ({ action: null, reply: "That look is on the newest copy." }),
  });
  assert.equal(ran, 1);
  assert.equal(result.layers, 1);
  assert.equal(result.finalReply, "That look is on the newest copy.");
});

test("the chain stops when the result turn is unavailable", async () => {
  let ran = 0;
  const result = await runEditLayerChain(action("intro.mp4", "Make it black and white"), {
    runLayer: async () => { ran += 1; return { resultKey: "intro-edited.mp4", resultName: "Intro-edited.mp4" }; },
    askNext: async () => null,
  });
  assert.equal(ran, 1);
  assert.equal(result.layers, 1);
  assert.equal(result.finalReply, "");
});

test("the chain halts at five layers even if more steps are offered", async () => {
  let ran = 0;
  const result = await runEditLayerChain(action("v0.mp4", "change 1"), {
    runLayer: async (layerAction) => { ran += 1; const name = `v${ran}.mp4`; return { resultKey: name, resultName: name }; },
    askNext: async (completed) => ({ action: action(completed.outcome.resultKey, `change ${completed.layer + 1}`), reply: `Step ${completed.layer + 1} next.` }),
  });
  assert.equal(ran, 5, "exactly five layers may run for one request");
  assert.equal(result.layers, 5);
  assert.equal(result.finalName, "v5.mp4");
});

test("a failed layer stops the chain and keeps earlier layers saved", async () => {
  const saved = [];
  await assert.rejects(
    runEditLayerChain(action("intro.mp4", "Make it black and white"), {
      runLayer: async (layerAction, layerNumber) => {
        if (layerNumber === 2) throw new Error("Video editing failed.");
        const name = "intro-edited.mp4";
        saved.push(name);
        return { resultKey: name, resultName: name };
      },
      askNext: async (completed) => ({ action: action(completed.outcome.resultKey, "Add the title text") }),
    }),
    /Video editing failed\./,
  );
  assert.deepEqual(saved, ["intro-edited.mp4"], "the completed first layer stays saved");
});

test("step announcements are forwarded in order before each next layer runs", async () => {
  const events = [];
  await runEditLayerChain(action("intro.mp4", "Make it black and white"), {
    runLayer: async (layerAction, layerNumber) => { events.push(`run ${layerNumber}`); const name = `layer-${layerNumber}.mp4`; return { resultKey: name, resultName: name }; },
    askNext: async (completed) => completed.layer < 3
      ? { action: action(completed.outcome.resultKey, `change ${completed.layer + 1}`), reply: `Now step ${completed.layer + 1}.` }
      : { action: null, reply: "All steps are on the newest copy." },
    onAnnounce: (line, nextLayer) => events.push(`announce ${nextLayer}: ${line}`),
  });
  assert.deepEqual(events, ["run 1", "announce 2: Now step 2.", "run 2", "announce 3: Now step 3.", "run 3"]);
});
