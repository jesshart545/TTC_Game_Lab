const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');

// --- Component behaviour: a pool with audio shows its player inline in
// the pools list, before any selection, and selecting the pool does not
// produce a second player for it (the selection-gated player is gone).
const runtime={states:[],cursor:0};
function useState(initial){const i=runtime.cursor++;if(!(i in runtime.states))runtime.states[i]=initial;return [runtime.states[i],value=>{runtime.states[i]=typeof value==='function'?value(runtime.states[i]):value;}];}
function load(file,requires={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id==='react'?{useState}:id==='react/jsx-runtime'?require(id):requires[id],crypto:require('node:crypto').webcrypto,Set});return exports;}
const poolsLib=load('lib/asset-pools.ts'),board=load('lib/board-design.ts');
function PlaylistPlayerStub(){return null;}
const Manager=load('components/AssetPoolManager.tsx',{'../lib/asset-pools':poolsLib,'../lib/board-design':board,'./AssetThumbnail':{default:()=>null},'./PlaylistPlayer':{default:PlaylistPlayerStub}}).default;
function nodes(element){if(!element||typeof element!=='object')return [];return [element,...[].concat(element.props?.children||[]).flatMap(nodes)];}
function text(element){if(typeof element==='string'||typeof element==='number')return String(element);return [].concat(element?.props?.children||[]).map(text).join('');}
const assets=[
 {name:'Cover.png',storageKey:'k-cover',type:'image/png',url:'https://example.test/cover'},
 {name:'Second.mp3',storageKey:'k-2',type:'audio/mpeg',url:'https://example.test/2'},
 {name:'First.mp3',storageKey:'k-1',type:'audio/mpeg',url:'https://example.test/1'},
];
const pools=[
 {id:'p1',name:'Road Trip',assetKeys:['k-1','k-cover','k-2']},
 {id:'p2',name:'Pics',assetKeys:['k-cover']},
];
let tree;
function render(){runtime.cursor=0;tree=Manager({pools,assets,onChange:()=>{}});return tree;}
function players(){return nodes(tree).filter(node=>node.type===PlaylistPlayerStub);}

render();
assert.equal(players().length,1,'exactly one inline player before any pool is selected');
assert.equal(players()[0].props.poolName,'Road Trip','the inline player belongs to the audio pool');
assert.deepEqual(players()[0].props.tracks.map(track=>track.storageKey),['k-1','k-2'],'the inline player queues the pool audio in pool order');
console.log('PASS: a pool with audio tracks shows its playlist player inline in the pools list without being opened, and a pool without audio shows none.');

nodes(tree).find(node=>node.type==='button'&&text(node).includes('Road Trip')).props.onClick();
render();
assert.equal(players().length,1,'selecting the pool does not add a second player for it');
assert.equal(players()[0].props.poolName,'Road Trip');
console.log('PASS: opening a pool keeps exactly one player for it — the inline list player replaced the selection-gated one.');

// --- Upload completion path: handleFiles keeps the created pool's
// player data and hands it to the Jewel panel, which renders the
// player with the completion status.
const page=fs.readFileSync('app/project/[id]/page.tsx','utf8');
assert.match(page,/createdPlaylists\.push\(\{ poolName: created\.pool\.name, tracks:/,'the upload path captures the created pool and its tracks');
assert.match(page,/setAddedPlaylist\(\{ projectId: project\.id, poolName: newestPlaylist\.poolName, tracks: newestPlaylist\.tracks \}\)/,'the upload completion stores the created playlist for presentation');
assert.match(page,/addedPlaylist=\{addedPlaylist && addedPlaylist\.projectId === project\.id \? addedPlaylist : null\}/,'the page hands the created playlist to the panel for its own project only');
console.log('PASS: the zip upload completion path returns the created pool\u2019s player data and passes it to the panel.');

const panel=fs.readFileSync('components/WorkshopAiPanel.tsx','utf8');
assert.match(panel,/import PlaylistPlayer from "\.\/PlaylistPlayer";/,'the panel imports the playlist player');
assert.match(panel,/addedPlaylist&&addedPlaylist\.tracks\.length>0&&<PlaylistPlayer poolName=\{addedPlaylist\.poolName\} tracks=\{addedPlaylist\.tracks\}\/>/,'the panel renders the created playlist\u2019s player beside the completion status');
console.log('PASS: the panel renders the just-created playlist\u2019s player with the upload completion status.');

// --- Every "Upload your media" box says a .zip of songs becomes a
// playable playlist.
for(const file of ['components/TalkshowStage.tsx','components/TalkshowSteps.tsx']){
  const source=fs.readFileSync(file,'utf8');
  const card=source.indexOf('Upload your media');
  assert.ok(card>=0,`${file} still has its Upload your media box`);
  assert.match(source.slice(card,card+400),/A \.zip of songs becomes a playable playlist\./,`${file} mentions the zip playlist on its upload box`);
}
console.log('PASS: the Talkshow upload boxes say a .zip of songs becomes a playable playlist.');
