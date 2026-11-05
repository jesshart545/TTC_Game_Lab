const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>');global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollTo=function(){};
const React=require('react'),{createRoot}=require('react-dom/client'),loaded={};let request,saved;
const fontPickerExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/FontPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:fontPickerExports,require:id=>id==='../lib/fonts'?require('./load.cjs')('lib/fonts.ts'):require(id)});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/MediaEditor.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:loaded,require:id=>id==='../lib/image-layout'?require('./load.cjs')('lib/image-layout.ts'):id==='../lib/video-edit-poll'?require('./load.cjs')('lib/video-edit-poll.ts'):id==='../lib/backdrop-text'?require('./load.cjs')('lib/backdrop-text.ts'):id==='../lib/ai-edit'?require('./load.cjs')('lib/ai-edit.ts'):id==='./FontPicker'?fontPickerExports:require(id),fetch:async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({url:'https://example.test/recomposed.png'})}}});
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
 // The AI Edit section (Jessica, 2026-11-04 — she asked for the AI edit
 // back in this dialog, as a first-class section on the same pipeline
 // Jewel uses): its prompt box and apply button are present, and merely
 // opening the editor — and using its manual edits — sends no AI
 // request anywhere.
 assert.ok(button('Apply AI edit'),'AI Edit section: the apply button is present');
 assert.ok(document.querySelector('.media-editor-ai input'),'AI Edit section: the prompt box is present');
 assert.equal(request,undefined,'No edit request was sent anywhere');
 await React.act(async()=>root.unmount());console.log('PASS: editor preview and saved copy share exact dimensions/fit; the manual layout edits save an exact-size new copy, and the AI Edit section is present but sends nothing until asked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
