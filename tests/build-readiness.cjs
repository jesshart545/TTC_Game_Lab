const assert=require('node:assert/strict'),load=require('./load.cjs');
const cards=load('lib/question-cards.ts'),connections=load('lib/control-connections.ts'),{buildReadiness}=load('lib/build-readiness.ts');
let p=cards.createCardSystem({assets:[],controls:[],gameTools:[]});
assert(buildReadiness(p).some(i=>i.id.startsWith('pool-')));
p.gameTools.push({id:'pool',type:'trivia-list',enabled:true,config:{questions:[{question:'What is 2 + 2?',answer:'4'}]}});
const card=p.gameTools.find(t=>t.type==='question-card');card.config.poolId='pool';
assert.equal(buildReadiness(p).length,0);
card.inOverlayBuild=false;assert(buildReadiness(p).some(i=>i.id.startsWith('overlay-')));
p.controls=[];assert(buildReadiness(p).some(i=>i.id.startsWith('buttons-')));
p=connections.connectQuestionCard(p,card.id);assert.equal(buildReadiness(p).length,0);
p.controls.push({id:'empty',label:'Unfinished',action:'',detail:''});assert(buildReadiness(p).some(i=>i.targetId==='empty'));
p.assets.push({name:'Missing media',type:'image',inProject:true});assert(buildReadiness(p).some(i=>i.kind==='asset'));
assert.equal(card.config.turnTimerId,undefined);assert.equal(card.config.stealTimerId,undefined);
console.log('PASS: readiness detects missing pools, overlay destinations, card controls, unassigned buttons and missing media; connected timer-free cards pass.');

