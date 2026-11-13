const assert = require('node:assert/strict');
const fs = require('node:fs');

// Jewel Piece 2, Half B — the generation doors disappear (Jessica, 2026-11-03).
// She rejected "buttons stay and open Jewel": the overhaul's point is that
// Jewel IS the interaction, so the user-operated generation forms/buttons are
// REMOVED, not rerouted. Generation happens by asking Jewel. These guards pin
// both halves of the ruling: every removed door stays gone, and every
// non-generation surface (uploads, manual editing, selection, Jewel herself)
// stays present.

const aiPanel = fs.readFileSync('components/WorkshopAiPanel.tsx', 'utf8');
const assetsPanel = fs.readFileSync('components/WorkshopAssetsPanel.tsx', 'utf8');
const mediaEditor = fs.readFileSync('components/MediaEditor.tsx', 'utf8');
const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');

// ---------- Door 1+2: the GENERATE ASSET and GENERATE TRIVIA panels ----------
for (const gone of ['GENERATE ASSET', 'CREATE OVERLAY BACKGROUND', 'GENERATE TRIVIA', 'generator-panel',
  'id="generator-prompt"', 'id="trivia-list-count"', 'showGenerator', 'showTriviaListGenerator',
  'Generate ${', 'switchGeneratorType', 'GENERATOR_VOICES', 'generator-voices']) {
  assert.ok(!aiPanel.includes(gone), `WorkshopAiPanel: ${gone} is removed`);
  assert.ok(!page.includes(gone), `page: ${gone} is removed`);
}
// Jewel herself remains the panel's whole point: chat, progress strip, picks.
for (const kept of ['jewel-progress', 'Next: {nextTask.label}', 'Apply my request', 'id="board-templates"',
  'id="tool-templates"', 'assetStatus']) {
  assert.ok(aiPanel.includes(kept), `WorkshopAiPanel keeps ${kept}`);
}
// The app's one shared file input moved OUT of Jewel's composer to page
// level (uploads/library accessibility audit, 2026-11-12): the composer
// keeps no input of its own, and the page renders the input once so it
// exists on every surface — including the full-screen creation editors
// (Board Designer, City Crime Scene builder) that render no panel.
assert.ok(page.includes('type="file"'), 'page keeps the hoisted shared upload input');
assert.ok(!aiPanel.includes('type="file"'), 'WorkshopAiPanel no longer hides the upload input in the composer');
// The page no longer carries the panel-only generator state.
for (const gone of ['setGeneratorType(', 'setGeneratorPrompt(', 'setImageShape(', 'setVideoLength(',
  'setImageReferenceKey(', 'setGeneratorVoice(', 'setGeneratorStability(', 'setSfxSeconds(',
  'setMusicLengthMode(', 'setTriviaListCount(', 'setTriviaListCategories(', 'setTriviaListQuestions(']) {
  assert.ok(!page.includes(gone), `page: ${gone} is removed`);
}

// ---------- Door 3: the CREATE-group generation buttons ----------
for (const gone of ['Generate media', 'Create background artwork', 'Generate trivia', 'Generate board artwork',
  'openWorkshopTool("media")', 'openWorkshopTool("trivia")', 'Review saved questions']) {
  assert.ok(!assetsPanel.includes(gone), `WorkshopAssetsPanel: ${gone} is removed`);
  assert.ok(!page.includes(gone), `page: ${gone} is removed`);
}
// Non-generation creation/selection in the same folder survives untouched.
for (const kept of ['Upload assets', 'Upload from your device', 'Create an interactive game board',
  'openWorkshopTool("tools")', 'openWorkshopTool("boards")', 'Create list and cards', 'Asset Composer',
  'Game Templates', '<TemplateBrowser', 'Make a variation']) {
  assert.ok(assetsPanel.includes(kept), `WorkshopAssetsPanel keeps ${kept}`);
}

// ---------- Door 4: the trivia board regenerate buttons ----------
for (const gone of ['Regenerate sourced board', 'Refresh sources', 'regenerateTrivia(']) {
  assert.ok(!assetsPanel.includes(gone), `WorkshopAssetsPanel: ${gone} is removed`);
}
// ...while the board itself stays fully usable by hand: topics are typed,
// clues are triggered and revealed, the current clue closes.
for (const kept of ['trivia-topic-editor', 'triggerTriviaQuestion', 'revealTriviaAnswer', 'Close current clue', 'SavedTriviaQuestions']) {
  assert.ok(assetsPanel.includes(kept), `WorkshopAssetsPanel keeps ${kept}`);
}
// The exported questions survived the panel: the PDF download moved onto the
// saved trivia-list item itself, fed by that item's own saved questions.
assert.ok(assetsPanel.includes('onDownloadTriviaPdf(Array.isArray(tool.config.questions)?tool.config.questions:[])'),
  'the trivia PDF export lives on the saved list item');
assert.ok(page.includes('async function downloadTriviaPdf(questions'), 'page downloadTriviaPdf takes the list questions');

// ---------- Door 5: the Media Editor AI edit — reopened by request ----------
// Half B removed the editor's own AI-edit request with the other doors.
// Jessica reversed that for this one surface on 2026-11-04: "I would
// rather it offer the AI edit in there also, since the AI is the main
// editing tool." The dialog's AI Edit section is back — wired to the
// SAME pipeline Jewel's media edits run through (lib/ai-edit), saving
// through the dialog's save-as-new path. Doors 1–4 above stay closed.
for (const kept of ['AI EDIT', 'Describe the AI edit', 'Apply AI edit',
  'aiEditImage', 'aiEditVideo', 'onSaveAsNew']) {
  assert.ok(mediaEditor.includes(kept), `MediaEditor AI edit keeps ${kept}`);
}
const aiEditLib = fs.readFileSync('lib/ai-edit.ts', 'utf8');
for (const kept of ['/api/generate-asset', 'promptImage', 'pollImageGeneration',
  '/api/edit-video', 'pollForEditedVideoUrl']) {
  assert.ok(aiEditLib.includes(kept), `lib/ai-edit uses the shared pipeline: ${kept}`);
}
// Manual editing is not generation and stays: trim, crop/resize, adjustments,
// and saving the edited copy.
for (const kept of ['Trim start (seconds)', 'Trim end (seconds)', 'Output shape', 'Save edited copy',
  'Direct edits · save as a new copy', 'media-editor-actions']) {
  assert.ok(mediaEditor.includes(kept), `MediaEditor keeps ${kept}`);
}

// ---------- Jewel keeps every capability the doors used to reach ----------
// Her executor still runs the same page-level functions the buttons called.
for (const kept of ['function queueOrGenerate', 'async function generateAsset', 'async function regenerateTrivia',
  'async function generateTriviaList', 'regenerateTrivia(action.mode === "source" ? "source" : "generate", action.category || undefined)',
  'generateTriviaList({count:action.count,categories:action.categories,baseProject:result.project}',
  'Check video result', 'generateAsset("video", job.prompt, { pendingVideo: job })']) {
  assert.ok(page.includes(kept), `page keeps Jewel capability: ${kept}`);
}
// Make-variation survives without the form: it re-runs the saved prompt and
// settings through the same queued generation path Jewel uses.
const variationAt = page.indexOf('function makeVariation');
assert.ok(variationAt >= 0, 'makeVariation still exists');
const variation = page.slice(variationAt, page.indexOf('function renameProjectAsset', variationAt));
assert.ok(variation.includes('queueOrGenerate(type, generation.prompt, options)'), 'makeVariation generates through the shared queue');
assert.ok(!variation.includes('openWorkshopTool') && !variation.includes('setGenerator'), 'makeVariation no longer loads a generator form');
// The Board Designer's artwork step lands on Jewel with the request drafted,
// instead of opening the removed generator.
assert.ok(page.includes('onCreateArtwork'), 'BoardDesigner keeps its create-artwork step');
const artworkAt = page.indexOf('onCreateArtwork');
assert.ok(!page.slice(artworkAt, artworkAt + 320).includes('setShowGenerator'), 'create-artwork no longer opens a generator');
assert.ok(page.slice(artworkAt, artworkAt + 320).includes('openJewel()'), 'create-artwork lands on Jewel');
// Stage navigation for generation work lands on Jewel herself.
assert.ok(page.includes('if (stepId === "media") { openJewelForGeneration(); return; }'), 'the media step lands on Jewel');
assert.ok(page.includes('if (stepId === "trivia-cards") { openJewelForGeneration(); return; }'), 'the trivia step lands on Jewel');
// The template pickers still open through the shared opener, boards/tools only.
assert.ok(page.includes('function openWorkshopTool(tool: "boards" | "tools")'), 'openWorkshopTool serves only the template pickers now');

console.log('jewel-doors-close: all assertions passed');
