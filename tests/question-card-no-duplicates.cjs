const assert=require('node:assert/strict'),load=require('./load.cjs');
const {createCardSystem}=load('lib/question-cards.ts');
const {applyBuildChanges}=load('lib/build-edits.ts');

// One Question Cards tool per project (owner ruling, 2026-11-12): every
// creation path — the card factory itself and Jewel's build changes —
// must refuse to mint a second question-card tool (and its button).
const pool={id:'pool',type:'trivia-list',enabled:true,config:{questions:[{question:'Q?',answer:'A'}]}};
const base={id:'p',assets:[],controls:[],compositions:[],overlay:{},assetPools:[],gameTools:[pool]};

// The factory on a fresh project mints exactly one tool + one toggle control.
const fresh=createCardSystem(base);
assert.equal(fresh.gameTools.filter(t=>t.type==='question-card').length,1);
assert.equal(fresh.controls.length,1);
const tool=fresh.gameTools.find(t=>t.type==='question-card');
assert.equal(fresh.controls[0].action,'cards.toggle.'+tool.id);
// …and a second factory call returns the project itself, untouched.
assert.equal(createCardSystem(fresh),fresh,'the guard returns the project unchanged');
assert.equal(createCardSystem(fresh,undefined,'answer'),fresh,'the answer kind mints the same tool type, so it is guarded too');

// Jewel's path: a question-card request creates the system the first time…
const built=applyBuildChanges(base,{newTools:[{type:'question-card',name:'My Cards',config:{poolId:'pool'}}]});
assert.equal(built.project.gameTools.filter(t=>t.type==='question-card').length,1);
assert.equal(built.project.controls.filter(c=>String(c.action).startsWith('cards.toggle.')).length,1,'exactly one cycle button');
const builtTool=built.project.gameTools.find(t=>t.type==='question-card');
assert.equal(builtTool.name,'My Cards');
assert.equal(builtTool.config.poolId,'pool');
// …and a second request is satisfied against the EXISTING tool: same id,
// no new tool, no new button — the requested name still lands on it.
const rebuilt=applyBuildChanges(built.project,{newTools:[{type:'question-card',name:'Renamed Cards',config:{poolId:'pool'}}]});
const rebuiltTool=rebuilt.project.gameTools.find(t=>t.type==='question-card');
assert.equal(rebuilt.project.gameTools.filter(t=>t.type==='question-card').length,1,'a second Jewel request must not mint a duplicate tool');
assert.equal(rebuiltTool.id,builtTool.id,'the existing tool is reused');
assert.equal(rebuiltTool.name,'Renamed Cards','the requested change lands on the existing tool');
assert.equal(rebuilt.project.controls.length,built.project.controls.length,'no second button is created');
console.log('PASS: one Question Cards tool per project — the card factory guard and Jewel build requests both reuse the existing tool instead of minting a duplicate.');
