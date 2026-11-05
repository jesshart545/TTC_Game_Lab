// Save lineage + honest check-offs — the guarantees behind the fix for
// the lost-backdrop failure (project-1793770257912, Jewel Test Talk
// Show): a generated backdrop landed in the project, then a stale
// whole-document save from another writer erased the asset entry from
// the server while talkDeck and workflowProgress.issuedChecks carried
// forward — so the project kept a check-off for evidence that no
// longer existed, and the slide the backdrop belonged to lost its
// picture.
//
// The three guarantees pinned here:
//  1. ONE WRITER, ONE LINEAGE. On the project page every whole-
//     document write goes through enqueueSave — the single queued,
//     revision-guarded path persist() uses. No direct
//     saveProjectToServer call remains for the open project outside
//     it, and the writers that once built saves from render-closure
//     state now derive from projectRef. The /assets page re-reads
//     each project immediately before saving and applies its single
//     change onto the fresh copy.
//  2. CHECKS VERIFIED AGAINST THE SAVED DOCUMENT. Jewel's check-off
//     surfacing drains the save queue, then evaluates against the
//     project as last written to the server (a fresh re-read, falling
//     back to the exact object last passed to the save) — never the
//     in-memory draft alone.
//  3. RECONCILE HISTORY WITH EVIDENCE. Completion derives from the
//     evaluators against the current project, never from the
//     issuedChecks record: a check whose evidence is gone does not
//     count as complete (talk and gameshow, create and stage), the
//     record itself stays intact, and when the evidence genuinely
//     returns the step newly completes again so the check can be
//     re-issued. A settled check (evidence standing, already complete
//     when the turn began) is not re-spoken.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

const { evaluateWorkflow, newlyCompletedSteps } = load('lib/workflow-progress.ts');

function baseProject(overrides = {}) {
  return {
    id: 'project-x', name: 'Show', prompt: '', kind: undefined,
    assets: [], tools: [], controls: [], messages: [],
    workflow: { stage: 0, workshopStep: 0, promptDraft: '' },
    gamePlan: { theme: '', format: '', audience: '', notes: '' },
    talkPlan: { format: '', audience: '', promise: '', notes: '' },
    talkDeck: [],
    workflowProgress: { issuedChecks: [] },
    updatedAt: '',
    ...overrides,
  };
}
const backdrop = { name: 'Backdrop', type: 'image/png', role: 'background', inProject: true };
function stepState(project, stageId, stepId) {
  const stage = evaluateWorkflow(project).stages.find(candidate => candidate.id === stageId);
  return stage.steps.find(candidate => candidate.id === stepId);
}
const count = (text, needle) => text.split(needle).length - 1;
const body = (text, startMarker, endMarker) => {
  const start = text.indexOf(startMarker);
  assert(start >= 0, `source marker found: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  assert(end > start, `source end marker found after ${startMarker}: ${endMarker}`);
  return text.slice(start, end);
};

// --- (a) One writer, one lineage — the project page -------------------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('function enqueueSave('), 'the page has the single guarded writer every save funnels through');
  assert.equal(count(page, 'saveProjectToServer('), 2, 'the only direct server saves left are enqueueSave itself and beginBlank creating a brand-new project — no writer saves the open project around the guarded path');

  const persistBody = body(page, 'function persist(next: Project', '\n  const history = useManualHistory');
  assert(persistBody.includes('void enqueueSave(next);'), 'persist saves through enqueueSave');
  assert(!persistBody.includes('saveProjectToServer'), 'persist carries no save machinery of its own anymore');

  const generateBody = body(page, 'async function generateAsset(', '\n  function placeSceneImage');
  assert(generateBody.includes('await enqueueSave(savedProject);'), 'generateAsset saves its result through the guarded queue — the write that once landed a backdrop an unqueued save then erased');
  assert(!generateBody.includes('saveProjectToServer'), 'generateAsset never direct-saves');

  const filesBody = body(page, 'async function handleFiles(', '\n  async function queueOrGenerate');
  assert(filesBody.includes('const latest = projectRef.current || project;'), 'uploads derive from projectRef, never the render-closure snapshot');
  assert(filesBody.includes('await enqueueSave(savedProject);'), 'uploads save through the guarded queue');
  assert(!filesBody.includes('saveProjectToServer'), 'uploads never direct-save');

  const deleteBody = body(page, 'async function doDeleteAsset(', '\n  async function handleFiles');
  assert(deleteBody.includes('const current = projectRef.current || project;'), 'asset deletion derives from projectRef');
  assert(deleteBody.includes('await enqueueSave(next);'), 'asset deletion saves through the guarded queue before the storage delete');
  assert(!deleteBody.includes('saveProjectToServer'), 'asset deletion never direct-saves');

  const undoBody = body(page, 'async function undoAssistantEdit(', '\n  function trigger');
  assert(undoBody.includes('await enqueueSave(restored);'), 'the AI undo confirms its save through the guarded queue');

  const publishBody = body(page, 'async function publish(', '\n  function saveComposition');
  assert(publishBody.includes('await enqueueSave(next, { publish: true, hostKey });'), 'publish writes through the guarded queue and can tell when its write was overtaken');
  console.log('PASS: (a) one writer, one lineage on the project page — generation, uploads, deletion, undo, publish and persist itself all save through the single queued, revision-guarded enqueueSave, and every writer derives from projectRef.');
}

// --- (b) /assets re-reads before it writes ----------------------------------
{
  const library = fs.readFileSync('app/assets/page.tsx', 'utf8');
  assert(library.includes('loadProjectFromServer'), 'the library page can re-read a project from the server');
  assert(library.includes('saveFreshProject'), 'every library save goes through the re-read-then-apply helper');
  assert(!library.includes('persistProject'), 'the snapshot-saving helper is gone — nothing on the page saves its page-load copy anymore');
  assert.equal(count(library, 'saveProjectToServer('), 1, 'the one direct save left on the page lives inside the re-read helper');
  const helper = body(library, 'async function saveFreshProject', '\n  async function handleDelete');
  assert(helper.indexOf('await loadProjectFromServer(projectId)') < helper.indexOf('await saveProjectToServer(next)'), 'the re-read lands before the write, and the write is the change applied onto the fresh copy');
  console.log('PASS: (b) /assets saves re-read each project immediately before writing and apply their single change onto the fresh copy — a library save can no longer erase what the project page just landed.');
}

// --- (c) Checks are verified against the saved document ---------------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  const surface = body(page, 'const surfaceJewelCheckoffs', '\n    const complete = (');
  assert(surface.includes('await saveQueue.current'), 'check-off surfacing waits for the turn\'s saves to drain before it evaluates anything');
  assert(surface.includes('loadProjectFromServer(originId)'), 'surfacing re-reads the project from the server');
  assert(surface.includes('lastSavedProject.current'), 'and falls back to the exact object last passed to the save');
  assert(surface.includes('evaluateWorkflow(basis)'), 'the evaluation runs against that saved document — never the in-memory draft alone');
  assert(surface.includes('checkoffChain'), 'surfacing is serialized so one turn\'s verification cannot race the next');
  assert(!page.includes('.filter(step => !issued.includes('), 'the old settle-by-record suppression is gone: an issued key by itself no longer settles or silences a step');
  console.log('PASS: (c) a check is issued only after the turn\'s saves have drained, evaluated against the project as last written to the server.');
}

// --- (d) History reconciles with evidence -----------------------------------
{
  // The stored shape of the failure: the check for the backdrop was
  // issued, then the backdrop asset entry vanished from the document.
  // The record still lists the check — history stays intact — but the
  // steps it named are NOT complete, on either kind, at either stage.
  const talkLost = baseProject({ kind: 'talk', workflowProgress: { issuedChecks: ['create:background'] } });
  assert.equal(stepState(talkLost, 'create', 'background').complete, false, 'talk create:background is not complete when its backdrop is gone, however long the check has been issued');
  assert.equal(stepState(talkLost, 'stage', 'background').complete, false, 'talk stage:background is not complete when its backdrop is gone');
  // Gameshow carries its backdrop evidence in create:media (any filed
  // asset) and stage:background (a background-role asset) — the same
  // rule holds there: issued, but evidence gone, means not complete.
  const gameLost = baseProject({ kind: 'gameshow', workflowProgress: { issuedChecks: ['create:media', 'stage:background'] } });
  assert.equal(stepState(gameLost, 'create', 'media').complete, false, 'gameshow create:media is not complete when its media is gone');
  assert.equal(stepState(gameLost, 'stage', 'background').complete, false, 'gameshow stage:background is not complete when its backdrop is gone');
  assert.deepEqual(talkLost.workflowProgress.issuedChecks, ['create:background'], 'the issuedChecks record itself is kept intact — only its power to settle a step is gone');

  // With the evidence standing, the same steps complete.
  const talkKept = baseProject({ kind: 'talk', assets: [backdrop], workflowProgress: { issuedChecks: ['create:background'] } });
  assert.equal(stepState(talkKept, 'create', 'background').complete, true, 'talk create:background completes on a standing backdrop');
  assert.equal(stepState(talkKept, 'stage', 'background').complete, true, 'talk stage:background completes on a standing backdrop');
  const filedClip = { name: 'Clip', type: 'video/mp4', storageKey: 'projects/x/clip.mp4' };
  const gameKept = baseProject({ kind: 'gameshow', assets: [backdrop, filedClip], workflowProgress: { issuedChecks: ['create:media', 'stage:background'] } });
  assert.equal(stepState(gameKept, 'create', 'media').complete, true, 'gameshow create:media completes on filed media');
  assert.equal(stepState(gameKept, 'stage', 'background').complete, true, 'gameshow stage:background completes on a standing backdrop');

  // When the evidence genuinely returns, the step newly completes
  // again — the transition the surfacing speaks — even though the
  // record already carries the key from before the loss.
  const returned = newlyCompletedSteps(evaluateWorkflow(talkLost), evaluateWorkflow(talkKept));
  assert(returned.some(step => step.stageId === 'create' && step.stepId === 'background'), 'a backdrop that genuinely returns newly completes create:background, so its check can be re-issued');

  // And a settled check is not re-spoken: a step complete before and
  // after the turn produces no new completion to surface.
  const settled = newlyCompletedSteps(evaluateWorkflow(talkKept), evaluateWorkflow(talkKept));
  assert(!settled.some(step => step.stepId === 'background'), 'a step whose evidence stood throughout surfaces nothing new');
  console.log('PASS: (d) an issued check counts only while its evidence stands — talk and gameshow, create and stage; the record is kept, the step re-opens when the evidence goes, and the check can be re-issued when the evidence genuinely returns.');
}
