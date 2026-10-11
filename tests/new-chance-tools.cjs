const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ChanceTools.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,require:id=>id.endsWith('.css')?{}:require(id),Math});
const {PlinkoDisplay,plinkoPath,HigherLowerDisplay,CliffhangerDisplay,PrizeWheelDisplay}=exportsObject;

// ---- Plinko: ball lands in the predetermined winner slot, deterministic ----
for(let w=0;w<9;w++){
 const path=plinkoPath(w,9,9),last=path[path.length-1],target=(w+0.5)*(400/9);
 assert(Math.abs(last.x-target)<1e-8,'plinko ball must land in the predetermined winner slot');
}
assert.equal(JSON.stringify(plinkoPath(3,9,9)),JSON.stringify(plinkoPath(3,9,9)),'plinko path must be deterministic per winner');
let html=renderToStaticMarkup(React.createElement(PlinkoDisplay,{slots:['10','500','1000'],winner:1,elapsed:100}));
assert(html.includes('Dropping…'));assert(!html.includes('Landed on'));
html=renderToStaticMarkup(React.createElement(PlinkoDisplay,{slots:['10','500','1000'],winner:2,elapsed:3000}));
assert(html.includes('Landed on 1000!'));
html=renderToStaticMarkup(React.createElement(PlinkoDisplay,{slots:['10','500'],winner:0,preview:true}));
assert(html.includes('Ready to drop'));
console.log('PASS: plinko lands in the server-chosen slot, hides the result while dropping, and previews cleanly.');

// ---- Higher or Lower: draw shows the card; reveal shows the verdict ----
html=renderToStaticMarkup(React.createElement(HigherLowerDisplay,{outcome:{phase:'draw',card:{label:'K',value:13}},elapsed:500}));
assert(html.includes('>K</strong>'));assert(html.includes('CURRENT CARD'));
html=renderToStaticMarkup(React.createElement(HigherLowerDisplay,{outcome:{phase:'reveal',prev:{label:'4',value:4},next:{label:'Q',value:12},guess:'higher',correct:true},elapsed:500}));
assert(html.includes('✓ CORRECT!'));assert(html.includes('>HIGHER</strong>'));
html=renderToStaticMarkup(React.createElement(HigherLowerDisplay,{outcome:{phase:'reveal',prev:{label:'9',value:9},next:{label:'2',value:2},guess:'higher',correct:false},elapsed:500}));
assert(html.includes('✗ WRONG'));
console.log('PASS: higher or lower shows the drawn card and the higher/lower verdict.');

// ---- Cliffhanger: climber steps, feedback, and the fall ----
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'item',item:{label:'Coffee maker',price:49},itemIndex:0,position:0,stepsToFall:25},elapsed:1500}));
assert(html.includes('Coffee maker'));
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'guess',item:{label:'Coffee maker',price:49},guess:40,price:49,diff:9,steps:9,position:9,fell:false,stepsToFall:25},elapsed:1500}));
assert(html.includes('climbs 9 steps'));assert(!html.includes('HE FALLS!'));
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'guess',item:{label:'Coffee maker',price:49},guess:10,price:49,diff:39,steps:39,position:39,fell:true,stepsToFall:25},elapsed:1500}));
assert(html.includes('HE FALLS!'));
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'reset',position:0,stepsToFall:25},elapsed:1500}));
assert(html.includes('Climber reset'));
console.log('PASS: cliffhanger shows the item, climbs the guessed steps, and falls at the limit.');

// ---- Prize wheel: spin result, running total, and the bust ----
html=renderToStaticMarkup(React.createElement(PrizeWheelDisplay,{outcome:{winner:0,values:['5¢','10¢','$1.00'],total:5,busted:false},elapsed:4000}));
assert(html.includes('Total: $0.05'));assert(!html.includes('BUSTED'));
html=renderToStaticMarkup(React.createElement(PrizeWheelDisplay,{outcome:{winner:2,values:['5¢','10¢','$1.00'],total:105,busted:true},elapsed:4000}));
assert(html.includes('BUSTED! Over $1.00'));
html=renderToStaticMarkup(React.createElement(PrizeWheelDisplay,{outcome:{phase:'nextplayer',total:0}}));
assert(html.includes('Next player'));
console.log('PASS: the big wheel shows the spin, tracks the running total, and calls the bust.');
