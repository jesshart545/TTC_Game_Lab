const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// The task catch in the project page used to append "Review your current
// draft; completed steps and originals have been kept." to EVERY failure,
// including failures where nothing was produced (Jessica's Lady Lovelace
// Music Showdown edits, 2026-10-25). The failure reply must now be chosen
// from what the task actually saved before it threw.

const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');

test('the old success-sounding footer no longer exists anywhere in the page', () => {
  assert.ok(!page.includes('completed steps and originals have been kept'), 'the misleading footer text is gone');
  assert.ok(!page.includes('Review your current draft; completed steps'), 'no variant of the old footer remains');
});

test('the failure reply branches on what the task actually saved', () => {
  assert.ok(page.includes('savedStepsThisTask > 0 || draftChangedThisTask'), 'the catch checks the truth trackers');
  assert.ok(page.includes('The steps that did finish are saved in your draft, and your originals are unchanged.'), 'partial work gets the kept-steps wording');
  assert.ok(page.includes('Nothing new was saved by this attempt, and your originals are unchanged.'), 'a zero-save failure says nothing was saved');
  const noteAt = page.indexOf('const failureNote');
  assert.ok(noteAt > -1, 'the task catch builds a failure note');
  const catchBlock = page.slice(noteAt, noteAt + 900);
  assert.ok(catchBlock.includes('const reply = (error instanceof Error ? error.message'), 'the catch reply is the error plus the truthful note');
  assert.ok(catchBlock.includes('complete(reply, false, "failed")'), 'the outcome is still recorded as failed');
});

test('saved work is counted where it actually happens', () => {
  const layerSaveAt = page.indexOf('name: resultName, type: "video/mp4"');
  assert.ok(layerSaveAt > -1, 'the edit-layer save exists');
  assert.ok(page.slice(layerSaveAt, layerSaveAt + 400).includes('savedStepsThisTask += 1'), 'each saved edit layer is counted');

  const copySaveAt = page.indexOf('await saveAssetAsNew({ ...hydrated, edits: checked.edits });');
  assert.ok(copySaveAt > -1, 'the render-copy save exists');
  assert.ok(page.slice(copySaveAt, copySaveAt + 200).includes('savedStepsThisTask += 1'), 'a saved render copy is counted');

  assert.ok(page.includes('if (result.applied) { persist(result.project); draftChangedThisTask = true; }'), 'applied draft changes are counted before media work begins');
  assert.ok(page.includes('savedStepsThisTask += 1;\n        guard();\n        const finished = generated.name'), 'a successful generation is counted before the completion reply');
});

test('success replies are untouched', () => {
  assert.ok(page.includes('"The edited copy is now in your draft assets. Your original and published live version are unchanged."'), 'the one-layer edit completion reply is unchanged');
  assert.ok(page.includes('chain.layers > 1'), 'the layered completion reply logic is unchanged');
});
