const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ChanceTools.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,require:id=>id.endsWith('.css')?{}:require(id),Math});
const {WheelDisplay,DiceDisplay,wheelRotation}=exportsObject;
for(const count of [2,3,5,8,25])for(let winner=0;winner<count;winner++){const center=(winner+.5)*360/count;assert(Math.abs((center+wheelRotation(winner,count,1))%360)<1e-8,'winner must land exactly under the fixed pointer');}
let html=renderToStaticMarkup(React.createElement(WheelDisplay,{entries:['A','B','C'],result:'C',elapsed:4000}));assert(html.includes('Wheel landed on C'));assert(html.includes('>C</strong>'));
html=renderToStaticMarkup(React.createElement(WheelDisplay,{entries:['A','B'],result:'B',elapsed:200}));assert(html.includes('Spinning…'));assert(!html.includes('>B</strong>'));
for(let value=1;value<=6;value++){html=renderToStaticMarkup(React.createElement(DiceDisplay,{result:value,sides:6,elapsed:1400}));assert.equal((html.match(/class="pip"/g)||[]).length,value);assert(html.includes('Result: '+value));}
html=renderToStaticMarkup(React.createElement(DiceDisplay,{result:17,sides:20,elapsed:1400}));assert(html.includes('20-sided die: 17'));
console.log('PASS: every segment lands on the pointer; wheel result stays hidden during spin; all six pip faces match results; larger dice preserve their selected result.');
