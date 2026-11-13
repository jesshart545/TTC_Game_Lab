const assert=require('node:assert/strict'),load=require('./load.cjs');
const {instantiateTemplateTools}=load('lib/game-templates.ts');

// One Question Cards tool per project (owner ruling, 2026-11-12) — the
// template path is held to the same rule as the card factory: applying a
// card-bearing template to a project that ALREADY has a question-card
// tool must not add a second one (nor its buttons), while a project
// without one gets the template's card tool and controls exactly as
// before. The three card-bearing templates: trivia-night (tn-card),
// million-quiz (mq-card), escape-room (er-active).

const cardTarget=(action)=>{const m=/^cards\.[a-z-]+\.(.+)$/.exec(action||'');return m?m[1]:null;};

function assertNoDanglingReferences(added){
  const toolIds=new Set(added.gameTools.map(t=>t.id));
  for(const control of added.controls){
    for(const id of control.toolIds||[]) assert.ok(toolIds.has(id),`control "${control.label}" references a tool that was not added`);
    const target=cardTarget(control.action);
    if(target) assert.ok(toolIds.has(target),`control "${control.label}" aims its action at a tool that was not added`);
  }
}

// --- Without an existing Question Cards tool: unchanged behavior. ---
for(const opts of [undefined,{}, {projectHasQuestionCardTool:false}]){
  const added=instantiateTemplateTools('trivia-night',opts);
  assert.equal(added.gameTools.length,4,'trivia-night adds all four tools');
  assert.equal(added.gameTools.filter(t=>t.type==='question-card').length,1,'exactly one question-card tool');
  assert.equal(added.controls.length,6,'all six controls apply');
  const card=added.gameTools.find(t=>t.type==='question-card');
  assert.notEqual(card.id,'tn-card','the card tool id is remapped to a fresh id');
  const pool=added.gameTools.find(t=>t.type==='trivia-list');
  assert.equal(card.config.poolId,pool.id,'the card tool points at the instantiated pool');
  assert.equal(
    added.controls.filter(c=>cardTarget(c.action)===card.id).map(c=>c.action.split('.')[1]).sort().join(','),
    'clear,new-game,reveal,show',
    'the four card controls target the instantiated card tool');
  assertNoDanglingReferences(added);
}

// --- With an existing Question Cards tool: the template's is skipped. ---
{
  const added=instantiateTemplateTools('trivia-night',{projectHasQuestionCardTool:true});
  assert.equal(added.gameTools.filter(t=>t.type==='question-card').length,0,'no second question-card tool');
  assert.equal(added.gameTools.length,3,'the board, pool and scoreboard still apply');
  assert.ok(added.gameTools.some(t=>t.type==='trivia-list'),'the template question pool still lands');
  assert.equal(added.controls.length,2,'only the board and scores controls survive');
  assert.ok(added.controls.every(c=>!String(c.action).startsWith('cards.show.')&&!String(c.action).startsWith('cards.reveal.')&&!String(c.action).startsWith('cards.clear.')&&!String(c.action).startsWith('cards.new-game.')),'no card draw/reveal/clear/new-game buttons for the skipped tool');
  assertNoDanglingReferences(added);
}
{
  const added=instantiateTemplateTools('million-quiz',{projectHasQuestionCardTool:true});
  assert.equal(added.gameTools.filter(t=>t.type==='question-card').length,0,'million-quiz adds no second question-card tool');
  assert.equal(added.gameTools.length,4,'its other four tools still apply');
  assert.equal(added.controls.length,3,'ladder, winnings and lifelines controls survive');
  assertNoDanglingReferences(added);
  const open=instantiateTemplateTools('million-quiz');
  assert.equal(open.gameTools.filter(t=>t.type==='question-card').length,1,'without the flag the quiz card tool applies as today');
  assert.equal(open.controls.length,7,'without the flag all seven controls apply');
}
{
  const added=instantiateTemplateTools('escape-room',{projectHasQuestionCardTool:true});
  assert.equal(added.gameTools.filter(t=>t.type==='question-card').length,0,'escape-room adds no second question-card tool');
  assert.equal(added.gameTools.length,5,'clues, pool, timer, lock and progress still apply');
  assert.equal(added.controls.length,7,'the three Active Puzzle controls are skipped; lock, timer and progress survive');
  const lock=added.gameTools.find(t=>t.type==='blank-card');
  assert.ok(added.controls.some(c=>c.action==='cards.blank.'+lock.id),'the blank-card lock controls are untouched');
  assertNoDanglingReferences(added);
}

// --- Templates without a card tool are untouched by the guard. ---
{
  const added=instantiateTemplateTools('guess-the-word',{projectHasQuestionCardTool:true});
  const open=instantiateTemplateTools('guess-the-word');
  assert.equal(added.gameTools.length,open.gameTools.length,'a card-free template adds the same tools either way');
  assert.equal(added.controls.length,open.controls.length,'a card-free template adds the same controls either way');
}

console.log('PASS: template question-card guard — a card-bearing template applied to a project that already has Question Cards skips the duplicate tool and its buttons; everything else (and every no-card project) applies exactly as before.');
