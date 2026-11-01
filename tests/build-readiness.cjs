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

// Cloud-stored assets: a file kept only in the browser is its own checklist row.
p.assets.push({name:'Browser-only art',type:'image',inProject:true,url:'https://example.com/art.png',storageKey:'browser:art'});
const cloudIssue=buildReadiness(p).find(i=>i.id==='cloud-browser:art');
assert(cloudIssue,'a browser-only file must appear in the checklist');
assert.equal(cloudIssue.kind,'asset');assert.equal(cloudIssue.fix,'background');assert.equal(cloudIssue.targetId,'browser:art');
// Every row the checklist can show carries a fix target.
assert(buildReadiness(p).every(i=>i.fix&&i.targetId),'every readiness row exposes a fix target');
// Moving the same file to cloud storage clears the row.
p.assets[p.assets.length-1].storageKey='projects/test/art.png';
assert(!buildReadiness(p).some(i=>i.id.startsWith('cloud-')));
// A browser-only file with no usable URL gets one row, not two.
p.assets.push({name:'Blob art',type:'image',inProject:true,url:'blob:https://example.com/x',storageKey:'browser:blob'});
assert.equal(buildReadiness(p).filter(i=>i.targetId==='browser:blob').length,1);
// A background button pointing at a browser-only file is flagged too (the publish check's own reach).
const bgOnly={assets:[{name:'Show background',type:'image',url:'https://example.com/bg.png',storageKey:'browser:bg'}],controls:[{id:'bgbtn',label:'Show background',action:'background.show.browser:bg',detail:'Change background'}],gameTools:[]};
assert(buildReadiness(bgOnly).some(i=>i.id==='cloud-browser:bg'));
console.log('PASS: readiness lists browser-only files as cloud rows with fix targets, clears them once cloud-stored, and never double-lists one file.');

// Publish panel markup: the outcome of a publish click renders inside the Publish
// review panel, and every checklist row's Fix button is wired to its real target.
const fs=require('node:fs');
const pageSource=fs.readFileSync('app/project/[id]/page.tsx','utf8');
const buildSource=fs.readFileSync('components/BuildSpace.tsx','utf8');
const reviewStart=pageSource.indexOf('<section className="publish-review" aria-label="Before publishing"');
assert(reviewStart>=0,'the Publish review panel exists');
const outcomeRender=pageSource.indexOf('className="publish-outcome"',reviewStart);
const actionsRow=pageSource.indexOf('publish-review-actions',reviewStart);
assert(outcomeRender>reviewStart&&outcomeRender<actionsRow,'the publish outcome renders in the Publish panel by the Publish button');
assert((pageSource.match(/setPublishOutcome\(/g)||[]).length>=5,'blockers, the cloud check, success and failure all set the panel outcome');
// The title Fix goes to the Game plan title field, never to a bare stage switch.
assert(pageSource.includes('onClick={openGamePlanEntry}>Fix in Workshop'));
assert(!pageSource.includes('onClick={() => chooseWorkflowStep(0)}>Fix in Workshop'),'the title fix must not land on a bare Workshop switch');
assert(pageSource.includes('getElementById("game-title")'),'the title fix targets the Game plan title field');
assert(pageSource.includes('classList.add("fix-highlight")'),'fix landings highlight the target field');
// Issue rows and the no-background row carry Fix buttons too.
assert(pageSource.includes('onClick={() => fixChecklistIssue(issue)}'),'every readiness row renders a Fix button');
assert(pageSource.includes('onClick={() => requestBuildEntry("background", true)}>Fix in Build Space'),'the no-background row has a Fix button');
// Build Space accepts a fix entry request and selects the exact item.
assert(buildSource.includes('"fix"')&&buildSource.includes('fixTarget'),'Build Space fix entries select the named tool or control');
console.log('PASS: publish outcomes render in the Publish panel and checklist Fix buttons target the Game plan title field, the named Build Space item, and the background picker.');

