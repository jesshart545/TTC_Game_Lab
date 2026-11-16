const assert=require('node:assert/strict'),load=require('./load.cjs');
// Values loaded through the vm test loader live in another realm, so
// structural comparisons go through JSON rather than deepStrictEqual.
const eq=(actual,expected,msg)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected),msg);
const {SETUP_PIECES,defaultSetupPieces,applySetupPieces,setupPiecesForKind}=load('lib/project-kinds.ts');
const {createProject}=load('lib/project.ts');
const {buildReadiness}=load('lib/build-readiness.ts');
const {addCreationControl}=load('lib/build-controls.ts');
const {GAME_TEMPLATES}=load('lib/game-templates.ts');

// Jessica, 2026-11-14: game tools "are simply an option" — they are not
// placed in a new project, and not on the dashboard, unless the creator
// picks them, customizes them, and adds them as a feature of their game.

// 1. The shelf of options is unchanged — every piece is still offered on
// the setup screen — but nothing is on by default, for any kind.
eq(SETUP_PIECES.map(p=>p.id),['question-cards','game-wheel','dice','timer','scoreboard','video-clips'],'the setup shelf still offers every piece');
assert(SETUP_PIECES.every(p=>p.defaultOn===false),'no setup piece is on by default');
for(const kind of ['gameshow','talk','radio','multiplayer'])eq(defaultSetupPieces(kind),[],kind+' pre-taps no pieces');
eq(setupPiecesForKind('talk').map(p=>p.id),['question-cards','video-clips'],'talk still offers its own two options');
eq(setupPiecesForKind('gameshow').length,6,'gameshow still offers the full shelf');
console.log('PASS: every setup piece remains an option and none is pre-tapped for any kind.');

// 2. A fresh project built the way the app builds one (createProject plus
// the scratch flow's default pieces) carries no game tools at all — in
// particular not the Game Wheel that used to arrive unchosen.
for(const kind of ['gameshow','talk']){
 const fresh=applySetupPieces({...createProject(''),kind},defaultSetupPieces(kind));
 eq(fresh.gameTools,[],'a fresh '+kind+' project starts with no tools');
 assert(!fresh.gameTools.some(t=>['wheel','countdown','scoreboard'].includes(t.type)),'no unchosen wheel, countdown or scoreboard');
}
console.log('PASS: fresh projects built the app way contain no unchosen default game tools.');

// 3. Pieces the creator actually taps still mint their tools — choosing
// remains a real choice with its existing result.
const tapped=applySetupPieces({...createProject(''),kind:'gameshow'},['game-wheel','timer']);
eq(tapped.gameTools.map(t=>t.type),['wheel','countdown'],'tapped pieces still mint their tools');
console.log('PASS: pieces the creator taps still add their tools.');

// 4. Templates a creator actively chooses still bring their tools —
// picking a template IS a creator decision and is unchanged.
const drafts=GAME_TEMPLATES.filter(t=>!t.restricted).map(t=>t.buildDraft());
assert(drafts.length>0&&drafts.every(d=>Array.isArray(d.gameTools)),'templates still build drafts');
assert(drafts.some(d=>d.gameTools.length>0),'at least one template still brings its tools');
console.log('PASS: template application is unchanged.');

// 5. Publish readiness: an unconnected tool is simply not a feature of
// the game, so it never blocks publishing. This is the exact shape that
// blocked throwaway projects twice on 2026-11-14 — the unchosen default
// Game Wheel sitting in the toolbox with no dashboard button.
const base=(gameTools,controls=[])=>({kind:'gameshow',name:'Option Shelf Show',assets:[],controls,gameTools,overlay:{title:'OPTION SHELF SHOW'}});
const wheel={id:'wheel1',type:'wheel',name:'Game Wheel',enabled:true,inToolbox:true,config:{segments:['Prize','Challenge','Bonus','Mystery']}};
eq(buildReadiness(base([wheel])),[],'an unconnected wheel blocks nothing');
const countdown={id:'cd1',type:'countdown',name:'Countdown',enabled:true,inToolbox:true,config:{seconds:60}};
eq(buildReadiness(base([countdown])),[],'an unconnected countdown blocks nothing — no timer-button demand either');
const scoreboard={id:'sb1',type:'scoreboard',name:'Scoreboard',enabled:true,inToolbox:true,config:{entries:[{id:'a',name:'Team A'},{id:'b',name:'Team B'}]}};
eq(buildReadiness(base([wheel,countdown,scoreboard])),[],'the full old default shape publishes clean');
console.log('PASS: unconnected tools are unused options and never block publishing.');

// 6. A CONNECTED timer still owes its specific buttons: one timer button
// is not enough, and wiring all three operations clears the row. The
// specific-button rules are untouched for tools that are in the game.
const partial=base([countdown],[{id:'t-show',label:'Show Countdown',action:'timer.show.cd1',detail:'',toolIds:['cd1']}]);
assert(buildReadiness(partial).some(i=>i.id==='timer-controls-cd1'),'a connected countdown still needs Show, Start/pause and Hide');
const wired=base([countdown],['show','toggle','hide'].map(op=>({id:'t-'+op,label:op+' Countdown',action:'timer.'+op+'.cd1',detail:'',toolIds:['cd1']})));
assert(!buildReadiness(wired).some(i=>i.id==='timer-controls-cd1'),'a fully wired countdown has no timer row');
eq(buildReadiness(wired),[],'a fully wired countdown publishes clean');
console.log('PASS: connected timers keep their specific-button rule; unconnected timers have none.');

// 7. Adding a tool as a feature still wires its standard dashboard
// button in the same action — the add path is untouched.
const shelf={...createProject(''),kind:'gameshow',controls:[],gameTools:[{id:'wheel9',type:'wheel',name:'Game Wheel',enabled:true,inToolbox:true,config:{segments:['Prize']}}]};
const added=addCreationControl(shelf,'tool','wheel9');
assert(added.project.controls.some(c=>c.action==='tool.wheel9'&&(c.toolIds||[]).includes('wheel9')),'adding the wheel as a feature brings its dashboard button with it');
console.log('PASS: adding a tool as a feature still wires its dashboard button in the same action.');
