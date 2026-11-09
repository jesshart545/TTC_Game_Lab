const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

const { validateSavedReferences, validateSequenceAdditions } = load('lib/ai-edit-validation.ts');
const { applyBuildChanges } = load('lib/build-edits.ts');

const project = {
  id: 'p1', assets: [], compositions: [], overlay: {}, assetPools: [],
  controls: [
    { id: 'seq-existing', label: 'Main Sequence', action: 'sequence', buttonMode: 'chain', sequenceMode: 'all', chain: [{ id: 'step-1', kind: 'control', refId: 'start-btn', label: 'Start', timing: { mode: 'immediate', seconds: 0 } }] },
    { id: 'start-btn', label: 'Start Timer', action: 'tool.timer-1', toolIds: ['timer-1'] },
  ],
  gameTools: [{ id: 'timer-1', name: 'Timer', type: 'countdown', enabled: true, inToolbox: true, inOverlayBuild: true, config: { seconds: 30 } }],
};
const sequenceCount = (p) => p.controls.filter((c) => c.action === 'sequence').length;

// (a) A sequence entry carrying an id that names no saved sequence — an
// invented id, or the selected button's id — is created as a NEW sequence
// instead of refused; an id naming a real sequence still edits it.
{
  const invented = { sequences: [{ id: 'totally-invented', name: 'Brand New', steps: [{ controlId: 'start-btn' }] }] };
  validateSavedReferences(project, invented);
  assert.equal(invented.sequences[0].id, undefined, 'invented sequence id is dropped during validation');
  const appliedInvented = applyBuildChanges(project, invented);
  assert.equal(appliedInvented.warnings.length, 0);
  assert.equal(sequenceCount(appliedInvented.project), 2, 'the mislabeled entry became a new sequence');
  assert(!appliedInvented.project.controls.some((c) => c.id === 'totally-invented'));

  const borrowed = { sequences: [{ id: 'start-btn', name: 'Borrowed Id', steps: [{ controlId: 'start-btn' }] }] };
  validateSavedReferences(project, borrowed);
  assert.equal(borrowed.sequences[0].id, undefined, 'a selected button id is not treated as a sequence id');
  const appliedBorrowed = applyBuildChanges(project, borrowed);
  assert.equal(appliedBorrowed.warnings.length, 0);
  assert.equal(sequenceCount(appliedBorrowed.project), 2);

  const edit = { sequences: [{ id: 'seq-existing', name: 'Main Sequence' }] };
  validateSavedReferences(project, edit);
  assert.equal(edit.sequences[0].id, 'seq-existing', 'a real sequence id is kept for editing');
  const appliedEdit = applyBuildChanges(project, edit);
  assert.equal(appliedEdit.warnings.length, 0);
  assert.equal(sequenceCount(appliedEdit.project), 1, 'editing a named sequence creates no replacement');
  console.log('PASS: a sequence entry carrying an invented or borrowed id is created as a new sequence instead of refused, while a real sequence id still edits in place.');
}

// (b) A sequence bundled with a genuinely requested tool applies in one
// pass; the placeholder stand-in board is dropped without refusing the
// sequence; a placeholder offered as the response action still refuses
// so the retry can drop it.
{
  const request = 'Build the round sequence for my show.';
  const combined = { sequences: [{ name: 'Round Flow', steps: [{ controlId: 'start-btn' }] }], newTools: [{ type: 'scoreboard', name: 'Team Scores', config: { entries: [{ id: 'team-a', name: 'Team A', score: 0 }] }, connect: true }] };
  validateSequenceAdditions(request, combined);
  assert.equal(combined.newTools.length, 1, 'a real tool bundled with a sequence is kept');
  const appliedCombined = applyBuildChanges(project, combined);
  assert.equal(appliedCombined.warnings.length, 0);
  assert(appliedCombined.project.gameTools.some((t) => t.type === 'scoreboard' && t.name === 'Team Scores'), 'the bundled scoreboard was created');
  assert.equal(sequenceCount(appliedCombined.project), 2, 'the sequence was created in the same pass');

  const placeholder = { sequences: [{ name: 'Round Flow', steps: [{ controlId: 'start-btn' }] }], newTools: [{ type: 'blank-board', name: 'Round Flow Board', connect: true }] };
  validateSequenceAdditions(request, placeholder);
  assert.equal(placeholder.newTools.length, 0, 'an unrequested blank board bundled with a sequence is dropped as a placeholder');
  const appliedPlaceholder = applyBuildChanges(project, placeholder);
  assert.equal(appliedPlaceholder.warnings.length, 0);
  assert(!appliedPlaceholder.project.gameTools.some((t) => t.type === 'blank-board'));
  assert.equal(sequenceCount(appliedPlaceholder.project), 2, 'the sequence still applies');

  const grounded = { sequences: [{ name: 'Round Flow', steps: [{ controlId: 'start-btn' }] }], newTools: [{ type: 'blank-board', name: 'Announcements', connect: true }] };
  validateSequenceAdditions('Build the round sequence and add an announcement board.', grounded);
  assert.equal(grounded.newTools.length, 1, 'a board the creator actually asked for is kept');

  assert.throws(() => validateSequenceAdditions(request, { sequences: [{ name: 'S', steps: [] }] }, { type: 'tool', toolType: 'blank-board' }), /unrelated/, 'a placeholder board as the response action still refuses so the retry can drop it');
  validateSequenceAdditions(request, { sequences: [{ name: 'S', steps: [] }] }, { type: 'tool', toolType: 'scoreboard' });
  console.log('PASS: a sequence bundled with a real tool applies in one pass, and the placeholder stand-in board is dropped without refusing the sequence.');
}

// (c) A draft-edit validation failure that still reaches the creator is
// plain language: no internal contract terms, no raw validation reason.
// Drives the real /api/jewel route with a stubbed model that returns the
// same contract-breaking edit twice (initial call + the one retry).
const root = path.resolve(__dirname, '..');
function loadModule(file, sandbox, stubs) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Buffer, URL, AbortSignal, console, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto,
    process: sandbox.process, fetch: sandbox.fetch,
    require(name) {
      if (stubs && name in stubs) return stubs[name];
      if (name.startsWith('../../../lib/')) return load(path.join(root, name.replace(/^\.\.\/\.\.\/\.\.\//, '') + '.ts'));
      if (name.startsWith('.')) return loadModule(path.resolve(path.dirname(file), name + '.ts'), sandbox, stubs);
      return require(name);
    },
  });
  return exports;
}
(async () => {
  const calls = [];
  const badEdit = { reply: 'I will make that change.', changes: { gameTools: [{ id: 'ghost-tool', config: { seconds: 45 } }] }, manualSteps: [], needsClarification: false, outcome: 'edit', action: null };
  const queue = [badEdit, badEdit];
  const sandbox = {
    process: { env: { META_API_KEY: 'test-key' } },
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      const next = queue.shift();
      if (!next) throw new Error('Model was called more times than expected.');
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(next) } }] }) };
    },
  };
  const client = loadModule(path.join(root, 'lib/muse-client.ts'), sandbox, {});
  const provider = loadModule(path.join(root, 'lib/assistant-provider.ts'), sandbox, {});
  const stubs = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '../../../lib/auth/server': { requireCreator: async () => ({ email: 'creator@example.com' }) },
    '../../../lib/admin-alerts': {
      isCreditError: (status, message) => status === 402 || /insufficient credit|not enough credit|credit balance|out of credit|exceeded.*quota|quota.*exceeded|billing|payment required/i.test(String(message || '')),
      notifyAdminOfCreditIssue: async () => {},
    },
    '../../../lib/muse-client': client,
    '../../../lib/assistant-provider': provider,
  };
  const route = loadModule(path.join(root, 'app/api/jewel/route.ts'), sandbox, stubs);
  const fixture = { id: 'project-1', assets: [], controls: [], gameTools: [] };
  const response = await route.POST(new Request('https://test/api/jewel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'draft-edit', request: 'Update the saved tool settings.', history: [], project: fixture }) }));
  assert.equal(response.status, 502);
  assert.equal(calls.length, 2, 'the model still gets its one validation retry with the technical reason');
  const data = await response.json();
  assert.equal(data.error, "I couldn't finish that one just now. Nothing was changed, and everything you've made is safe. Ask me again and I'll take another run at it — for a big build, I'll do it in steps.");
  assert(!/executionGuide|sequenceContract|changes\.|newTools|could not apply/i.test(data.error), 'no internal contract terms reach the creator');
  console.log('PASS: a draft-edit validation failure reaches the creator in plain language, with the technical reason kept to the retry and the server log.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
