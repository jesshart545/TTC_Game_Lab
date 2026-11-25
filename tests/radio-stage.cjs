const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/project/[id]/page.tsx'), 'utf8');
const stage = fs.readFileSync(path.join(root, 'components/RadioStage.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'components/WorkshopAiPanel.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/jewel/route.ts'), 'utf8');

// Radio, DJ, or Karaoke — Imagine & Create and Set the Stage
// (2026-11-24, slice 2 of the radio build). Stage 0 is radio's own
// light stage (components/RadioStage): Jewel's doorway first, a
// branch-aware heading, her conversation, and the gold library &
// uploads door — no legacy workshop furniture. Stage 1 joins
// gameshow and talk in the review spaces: no Build Space, no
// upload door, no library. Jewel carries a radio addendum that
// knows the branch. Every other kind renders exactly as before.

// 1. Stage 0 routing: radio gets its own stage under the light
// frame; the shared grid never renders a second copy of Jewel's
// panel there, and the Current Task entry guide stands down.
assert(page.includes('import RadioStage from "../../../components/RadioStage";'), 'the page imports RadioStage');
assert(page.includes('const radioCreateView = project.kind === "radio" && workflowStep === 0;'), 'the radio create view is scoped to radio at stage 0');
assert(page.includes('const lightCreateFrame = talkBareFrame || gameshowCreateView || radioCreateView;'), 'radio stage 0 rides the light create frame (bare top, "Save project")');
const radioRenderAt = page.indexOf('{workflowStep === 0 && project.kind === "radio" && (');
assert(radioRenderAt >= 0, 'RadioStage renders for radio at stage 0');
const radioRender = page.slice(radioRenderAt, radioRenderAt + 600);
assert(radioRender.includes('<RadioStage'), 'the render is the RadioStage component');
assert(radioRender.includes('jewelPanel={jewelPanelElement}'), 'RadioStage receives the one Jewel panel');
assert(radioRender.includes('onEnterJewel={enterJewelFromScene}'), 'RadioStage receives the wand-scene entry');
assert(radioRender.includes('onAskJewel={askJewel}'), 'RadioStage receives the ask-Jewel door');
assert(radioRender.includes('showSavedWork: () => openSavedWorkshop(1)'), 'the library door leads to the shared stage-0 library, the PR #177 pattern');
assert(page.includes('talkCreateView || gameshowCreateView || radioCreateView || stageReviewView ? null : jewelPanelElement'), 'the grid does not render a second copy of her panel in the radio create view');
assert(page.includes('entryGuide={talkCreateView || gameshowCreateView || radioCreateView || stageReviewView ? undefined :'), 'no Current Task entry guide stands over the radio create view');
console.log('PASS: radio stage 0 routes to RadioStage under the light frame, one Jewel panel, no entry guide.');

// 2. The legacy workshop furniture is gone for radio stage 0: no
// game-plan form, and the stage component itself carries none of
// the old pieces — no workflow nav, no progress strip, no
// gameshow shelves, no pieces picker, no gameshow form words.
assert(page.includes('{workflowStep === 0 && project.kind !== "talk" && project.kind !== "radio" && <details key="game-plan"'), 'the game-plan form never renders for radio');
// The furniture checks read the component's rendered code (its doc
// comment legitimately names the furniture it replaces).
const stageCode = stage.slice(stage.indexOf('export default function RadioStage'));
assert(!stageCode.includes('ProjectWorkflowNav'), 'RadioStage carries no workflow nav');
assert(!stageCode.includes('jewel-progress'), 'RadioStage carries no progress strip');
assert(!stageCode.includes('BOARD TEMPLATES') && !stageCode.includes('TOOL TEMPLATES'), 'RadioStage carries no template shelves');
assert(!stageCode.includes('SETUP_PIECES') && !stageCode.includes('setupPieces'), 'RadioStage carries no pieces picker');
assert(!stageCode.includes('gamePlan') || stageCode.includes('project.gamePlan?.theme'), 'RadioStage touches the plan only to read the seeded music kind');
assert(!/Rounds|Turns and players|Winning and ties/.test(stageCode), 'no gameshow plan-form words stand on the radio stage');
assert(panel.includes('const radioCreateView = project.kind === "radio" && workflowStep === 0;'), 'the panel computes the radio create view');
assert(panel.includes('const stripWithheld = talkCreateView || gameshowCreateView || radioCreateView || stageReview;'), 'her panel carries no progress strip in the radio create view');
assert(panel.includes('project.kind!=="talk"&&project.kind!=="radio"&&<div id="board-templates"'), 'the board-template shelf never opens in a radio project');
assert(panel.includes('project.kind!=="talk"&&project.kind!=="radio"&&<div id="tool-templates"'), 'the tool-template shelf never opens in a radio project');
console.log('PASS: no game-plan form, nav, progress strip, shelves or pieces picker for radio stage 0.');

// 3. RadioStage composition: Jewel's doorway first, a branch-aware
// heading read from project.radioBranch, pictured example asks,
// her conversation, and the gold library & uploads door.
const wandAt = stageCode.indexOf('<JewelWandScene onEnter={onEnterJewel} />');
const asksAt = stageCode.indexOf('gn-asks');
const panelAt = stageCode.indexOf('{jewelPanel}');
const doorAt = stageCode.indexOf('gsw-library-door');
assert(wandAt >= 0, 'the wand scene doorway stands on the radio stage');
assert(asksAt > wandAt, 'the example asks follow the doorway');
assert(panelAt > asksAt, 'her conversation follows the asks');
assert(doorAt > panelAt, 'the library door follows her conversation');
assert(stageCode.includes('project.radioBranch'), 'the stage reads the branch stored at creation');
assert(stageCode.includes('branch === "karaoke"') && stageCode.includes('"Your karaoke night"'), 'the karaoke branch heads the stage as a karaoke night');
assert(stageCode.includes('branch === "radio-dj"') && stageCode.includes('"Your radio / DJ show"'), 'the radio/DJ branch heads the stage as a radio / DJ show');
assert(stageCode.includes('"Your radio show"'), 'an unset branch still heads the stage as a radio show');
assert(stageCode.includes('project.gamePlan?.theme'), 'the radio/DJ heading shows the kind of music show named at creation');
assert(stageCode.includes('onAskJewel(ask.say)'), 'each example ask puts its request into Jewel\u2019s conversation');
assert(stageCode.includes('Your library &amp; uploads'), 'the gold door reads "Your library & uploads"');
assert(stageCode.includes('className="gsw-demobtn gold gsw-library-door"'), 'the library door is the gold stage door');
assert(stageCode.includes('onClick={() => doors.showSavedWork()}'), 'the gold door opens the library & uploads');
console.log('PASS: RadioStage — doorway first, branch-aware heading, asks, her conversation, gold library door.');

// 4. Set the Stage: radio joins gameshow and talk in the review
// spaces. The review surface renders for it; Build Space and the
// workshop shelf (with its Upload button and library) render only
// outside the review view, so radio stage 1 has neither.
assert(page.includes('const stageReviewView = workflowStep === 1 && (project.kind === "gameshow" || project.kind === "talk" || project.kind === "radio");'), 'the stage-review view covers radio at stage 1');
assert(page.includes('{workflowStep===1 && stageReviewView && <StageReview'), 'the review surface renders for radio at stage 1');
assert(page.includes('{workflowStep===1 && !stageReviewView && <BuildSpace'), 'Build Space renders only outside the review view — radio stage 1 never sees it');
assert(page.includes('{!stageReviewView && <WorkshopAssetsPanel'), 'the workshop shelf (upload door + library) renders only outside the review view — radio stage 1 has neither');
assert(page.includes('stageReview={stageReviewView}'), 'Jewel\u2019s panel receives the review flag in the radio review view');
assert(page.includes('workflowStep !== 2 && !stageReviewView && <details className="workshop-help">'), 'the guide details leave the radio review page too');
console.log('PASS: radio stage 1 is the review composition — no Build Space, no upload door, no library.');

// 5. Jewel's radio addendum: present only for radio projects, in
// both system-prompt compositions, branch-aware, and honest about
// the pieces that do not exist yet.
assert(route.includes('const JEWEL_RADIO_ADDENDUM = `'), 'the route carries the radio addendum');
assert(route.includes('function radioAddendum(project: any): string {'), 'the route computes the radio framing per project');
assert(route.includes('if (!project || project.kind !== "radio") return "";'), 'the radio framing is empty for every other kind');
assert(route.includes('project.radioBranch === "karaoke"'), 'the addendum reads the karaoke branch');
assert(route.includes('project.radioBranch === "radio-dj"'), 'the addendum reads the radio/DJ branch');
assert(route.includes('const radio = radioAddendum(body.project);'), 'the handler computes the radio framing once');
assert(route.includes('+ (body.project?.kind === "multiplayer" ? JEWEL_GAMENIGHT_ADDENDUM : "") + radio + stageReview +'), 'the main composition appends the radio framing');
assert(route.includes('+ (body.project?.kind === "multiplayer" ? JEWEL_GAMENIGHT_ADDENDUM : "") + radio },'), 'the fallback composition appends the radio framing too');
const addendum = route.slice(route.indexOf('const JEWEL_RADIO_ADDENDUM'), route.indexOf('const JEWEL_TALKSHOW_ADDENDUM'));
assert(addendum.includes('PLAYLISTS ARE THE CORE WORK'), 'the addendum names playlists as the core work');
assert(addendum.includes('Every radio show is a music show'), 'the addendum holds the music-show rule');
assert(addendum.includes('talk programs belong to Talk Show projects'), 'the addendum keeps talk programming in Talk Show');
assert(addendum.includes('CUSTOMIZE BY CONVERSATION'), 'the addendum frames customization as conversation with Jewel');
assert(addendum.includes('no break timer, requests and shout-outs board, running order or singer queue tool to add'), 'the addendum names the not-yet-built pieces honestly');
assert(addendum.includes('THE SOUND BOARD AND THE DJ DECK ARE YOUR MUSIC TOOLS'), 'the addendum offers the sound board and DJ deck Jewel can now build (slice 3)');
assert(addendum.includes('Never promise one, never invent a tool type for them'), 'the addendum forbids promising the missing pieces');
assert(route.includes('body.workspaceStage === "build" && (body.project?.kind === "gameshow" || body.project?.kind === "talk" || body.project?.kind === "radio")'), 'the stage-review instruction covers radio at the build stage');
assert(route.includes('SET THE STAGE — REVIEW SPACES (gameshow, talk and radio projects at the build stage)'), 'the stage-review instruction names radio');
console.log('PASS: Jewel\u2019s radio addendum — radio only, both compositions, branch-aware, honest about missing pieces.');

// 6. Other kinds are untouched: their stage selection strings stand
// exactly as before, and the Game Night views are carved out as
// they were.
assert(page.includes('{workflowStep === 0 && project.kind === "gameshow" && ('), 'the gameshow stage render is unchanged');
assert(page.includes('{workflowStep === 0 && project.kind === "talk" && ('), 'the talk stage render is unchanged');
assert(page.includes('const gameshowCreateView = project.kind === "gameshow" && workflowStep === 0;'), 'the gameshow create view definition is unchanged');
assert(page.includes('const talkCreateView = project.kind === "talk" && workflowStep === 0;'), 'the talk create view definition is unchanged');
assert(page.includes('const gameNightCreateView = project.kind === "multiplayer" && workflowStep === 0;'), 'the Game Night create view is unchanged');
assert(page.includes('const gameNightSetView = project.kind === "multiplayer" && workflowStep === 1;'), 'the Game Night set view is unchanged');
assert(route.includes('const JEWEL_TALKSHOW_ADDENDUM = `'), 'the talkshow addendum still stands');
assert(route.includes('const JEWEL_GAMENIGHT_ADDENDUM = `'), 'the game-night addendum still stands');
assert(route.includes('const talk = talkAddendum(body.project);'), 'the talkshow addendum gate is unchanged in effect — talk-only, composed through talkAddendum since the talk branch build');
console.log('PASS: gameshow, talk and multiplayer stage selection and addenda are unchanged.');

console.log('PASS: radio stage — light Imagine & Create, review Set the Stage, radio-aware Jewel.');
