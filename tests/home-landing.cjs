const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Jessica (2026-11-15): there has always supposed to have been a landing
// HOME page a user comes to BEFORE deciding to enter their personal
// projects library or begin a new project — brand displayed, news of
// features added, upcoming features to look out for, navigation to the
// FAQs and the company Contact Us, a prominent rundown on how to donate
// (not hidden inside somewhere else), and the Tips & Tricks slides. The
// projects grid is a destination (My Projects), not the front door.

// 1. The root route: signed-in lands on HOME, signed-out keeps the
// public landing. The old workspace grid no longer renders at root.
const page = read('app/page.tsx');
assert(page.includes('import HomePage from "./home-page"'), 'root imports the Home page');
assert(page.includes('signedIn ? <HomePage /> : <LandingPage />'), 'signed-in renders Home, signed-out renders the public landing');
assert(!page.includes('<WorkspaceHome />'), 'the projects-grid workspace no longer renders at the root');
console.log('PASS: sign-in lands on Home; the public landing is unchanged.');

// 2. Home carries every section Jessica named.
const home = read('app/home-page.tsx');
assert(home.includes('Turning ideas into experiences'), 'brand tagline on Home');
assert(home.includes('href="/projects"') && home.includes('My Projects'), 'My Projects door leads to the library route');
assert(home.includes('href="/project/new"') && home.includes('New project'), 'New project door leads to the create flow');
assert(home.includes('New on the site'), 'news section present');
for (const title of ['Game Night templates are here', 'Perfect Match deals personal hands', "Plinko's neon board"]) {
  assert(home.includes(title), 'news item present: ' + title);
}
assert(home.includes('Coming soon'), 'coming soon section present');
for (const title of ['Game Night opens to everyone', 'More painted game faces']) {
  assert(home.includes(title), 'coming soon item present: ' + title);
}
console.log('PASS: Home shows brand, both doors, site news, and coming soon.');

// 3. Tips & Tricks slides live on Home via the ONE shared carousel —
// the component and its data stay in workspace-home.tsx (not duplicated).
assert(home.includes('import { TipsCard } from "./workspace-home"'), 'Home imports the shared TipsCard');
assert(home.includes('<TipsCard />'), 'Home renders the Tips & Tricks slides');
assert(!home.includes('One button can do three things'), 'tip data is not duplicated into Home');
const workspace = read('app/workspace-home.tsx');
assert(workspace.includes('export function TipsCard()'), 'TipsCard is exported from its home file for sharing');
assert(workspace.includes('Meet Jewel — your magic wand'), 'the tips data still lives with the shared carousel');
console.log('PASS: Tips & Tricks shows on Home through the shared carousel.');

// 4. Donate is a prominent section on Home, using the existing donate
// mechanism (the same configured link /about and the footers use),
// with the honest fine print — not a footer link, not a submenu.
assert(home.includes('Donate — keep TTC Game Lab free'), 'prominent Donate section heading on Home');
assert(home.includes('process.env.NEXT_PUBLIC_DONATE_URL'), 'Donate uses the configured donate link');
assert(home.includes('https://buy.stripe.com/8x25kwaJhdu23J95UGawo00'), 'Donate falls back to the existing Stripe payment link');
assert(home.includes('tax-deductible'), 'Donate keeps the not-tax-deductible fine print');
assert(home.includes('buy credits'), 'Donate keeps the does-not-buy-credits fine print');
assert(home.includes('href="/about"'), 'Donate section links onward to Who we are');
console.log('PASS: Donate stands on Home as its own section with the existing link.');

// 5. Doors to FAQs and Contact Us — both on the existing /help page.
assert(home.includes('>FAQs<') || home.includes('FAQs'), 'FAQs door present');
assert(home.includes('Contact Us'), 'Contact Us door present');
assert((home.match(/href="\/help"/g) || []).length >= 2, 'FAQ and Contact doors lead to /help');
assert(home.includes('admin@ttcgamelab.com') && home.includes('901-501-6378'), 'Contact door shows the company email and phone');
console.log('PASS: FAQs and Contact Us doors lead to /help.');

// 6. The landing is NOT the projects grid, and carries no assistant:
// no project fetching, no grid markup, no Jewel presence.
assert(!home.includes('/api/projects'), 'Home does not fetch the projects list');
assert(!home.includes('Your projects'), 'Home does not render the Your projects grid heading');
assert(!home.includes('rd-grid') && !home.includes('projectThumbnail'), 'Home renders no project cards');
assert(!home.includes('Jewel'), 'no Jewel panel or presence on the landing Home page');
assert(!home.includes('$'), 'no dollar signs (or amounts) render on Home');
console.log('PASS: Home is a front door, not the projects grid.');

// 7. The projects grid itself is untouched at its own route.
const library = read('app/projects/page.tsx');
assert(library.includes('My Projects'), 'the library route still heads itself My Projects');
assert(library.includes('project-library-grid'), 'the library route still renders the projects grid');
assert(library.includes('href="/project/new"'), 'the library route keeps its New Project door');
console.log('PASS: the projects grid still lives, untouched, at /projects.');

console.log('home-landing: all assertions passed');
