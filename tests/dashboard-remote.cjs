const assert = require('node:assert/strict');
const fs = require('node:fs');

// The dashboard as a remote control (Jessica, 2026-11-04): "The
// dashboard shouldn't look like some flat black and white screen —
// it should look and function like a remote control to power the
// overlay." The Set the Stage dashboard review and the published
// host dashboard share ONE remote treatment —
// components/DashboardRemote.tsx + dashboard-remote.css — so the
// remote the creator rehearses on is the remote the host holds
// live. These contracts pin the sharing, the framing, and the
// preservation of every pre-existing control.

const review = fs.readFileSync('components/StageReview.tsx', 'utf8');
const published = fs.readFileSync('app/published/[slug]/page.tsx', 'utf8');
const remote = fs.readFileSync('components/DashboardRemote.tsx', 'utf8');
const css = fs.readFileSync('components/dashboard-remote.css', 'utf8');
const buildSpace = fs.readFileSync('components/BuildSpace.tsx', 'utf8');

// One remote, two surfaces — shared, never forked.
assert(remote.includes('export function RemoteTopBar') && remote.includes('export function controlGlyph'), 'the shared remote module offers the top strip and the glyph mapper');
assert(remote.includes('import "./dashboard-remote.css"'), 'the shared module carries the shared stylesheet');
assert(review.includes('from "./DashboardRemote"'), 'the stage review imports the shared remote');
assert(published.includes('from "../../../components/DashboardRemote"'), 'the published dashboard imports the same shared remote');
assert(published.includes('<section className="dash-remote"><RemoteTopBar name={project.name}/>'), 'the published live controls sit in the remote body under its top strip');
assert(review.includes('className="dash-remote"') && review.includes('<RemoteTopBar name={project.name} />'), 'the review dashboard sits in the same remote body under the same top strip');

// Every pre-existing published control survives the restyle —
// nothing the host had is lost to the new chrome.
for (const marker of ['published-controls', 'control=>!control.sequenceOnly', '>Reset game</button>', 'WheelHostPanel', 'CliffhangerHostPanel', 'CityCrimeSceneHostPanel', 'CityCrimeSceneHostStage', 'QuestionHostPanel', 'PickerHostPanel', 'GameInfoHostPanel', 'YouTubeHostPanel', 'published-trivia-grid', 'Stop sequence'])
  assert(published.includes(marker), `the published dashboard still renders: ${marker}`);
assert(published.includes('<section className="dash-remote-module"><h2>{trivia.name}</h2>'), 'the trivia controls sit in a remote module');
assert(published.includes('<section className="dash-remote-module"><h2>Private YouTube tool</h2>'), 'the YouTube controls sit in a remote module');

// The panels carry the hooks the shared sheet styles.
assert(fs.readFileSync('components/WheelHostPanel.tsx', 'utf8').includes('className="wheel-host"'), 'the wheel panel carries its remote hook');
assert(fs.readFileSync('components/CliffhangerHostPanel.tsx', 'utf8').includes('className="cliffhanger-host"'), 'the cliffhanger panel carries its remote hook');

// The chrome frames the creator's buttons; it never overrides
// them: a key takes a default base COLOR (a saved appearance's
// inline backgroundColor replaces it whole) and its depth from
// shadows — never a background image, or a chosen flat color
// would come out tinted by the chrome.
const keysBlock = css.slice(css.indexOf('.dash-remote .dashboard-preview-buttons .sr-buttonwrap > button,'), css.indexOf('.dash-glyph'));
assert(keysBlock.includes('background-color: #372a63'), 'keys offer a default base color under the creator\'s own');
assert(!keysBlock.includes('background-image') && !keysBlock.includes('linear-gradient'), 'keys carry no background image — a saved flat color stays exactly that color');
assert(keysBlock.includes(':active') && keysBlock.includes('translateY(3px)'), 'a press travels — the tactile half of the remote');
assert(css.includes('[aria-pressed="true"]'), 'the selected key stays lit in the review');
assert(css.includes('.dash-remote-led') && css.includes('.dash-screen'), 'the remote has its power light and its display screen');
assert(css.includes('.build-reset-row > button::before') && css.includes('.published-reset > button::before'), 'Reset wears the power glyph on both surfaces');

// Scope: Build Space is a different component (radio/multiplayer
// stage 1) and does not take the remote.
assert(!buildSpace.includes('dash-remote') && !buildSpace.includes('DashboardRemote'), 'Build Space does not take the remote — radio/multiplayer dashboards keep their look');

console.log('PASS: dashboard remote — one shared remote across the review and the published dashboard; every control preserved; Build Space untouched.');
