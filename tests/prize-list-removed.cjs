const assert=require('node:assert/strict'),fs=require('fs'),load=require('./load.cjs');
const {infoTypes,toolDefaults}=load('lib/game-tools.ts');
const {TOOL_LIBRARY}=load('lib/workshop-libraries.ts');
const {creatableTools}=load('lib/build-edits.ts');
// The prize-list tool type was removed at Jessica's order (2026-11-14):
// it must not be offered or creatable anywhere, while its shared info-tool
// siblings (scoreboard, game-tool-list) stay fully in place.
assert(!infoTypes.includes('prize-list'),'infoTypes must not include prize-list');
assert(infoTypes.includes('scoreboard')&&infoTypes.includes('game-tool-list'),'scoreboard and game-tool-list stay info types');
assert(!TOOL_LIBRARY.some(item=>item.type==='prize-list'),'the workshop tool library must not offer a Prize List');
assert(TOOL_LIBRARY.some(item=>item.type==='scoreboard')&&TOOL_LIBRARY.some(item=>item.type==='game-tool-list'),'scoreboard and gift guide stay in the workshop library');
assert(!creatableTools.includes('prize-list'),'Jewel/AI build changes must not be able to create prize-list tools');
assert(creatableTools.includes('scoreboard')&&creatableTools.includes('game-tool-list'),'scoreboard and gift guide stay creatable');
assert.equal(JSON.stringify(toolDefaults('prize-list')),'{}','toolDefaults has no defaults for the removed type');
assert.equal(JSON.stringify(toolDefaults('scoreboard')),JSON.stringify({entries:[]}),'scoreboard defaults unchanged');
const demos=fs.readFileSync('components/GameshowToolDemos.tsx','utf8');
assert(!demos.includes('"prize-list"'),'gameshow tool demos (including the demo order) must not reference prize-list');
assert(!fs.readFileSync('lib/project.ts','utf8').includes('"prize-list"'),'the GameToolType union must not include prize-list');
assert(!fs.readFileSync('lib/game-templates.ts','utf8').includes('prize-list'),'no template may include a prize-list tool');
console.log('PASS: prize-list is not offered anywhere — type union, info types, defaults, workshop catalog, creatable tools, gameshow demos and templates are all clean; scoreboard and gift guide untouched.');
