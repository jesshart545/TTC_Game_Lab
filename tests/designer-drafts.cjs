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

console.log('PASS: backing out creates nothing — deferred drafts for Board Designer, Pool designer and Card designer; explicit save creates exactly one; existing-tool auto-save unchanged.');
