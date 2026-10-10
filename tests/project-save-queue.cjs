const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
const start = page.indexOf('  function persist(next: Project)');
const end = page.indexOf('\n  function saveProjectTitle', start);
const code = ts.transpileModule('export ' + page.slice(start, end).trim(), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(save) {
  const exports = {}, writes = [];
  let release;
  const saveQueue = { current: new Promise(resolve => { release = resolve; }) };
  const context = { exports, Error, saveQueue, saveRevision: { current: 0 }, queuedSaveRevisions: { current: new Map() },
    projectRef: {}, taskRunning: { current: true }, taskSaveError: {},
    saveProjectToServer: async project => { writes.push(project); await save?.(project); },
  };
  for (const name of ['setAiUndo','setSaveStatus','setProject','setAssetStatus']) context[name] = () => {};
  vm.runInNewContext(code, context);
  return { persist: exports.persist, writes, context, release, wait: () => saveQueue.current };
}
const project = (id, name) => ({ id, name, assets: [] });
test('rapid edits save the final project state instead of every queued intermediate state', async () => {
  const h = harness();
  for (const name of ['S','So','Song']) h.persist(project('one', name));
  h.release(); await h.wait();
  assert.deepEqual(h.writes.map(p => p.name), ['Song']);
});
test('switching projects preserves the latest queued save for each project', async () => {
  const h = harness();
  h.persist(project('one','Original')); h.persist(project('one','Edited'));
  h.persist(project('two','Other project'));
  h.release(); await h.wait();
  assert.deepEqual(h.writes.map(p => p.name), ['Edited','Other project']);
});
test('a failed latest save remains visible to the AI task', async () => {
  const h = harness(async () => { throw new Error('Database unavailable'); });
  h.persist(project('one','Edited')); h.release(); await h.wait();
  assert.equal(h.context.taskSaveError.current, 'Database unavailable');
});
