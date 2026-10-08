const assert = require('node:assert/strict');
const load = require('./load.cjs');
const {checkedAssistantMediaAction} = load('lib/assistant-media-actions.ts');
const {applyBuildChanges} = load('lib/build-edits.ts');
const {createProject} = load('lib/project.ts');
const assets = [
  {name:'Image.png',type:'fal-ai/nano-banana-2',storageKey:'image-key',url:'https://media.test/image.png'},
  {name:'Video.mp4',type:'fal-ai/wan/image-to-video',storageKey:'video-key',url:'https://media.test/video.mp4'},
  {name:'Sound.mp3',type:'audio/mp3',storageKey:'audio-key'},
];
const copy = checkedAssistantMediaAction({type:'render-copy',sourceKey:'image-key',edits:{width:1920,height:1080,crop:'landscape',brightness:80}},assets);
assert.equal(copy.edits.width,1920);
assert.equal(checkedAssistantMediaAction({type:'edit-video',sourceKey:'video-key',prompt:'Add subtle neon'},assets).type,'edit-video');
assert.equal(checkedAssistantMediaAction({type:'render-copy',sourceKey:'video-key',edits:{trimStart:2,trimEnd:5}},assets).edits.trimEnd,5);
for (const input of [
  {type:'render-copy',sourceKey:'missing',edits:{width:10}},
  {type:'render-copy',sourceKey:'audio-key',edits:{width:10}},
  {type:'edit-video',sourceKey:'image-key',prompt:'Add neon'},
  {type:'render-copy',sourceKey:'image-key',edits:{width:9999}},
  {type:'render-copy',sourceKey:'image-key',edits:{width:1.5}},
  {type:'render-copy',sourceKey:'image-key',edits:{url:'https://evil.test'}},
  {type:'render-copy',sourceKey:'video-key',edits:{brightness:20}},
  {type:'render-copy',sourceKey:'video-key',edits:{trimStart:8,trimEnd:4}},
]) assert.throws(()=>checkedAssistantMediaAction(input,assets));
assert.equal(checkedAssistantMediaAction({type:'unsupported'},assets),null);
const project = {...createProject('Safe test'),assets,gameTools:[],controls:[],gamePlan:{rules:'Keep me'},publishedSnapshot:{marker:'unchanged'}};
const result = applyBuildChanges(project,{name:'Neon music game',gamePlan:{theme:'Music quiz',loop:'Take turns',rules:'Three rounds'},newTools:[{type:'scoreboard',name:'Scores',config:{entries:[{id:'red',name:'Red',score:0}]},connect:true}],overlay:{title:'Music night'}});
assert(result.applied>0);
assert.equal(result.project.name,'Neon music game');
assert.equal(result.project.gamePlan.rules,'Three rounds');
assert.equal(result.project.gameTools.length,1);
assert(result.project.controls.length>0);
assert.equal(project.gamePlan.rules,'Keep me');
assert.deepEqual(result.project.publishedSnapshot,project.publishedSnapshot);
console.log('PASS: exact saved media identity, supported render settings, video/image distinction, real plan/tool/control changes and untouched live snapshot.');
