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
// Jessica's live review of the first build added two corrections:
// the question STANDS ALONE as its own step, the way the gameshow
// start stands alone (an eyebrow, the question as the heading, two
// pictured choices, no fields until a choice is picked), and each
// branch's start screen carries that branch's OWN headings — a
// classroom never wears "BUILD YOUR TALK SHOW".

// 1. No gate: talk is open to every signed-in user, admin or not, and
// is not a Coming Soon kind. Nothing about the branch question is
// admin-only.
assert.equal(isKindGatedFor('talk', null), false, 'talk is open to non-admins — the branch flow ships live for all users');
assert.equal(isKindGatedFor('talk', 'ladylovelace0627@gmail.com'), false, 'talk is open to Jessica too, with no special testing gate');
assert.equal(isKindComingSoon('talk'), false, 'talk is not a Coming Soon kind');
console.log('PASS: talk carries no gate — the branch question and both branches ship live for all users.');

// 2. The branch question STANDS ALONE as its own first step: an
// eyebrow, the question as the heading, and exactly two pictured
// choices in the gameshow start's pattern — no title/topic fields
// and no Next button on that step; picking a choice is the advance.
// Picking sets the branch and lands on that branch's own start
// screen, whose badge and heading are the branch's own. The start
// screen's fields stay branch-aware, its back returns to the
// choice step, and creation cannot start until a branch is picked.
const choiceAt = flow.indexOf('{screen === "talk-choice"');
assert(choiceAt >= 0, 'talk has a standalone choice step');
const scratchAt = flow.indexOf('{screen === "scratch"');
assert(scratchAt > choiceAt, 'the choice step renders before the scratch screen — the question comes first, alone');
const choiceStep = flow.slice(choiceAt, scratchAt);
assert(choiceStep.includes('Talk show or classroom project'), 'the choice step carries the eyebrow naming both branches');
assert(choiceStep.includes('Are we building a talk show or a classroom?'), 'the choice step asks the branch question as its heading, in Jessica\'s words');
assert(choiceStep.includes('pickTalkBranch("talk-show")'), 'the talk show choice picks the talk-show branch');
assert(choiceStep.includes('pickTalkBranch("classroom")'), 'the classroom choice picks the classroom branch');
assert(choiceStep.includes('Your show, your topic — you host the conversation live.'), 'the talk show choice carries its one short line');
assert(choiceStep.includes('Your class, your subject — you teach it live, lesson by lesson.'), 'the classroom choice carries its one short line');
assert(!choiceStep.includes('np-nameinput'), 'no title or topic fields stand on the choice step — nothing is asked until a choice is picked');
assert(!choiceStep.includes('np-nextbtn'), 'no Next button stands on the choice step — picking a choice is the advance');
assert(flow.includes('if (next === "talk")') && flow.includes('setScreen("talk-choice")'), 'choosing the talk kind opens the choice step, not the form');
assert(flow.includes('function pickTalkBranch(branch: TalkBranch)'), 'picking a choice goes through the branch picker');
assert(flow.includes('setTalkBranch(branch);'), 'the picker sets the picked branch');
const pickerAt = flow.indexOf('function pickTalkBranch(branch: TalkBranch)');
const picker = flow.slice(pickerAt, pickerAt + 500);
assert(picker.includes('setScreen("scratch")'), 'the picker advances to the picked branch\'s start screen');
assert(picker.includes('nameSuggestion'), 'the picker handles the name suggestion per branch — a talk show is suggested its title, a classroom is not handed a talk show\'s');
// Each branch's start screen carries its own headings: the badge
// and the heading switch for a classroom, and the talk show keeps
// today's headings (the kind info's, which the classroom ternaries
// fall through from).
assert(flow.includes('kind === "talk" && screen === "talk-choice" ? "Talk show or classroom project"'), 'the choice step is badged for both branches');
assert(flow.includes('kind === "talk" && talkBranch === "classroom" ? "Classroom project"'), 'the classroom start screen is badged Classroom project');
assert(flow.includes('kind === "talk" && talkBranch === "classroom" ? "Build your classroom"'), 'the classroom start screen is headed Build your classroom');
const talkInfo = kinds.PROJECT_KINDS.find(k => k.id === 'talk');
assert.equal(talkInfo.chipLabel, 'Talk show project', 'the talk-show start screen keeps today\'s badge');
assert.equal(talkInfo.scratchHeading, 'Build your talk show', 'the talk-show start screen keeps today\'s heading');
assert.equal(talkInfo.nameSuggestion, 'My Talk Show', 'the talk-show title keeps today\'s prefill');
// The branch start screens themselves: branch-aware fields, the
// question no longer on the same screen, back to the choice step.
const talkBranchStart = flow.indexOf('{kind === "talk" ? (');
assert(talkBranchStart >= 0, 'the scratch screen has a dedicated talk branch');
const talkScreen = flow.slice(talkBranchStart, talkBranchStart + 4000);
const titleAt = talkScreen.indexOf('"Class title"');
assert(titleAt >= 0, 'the branch start screen asks for the title');
assert(!talkScreen.includes('are we building a talk show or a classroom?'), 'the branch question does not stand on the start screen — it had its own step');
assert(talkScreen.includes('talkBranch === "classroom" ? "Class title" : "Show title"'), 'the title field is branch-aware: class title vs show title');
assert(talkScreen.includes('talkBranch === "classroom" ? "Subject content" : "Topic"'), 'the second field is branch-aware: subject content vs topic');
assert(flow.includes('if (kind === "talk") { setScreen("talk-choice"); }'), 'the scratch screen\'s back returns to the choice step for talk');
assert(flow.includes('if (kind === "talk" && !talkBranch) return;'), 'creation cannot start until a branch is picked');
assert(flow.includes('(kind === "talk" && !talkBranch)'), 'the Next button stays disabled until a branch is picked');
console.log('PASS: the branch question stands alone as its own step; picking a branch lands on that branch\'s own start screen, headings and fields its own.');

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

// 12. The background EXAMPLES match the branch (Jessica, 2026-11-24):
// in a classroom project's Imagine & Create, the flat and animated
// example cards must show classroom artwork — the talk-show stage
// picture standing under a "classroom backdrop" caption is the
// defect this pins against. ExampleStageMedia picks its picture by
// branch, AnimatedExampleMedia's fallback loop is the classroom
// loop for a classroom project, and the call sites pass the branch
// through — including BackdropStageMedia's url-less fallback.
// Talk-show projects and projects with no branch stored keep
// today's artwork exactly.
const steps = fs.readFileSync(path.join(root, 'components/TalkshowSteps.tsx'), 'utf8');
assert(steps.includes('export function ExampleStageMedia({ classroom }: { classroom?: boolean })'), 'the flat example media takes a classroom flag');
assert(steps.includes('classroom ? "/redesign/classroom-backdrop-example.webp" : "/redesign/talk-backdrop-example.webp"'), 'the flat example shows the classroom artwork for a classroom, the talk-show backdrop otherwise — the furniture-free example art, not the kind artwork');
assert(steps.includes('project.talkBranch === "classroom" ? "/redesign/classroom-animated-backdrop.mp4" : "/redesign/talk-backdrop-example-animated.mp4"'), 'the animated example falls back to the classroom loop for a classroom project, the talk-show backdrop loop otherwise');
assert(steps.includes('if (!asset.url) return <ExampleStageMedia classroom={classroom} />;'), 'the url-less backdrop fallback forwards the branch to the example media');
assert(stage.includes('<ExampleStageMedia classroom={classroom} />'), 'the talk stage background area passes its branch to the flat example');
assert(steps.includes('<ExampleStageMedia classroom={project.talkBranch === "classroom"} />'), 'the talk steps pass the project branch to the flat example');
assert(fs.existsSync(path.join(root, 'public/redesign/classroom-backdrop-example.webp')), 'the classroom example artwork is filed under public/redesign/');
assert(fs.existsSync(path.join(root, 'public/redesign/classroom-animated-backdrop.mp4')), 'the classroom animated example is filed under public/redesign/');
assert(fs.existsSync(path.join(root, 'public/redesign/talk-backdrop-example.webp')), 'the talk-show example artwork is filed under public/redesign/');
assert(fs.existsSync(path.join(root, 'public/redesign/talk-backdrop-example-animated.mp4')), 'the talk-show animated example is filed under public/redesign/');
console.log('PASS: the background examples match the branch — classroom artwork and loop for a classroom, talk-show artwork and loop otherwise.');

// 13. The branch start screens carry the background examples below
// the title and subject (Jessica, 2026-11-24): originally a still
// background example and an animated example sat below the title
// and subject, and those examples prompted the user to begin
// working with Jewel — that was correct already, and the branch
// rebuild keeps it. Both examples stand on the branch start
// screens (one shared block, branched by the picked branch), below
// the fields and above the prompt line, each showing its own
// branch's artwork, rendered straight from the public paths — no
// project exists yet on this screen. The choice step carries no
// examples: they belong below the title and subject, which live on
// the branch screens.
const fieldsAt = flow.indexOf('aria-label={talkBranch === "classroom" ? "Subject content" : "Topic"}');
assert(fieldsAt >= 0, 'the branch start screens carry the subject/topic field');
const stillAt = flow.indexOf('talkBranch === "classroom" ? "/redesign/classroom-backdrop-example.webp" : "/redesign/talk-backdrop-example.webp"');
assert(stillAt > fieldsAt, 'the still background example stands below the title and subject fields');
const animAt = flow.indexOf('talkBranch === "classroom" ? "/redesign/classroom-animated-backdrop.mp4" : "/redesign/talk-backdrop-example-animated.mp4"');
assert(animAt > stillAt, 'the animated background example stands with the still one, below the fields');
const promptLineFlowAt = flow.indexOf('Okay, now let’s talk to Jewel and get started on your ideas — let’s start with the background.');
assert(promptLineFlowAt > animAt, 'the prompt line stands under the examples — the examples and the line together prompt the creator into Jewel');
assert(flow.includes('Flat — a still, artistic backdrop'), 'the still example carries the flat tag, as in the project');
assert(flow.includes('Animated — it moves and loops'), 'the animated example carries the animated tag, as in the project');
assert(flow.includes('Example · a pictured classroom backdrop'), 'the classroom still example is captioned as a classroom backdrop');
assert(flow.includes('Example · a pictured talk-show stage'), 'the talk-show still example is captioned as a talk-show stage');
assert(flow.includes('Example · an animated classroom backdrop, playing'), 'the classroom animated example is captioned as a classroom backdrop');
assert(flow.includes('Example · an animated talk-show backdrop, playing'), 'the talk-show animated example is captioned as a talk-show backdrop');
assert(!choiceStep.includes('/redesign/kind-'), 'no background examples stand on the choice step — they belong below the title and subject');
console.log('PASS: both branch start screens carry the still and animated background examples below the title and subject, branch-correct, above the prompt line.');

// 14. Jewel keeps the backdrop rule (Jessica, 2026-11-24): a
// livestream background is a backdrop, not a studio set —
// furniture-free (no desks, chairs, sofas or tables baked into the
// backdrop) and framed close, the backdrop surface filling the
// frame rather than a wide shot of an empty room, because these
// are live streams, not studio shows. The rule stands in the
// shared generation guidance — composed into every Jewel prompt,
// so it holds site-wide when she creates backgrounds — and in the
// talk addendum's background bullet, which both branch framings
// are built on (section 7 pins that composition).
assert(route.includes('BACKGROUNDS ARE BACKDROPS, NOT STUDIO SETS'), 'the shared generation guidance carries the backdrop rule');
assert(route.includes('no desks, chairs, sofas or tables baked into the backdrop'), 'the shared rule names the furniture to keep out of the backdrop');
assert(route.includes('the backdrop surface filling the frame with at most a sliver of floor'), 'the shared rule frames the backdrop close');
assert(route.includes('Frame the backdrop itself like a backdrop, not a studio set: furniture-free'), 'the talk background bullet carries the backdrop rule — both branches build on it');
assert(route.includes('never a wide shot of an empty room; these are live streams, not studio shows'), 'the talk rule gives the reason in Jessica\'s words');
console.log('PASS: Jewel keeps the backdrop rule — furniture-free, framed close, in the shared generation guidance and the talk addendum alike.');

console.log('PASS: talk create flow — branch question first, branch stored, no pieces step, live for all users, background first, free movement.');
