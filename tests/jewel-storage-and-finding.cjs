const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./load.cjs');

// Jewel's storage and finding (Jessica, 2026-11-04 — the Kysha's
// Growth Lab failure): Jewel generated nine images inside a talk
// project; none was ever filed into the project, so they existed
// only in the workspace Asset Library, and when the creator asked
// where they were, Jewel recited their names and pointed at a
// "library/assets area on this page" that does not exist. These
// contracts pin the three fixes: (a) media Jewel generates inside a
// project is filed INTO the project at generation time; (b) edited
// copies are named "Base (edit N)" from the base name and the
// suffix never compounds; (c) a "where is my X" answer goes through
// Jewel's validated navigate mechanism to the shelf that holds it,
// and her instructions ground her in places that actually exist.

const { fileGeneratedAsset, editBaseName, nextEditName } = load('lib/asset-filing.ts');
const { validateNavigate } = load('lib/workflow-progress.ts');

function baseProject(overrides = {}) {
  return {
    id: 'p1', name: 'New Project', slug: 'p1-x', description: '', status: 'Draft', theme: 'cyan',
    updatedAt: 'now', prompt: '', messages: [], controls: [], assets: [], assetPools: [], compositions: [],
    overlay: { title: '', subtitle: '', showChat: false, showAlerts: false, showCharacter: false },
    wheel: { enabled: false, title: '', segments: [], spinning: false, visible: false },
    gameTools: [], gamePlan: {},
    ...overrides,
  };
}

// --- (a) Generated media is filed into its project --------------------------
{
  const empty = baseProject({ kind: 'talk' });
  const image = fileGeneratedAsset(empty, { name: 'Neon stage', type: 'image/png', url: 'https://x/y.png' });
  assert.equal(image.inProject, true, 'a generated image lands in the project, not outside it');
  assert.equal(image.role, 'background', 'the first image takes the background role, exactly as "+ Add to Project" files it');

  const withBackdrop = baseProject({ kind: 'talk', assets: [{ name: 'Set', type: 'image/png', inProject: true, role: 'background' }] });
  const second = fileGeneratedAsset(withBackdrop, { name: 'Guest chair', type: 'image/png', url: 'https://x/z.png' });
  assert.equal(second.inProject, true);
  assert.equal(second.role, 'layer', 'with a background already on the overlay, a new image files as a layer');

  const video = fileGeneratedAsset(empty, { name: 'Intro', type: 'video/mp4', url: 'https://x/v.mp4' });
  assert.equal(video.inProject, true);
  assert.equal(video.role, 'video');
  const song = fileGeneratedAsset(empty, { name: 'Theme', type: 'audio/mpeg', generation: { type: 'music', prompt: 'jingle' } });
  assert.equal(song.inProject, true);
  assert.equal(song.role, 'audio');

  const caseMedia = fileGeneratedAsset(empty, { name: 'Alley', type: 'image/png', url: 'https://x/a.png' }, { backdropEligible: false });
  assert.equal(caseMedia.inProject, true, 'case media is filed into the project too');
  assert.equal(caseMedia.role, 'layer', 'but media made for a case item never becomes the backdrop');

  const roled = fileGeneratedAsset(empty, { name: 'Kept', type: 'image/png', role: 'layer', url: 'https://x/k.png' });
  assert.equal(roled.role, 'layer', 'a role the generation already carries is preserved');

  // The generation path itself files through the helper: the project
  // page's generateAsset is the one funnel for Jewel's media actions,
  // the panel queue, variations and pending-video recovery alike.
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('fileGeneratedAsset(currentAfterStore, fittedAsset'), 'generateAsset files every generated asset into the project');
  assert(page.includes('inProject: false }\n        : fileGeneratedAsset') || page.includes('role: "background", inProject: false }'), 'the background-intent destination flow keeps its deliberate exception');
  assert(page.includes('forCaseItem: Boolean((mediaAction as any)?.ccssAttach)'), 'case-item generations are marked so they are filed without becoming the backdrop');
  console.log('PASS: (a) media Jewel generates inside a project is filed into that project at generation time — inProject, with the "+ Add to Project" role — so it stands on the project\'s own shelves.');
}

// --- (b) Edit naming: "(edit N)" from the base name, never compounding ------
{
  assert.equal(editBaseName('Image 2'), 'Image 2');
  assert.equal(editBaseName('Image 2-edited-edited-edited'), 'Image 2', 'a stacked "-edited" chain bases back to the original name');
  assert.equal(editBaseName('Intro-edited.mp4'), 'Intro', 'extensions and one "-edited" come off');
  assert.equal(editBaseName('Image 2 (edit 3)'), 'Image 2');
  assert.equal(editBaseName('Show (edit 1)-edited.png'), 'Show', 'mixed chains strip in any order');

  assert.equal(nextEditName([], 'Image 2'), 'Image 2 (edit 1)');
  assert.equal(nextEditName(['Image 2'], 'Image 2'), 'Image 2 (edit 1)');
  assert.equal(nextEditName(['Image 2', 'Image 2 (edit 1)'], 'Image 2'), 'Image 2 (edit 2)', 'the line continues from the source');
  assert.equal(nextEditName(['Image 2', 'Image 2 (edit 1)'], 'Image 2 (edit 1)'), 'Image 2 (edit 2)', 'editing an edit continues the same line — it never becomes "(edit 1) (edit 1)"');
  assert.equal(nextEditName(['Image 2-edited-edited-edited-edited-edited-edited'], 'Image 2-edited-edited-edited-edited-edited-edited'), 'Image 2 (edit 1)', 'the first new copy of a mangled legacy name starts a clean "(edit N)" line');
  assert.equal(nextEditName(['Intro', 'Intro (edit 1)', 'Intro (edit 2)'], 'Intro-edited.mp4'), 'Intro (edit 3)');
  assert(!nextEditName(['A', 'A (edit 9)'], 'A').includes('-edited'), 'a produced name never carries "-edited"');

  // The edited-copy save paths name through the helper: the project's
  // save-as-new (MediaEditor copies, Jewel's render-copy and layered
  // video edits) and the library page's save-as-new alike.
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('const copyName = nextEditName(project.assets.map(a => a.name), nextAsset.name);'), 'the project save-as-new names copies through the edit-line helper');
  assert(!page.includes('"-edited.mp4"') && !page.includes('"-edited.png"'), 'no save path stacks another "-edited" onto a name anymore');
  assert(page.includes('const resultName = await saveAssetAsNew({'), 'a layered video edit takes its saved name from the copy save itself');
  const library = fs.readFileSync('app/assets/page.tsx', 'utf8');
  assert(library.includes('const copyName=nextEditName(fresh.assets.map(a=>a.name),nextAsset.name);'), 'the library save-as-new names copies through the same helper — from the project as freshly re-read, never the page-load snapshot');
  console.log('PASS: (b) edited copies are named "Base (edit N)" from the base name — the suffix continues the line and never compounds.');
}

// --- Edited copies keep their source's filing --------------------------------
{
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('role:nextAsset.role,inProject:nextAsset.inProject'), 'a saved copy persists with the role and inProject of the asset it was made from, so it stands on the same shelf');
  console.log('PASS: edited copies keep their source\'s filing — same shelf, same project membership.');
}

// --- (c) "Where is my X" — Jewel takes them there ----------------------------
{
  // The locate directive validates for BOTH light-stage kinds: the
  // media step exists in each kind's Imagine and Create model, and
  // the talk backdrops live under its background step.
  const talk = baseProject({ kind: 'talk' });
  const gameshow = baseProject({ kind: 'gameshow' });
  assert.deepEqual(JSON.parse(JSON.stringify(validateNavigate(talk, { stage: 0, stepId: 'media' }))), { stage: 0, stepId: 'media' }, 'talk: navigate to the media step validates');
  assert.deepEqual(JSON.parse(JSON.stringify(validateNavigate(talk, { stage: 0, stepId: 'background' }))), { stage: 0, stepId: 'background' }, 'talk: navigate to the backdrops validates');
  assert.deepEqual(JSON.parse(JSON.stringify(validateNavigate(gameshow, { stage: 0, stepId: 'media' }))), { stage: 0, stepId: 'media' }, 'gameshow: navigate to the media step validates');

  // The page honors the directive on the light stages themselves:
  // her named step becomes the area/topic the stage surfaces.
  const page = fs.readFileSync('app/project/[id]/page.tsx', 'utf8');
  assert(page.includes('setJewelStageArea({ projectId: latest.id, stepId: navigate.stepId })'), 'the page records the area Jewel directed the creator to');
  assert(page.includes('requestedArea={jewelStageArea?.projectId === project.id ? jewelStageArea.stepId : null}'), 'the gameshow stage receives her directed area');
  assert(page.includes('requestedTopic={jewelStageArea?.projectId === project.id ? jewelStageArea.stepId : null}'), 'the talk stage receives her directed topic');
  const gameshowStage = fs.readFileSync('components/GameshowStage.tsx', 'utf8');
  assert(gameshowStage.includes('requestedArea?: string | null') && gameshowStage.includes('props.requestedArea'), 'the gameshow stage surfaces the area Jewel named over its resting area');
  const talkStage = fs.readFileSync('components/TalkshowStage.tsx', 'utf8');
  assert(talkStage.includes('requestedTopic?: string | null') && talkStage.includes('requestedTopic'), 'the talk stage surfaces the topic Jewel named over its resting topic');

  // And her instructions ground the answer in the page she operates:
  // take them there via navigate; the invented place is named as the
  // thing she must never say.
  const route = fs.readFileSync('app/api/jewel/route.ts', 'utf8');
  assert(route.includes('FINDING THINGS — TAKE THEM THERE, NEVER SEND THEM HUNTING'), 'Jewel is instructed to answer "where is it" by taking the creator there');
  assert(route.includes('do not answer by describing a place'), 'a name list or a described location is not an answer');
  assert(route.includes('there is NO "library/assets area on this page"'), 'the invented location from the failure is named as nonexistent in her instructions');
  assert(route.includes('your knowledge of what the project holds comes from the project\'s own saved assets'), 'her knowledge of generated media comes from the project itself');
  console.log('PASS: (c) a "where is my X" ask is answered by Jewel\'s validated navigate directive to the shelf that holds it, on both light stages — never by a described place that is not on the page.');
}

// --- /assets: the library never claims to be empty while it loads -----------
{
  const library = fs.readFileSync('app/assets/page.tsx', 'utf8');
  assert(library.includes('const [loading,setLoading]=useState(true);'), 'the library tracks its first load');
  assert(library.includes('Loading your assets…'), 'a loading state stands where the empty claim used to flash');
  assert(library.indexOf('Loading your assets…') < library.indexOf('No saved assets yet.'), 'the loading state renders before — and instead of — the empty state while assets load');
  console.log('PASS: /assets shows a loading state on first render instead of "0 assets / No saved assets yet"; the empty state remains for a library that has actually loaded empty.');
}
