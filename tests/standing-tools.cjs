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
