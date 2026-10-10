const assert=require('node:assert/strict'),load=require('./load.cjs');
const {timerControlRequest,timerTransition,timerLifecycleIntent}=load('lib/timer-controls.ts'),{applyBuildChanges}=load('lib/build-edits.ts');
const control={id:'button',label:'Start Answer Timer',action:'tool.timer',toolIds:['timer'],buttonMode:'chain',chain:[{kind:'tool',refId:'timer'}]};
const project={id:'test',gameTools:[{id:'timer',name:'Answer Timer',type:'countdown',enabled:true,inToolbox:true,config:{seconds:135}}],controls:[control],assets:[],overlay:{},assetPools:[]};
const request='I only want this button to add the timer to the overlay. i will have another button to start and stop the timer';
const response=timerControlRequest(request,[],project,{kind:'control',id:'button'});assert(response);assert(!response.changes.sequences);assert(!response.changes.coinCycles);
for(const wording of ['Create a button to display the countdown on screen without starting it','Just put the timer on the overlay','Show the timer on the overlay; use a separate button to start it'])assert(timerControlRequest(wording,[],project),wording);
const result=applyBuildChanges(project,response.changes);assert.equal(result.warnings.length,0);assert.equal(result.project.controls.find(c=>c.id==='button').action,'timer.show.timer');assert.equal(result.project.controls.find(c=>c.id==='button').chain,undefined);assert(result.project.controls.some(c=>c.action==='timer.toggle.timer'));assert.equal(result.project.gameTools[0].config.seconds,135);assert.equal(project.controls[0].action,'tool.timer');
assert.equal(applyBuildChanges(result.project,response.changes).project.controls.length,2);
assert(timerControlRequest('no that isnt what i want',[{role:'user',text:request}],project));
assert.equal(timerControlRequest('No, only start the timer instead',[{role:'user',text:request}],project),null);
assert.equal(timerControlRequest('Make the timer pink',[],project),null);
assert.equal(timerControlRequest('Make the coin cycle three presses',[],project),null);
let state=timerTransition(undefined,'show',135,1000);assert.equal(state.running,false);assert.equal(state.remaining,135);
state=timerTransition(state,'show',135,9000);assert.equal(state.remaining,135);assert.equal(state.running,false);
state=timerTransition(state,'toggle',135,10000);assert.equal(state.running,true);
state=timerTransition(state,'toggle',135,15000);assert.equal(state.running,false);assert.equal(state.remaining,130);
state=timerTransition(state,'show',135,20000);assert.equal(state.remaining,130);assert.equal(state.running,false);
state=timerTransition(state,'reset',135,21000);assert.equal(state.remaining,135);assert.equal(state.running,false);
console.log('PASS: exact latest correction creates a show-only button and a separate start/pause control; repeat edits do not duplicate controls, duration is preserved, and show never starts or resets countdown.');

for(const text of ['Streamline my timer','Make the timer match my background and streamline it','Do not hide the timer automatically','Start the timer and let me remove it manually'])assert.equal(timerLifecycleIntent(text),false,text);
for(const text of ['Hide the timer when it ends','When the countdown finishes remove it','Automatically hide the timer after the countdown'])assert.equal(timerLifecycleIntent(text),true,text);
const rejected=timerControlRequest('No, that is not what I want',[{role:'user',text:'Hide the timer when it ends'}],project);assert.equal(rejected.needsClarification,true);assert.deepEqual(JSON.parse(JSON.stringify(rejected.changes)),{});
assert.equal(timerControlRequest('Restyle my timer and hide it when it ends',[],project),null);

assert.equal(timerControlRequest('Make the timer blue and only show it on the overlay',[],project),null);
assert.equal(timerControlRequest('Set the timer to 60 seconds and hide it when it ends',[],project),null);
