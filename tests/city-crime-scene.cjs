const assert = require('node:assert/strict');
const ccssLib = require('./load.cjs')('lib/city-crime-scene.ts');
const { cityCrimeSceneDefaults, readCityCrimeSceneConfig, sanitizeCityCrimeSceneForOverlay, validateCityCrimeScene, validateCityCrimeSceneStandards, suggestEvidenceForLocation, generalizedKeyEvidence, ccssUnlocksForRevealedClues, ccssQuestioningOpen, ccssHelperAvailable, splitCourtroomEvidence, canUseCityCrimeScene, stripCityCrimeSceneTools, accusationVerdict, ccssProgress, readCityCrimeSceneLiveState } = ccssLib;

// 1. Sample defaults are internally consistent.
const sample = cityCrimeSceneDefaults();
assert.equal(validateCityCrimeScene(sample).length, 0, 'sample defaults must validate clean: ' + validateCityCrimeScene(sample).join(' | '));
console.log('PASS: sample City Crime Scene validates clean.');

// 1b. Opening character cards: every suspect has an occupation (what they do).
assert(sample.suspects.every(s => s.occupation && s.occupation.trim()), 'every default suspect has an occupation for the opening card');
assert(sample.flashbacks.length >= 2, 'default case has crime flashbacks');
console.log('PASS: suspects carry occupations and the case has flashbacks.');

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
assert(pub.suspects[0].occupation, 'public suspect occupation preserved for the opening card');
assert(pub.clues.length === 3 && pub.locations.length === 2, 'public clues/locations preserved');
assert(pub.flashbacks.length >= 2 && pub.flashbacks[0].title && pub.flashbacks[0].description, 'public flashbacks preserved (no host-only text)');
assert(pub.witnesses.length === 3 && pub.witnesses[0].name && pub.witnesses[0].statement, 'public required witnesses preserved');
assert(pub.helperWitnesses.length === 2, 'public helper witnesses preserved');
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
assert(broken(c => { c.suspects[1].occupation = ''; }).some(m => /occupation/i.test(m)), 'missing occupation caught');
assert(broken(c => { c.twists = []; }).some(m => /twist/i.test(m)), 'missing twist caught');
// Flashback fairness: every suspect must appear in at least one clue or flashback.
assert(broken(c => { const id = c.suspects[0].id; c.clues.forEach(x => x.relatedSuspectIds = x.relatedSuspectIds.filter(s => s !== id)); c.flashbacks.forEach(x => x.relatedSuspectIds = x.relatedSuspectIds.filter(s => s !== id)); }).some(m => /no clue or flashback/i.test(m)), 'unimplicated suspect caught');
assert(broken(c => { c.flashbacks[0].relatedSuspectIds = []; }).some(m => /no related suspects/i.test(m)), 'flashback without suspects caught');
assert(broken(c => { c.flashbacks[0].relatedSuspectIds = ['nope']; }).some(m => /unknown suspect/i.test(m)), 'flashback unknown suspect caught');
console.log('PASS: validator catches zero/multiple guilty, bad clue refs, cast mismatch, missing content, and flashback fairness breaks.');

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

// 8. Accusation gate: clues + introduced + questioned + required witnesses heard.
//    Optional helpers NEVER block the accusation.
const gate = (fn) => {
  const c = JSON.parse(JSON.stringify(sample));
  const state = readCityCrimeSceneLiveState({});
  state.revealedClueIds = c.clues.map(x => x.id);
  state.introducedSuspectIds = c.suspects.map(x => x.id);
  state.questionedSuspectIds = c.suspects.map(x => x.id);
  state.heardWitnessIds = c.witnesses.map(x => x.id);
  state.unlockedHelperIds = c.helperWitnesses.map(x => x.id);
  if (fn) fn(c, state);
  return ccssProgress(c, state);
};
assert(gate().complete === true, 'full investigation unlocks the accusation');
assert(gate((c, s) => { s.unlockedHelperIds = []; }).complete === true, 'helpers unlocked or not, the gate stays open');
assert(gate((c, s) => { s.questionedSuspectIds = s.questionedSuspectIds.slice(1); }).complete === false, 'unquestioned suspect keeps the gate closed');
assert(gate((c, s) => { s.heardWitnessIds = s.heardWitnessIds.slice(1); }).complete === false, 'unheard required witness keeps the gate closed');
assert(gate((c, s) => { s.introducedSuspectIds = []; }).complete === false, 'unintroduced suspect keeps the gate closed');
assert(gate((c, s) => { s.revealedClueIds = []; }).complete === false, 'missing clues keep the gate closed');
const gateFull = gate();
assert(gateFull.helpers === 2 && gateFull.helpersTotal === 2, 'helpers are reported in progress');
// Legacy payloads (unlockedWitnessIds) still read.
const legacy = readCityCrimeSceneLiveState({ unlockedWitnessIds: ['wit-tommy'] });
assert(legacy.unlockedHelperIds.includes('wit-tommy'), 'legacy unlockedWitnessIds migrate to helpers');
console.log('PASS: accusation gate requires clues, introduction, questioning, and required witnesses — helpers never block.');

// 9. Legacy witness statements migrate to structured required witnesses.
const legacyCfg = readCityCrimeSceneConfig({ mystery: { witnessStatements: ['DOORMAN: "I saw nothing."'] } });
assert(legacyCfg.witnesses.length === 1 && legacyCfg.witnesses[0].statement.includes('I saw nothing'), 'legacy strings become witness statements');
assert(validateCityCrimeScene(legacyCfg).some(m => /witness.*name/i.test(m)), 'migrated witness without a name is flagged');
const namedWitness = JSON.parse(JSON.stringify(sample));
namedWitness.witnesses[0].statement = '';
assert(validateCityCrimeScene(namedWitness).some(m => /statement/i.test(m)), 'witness without statement is flagged');
console.log('PASS: legacy witness statements migrate and validate.');

// 10. Roles are fixed by the case file: there is no role-move conversion, and
// editing + re-saving a case can never shift guilt off the character the host marked.
for (const fn of ['suspectToWitness', 'witnessToSuspect', 'suspectToHelper', 'helperToSuspect', 'witnessToHelper', 'helperToWitness']) {
  assert(!(fn in ccssLib), 'role-move function must not exist: ' + fn);
}
const guiltyBefore = sample.suspects.find(s => s.isGuilty);
const recast = JSON.parse(JSON.stringify(sample));
recast.suspects.reverse();
const editedSuspect = recast.suspects.find(s => s.id === guiltyBefore.id);
editedSuspect.name = 'Renamed By Host';
editedSuspect.occupation = 'New occupation';
editedSuspect.characterBrief = 'A rewritten brief.';
const reread = readCityCrimeSceneConfig({ mystery: recast });
assert(reread.suspects.filter(s => s.isGuilty).length === 1, 'exactly one guilty after edits, reorder, and re-save');
assert(reread.suspects.find(s => s.isGuilty).id === guiltyBefore.id, 'guilt stays on the same character after edits and re-save');
assert(sample.witnesses.every(w => !('isGuilty' in w)) && sample.helperWitnesses.every(w => !('isGuilty' in w)), 'witness and helper records carry no guilt field');
console.log('PASS: roles are fixed by the case file — edits and re-saves never shift guilt.');

// 11. Clue-card fields, gender/ethnicity, and the 5-minute interrogation default.
const pubCard = sanitizeCityCrimeSceneForOverlay(sample).suspects[0];
assert(pubCard.age && pubCard.knownFor && pubCard.personality && pubCard.quote, 'public suspect keeps clue-card fields');
assert('gender' in pubCard && 'ethnicity' in pubCard, 'public suspect carries structured gender/ethnicity');
assert.equal(sample.interrogationSeconds, 300, 'interrogation timer defaults to 5 minutes (300s)');
const legacySuspect = JSON.parse(JSON.stringify(sample));
delete legacySuspect.suspects[0].age; delete legacySuspect.suspects[0].gender; delete legacySuspect.suspects[0].ethnicity;
delete legacySuspect.clues[0].summary; delete legacySuspect.clues[0].hotspot; delete legacySuspect.helperWitnesses[0].howItHelps;
const migrated = readCityCrimeSceneConfig({ mystery: legacySuspect });
assert.equal(migrated.suspects[0].age, '', 'missing card fields migrate to empty strings');
assert.equal(migrated.suspects[0].gender, '', 'missing gender migrates to empty string');
assert.equal(migrated.clues[0].summary, '', 'missing clue summary migrates to empty string');
assert.equal(migrated.helperWitnesses[0].howItHelps, '', 'missing helper howItHelps migrates to empty string');
// Thin content fails loudly: no empty evidence, no incomplete helpers, no card gaps.
assert(broken(c => { c.clues[0].description = ''; }).some(m => /no description/i.test(m)), 'empty clue description caught');
assert(broken(c => { c.clues[0].summary = ''; }).some(m => /generalized summary/i.test(m)), 'missing clue summary caught');
assert(broken(c => { c.clues[0].hotspot = ''; }).some(m => /clickable item/i.test(m)), 'unbound clue caught');
assert(broken(c => { c.helperWitnesses[0].howItHelps = ''; }).some(m => /how their information helps/i.test(m)), 'helper without howItHelps caught');
assert(broken(c => { c.helperWitnesses[0].info = ''; }).some(m => /no information to reveal/i.test(m)), 'helper without info caught');
assert(broken(c => { c.suspects[0].quote = ''; }).some(m => /signature quote/i.test(m)), 'suspect without quote caught');
assert(broken(c => { c.clues[0].unlocksSuspectId = 'nobody'; }).some(m => /unlocks unknown suspect/i.test(m)), 'bad unlock target caught');
console.log('PASS: clue-card fields, gender/ethnicity migration, 300s default, and loud thin-content validation.');

// 12. Map unlocks: only the INITIAL ability — questioning and helper availability.
const st0 = readCityCrimeSceneLiveState({});
assert(ccssQuestioningOpen(sample, st0, 'sus-danny') === true, 'suspect without an unlock clue is open (legacy behavior)');
assert(ccssQuestioningOpen(sample, st0, 'sus-priya') === false, 'suspect with an unlock clue starts locked');
const st1 = readCityCrimeSceneLiveState({ revealedClueIds: ['clue-ledger'] });
assert(ccssQuestioningOpen(sample, st1, 'sus-priya') === true, 'finding the unlock evidence opens questioning');
const unlocks = ccssUnlocksForRevealedClues(sample, ['clue-ledger', 'clue-note']);
assert(unlocks.unlockedSuspectIds.includes('sus-priya') && unlocks.unlockedSuspectIds.includes('sus-elena'), 'unlock derivation covers both unlock clues');
assert(ccssHelperAvailable(sample, st0, 'wit-tommy') === true, 'helper with no availability clue is available from the start');
console.log('PASS: map unlocks grant only the initial ability to question / use a helper.');

// 13. Suspect-facing evidence is generalized only.
const gen = generalizedKeyEvidence(sample, 'sus-priya');
assert(gen.length >= 2 && gen.every(g => g.summary), 'generalized key evidence exists for the suspect card');
const genDump = JSON.stringify(gen);
assert(!genDump.includes('oleander'), 'generalized evidence never carries specific detail (oleander)');
assert(!genDump.includes('$40,000'), 'generalized evidence never carries specific figures');
console.log('PASS: generalized key evidence contains summaries only, never specifics.');

// 14. Design standards: a complete case passes; each thinning is flagged.
const suspect = (id, name) => ({ id, name, occupation: 'Staff', age: '30s', knownFor: 'Known around the club.', personality: 'Distinct and memorable.', quote: 'I had nothing to do with it.', gender: 'Female', ethnicity: 'Black', characterBrief: 'A full brief.', potentialMotive: 'A real reason to look guilty.', alibi: 'A checkable alibi.', demeanor: 'd', tells: 't', extraInfo: 'e', questions: ['Why?'], guideVideoPrompt: 'Noir intro video prompt', isGuilty: id === 's1' });
const clue = (id, loc, extra = {}) => ({ id, title: 'Evidence ' + id, description: 'Specific detail the detective uncovers in play.', summary: 'A generalized hint of what this is.', locationId: loc, cutScenePrompt: 'Cinematic cut scene prompt', hotspot: 'The object on the table', relatedSuspectIds: ['s1', 's2'], ...extra });
const full = {
  title: 'Standards Case', premise: 'Premise.', detectiveCount: 1, suspectCount: 4,
  crime: 'A crime occurred.', actualCrimeDetails: 'The truth.', victim: 'Victim.', backstory: 'Backstory.', plot: 'Plot.',
  locations: [1, 2, 3, 4, 5, 6].map(i => ({ id: 'L' + i, name: 'Location ' + i, description: 'A place in the story.', imagePrompt: 'Noir establishing shot', isCrimeScene: i === 1 || undefined })),
  clues: [
    ...[1, 2, 3, 4].map(i => clue('u' + i, 'L' + i, { unlocksSuspectId: 's' + i, relatedSuspectIds: ['s' + i, 's1'] })),
    ...[1, 2, 3, 4, 5, 6].flatMap(i => [1, 2, 3].map(j => clue('x' + i + '-' + j, 'L' + i))),
    clue('x5-4', 'L5'),
    clue('tp6', 'L6', { turningPoint: true }),
  ],
  flashbacks: [1, 2].map(i => ({ id: 'f' + i, title: 'Flashback ' + i, description: 'A fragment.', videoPrompt: 'Noir video prompt', relatedSuspectIds: ['s1', 's2', 's3', 's4'] })),
  suspects: [1, 2, 3, 4].map(i => suspect('s' + i, 'Suspect ' + i)),
  witnesses: [{ id: 'w1', name: 'Wanda', role: 'Neighbor', statement: 'I heard everything.', locationId: 'L5' }],
  helperWitnesses: [{ id: 'h1', name: 'Helper', role: 'Regular', description: 'A described helper.', info: 'What they reveal.', giftToUnlock: 'Coffee', howItHelps: 'It confirms the timeline.' }],
  timeline: [{ id: 't1', time: '9 PM', event: 'It began.' }],
  twists: [{ id: 'tw', title: 'Twist', description: 'A surprise.', triggerMoment: 'Late.' }],
  caseInsightVideoPrompts: ['Noir insight prompt'],
  interrogationSeconds: 300, courtroomSeconds: 180,
};
assert.equal(validateCityCrimeSceneStandards(full).length, 0, 'complete case meets the standards: ' + validateCityCrimeSceneStandards(full).join(' | '));
const std = (fn) => { const c = JSON.parse(JSON.stringify(full)); fn(c); return validateCityCrimeSceneStandards(c); };
assert(std(c => c.locations.forEach(l => delete l.isCrimeScene)).some(m => /crime scene/i.test(m)), 'missing crime scene flagged');
assert(std(c => { c.clues = c.clues.filter(x => x.locationId !== 'L2').concat([clue('only', 'L2')]); }).some(m => /at least 4/i.test(m)), 'location with fewer than 4 evidence pieces flagged');
assert(std(c => c.clues.forEach(x => { if (x.unlocksSuspectId === 's3') delete x.unlocksSuspectId; })).some(m => /no unlock discovery/i.test(m)), 'suspect without unlock discovery flagged');
assert(std(c => c.clues.forEach(x => { if (x.unlocksSuspectId) x.cutScenePrompt = ''; })).some(m => /cut-scene/i.test(m)), 'unlock without cinematic cut scene flagged');
assert(std(c => { c.witnesses = []; }).some(m => /witness account/i.test(m)), 'non-unlock location without witness account or turning point flagged');
assert(std(c => c.locations = c.locations.slice(0, 3)).some(m => /around 6 locations/i.test(m)), 'undersized map flagged');
console.log('PASS: standards validator passes a complete case and flags every thinning.');

// 15. Evidence suggestion list: storyline fit AND location fit, nothing else.
const pitchCfg = readCityCrimeSceneConfig({ mystery: {
  title: 'Alley Case', premise: 'A singer is found dead and the killer fled by car down the back alley.',
  crime: 'Murder after the show.', backstory: 'The getaway car was seen by no one.', victim: 'The singer.', plot: 'Solve it.',
  locations: [
    { id: 'bed', name: 'Upstairs Bedroom', description: 'A small bedroom above the club with a bed and a wardrobe.' },
    { id: 'alley', name: 'Back Alley', description: 'The wet alley behind the club, mud after the rain, by the stage door.' },
  ],
  suspects: [suspect('s1', 'One')], suspectCount: 1,
} });
const bedList = suggestEvidenceForLocation(pitchCfg, 'bed');
assert(!bedList.some(x => x.archetypeId === 'tire-tracks'), 'tire tracks are never offered for an upstairs bedroom');
const alleyList = suggestEvidenceForLocation(pitchCfg, 'alley');
assert(alleyList.some(x => x.archetypeId === 'tire-tracks'), 'tire tracks offered for a back alley when the story involves a car');
assert(alleyList.every(x => x.label && x.hotspot && x.summary && x.detail), 'every suggestion carries label, hotspot, summary, and detail');
console.log('PASS: evidence suggestions are filtered by storyline and location fit.');
console.log('ALL CITY CRIME SCENE TESTS PASSED');
