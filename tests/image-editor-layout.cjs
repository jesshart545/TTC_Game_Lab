const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>');global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollTo=function(){};
const React=require('react'),{createRoot}=require('react-dom/client'),loaded={};let request,saved;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/MediaEditor.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:loaded,require:id=>id==='../lib/image-layout'?require('./load.cjs')('lib/image-layout.ts'):id==='../lib/video-edit-poll'?require('./load.cjs')('lib/video-edit-poll.ts'):require(id),fetch:async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({url:'https://example.test/recomposed.png'})}}});
const root=createRoot(document.getElementById('root')),asset={name:'Portrait.png',url:'https://example.test/original.png',type:'image/png'};
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const change=(element,value)=>{const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
(async()=>{
 await React.act(async()=>root.render(React.createElement(loaded.default,{asset,onSave:()=>{},onClose:()=>{},onSaveAsNew:async value=>{saved=value}})));
 const image=document.querySelector('img');Object.defineProperties(image,{naturalWidth:{value:900},naturalHeight:{value:1600}});await React.act(async()=>image.dispatchEvent(new dom.window.Event('load')));
 await React.act(async()=>button('Full overlay · 1920 × 1080').click());
 assert.equal(document.querySelector('[aria-label="Image output width"]').value,'1920');assert.equal(document.querySelector('[aria-label="Image output height"]').value,'1080');assert.equal(image.style.objectFit,'contain');
 await React.act(async()=>change(document.querySelector('[aria-label="Image fitting"]'),'cover'));assert.equal(image.style.objectFit,'cover');
 await React.act(async()=>button('Save edited copy').click());assert.equal(saved.edits.width,1920);assert.equal(saved.edits.height,1080);assert.equal(saved.edits.fit,'cover');assert.equal(asset.edits,undefined);
 // Jewel Piece 2 Half B: the AI-edit request (prompt box + "Make this change"
 // + "Adapt artwork") is gone from the editor — AI edits run through Jewel.
 // The editor keeps only its manual, direct edits.
 assert.equal(button('Make this change'),undefined,'Half B: no AI-edit button in the MediaEditor');
 assert.equal(button('Adapt artwork for full overlay'),undefined,'Half B: no Adapt-artwork AI request in the MediaEditor');
 assert.equal(document.querySelector('.media-editor-ai input'),null,'Half B: no AI prompt box in the MediaEditor');
 assert.equal(request,undefined,'No edit request was sent anywhere');
 await React.act(async()=>root.unmount());console.log('PASS: editor preview and saved copy share exact dimensions/fit; the manual layout edits save an exact-size new copy, and no AI-edit affordance remains.');
})().catch(e=>{console.error(e);process.exitCode=1;});
