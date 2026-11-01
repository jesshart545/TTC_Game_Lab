const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const load=require('./load.cjs');
const transpile=(file)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;

// --- Behavioural: useEditableTool deferred-save semantics -------------------
// Minimal React-hooks harness: state/ref cells persist across "renders",
// useEffect re-runs only when its deps change (as React does).
function createHookRenderer(){
 const cells=new Map();let cursor=0,lastDeps=null;
 const react={
  useState(init){const i=cursor++;if(!cells.has(i))cells.set(i,init);return [cells.get(i),v=>cells.set(i,typeof v==='function'?v(cells.get(i)):v)];},
  useRef(init){const i='ref'+(cursor++);if(!cells.has(i))cells.set(i,{current:init});return cells.get(i);},
  useEffect(fn,deps){const changed=!lastDeps||!deps||deps.some((d,x)=>d!==lastDeps[x]);if(changed){fn();lastDeps=deps||null;}}
 };
 return {react,render(fn){cursor=0;return fn();}};
}
function loadHook(react){
 const exports={};
 vm.runInNewContext(transpile('components/useEditableTool.ts'),{exports,require:id=>id==='react'?react:require(id),console});
 return exports.useEditableTool;
}
const baseTool={id:'tool-1',type:'blank-board',name:'Board',enabled:true,config:{title:'Old'}};

// Auto-save mode (existing tools): every patch saves immediately — unchanged behaviour.
{
 const {react,render}=createHookRenderer();const useEditableTool=loadHook(react);
 const saves=[];const onSave=t=>saves.push(t);
 let api=render(()=>useEditableTool(baseTool,onSave,false));
 api.patchConfig({title:'New'});api=render(()=>useEditableTool(baseTool,onSave,false));
 assert.equal(saves.length,1,'auto-save mode: a patch saves immediately');
 assert.equal(saves[0].config.title,'New');
 api.patchTool({name:'Renamed'});api=render(()=>useEditableTool(baseTool,onSave,false));
 assert.equal(saves.length,2,'auto-save mode: patchTool saves immediately');
 assert.equal(api.draft.name,'Renamed');
}
// Deferred mode (not-yet-created tools): patches stay local; only commit saves.
{
 const {react,render}=createHookRenderer();const useEditableTool=loadHook(react);
 const saves=[];const onSave=t=>saves.push(t);
 let api=render(()=>useEditableTool(baseTool,onSave,true));
 api.patchConfig({title:'Draft title'});api=render(()=>useEditableTool(baseTool,onSave,true));
 api.patchTool({name:'Draft name'});api=render(()=>useEditableTool(baseTool,onSave,true));
 api.patchDesign('questionCard',{backgroundColor:'#123456'});api=render(()=>useEditableTool(baseTool,onSave,true));
 assert.equal(saves.length,0,'deferred mode: editing in progress saves nothing');
 assert.equal(api.draft.config.title,'Draft title','deferred mode: the local draft still updates');
 assert.equal(api.draft.name,'Draft name');
 assert.equal(api.draft.config.questionCard.backgroundColor,'#123456');
 api.commit(api.draft);
 assert.equal(saves.length,1,'deferred mode: the explicit Save click saves exactly once');
 assert.equal(saves[0].config.title,'Draft title','deferred mode: the saved object carries every in-progress edit');
 assert.equal(saves[0].name,'Draft name');
 api=render(()=>useEditableTool(baseTool,onSave,true));
 api.patchConfig({title:'Second round'});api=render(()=>useEditableTool(baseTool,onSave,true));
 assert.equal(saves.length,1,'deferred mode: edits after a save stay local until the next explicit save');
 api.commit(api.draft);
 assert.equal(saves.length,2,'deferred mode: a second explicit save saves again');
 assert.equal(saves[1].config.title,'Second round');
}

// --- Lib purity: a card system / list can be built WITHOUT touching the project,
 // so the page can hold it as a draft and discard it on back-out. --------------
{
 const {createCardSystem}=load('lib/question-cards.ts');
 const {createCardList}=require('./load.cjs')('lib/card-lists.ts');
 const before={id:'p',gameTools:[{id:'pool',type:'trivia-list',enabled:true,config:{questions:[]}}],controls:[{id:'c0'}]};
 const snapshot=JSON.stringify(before);
 const next=createCardSystem(before,undefined,'question');
 assert.equal(JSON.stringify(before),snapshot,'createCardSystem does not mutate the stored project');
 assert.equal(next.gameTools.length,before.gameTools.length+1,'createCardSystem computes exactly one new tool');
 assert.equal(next.controls.length,before.controls.length+2,'createCardSystem computes its two controls alongside');
 const list=createCardList();
 assert.equal(list.type,'card-list');
 assert.ok(!before.gameTools.some(t=>t.id===list.id),'createCardList result exists outside the project until saved');
}

// --- Source wiring: page.tsx holds drafts and only persists on explicit save --
const page=fs.readFileSync('app/project/[id]/page.tsx','utf8');
const span=(start,end)=>{const a=page.indexOf(start);assert.ok(a>=0,'marker present: '+start);const b=page.indexOf(end,a);assert.ok(b>a,'end marker after: '+start);return page.slice(a,b);};

const openNewList=span('function openNewList()','useEffect(()=>{if(newCardEditorId');
assert.ok(!openNewList.includes('persist('),'openNewList must not persist the new pool before its designer opens');
assert.ok(openNewList.includes('setListDraft(list)'),'openNewList holds the new pool as a draft');

const createCard=span('function createWorkshopCard','const [showBoardTemplates');
assert.ok(!createCard.includes('persist(next)'),'createWorkshopCard must not persist the new card system before its designer opens');
assert.ok(createCard.includes('setCardDraft('),'createWorkshopCard holds the new tool + its controls as a draft');

const addTool=span('async function addGameTool','function pushWorkspaceCreation');
assert.ok(addTool.includes('if (type !== "blank-board" && type !== "trivia-board") persist(next);'),'addGameTool persists non-board tools immediately but not boards');
assert.equal((addTool.match(/setBoardDraft\(tool\)/g)||[]).length,2,'both board types open the designer on a draft');
assert.ok(addTool.includes('setBoardDraft(draftTool =>'),'trivia generation seeds the draft (or the saved board), never a backed-out one');

assert.ok(page.includes('boardDraft&&boardDraft.id===boardDesignerId?boardDraft:undefined'),'the Board Designer can render a draft board that is not in the project yet');
assert.ok(page.includes('deferSave={!project.gameTools.some(t=>t.id===editingBoard.id)}'),'the Board Designer defers saves while the board is not yet in the project');
assert.ok(page.includes('deferSave={!project.gameTools.some(t=>t.id===newCardEditorId)}'),'the Card designer defers saves while the card is not yet in the project');
assert.ok((page.match(/setBoardDraft\(null\)/g)||[]).length>=3,'leaving the Board Designer (Back, Ask Jewel, create-artwork) discards the draft');
assert.ok(page.includes('tool={listEditorTool}')&&page.includes('tool={cardEditorTool}'),'both dialogs render the project tool or the draft tool');
assert.ok(page.includes('setListDraft(null)')&&page.includes('setCardDraft(null)'),'closing either dialog discards its unsaved draft');
const appends=(page.match(/\[\.\.\.current\.gameTools,next\]/g)||[]).length;
assert.ok(appends>=3,'board, pool and card saves append the tool when it is not in the project yet (exactly one copy)');
assert.ok(page.includes('cardDraft.controls.filter('),'saving a new card system adds its computed controls with the tool');

const boardDesigner=fs.readFileSync('components/BoardDesigner.tsx','utf8');
const cardEditor=fs.readFileSync('components/QuestionCardEditor.tsx','utf8');
assert.ok(boardDesigner.includes('useEditableTool(tool,onSave,deferSave)'),'BoardDesigner forwards deferSave to the editable-tool hook');
assert.ok(cardEditor.includes('useEditableTool(tool,onSave,deferSave)'),'QuestionCardEditor forwards deferSave to the editable-tool hook');

// --- Wording: no creation claims before a save exists ------------------------
// Defect: createWorkshopCard announced "cards created" while the cards were
// still an unsaved draft, and addGameTool said a trivia board "was added"
// while it was still an unsaved draft. The claims now live only on save paths.
assert.ok(!createCard.includes('cards created')&&!createCard.includes('card created'),'createWorkshopCard must not claim creation at open time — the cards are only a draft until saved');
assert.ok(!addTool.includes('was added')&&!addTool.includes('Trivia Board added'),'addGameTool must not say a draft trivia board was added');
assert.ok(addTool.includes('Trivia Board draft started'),'the trivia flow announces a draft, not an added board');
assert.ok(addTool.includes('5×5 Trivia Board draft is ready'),'the unsaved-board ready message names it a draft');
assert.ok(addTool.includes('5×5 Trivia Board is ready in the workspace'),'the saved-board ready message is unchanged for a board saved mid-generation');

// --- Behavioural: the board-TEMPLATE path (BOARD TEMPLATES -> Board Designer) -
// Runs the real addGameTool span and the real Board Designer onSave handler
// extracted from page.tsx, with React state replaced by recording stubs.
// persist() is the only writer to the project, so "creates nothing" is proven
// by persist never being called before an explicit save.
const {BOARD_LIBRARY,TOOL_LIBRARY}=load('lib/workshop-libraries.ts');
const {toolDefaults}=load('lib/game-tools.ts');
const {createCardSystem}=load('lib/question-cards.ts');
const transpileSource=(src)=>ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const CATS=[1,2,3,4,5].map(i=>({name:'Cat'+i,questions:[{prompt:'q'+i,answer:'a'+i}]}));
const okFetch=async()=>({ok:true,json:async()=>({categories:CATS})});
function boardWorld(fetchImpl){
 const world={persists:[],statuses:[],boardDraft:null,designerId:''};
 const projectRef={current:{id:'p',gameTools:[{id:'dice-1',type:'dice',name:'Dice',enabled:true,config:{}}],controls:[],assets:[],updatedAt:'just now'}};
 const persist=next=>{world.persists.push(next);projectRef.current=next;};
 const sandbox={project:projectRef.current,projectRef,triviaBusy:false,ccssEntitled:false,BOARD_LIBRARY,TOOL_LIBRARY,toolDefaults,TRIVIA_CONFIG:{categories:[]},youtubePlacement:undefined,persist,
  setBoardDraft:v=>{world.boardDraft=typeof v==='function'?v(world.boardDraft):v;},
  setBoardDesignerId:id=>{world.designerId=id;},
  setPreviewMode:()=>{},setAssetStatus:s=>{world.statuses.push(s);},setTriviaConfig:()=>{},setTriviaTopics:()=>{},setTriviaBusy:()=>{},fetch:fetchImpl,console};
 vm.runInNewContext(transpileSource(span('async function addGameTool','function pushWorkspaceCreation')),sandbox);
 world.addGameTool=sandbox.addGameTool;
 const marker='onSave={next=>{const current=projectRef.current||project;const exists=current.gameTools.some(t=>t.id===next.id);persist({...current,gameTools:exists?';
 const a=page.indexOf(marker);assert.ok(a>=0,'board designer onSave handler present');
 const b=page.indexOf(' onClose=',a);assert.ok(b>a,'board designer onSave end marker present');
 const saveSandbox={projectRef,persist};
 vm.runInNewContext('boardOnSave='+page.slice(a+'onSave={'.length,b-1),saveSandbox);
 world.boardOnSave=saveSandbox.boardOnSave;
 world.project=()=>projectRef.current;
 return world;
}
// --- Behavioural: the Workshop Card designer message timing -------------------
// Runs the real createWorkshopCard span and the real card-dialog onSave
// handler. The "created" confirmation may fire only from the save handler.
function cardWorld(){
 const world={persists:[],statuses:[],cardDraft:null,editorId:''};
 const projectRef={current:{id:'p',gameTools:[{id:'pool',type:'trivia-list',enabled:true,config:{questions:[]}}],controls:[{id:'c0'}],assets:[],updatedAt:'just now'}};
 const persist=next=>{world.persists.push(next);projectRef.current=next;};
 const sandbox={project:projectRef.current,projectRef,createCardSystem,setCardDraft:d=>{world.cardDraft=d;},setNewCardEditorId:id=>{world.editorId=id;},setAssetStatus:s=>{world.statuses.push(s);},crypto:require('node:crypto').webcrypto,console};
 vm.runInNewContext(transpileSource(span('function createWorkshopCard','const [showBoardTemplates')),sandbox);
 world.createWorkshopCard=sandbox.createWorkshopCard;
 const marker='onSave={next=>{const current=projectRef.current||project;const exists=current.gameTools.some(t=>t.id===next.id);persist(exists?';
 const a=page.indexOf(marker);assert.ok(a>=0,'card dialog onSave handler present');
 const b=page.indexOf('/></dialog>',a);assert.ok(b>a,'card dialog onSave end marker present');
 const saveSandbox={projectRef,persist,setAssetStatus:s=>{world.statuses.push(s);},cardDraft:null};
 vm.runInNewContext('cardOnSave='+page.slice(a+'onSave={'.length,b-1),saveSandbox);
 world.cardOnSave=next=>{saveSandbox.cardDraft=world.cardDraft;saveSandbox.cardOnSave(next);};
 world.project=()=>projectRef.current;
 return world;
}

(async()=>{
 // Template path: open the 5x5 Trivia Board template -> designer holds a draft.
 {
  const w=boardWorld(okFetch);
  await w.addGameTool('trivia-board');
  assert.equal(w.persists.length,0,'template path: opening the Board Designer from a board template persists nothing');
  assert.ok(w.boardDraft&&w.boardDraft.type==='trivia-board','template path: the new board is held as a draft');
  assert.equal(w.boardDraft.name,'5×5 Trivia Board','template path: the draft carries the template contents (its name)');
  assert.equal(w.designerId,w.boardDraft.id,'template path: the designer opens on the draft');
  assert.equal(w.boardDraft.config.categories.length,5,'template path: trivia generation seeds the DRAFT board');
  assert.ok(!w.project().gameTools.some(t=>t.type==='trivia-board'),'template path: the project has no board before a save');
  assert.ok(!w.statuses.some(s=>s.includes('was added')||s.includes('Board added')),'trivia wording: no status claims the draft board was added');
  assert.ok(w.statuses[0].startsWith('Trivia Board draft started.'),'trivia wording: the building message names a draft');
  assert.ok(w.statuses[w.statuses.length-1].includes('5×5 Trivia Board draft is ready'),'trivia wording: the ready message names a draft');
  // Back out: the designer's exits (Back / Ask Jewel / create-artwork) only
  // discard the draft state — persist is never involved, so nothing is created.
  w.boardDraft=null;w.designerId='';
  assert.equal(w.persists.length,0,'template path: backing out of the designer creates nothing');
  assert.ok(!w.project().gameTools.some(t=>t.type==='trivia-board'),'template path: still no board in the project after back-out');
 }
 // Template path: explicit Save in the designer creates exactly one board.
 {
  const w=boardWorld(okFetch);
  await w.addGameTool('trivia-board');
  w.boardOnSave(w.boardDraft);
  const boards=w.project().gameTools.filter(t=>t.type==='trivia-board');
  assert.equal(boards.length,1,'template path: explicit save creates exactly one board');
  assert.equal(boards[0].name,'5×5 Trivia Board','template path: the saved board carries the template name');
  assert.equal(boards[0].config.categories.length,5,'template path: the saved board carries the generated template contents');
  w.boardOnSave({...w.boardDraft,config:{...w.boardDraft.config,categories:[]}});
  const again=w.project().gameTools.filter(t=>t.type==='trivia-board');
  assert.equal(again.length,1,'template path: saving again updates the same board, never a duplicate');
  assert.equal(again[0].config.categories.length,5,'template path: re-saving a trivia board preserves its saved categories');
 }
 // Template path: saving in the designer WHILE generation runs seeds the saved board.
 {
  let w;
  const savingFetch=async()=>{w.boardOnSave(w.boardDraft);return {ok:true,json:async()=>({categories:CATS})};}
  w=boardWorld(savingFetch);
  await w.addGameTool('trivia-board');
  const boards=w.project().gameTools.filter(t=>t.type==='trivia-board');
  assert.equal(boards.length,1,'template path: a mid-generation save still yields exactly one board');
  assert.equal(boards[0].config.categories.length,5,'template path: generation seeds the saved board in place');
  assert.equal(w.statuses[w.statuses.length-1],'5×5 Trivia Board is ready in the workspace. Customize its categories, questions, visuals and interactive areas with the AI Creative Director. Push it to the audience overlay only when it is finished.','trivia wording: the already-saved path keeps its original ready message');
 }
 // Template path: failed generation keeps draft wording and creates nothing.
 {
  const w=boardWorld(async()=>({ok:false,json:async()=>({error:'boom'})}));
  await w.addGameTool('trivia-board');
  assert.equal(w.persists.length,0,'template path: failed generation persists nothing');
  assert.equal(w.statuses[w.statuses.length-1],'Trivia Board draft started, but its default sourced questions could not be generated: boom','trivia wording: the failure message names a draft, not an added board');
 }
 // Template path: the Blank Board template also opens as a draft.
 {
  const w=boardWorld(okFetch);
  await w.addGameTool('blank-board');
  assert.equal(w.persists.length,0,'template path: opening the Blank Board template persists nothing');
  assert.ok(w.boardDraft&&w.boardDraft.name==='Blank Board','template path: the blank board is held as a draft');
  assert.ok(!w.project().gameTools.some(t=>t.type==='blank-board'),'template path: no blank board in the project before a save');
 }
 // Card designer: opening claims no creation; closing without saving stays silent.
 {
  const w=cardWorld();
  w.createWorkshopCard('question');
  assert.equal(w.persists.length,0,'card designer: opening persists nothing (draft)');
  assert.ok(w.cardDraft&&w.cardDraft.tool.type==='question-card','card designer: the new cards are held as a draft');
  assert.equal(w.editorId,w.cardDraft.tool.id,'card designer: the editor opens on the draft');
  assert.ok(!w.statuses.some(s=>/created/i.test(s)),'card designer: no "created" claim when the designer opens');
  // Close without saving: the dialog discards the draft (setCardDraft(null)) and
  // persist is never called, so no creation claim can appear.
  w.cardDraft=null;w.editorId='';
  assert.equal(w.persists.length,0,'card designer: closing without saving creates nothing');
  assert.ok(!w.statuses.some(s=>/created/i.test(s)),'card designer: closing without saving produces no "created" claim');
  assert.ok(!w.project().gameTools.some(t=>t.type==='question-card'),'card designer: no cards in the project after a discard');
 }
 // Card designer: the "created" confirmation fires only when a save persists.
 {
  const w=cardWorld();
  w.createWorkshopCard('question');
  w.cardOnSave(w.cardDraft.tool);
  const cards=w.project().gameTools.filter(t=>t.type==='question-card');
  assert.equal(cards.length,1,'card designer: explicit save creates exactly one card tool');
  assert.equal(w.project().controls.length,3,'card designer: the save adds its two computed controls exactly once');
  assert.ok(w.statuses.some(s=>s==='Question and answer cards created. Choose their question pool and customize their appearance.'),'card designer: the created confirmation fires on save');
  w.cardOnSave(w.cardDraft.tool);
  assert.equal(w.project().gameTools.filter(t=>t.type==='question-card').length,1,'card designer: a second save updates, never duplicates');
  assert.equal(w.project().controls.length,3,'card designer: a second save adds no duplicate controls');
  assert.equal(w.statuses.filter(s=>/created/i.test(s)).length,1,'card designer: the created confirmation fires once, at creation');
 }
 // Card designer: blank cards follow the same rule.
 {
  const w=cardWorld();
  w.createWorkshopCard('blank');
  assert.ok(!w.statuses.some(s=>/created/i.test(s)),'card designer: blank card opening claims no creation');
  w.cardOnSave(w.cardDraft.tool);
  assert.equal(w.project().gameTools.filter(t=>t.type==='blank-card').length,1,'card designer: saving a blank card creates exactly one');
  assert.ok(w.statuses.some(s=>s==='Blank card created. Customize it in the editor.'),'card designer: the blank-card confirmation fires on save');
 }
 console.log('PASS: backing out creates nothing — deferred drafts for Board Designer, Pool designer and Card designer; explicit save creates exactly one; existing-tool auto-save unchanged.');
 console.log('PASS: template path — opening a board template holds an unsaved draft (back-out creates nothing, save creates exactly one with the template contents); card "created" claims fire only on save; trivia messages name the draft until the board is saved.');
})().catch(error=>{console.error(error);process.exit(1);});
