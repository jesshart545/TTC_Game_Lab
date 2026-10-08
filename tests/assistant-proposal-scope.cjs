const assert=require('node:assert/strict'),fs=require('fs'),load=require('./load.cjs');
const {validateSequenceAdditions,validateCompletionClaim}=load('lib/ai-edit-validation.ts');
const {SUPPORT_CATALOG}=load('lib/site-support.ts');
const timer={sequences:[{name:'Auto start and hide',steps:[{controlId:'start',delaySeconds:0},{controlId:'hide',delaySeconds:30}]}]};
const request='Add one button that starts my existing Answer Timer and automatically hides it when the countdown finishes.';
validateSequenceAdditions(request,timer);
assert.throws(()=>validateSequenceAdditions(request,{...timer,newTools:[{type:'blank-board',name:'Start & Auto-Hide Timer',connect:true}]}),/unrelated/);
assert.throws(()=>validateSequenceAdditions(request,{...timer,newTools:[{type:'scoreboard',name:'Scores',connect:true}]}),/unrelated/);
validateSequenceAdditions(request+' Also add a blank board for announcements.',{...timer,newTools:[{type:'blank-board',name:'Announcements',connect:true}]});
validateSequenceAdditions(request+' Also add a scoreboard for my teams.',{...timer,newTools:[{type:'scoreboard',name:'Scores',connect:true}]});
validateSequenceAdditions('Create a blank board',{newTools:[{type:'blank-board',connect:true}]});
assert.throws(()=>validateCompletionClaim({reply:"I've updated the colors but I removed the automatic sequence as instructed.",changes:{gameTools:[{id:'timer',config:{appearance:{backgroundColor:'#000000'}}}]}}),/has not executed/);
validateCompletionClaim({reply:'The prepared color changes will match the sampled background. Should removal be automatic or manual?',changes:{gameTools:[{id:'timer',config:{appearance:{backgroundColor:'#000000'}}}]}});
assert.throws(()=>validateCompletionClaim({reply:'I removed the sequence.',changes:{removeControls:['existing-sequence']}}),/has not executed/);
assert.throws(()=>validateCompletionClaim({reply:'I removed the blank board from the proposal.',changes:timer}),/has not executed/);
validateCompletionClaim({reply:'The prepared patch will remove the requested sequence.',changes:{removeControls:['existing-sequence']}});
assert.throws(()=>validateSequenceAdditions(request,timer,{type:'tool',toolType:'blank-board'}),/unrelated/);
validateSequenceAdditions('Add a team leaderboard and an intro sequence',{...timer,newTools:[{type:'scoreboard',connect:true}]});
const entry=SUPPORT_CATALOG.find(e=>e.id==='countdown');assert(entry);assert(entry.excerpt.includes('not implemented countdown features'));assert(entry.excerpt.includes('start/pause'));assert(entry.excerpt.includes('fade'));
const route=fs.readFileSync('app/api/ai/route.ts','utf8');assert(route.includes('validateSequenceAdditions(String(body.request||""), parsed.changes, parsed.action)'));assert(route.includes('FINAL accepted proposal'));
console.log('PASS: sequences create their own button without unrelated placeholder tools; explicitly requested compound tools remain possible; repair cannot claim nonexistent removals; countdown support is grounded.');

const {normalizeDraftChanges,applyDraftChanges}=load('lib/draft-edit.ts');
const input={gameTools:[{id:'timer',appearance:{backgroundColor:'#000000',textColor:'#ffffff'},placement:{x:30},config:{appearance:{backgroundColor:'#281912'}}}]};
const before=JSON.stringify(input),canonical=normalizeDraftChanges(input);
assert.equal(canonical.gameTools[0].appearance,undefined);assert.equal(canonical.gameTools[0].config.appearance.backgroundColor,'#281912');assert.equal(canonical.gameTools[0].config.appearance.textColor,'#ffffff');assert.equal(canonical.gameTools[0].config.placement.x,30);assert.equal(JSON.stringify(input),before);
const original={assets:[],overlay:{},controls:[],gameTools:[{id:'timer',type:'countdown',config:{seconds:30,placement:{x:5,y:10,width:20,height:20},appearance:{accentColor:'#ffeeaa'}}}]};
const updated=applyDraftChanges(original,input).project;assert.equal(updated.gameTools[0].config.appearance.backgroundColor,'#281912');assert.equal(updated.gameTools[0].config.appearance.accentColor,'#ffeeaa');assert.equal(updated.gameTools[0].config.placement.y,10);assert.equal(updated.gameTools[0].config.seconds,30);assert.equal(original.gameTools[0].config.appearance.backgroundColor,undefined);
console.log('PASS: captured compound timer proposal applies actual appearance and sequence; normalization preserves explicit config, other fields and original objects.');

for(const value of ['bad',null,[],3])for(const key of ['appearance','placement','questionCard','answerCard']){
 assert.throws(()=>normalizeDraftChanges({gameTools:[{id:'timer',[key]:value}],sequences:timer.sequences}),/must be an object/);
 assert.throws(()=>normalizeDraftChanges({gameTools:[{id:'timer',config:{[key]:value}}],sequences:timer.sequences}),/must be an object/);
}
const {supportCatalogExcerpts}=load('lib/site-support.ts');
const multiple=supportCatalogExcerpts('How do I trim a video and create a trivia pool?',{scope:'project:test',page:'project',stage:'build',section:'game-tools'});
assert(multiple.some(e=>e.id==='editing'));assert(multiple.some(e=>e.id==='trivia-research'));assert(multiple.length<=4);
const countdown=supportCatalogExcerpts('Suggest ways I could improve my Answer Timer',{scope:'project:test',page:'project',section:'game-tools'});assert.equal(countdown[0].id,'countdown');
console.log('PASS: malformed tool design patches are rejected; multi-feature help retains editing and research context.');
