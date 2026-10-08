const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('node:assert/strict');
const ts=require('typescript');
const {JSDOM}=require(process.env.TTC_DOM_TEST_MODULE||'jsdom');
const React=require('react');

const dom=new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>',{url:'https://example.test'});
global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const {createRoot}=require('react-dom/client');

const fetchCalls=[];
const plans=[];
function response(body,ok=true){return {ok,json:async()=>body};}
function fakeFetch(url,options){
  assert(['/api/web-search','/api/web-research'].includes(String(url)),'No YouTube, live, publish, generation, or other endpoint may be called: '+url);
  fetchCalls.push({url:String(url),options});
  const plan=plans.shift();
  assert(plan,'Unexpected request to '+url);
  return typeof plan==='function'?plan(url,options):Promise.resolve(plan);
}

const cache={};
function source(file){return fs.readFileSync(path.join(process.cwd(),file),'utf8');}
function compile(file){
  if(cache[file])return cache[file];
  const exports={};cache[file]=exports;
  const code=ts.transpileModule(source(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const context={
    exports,
    require(id){
      if(id==='react')return React;
      if(id==='react/jsx-runtime')return require('react/jsx-runtime');
      if(id==='../lib/web-research')return compile('lib/web-research.ts');
      if(id==='./WebResearchWorkspace')return compile('components/WebResearchWorkspace.tsx');
      if(id==='../lib/web-search')return {};
      if(id==='../lib/support-client')return {supportPanelEvent: panel => dom.window.dispatchEvent(new dom.window.CustomEvent('ttc-assistant-panel',{detail:panel}))};
      throw new Error('Unexpected module '+id+' from '+file);
    },
    window:dom.window,document:dom.window,fetch:fakeFetch,console,crypto:require('node:crypto').webcrypto,
    AbortController,URL,Date,Math,Set,Array,JSON,Promise,setTimeout,clearTimeout,
  };
  vm.runInNewContext(code,context,{filename:file});
  return exports;
}

const GoogleSearch=compile('components/GoogleSearch.tsx').default;
const container=document.getElementById('root');
const root=createRoot(container);
function button(text){return [...container.querySelectorAll('button')].find(item=>item.textContent.trim()===text);}
async function click(text){const target=button(text);assert(target,'Missing button '+text);await React.act(async()=>{target.click();await Promise.resolve();await Promise.resolve();});}
async function submitSearch(){const form=container.querySelector('.web-research-search');assert(form,'Missing web search form');await React.act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));}
async function input(selector,value){
  const target=container.querySelector(selector);assert(target,'Missing input '+selector);
  const descriptor=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')||Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value');
  descriptor.set.call(target,value);
  await React.act(async()=>{target.dispatchEvent(new dom.window.Event('input',{bubbles:true}));target.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  return target;
}
async function textarea(selector,value){
  const target=container.querySelector(selector);assert(target,'Missing textarea '+selector);
  Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(target,value);
  await React.act(async()=>{target.dispatchEvent(new dom.window.Event('input',{bubbles:true}));target.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  return target;
}
async function selectResult(index){const target=container.querySelectorAll('input[type="checkbox"]')[index];assert(target,'Missing result selection '+index);await React.act(async()=>target.click());}
function searchResult(title,url,summary){return {title,url,summary,evidenceToken:'signed-evidence-token'};}

(async()=>{
  const first=searchResult('Apollo source','https://science.example/apollo','Apollo was a program supported by the returned search snippet.');
  const second=searchResult('Independent source','https://archive.example/apollo','A second search snippet offers another source for comparison.');
  let pools=[];let rejectPool=false;
  const onSavePool=(name,results)=>{if(rejectPool)throw new Error('Draft pool save failed');pools.push({name,results});};

  await React.act(async()=>root.render(React.createElement(GoogleSearch,{projectId:'draft-a',hostKey:'host-secret',onSavePool})));
  assert(container.querySelector('.web-research-embedded'),'Default wrapper must keep the rehearsal workspace visible.');
  assert(button('General web').getAttribute('aria-pressed')==='true');
  const beforeModeFetches=fetchCalls.length;
  await click('Movie quotes');assert.equal(fetchCalls.length,beforeModeFetches,'Modes must not search automatically.');
  await click('Songs / lyrics');assert(container.textContent.includes('Full lyric text is not reproduced'),'Music mode must present the rights/lyrics caution without implying that licensed use is prohibited.');
  assert.equal(fetchCalls.length,beforeModeFetches);
  await click('General web');

  plans.push(response({results:[first,second]}));
  await input('#web-research-query','Apollo history');
  await submitSearch();
  assert.equal(fetchCalls.length,1);
  assert.equal(fetchCalls[0].url,'/api/web-search');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body),{q:'Apollo history'});
  assert.equal(fetchCalls[0].options.headers['x-host-key'],'host-secret');
  assert(container.textContent.includes('Apollo source'));
  assert(!container.textContent.includes('Apollo was a program supported by the returned search snippet.'),'Search excerpts begin collapsed.');
  await click('Read search snippet');
  assert(container.textContent.includes('Search snippet'));
  assert(container.textContent.includes('not full-page content'));

  await selectResult(0);
  assert(container.querySelector('.web-research-comparison'),'Selected sources must support side-by-side comparison.');
  await input('input[placeholder="Name this source pool"]','Apollo sources');
  await click('Save selected results as pool');
  assert.equal(pools.length,1);assert.equal(pools[0].name,'Apollo sources');assert.equal(pools[0].results[0].url,first.url);
  assert(container.textContent.includes('Added to your draft pool. Open it in Workshop to create cards when ready.'));
  await selectResult(0);
  rejectPool=true;
  await input('input[placeholder="Name this source pool"]','Will fail');
  await click('Save selected results as pool');
  assert(container.textContent.includes('Draft pool save failed')||container.textContent.includes('could not be saved'),'Pool callback failures must remain visible without losing work.');
  assert(container.querySelector('.web-research-comparison'),'Failed pool save must keep selected comparison sources.');
  rejectPool=false;

  plans.push(response({
    analysis:{verdict:'supported',summary:'The selected snippet supports the stated program relationship.',findings:[{text:'The source describes the program.',sourceIds:[0]}],evidence:[{sourceId:0,quote:'Apollo was a program'}],limitation:'Only one returned snippet was examined.'},
    sources:[{title:first.title,url:first.url,summary:first.summary}],
  }));
  await click('Explain selected evidence');
  assert.equal(fetchCalls[1].url,'/api/web-research');
  const analysisRequest=JSON.parse(fetchCalls[1].options.body);
  assert.equal(analysisRequest.q,'Apollo history');assert.equal(analysisRequest.purpose,'general');assert.equal(analysisRequest.sources[0].evidenceToken,'signed-evidence-token');
  assert(container.textContent.includes('Evidence supports'));
  assert(!container.textContent.includes('Verified'),'Supported evidence must never be labeled verified.');
  const citation=container.querySelector('.web-research-evidence-result a');assert.equal(citation.href,first.url,'Citations must use response source URLs.');
  let resolveChangedQuery;
  plans.push(()=>new Promise(resolve=>{resolveChangedQuery=resolve;}));
  await click('Explain selected evidence');
  await input('#web-research-query','A different pending question');
  await React.act(async()=>resolveChangedQuery(response({
    analysis:{verdict:'supported',summary:'Old-query explanation must stay hidden.',findings:[],evidence:[],limitation:'Mocked old response.'},
    sources:[first],
  })));
  assert(!container.textContent.includes('Old-query explanation must stay hidden.'),'Editing the query must invalidate an in-flight explanation.');
  assert(button('Explain selected evidence').disabled,'Explain cannot use old search evidence as though it answered the newly typed query.');
  await input('#web-research-query','Apollo history');
  await selectResult(0);
  assert(!container.textContent.includes('Evidence supports'),'Changing selected evidence must clear an old verdict.');

  plans.push(response({results:[first,second]}));
  await click('Trivia / fact-check');
  await input('#web-research-query','Did Apollo happen?');
  await submitSearch();
  await selectResult(0);
  assert(button('Explain selected evidence').disabled,'Fact-check analysis needs two selected sources.');
  assert(container.textContent.includes('at least 2 selected sources'));
  await selectResult(1);
  assert(!button('Explain selected evidence').disabled);
  plans.push(response({
    analysis:{verdict:'conflicting',summary:'The mocked evidence response reports a conflict.',findings:[{text:'Compare both sources.',sourceIds:[0,1]}],evidence:[{sourceId:0,quote:'Apollo was a program'},{sourceId:1,quote:'A second search snippet'}],limitation:'Returned snippets can omit context.'},
    sources:[{title:first.title,url:first.url,summary:first.summary},{title:second.title,url:second.url,summary:second.summary}],
  }));
  await click('Explain selected evidence');
  assert(container.textContent.includes('Conflicting evidence'));

  let resolveOld;
  plans.push(()=>new Promise(resolve=>{resolveOld=resolve;}));
  await input('#web-research-query','Old search');await submitSearch();
  plans.push(response({results:[searchResult('New result','https://new.example/result','Newest response wins.')]}));
  await input('#web-research-query','New search');await submitSearch();
  assert(container.textContent.includes('New result'));
  await React.act(async()=>resolveOld(response({results:[searchResult('Old result','https://old.example/result','Old response must not replace new.')] })));
  assert(container.textContent.includes('New result'));assert(!container.textContent.includes('Old result'));
  plans.push(response({error:'Search provider failed'},false));
  await input('#web-research-query','Broken search');await submitSearch();
  assert(container.textContent.includes('Search provider failed'));
  assert(container.textContent.includes('New result'),'Failed searches preserve prior usable results.');

  // Saved findings keep only note fields, never host keys or signed evidence tokens.
  await selectResult(0);
  await click('Save finding to private notes');
  const savedNotes=dom.window.localStorage.getItem('ttc-private-research:draft%3Adraft-a');
  assert(savedNotes&&savedNotes.includes('New result'));assert(!savedNotes.includes('host-secret'));assert(!savedNotes.includes('signed-evidence-token'));

  const helpers=compile('lib/web-research.ts');
  const originalRead=helpers.readResearchNotes;
  let scopeCommitWasPrivate=false;
  helpers.readResearchNotes=(scope)=>{
    if(scope==='draft:draft-other')scopeCommitWasPrivate=!container.querySelector('.web-research-note')&&!container.querySelector('.web-research-comparison');
    return originalRead(scope);
  };
  let resolvePreviousScope;
  plans.push(()=>new Promise(resolve=>{resolvePreviousScope=resolve;}));
  await input('#web-research-query','Previous-scope request');await submitSearch();
  await React.act(async()=>root.render(React.createElement(GoogleSearch,{projectId:'draft-other',hostKey:'host-secret',onSavePool})));
  assert(scopeCommitWasPrivate,'The new scope must commit without prior notes/results before its passive load effect, not merely clear them afterward.');
  helpers.readResearchNotes=originalRead;
  assert.equal(container.querySelector('#web-research-query').value,'');
  assert(!container.querySelector('.web-research-comparison'),'Changing scope clears previous-source selections without needing a component remount.');
  await React.act(async()=>resolvePreviousScope(response({results:[first]})));
  assert(!container.textContent.includes('Apollo source'),'A previous-scope response cannot populate the new workspace.');
  assert(!container.querySelector('.web-research-note'),'A new scope does not inherit prior private notes.');

  await React.act(async()=>root.render(React.createElement(GoogleSearch,{key:'scope-b',projectId:'draft-b'})));
  assert(!container.textContent.includes('New result')||!container.querySelector('.web-research-note'),'A different draft scope must not load the previous draft notes.');
  await React.act(async()=>root.render(React.createElement(GoogleSearch,{key:'scope-a-again',projectId:'draft-a'})));
  await React.act(async()=>{await Promise.resolve();});
  assert.equal(container.querySelector('.web-research-note input')?.value,'New result','Returning to a scope restores only that scope\'s browser-local notes.');

  // A docked workspace is non-modal, can close/reopen without losing work, and safely ignores a closed request.
  await React.act(async()=>root.render(React.createElement(GoogleSearch,{key:'docked',slug:'live-one',hostKey:'dock-key',docked:true})));
  const launcher=container.querySelector('.web-research-launch-button');assert(launcher);assert(container.querySelector('.web-research-panel').hidden);
  await React.act(async()=>launcher.click());
  plans.push(response({results:[first]}));
  await input('#web-research-query','Live source');await submitSearch();await selectResult(0);
  assert(container.querySelector('.web-research-comparison'));
  let resolveClosed;
  plans.push(()=>new Promise(resolve=>{resolveClosed=resolve;}));
  await input('#web-research-query','Closed request');await submitSearch();
  await click('Close');
  assert(container.querySelector('.web-research-panel').hidden,'Close hides the non-modal side panel.');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(dom.window.document.activeElement,launcher,'Close returns focus to the launcher.');
  await React.act(async()=>resolveClosed(response({results:[searchResult('Closed response','https://closed.example/result','This must be ignored.')] })));
  await React.act(async()=>launcher.click());
  assert(container.querySelector('.web-research-comparison'),'Closing and reopening retains prior results and selections.');
  assert(!container.textContent.includes('Closed response'),'Replies resolving after close cannot replace retained work.');
  const escape=new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true});
  await React.act(async()=>document.dispatchEvent(escape));
  assert(container.querySelector('.web-research-panel').hidden,'Escape closes a docked panel without clearing its state.');

  // Storage failures show a warning but leave an in-session note usable.
  Object.defineProperty(dom.window,'localStorage',{configurable:true,value:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}});
  await React.act(async()=>root.render(React.createElement(GoogleSearch,{key:'blocked',projectId:'blocked'})));
  assert(container.textContent.includes('Browser storage is unavailable or unreadable'));
  await input('input[placeholder="What should you remember?"]','Session finding');
  await textarea('textarea[placeholder="Write a finding, caveat, or follow-up…"]','Still editable without storage.');
  await click('Save private finding');
  assert.equal(container.querySelector('.web-research-note input')?.value,'Session finding');
  assert.equal(container.querySelector('.web-research-note textarea')?.value,'Still editable without storage.');
  assert(container.textContent.includes('not saved across refreshes'));

  await React.act(async()=>root.unmount());
  assert(fetchCalls.every(call=>['/api/web-search','/api/web-research'].includes(call.url)));
  console.log('PASS: Web Research uses only mocked web/evidence endpoints; supports optional modes, snippets, comparison, explicit sourced analysis/citations, stale/error safety, docked close/reopen, scoped browser notes, blocked storage, and explicit draft pool saves.');
})().catch(error=>{console.error(error);process.exitCode=1;});
