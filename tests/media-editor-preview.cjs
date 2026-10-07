const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const states=[];let cursor=0;
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/MediaEditor.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exportsObject,require:id=>id==='react'?{useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}}:require(id)});
const Editor=exportsObject.default;let tree,saved;
const asset={name:'Tall.png',type:'image/png',url:'https://example.test/image.png',edits:{brightness:80}};
function render(){cursor=0;tree=Editor({asset,onClose(){},onSaveAsNew:async value=>{saved=value;}});}
function nodes(n){if(!n||typeof n!=='object')return [];return [n,...[].concat(n.props?.children||[]).flatMap(nodes)];}
function text(n){if(typeof n==='string'||typeof n==='number')return String(n);return [].concat(n?.props?.children||[]).map(text).join('');}
function frame(){return nodes(tree).find(n=>n.props?.className?.startsWith('media-editor-preview '));}
render();nodes(tree).find(n=>n.type==='img').props.onLoad({currentTarget:{naturalWidth:600,naturalHeight:1800}});render();assert.equal(frame().props.style.aspectRatio,1/3);assert.match(frame().props.className,/crop-original/);assert.equal(frame().props.style.width,'min(100%, 16vh)');
nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'square'}});render();assert.equal(frame().props.style.aspectRatio,1);assert.match(frame().props.className,/crop-selected/);
nodes(tree).find(n=>n.type==='button'&&text(n)==='Show full image').props.onClick();render();assert.equal(frame().props.style.aspectRatio,1/3);assert.match(frame().props.className,/crop-original/);
(async()=>{await nodes(tree).find(n=>n.type==='button'&&text(n)==='Save edited copy').props.onClick();await Promise.resolve();assert.equal(saved.edits.crop,'original');assert.equal(saved.edits.zoom,1);assert.equal(saved.edits.offsetX,0);assert.equal(saved.edits.brightness,80);assert.equal(asset.edits.crop,undefined);console.log('PASS: portrait sources fit the preview; intentional crops are distinguished; Show full image resets framing and preserves color edits and the original asset.');})();
