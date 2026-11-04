const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

const { evaluateWorkflow, newlyCompletedSteps, resolveNavigateTarget, validateNavigate, workflowContextBlock, workflowStepKey } = load('lib/workflow-progress.ts');
// Values loaded through the vm test loader live in another realm, so
// structural comparisons go through JSON rather than deepStrictEqual.
const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);

function baseProject(overrides = {}) {
  return {
    id: 'p1', name: 'New Project', slug: 'p1-x', description: '', status: 'Draft', theme: 'cyan',
    updatedAt: 'now', prompt: '', messages: [], controls: [], assets: [], assetPools: [], compositions: [],
    overlay: { title: '', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    wheel: { enabled: false, title: '', segments: [], spinning: false, visible: false },
    gameTools: [], gamePlan: {},
    ...overrides,
  };
}
const step = (evaluation, stageIndex, stepId) => evaluation.stages[stageIndex].steps.find(s => s.id === stepId);

// --- Gameshow Imagine and Create: the seven designed tasks, exact labels ---
{
  const evaluation = evaluateWorkflow(baseProject({ kind: 'gameshow' }));
  eq(evaluation.stages.map(s => s.id), ['create', 'stage', 'showtime']);
  eq(evaluation.stages.map(s => s.label), ['Imagine and Create', 'Set the Stage', 'Showtime!']);
  eq(evaluation.stages[0].steps.map(s => s.id), ['plan', 'media', 'trivia-cards', 'board', 'tools', 'scenes', 'toolbox']);
  eq(evaluation.stages[0].steps.map(s => s.label), [
    'Plan your show',
    'Make your media',
    'Write/generate and customize your trivia cards',
    'Make your game board',
    'Build your game tools',
    'Compose your scenes & effects',
    'Review your toolbox',
  ]);
  // A brand-new project has nothing checked off, and the current task is the plan.
  assert(evaluation.stages.every(stage => stage.steps.every(s => !s.complete)), 'a new project starts with no step complete');
  eq(evaluation.current, { stageId: 'create', stageIndex: 0, stepId: 'plan', label: 'Plan your show' });
  eq(evaluation.next, { stageId: 'create', stageIndex: 0, stepId: 'media', label: 'Make your media' });
  console.log('PASS: gameshow Imagine and Create carries the seven designed tasks in order; a new project starts unchecked with Plan as the current task.');
}

// --- Evaluator matrix: each gameshow step flips on its real substance only ---
{
  const plan = { name: 'Friday Night Lights', gamePlan: { theme: 'neon sports night', winning: 'highest score wins' } };
  assert.equal(step(evaluateWorkflow(baseProject({ kind: 'gameshow', ...plan })), 0, 'plan').complete, true);
  assert.equal(step(evaluateWorkflow(baseProject({ kind: 'gameshow', name: 'Friday Night Lights', gamePlan: { theme: 'neon' } })), 0, 'plan').complete, false, 'no way to win, no plan check');
  assert.equal(step(evaluateWorkflow(baseProject({ kind: 'gameshow', name: 'New LIVE Experience', gamePlan: { theme: 'neon', winning: 'x' } })), 0, 'plan').complete, false, 'a placeholder name is not a plan');

  const withAsset = baseProject({ kind: 'gameshow', assets: [{ name: 'Backdrop', type: 'image/png', storageKey: 'projects/p1/bg.png' }] });
  assert.equal(step(evaluateWorkflow(withAsset), 0, 'media').complete, true);
  const nameless = baseProject({ kind: 'gameshow', assets: [{ name: 'Ghost', type: 'image/png' }] });
  assert.equal(step(evaluateWorkflow(nameless), 0, 'media').complete, false, 'an asset with no saved file is not filed media');
  const pendingOnly = baseProject({ kind: 'gameshow', pendingVideos: [{ videoId: 'v1', model: 'm', prompt: 'intro' }] });
  assert.equal(step(evaluateWorkflow(pendingOnly), 0, 'media').complete, false, 'a pending video request is not media yet');

  const pool = { id: 'pool', type: 'trivia-list', enabled: true, config: { questions: [{ question: 'Q?', answer: 'A' }] } };
  const cardFed = baseProject({ kind: 'gameshow', gameTools: [pool, { id: 'card', type: 'question-card', enabled: true, config: { poolId: 'pool' } }] });
  assert.equal(step(evaluateWorkflow(cardFed), 0, 'trivia-cards').complete, true, 'a question card fed by a question list completes the trivia step');
  const cardStarved = baseProject({ kind: 'gameshow', gameTools: [pool, { id: 'card', type: 'question-card', enabled: true, config: {} }] });
  assert.equal(step(evaluateWorkflow(cardStarved), 0, 'trivia-cards').complete, false, 'an unfed card does not complete the trivia step');
  const written = baseProject({ kind: 'gameshow', gameTools: [{ id: 'list', type: 'card-list', enabled: true, config: { entries: [{ id: 'e1', text: 'My own question' }], cards: [] } }] });
  assert.equal(step(evaluateWorkflow(written), 0, 'trivia-cards').complete, true, 'a written card list completes the trivia step');
  assert.equal(step(evaluateWorkflow(baseProject({ kind: 'gameshow', gameTools: [pool] })), 0, 'trivia-cards').complete, false, 'a question pool alone is not trivia cards');

  const boarded = baseProject({ kind: 'gameshow', gameTools: [{ id: 'b', type: 'blank-board', enabled: true, config: {} }] });
  assert.equal(step(evaluateWorkflow(boarded), 0, 'board').complete, true);
  assert.equal(step(evaluateWorkflow(boarded), 0, 'tools').complete, false, 'a board alone is not a game tool');
  const tooled = baseProject({ kind: 'gameshow', gameTools: [{ id: 'w', type: 'wheel', enabled: true, inToolbox: true, config: {} }] });
  assert.equal(step(evaluateWorkflow(tooled), 0, 'tools').complete, true, 'setup arrivals count as built tools');
  assert.equal(step(evaluateWorkflow(baseProject({ kind: 'gameshow', gameTools: [{ id: 'w', type: 'wheel', enabled: false, config: {} }] })), 0, 'tools').complete, false, 'a disabled tool does not count');

  const composed = baseProject({ kind: 'gameshow', compositions: [{ id: 'c1', name: 'Intro', duration: 5, clips: [], createdAt: 'now' }] });
  assert.equal(step(evaluateWorkflow(composed), 0, 'scenes').complete, true);
  console.log('PASS: each Imagine and Create step completes on its real substance and nothing else.');
}

// --- Toolbox: needs every earlier step AND the recorded opening ---
{
  const full = {
    kind: 'gameshow',
    name: 'Friday Night Lights',
    gamePlan: { theme: 'neon', winning: 'highest score' },
    assets: [{ name: 'Backdrop', type: 'image/png', storageKey: 'projects/p1/bg.png' }],
    gameTools: [
      { id: 'pool', type: 'trivia-list', enabled: true, config: { questions: [{ question: 'Q?', answer: 'A' }] } },
      { id: 'card', type: 'question-card', enabled: true, config: { poolId: 'pool' } },
      { id: 'b', type: 'blank-board', enabled: true, config: {} },
      { id: 'w', type: 'wheel', enabled: true, config: {} },
    ],
    compositions: [{ id: 'c1', name: 'Intro', duration: 5, clips: [], createdAt: 'now' }],
  };
  assert.equal(step(evaluateWorkflow(baseProject(full)), 0, 'toolbox').complete, false, 'all substance but never opened: not complete');
  const opened = baseProject({ ...full, workflowProgress: { toolboxOpened: true } });
  assert.equal(step(evaluateWorkflow(opened), 0, 'toolbox').complete, true);
  const openedEarly = baseProject({ kind: 'gameshow', workflowProgress: { toolboxOpened: true } });
  assert.equal(step(evaluateWorkflow(openedEarly), 0, 'toolbox').complete, false, 'opening the toolbox early does not complete it');
  console.log('PASS: the toolbox step needs every earlier step complete AND the toolbox actually opened.');
}

// --- Check-off honesty: a stored record never overrides a false evaluator ---
{
  const lying = baseProject({
    kind: 'gameshow',
    workflowProgress: { toolboxOpened: true, rehearsed: true, issuedChecks: ['create:plan', 'create:media'] },
  });
  const evaluation = evaluateWorkflow(lying);
  assert.equal(step(evaluation, 0, 'plan').complete, false, 'an issued check on record does not make the plan complete');
  assert.equal(step(evaluation, 0, 'media').complete, false);
  assert.equal(step(evaluation, 1, 'rehearsed').complete, true, 'rehearsal is an action fact: the record IS its substance');
  // newlyCompletedSteps only reports true transitions.
  const before = evaluateWorkflow(baseProject({ kind: 'gameshow' }));
  const after = evaluateWorkflow(baseProject({ kind: 'gameshow', name: 'Named', gamePlan: { theme: 't', winning: 'w' } }));
  eq(newlyCompletedSteps(before, after).map(s => workflowStepKey(s.stageId, s.stepId)), ['create:plan']);
  eq(newlyCompletedSteps(after, after), []);
  console.log('PASS: stored records never override a false evaluator; transitions are reported exactly once.');
}

// --- Kind gating: each kind gets its own honest step set ---
{
  for (const kind of ['radio', 'multiplayer', undefined]) {
    const evaluation = evaluateWorkflow(baseProject({ kind }));
    eq(evaluation.stages[0].steps.map(s => s.id), ['plan', 'media', 'tools', 'scenes', 'toolbox'], `kind ${kind} gets the generic Imagine and Create set`);
  }
  // Talk Show or Classroom has its own topic model — Jessica's design
  // (2026-11-04): the sequence lives in Jewel's conversation; theme is a
  // creation-seeded fact, and there is NO sign step — the sign and the
  // background always go together, one combined piece of work. Its
  // evaluators live in lib/workflow-progress.ts beside these.
  const talkEvaluation = evaluateWorkflow(baseProject({ kind: 'talk' }));
  eq(talkEvaluation.stages[0].steps.map(s => s.id), ['theme', 'background', 'prompt', 'research', 'quiz', 'media', 'missed'], 'kind talk gets the Talk Show or Classroom set');
  assert.equal(talkEvaluation.stages[0].steps.some(s => s.id === 'sign'), false, 'no sign step exists in the talk model');
  const talk = evaluateWorkflow(baseProject({ kind: 'talk', name: 'Morning Show', gamePlan: { theme: 'chat', winning: 'n/a' }, assets: [{ name: 'Theme', type: 'audio/mp3', url: 'https://example.com/t.mp3' }] }));
  assert.equal(step(talk, 0, 'theme').complete, true, 'the creation-seeded theme fact is answered — the topic model starts from it');
  assert.equal(step(talk, 0, 'background').complete, false, 'an audio theme is not a background');
  assert.equal(step(talk, 0, 'media').complete, true, 'a filed theme song is media beyond the background');
  console.log('PASS: kind gating — radio, multiplayer and unset kinds get the generic set; talk gets its own designed set, honestly evaluated.');
}

// --- Set the Stage and Showtime derive from Build Space / publish reality ---
{
  let evaluation = evaluateWorkflow(baseProject({ kind: 'gameshow' }));
  eq(evaluation.stages[1].steps.map(s => s.id), ['background', 'placed', 'buttons', 'rehearsed', 'readiness']);
  eq(evaluation.stages[2].steps.map(s => s.id), ['checks', 'published', 'live']);
  assert(evaluation.stages[1].steps.every(s => !s.complete) && evaluation.stages[2].steps.every(s => !s.complete));

  const staged = baseProject({
    kind: 'gameshow',
    name: 'Friday Night Lights',
    overlay: { title: 'FRIDAY NIGHT LIGHTS', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    assets: [{ name: 'Backdrop', type: 'image/png', storageKey: 'projects/p1/bg.png', url: 'https://example.com/bg.png', inProject: true, role: 'background' }],
    controls: [{ id: 'c1', label: 'Show wheel', action: 'tool.w1', detail: 'Show the wheel' }],
    gameTools: [{ id: 'w1', type: 'wheel', enabled: true, inToolbox: true, inOverlayBuild: true, config: { segments: ['A', 'B'] } }],
    workflowProgress: { rehearsed: true },
  });
  evaluation = evaluateWorkflow(staged);
  assert.equal(step(evaluation, 1, 'background').complete, true);
  assert.equal(step(evaluation, 1, 'placed').complete, true);
  assert.equal(step(evaluation, 1, 'buttons').complete, true);
  assert.equal(step(evaluation, 1, 'rehearsed').complete, true);
  assert.equal(step(evaluation, 1, 'readiness').complete, true, 'a connected wheel with a real button passes readiness');
  assert.equal(step(evaluation, 2, 'checks').complete, true);
  assert.equal(step(evaluation, 2, 'published').complete, false);
  eq(evaluation.current.stepId, 'plan', 'current is the first incomplete step in stage order, stages included');

  const unassigned = { ...staged, controls: [{ id: 'c1', label: 'Show wheel', action: 'tool.w1', detail: '' }, { id: 'c2', label: 'Blank', action: 'unassigned', detail: '' }] };
  assert.equal(step(evaluateWorkflow(unassigned), 1, 'buttons').complete, false, 'an unassigned button has no decided job');

  const published = { ...staged, status: 'Published', publishedSnapshot: { ...staged } };
  evaluation = evaluateWorkflow(published);
  assert.equal(step(evaluation, 2, 'published').complete, true);
  assert.equal(step(evaluation, 2, 'live').complete, true);
  console.log('PASS: Set the Stage and Showtime steps derive from placement, controls, rehearsal, readiness, and publish state.');
}

// --- Progress record round-trip through the normal save shape (JSON) ---
{
  const record = { toolboxOpened: true, rehearsed: false, issuedChecks: ['create:plan'] };
  const project = baseProject({ kind: 'gameshow', workflowProgress: record });
  const revived = JSON.parse(JSON.stringify(project));
  eq(revived.workflowProgress, record, 'the record survives a JSON round-trip unchanged');
  assert.equal(step(evaluateWorkflow(revived), 1, 'rehearsed').complete, false);
  console.log('PASS: the workflowProgress record round-trips through JSON exactly as saved.');
}

// --- Navigation directives: validated against the model and the project ---
{
  const project = baseProject({
    kind: 'gameshow',
    controls: [{ id: 'c1', label: 'Show', action: 'tool.w1', detail: '' }],
    gameTools: [{ id: 'w1', type: 'wheel', enabled: true, config: {} }],
    assets: [{ name: 'Backdrop', type: 'image/png', storageKey: 'projects/p1/bg.png' }],
  });
  eq(resolveNavigateTarget(project, 'c1'), { kind: 'control', id: 'c1' });
  eq(resolveNavigateTarget(project, 'w1'), { kind: 'tool', id: 'w1' });
  eq(resolveNavigateTarget(project, 'projects/p1/bg.png'), { kind: 'asset', id: 'projects/p1/bg.png' });
  assert.equal(resolveNavigateTarget(project, 'nope'), null);

  eq(validateNavigate(project, { stage: 0, stepId: 'plan' }), { stage: 0, stepId: 'plan' });
  eq(validateNavigate(project, { stage: 1, stepId: 'rehearsed' }), { stage: 1, stepId: 'rehearsed' });
  eq(validateNavigate(project, { stage: 2 }), { stage: 2 });
  eq(validateNavigate(project, { stage: 1, stepId: 'buttons', targetId: 'c1' }), { stage: 1, stepId: 'buttons', targetId: 'c1' });
  assert.equal(validateNavigate(project, { stage: 3 }), null, 'stage out of range is stripped');
  assert.equal(validateNavigate(project, { stage: -1 }), null);
  assert.equal(validateNavigate(project, { stage: 0, stepId: 'rehearsed' }), null, 'a Set the Stage step does not exist in the Workshop stage');
  assert.equal(validateNavigate(project, { stage: 0, stepId: 'not-a-step' }), null);
  assert.equal(validateNavigate(project, { stage: 1, targetId: 'missing-id' }), null, 'an unknown target is stripped');
  assert.equal(validateNavigate(project, null), null);
  assert.equal(validateNavigate(project, 'stage 1'), null);
  // Kind gating reaches navigation too: a talk project has no trivia-cards
  // or generic tools step to go to — its own steps are the valid targets.
  const talk = baseProject({ kind: 'talk' });
  assert.equal(validateNavigate(talk, { stage: 0, stepId: 'trivia-cards' }), null);
  assert.equal(validateNavigate(talk, { stage: 0, stepId: 'tools' }), null);
  eq(validateNavigate(talk, { stage: 0, stepId: 'quiz' }), { stage: 0, stepId: 'quiz' });
  // Jewel records a skip inside her navigate directive when the creator
  // declines an optional talk topic — validated against the same model:
  // only a skippable Imagine and Create step of this project qualifies.
  eq(validateNavigate(talk, { stage: 0, stepId: 'media', skipStepId: 'quiz' }), { stage: 0, stepId: 'media', skipStepId: 'quiz' });
  eq(validateNavigate(talk, { stage: 1, skipStepId: 'missed' }), { stage: 1, skipStepId: 'missed' }, 'a final skip may ride along with the move to Set the Stage');
  assert.equal(validateNavigate(talk, { stage: 0, stepId: 'prompt', skipStepId: 'background' }), null, 'the background is not skippable — the directive is stripped');
  assert.equal(validateNavigate(talk, { stage: 0, stepId: 'media', skipStepId: 'sign' }), null, 'there is no sign step to skip');
  assert.equal(validateNavigate(talk, { stage: 2, skipStepId: 'quiz' }), null, 'a skip cannot ride into Showtime!');
  assert.equal(validateNavigate(project, { stage: 0, stepId: 'media', skipStepId: 'media' }), null, 'a gameshow project has no skippable steps');
  console.log('PASS: navigate directives validate against stage range, per-kind step lists, and saved item ids — anything else is stripped.');
}

// --- The context block Jewel reads is compact and truthful ---
{
  const evaluation = evaluateWorkflow(baseProject({ kind: 'gameshow', name: 'Named', gamePlan: { theme: 't', winning: 'w' } }));
  const block = workflowContextBlock(evaluation);
  assert.equal(block.currentTask, 'Make your media');
  assert.equal(block.afterThat, 'Write/generate and customize your trivia cards');
  assert.equal(block.stages[0].steps[0].done, true);
  assert(block.stages[0].steps[0].checkLine.includes('name, a theme, and a way to win'), 'completed steps carry their checkLine for Jewel to speak');
  assert.equal(block.stages[0].steps[1].checkLine, undefined, 'incomplete steps carry no checkLine');
  console.log('PASS: the progress block Jewel reads names the current task, what follows, and checkLines only for verified steps.');
}

// --- Source guards: route, panel, and page carry the spine ---
{
  const route = fs.readFileSync('app/api/jewel/route.ts', 'utf8');
  assert(route.includes('evaluateWorkflow(body.project)'), 'the Jewel route computes the workflow model each turn');
  assert(route.includes('workflowProgress: workflowEvaluation ? workflowContextBlock(workflowEvaluation) : undefined'), 'the progress block rides in her context');
  assert(route.includes('validateNavigate(body.project,'), 'her navigate directives are validated server-side');
  assert(route.includes('...(navigate ? { navigate } : {})'), 'a validated directive is returned to the client');
  assert(route.includes('JEWEL_WORKFLOW_ADDENDUM'), 'she is instructed from the model, including its checkLines');

  const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
  assert(panel.includes('jewel-progress'), 'her panel carries the compact progress strip');
  assert(panel.includes('Next: {nextTask.label}'), 'the strip names the next task');
  assert(panel.includes('onNavigateStep(nextTask.stageIndex,nextTask.stepId)'), 'the strip button performs the same navigation as a directive');
  assert(panel.includes('step.complete?"✓ "'), 'chips show a check only for evaluator-complete steps');

  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('surfaceJewelCheckoffs'), 'the page surfaces check-offs when a Jewel turn completes a step');
  assert(page.includes('✓ Checked off — ${step.checkLine}'), 'check-offs speak the computed checkLine in her voice');
  assert(page.includes('honorJewelNavigate(jewelNavigate)'), 'the page honors her validated directives');
  assert(page.includes('recordWorkflowFact({ rehearsed: true })'), 'pressing a draft control records the rehearsal');
  assert(page.includes('recordWorkflowFact({ toolboxOpened: true })'), 'landing on the toolbox records the opening');
  assert(page.includes('workflow={evaluateWorkflow(project)}'), 'the panel receives the live evaluation');
  const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
  assert(buildSpace.includes('"review"'), 'Build Space accepts a review entry — the readiness step has a real screen to land on');
  console.log('PASS: route, panel, page, and Build Space all carry the spine.');
}

console.log('JEWEL WORKFLOW SPINE: all assertions passed.');
