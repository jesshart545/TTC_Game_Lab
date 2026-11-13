const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('lib/question-cards.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const lists={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/card-lists.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:lists,crypto:require('node:crypto').webcrypto,Uint32Array});
const exported={};vm.runInNewContext(output,{exports:exported,require:id=>id==='./card-lists'?lists:require('./load.cjs')('lib/game-tools.ts'),crypto:require('node:crypto').webcrypto,Date,Math,Set});
const {createCardSystem,freshCardState,cardTransition,cardPhase,publicCardState,questionPool,cardControl}=exported;
let p={id:'test',gameTools:[{id:'pool',type:'trivia-list',enabled:true,config:{questions:[{question:'First question?',answer:'First answer'},{question:'Second question?',answer:'Second answer'},{prompt:'First question?',answer:'Duplicate must not repeat'}]}}],controls:[]};
p=createCardSystem(p);const tool=p.gameTools.find(t=>t.type==='question-card');
assert.equal('turnTimerId' in tool.config,false);assert.equal('stealTimerId' in tool.config,false);
assert.equal(questionPool(p,tool).length,2);let state=freshCardState();state=cardTransition(p,tool,state,'show',1000,()=>.8);assert.equal(state.question.answer,'Second answer');assert.equal('turnAt' in state,false);assert.equal('stealAt' in state,false);assert.equal(publicCardState(p,tool,state,1000).question.answer,'');
assert.throws(()=>cardTransition(p,tool,state,'show',1000),/Finish or clear/);
assert.equal(cardPhase(p,tool,state,1000000),'question');assert.equal(publicCardState(p,tool,state,1000000).question.answer,'');
assert.throws(()=>cardTransition(p,tool,state,'turn',5000),/Invalid card action/);assert.throws(()=>cardTransition(p,tool,state,'steal',5000),/Invalid card action/);
state=cardTransition(p,tool,state,'reveal',12000);assert.equal(cardPhase(p,tool,state,12000),'answer');
const reloaded=JSON.parse(JSON.stringify(state));state=cardTransition(p,tool,reloaded,'show',13000,()=>.8);assert.equal(state.question.answer,'First answer');assert.equal(state.used.length,2);assert.equal('turnAt' in state,false);assert.equal('stealAt' in state,false);state=cardTransition(p,tool,state,'reveal',14000);assert.equal(cardPhase(p,tool,state,14000),'answer');assert.throws(()=>cardTransition(p,tool,state,'show',15000),/No unused/);
state=cardTransition(p,tool,state,'new-game',16000);assert.equal(state.used.length,0);assert.equal(cardPhase(p,tool,state,16000),'hidden');state=cardTransition(p,tool,state,'show',17000,()=>0);assert.equal(state.question.answer,'First answer');
const b=createCardSystem(p,undefined,'blank');const blank=b.gameTools.find(t=>t.type==='blank-card');let bs=cardTransition(b,blank,freshCardState(),'blank',1000,Math.random,'Private text');assert.equal(bs.blankText,'Private text');assert.equal(cardPhase(b,blank,bs,1000),'question');bs=cardTransition(b,blank,bs,'clear',2000);assert.equal(cardPhase(b,blank,bs,2000),'hidden');
// One-button cycle (cards.toggle on a question-card tool): press 1 draws a
// random unused question, press 2 reveals its answer, press 3 clears the
// card, press 4 draws the next unused question — no repeats until the pool
// is exhausted, and the answer stays hidden from the audience before reveal.
let cycle=freshCardState();
cycle=cardTransition(p,tool,cycle,'toggle',20000,()=>0);
assert.equal(cycle.question.answer,'First answer');assert.equal(cycle.cleared,false);assert.equal(cycle.revealAt,null);
assert.equal(cardPhase(p,tool,cycle,20000),'question');
assert.equal(publicCardState(p,tool,cycle,20000).question.answer,'','the answer stays hidden until the reveal press');
cycle=cardTransition(p,tool,cycle,'toggle',21000);
assert.equal(cardPhase(p,tool,cycle,21000),'answer');
assert.equal(publicCardState(p,tool,cycle,21000).question.answer,'First answer');
cycle=cardTransition(p,tool,cycle,'toggle',22000);
assert.equal(cycle.cleared,true);assert.equal(cardPhase(p,tool,cycle,22000),'hidden');
cycle=cardTransition(p,tool,cycle,'toggle',23000,()=>0);
assert.equal(cycle.question.answer,'Second answer','the fourth press draws the next unused question — no repeats');
assert.equal(cycle.used.length,2);
cycle=cardTransition(p,tool,cycle,'toggle',24000);
assert.equal(cardPhase(p,tool,cycle,24000),'answer');
cycle=cardTransition(p,tool,cycle,'toggle',25000);
assert.equal(cycle.cleared,true);
assert.throws(()=>cardTransition(p,tool,cycle,'toggle',26000),/No unused questions remain/,'an exhausted pool refuses the draw press just like Show does');
cycle=cardTransition(p,tool,cycle,'new-game',27000);
cycle=cardTransition(p,tool,cycle,'toggle',28000,()=>0);
assert.equal(cycle.question.answer,'First answer','Start new game resets the pool for the cycle button');
// A new card system is created with exactly ONE dashboard control — the
// cycle button — and blank systems still get none.
const freshSystem=createCardSystem({gameTools:[{id:'pool',type:'trivia-list',enabled:true,config:{questions:[{question:'Q?',answer:'A'}]}}],controls:[]});
const freshTool=freshSystem.gameTools.find(t=>t.type==='question-card');
assert.equal(freshSystem.controls.length,1);
assert.equal(freshSystem.controls[0].action,'cards.toggle.'+freshTool.id);
assert.equal(Array.from(freshSystem.controls[0].toolIds).join(','),freshTool.id);
assert.equal(cardControl(freshSystem.controls[0].action).action,'toggle');
assert.equal(createCardSystem({gameTools:[],controls:[]},undefined,'blank').controls.length,0);
// One Question Cards tool per project: with a question-card tool already
// present (p has one), createCardSystem returns the project unchanged —
// no second tool, no second cycle button. The 'answer' kind mints the
// same question-card tool type, so it is guarded too. Blank cards are
// exempt: b already holds one blank card and may gain another.
const dupe=createCardSystem(p);
assert.equal(dupe,p,'createCardSystem returns the project unchanged when a question-card tool already exists');
assert.equal(dupe.gameTools.filter(t=>t.type==='question-card').length,1);
assert.equal(dupe.controls.length,p.controls.length,'no second cycle button is minted');
assert.equal(createCardSystem(p,undefined,'answer'),p,'the answer kind is guarded too — it creates the same tool type');
const blankAgain=createCardSystem(b,undefined,'blank');
assert.equal(blankAgain.gameTools.filter(t=>t.type==='blank-card').length,2,'blank cards are exempt — several may coexist');
assert.equal(blankAgain.gameTools.filter(t=>t.type==='question-card').length,1);
// Steady remote label (2026-11-12): the question-card cycle button keeps
// its saved label in every state. The draw/remove "Remove …" label swap
// belongs to the random picker's toggle only — while a question or its
// answer is up, the cycle button must NOT rename itself "Remove Question
// Cards"; its one label names the cycle, not the current press.
const {controlLabel}=require('./load.cjs')('lib/game-tools.ts');
const cycleControl=p.controls.find(c=>c.action==='cards.toggle.'+tool.id);
assert(cycleControl,'the minted cycle control is present');
assert.equal(controlLabel(p,cycleControl,{}),'Question Cards','no state yet — the saved label');
assert.equal(controlLabel(p,cycleControl,{[tool.id]:freshCardState()}),'Question Cards','cleared — the saved label');
let labelState=cardTransition(p,tool,freshCardState(),'toggle',30000,()=>0);
assert.equal(controlLabel(p,cycleControl,{[tool.id]:labelState}),'Question Cards','question showing — still the saved label, never "Remove Question Cards"');
labelState=cardTransition(p,tool,labelState,'toggle',31000);
assert.equal(cardPhase(p,tool,labelState,31000),'answer');
assert.equal(controlLabel(p,cycleControl,{[tool.id]:labelState}),'Question Cards','answer showing — still the saved label');
console.log('PASS: one-button question card cycle — draw, reveal, clear, next draw; no repeats; exhaustion refused; answer hidden before reveal; new systems mint the single cycle button.');
console.log('PASS: paired answers, random unused draw, no repeats after reload, timer-free manual reveal, exhaustion, explicit game reset and blank cards.');
