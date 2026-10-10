const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,requires={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>requires[id]});return exports;}
const {applyDraftChanges}=load('lib/draft-edit.ts');
const {overlayAssetStyle}=load('components/OverlayAsset.tsx',{'react':{},'react/jsx-runtime':{}});
const asset={name:'Background.png',storageKey:'saved/background',type:'image/png',role:'background',inProject:true,edits:{zoom:2,offsetX:30,rotation:10,sound:true}};
const project={assets:[asset,{name:'Other.png',type:'image/png'}],overlay:{},controls:[],gameTools:[]};
const result=applyDraftChanges(project,{assets:[{storageKey:asset.storageKey,edits:{fit:'contain',placement:{x:0,y:0,width:100,height:100},zoom:1,rotation:0,offsetX:0,offsetY:0}}]});
assert(result.applied>0);const saved=JSON.parse(JSON.stringify(result.project.assets[0]));const style=overlayAssetStyle(saved,true);
assert.equal(style.objectFit,'contain');assert.equal(style.width,'100%');assert.equal(style.height,'100%');assert.equal(style.left,'0%');assert.match(style.transform,/scale\(1\) rotate\(0deg\)/);assert.equal(saved.edits.sound,true);assert.equal(asset.edits.zoom,2);
assert.equal(overlayAssetStyle({...saved,edits:{placement:{x:10,y:15,width:80,height:70}}},true).width,'80%');
assert.equal(overlayAssetStyle({...saved,edits:{}} ,true).objectFit,'contain');
assert.equal(overlayAssetStyle({...saved,edits:{fit:'fill'}},true).objectFit,'fill');
assert.equal(overlayAssetStyle({...saved,edits:{}},false).objectFit,'contain');
assert.equal(applyDraftChanges(project,{assets:[{storageKey:asset.storageKey,edits:{fit:'invalid'}}]}).applied,0);
console.log('PASS: background fit survives saved edits; background placement honored; transforms reset; audio and other assets preserved; uncropped background and layer defaults retained.');
