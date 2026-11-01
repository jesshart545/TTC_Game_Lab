const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load.cjs');

// Trivia questions belong IN the saved item (Jessica, 2026-11-01): expanding a
// "Trivia Question List" tool in the Workshop's Game tools & cards must show
// its questions right there — not only in the Generate Trivia panel across
// the screen. Plus: generated lists all share the name "Trivia Question
// List (N)", so a repeat generation gets a " (2)" / " (3)" suffix instead of
// an indistinguishable duplicate name.

function nodes(n){if(Array.isArray(n))return n.flatMap(nodes);return n&&typeof n==='object'?[n,...[].concat(n.props?.children||[]).flatMap(nodes)]:[];}
const content=n=>Array.isArray(n)?n.map(content).join(''):typeof n==='string'||typeof n==='number'?String(n):[].concat(n?.props?.children||[]).map(content).join('');

// ---------- (a) + (b): behavioral render of SavedTriviaQuestions ----------
const panel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
const compStart = panel.indexOf('export function SavedTriviaQuestions');
const compEnd = panel.indexOf('export type WorkshopAssetsPanelProps', compStart);
assert(compStart >= 0 && compEnd > compStart, 'SavedTriviaQuestions component found in WorkshopAssetsPanel');
const compExports = {};
vm.runInNewContext(
  ts.transpileModule(panel.slice(compStart, compEnd), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { exports: compExports, require: id => require(id) }
);
const { SavedTriviaQuestions } = compExports;
assert.equal(typeof SavedTriviaQuestions, 'function', 'SavedTriviaQuestions is exported from WorkshopAssetsPanel');

const questions = [
  { question: 'Which band released the album Abbey Road?', answer: 'The Beatles', verificationStatus: 'verified', category: 'Music', source: 'Example Music Source', sourceUrl: 'https://example.com/abbey-road' },
  { question: 'How many strings does a standard guitar have?', answer: 'Six', verificationStatus: 'needs-review', category: 'Music' },
];
const tree = SavedTriviaQuestions({ questions });
assert.equal(tree.props.style.maxHeight, 320, 'The in-item questions block is height-capped like the panel list');
assert.equal(tree.props.style.overflow, 'auto', 'The in-item questions block scrolls');
const text = content(tree);
assert(text.includes('1. Which band released the album Abbey Road?'), 'First question renders numbered, from config');
assert(text.includes('✓ Verified'), 'Verified vocabulary matches the Generate Trivia panel');
assert(text.includes('Answer: The Beatles'), 'First answer renders');
assert(text.includes('2. How many strings does a standard guitar have?'), 'Second question renders numbered, from config');
assert(text.includes('* Needs verification'), 'Needs-verification vocabulary matches the Generate Trivia panel');
assert(text.includes('Answer: Six'), 'Second answer renders');
assert(text.includes('Music'), 'Category renders');
const links = nodes(tree).filter(n => n.type === 'a');
assert.equal(links.length, 1, 'Only the question with a source URL gets a source link');
assert.equal(links[0].props.href, 'https://example.com/abbey-road', 'Source link points at the saved source URL');
assert.equal(content(links[0]), 'Example Music Source', 'Source link carries the saved source name');

const emptyTree = SavedTriviaQuestions({ questions: [] });
assert.equal(content(emptyTree), 'No questions saved in this list yet.', 'An empty list shows the plain no-questions line');

// ---------- Wiring: the block lives inside the saved item, Review stays ----------
const reviewAt = panel.indexOf('Review saved questions');
const blockAt = panel.indexOf('<SavedTriviaQuestions');
const editorTernaryAt = panel.indexOf('tool.type==="card-list"?', blockAt);
assert(reviewAt >= 0 && blockAt > reviewAt, 'The questions block renders inside the item, right after the Review button');
assert(editorTernaryAt > blockAt, 'The questions block renders before the tool editor, so it is seen first on open');
assert(panel.includes('<SavedTriviaQuestions questions={Array.isArray(tool.config.questions)?tool.config.questions:[]}/>'), 'The block reads the questions saved in the tool config');
assert(panel.includes('Review saved questions</button>'), 'The Review saved questions button stays (it restores generator state)');

// ---------- (c): generated list names stay unique ----------
const { uniqueTriviaListName } = load('lib/trivia-list-name.ts');
assert.equal(uniqueTriviaListName([], 'Trivia Question List (5)'), 'Trivia Question List (5)', 'No collision keeps the generated name');
assert.equal(uniqueTriviaListName(['Trivia Question List (5)'], 'Trivia Question List (5)'), 'Trivia Question List (5) (2)', 'First collision appends (2)');
assert.equal(uniqueTriviaListName(['Trivia Question List (5)', 'Trivia Question List (5) (2)'], 'Trivia Question List (5)'), 'Trivia Question List (5) (3)', 'Second collision appends (3)');
assert.equal(uniqueTriviaListName(['Trivia Question List (7)'], 'Trivia Question List (5)'), 'Trivia Question List (5)', 'A different question count is not a collision');
assert.equal(uniqueTriviaListName(['Trivia Question List (5) (2)'], 'Trivia Question List (5)'), 'Trivia Question List (5)', 'A suffixed name alone does not force a suffix');

const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
assert(page.includes('from "../../../lib/trivia-list-name"'), 'page.tsx imports the name helper');
const genStart = page.indexOf('async function generateTriviaList');
const genEnd = page.indexOf('async function downloadTriviaPdf', genStart);
assert(genStart >= 0 && genEnd > genStart, 'generateTriviaList found');
const genSpan = page.slice(genStart, genEnd);
assert(genSpan.includes('name:uniqueTriviaListName((base.gameTools||[]).filter(t=>t.type==="trivia-list").map(t=>t.name),`Trivia Question List (${questions.length})`)'), 'The save step uniquifies the generated name against existing trivia-list tools');
assert(genSpan.includes('exclude:[...previousQuestions,...all,...pending.values()]'), 'The generation dedup/exclusion behavior is unchanged');

console.log('trivia-list-saved-questions: all assertions passed');
