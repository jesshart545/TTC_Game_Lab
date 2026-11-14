const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');

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
const project=(gameTools)=>({id:'proj',name:'Show',assets:[],controls:[],compositions:[],gameTools,assetPools:[],overlay:{}});
const tool=(type,config)=>({id:'tool-'+type,type,name:type,enabled:true,inOverlayBuild:true,inToolbox:true,config});

/* ---------- (a) Standing renders are wired into every surface ---------- */
const overlay=read('app/published/[slug]/overlay/page.tsx');
assert(overlay.includes('StandingToolFace'),'published overlay renders standing faces for the chance games and the picker');
assert(overlay.includes('StyledTimer'),'published overlay stands the countdown as its real StyledTimer face');
assert(overlay.includes('GameInfoOverlay')&&overlay.includes('freshCardState()'),'published overlay stands the gift guide with a fresh state when no live state shows it');
assert(overlay.includes('cardPhase'),'published overlay coordinates the gift guide with the QuestionCards path so it renders exactly once');
assert(overlay.includes('if(shown||activeTool.config?.triggerOnly)return null'),'published overlay leaves no empty artwork frame standing when the gift guide is shown by its live state or is trigger-only');
const projectPage=read('app/project/[id]/page.tsx');
assert.equal((projectPage.match(/<StandingTools/g)||[]).length,2,'draft overlay and preview panel both mount the shared standing layer');
assert(read('components/BuildSpace.tsx').includes('standsOnOverlay(tool)'),'BuildSpace does not stack an appearance preview over a tool that already stands');
assert(read('components/StageReview.tsx').includes('standsOnOverlay(tool)'),'StageReview does not stack an appearance preview over a tool that already stands');
console.log('PASS: standing renders wired into the published overlay, both draft preview copies, BuildSpace and StageReview through one shared helper.');

/* ---------- Standing faces show the real game, never a fake result ---------- */
const standingModule=loadModule('components/StandingToolFace.tsx');
const {StandingToolFace,standsOnOverlay}=standingModule;const StandingTools=standingModule.default;
const face=(t,p)=>renderToStaticMarkup(React.createElement(StandingToolFace,{tool:t,project:p||project([])}));

let html=face(tool('plinko',{slots:['10','Jackpot','50'],rows:9}));
assert(html.includes('Jackpot')&&html.includes('Ready to drop'),'plinko stands as its real board with its saved slots');
assert(!html.includes('Landed on'),'plinko standing face presents no landed result');

html=face(tool('higher-lower',{cards:[{label:'7',value:7},{label:'K',value:13}]}));
assert(html.includes('>7<')&&html.includes('Draw a card to begin'),'higher-lower stands with its deck face up');
assert(!html.includes('CORRECT')&&!html.includes('WRONG'),'higher-lower standing face presents no guessed outcome');

html=face(tool('cliffhanger',{items:[{label:'Toaster',price:30}],stepsToFall:10,dollarsPerStep:2}));
assert(html.includes('Toaster'),'cliffhanger stands with its first saved item showing');
assert(!html.includes('$'),'cliffhanger standing face renders no dollar sign');

html=face(tool('prize-wheel',{values:['5¢','25¢','1.00']}));
assert(html.includes('Ready to spin')&&html.includes('1.00'),'prize wheel stands with its saved values, ready to spin');
assert(!html.includes('$'),'prize wheel standing face renders no dollar sign');

html=face(tool('random-picker',{source:'cards',items:['Alpha','Beta','Gamma']}));
assert(html.includes('Alpha · Beta · Gamma'),'random picker stands with its whole pool listed');
assert(!html.includes('role="status"'),'random picker standing face presents no item as the pick');

const deck=project([tool('card-list',{cards:[{id:'c1',text:'One'},{id:'c2',text:'Two'},{id:'c3',text:'Three'}]})]);
deck.gameTools[0].id='list-1';deck.gameTools[0].enabled=true;
html=face(tool('random-picker',{source:'cards',listId:'list-1'}),deck);
assert(html.includes('One · Two · Three'),'random picker stands with the items of the card list it draws from');

// The standing display reads the same config the editors write: change
// the config and the standing face changes with it.
const before=face(tool('plinko',{slots:['Red','Blue'],rows:9}));
const after=face(tool('plinko',{slots:['Green','Gold'],rows:9}));
assert(before.includes('Red')&&after.includes('Gold')&&!after.includes('Red'),'standing face follows the saved config (editor/Jewel edits flow into it)');

assert(standsOnOverlay(tool('plinko',{})),'a placed plinko stands');
assert(!standsOnOverlay(tool('plinko',{triggerOnly:true})),'a trigger-only plinko appears only when fired, as before');
assert(!standsOnOverlay({...tool('plinko',{}),inOverlayBuild:false}),'an unplaced plinko does not stand');
console.log('PASS: standing faces show the real configured games — board, deck, items, values, pool — with no fake result standing.');

/* ---------- Gift guide stands exactly once; countdown stands as a timer ---------- */
const guide=tool('game-tool-list',{entries:[{id:'e1',name:'Rose',meaning:'Skip a question'}]});
let layer=renderToStaticMarkup(React.createElement(StandingTools,{project:project([guide]),states:{}}));
assert(layer.includes('Rose')&&layer.includes('Skip a question'),'gift guide stands from page load with its configured entries');
const shownState={version:1,gameId:'g',used:[],question:null,shownAt:0,revealAt:null,cleared:false,blankText:'Gift Guide'};
layer=renderToStaticMarkup(React.createElement(StandingTools,{project:project([guide]),states:{[guide.id]:shownState}}));
assert(!layer.includes('Rose'),'when a live state shows the gift guide through QuestionCards, the standing layer does not render it twice');
layer=renderToStaticMarkup(React.createElement(StandingTools,{project:project([tool('countdown',{seconds:30})]),states:{}}));
assert(layer.includes('styled-timer')&&layer.includes('>30<'),'countdown stands as its StyledTimer face at the configured total');
console.log('PASS: gift guide stands exactly once (standing when idle, live state when shown); countdown stands as its real timer face.');

/* ---------- (b) No dollar signs in what this build touches ---------- */
assert(!overlay.includes('$${q.value}')&&!overlay.includes('$${triviaQuestion.value}')&&!overlay.includes('runtime-trivia-value">$'),'overlay trivia clue values render as plain numbers');
const {PrizeWheelDisplay,CliffhangerDisplay}=loadModule('components/ChanceTools.tsx');
html=renderToStaticMarkup(React.createElement(PrizeWheelDisplay,{outcome:{values:['5¢','25¢','1.00'],total:100}}));
assert(html.includes('1.00! PERFECT!')&&!html.includes('$'),'prize wheel total formats as a plain number with no dollar sign');
html=renderToStaticMarkup(React.createElement(PrizeWheelDisplay,{outcome:{phase:'nextplayer'}}));
assert(html.includes('0.00')&&!html.includes('$'),'prize wheel next-player reset renders no dollar sign');
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'guess',item:{label:'Lamp',price:50},guess:40,price:50,diff:10,steps:10,position:10,stepsToFall:25},elapsed:2000}));
assert(html.includes('Guessed')&&html.includes('40')&&!html.includes('$'),'cliffhanger guess line renders plain numbers with no dollar sign');
const {toolDefaults}=loadModule('lib/game-tools.ts');
const defaults=toolDefaults('prize-wheel');
assert(defaults.values.includes('1.00')&&defaults.values.every(v=>!String(v).includes('$')),'prize wheel default values carry no dollar sign');
console.log('PASS: no dollar sign renders in the overlay trivia values, the prize-wheel format, or the cliffhanger guess line; defaults are plain numbers.');

/* ---------- (c) Jewel build-edits can create and edit the key config ---------- */
const {applyBuildChanges}=loadModule('lib/build-edits.ts');
const {gameEntries}=loadModule('lib/game-tools.ts');
const create=(type,config)=>{const r=applyBuildChanges(project([]),{newTools:[{type,name:type,config}]});const t=r.project.gameTools.find(x=>x.type===type);assert(t,`Jewel can create a ${type}`);return t;};
assert.deepEqual(create('plinko',{slots:['A','B'],rows:12}).config.slots,['A','B']);
assert.equal(create('plinko',{slots:['A'],rows:12}).config.rows,12);
assert.deepEqual(create('higher-lower',{cards:[{label:'3',value:3}]}).config.cards,[{label:'3',value:3}]);
const cliff=create('cliffhanger',{items:[{label:'Lamp',price:20}],stepsToFall:15,dollarsPerStep:2});
assert.deepEqual(cliff.config.items,[{label:'Lamp',price:20}]);assert.equal(cliff.config.stepsToFall,15);assert.equal(cliff.config.dollarsPerStep,2);
assert.deepEqual(create('prize-wheel',{values:['5¢','1.00']}).config.values,['5¢','1.00']);
const picker=create('random-picker',{source:'cards',listId:'list-9'});
assert.equal(picker.config.source,'cards');assert.equal(picker.config.listId,'list-9');
assert.equal(create('countdown',{seconds:45}).config.seconds,45);
const guideTool=create('game-tool-list',{entries:[{name:'Rose',meaning:'Skip a question'},{id:'kept-id',name:'Star',meaning:'Shine'}]});
assert.equal(gameEntries(guideTool).length,2,'Jewel-built gift guide entries survive (ids assigned when the model omits them)');
assert.equal(gameEntries(guideTool)[1].id,'kept-id','provided entry ids are preserved');

const existing=project([tool('plinko',{slots:['Old'],rows:9}),tool('game-tool-list',{entries:[]})]);
const edited=applyBuildChanges(existing,{gameTools:[{id:'tool-plinko',config:{slots:['X','Y','Z']}},{id:'tool-game-tool-list',config:{entries:[{name:'Gem',meaning:'Extra life'}]}}]});
assert.deepEqual(edited.project.gameTools.find(t=>t.type==='plinko').config.slots,['X','Y','Z'],'Jewel can edit plinko slots on an existing tool');
assert.equal(gameEntries(edited.project.gameTools.find(t=>t.type==='game-tool-list')).length,1,'Jewel can edit gift guide entries on an existing tool (ids assigned)');
for(const route of ['app/api/jewel/route.ts','app/api/ai/route.ts']){
  const src=read(route);
  assert(src.includes('"plinko"|"higher-lower"|"cliffhanger"|"prize-wheel"'),route+' documents the four chance games as creatable tool types');
  assert(src.includes('stepsToFall and dollarsPerStep'),route+' documents the chance-game config keys');
}
console.log('PASS: Jewel build-edits create and edit plinko slots/rows, higher-lower cards, cliffhanger items/prices/steps, prize-wheel values, gift guide entries, picker source/list and countdown seconds; both assistant prompts document them.');

/* ---------- (d) A connected chance game stands; button-only is explicit ----------
   Regression for the 2026-11-14 live check: Jewel built a Plinko with
   its Drop/Hide buttons, and wiring the buttons forced triggerOnly on
   the tool — so the standing face was suppressed everywhere and the
   published overlay showed an empty cyan-outlined frame on every
   fresh load. Wiring a chance game's play button must place it on
   the overlay build WITHOUT making it trigger-only. */
const connected=(type,config)=>applyBuildChanges(project([]),{newTools:[{type,name:type,config,connect:true}]});
for(const [type,config] of [['plinko',{slots:['10','50','100'],rows:8}],['higher-lower',{cards:[{label:'7',value:7},{label:'K',value:13}]}],['cliffhanger',{items:[{label:'Lamp',price:20}],stepsToFall:15}],['prize-wheel',{values:['5¢','25¢','1.00']}]]){
  const r=connected(type,config),t=r.project.gameTools.find(x=>x.type===type);
  assert(t,`Jewel can create a connected ${type}`);
  assert.equal(t.inOverlayBuild,true,`a connected ${type} is placed on the overlay build`);
  assert(!t.config.triggerOnly,`a connected ${type} is NOT made trigger-only by its play button, so it stands`);
  assert(standsOnOverlay(t),`a connected ${type} stands on the overlay`);
  assert(r.project.controls.some(c=>(c.toolIds||[]).includes(t.id)),`a connected ${type} still gets its dashboard button`);
}
// The standing layer renders the placed board from config alone —
// no run state, no dashboard action first.
layer=renderToStaticMarkup(React.createElement(StandingTools,{project:project([tool('plinko',{slots:['10','50','100'],rows:8})]),states:{}}));
assert(layer.includes('chance-plinko')&&layer.includes('50')&&layer.includes('Ready to drop'),'the standing layer renders the placed plinko board (pegs and slots) from its saved config alone');
// A chance game the creator explicitly wants button-only still can
// be: triggerOnly in its own creation config survives the connect,
// and it then contributes NO markup to the standing layer.
const hidden=connected('plinko',{slots:['10','50'],rows:8,triggerOnly:true}).project.gameTools.find(x=>x.type==='plinko');
assert.equal(hidden.config.triggerOnly,true,'an explicit triggerOnly in the creation config is preserved when the play button is wired');
assert(!standsOnOverlay(hidden),'an explicitly button-only plinko does not stand');
layer=renderToStaticMarkup(React.createElement(StandingTools,{project:project([hidden]),states:{}}));
assert(!layer.includes('chance-plinko')&&!layer.includes('runtime-tool-plinko'),'a trigger-only plinko contributes no markup to the standing layer — no empty frame');
// And on the published overlay the persistent map returns nothing at
// all for an unfired trigger-only chance game (the gift guide branch
// already followed this rule; the chance games now do too).
assert(overlay.includes('if(activeTool.config?.triggerOnly&&(activeTool.type==="plinko"||activeTool.type==="higher-lower"||activeTool.type==="cliffhanger"||activeTool.type==="prize-wheel"))return null'),'published overlay renders nothing — no empty frame — for an unfired trigger-only chance game');
console.log('PASS: wiring a chance game\'s play button places it standing (not trigger-only) with its button intact; explicit triggerOnly stays button-only and renders no frame anywhere.');

/* ---------- (e) Placed standing games get real, separate placements ----------
   Regression for the 2026-11-14 live recheck: Jewel placed Plinko,
   Higher or Lower, Cliffhanger and the Big Prize Wheel in "Standing
   Games Recheck" and all four rendered stacked at the same central
   position. Their creation defaults carry no placement, no creation
   path assigned one, overlayToolPlacement returned {} and the
   .runtime-game-tool CSS class centered every one of them. Jewel's
   move edits then failed outright or landed on the wrong copy of
   the placement. The pins below cover the whole chain. */
const {assignStandingPlacements,standingSlots}=loadModule('lib/standing-placement.ts');
const {overlayToolPlacement}=loadModule('lib/tool-style.ts');
const {validateExplicitSettings}=loadModule('lib/ai-edit-validation.ts');
const rectOverlap=(a,b)=>{const w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);const h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);return w>0&&h>0?w*h:0;};

// Creation through the Jewel path, one edit per game (the recheck's
// shape): every placed game leaves with a placement, and no two
// placements substantially overlap.
let built=project([]);
for(const [type,config] of [['plinko',{slots:['10','50','100'],rows:8}],['higher-lower',{cards:[{label:'7',value:7}]}],['cliffhanger',{items:[{label:'Lamp',price:20}]}],['prize-wheel',{values:['5¢','1.00']}]]){
  built=applyBuildChanges(built,{newTools:[{type,name:type,config,connect:true}]}).project;
}
const placedTools=built.gameTools.filter(t=>standingSlots&&t.config.placement);
assert.equal(placedTools.length,4,'every Jewel-placed chance game leaves creation with a placement');
assert.deepEqual(built.gameTools.find(t=>t.type==='plinko').config.placement,standingSlots[0],'the first standing game takes the center slot');
for(let i=0;i<placedTools.length;i++)for(let j=i+1;j<placedTools.length;j++){
  const a=placedTools[i].config.placement,b=placedTools[j].config.placement;
  assert(rectOverlap(a,b)<=0.2*Math.min(a.width*a.height,b.width*b.height),`placements of ${placedTools[i].type} and ${placedTools[j].type} do not stack`);
}
// The same four in ONE creation edit slot in order too.
const batch=applyBuildChanges(project([]),{newTools:[{type:'plinko',name:'P',config:{},connect:true},{type:'higher-lower',name:'H',config:{},connect:true},{type:'cliffhanger',name:'C',config:{},connect:true},{type:'prize-wheel',name:'W',config:{},connect:true}]}).project;
assert.equal(JSON.stringify(batch.gameTools.map(t=>t.config.placement)),JSON.stringify(standingSlots.slice(0,4)),'four games created in one edit take center + three quadrants in order');
// A lone standing game is unchanged in spirit: the center slot.
const lone=applyBuildChanges(project([]),{newTools:[{type:'plinko',name:'P',config:{},connect:true}]}).project.gameTools[0];
assert.deepEqual(lone.config.placement,standingSlots[0],'a single standing game takes the center slot');
// An unplaced (not connected) tool is not slotted — it does not stand.
const shelved=applyBuildChanges(project([]),{newTools:[{type:'plinko',name:'P',config:{}}]}).project.gameTools[0];
assert(!shelved.config.placement,'a tool that is not placed on the overlay build gets no slot');
// A placement stated at creation is respected, never overwritten.
const stated=applyBuildChanges(project([]),{newTools:[{type:'plinko',name:'P',config:{placement:{x:60,y:60,width:30,height:30}},connect:true}]}).project.gameTools[0];
assert.equal(JSON.stringify(stated.config.placement),JSON.stringify({x:60,y:60,width:30,height:30}),'a placement stated at creation is kept exactly');
// A partial statement is completed from a slot, not replaced.
const partial=applyBuildChanges(project([]),{newTools:[{type:'plinko',name:'P',config:{placement:{x:0,y:0}},connect:true}]}).project.gameTools[0];
assert.equal(partial.config.placement.x,0);assert.equal(partial.config.placement.y,0);
assert.equal(typeof partial.config.placement.width,'number','a partial placement is completed with a slot size');
// Existing saved placements are never moved by a later edit.
const kept=applyBuildChanges(batch,{gameTools:[{id:batch.gameTools[0].id,config:{slots:['1','2']}}]}).project;
assert.equal(JSON.stringify(kept.gameTools.map(t=>t.config.placement)),JSON.stringify(standingSlots.slice(0,4)),'an unrelated later edit never re-slots placed games');
// The slot pass itself: deterministic, and a no-op (same object) when
// nothing needs a placement.
assert.equal(assignStandingPlacements(batch),batch,'assignStandingPlacements returns the project untouched when every standing game is placed');
const healed=assignStandingPlacements(project([tool('plinko',{}),tool('prize-wheel',{})]));
assert.equal(JSON.stringify(healed.gameTools.map(t=>t.config.placement)),JSON.stringify(standingSlots.slice(0,2)),'the slot pass heals saved unplaced standing games in saved order');
console.log('PASS: placed standing games leave every creation path with the next free slot — center, then quadrants — stated placements respected, existing ones never moved.');

/* ---------- (f) Jewel move edits land on the placement the overlay reads ---------- */
// The exact request that failed live: pixel sizes with no unit word.
// The validator must read a bare value over 100 as pixels (a percent
// placement can never exceed 100) and accept the model's converted
// percentages, instead of demanding an impossible "width 960%".
const moveProject=applyBuildChanges(project([]),{newTools:[{type:'plinko',name:'Plinko',config:{slots:['10','50','100']},connect:true}]}).project;
const moveId=moveProject.gameTools[0].id;
const moveChanges={gameTools:[{id:moveId,config:{placement:{x:0,y:0,width:50,height:50}}}]};
validateExplicitSettings('Move Plinko to x=0, y=0, width 960, height 540',{reply:'Done',changes:moveChanges});
validateExplicitSettings('Move Plinko to x=0, y=0, 960x540',{reply:'Done',changes:moveChanges});
validateExplicitSettings('Move Plinko to x=0%, y=0%, width 50%, height 50%',{reply:'Done',changes:moveChanges});
// A genuinely wrong saved placement is still refused.
assert.throws(()=>validateExplicitSettings('Move Plinko to x=0, y=0, width 960, height 540',{reply:'Done',changes:{gameTools:[{id:moveId,config:{placement:{x:0,y:0,width:25,height:50}}}]}}),'a saved placement that is not the requested size is still refused');
// Applying the move: the tool's placement changes, the overlay reads
// exactly it (no centering offset), and the game's button result —
// the second copy of the placement — moves with it.
const moved=applyBuildChanges(moveProject,moveChanges).project;
const movedTool=moved.gameTools.find(t=>t.id===moveId);
assert.equal(JSON.stringify(movedTool.config.placement),JSON.stringify({x:0,y:0,width:50,height:50}),'a Jewel move edit updates the tool placement');
const movedStyle=overlayToolPlacement(movedTool);
assert.equal(movedStyle.left,'0%');assert.equal(movedStyle.top,'0%');assert.equal(movedStyle.width,'50%');assert.equal(movedStyle.height,'50%');
assert.equal(movedStyle.transform,'none','a placed tool renders exactly at its placement — the class centering transform is cleared');
const dropButton=moved.controls.find(c=>c.action===`tool.${moveId}`);
assert(dropButton&&dropButton.overlayResult.x===0&&dropButton.overlayResult.y===0&&dropButton.overlayResult.width===50&&dropButton.overlayResult.height===50,'the button shown result moves with the tool placement');
// The reverse aim also lands: a move stated on the button's shown
// result (the documented path for triggered items) moves the
// standing game itself.
const movedViaButton=applyBuildChanges(moveProject,{controls:[{id:dropButton.id,overlayResult:{x:51,y:2,width:48,height:46}}]}).project;
assert.equal(JSON.stringify(movedViaButton.gameTools.find(t=>t.id===moveId).config.placement),JSON.stringify({x:51,y:2,width:48,height:46}),'a move stated on the button result lands on the standing game');
// Jewel's receipt reports the move with real canvas numbers.
const {detailedChangeLines}=loadModule('lib/jewel-change-summary.ts');
const receipt=detailedChangeLines(moveProject,moved);
assert(receipt.some(line=>line.includes('Plinko')&&line.includes('960')&&line.includes('540')),'the change receipt names the tool move in canvas pixels');
console.log('PASS: the exact move that failed live now validates and lands — tool placement, overlay style and button result agree, and the receipt reports it.');

/* ---------- (g) Set the Stage: standing games are directly draggable ---------- */
const stageReview=read('components/StageReview.tsx');
assert(stageReview.includes('standingDragTools'),'Set the Stage computes the standing games drag set');
assert(stageReview.includes("standingPlacementTypes.includes(t.type)"),'the drag set is the standing placement types');
assert(stageReview.includes("key={'standing-' + t.id}"),'every standing game renders its own always-present drag frame in Set the Stage');
assert(stageReview.includes('!standingDragTools.some(t => t.id === tool.id)'),'the selected-tool frame does not duplicate a standing game frame');
console.log('PASS: standing games have their own drag frames in Set the Stage, the same way boards and assets do.');
