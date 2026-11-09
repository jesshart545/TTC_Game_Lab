const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),{JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>');global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;const React=require('react'),{createRoot}=require('react-dom/client');const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/CompactConversation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsObject,window:dom.window,require:id=>require(id)});const Chat=exportsObject.default;
const messages=[{role:'user',text:'First question'},{role:'assistant',text:'First answer'},{role:'user',text:'Duplicate prompt sent twice'},{role:'assistant',text:'Plan reply to the duplicate'},{role:'user',text:'Last question'}];
const snapshot=JSON.stringify(messages);
const removeAt=(list,index)=>list.filter((_,i)=>i!==index);
(async()=>{
  const root=createRoot(document.getElementById('root'));
  const removeButtons=()=>[...document.querySelectorAll('.compact-message-remove')];
  // Regular viewers: no remove control, whatever the props.
  await React.act(async()=>root.render(React.createElement(Chat,{messages})));
  assert.equal(removeButtons().length,0,'no remove control without the admin flag');
  await React.act(async()=>root.render(React.createElement(Chat,{messages,canRemoveMessages:true})));
  assert.equal(removeButtons().length,0,'admin flag without a handler still shows no control');
  // Admin with a handler: one quiet control per visible message (recent four by default).
  const removed=[];
  await React.act(async()=>root.render(React.createElement(Chat,{messages,canRemoveMessages:true,onRemoveMessage:index=>removed.push(index)})));
  assert.equal(removeButtons().length,4,'one remove control per visible message');
  // Removing the last message reports its true index in the full history.
  await React.act(async()=>removeButtons()[3].click());
  assert.deepEqual(removed,[4]);
  // Earlier messages report their true index too, once history is shown.
  const showEarlier=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('earlier messages'));
  assert(showEarlier,'history expander present');
  await React.act(async()=>showEarlier.click());
  assert.equal(removeButtons().length,5,'every message in the full history carries the control');
  await React.act(async()=>removeButtons()[0].click());
  assert.deepEqual(removed,[4,0]);
  await React.act(async()=>root.unmount());
  assert.equal(JSON.stringify(messages),snapshot,'rendering never mutates the saved conversation');
  // Removal semantics — exactly the filter the page persists with:
  // removing from the middle or the end leaves every other message in order.
  assert.deepEqual(removeAt(messages,2).map(m=>m.text),['First question','First answer','Plan reply to the duplicate','Last question']);
  assert.deepEqual(removeAt(messages,4).map(m=>m.text),['First question','First answer','Duplicate prompt sent twice','Plan reply to the duplicate']);
  assert.deepEqual(removeAt(messages,0).map(m=>m.text),['First answer','Duplicate prompt sent twice','Plan reply to the duplicate','Last question']);
  assert.equal(messages.length,5,'the filter returns a new array; the original is untouched');
  // Wiring: the panel gates the control on the admin flag and forwards
  // the handler; the page confirms in-page (never window.confirm) and
  // persists the array minus exactly that index; Clear chat is unchanged.
  const panel=fs.readFileSync('components/WorkshopAiPanel.tsx','utf8');
  assert(panel.includes('canRemoveMessages={viewerIsAdmin}'),'the panel gates the remove control on the admin flag, like Clear chat');
  assert(panel.includes('onRemoveMessage={onRemoveMessage}'),'the panel forwards the remove handler to the conversation');
  const page=fs.readFileSync('app/project/[id]/page.tsx','utf8');
  assert(page.includes('onRemoveMessage={(index) => setMessagePendingRemove(index)}'),'the page receives the remove request from the panel');
  assert(page.includes('title="Remove this message?"'),'the page asks for confirmation before removing one message');
  assert(page.includes('messages: project.messages.filter((_, i) => i !== index)'),'the page persists the messages array minus exactly that index');
  assert(page.includes('persist({ ...project, messages: [] })'),'Clear chat still clears every message');
  assert(page.includes('onClearChat={() => setConfirmingClearChat(true)}'),'Clear chat wiring is unchanged');
  assert(!page.includes('window.confirm'),'removal never falls back to a native browser confirm()');
  console.log('PASS: admin-only per-message remove control reports the true message index; removing one message (middle or end) leaves the others in order; regular viewers see nothing; Clear chat behavior is unchanged.');
})().catch(error=>{console.error(error);process.exitCode=1;});
