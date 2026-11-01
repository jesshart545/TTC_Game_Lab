const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),load=require('./load.cjs');
function harness(){const slots=[],effects=[];let cursor=0;const react={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef:initial=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((d,n)=>d!==slots[i][n])){slots[i]=deps;effects.push(fn);}}};
 function module(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?require(id):deps[id]||{},Math,Number,Date,setInterval:()=>0,clearInterval(){}});return exports;}
 return {module,render:fn=>{cursor=0;const result=fn();effects.splice(0).forEach(fn=>fn());return result;}};
}
function nodes(n){if(Array.isArray(n))return n.flatMap(nodes);return n&&typeof n==='object'?[n,...[].concat(n.props?.children||[]).flatMap(nodes)]:[];}
const content=n=>Array.isArray(n)?n.map(content).join(''):typeof n==='string'||typeof n==='number'?String(n):[].concat(n?.props?.children||[]).map(content).join('');
function PlacementEditor(){} function FontPicker(){} function FittedCard(){} function StyledTimer(){}
function editor(h){const hook=h.module('components/useEditableTool.ts');return h.module('components/QuestionCardEditor.tsx',{'./useEditableTool':hook,'../lib/overlay-placement':load('lib/overlay-placement.ts'),'../lib/fonts':load('lib/fonts.ts'),'../lib/question-cards':load('lib/question-cards.ts'),'./FontPicker':{default:FontPicker},'./YouTubePlacementEditor':{default:PlacementEditor},'./QuestionCards':{FittedCard,StyledTimer}}).default;}
const stepButtons=tree=>nodes(tree).filter(n=>n.type==='button'&&/^\d[A-Z]/.test(content(n))&&['Look','Size & position','Content','Review'].some(name=>content(n).endsWith(name))).map(content);
const clickStep=(treeRef,render,label)=>{nodes(treeRef()).find(n=>n.type==='button'&&content(n)===label).props.onClick();return render();};

// --- Creation flow (deferSave): a NEW question-and-answer card system designs its look first. ---
{
 const h=harness(),CardEditor=editor(h);
 const pool={id:'pool1',type:'trivia-list',name:'Science questions',enabled:true,config:{questions:[{question:'What is H2O?',answer:'Water'}]}};
 const tool={id:'newq',type:'question-card',name:'My cards',enabled:true,config:{}};
 const saves=[];const onSave=next=>saves.push(JSON.parse(JSON.stringify(next)));
 const render=()=>h.render(()=>CardEditor({project:{assets:[],gameTools:[pool]},tool,onSave,deferSave:true}));
 let tree=render();
 assert.deepEqual(stepButtons(tree),['1Look','2Size & position','3Content','4Review'],'creation flow numbers the steps Look, Size & position, Content, Review');
 assert.ok(content(tree).includes('Make it yours, choose the content, then check how it looks.'),'creation intro describes look first, then content');
 assert.ok(!content(tree).includes('Choose the content, make it yours'),'creation intro no longer puts content first');
 assert.equal(content(nodes(tree).find(n=>n.type==='h4')),'1. Look','the designer opens on the Look step');
 // Every Look control is present on the first screen.
 assert.ok(content(tree).includes('Start with a style, or adjust the colors and lettering yourself.'));
 assert.ok(content(tree).includes('Card shape'));
 assert.equal(nodes(tree).filter(n=>n.type==='input'&&n.props.type==='color').length,3,'card, text and border color pickers render');
 assert.ok(['Neon','Light','Classic'].every(name=>nodes(tree).some(n=>n.type==='button'&&content(n).includes(name))),'style presets render');
 assert.ok(nodes(tree).some(n=>n.type===FontPicker&&n.props.label==='Lettering style'),'lettering picker renders');
 assert.ok(nodes(tree).some(n=>n.type==='input'&&n.props.type==='range'),'text size slider renders');
 assert.ok(content(tree).includes('Use a picture on the card'));
 assert.ok(nodes(tree).some(n=>n.type==='button'&&content(n)==='Use this look for the answer card too'),'answer-card look copy button renders');
 assert.ok(!nodes(tree).some(n=>n.type===PlacementEditor),'no drag placement editor before the Size & position step');
 assert.ok(nodes(tree).some(n=>n.type==='button'&&content(n)==='Next: Size & position'),'Next points at Size & position');
 // Design changes stay a draft until Save (PR #109/#112 invariant), then save exactly once with the look.
 nodes(tree).filter(n=>n.type==='input'&&n.props.type==='color')[0].props.onChange({target:{value:'#123456'}});
 assert.equal(saves.length,0,'editing the look of a new card saves nothing yet');
 tree=render();
 tree=clickStep(()=>tree,render,'4Review');
 assert.equal(content(nodes(tree).find(n=>n.type==='h4')),'4. Review');
 nodes(tree).find(n=>n.type==='button'&&content(n)==='Save cards').props.onClick();
 assert.equal(saves.length,1,'Save commits the new cards exactly once');
 assert.equal(saves[0].config.questionCard.backgroundColor,'#123456','the saved cards carry the look chosen first');
 tree=render();
 assert.ok(content(tree).includes('Saved. Your card design is ready for Build Space.'),'the saved confirmation follows the save');
 // Size & position is step 2 in the creation flow, with all of its controls.
 tree=clickStep(()=>tree,render,'2Size & position');
 assert.equal(content(nodes(tree).find(n=>n.type==='h4')),'2. Size & position');
 assert.ok(nodes(tree).some(n=>n.type===PlacementEditor),'the drag placement editor shows on the Size & position step');
 assert.ok(['Small','Medium','Large'].every(name=>nodes(tree).some(n=>n.type==='button'&&content(n)===name)),'size choices render');
 assert.equal(nodes(tree).filter(n=>n.type==='button'&&/^(Top|Middle|Bottom) (left|center|right)$/.test(content(n))).length,9,'all nine position choices render');
 assert.ok(content(tree).includes('How should the card appear?'),'entrance choice renders');
 assert.ok(content(tree).includes('Fine-tune details (optional)'),'fine-tune details render');
 assert.ok(nodes(tree).filter(n=>n.type==='input'&&n.props.type==='number').length>=16,'all fine-tune number fields render');
 nodes(tree).find(n=>n.type==='button'&&content(n)==='Medium').props.onClick();
 assert.equal(saves.length,1,'later design edits do not create a duplicate card');
 // Content is step 3 in the creation flow, with all of its controls.
 tree=render();
 tree=clickStep(()=>tree,render,'3Content');
 assert.equal(content(nodes(tree).find(n=>n.type==='h4')),'3. Content');
 assert.ok(!nodes(tree).some(n=>n.type===PlacementEditor),'the drag placement editor leaves with the Size & position step');
 assert.ok(content(tree).includes('Name your cards'),'name field renders on the content step');
 assert.ok(content(tree).includes('Where should the questions come from?'),'question pool choice renders on the content step');
 assert.ok(content(tree).includes('Science questions · 1 questions'),'saved pools are offered on the content step');
 // Review is step 4, unchanged.
 tree=clickStep(()=>tree,render,'4Review');
 assert.ok(content(tree).includes('Can you read the text easily?')&&content(tree).includes('Is the card in the right place?')&&content(tree).includes('Does the entrance look right?'),'review checklist renders');
 assert.ok(content(tree).includes('Try different text in the preview'),'preview text trial renders');
 console.log('PASS: new question-and-answer cards are designed look first (Look, Size & position, Content, Review), every control still renders, and the draft-until-save flow is unchanged.');
}

// --- Creation flow (deferSave): a NEW blank card also designs its look first. ---
{
 const h=harness(),CardEditor=editor(h);
 const tool={id:'newb',type:'blank-card',name:'Blank card',enabled:true,config:{}};
 const render=()=>h.render(()=>CardEditor({project:{assets:[],gameTools:[]},tool,onSave:()=>{},deferSave:true}));
 let tree=render();
 assert.deepEqual(stepButtons(tree),['1Look','2Size & position','3Content','4Review'],'blank card creation uses the same look-first order');
 tree=clickStep(()=>tree,render,'3Content');
 assert.ok(content(tree).includes('What should this card say?'),'the card text field waits on the content step');
 assert.ok(nodes(tree).some(n=>n.type==='button'&&content(n)==='Save card'),'the single-card save button renders');
 console.log('PASS: new blank cards also design their look before their text.');
}

// --- Existing-card editing keeps the order it has today (Content first), untouched by the reorder. ---
{
 const h=harness(),CardEditor=editor(h);
 let card={id:'card',type:'blank-card',name:'Card',enabled:true,config:{text:'Hello'}};
 const render=()=>h.render(()=>CardEditor({project:{assets:[],gameTools:[card]},tool:card,onSave:next=>card=JSON.parse(JSON.stringify(next))}));
 let tree=render();
 assert.deepEqual(stepButtons(tree),['1Content','2Look','3Size & position','4Review'],'existing cards keep the Content, Look, Size & position, Review order');
 assert.ok(content(tree).includes('Choose the content, make it yours, then check how it looks.'),'existing-card intro is unchanged');
 assert.ok(content(tree).includes('What should this card say?'),'existing cards still open on their content');
 tree=clickStep(()=>tree,render,'2Look');
 nodes(tree).filter(n=>n.type==='input'&&n.props.type==='color')[0].props.onChange({target:{value:'#654321'}});
 assert.equal(card.config.questionCard.backgroundColor,'#654321','existing cards still save as they are edited');
 tree=render();
 tree=clickStep(()=>tree,render,'3Size & position');
 assert.ok(nodes(tree).some(n=>n.type===PlacementEditor),'existing cards keep the drag placement editor on step 3');
 console.log('PASS: editing an existing card keeps today\u2019s step order and save-as-you-edit behavior.');
}

// --- Source: the reorder is keyed to the creation (deferred-save) flow only. ---
{
 const src=fs.readFileSync('components/QuestionCardEditor.tsx','utf8');
 assert.ok(src.includes("const createSteps=['Look','Size & position','Content','Review'];"),'the creation step order is declared');
 assert.ok(src.includes('step===sizeStep&&<YouTubePlacementEditor'),'the preview drag editor follows the Size & position step in both orders');
 assert.ok(src.includes('Changes save automatically as you edit.'),'the save-as-you-edit footer wording is untouched');
 console.log('PASS: source keeps the creation order, the placement-step link, and the footer wording.');
}
