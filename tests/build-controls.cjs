const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,requires={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>requires[id],crypto:require('node:crypto').webcrypto,Date,Math,Set});return exports;}
const cards=load('lib/question-cards.ts'),connections=load('lib/control-connections.ts',{'./question-cards':cards});
const {addCreationControl}=load('lib/build-controls.ts',{'./control-connections':connections,'./board-design':load('lib/board-design.ts')});
const {mediaKind,boardAreas}=load('lib/board-design.ts');
let p={assets:[{name:'Animated.webm',type:'Generated',url:'https://example.test/board.webm',inProject:true}],gameTools:[],controls:[]};
assert.equal(mediaKind(p.assets[0]),'video');assert.equal(mediaKind({name:'loop.gif',type:'Generated'}),'image');
let result=addCreationControl(p,'asset','Animated.webm');assert.equal(result.project.assets[0].inProject,false);assert.equal(result.project.controls.length,2);assert.equal(result.project.controls[0].action,'asset.show.Animated.webm');assert.equal(connections.controlConnectionError(result.project,result.project.controls[0]),null);assert.equal(addCreationControl(result.project,'asset','Animated.webm').project.controls.length,2);
p=cards.createCardSystem(p);const card=p.gameTools.find(t=>t.type==='question-card');result=addCreationControl(p,'tool',card.id);assert(result.project.controls.some(c=>c.action==='cards.clear.'+card.id));assert.equal(card.config.turnTimerId,'');
const blank=cards.createCardSystem(p,undefined,'blank');const b=blank.gameTools.find(t=>t.type==='blank-card');result=addCreationControl(blank,'tool',b.id);assert.equal(connections.controlConnectionError(result.project,result.project.controls.find(c=>c.id===result.controlId)),null);
const areas=boardAreas({config:{areas:[{label:'Space',x:95,width:50,y:98,height:30}]}});assert.equal(areas[0].width,5);assert.equal(areas[0].height,2);
console.log('PASS: animated media detection; additions do not autoplay; display/hide controls; no duplicate controls; timer-free cards; blank-card controls; board spaces stay within bounds.');
