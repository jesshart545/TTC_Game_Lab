const assert = require('node:assert/strict');
const fs = require('node:fs');

// Uploads & library accessibility (audit + owner corrections, 2026-11-12).
// The gaps were VISIBILITY and one filing inconsistency, not routing:
// uploads belong to Imagine and Create — prominently — and Set the
// Stage carries NO upload at all (owner ruling). These guards pin:
//  - the app's ONE file input hoisted to page level, present in every
//    render path (main workspace, Board Designer, City Crime Scene);
//  - plain uploads filed like zip tracks (inProject, never placed);
//  - one shared caption + the "Upload" verb at every upload door;
//  - a PROMINENT "Your library & uploads" door at the top of both
//    light stage-0 frames, calling the existing reveal path;
//  - the Talk Background topic's own upload control;
//  - the Gameshow MediaShelf "See everything" tile;
//  - the assets panel's unified library heading + full-library link,
//    and the Creation tools folder starting open;
//  - NO upload furniture in Set the Stage (StageReview / BuildSpace).

const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
const panel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
const assetsPanel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
const gameshowStage = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
const talkStage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
const gameshowWorkshop = fs.readFileSync('components/GameshowWorkshop.tsx', 'utf8');
const ccsBuilder = fs.readFileSync('components/CityCrimeSceneBuilder.tsx', 'utf8');
const stageReview = fs.readFileSync('components/StageReview.tsx', 'utf8');
const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');
const captionLib = fs.readFileSync('lib/upload-caption.ts', 'utf8');

// --- The shared caption, defined once, word for word -----------------------
assert.match(captionLib, /Images, video, or audio — a \.zip of songs becomes a playlist, and a \.txt of questions becomes a list under your tools\./,
  'the shared upload caption is defined once, exactly as the audit worded it');
for (const [name, source] of [['WorkshopAssetsPanel', assetsPanel], ['TalkshowStage', talkStage], ['GameshowWorkshop', gameshowWorkshop], ['CityCrimeSceneBuilder', ccsBuilder]]) {
  assert.ok(source.includes('{UPLOAD_CAPTION}'), `${name} renders the shared caption under its upload button`);
}
console.log('PASS: one shared upload caption, defined once and reused at every upload door.');

// --- The one file input, at page level, in every render path ---------------
assert.equal((page.match(/type="file"/g) || []).length, 1, 'the page renders exactly one file input');
assert.ok(!panel.includes('type="file"'), 'Jewel’s composer no longer hides the input');
assert.match(page, /<input ref=\{fileInputRef\} type="file" hidden multiple accept=\{UPLOAD_ACCEPT\} onChange=\{handleFiles\}\/>/,
  'the hoisted input keeps the same accept list and the same handleFiles');
assert.ok(page.includes('return <>{fileInputElement}{ccssBuilderView}</>'), 'the City Crime Scene full-screen view carries the input');
assert.ok(page.includes('if(editingBoard)return <main className="workspace-page">{fileInputElement}'), 'the Board Designer full-screen view carries the input');
assert.ok(page.includes('{fileInputElement}\n    <header className="workspace-topbar">'), 'the main workspace carries the input');
console.log('PASS: the single shared file input lives at page level and renders in every project view.');

// --- Full-screen creation editors get an Upload button (not Set the Stage) -
assert.match(page, /if\(editingBoard\)return <main className="workspace-page">\{fileInputElement\}<div className="jewel-access-bar">[\s\S]*?>Upload<\/button>/,
  'the Board Designer bar carries an Upload button beside Ask Jewel');
assert.ok(ccsBuilder.includes('onUpload') && ccsBuilder.includes('>Upload</button>'), 'the City Crime Scene builder bar carries an Upload button beside Ask Jewel');
assert.ok(page.includes('onUpload:()=>{setBackgroundIntent(false);fileInputRef.current?.click();}'), 'the CCS Upload button clicks the shared input');
console.log('PASS: both full-screen creation editors expose Upload beside Ask Jewel.');

// --- Filing consistency: plain uploads are stamped like zip tracks ---------
const handleStart = page.indexOf('async function handleFiles(');
const handle = page.slice(handleStart, page.indexOf('async function queueOrGenerate', handleStart));
assert.match(handle, /storeUploadedAsset\(project\.id, file\)\)\)\)\.map\(asset => \(\{ \.\.\.asset, inProject: true, inOverlayBuild: false \}\)\)/,
  'plain uploads are stamped inProject: true, inOverlayBuild: false when appended');
console.log('PASS: plain uploads are filed in the project (never placed) exactly like zip tracks.');

// --- Prominent library doors on the light stage-0 frames -------------------
for (const [name, stage] of [['GameshowStage', gameshowStage], ['TalkshowStage', talkStage]]) {
  assert.ok(stage.includes('gsw-library-door'), `${name}: the library door is styled as a real, prominent door`);
  assert.ok(stage.includes('Your library & uploads'), `${name}: the door is labelled "Your library & uploads"`);
  assert.ok(stage.includes('doors.showSavedWork'), `${name}: the door calls the existing saved-work reveal path`);
}
assert.ok(gameshowStage.indexOf('gsw-library-door') < gameshowStage.indexOf('<YourShow'), 'GameshowStage: the door stands at the top of the work area, before the show block');
assert.ok(talkStage.indexOf('gsw-library-door') < talkStage.indexOf('{topic === "background"'), 'TalkshowStage: the door stands at the top of the work area, before every topic');
console.log('PASS: both light frames open with a prominent "Your library & uploads" door on the existing reveal path.');

// --- Talk: a backdrop can be uploaded on the Background topic --------------
const backgroundStage = talkStage.slice(talkStage.indexOf('function BackgroundStage'), talkStage.indexOf('/* ---------------- Opening prompt'));
assert.ok(backgroundStage.includes('doors.uploadMedia') && backgroundStage.includes('>Upload</button>'),
  'the Background topic carries its own compact Upload control on the shared upload door');
assert.ok(backgroundStage.includes('{UPLOAD_CAPTION}'), 'the Background upload control carries the shared caption');
console.log('PASS: the Talk Background topic uploads where the backdrop is needed.');

// --- Gameshow MediaShelf: a tile into the whole library --------------------
const shelf = gameshowWorkshop.slice(gameshowWorkshop.indexOf('export function MediaShelf'), gameshowWorkshop.indexOf('function MediaStep'));
assert.ok(shelf.includes('See everything in your library') && shelf.includes('doors.showSavedWork'),
  'the MediaShelf ends its recent-assets tiles with a "See everything in your library" tile on the reveal path');
assert.ok(shelf.includes('>Upload</span>'), 'the MediaShelf upload tile uses the standard "Upload" verb');
console.log('PASS: the MediaShelf reaches the whole library, not just the recent tiles.');

// --- The assets panel: one library, headed, with the full library linked --
assert.ok(assetsPanel.includes('Your library — everything in this project'), 'one heading stands over the media library + pools + tools + scenes block');
assert.ok(assetsPanel.includes('<Link href="/assets" className="assets-library-link">Open the full Asset Library</Link>'),
  'the media library header quietly links to the full Asset Library');
const creationFolder = assetsPanel.slice(assetsPanel.indexOf('title="Creation tools"'), assetsPanel.indexOf('title="Creation tools"') + 260);
assert.ok(creationFolder.includes('defaultOpen'), 'the Creation tools folder starts open');
console.log('PASS: the assets panel reads as one library, headed, linked, with Creation tools open.');

// --- Set the Stage carries NO upload (owner ruling, 2026-11-12) ------------
assert.ok(!stageReview.includes('UPLOAD_CAPTION') && !stageReview.includes('fileInputRef'), 'StageReview has no upload button or caption');
assert.ok(!buildSpace.includes('UPLOAD_CAPTION') && !buildSpace.includes('fileInputRef'), 'BuildSpace has no upload button or caption');
console.log('PASS: Set the Stage stays upload-free — uploads live in Imagine and Create.');

console.log('uploads-library-access: all assertions passed');
