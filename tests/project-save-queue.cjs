const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
// The queue machinery persist() once carried inline now lives in
// enqueueSave, the page's single guarded writer, which persist() calls;
// extract from there so the span holds both halves of the save path.
const start = page.indexOf('  function enqueueSave(next: Project');
const end = page.indexOf('\n  function saveProjectTitle', start);
const code = ts.transpileModule('export ' + page.slice(start, end).trim() + '\nexports.persist = persist;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(save) {
  const exports = {}, writes = [];
  let release;
  const saveQueue = { current: new Promise(resolve => { release = resolve; }) };
  const context = { exports, Error, saveQueue, saveRevision: { current: 0 }, queuedSaveRevisions: { current: new Map() },
    projectRef: {}, taskRunning: { current: true }, taskSaveError: {},
    // enqueueSave records the object last written to the server here.
    lastSavedProject: { current: null },
    // Stubs for the collaborators persist has since grown: the CCS title
    // sync (identity for these fixtures) and the manual-history hook
    // (the extracted span builds it at module level).
    titleFromProjectTools: project => project.name,
    historyRef: { current: null },
    useManualHistory: () => ({ recordHistory() {}, undo() {}, redo() {}, historyDepth: { undo: 0, redo: 0 }, suppressHistory: { current: false } }),
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
