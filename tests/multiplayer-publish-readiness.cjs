const assert=require('node:assert/strict'),load=require('./load.cjs');
const {buildReadiness,publishReviewSummary}=load('lib/build-readiness.ts');
const bingo=load('lib/bingo.ts');

const ITEMS=Array.from({length:25},(_,i)=>`Item ${i+1}`);
const cardList=(id,items)=>({id,type:'card-list',name:'Call Items',enabled:true,inToolbox:true,config:{cards:items.map((text,i)=>({id:`${id}-c${i+1}`,text,design:{}}))}});
// The exact defect shape from the 2026-11-12 live test: a game night whose
// default tools (wheel, countdown, scoreboard) have NO dashboard buttons or
// connections, plus one stray unassigned control.
const unwiredTools=[
 {id:'wheel1',type:'wheel',name:'Game Wheel',enabled:true,inToolbox:true,config:{}},
 {id:'cd1',type:'countdown',name:'Countdown',enabled:true,inToolbox:true,config:{}},
 {id:'sb1',type:'scoreboard',name:'Scoreboard',enabled:true,inToolbox:true,config:{}},
];
const unwiredControls=[{id:'empty',label:'Unfinished',action:'',detail:''}];

// (a) Multiplayer + a playable bingo pool (>= 5 items) + zero dashboard
// wiring is publish-ready: no issues at all.
const ready={kind:'multiplayer',name:'Bingo Test Night',theme:'purple',assets:[],controls:[...unwiredControls],gameTools:[...unwiredTools,cardList('list-1',ITEMS)]};
assert.equal(buildReadiness(ready).length,0,'a multiplayer project with a playable card list needs no dashboard wiring');
// The picker-linked shape the Playlist Bingo template uses is ready too.
const pickerReady={kind:'multiplayer',name:'Playlist Bingo Night',theme:'cyan',assets:[],controls:[],gameTools:[cardList('songs',ITEMS),{id:'picker-1',type:'random-picker',name:'Draw',enabled:true,inToolbox:true,config:{source:'cards',listId:'songs'}}]};
assert.equal(buildReadiness(pickerReady).length,0,'a picker-linked card list is a playable game night');
// A card list carrying config.items instead of cards is the same pool the
// bingo extraction reads, so it counts too.
const itemsReady={kind:'multiplayer',name:'Items Night',theme:'purple',assets:[],controls:[],gameTools:[{id:'list-9',type:'card-list',name:'Words',enabled:true,config:{items:['alpha','bravo','charlie','delta','echo']}}]};
assert.equal(buildReadiness(itemsReady).length,0,'config.items pools count, exactly as the share route reads them');
console.log('PASS: multiplayer projects with a playable bingo pool publish with no dashboard wiring at all.');

// (b) Multiplayer with nothing playable is blocked by exactly ONE
// plain-language issue — no dashboards, buttons or connections mentioned.
const MESSAGE='Your game night needs something to play: add a card list with at least 5 items, or a quiz board with questions — ask Jewel to build one for you.';
const bare={kind:'multiplayer',name:'Empty Night',theme:'purple',assets:[],controls:[...unwiredControls],gameTools:[...unwiredTools]};
const bareIssues=buildReadiness(bare);
assert.equal(bareIssues.length,1,'an unplayable game night is blocked by exactly one issue');
assert.equal(bareIssues[0].id,'playable-game');
assert.equal(bareIssues[0].message,MESSAGE);
assert(!/dashboard|button|connect/i.test(bareIssues[0].message),'the blocked reason never mentions dashboards, buttons or connections');
// A card list that is too small does not count, and the issue points at it.
const small={kind:'multiplayer',name:'Small Night',theme:'purple',assets:[],controls:[],gameTools:[cardList('tiny',['one','two','three'])]};
const smallIssues=buildReadiness(small);
assert.equal(smallIssues.length,1);assert.equal(smallIssues[0].message,MESSAGE);assert.equal(smallIssues[0].targetId,'tiny');
// Duplicates do not pad the pool: six cards but only four different items
// yield four call items — the same dedupe the share route applies.
const dupes={kind:'multiplayer',name:'Dupe Night',theme:'purple',assets:[],controls:[],gameTools:[cardList('dupes',['a','b','c','d','A','B'])]};
assert.equal(buildReadiness(dupes).length,1,'a pool that dedupes below 5 items is not playable');
// Readiness and the share route agree by construction: whenever readiness
// blocks, bingoConfigFromSnapshot refuses too, and vice versa.
for(const project of [ready,pickerReady,itemsReady,bare,small,dupes]){
 assert.equal('error' in bingo.bingoConfigFromSnapshot(project),buildReadiness(project).some(i=>i.id==='playable-game'),'readiness and the bingo extraction agree for every fixture');
}
console.log('PASS: multiplayer projects without a playable game are blocked by one plain-language reason, matching the share route.');

// Asset checks still protect a game night whose placed files are not saved.
const browserFile={kind:'multiplayer',name:'Art Night',theme:'purple',assets:[{name:'Browser art',type:'image',inProject:true,inOverlayBuild:true,url:'https://example.com/art.png',storageKey:'browser:art'}],controls:[],gameTools:[cardList('list-1',ITEMS)]};
const fileIssues=buildReadiness(browserFile);
assert.equal(fileIssues.length,1);assert.equal(fileIssues[0].id,'cloud-browser:art');assert.equal(fileIssues[0].kind,'asset');
console.log('PASS: saved-file asset checks still apply to multiplayer, and only when a file is actually placed.');

// (c) Gameshow readiness is unchanged: the same unwired shape still reports
// the dashboard-wiring issues it always has.
const gameshow={kind:'gameshow',name:'Unwired Show',theme:'purple',assets:[],controls:[...unwiredControls],gameTools:[...unwiredTools,cardList('list-1',ITEMS)]};
const showIssues=buildReadiness(gameshow);
const showIds=showIssues.map(i=>i.id);
assert(showIds.includes('control-empty'),'gameshow still reports the unassigned control');
assert(showIds.includes('timer-controls-cd1'),'gameshow still requires the countdown dashboard buttons');
assert(showIds.includes('controls-wheel1'),'gameshow still requires a dashboard button for the wheel');
assert(showIds.includes('controls-sb1'),'gameshow still requires a dashboard button for the scoreboard');
assert(!showIds.includes('playable-game'),'gameshow never gets the game-night reason');
assert.equal(showIssues.find(i=>i.id==='controls-wheel1').message,'Game Wheel: add at least one dashboard button so the host can show or run it.');
console.log('PASS: gameshow readiness output is unchanged for the same unwired project shape.');

// (d) The publish-review panel summary (publishReviewSummary, which the
// panel in app/project/[id]/page.tsx renders from): a game night has no
// host, so its panel never shows the dashboard-buttons row, and dashboard
// controls never gate its "Everything checks out" line.
// Clean multiplayer: checks out, no dashboard row — ready carries only a
// stray unassigned control, and a zero-control game night checks out too.
const cleanNight={...ready,overlay:{title:'BINGO TEST NIGHT'}};
const cleanSummary=publishReviewSummary(cleanNight,buildReadiness(cleanNight));
assert.equal(cleanSummary.titleOk,true);
assert.equal(cleanSummary.dashboardRow,false,'a game night panel shows no dashboard-buttons row');
assert.equal(cleanSummary.checksOut,true,'a clean game night gets the Everything checks out line');
const noControlsNight={...cleanNight,controls:[]};
assert.equal(publishReviewSummary(noControlsNight,buildReadiness(noControlsNight)).checksOut,true,'dashboard controls never gate a game night');
console.log('PASS: a clean game night panel checks out with no dashboard row.');

// Blocked multiplayer: the panel lists exactly the playable-game message,
// still with no dashboard row and no checks-out line.
const blockedNight={...bare,overlay:{title:'EMPTY NIGHT'}};
const blockedIssues=buildReadiness(blockedNight);
const blockedSummary=publishReviewSummary(blockedNight,blockedIssues);
assert.equal(blockedSummary.dashboardRow,false,'a blocked game night still shows no dashboard-buttons row');
assert.equal(blockedSummary.checksOut,false,'a blocked game night does not check out');
assert.equal(blockedIssues.length,1);assert.equal(blockedIssues[0].message,MESSAGE,'the panel lists the playable-game message plainly, and nothing else');
console.log('PASS: a blocked game night panel shows the playable-game message with no dashboard row.');

// Gameshow panel summary is unchanged: the dashboard row is shown, and
// checking out still requires a real title, at least one dashboard button,
// and zero readiness issues.
const showSummary=publishReviewSummary({...gameshow,overlay:{title:'UNWIRED SHOW'}},showIssues);
assert.equal(showSummary.dashboardRow,true,'gameshow keeps the dashboard-buttons row');
assert.equal(showSummary.checksOut,false,'an unwired gameshow does not check out, exactly as before');
const wiredShow={kind:'gameshow',name:'Wired Show',theme:'purple',assets:[],controls:[{id:'go',label:'GO',action:'effect.trigger',detail:''}],gameTools:[],overlay:{title:'WIRED SHOW'}};
assert.equal(buildReadiness(wiredShow).length,0);
const wiredSummary=publishReviewSummary(wiredShow,buildReadiness(wiredShow));
assert.equal(wiredSummary.dashboardRow,true);
assert.equal(wiredSummary.checksOut,true,'a titled, wired, issue-free gameshow checks out exactly as before');
const buttonlessShow={...wiredShow,controls:[]};
assert.equal(publishReviewSummary(buttonlessShow,buildReadiness(buttonlessShow)).checksOut,false,'a gameshow with no dashboard button still does not check out');
console.log('PASS: gameshow panel summary is unchanged.');
