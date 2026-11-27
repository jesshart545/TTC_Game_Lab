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
const {jewelComposerEnter}=loadModule('lib/chat-keys.ts');

/* ---------- The handler itself ----------
 * Jessica, 2026-11-26: in the Jewel chat, Enter must ACT as Enter — it
 * sends the message — not just move to a new line. Shift+Enter keeps the
 * newline; an IME composition Enter confirms the composition instead. */
function fakeEvent(overrides={}){
  const calls={preventDefault:0,requestSubmit:0};
  const event={
    key:'Enter',shiftKey:false,keyCode:13,
    nativeEvent:{isComposing:false},
    preventDefault(){calls.preventDefault++;},
    currentTarget:{form:{requestSubmit(){calls.requestSubmit++;}}},
    ...overrides,
  };
  return {event,calls};
}

{ // Plain Enter sends: default newline prevented, the form itself submits
  // (the same submit path — and the same guards — as the send button).
  const {event,calls}=fakeEvent();
  jewelComposerEnter(event);
  assert.equal(calls.preventDefault,1,'Enter must prevent the newline');
  assert.equal(calls.requestSubmit,1,'Enter must submit the composer form');
}
{ // Shift+Enter is the multi-line escape hatch: untouched.
  const {event,calls}=fakeEvent({shiftKey:true});
  jewelComposerEnter(event);
  assert.equal(calls.preventDefault,0,'Shift+Enter must not prevent default');
  assert.equal(calls.requestSubmit,0,'Shift+Enter must not send');
}
{ // IME composition in progress: Enter confirms the candidate, never sends.
  const {event,calls}=fakeEvent();
  event.nativeEvent.isComposing=true;
  jewelComposerEnter(event);
  assert.equal(calls.preventDefault,0,'Composing Enter must not prevent default');
  assert.equal(calls.requestSubmit,0,'Composing Enter must not send');
}
{ // Legacy IME signal: keyCode 229 means a composition keystroke.
  const {event,calls}=fakeEvent({keyCode:229});
  jewelComposerEnter(event);
  assert.equal(calls.preventDefault,0,'229 Enter must not prevent default');
  assert.equal(calls.requestSubmit,0,'229 Enter must not send');
}
{ // Any other key is not the handler's business.
  const {event,calls}=fakeEvent({key:'a',keyCode:65});
  jewelComposerEnter(event);
  assert.equal(calls.preventDefault,0,'Other keys must not prevent default');
  assert.equal(calls.requestSubmit,0,'Other keys must not send');
}

/* ---------- Wiring: every Jewel chat composer, and only those ---------- */
const panel=read('components/WorkshopAiPanel.tsx');
assert.ok(panel.includes('import { jewelComposerEnter } from "../lib/chat-keys";'),'WorkshopAiPanel imports the shared Enter handler');
assert.ok(panel.includes('<textarea id="workshop-prompt" ref={promptRef} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={jewelComposerEnter}'),'The in-project Jewel composer textarea handles Enter');
assert.ok(panel.includes('<form className="composer" onSubmit={sendMessage}>'),'The Jewel composer still submits through sendMessage');

const page=read('app/project/[id]/page.tsx');
assert.ok(page.includes('import { jewelComposerEnter } from "../../../lib/chat-keys";'),'The project page imports the shared Enter handler');
assert.ok(/<form onSubmit=\{sendMessage\}><textarea value=\{draft\} onChange=\{e=>setDraft\(e\.target\.value\)\} onKeyDown=\{jewelComposerEnter\}/.test(page),'The floating Ask AI composer textarea handles Enter through the same sendMessage form');

// Scope pin: the handler is wired into exactly the two project-page Jewel
// composers — no other input on the site changes behavior.
for(const file of ['components/WorkshopAiPanel.tsx','app/project/[id]/page.tsx']){
  assert.ok(read(file).includes('onKeyDown={jewelComposerEnter}'),file+' wires the handler');
}
{
  const {execSync}=require('node:child_process');
  const hits=execSync('grep -rl "jewelComposerEnter" --include="*.tsx" components app',{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim().split('\n').sort();
  assert.deepEqual(hits,['app/project/[id]/page.tsx','components/WorkshopAiPanel.tsx'],'Only the two Jewel composers use the handler');
}

/* ---------- Parity: the floating Ask Jewel bubble already sends on Enter
 * (components/SiteSupportChat.tsx) and must keep doing so. ---------- */
const support=read('components/SiteSupportChat.tsx');
assert.ok(support.includes('event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing'),'SiteSupportChat keeps its Enter-to-send handler');

console.log('jewel-enter-send: all assertions passed');
