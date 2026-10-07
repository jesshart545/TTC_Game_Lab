const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const runtime={states:[],cursor:0};
function useState(initial){const i=runtime.cursor++;if(!(i in runtime.states))runtime.states[i]=initial;return [runtime.states[i],value=>{runtime.states[i]=typeof value==='function'?value(runtime.states[i]):value;}];}
function load(file,requires={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id==='react'?{useState}:id==='react/jsx-runtime'?require(id):requires[id],crypto:require('node:crypto').webcrypto,Set});return exports;}
const pools=load('lib/asset-pools.ts'),board=load('lib/board-design.ts');
const Manager=load('components/AssetPoolManager.tsx',{'../lib/asset-pools':pools,'../lib/board-design':board,'./AssetThumbnail':{default:()=>null}}).default;
const Assignment=load('components/AssetPoolAssignment.tsx',{'../lib/asset-pools':pools}).default;
function nodes(element){if(!element||typeof element!=='object')return [];return [element,...[].concat(element.props?.children||[]).flatMap(nodes)];}
function text(element){if(typeof element==='string'||typeof element==='number')return String(element);return [].concat(element?.props?.children||[]).map(text).join('');}
const assets=[{name:'Picture.png',storageKey:'projects/test/picture',type:'image/png'},{name:'Video.mp4',storageKey:'projects/test/video',type:'video/mp4'},{name:'Voice.mp3',storageKey:'projects/test/audio',type:'audio/mpeg'}];
let saved=[],tree;
function render(Component=Manager,extra={}){runtime.cursor=0;tree=Component({pools:saved,assets,onChange:value=>{saved=JSON.parse(JSON.stringify(value));},...extra});return tree;}
function find(type,label){return nodes(tree).find(node=>node.type===type&&text(node).includes(label));}
render();nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'Round images'}});render();find('form','Create pool').props.onSubmit({preventDefault(){}});render();assert.equal(saved.length,1);assert.equal(saved[0].assetKeys.length,0);
find('button','Picture.png').props.onClick();render();find('button','Video.mp4').props.onClick();render();assert.equal(find('button','Add selected assets').props.disabled,false);find('button','Add selected assets').props.onClick();render();assert.equal(saved[0].assetKeys.length,2);assert(find('div','Picture.png'));assert(text(tree).includes('Added 2 assets'));
nodes(tree).find(n=>n.props?.['aria-label']==='Remove Picture.png from Round images').props.onClick();render();assert.deepEqual(saved[0].assetKeys,['projects/test/video']);assert.equal(assets.length,3);
runtime.states=[];render(Assignment,{asset:assets[0]});find('button','Add to pool').props.onClick();render(Assignment,{asset:assets[0]});assert(saved[0].assetKeys.includes(assets[0].storageKey));assert(text(tree).includes('In Round images'));
nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'New pool'}});render(Assignment,{asset:assets[0]});find('button','Create pool').props.onClick();render(Assignment,{asset:assets[0]});assert.equal(saved.length,2);assert.deepEqual(saved[1].assetKeys,[assets[0].storageKey]);
assert.throws(()=>pools.createAssetPool(saved,' new POOL '),/already exists/);assert.throws(()=>pools.createAssetPool(saved,'   '),/name/);
const updated=pools.setPoolAssetMembership(saved,saved[1].id,assets[0].storageKey,true);assert.equal(updated[1].assetKeys.length,1);
console.log('PASS: actual pool controls create groups, select mixed-media thumbnails, add/remove members, create-and-add from asset details, preserve library assets, survive serialization, and reject duplicate names.');
