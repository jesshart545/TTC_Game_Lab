const assert = require('node:assert/strict');
const { cityCrimeSceneDefaults, readCityCrimeSceneConfig, sanitizeCityCrimeSceneForOverlay, validateCityCrimeScene, splitCourtroomEvidence, canUseCityCrimeScene, stripCityCrimeSceneTools, accusationVerdict } =
  require('./load.cjs')('lib/city-crime-scene.ts');

// 1. Sample defaults are internally consistent.
const sample = cityCrimeSceneDefaults();
assert.equal(validateCityCrimeScene(sample).length, 0, 'sample defaults must validate clean: ' + validateCityCrimeScene(sample).join(' | '));
console.log('PASS: sample City Crime Scene validates clean.');

// 2. Sanitizer strips every host-only field, deeply.
const pub = sanitizeCityCrimeSceneForOverlay(sample);
const dumped = JSON.stringify(pub);
const secrets = [
  sample.actualCrimeDetails,
  ...sample.twists.map(t => t.title), ...sample.twists.map(t => t.description),
  ...sample.suspects.map(s => s.demeanor), ...sample.suspects.map(s => s.tells),
  ...sample.suspects.map(s => s.extraInfo), ...sample.suspects.flatMap(s => s.questions),
];
for (const secret of secrets) {
  assert(secret && !dumped.includes(secret), 'sanitized config must not contain host-only text: ' + String(secret).slice(0, 60));
}
assert(!/isGuilty/.test(dumped), 'sanitized config must not contain isGuilty');
assert(!/actualCrimeDetails/.test(dumped), 'sanitized config must not contain actualCrimeDetails');
assert(!/"twists"/.test(dumped), 'sanitized config must not contain twists');
// Public fields survive.
assert(pub.suspects.length === 4, 'public suspects preserved');
assert(pub.suspects[0].potentialMotive && pub.suspects[0].alibi && pub.suspects[0].characterBrief, 'public suspect fields preserved');
assert(pub.clues.length === 3 && pub.locations.length === 2, 'public clues/locations preserved');
assert(pub.witnessStatements.length === 3 && pub.helperWitnesses.length === 2, 'public witnesses preserved');
console.log('PASS: sanitizer strips all host-only fields and keeps public ones.');

// 3. Validation catches coherence breaks.
const broken = (fn) => { const c = JSON.parse(JSON.stringify(sample)); fn(c); return validateCityCrimeScene(c); };
assert(broken(c => c.suspects.forEach(s => s.isGuilty = false)).some(m => /guilty/i.test(m)), 'zero guilty caught');
assert(broken(c => { c.suspects[0].isGuilty = true; }).some(m => /exactly one/i.test(m)), 'multiple guilty caught');
assert(broken(c => { c.clues[0].relatedSuspectIds = []; }).some(m => /no related suspects/i.test(m)), 'empty relatedSuspectIds caught');
assert(broken(c => { c.clues[0].relatedSuspectIds = ['nope']; }).some(m => /unknown suspect/i.test(m)), 'unknown suspect ref caught');
assert(broken(c => { c.clues[0].locationId = 'nowhere'; }).some(m => /unknown location/i.test(m)), 'unknown location ref caught');
assert(broken(c => { c.suspectCount = 7; }).some(m => /cast size/i.test(m)), 'suspectCount mismatch caught');
assert(broken(c => { c.clues = c.clues.filter(x => x.locationId !== 'loc-stage'); }).some(m => /no clues/i.test(m)), 'location without clues caught');
assert(broken(c => { c.suspects[1].potentialMotive = ''; }).some(m => /motive/i.test(m)), 'missing motive caught');
assert(broken(c => { c.twists = []; }).some(m => /twist/i.test(m)), 'missing twist caught');
console.log('PASS: validator catches zero/multiple guilty, bad clue refs, cast mismatch, and missing content.');

// 4. Defensive config reading.
const partial = readCityCrimeSceneConfig({ mystery: { title: 'Custom', detectiveCount: 2 } });
assert.equal(partial.title, 'Custom');
assert.equal(partial.detectiveCount, 2);
assert(partial.suspects.length > 0 && partial.clues.length > 0, 'missing arrays fall back to defaults');
console.log('PASS: config reader merges partial configs over defaults.');

// 5. Courtroom evidence split.
const guiltyId = sample.suspects.find(s => s.isGuilty).id;
const split = splitCourtroomEvidence(sample, sample.clues.map(c => c.id), guiltyId);
assert(split.pointingAt.length > 0, 'some evidence points at the defendant');
assert(split.pointingAt.every(c => sample.clues.find(x => x.id === c.id).relatedSuspectIds.includes(guiltyId)), 'pointing-at split is exact');
assert(split.pointedElsewhere.every(c => !sample.clues.find(x => x.id === c.id).relatedSuspectIds.includes(guiltyId)), 'pointed-elsewhere split is exact');
assert.equal(split.pointingAt.length + split.pointedElsewhere.length, 3, 'split covers all revealed clues');
console.log('PASS: courtroom evidence splits defendant vs elsewhere correctly.');

// 5. Entitlement: only the two designated accounts can build with City Crime Scene.
assert(canUseCityCrimeScene('biscoe1972@gmail.com'), 'biscoe1972@gmail.com entitled');
assert(canUseCityCrimeScene('ladylovelace0627@gmail.com'), 'ladylovelace0627@gmail.com entitled');
assert(canUseCityCrimeScene('BISCOE1972@GMAIL.COM'), 'entitlement is case-insensitive');
assert(!canUseCityCrimeScene('someone@example.com'), 'random account not entitled');
assert(!canUseCityCrimeScene(''), 'empty email not entitled');
assert(!canUseCityCrimeScene(null) && !canUseCityCrimeScene(undefined), 'missing email not entitled');
console.log('PASS: entitlement gate allows only the two designated accounts.');

// 6. Save-time backstop strips the tool for non-entitled saves.
const withTool = { gameTools: [{ id: 'a', type: 'city-crime-scene' }, { id: 'b', type: 'wheel' }] };
const stripped = stripCityCrimeSceneTools(withTool);
assert(stripped.gameTools.length === 1 && stripped.gameTools[0].type === 'wheel', 'tool stripped');
assert(withTool.gameTools.length === 2, 'original untouched');
assert(stripCityCrimeSceneTools({ gameTools: [{ id: 'b', type: 'wheel' }] }).gameTools.length === 1, 'no-op when absent');
console.log('PASS: save-time backstop strips City Crime Scene tools.');

// 7. Accusation verdict: correct only for the true guilty party; never leaks identity on wrong.
const guiltySuspect = sample.suspects.find(s => s.isGuilty);
const innocent = sample.suspects.find(s => !s.isGuilty);
const vRight = accusationVerdict(sample, guiltySuspect.id);
assert(!('error' in vRight) && vRight.correct === true && vRight.accusedName === guiltySuspect.name, 'correct accusation verdict');
const vWrong = accusationVerdict(sample, innocent.id);
assert(!('error' in vWrong) && vWrong.correct === false, 'wrong accusation verdict');
assert(!JSON.stringify(vWrong).includes(guiltySuspect.name), 'wrong verdict never names the real culprit');
assert('error' in accusationVerdict(sample, 'nobody'), 'unknown suspect errors');
console.log('PASS: accusation verdict judges correctly without leaking guilt.');
console.log('ALL CITY CRIME SCENE TESTS PASSED');
