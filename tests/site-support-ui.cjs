const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require(process.env.TTC_DOM_TEST_MODULE || 'jsdom');
const React = require('react');
const load = require('./load.cjs');

const plans=[], calls=[], stored=[];
function fakeFetch(url,options){
 assert(['/api/site-support','/api/ai','/api/generate-asset','/api/edit-video'].includes(url), 'Forbidden/unexpected operation '+url);
 calls.push({url,body:JSON.parse(options.body)});
 const plan=plans.shift();assert(plan,'Unexpected request '+url);
 return typeof plan==='function'?plan():Promise.resolve({ok:plan.ok!==false,json:async()=>plan.body});
}
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.test' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const { createRoot } = require('react-dom/client');

function component(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: id => {
      if (dependencies[id]) return dependencies[id];
      if (id === 'react' || id === 'react/jsx-runtime') return require(id);
      if (id.endsWith('.css')) return {};
      if (id.includes('/lib/')) return load('lib/' + path.basename(id) + '.ts');
      return { default: () => null };
    },
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    navigator: dom.window.navigator,
    crypto: require('node:crypto').webcrypto,
    requestAnimationFrame: fn => fn(),
    CustomEvent: dom.window.CustomEvent,
    AbortController,
    fetch: fakeFetch,
    Image: class {constructor(){this.naturalWidth=1920;this.naturalHeight=1080;} set src(value){queueMicrotask(()=>this.onload());}},
    Blob, File,
    MediaRecorder: class {static isTypeSupported(){return true;}constructor(){this.state="inactive";this.mimeType="video/webm";}start(){this.state="recording";}stop(){this.state="inactive";queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(["trim"],{type:"video/webm"})});this.onstop?.();});}},
    setTimeout,
    clearTimeout,
    console,
    process: { env: {} }
  });
  return exports;
}

const Nav = component('components/ProjectWorkflowNav.tsx').default;
const Folder = component('components/CollapsibleFolder.tsx').default;
const MediaFolders = component('components/AssetFolders.tsx', { './CollapsibleFolder': { default: Folder } }).default;
const EntryGuide = component('components/WorkflowEntryGuide.tsx').default;
const EntryPreferences = component('lib/first-step-guidance.ts');
const Backgrounds = component('components/BackgroundBrowser.tsx', { './CollapsibleFolder': { default: Folder } }).default;
const BuildSpace = component('components/BuildSpace.tsx', {
  './BackgroundBrowser': { default: Backgrounds },
  './CompositionPlayer': { defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60 } },
  './RuntimeActionLayers': { ControlAppearancePreview: () => null }
}).default;
const projectAPI = load('lib/project.ts');
const initial = {
  ...projectAPI.createProject('A safe local editor test'),
  id: 'local-review', name: 'Local editor review', assets: [], controls: [], gameTools: [],
  workflow: { stage: 0, workshopStep: 0, promptDraft: '' },
  publishedSnapshot: { marker: 'unchanged-live-version' }
};
const saves = []; let failSave=false;
const noOp = () => {};
const runtime = { cardStates: {}, sequenceRunning: false, sequenceError: '', stopSequence: noOp, cardCommand: noOp };
const supportClient = component('lib/support-client.ts');
const supportShared = component('lib/site-support.ts');
const mediaActions = component('lib/assistant-media-actions.ts');
const Workspace = component('app/project/[id]/page.tsx', {
  'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next/navigation': { useParams: () => ({ id: initial.id }) },
  '../../../lib/project': {
    ...projectAPI,
    loadProjectFromServer: async () => structuredClone(initial),
    saveProjectToServer: async (project, publish) => { assert(!publish, 'Navigation must never publish.'); saves.push(project); if(failSave) throw new Error('Mock save failure'); return { ok: true }; }
  },
  '../../../lib/support-client': supportClient,
  '../../../lib/assistant-media-actions': mediaActions,
  '../../../lib/asset-store': {
    hydrateProjectAssets: async project => project,
    hydrateAsset: async asset => asset,
    storeUploadedAsset: async (id, file) => {stored.push({id,asset:{name:file.name,type:file.type}});return {name:file.name,type:file.type,storageKey:'projects/'+id+'/'+stored.length};},
    storeGeneratedAsset: async (id, asset) => { stored.push({id,asset}); return {...asset,storageKey:'projects/'+id+'/'+stored.length}; },
  },
  '../../../components/ProjectWorkflowNav': { default: Nav },
  '../../../components/CollapsibleFolder': { default: Folder },
  '../../../components/WorkflowEntryGuide': { default: EntryGuide },
  '../../../lib/first-step-guidance': EntryPreferences,
  '../../../components/AssetFolders': { default: MediaFolders },
  '../../../components/BuildSpace': { default: BuildSpace },
  '../../../components/RuntimeActionLayers': { default: () => null, useRuntimeActions: () => runtime },
  '../../../components/CompositionPlayer': { default: () => null, defaultOverlayResult: { x: 15, y: 20, width: 70, height: 60 } }
}).default;


const Chat = component('components/SiteSupportChat.tsx', {
 'next/navigation': {useRouter:()=>({push:path=>{routes.push(path);}})},
 '../lib/site-support':supportShared,
 '../lib/support-client':supportClient,
}).default;
const routes=[];
const root=createRoot(document.getElementById('root'));
const container=document.getElementById('root');
async function render(){await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(Workspace,{key:initial.id}),React.createElement(Chat,{path:'/project/'+initial.id}))));}
async function click(text){const button=[...container.querySelectorAll(text==='Undo last AI edit'?'.ttc-support-panel button':'button')].find(b=>b.textContent.trim()===text);assert(button,'Missing '+text);await React.act(async()=>button.click());}
async function send(text){
 const field=container.querySelector('#ttc-support-input');assert(field);
 Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(field,text);
 await React.act(async()=>{field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await React.act(async()=>field.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
}
const reply=(kind,text)=>({body:{kind,reply:text,targets:[]}});
(async()=>{
 initial.assets=[{name:'Backdrop.png',type:'image/png',url:'https://media.test/backdrop.png',storageKey:'backdrop'},{name:'Clip.mp4',type:'video/mp4',url:'https://media.test/clip.mp4',storageKey:'clip'}];
 await render();await click('Ask TTC AIHelp, create & edit');
 assert(container.querySelector('.ttc-support-panel'));assert.equal(document.activeElement.id,'ttc-support-input');
 plans.push({body:{kind:'help',reply:'Your materials are in the saved media library.',targets:['materials']}});
 const before=saves.length;await send('Where are my images?');assert.equal(saves.length,before,'Advice cannot save/edit the project');assert.equal(calls.at(-1).url,'/api/site-support');
 await click('Open materials');assert.equal(document.getElementById('workshop-assets').hidden,false);
 plans.push(reply('task','I will create your draft.'),{body:{reply:'Configured the draft.',changes:{name:'Music night',gamePlan:{rules:'Three rounds'},newTools:[{type:'scoreboard',name:'Scores',config:{entries:[{id:'red',name:'Red',score:0}]},connect:true}],assets:[{storageKey:'backdrop',role:'background',inProject:true,edits:{fit:'contain'}}]},action:null}});
 await send('Build my music game with a scoreboard and fit my backdrop');
 assert.equal(calls.at(-1).url,'/api/ai');assert.equal(calls.at(-1).body.request,'Build my music game with a scoreboard and fit my backdrop');
 let saved=saves.at(-1);assert.equal(saved.name,'Music night');assert.equal(saved.gamePlan.rules,'Three rounds');assert(saved.controls.length);assert.equal(saved.assets[0].edits.fit,'contain');assert.deepEqual(saved.publishedSnapshot,initial.publishedSnapshot);
 await click('Undo last AI edit');assert.equal(saves.at(-1).name,initial.name);assert.deepEqual(saves.at(-1).publishedSnapshot,initial.publishedSnapshot);
 plans.push(reply('task','I will prepare narration.'),{body:{reply:'Please choose a female or male voice',needsClarification:true,changes:{},action:null}});
 await send('Generate narration saying Welcome to the game');assert(container.querySelector('.ttc-support-transcript').textContent.includes('female or male'));
 plans.push(reply('task','I will use that voice.'),{body:{reply:'Preparing narration',changes:{},action:{type:'voice',prompt:'Welcome to the game',voice:'Aria'}}},{body:{url:'https://media.test/voice.mp3',model:'voice'}});
 await send('Female please');assert.equal(calls.findLast(call=>call.url==='/api/site-support').body.pendingTask,true);assert.equal(calls.at(-1).url,'/api/generate-asset');assert.equal(calls.at(-1).body.voice,'Aria');assert(stored.length);assert(container.querySelector('.ttc-support-transcript').textContent.includes('generated and saved'));
 plans.push(reply('task','I will edit the video.'),{body:{reply:'Preparing edit',changes:{overlay:{subtitle:'Keep this edit too'}},action:{type:'edit-video',sourceKey:'clip',prompt:'Add a neon border'}}},{body:{url:'https://media.test/edited.mp4'}});
 await send('Add a neon border to Clip.mp4');assert.equal(calls.at(-1).url,'/api/edit-video');assert(stored.at(-1).asset.name.includes('edited'));assert(saves.at(-1).assets.some(a=>a.storageKey==='clip'));assert.equal(saves.at(-1).overlay.subtitle,'Keep this edit too','Compound media task retains accompanying layout changes');
 const realCreate=dom.window.document.createElement.bind(dom.window.document);
 dom.window.document.createElement=(tag,...args)=>tag==='canvas'?{width:0,height:0,getContext:()=>({clearRect(){},translate(){},rotate(){},scale(){},drawImage(){}}),toBlob:callback=>callback(new Blob(['rendered'],{type:'image/png'}))}:realCreate(tag,...args);
 plans.push(reply('task','I will render the image copy.'),{body:{reply:'Rendering copy',changes:{overlay:{subtitle:'Copy task subtitle'}},action:{type:'render-copy',sourceKey:'backdrop',edits:{width:1280,height:720,crop:'landscape'}}}});
 await send('Make a 1280x720 copy of my backdrop');assert(stored.at(-1).asset.name.endsWith('-edited.png'));assert.equal(saves.at(-1).overlay.subtitle,'Copy task subtitle');assert(saves.at(-1).assets.some(a=>a.storageKey==='backdrop'));dom.window.document.createElement=realCreate;
 let videoPlayed=false;
 const makeVideo=()=>({duration:12,currentTime:0,ended:false,captureStream:()=>({getTracks:()=>[{stop(){}}]}),set src(value){queueMicrotask(()=>this.onloadedmetadata());},pause(){},play(){videoPlayed=true;this.currentTime=5;return Promise.resolve();}});
 dom.window.document.createElement=(tag,...args)=>tag==='video'?makeVideo():realCreate(tag,...args);
 plans.push(reply('task','I will trim the video.'),{body:{reply:'Preparing trim',changes:{},action:{type:'render-copy',sourceKey:'clip',edits:{trimStart:0,trimEnd:5}}}});
 await send('Make a five second copy of my clip');assert(!videoPlayed,'Audible video trim cannot autoplay from an old chat submission');
 const startTrim=[...container.querySelectorAll('.ttc-support-transcript button')].find(b=>b.textContent==='Start video trim');assert(startTrim&&startTrim.textContent==='Start video trim');await React.act(async()=>startTrim.click());
 assert(videoPlayed);assert(stored.at(-1).asset.name.endsWith('-trimmed.webm'));assert(saves.at(-1).assets.some(a=>a.storageKey==='clip'));dom.window.document.createElement=realCreate;
 plans.push(reply('task','I will make the requested image.'),{ok:false,body:{error:'Provider temporarily unavailable'}});
 const assetsBefore=saves.at(-1).assets.length;await send('Generate an image');assert(container.querySelector('.ttc-support-transcript').textContent.includes('Provider temporarily unavailable'));assert.equal(saves.at(-1).assets.length,assetsBefore);
 failSave=true;
 plans.push(reply('task','I will update that.'),{body:{reply:'Changed title',changes:{overlay:{title:'Kept in browser draft'}},action:null}});
 await send('Change title to Kept in browser draft');assert(container.querySelector('.ttc-support-transcript').textContent.includes('server save failed'));assert.equal(saves.at(-1).overlay.title,'Kept in browser draft');await click('Undo last AI edit');assert(container.querySelector('.ttc-support-transcript').textContent.includes('Undo is applied in this browser draft, but the server save failed'));failSave=false;
 let resolveOld;plans.push(()=>new Promise(resolve=>{resolveOld=resolve;}));await send('Pending old project request');
 initial.id='different-project';initial.name='Second project';await render();assert(!container.querySelector('.ttc-support-transcript').textContent.includes('Music night'));
 const callCount=calls.length;await React.act(async()=>resolveOld({ok:true,json:async()=>({kind:'task',reply:'Old request',targets:[]})}));assert.equal(calls.length,callCount,'A late router result cannot execute in a new project');
 await React.act(async()=>window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'})));assert(!container.querySelector('.ttc-support-panel'));
 assert(calls.every(c=>!c.url.includes('/live/')&&!c.url.includes('publish')));
 await React.act(async()=>root.unmount());console.log('PASS: actual app-wide chat -> real draft executor, connected scoreboard/background, undo, clarification continuation, stored generation/video-copy outcomes, errors and cross-project isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
