const fs=require('fs'),assert=require('node:assert/strict');
const load=require('./load.cjs');
const {parseTriviaText,isTriviaTextFileName,triviaListBaseName,TRIVIA_UPLOAD_MAX_QUESTIONS}=load('lib/trivia-upload.ts');
const {cleanTriviaQuestions}=load('lib/quiz.ts');
const {questionPool}=load('lib/question-cards.ts');
// Objects built inside the loader's VM realm fail deepStrictEqual on
// prototypes alone; compare their plain JSON shape instead.
const plain=value=>JSON.parse(JSON.stringify(value));

// Labeled blocks (primary layout): Q:/A: labels, long forms, and
// case-insensitive prefixes all parse; the id is the questionPool key.
{
  const result=parseTriviaText('Q: What is 2+2?\nA: 4\n\nquestion: What is the capital of France?\nANSWER: Paris\n\nQuEsTiOn: Best color?\na: Blue');
  assert.equal(result.questions.length,3);
  assert.deepEqual(plain(result.questions[0]),{id:'what is 2+2?',question:'What is 2+2?',answer:'4'});
  assert.deepEqual(plain(result.questions[1]),{id:'what is the capital of france?',question:'What is the capital of France?',answer:'Paris'});
  assert.equal(result.questions[2].answer,'Blue');
  assert.deepEqual([result.skipped,result.duplicates,result.cappedCount],[0,0,0]);
  console.log('PASS: labeled trivia blocks parse with Q:/A: and Question:/Answer: labels, case-insensitively.');
}

// Multi-line question and answer text joins with spaces.
{
  const result=parseTriviaText('Q: What is\nthe largest planet\nin our solar system?\nA: Jupiter,\nthe gas giant');
  assert.equal(result.questions.length,1);
  assert.equal(result.questions[0].question,'What is the largest planet in our solar system?');
  assert.equal(result.questions[0].answer,'Jupiter, the gas giant');
  console.log('PASS: wrapped question and answer lines join with spaces.');
}

// The optional Category: line lands on the entry; absent means no key.
{
  const result=parseTriviaText('Q: What is H2O?\nA: Water\nCategory: Science\n\nQ: What is 2+2?\nA: 4');
  assert.equal(result.questions[0].category,'Science');
  assert.equal('category' in result.questions[1],false);
  console.log('PASS: a Category: line sets the category and entries without one carry no category.');
}

// Unlabeled blocks (fallback): first line is the question, the second
// line is the answer, further lines append to the answer.
{
  const result=parseTriviaText('What is the capital of France?\nParis\n\nHow many days are in a leap year?\n366\n(366 days)');
  assert.equal(result.questions.length,2);
  assert.deepEqual(plain(result.questions[0]),{id:'what is the capital of france?',question:'What is the capital of France?',answer:'Paris'});
  assert.equal(result.questions[1].answer,'366 (366 days)');
  console.log('PASS: unlabeled blocks take line one as the question, line two as the answer, and later lines append to the answer.');
}

// Multiple choice: the answer as the full text of the correct option
// (paren and dot option styles), with answer forced to the option text.
{
  const result=parseTriviaText('Q: Pick a color\nA) Red\nB) Blue\nC) Green\nA: Blue\n\nQ: Pick a pet\nA. Cat\nB. Dog\nAnswer: Cat');
  assert.equal(result.questions.length,2);
  assert.deepEqual(plain(result.questions[0].options),['Red','Blue','Green']);
  assert.equal(result.questions[0].correctIndex,1);
  assert.equal(result.questions[0].answer,'Blue');
  assert.deepEqual(plain(result.questions[1].options),['Cat','Dog']);
  assert.equal(result.questions[1].correctIndex,0);
  assert.equal(result.questions[1].answer,'Cat');
  console.log('PASS: multiple-choice blocks store options and correctIndex, with the answer as the correct option text.');
}

// Multiple choice: the answer as a bare letter.
{
  const result=parseTriviaText('Question: Which planet is closest to the sun?\nA) Venus\nB) Mercury\nC) Mars\nAnswer: B');
  assert.equal(result.questions.length,1);
  assert.equal(result.questions[0].correctIndex,1);
  assert.equal(result.questions[0].answer,'Mercury');
  console.log('PASS: a bare-letter answer ("Answer: B") resolves to that option.');
}

// "A:" with a colon is the answer label, never an option; and an
// answer written with its option prefix ("B) Blue") still matches.
{
  const result=parseTriviaText('Q: What is 2+2?\nA: 4\n\nQ: Pick a color\nA) Red\nB) Blue\nA: B) Blue');
  assert.equal(result.questions.length,2);
  assert.equal(result.questions[0].answer,'4');
  assert.equal('options' in result.questions[0],false,'the A: label did not become an option');
  assert.equal(result.questions[1].options.length,2);
  assert.equal(result.questions[1].correctIndex,1);
  console.log('PASS: "A:" stays the answer label (not an option) and a letter-prefixed answer text still matches its option.');
}

// Unresolvable multiple choice: an answer matching no option, and a
// bare letter past the end of the options, leave the block skipped.
{
  const result=parseTriviaText('Q: Pick a color\nA) Red\nB) Blue\nA: Purple\n\nQ: Pick a pet\nA) Cat\nB) Dog\nAnswer: D');
  assert.equal(result.questions.length,0);
  assert.equal(result.skipped,2);
  console.log('PASS: multiple-choice blocks whose answer names no option (by text or by letter) are skipped and counted.');
}

// Blocks with no usable question or no usable answer are skipped and
// counted; blank space between blocks is not an entry at all.
{
  const result=parseTriviaText('\n\nQ: A question with no answer\n\nA: An answer with no question\n\nCategory: Science\n\nQ: Good?\nA: Yes\n\n');
  assert.equal(result.questions.length,1);
  assert.equal(result.skipped,3);
  const empty=parseTriviaText('');
  assert.deepEqual([empty.questions.length,empty.skipped,empty.duplicates,empty.cappedCount],[0,0,0,0]);
  const oneLine=parseTriviaText('a single line with nothing after it');
  assert.deepEqual([oneLine.questions.length,oneLine.skipped],[0,1]);
  console.log('PASS: blocks missing a question or an answer are skipped and counted, and empty input parses to nothing.');
}

// Duplicates inside the file (normalized question text) are counted
// separately and never added twice.
{
  const result=parseTriviaText('Q: What is 2+2?\nA: 4\n\nQ: WHAT IS 2+2?\nA: Four\n\nwhat  is   2+2?\n4');
  assert.equal(result.questions.length,1);
  assert.equal(result.questions[0].answer,'4','the first copy wins');
  assert.equal(result.duplicates,2);
  assert.equal(result.skipped,0);
  console.log('PASS: duplicate questions in one file are counted as duplicates and added only once.');
}

// The 500-question cap: usable questions past it count as capped.
{
  const blocks=[];
  for(let i=1;i<=505;i++)blocks.push(`Q: Question number ${i}?\nA: Answer ${i}`);
  const result=parseTriviaText(blocks.join('\n\n'));
  assert.equal(TRIVIA_UPLOAD_MAX_QUESTIONS,500);
  assert.equal(result.questions.length,500);
  assert.equal(result.cappedCount,5);
  assert.equal(result.skipped,0);
  console.log('PASS: a file with more than 500 usable questions keeps the first 500 and counts the rest as capped.');
}

// CRLF files and a BOM parse the same as plain LF files.
{
  const result=parseTriviaText('\uFEFFQ: First?\r\nA: One\r\n\r\nQ: Second?\r\nA: Two');
  assert.equal(result.questions.length,2);
  assert.equal(result.questions[1].answer,'Two');
  console.log('PASS: CRLF line endings and a leading BOM are handled.');
}

// File-name helpers: .txt detection and the list base name.
{
  assert.equal(isTriviaTextFileName('my-questions.txt'),true);
  assert.equal(isTriviaTextFileName('My Quiz.TXT'),true);
  assert.equal(isTriviaTextFileName('notes.md'),false);
  assert.equal(isTriviaTextFileName('songs.txt.zip'),false);
  assert.equal(triviaListBaseName('my-questions.txt'),'my-questions');
  assert.equal(triviaListBaseName('My Quiz.TXT'),'My Quiz');
  assert.equal(triviaListBaseName('folder/list.txt'),'list');
  assert.equal(triviaListBaseName('.txt'),'Trivia Questions');
  console.log('PASS: text files are detected by extension and list names come from the file name without the .txt.');
}

// The stored shape round-trips: parsed questions mapped the way the
// upload path stores them (no id — the pool derives it) pass the same
// cleaner every trivia-list write uses, and questionPool reads back
// the same questions, ids, options and correctIndex.
{
  const parsed=parseTriviaText('Q: What is 2+2?\nA: 4\nCategory: Math\n\nQ: Pick a color\nA) Red\nB) Blue\nAnswer: A');
  const stored=cleanTriviaQuestions(parsed.questions.map(q=>({question:q.question,answer:q.answer,...(q.category?{category:q.category}:{}),...(q.options?{options:q.options,correctIndex:q.correctIndex}:{})})));
  assert.equal(stored.length,2);
  assert.equal('id' in stored[0],false,'stored entries carry no id — questionPool derives it');
  const project={gameTools:[
    {id:'list-upload',type:'trivia-list',name:'my-questions',enabled:true,inToolbox:true,config:{title:'my-questions',questions:stored}},
    {id:'card-1',type:'question-card',name:'Question Cards',enabled:true,config:{poolId:'list-upload'}},
  ]};
  const pool=questionPool(project,project.gameTools[1]);
  assert.equal(pool.length,2);
  assert.equal(pool[0].id,parsed.questions[0].id);
  assert.equal(pool[0].category,'Math');
  assert.deepEqual(plain(pool[1].options),['Red','Blue']);
  assert.equal(pool[1].correctIndex,0);
  assert.equal(pool[1].answer,'Red');
  console.log('PASS: uploaded questions store as a trivia-list config.questions and read back through questionPool unchanged.');
}

// --- Source assertions: routing, accept, status copy, wording. ---
const page=fs.readFileSync('app/project/[id]/page.tsx','utf8');
const handleStart=page.indexOf('async function handleFiles');
const handleEnd=page.indexOf('async function queueOrGenerate',handleStart);
assert.ok(handleStart>=0&&handleEnd>handleStart,'handleFiles found');
const handle=page.slice(handleStart,handleEnd);
assert.match(handle,/files\.filter\(file => isTriviaTextFileName\(file\.name\)\)/,'handleFiles separates .txt files from media uploads');
assert.match(handle,/!isZipFileName\(file\.name\) && !isTriviaTextFileName\(file\.name\)/,'plain media uploads exclude both zips and text files');
assert.match(handle,/parseTriviaText\(await triviaFile\.text\(\)\)/,'each text file is read as text and parsed');
assert.match(handle,/type: "trivia-list", name: listName/,'a parsed file becomes a trivia-list tool named for the file');
assert.match(handle,/uniqueTriviaListName\(nextTools\.filter\(t => t\.type === "trivia-list"\)\.map\(t => t\.name\), triviaListBaseName\(upload\.fileName\)\)/,'the list name is the file name, de-duplicated against existing trivia lists');
assert.match(handle,/cleanTriviaQuestions\(result\.questions\.map/,'stored questions pass the shared trivia cleaner');
assert.match(handle,/\.\.\.\(toolsChanged \? \{ gameTools: nextTools \} : \{\}\)/,'the new list rides the same save as the other upload outcomes');
assert.match(handle,/No trivia questions could be read from \$\{upload\.fileName\}/,'a zero-question file reports that nothing was added');
assert.match(handle,/Q: Your question\?/,'the zero-question message shows the expected layout example');
assert.match(handle,/entries were"\} skipped in \$\{upload\.fileName\} — each question needs a question and an answer\./,'skips are reported with their reason');
console.log('PASS: the upload flow routes .txt files to a new trivia list in the same save, with truthful status copy.');

const panel=fs.readFileSync('components/WorkshopAiPanel.tsx','utf8');
assert.match(panel,/accept="image\/\*,video\/\*,audio\/\*,\.zip,application\/zip,\.txt,text\/plain"/,'the shared upload input accepts .txt files');
console.log('PASS: the shared upload input accepts .txt alongside media and zips.');

for(const file of ['components/TalkshowStage.tsx','components/TalkshowSteps.tsx']){
  const source=fs.readFileSync(file,'utf8');
  const card=source.indexOf('Upload your media');
  assert.ok(card>=0,`${file} still has its Upload your media box`);
  assert.match(source.slice(card,card+600),/A \.txt file of your own trivia questions becomes a question list\./,`${file} mentions the trivia text upload on its upload box`);
}
const assetsPanel=fs.readFileSync('components/WorkshopAssetsPanel.tsx','utf8');
assert.match(assetsPanel,/A \.txt file of your own trivia questions becomes a question list\./,'the Workshop upload box mentions the trivia text upload');
console.log('PASS: every upload invitation updated for zip playlists now also mentions the .txt trivia upload.');

const jewel=fs.readFileSync('app/api/jewel/route.ts','utf8');
const addendumStart=jewel.indexOf('const JEWEL_ADDENDUM = `');
const addendum=jewel.slice(addendumStart,jewel.indexOf('`;',addendumStart));
assert.match(addendum,/upload a \.txt file of their own trivia questions/,'Jewel knows creators can upload their own trivia questions as a .txt');
assert.match(addendum,/becomes a question list in this project, named after the file/,'Jewel knows the upload becomes a question list named after the file');
assert.match(addendum,/have a playlist player: it shows at the upload spot right after the playlist is added, and inline in the project's Asset pools area/,'Jewel knows audio pools have a playlist player and where it shows');
assert.match(addendum,/never say there is no playlist player/,'Jewel will not deny the playlist player exists');
console.log('PASS: Jewel\u2019s guidance covers the .txt trivia upload and the playlist player\u2019s real locations.');
