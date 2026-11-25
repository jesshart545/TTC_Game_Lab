const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./load.cjs');

// Values loaded through the vm test loader live in another realm, so
// structural comparisons go through JSON rather than deepStrictEqual.
const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);

const root = path.join(__dirname, '..');
const kinds = load('lib/project-kinds.ts');
const { isKindComingSoon, isKindGatedFor, setupPiecesForKind } = kinds;
const projectLib = load('lib/project.ts');
const flow = fs.readFileSync(path.join(root, 'app/project/new/flow.tsx'), 'utf8');
const projectTs = fs.readFileSync(path.join(root, 'lib/project.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/jewel/route.ts'), 'utf8');
const stage = fs.readFileSync(path.join(root, 'components/TalkshowStage.tsx'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/project/[id]/page.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'components/WorkshopAiPanel.tsx'), 'utf8');

// Talk Show or Classroom create flow (Jessica, 2026-11-24): "Are we
// building a talk show or a classroom?" comes FIRST — before the
// title, before anything else. Talk show: title, then topic.
// Classroom: title, then subject content. Either answer seeds the
// project theme exactly as talk's theme seeding already works, and
// the creator then goes to Jewel — her sequence has no pieces step.
// Both branches live in the same builder and the same three areas
// (Imagine and Create, Set the Stage, Showtime!); the branch only
// frames the wording and Jewel's guidance inside them. The flow
// ships LIVE for all users — no gate, no admin chip, no Coming Soon.

// 1. No gate: talk is open to every signed-in user, admin or not, and
// is not a Coming Soon kind. Nothing about the branch question is
// admin-only.
assert.equal(isKindGatedFor('talk', false), false, 'talk is open to non-admins — the branch flow ships live for all users');
assert.equal(isKindGatedFor('talk', true), false, 'talk is open to the admin too, with no special testing gate');
assert.equal(isKindComingSoon('talk'), false, 'talk is not a Coming Soon kind');
console.log('PASS: talk carries no gate — the branch question and both branches ship live for all users.');

// 2. The branch question comes before the title in talk's flow, the
// title and the topic/subject fields are branch-aware, and creation
// cannot start until a branch is picked.
const talkBranchStart = flow.indexOf('{kind === "talk" ? (');
assert(talkBranchStart >= 0, 'the scratch screen has a dedicated talk branch');
const talkScreen = flow.slice(talkBranchStart, talkBranchStart + 4000);
const questionAt = talkScreen.indexOf('are we building a talk show or a classroom?');
const pickAt = talkScreen.indexOf('setTalkBranch("talk-show")');
const titleAt = talkScreen.indexOf('"Class title"');
assert(questionAt >= 0, 'talk asks the branch question, in Jessica\'s words');
assert(pickAt > questionAt, 'the branch choices follow the question');
assert(titleAt > pickAt, 'the title is asked AFTER the branch question');
assert(talkScreen.includes('setTalkBranch("classroom")'), 'the classroom choice sets the classroom branch');
assert(talkScreen.includes('talkBranch === "classroom" ? "Class title" : "Show title"'), 'the title field is branch-aware: class title vs show title');
assert(talkScreen.includes('talkBranch === "classroom" ? "Subject content" : "Topic"'), 'the second field is branch-aware: subject content vs topic');
assert(flow.includes('if (kind === "talk" && !talkBranch) return;'), 'creation cannot start until a branch is picked');
assert(flow.includes('(kind === "talk" && !talkBranch)'), 'the Next button stays disabled until a branch is picked');
console.log('PASS: branch question first, then a branch-aware title and topic/subject; advance refused without a pick.');

// 3. No pieces step for talk — the scratch screen renders no pieces
// grid for talk and a talk scratch start carries no pieces. The two
// talk pieces themselves are NOT deleted: the kind still offers them
// (they stay reachable through Jewel and the Library).
assert(flow.includes('{kind !== "radio" && kind !== "talk" && ('), 'the pieces grid is not rendered for talk');
const talkStartAt = flow.indexOf('if (kind === "talk") {\n      scratch.pieces = [];');
assert(talkStartAt >= 0, 'a talk scratch start carries no pieces');
assert(flow.includes('scratch.talkBranch = talkBranch ?? undefined;'), 'the scratch start carries the picked branch');
eq(setupPiecesForKind('talk').map(p => p.id), ['question-cards', 'video-clips'], 'talk still offers its two pieces — the capability stays, only the step is folded into the Jewel flow');
console.log('PASS: talk has no pieces step; its two pieces remain available through Jewel and the Library.');

// 4. The chosen branch is stored on the created project: creation
// stamps it onto the project record, and the field survives the
// project's JSON round trip.
const stampAt = flow.indexOf('if (start.kind === "talk") {');
assert(stampAt >= 0, 'creation has a talk stamping block');
const stamp = flow.slice(stampAt, stampAt + 400);
assert(stamp.includes('if (start.talkBranch) project.talkBranch = start.talkBranch;'), 'creation stamps the branch onto the project');
assert(projectTs.includes('export type TalkBranch = "talk-show" | "classroom";'), 'the branch type is defined with the project record');
assert(projectTs.includes('talkBranch?: TalkBranch;'), 'the project record carries the branch field');
const created = projectLib.createProject('');
created.kind = 'talk';
created.talkBranch = 'classroom';
const roundTripped = JSON.parse(JSON.stringify(created));
assert.equal(roundTripped.kind, 'talk', 'kind survives the round trip');
assert.equal(roundTripped.talkBranch, 'classroom', 'the stored branch survives the round trip');
console.log('PASS: the chosen branch is stored on the created project.');

// 5. Theme seeding: on BOTH branches the second answer (topic for a
// talk show, subject content for a classroom) is the theme, seeded
// into gamePlan.theme at creation by the same talk seeding that
// already existed — that is what seeds Jewel (talkShow.themeStyle).
assert(flow.includes('theme: kind === "talk" || kind === "gameshow" ? theme.trim() || undefined : undefined'), 'the talk scratch start carries the topic/subject answer as its theme');
assert(flow.includes('if ((start.kind === "talk" || start.kind === "gameshow") && start.theme)'), 'creation seeds the talk theme into gamePlan.theme as before');
console.log('PASS: topic (talk show) and subject content (classroom) both seed gamePlan.theme the existing talk way.');

// 6. The canned greeting is talk-worded and branch-aware — no
// gameshow furniture (no trivia generator, no board templates) in a
// talk project. The shared gameshow seed stays for the kinds that
// already had it.
const greetAt = flow.indexOf('if (start.kind === "talk") {');
const greet = flow.slice(greetAt, greetAt + 1400);
assert(greet.includes('build your curriculum, make quizzes, tasks and tests from it'), 'the classroom greeting speaks classroom');
assert(greet.includes('design your background artwork, make music or a cutscene video'), 'the talk-show greeting speaks talk show');
assert(!/trivia|board template/i.test(greet), 'no gameshow words in a talk project\'s greeting');
assert(flow.includes('start with the trivia generator, board and tool templates, uploads, or Asset Composer'), 'the shared seed is unchanged for the kinds that already had it');
console.log('PASS: talk greetings are branch-aware talk wording; every other kind\'s greeting is byte-identical.');

// 7. Jewel's talk addendum is branch-framed: classroom framing
// (curriculum first, quizzes/tasks/tests from the curriculum, a
// backdrop per topic/lesson, the classroom dashboard) vs talk-show
// framing (background artwork, music and cutscene videos, the talk
// show dashboard). YouTube stays an option Jewel understands in
// BOTH branches. Both prompt compositions use the framed addendum.
assert(route.includes('function talkAddendum(project: any): string'), 'the jewel route frames the talk addendum by branch');
assert(route.includes('THIS SHOW\'S BRANCH IS A CLASSROOM'), 'the classroom branch line exists');
assert(route.includes('THIS SHOW\'S BRANCH IS A TALK SHOW'), 'the talk-show branch line exists');
const classAt = route.indexOf('THIS SHOW\'S BRANCH IS A CLASSROOM');
const classLine = route.slice(classAt, classAt + 3600);
const bgFirstAt = classLine.indexOf('BACKGROUND IMAGERY FIRST');
const curriculumAt = classLine.indexOf('(2) THE CURRICULUM');
assert(bgFirstAt >= 0, 'classroom framing starts with background imagery (Jessica, 2026-11-24: background first in every branch)');
assert(curriculumAt > bgFirstAt, 'the curriculum comes after the opening background imagery in the classroom branch');
assert(classLine.includes('QUIZZES, TASKS AND TESTS COME FROM THE CURRICULUM'), 'classroom quizzes, tasks and tests come from the curriculum');
assert(classLine.includes('A BACKDROP PER TOPIC OR LESSON'), 'classroom gets a different backdrop per topic/lesson');
assert(classLine.includes('THE CLASSROOM DASHBOARD'), 'the classroom dashboard controls these mechanisms');
assert(classLine.includes('YOUTUBE STAYS AN OPTION'), 'YouTube stays an option in the classroom branch');
assert(classLine.includes('changes.newTools [{type:"youtube"}]'), 'Jewel is taught the YouTube ask in the classroom branch');
assert(classLine.includes('STAGING A CLASS'), 'the classroom branch teaches the staging conversation — laying out the classroom through Jewel');
const showAt = route.indexOf('THIS SHOW\'S BRANCH IS A TALK SHOW');
const showLine = route.slice(showAt, showAt + 1800);
assert(showLine.includes('background artwork'), 'talk-show framing covers background artwork');
assert(showLine.includes('music or cutscene videos'), 'talk-show framing covers music and cutscene videos');
assert(showLine.includes('talk show DASHBOARD'), 'talk-show framing covers the talk show dashboard');
assert(showLine.includes('STAGING THE SET'), 'the talk-show branch teaches the staging conversation — laying out the talk show set through Jewel');
assert(showLine.includes('YOUTUBE STAYS AN OPTION'), 'YouTube stays an option in the talk-show branch');
assert.equal(route.split('GENERATION_ADDENDUM + talk').length - 1, 2, 'both prompt compositions use the branch-framed addendum');
assert(!route.includes('(talkShow ? JEWEL_TALKSHOW_ADDENDUM : "")'), 'the unframed addendum is no longer composed directly');
console.log('PASS: Jewel\'s talk addendum is branch-framed, and YouTube is taught as an ask in both branches.');

// 8. The stage and the composer speak the branch: TalkshowStage
// headings are branch-aware with the talk-show wording as the
// standing default, and the panel's example requests and placeholder
// are talk-worded per branch — while the gameshow defaults and the
// radio wording stay byte-identical for their kinds.
assert(stage.includes('project.talkBranch === "classroom"'), 'the talk stage reads the stored branch');
assert(stage.includes('First let’s decide on a background (flat/animated)'), 'the talk-show background heading stands as the default');
assert(stage.includes('First let’s decide on a backdrop for this lesson (flat/animated)'), 'the classroom background heading names a per-lesson backdrop');
assert(stage.includes('Quiz your class — quizzes, tasks and tests from your curriculum'), 'the classroom quiz heading speaks curriculum');
assert(stage.includes('Your class is about: '), 'the classroom research heading speaks class');
assert(panel.includes('project.talkBranch==="classroom"'), 'the panel reads the stored branch');
assert(panel.includes('Build my curriculum'), 'classroom example requests lead with the curriculum');
assert(panel.includes('Design my background'), 'talk-show example requests lead with the background');
assert(panel.includes('Example: Build a quiz from my first lesson and a backdrop for it.'), 'the classroom composer placeholder speaks classroom');
assert(panel.includes('Example: Make a background for my talk show and a short intro cutscene.'), 'the talk-show composer placeholder speaks talk show');
assert(panel.includes('Example: Help me create a music quiz with easy host controls.'), 'the gameshow composer placeholder is unchanged');
assert(panel.includes('Help me plan my game. Ask me what you need to know.'), 'the gameshow example requests are unchanged');
assert(panel.includes('Example: Build my playlist and set up a sound board with my intro and effects.'), 'the radio composer placeholder is unchanged');
console.log('PASS: stage headings, example requests and placeholders are branch-aware for talk; other kinds unchanged.');

// 9. Existing talk projects with no talkBranch behave as talk shows:
// every branch check in the talk surfaces keys on the classroom
// value, so an unset branch falls through to the standing talk-show
// wording and framing — nothing already built changes.
assert(!stage.includes('talkBranch === "talk-show" ?'), 'the stage never requires an explicit talk-show stamp — unset means talk show');
assert(route.includes('return JEWEL_TALKSHOW_ADDENDUM + `\n- THIS SHOW\'S BRANCH IS A TALK SHOW'), 'an unset branch falls through to the talk-show framing in Jewel\'s addendum');
const legacy = projectLib.createProject('');
legacy.kind = 'talk';
assert.equal(legacy.talkBranch, undefined, 'a talk project without the field is the pre-branch shape');
console.log('PASS: talk projects with no stored branch behave as talk shows — nothing already built changes.');

// 10. Background first, the prompt-line handoff, and the library
// door (Jessica, 2026-11-24): in BOTH branches Jewel's flow starts
// with background imagery — the stage's topic order opens with the
// background, the classroom addendum opens with background imagery
// ahead of the curriculum — and the scratch screen carries exactly
// one prompt line under the title/topic area, handing the creator
// straight to Jewel. Nothing Jewel makes is buried: the gold
// library door stands in the talk create area ahead of the topics.
assert(stage.includes('const TALK_TOPICS = ["background", "prompt", "research", "quiz", "media", "missed"] as const;'), 'the talk stage topic order starts with the background in both branches');
const promptLineAt = talkScreen.indexOf('Okay, now let’s talk to Jewel and get started on your ideas — let’s start with the background.');
assert(promptLineAt > titleAt, 'one prompt line stands below the title/topic area, handing the creator to Jewel — not a form field, not a step');
assert(stage.includes('gsw-library-door') && stage.includes('Your library & uploads'), 'the gold library door stands in the talk create area');
assert(stage.indexOf('Your library & uploads') < stage.indexOf('topic === "background"'), 'the library door stands ahead of the topic areas, not buried below them');
console.log('PASS: background first in both branches; one prompt line hands the creator to Jewel; the library door stands prominent.');

// 11. Free movement between the areas (Jessica, 2026-11-24): the
// talk stage lock is removed — stage navigation is NOT gated on
// topic completion, the stage bar moves at the creator's click in
// both directions, and Jewel's framing never prompts the move to
// staging. Her check-offs are invisible bookkeeping only.
assert(!page.includes('lockedStages={project.kind === "talk"'), 'the page passes no stage lock for talk');
assert(!page.includes('talkCreateComplete'), 'no completion gate remains on the talk page');
assert(!page.includes('Set the Stage unlocks when Jewel has checked off every topic'), 'the lock note is gone');
assert(route.includes('MOVEMENT BETWEEN THE AREAS IS THE CREATOR\'S OWN CLICK'), 'Jewel\'s talk framing makes movement the creator\'s own click');
assert(route.includes('your check-offs are bookkeeping only'), 'check-offs are bookkeeping only in Jewel\'s framing');
assert(!route.includes('direct the creator on to Set the Stage'), 'Jewel never directs the creator to begin staging');
console.log('PASS: stage navigation is not gated on topic completion — free movement, no staging prompts from Jewel.');

console.log('PASS: talk create flow — branch question first, branch stored, no pieces step, live for all users, background first, free movement.');
