const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>');global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollTo=function(){};
const React=require('react'),{createRoot}=require('react-dom/client'),loaded={};let request,saved;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/MediaEditor.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:loaded,require:id=>id==='../lib/image-layout'?require('./load.cjs')('lib/image-layout.ts'):require(id),fetch:async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({url:'https://example.test/recomposed.png'})}}});
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
 await React.act(async()=>button('Adapt artwork for full overlay').click());assert.equal(request,undefined);assert.match(document.querySelector('.media-editor-ai input').value,/Preserve the original subjects/);
 await React.act(async()=>button('Make this change').click());assert.equal(request.url,'/api/edit-image');assert.equal(request.body.aspectRatio,'16:9');assert.equal(request.body.imageUrl,asset.url);assert.equal(saved.edits.width,1920);assert.equal(saved.edits.height,1080);assert.equal(saved.edits.fit,'contain');assert.equal(saved.storageKey,undefined);assert.equal(saved.url,'https://example.test/recomposed.png');
 await React.act(async()=>root.unmount());console.log('PASS: editor preview and copy share exact dimensions/fit; adaptation explicitly sends the original and widescreen shape, then saves an exact-size new copy.');
})().catch(e=>{console.error(e);process.exitCode=1;});
