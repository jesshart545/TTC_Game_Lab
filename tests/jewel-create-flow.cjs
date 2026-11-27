const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),ts=require('typescript');

// Minimal TS/TSX module loader (tests/load.cjs pattern, plus JSX + CSS stubs).
const cache={};
function loadModule(file){
  const abs=path.resolve(__dirname,'..',file);
  if(cache[abs])return cache[abs];
  const exports={};cache[abs]=exports;
  const code=ts.transpileModule(fs.readFileSync(abs,'utf8'),{compilerOptions:{jsx:abs.endsWith('.tsx')?ts.JsxEmit.ReactJSX:undefined,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},fileName:abs}).outputText;
  const localRequire=(id)=>{
    if(id.endsWith('.css'))return {};
    if(id.startsWith('.')){
      const base=path.join(path.dirname(abs),id);
      for(const cand of [base+'.tsx',base+'.ts',base]){if(fs.existsSync(cand)&&fs.statSync(cand).isFile())return loadModule(path.relative(path.resolve(__dirname,'..'),cand));}
      throw new Error('cannot resolve '+id+' from '+file);
    }
    return require(id);
  };
  vm.runInNewContext(code,{exports,require:localRequire,crypto:require('node:crypto').webcrypto,Uint32Array,Date,Math,Set,Map,AbortController,AbortSignal,setTimeout,clearTimeout,console});
  return exports;
}
const read=(f)=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
const {applyBuildChanges}=loadModule('lib/build-edits.ts');
const {addCreationControl}=loadModule('lib/build-controls.ts');
const {cardTransition,freshCardState}=loadModule('lib/question-cards.ts');
const project=(gameTools=[])=>({id:'proj',name:'Show',assets:[],controls:[],compositions:[],gameTools,assetPools:[],overlay:{}});

/* ---------- (a) Create-area creates file tools: unplaced, unwired ----------
 * Jessica, 2026-11-26: in Imagine & Create, creating files the work in
 * the project — even if a connect:true slips through in the changes, the
 * tool is not placed on the stage/overlay and gets no dashboard button. */
{
  const types=[
    ['wheel',{segments:['Gold','Silver']}],
    ['scoreboard',{entries:[{id:'red',name:'Red',score:0}]}],
    ['countdown',{seconds:30}],
    ['plinko',{slots:['10','50'],rows:8}],
    ['sound-board',{}],
    ['dj-deck',{}],
    ['bank',{}],
  ];
  for(const [type,config] of types){
    const r=applyBuildChanges(project(),{newTools:[{type,name:'New '+type,config,connect:true}]},{createArea:true});
    const tool=r.project.gameTools.find(t=>t.type===type);
    assert(tool,`create-area create makes the ${type}`);
    assert(!tool.inOverlayBuild,`create-area ${type} is filed UNPLACED even with connect:true`);
    assert.equal(tool.inToolbox,true,`create-area ${type} is in the toolbox (filed in the project)`);
    assert.equal(r.project.controls.length,0,`create-area ${type} mints NO dashboard controls`);
  }
  console.log('PASS: create-area creates (wheel, scoreboard, countdown, plinko, sound-board, dj-deck, bank) are filed unplaced with no minted controls, even when connect:true slips through.');
}

/* ---------- (a2) Create-area wiring mints the asked-for buttons but never places ---------- */
{
  // Timer wiring for an existing, unplaced countdown.
  const base=project([{id:'timer-1',type:'countdown',name:'Timer',enabled:true,inToolbox:true,config:{seconds:30}}]);
  const wired=applyBuildChanges(base,{timerControls:[{toolId:'timer-1'}]},{createArea:true});
  assert(wired.project.controls.some(c=>c.action==='timer.show.timer-1'),'create-area timer wiring still mints the Show button');
  assert(wired.project.controls.some(c=>c.action==='timer.toggle.timer-1'),'create-area timer wiring still mints the Start / Stop button');
  assert(!wired.project.gameTools.find(t=>t.id==='timer-1').inOverlayBuild,'create-area timer wiring does NOT place the timer');
  const staged=applyBuildChanges(base,{timerControls:[{toolId:'timer-1'}]});
  assert.equal(staged.project.gameTools.find(t=>t.id==='timer-1').inOverlayBuild,true,'the same wiring outside the create area still places (staging behavior unchanged)');
  // Coin cycle wiring for an existing, unplaced coin.
  const coinBase=project([{id:'coin-1',type:'coin-toss',name:'Coin',enabled:true,inToolbox:true,config:{}}]);
  const cycled=applyBuildChanges(coinBase,{coinCycles:[{toolId:'coin-1'}]},{createArea:true});
  assert(cycled.project.controls.some(c=>c.action==='coin.cycle.coin-1'),'create-area coin wiring still mints the cycle button');
  assert(!cycled.project.gameTools.find(t=>t.id==='coin-1').inOverlayBuild,'create-area coin wiring does NOT place the coin');
  console.log('PASS: create-area wiring (timerControls, coinCycles) mints its buttons without placing the tool; default behavior unchanged.');
}

/* ---------- (b) Question Cards: filed unplaced, fully live after staging ---------- */
{
  let p=project();
  p=applyBuildChanges(p,{newTools:[{type:'trivia-list',name:'Qs',config:{questions:[{question:'First question?',answer:'One'},{question:'Second question?',answer:'Two'}]}}]},{createArea:true}).project;
  const pool=p.gameTools.find(t=>t.type==='trivia-list');
  assert(pool,'the trivia list was created');
  const created=applyBuildChanges(p,{newTools:[{type:'question-card',name:'Quiz Cards',config:{poolId:pool.id}}]},{createArea:true});
  const card=created.project.gameTools.find(t=>t.type==='question-card');
  assert(card,'create-area create makes the question-card system');
  assert(!card.inOverlayBuild,'create-area question-card is filed UNPLACED');
  assert(!created.project.controls.some(c=>c.action===`cards.toggle.${card.id}`),'create-area question-card mints NO cycle button');
  // The live gate (lib/card-server changeCard) refuses an unplaced system.
  const gate=(proj)=>proj.gameTools.find(t=>t.id===card.id&&t.enabled&&t.inOverlayBuild&&(t.type==='question-card'||t.type==='blank-card'||t.type==='random-picker'||t.type==='scoreboard'||t.type==='game-tool-list'));
  assert(!gate(created.project),'the unplaced card system is refused by the live gate — it is filed, not staged');
  // Staging it (the Set the Stage connect path) restores full function.
  const staged=addCreationControl(created.project,'tool',card.id).project;
  const stagedCard=staged.gameTools.find(t=>t.id===card.id);
  assert.equal(stagedCard.inOverlayBuild,true,'connecting in Set the Stage places the card system');
  assert(staged.controls.some(c=>c.action===`cards.toggle.${card.id}`),'connecting mints the single cycle button');
  assert(gate(staged),'the staged card system passes the live gate');
  // The sanctioned one-button cycle runs end to end on the staged system.
  let state=freshCardState();
  state=cardTransition(staged,stagedCard,state,'toggle');
  assert(state.question&&!state.cleared,'cycle press 1 draws a question');
  state=cardTransition(staged,stagedCard,state,'toggle');
  assert(state.revealAt!==null,'cycle press 2 reveals the answer');
  state=cardTransition(staged,stagedCard,state,'toggle');
  assert(state.cleared,'cycle press 3 clears the card');
  console.log('PASS: question-card created in the create area is filed unplaced with no button; after the Set the Stage connect it is placed, gated live, and its draw/reveal/clear cycle runs.');
}

/* ---------- (c) The build-stage path and explicit connections are unchanged ---------- */
{
  const built=applyBuildChanges(project(),{newTools:[{type:'wheel',name:'Wheel',config:{segments:['A','B']},connect:true}]});
  const wheel=built.project.gameTools.find(t=>t.type==='wheel');
  assert.equal(wheel.inOverlayBuild,true,'default (Set the Stage) create+connect still places the tool');
  assert(built.project.controls.some(c=>(c.toolIds||[]).includes(wheel.id)),'default create+connect still mints its dashboard button');
  const builtFlag=applyBuildChanges(project(),{newTools:[{type:'wheel',name:'Wheel',config:{segments:['A','B']},connect:true}]},{createArea:false});
  assert.equal(builtFlag.project.gameTools.find(t=>t.type==='wheel').inOverlayBuild,true,'createArea:false behaves exactly as the default');
  // An explicit same-breath connection in the create area is the sanctioned
  // mechanism and still places exactly what the creator asked for.
  const filed=applyBuildChanges(project(),{newTools:[{type:'scoreboard',name:'Scores',config:{entries:[]}}]},{createArea:true}).project;
  const board=filed.gameTools.find(t=>t.type==='scoreboard');
  const connected=applyBuildChanges(filed,{connections:[{kind:'tool',id:board.id}]},{createArea:true});
  assert.equal(connected.project.gameTools.find(t=>t.id===board.id).inOverlayBuild,true,'an explicit changes.connections in the create area still connects and places');
  console.log('PASS: build-stage create+connect is unchanged, and explicit same-breath connections still work in the create area.');
}

/* ---------- (d) Prompt pins: create-only teaching + the led concept flow ---------- */
{
  for(const route of ['app/api/jewel/route.ts','app/api/ai/route.ts']){
    const src=read(route);
    assert(src.includes('CREATING IS NOT CONNECTING'),`${route}: teaches create-only in the create area`);
    assert(src.includes('never add connect:true to a new tool'),`${route}: forbids connect on create outside Build Space`);
    assert(!src.includes(',name,config,connect:true'),`${route}: the newTools instruction no longer carries connect:true`);
    assert(!src.includes('Create and connect using changes.newTools'),`${route}: the scoreboard example no longer teaches create-and-connect`);
    assert(!src.includes('config:{},connect:true}'),`${route}: the City Crime Scene addendum no longer teaches connect on create`);
    assert(src.includes('BUILDING A CONCEPT IN THE CREATE AREA'),`${route}: carries the concept build-out flow`);
    assert(src.includes('YOU lead the build-out'),`${route}: Jewel leads the build-out from the concept`);
    assert(src.includes('a clearer workup of their idea'),`${route}: Jewel works the pitch up and the creator confirms the concept before anything is built`);
    assert(src.includes('Start with the BACKGROUND: first ask whether they want a still image or movement'),`${route}: the background comes first, still vs movement asked before describing`);
    assert(src.includes("Let's start with your background. Describe to me how you visualize your game looking."),`${route}: Jewel names the background first and prompts for the creator's description`);
    assert(src.includes('nothing the creator has not approved gets filed'),`${route}: confirmation comes BEFORE filing — unapproved work is not saved`);
    assert(src.includes('ONE THING AT A TIME'),`${route}: one piece at a time, pieces are never merged`);
    assert(src.includes('lost in the sauce'),`${route}: carries Jessica's one-thing-at-a-time principle in her words`);
    assert(src.includes('attend ONLY to the current piece'),`${route}: no jumping ahead when the creator names another tool in the same breath`);
    assert(src.includes('advertisements, commercial breaks, video clips, starting clip segments, ending clip segments, turn breaks'),`${route}: before staging, Jewel asks about any other media the creator wants`);
    assert(src.includes('Are we finished with media now?'),`${route}: staging waits for the creator's clear finish with media; Jewel clarifies when it is unclear`);
    assert(src.includes("get the creator's approval BEFORE you do it"),`${route}: announce-then-approve — Jewel says what she is about to do and gets approval first, every time`);
    assert(src.includes('TAILOR YOUR QUESTIONS TO THE PIECE'),`${route}: questions are tailored to the kind of piece, never a one-size checklist`);
    assert(src.includes('For a die you would NOT ask for a topic'),`${route}: piece-specific questions — a topic is a trivia-card question, not a dice question`);
    assert(src.includes('if the concept needs 20 trivia cards'),`${route}: the same cycle runs to completion for every piece before moving on`);
    assert(src.includes('HARD RULE — NO STAGING DURING CREATION'),`${route}: hard rule — no staging during creation, stated plainly`);
    assert(src.includes('HARD RULE — NO FALSIFICATIONS'),`${route}: hard rule — no falsifications, stated plainly`);
    assert(src.includes("you don't lie to our users"),`${route}: carries Jessica's no-lying rule in her words`);
    assert(src.includes('never invent style, theme, color, subject, or wording details they did not give'),`${route}: no invented details — creation follows the creator's description`);
    assert(src.includes('never say pieces are placed on the stage or the overlay'),`${route}: check-off truthfulness for the create area`);
    assert(src.includes('createArea: body.workspaceStage !== "build"')||src.includes('createArea:body.workspaceStage!=="build"'),`${route}: validation threads the stage into applyBuildChanges`);
  }
  const jewel=read('app/api/jewel/route.ts');
  assert(jewel.includes('Create and connect a new tool in one edit with changes.newTools [{..., connect:true}]'),'the Set the Stage addendum keeps create-and-connect for the build stage');
  const page=read('app/project/[id]/page.tsx');
  assert(page.includes('createArea: workflowStep !== 1'),'the client executor threads its stage into applyBuildChanges');
  console.log('PASS: both routes teach create-only creation and the led, describe-approve-file-next concept flow; Set the Stage keeps create-and-connect; stage intent is threaded at every apply site.');
}

console.log('JEWEL CREATE FLOW: ALL PASS');
