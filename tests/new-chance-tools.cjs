const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ChanceTools.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObject,require:id=>id.endsWith('.css')?{}:require(id),Math});
const {PlinkoDisplay,plinkoPath,HigherLowerDisplay,CliffhangerDisplay}=exportsObject;

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

// ---- Rich faces: marquee cabinet, real cards, mountain scene, glossy wheel ----
const {WheelDisplay,cardSuit}=exportsObject;
// Plinko's face is the approved neon-cabinet artwork with the live
// elements layered over it: the artwork image itself, the configured
// slot values in the slot band, and the glowing puck resting at the
// drop slot; the landed slot flashes, and no dollar sign ever renders.
html=renderToStaticMarkup(React.createElement(PlinkoDisplay,{slots:['10','500','1000'],winner:1,preview:true}));
assert(html.includes('/game-art/plinko-board.webp')&&html.includes('chance-plinko-halo'),'plinko preview is the artwork board with a glowing puck');
assert(html.includes('>10<')&&html.includes('>500<')&&html.includes('>1000<'),'plinko preview layers the configured slot values over the artwork slot band');
assert(!html.includes('$'),'plinko never renders a dollar sign');
html=renderToStaticMarkup(React.createElement(PlinkoDisplay,{slots:['10','500','1000'],winner:2,elapsed:3000}));
assert(html.includes('chance-plinko-slot-win'),'the landed plinko slot carries the win-flash hook');
assert(!html.includes('$'),'landed plinko never renders a dollar sign');
// Higher or Lower deals real card faces: rank + a deterministic suit,
// a face-down next card, and a flip-in on the reveal.
assert.equal(cardSuit('K',13).g,cardSuit('K',13).g,'a card always shows the same suit');
html=renderToStaticMarkup(React.createElement(HigherLowerDisplay,{outcome:{phase:'draw',card:{label:'K',value:13}},elapsed:500}));
assert(html.includes('chance-card-pip')&&['♠','♥','♦','♣'].some(s=>html.includes(s)),'the current card shows a suit pip');
assert(html.includes('chance-card back'),'a face-down next card waits beside the current card');
html=renderToStaticMarkup(React.createElement(HigherLowerDisplay,{outcome:{phase:'reveal',prev:{label:'4',value:4},next:{label:'Q',value:12},guess:'higher',correct:true},elapsed:500}));
assert(html.includes('chance-card-flip'),'the revealed card flips in');
// Cliffhanger is a mountain scene: sky and rock gradients, a stepped
// path with a red danger zone, a summit flag, and a climber figure
// that bobs as it stands and tumbles when it falls.
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'item',item:{label:'Coffee maker',price:49},itemIndex:0,position:0,stepsToFall:25},preview:true}));
assert(html.includes('cliff-sky')&&html.includes('cliff-rock'),'cliffhanger renders a sky-and-rock mountain scene');
assert(html.includes('#ff6b6b')&&html.includes('chance-cliff-bob'),'the danger-zone steps are marked red and the climber figure stands on the path');
html=renderToStaticMarkup(React.createElement(CliffhangerDisplay,{outcome:{phase:'guess',item:{label:'Coffee maker',price:49},guess:10,price:49,diff:39,steps:39,position:39,fell:true,stepsToFall:25},elapsed:1500}));
assert(html.includes('chance-cliff-fall'),'the fallen climber tumbles');
// The wheel stands glossy (gold rim, lit bulbs, flapper) and spins
// with the flapper live; the winning segment flashes once it lands.
html=renderToStaticMarkup(React.createElement(WheelDisplay,{entries:['A','B','C'],result:'C',preview:true}));
assert(html.includes('wheel-rim')&&html.includes('chance-bulb')&&html.includes('chance-wheel-flapper')&&html.includes('is-idle'),'the standing wheel has a gold rim, marquee bulbs and a flapper');
html=renderToStaticMarkup(React.createElement(WheelDisplay,{entries:['A','B','C'],result:'C',elapsed:200}));
assert(html.includes('is-spinning'),'the spinning wheel carries the spin state for the flapper animation');
html=renderToStaticMarkup(React.createElement(WheelDisplay,{entries:['A','B','C'],result:'C',elapsed:4000}));
assert(html.includes('chance-wheel-win'),'the winning wheel segment carries the flash hook');
console.log('PASS: the four chance games wear rich faces — artwork plinko cabinet, real suited cards, a mountain scene with a climber, and a glossy bulbed wheel.');
