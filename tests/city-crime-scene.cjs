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

// 16. Inline media + Jewel wiring: helper generated-media keys, mystery
// patch merging (Jewel case edits), attach validation (Jewel media attach),
// and the hardened image poller the editor's Generate buttons use.
const { mergeCityCrimeSceneMysteryPatch, checkedCcssAttach, ccssMediaAttachPatch } = ccssLib;
const { pollForGeneratedImageUrl } = require('./load.cjs')('lib/poll-generated-image.ts');
const ccssMediaLib = require('./load.cjs')('lib/city-crime-scene-media.ts');

// 16a. Helper portrait/video keys survive normalization alongside mediaKey.
const helperCfg = readCityCrimeSceneConfig({ mystery: { helperWitnesses: [{ id: 'hh', name: 'Hattie', role: 'Usher', description: 'd', info: 'i', giftToUnlock: 'Rose', mediaKey: 'upload.jpg', portraitKey: 'projects/p/portrait.jpg', videoKey: 'projects/p/intro.mp4' }] } });
const hh = helperCfg.helperWitnesses.find(w => w.id === 'hh');
assert(hh && hh.portraitKey === 'projects/p/portrait.jpg' && hh.videoKey === 'projects/p/intro.mp4' && hh.mediaKey === 'upload.jpg', 'helper portrait/video keys round-trip through normalization');
console.log('PASS: helper generated portrait/video keys normalize and round-trip.');

// 16b. Mystery patch merge: field-level merge, scalar replace, append,
// guilty clearing, and problem reporting — without mutating the input.
const otherId = sample.suspects.find(s => !s.isGuilty).id;
const baseSnapshot = JSON.stringify(sample);
const merged1 = mergeCityCrimeSceneMysteryPatch(sample, { suspects: [{ id: otherId, alibi: 'A brand-new alibi.' }] });
assert.equal(merged1.problems.length, 0, 'clean patch reports no problems: ' + merged1.problems.join(' | '));
const patchedSuspect = merged1.config.suspects.find(s => s.id === otherId);
assert.equal(patchedSuspect.alibi, 'A brand-new alibi.', 'patched field replaced');
assert.equal(patchedSuspect.potentialMotive, sample.suspects.find(s => s.id === otherId).potentialMotive, 'omitted fields preserved exactly');
assert.equal(merged1.config.suspects.length, sample.suspects.length, 'no suspects added or lost');
const merged2 = mergeCityCrimeSceneMysteryPatch(sample, { title: 'Renamed Case' });
assert.equal(merged2.config.title, 'Renamed Case', 'scalar fields replace');
assert.equal(merged2.config.crime, sample.crime, 'other scalars preserved');
const merged3 = mergeCityCrimeSceneMysteryPatch(sample, { timeline: [{ id: 't-new', time: '11 PM', event: 'A late arrival.' }] });
assert(merged3.config.timeline.some(t => t.id === 't-new'), 'a patch item with a new id is appended');
const merged4 = mergeCityCrimeSceneMysteryPatch(sample, { suspects: [{ id: otherId, isGuilty: true }] });
assert.equal(merged4.config.suspects.filter(s => s.isGuilty).length, 1, 'marking a new guilty clears the old one');
assert.equal(merged4.config.suspects.find(s => s.isGuilty).id, otherId);
assert.equal(merged4.problems.length, 0);
const merged5 = mergeCityCrimeSceneMysteryPatch(sample, { suspects: [{ id: guiltyId, isGuilty: false }] });
assert(merged5.problems.length > 0, 'a patch that leaves no guilty suspect reports problems');
const merged6 = mergeCityCrimeSceneMysteryPatch(sample, { clues: [{ id: sample.clues[0].id, relatedSuspectIds: [] }] });
assert(merged6.problems.length > 0, 'a patch that breaks a clue reports problems');
const merged7 = mergeCityCrimeSceneMysteryPatch(sample, 'not-an-object');
assert(merged7.problems.length > 0, 'a non-object patch reports problems instead of throwing');
assert.equal(JSON.stringify(sample), baseSnapshot, 'merging never mutates the existing case');
console.log('PASS: mystery patch merge preserves, replaces, appends, clears guilt, and reports invalid results.');

// 16c. Attach validation: only real CCS tools, real items, allowed fields.
const attachProject = { gameTools: [{ id: 'tool-ccs', type: 'city-crime-scene', config: { mystery: sample } }, { id: 'tool-wheel', type: 'wheel', config: {} }] };
const locId = sample.locations[0].id, clueId = sample.clues[0].id, susId = sample.suspects[0].id, fbId = sample.flashbacks[0].id, helpId = sample.helperWitnesses[0].id;
assert.deepEqual(JSON.parse(JSON.stringify(checkedCcssAttach({ toolId: 'tool-ccs', kind: 'location', itemId: locId, field: 'imageKey' }, attachProject))), { toolId: 'tool-ccs', kind: 'location', itemId: locId, field: 'imageKey', mediaKind: 'image' });
assert.equal(checkedCcssAttach({ toolId: 'tool-ccs', kind: 'clue', itemId: clueId, field: 'cutSceneVideoKey' }, attachProject).mediaKind, 'video');
assert.equal(checkedCcssAttach({ toolId: 'tool-ccs', kind: 'clue', itemId: clueId, field: 'audioKey' }, attachProject).mediaKind, 'audio');
assert.equal(checkedCcssAttach({ toolId: 'tool-ccs', kind: 'suspect', itemId: susId, field: 'guideVideoKey' }, attachProject).mediaKind, 'video');
assert.equal(checkedCcssAttach({ toolId: 'tool-ccs', kind: 'flashback', itemId: fbId, field: 'videoKey' }, attachProject).mediaKind, 'video');
assert.equal(checkedCcssAttach({ toolId: 'tool-ccs', kind: 'helper', itemId: helpId, field: 'portraitKey' }, attachProject).mediaKind, 'image');
assert.throws(() => checkedCcssAttach({ toolId: 'tool-ccs', kind: 'location', itemId: locId, field: 'videoKey' }, attachProject), /not a media field for a location/, 'a field from another kind is refused');
assert.throws(() => checkedCcssAttach({ toolId: 'tool-wheel', kind: 'location', itemId: locId, field: 'imageKey' }, attachProject), /could not be found in this project/, 'a non-CCS tool is refused');
assert.throws(() => checkedCcssAttach({ toolId: 'tool-ccs', kind: 'clue', itemId: 'missing', field: 'audioKey' }, attachProject), /not part of this case/, 'a missing item is refused');
assert.throws(() => checkedCcssAttach({ toolId: 'tool-ccs', kind: 'witness', itemId: 'x', field: 'mediaKey' }, attachProject), /Choose where in the case/, 'an unknown kind is refused');
assert.throws(() => checkedCcssAttach({ toolId: 'tool-ccs', kind: 'helper', itemId: helpId, field: 'mediaKey' }, attachProject), /not a media field for a helper/, 'the host upload field is never a generation target');
assert.deepEqual(JSON.parse(JSON.stringify(ccssMediaAttachPatch({ toolId: 'tool-ccs', kind: 'clue', itemId: clueId, field: 'cutSceneVideoKey' }, 'projects/p/cut.mp4'))), { gameTools: [{ id: 'tool-ccs', config: { mystery: { clues: [{ id: clueId, cutSceneVideoKey: 'projects/p/cut.mp4' }] } } }] }, 'attach patch targets exactly one item field');
console.log('PASS: attach validation accepts every real slot and refuses wrong tools, items, kinds, and fields.');

// 17. Helper voice is the builder's explicit choice ONLY (Jessica, 2026-10-26):
// a clue helper has a voice only when the builder picks one. Nothing may
// require it, default it, or fail validation over it.
const helperVoiceProblems = (problems) => problems.filter(m => /helper/i.test(m) && /voice/i.test(m));
const voicelessCase = JSON.parse(JSON.stringify(sample));
voicelessCase.helperWitnesses.forEach(h => { delete h.voice; });
assert.equal(helperVoiceProblems(validateCityCrimeScene(voicelessCase)).length, 0, 'coherence validation never faults a helper for having no voice: ' + validateCityCrimeScene(voicelessCase).join(' | '));
assert.equal(helperVoiceProblems(validateCityCrimeSceneStandards(voicelessCase)).length, 0, 'standards validation never faults a helper for having no voice: ' + validateCityCrimeSceneStandards(voicelessCase).join(' | '));
console.log('PASS: a case whose helpers have no voice raises no voice problem in either validator.');

// 17b. The reader never invents a voice: unset and empty stay unset through
// repeated round-trips — for the sample helpers AND for helpers the defaults
// have never seen (fresh ids) — and no helper gains a named voice.
const voicelessRead = readCityCrimeSceneConfig({ mystery: voicelessCase });
assert(voicelessRead.helperWitnesses.length > 0 && voicelessRead.helperWitnesses.every(h => !h.voice), 'helpers read back voiceless when the builder chose none');
const voicelessRead2 = readCityCrimeSceneConfig({ mystery: JSON.parse(JSON.stringify(voicelessRead)) });
assert(voicelessRead2.helperWitnesses.every(h => !h.voice), 'a second read still substitutes no voice');
const emptyVoiceCase = JSON.parse(JSON.stringify(sample));
emptyVoiceCase.helperWitnesses.forEach(h => { h.voice = ''; });
assert(readCityCrimeSceneConfig({ mystery: emptyVoiceCase }).helperWitnesses.every(h => !h.voice), 'an empty voice stays unset, never a named voice');
const freshHelperCase = JSON.parse(JSON.stringify(sample));
freshHelperCase.helperWitnesses = [{ id: 'help-fresh-1', name: 'Fresh Helper', role: 'Usher', description: 'New here.', info: 'Saw the lights flicker.', howItHelps: 'Narrows the timeline.', giftToUnlock: 'Coffee' }];
assert(readCityCrimeSceneConfig({ mystery: freshHelperCase }).helperWitnesses.every(h => !h.voice), 'a brand-new helper with no voice key at all reads back with no voice');
console.log('PASS: the normalizer round-trips an unset helper voice as unset and never invents one.');

// 17c. A voice the builder DID choose is kept exactly, helper by helper, and
// is itself valid — the explicit-choice path is unchanged.
const chosenVoiceCase = JSON.parse(JSON.stringify(sample));
chosenVoiceCase.helperWitnesses[0].voice = 'Roger';
if (chosenVoiceCase.helperWitnesses[1]) chosenVoiceCase.helperWitnesses[1].voice = 'Aria';
const chosenRead = readCityCrimeSceneConfig({ mystery: chosenVoiceCase });
assert.equal(chosenRead.helperWitnesses[0].voice, 'Roger', 'an explicitly chosen voice survives the read exactly');
if (chosenRead.helperWitnesses[1]) assert.equal(chosenRead.helperWitnesses[1].voice, 'Aria', 'each helper keeps its own explicit choice');
assert.equal(helperVoiceProblems(validateCityCrimeScene(chosenRead)).length, 0, 'a chosen voice is never a validation problem');
console.log('PASS: a helper with an explicitly chosen voice keeps it, untouched.');

// 18. The HOST STAGE (Jessica, 2026-10-26): the host points the spyglass at
// the item in the picture and clicks the item itself. The stage renders the
// same overlay component the audience sees — interactive for the host,
// purely presentational for everyone else — and a stage click must produce
// EXACTLY the live action the host panel's buttons send.
const stageLib = require('./load.cjs')('lib/city-crime-scene-stage.ts');
const { ccssStageInvestigateAction, ccssStageRevealAction, ccssStageMapAction, ccssStageHideAction, ccssStagePostBody, latestCcssStageResult, ccssStageLocationIdFromResult, ccssStageKindFromResult } = stageLib;
const plain = (v) => JSON.parse(JSON.stringify(v));
assert.deepEqual(plain(ccssStageInvestigateAction('loc-bedroom')), { kind: 'investigate', locationId: 'loc-bedroom' }, 'clicking a map card is the investigate action for that location');
assert.deepEqual(plain(ccssStageRevealAction('clue-drawer')), { kind: 'revealClue', clueId: 'clue-drawer' }, 'clicking a hotspot is the revealClue action for its bound clue');
assert.deepEqual(plain(ccssStageMapAction()), { kind: 'map' }, 'stage chrome returns to the map');
assert.deepEqual(plain(ccssStageHideAction()), { kind: 'hide' }, 'stage chrome clears the scene');
assert.deepEqual(plain(ccssStagePostBody('tool-ccs', ccssStageRevealAction('clue-drawer'))), { cityCrimeSceneAction: { toolId: 'tool-ccs', kind: 'revealClue', clueId: 'clue-drawer' } }, 'a stage click body is byte-for-byte the host panel body shape');
assert.deepEqual(plain(ccssStagePostBody('tool-ccs', ccssStageInvestigateAction('loc-bedroom'))), { cityCrimeSceneAction: { toolId: 'tool-ccs', kind: 'investigate', locationId: 'loc-bedroom' } }, 'a stage map click body matches the panel investigate body');
console.log('PASS: stage clicks map to the exact live actions and POST bodies the host panel sends.');

// 18b. The stage reads the same init/since feed the overlay reads and keeps
// the newest outcome for its own tool only.
const feedEvents = [
  { id: 3, controlId: 'tool-other', payload: { outcomes: { 'tool-other': { result: '{"kind":"show"}' } } } },
  { id: 5, controlId: 'tool-ccs', payload: { outcomes: { 'tool-ccs': { result: '{"kind":"map"}' } } } },
  { id: 8, controlId: 'tool-ccs', payload: { outcomes: { 'tool-ccs': { result: '{"kind":"location","location":{"id":"loc-bedroom"}}' } } } },
  { id: 9, controlId: 'tool-ccs', payload: { outcomes: {} } },
];
assert.equal(latestCcssStageResult(feedEvents, 'tool-ccs'), '{"kind":"location","location":{"id":"loc-bedroom"}}', 'the newest outcome for the stage tool wins; empty batches never rewind it');
assert.equal(latestCcssStageResult(feedEvents, 'tool-absent'), null, 'a feed with nothing for the tool yields null');
assert.equal(latestCcssStageResult([], 'tool-ccs'), null, 'an empty feed yields null');
assert.equal(ccssStageLocationIdFromResult('{"kind":"location","location":{"id":"loc-bedroom"}}'), 'loc-bedroom', 'a location outcome tells the stage where it is (for the way back)');
assert.equal(ccssStageLocationIdFromResult('{"kind":"clue","clue":{"id":"clue-drawer"}}'), null, 'a clue outcome is not a location');
assert.equal(ccssStageLocationIdFromResult('not json'), null, 'garbage results carry no location');
assert.equal(ccssStageKindFromResult('{"kind":"clue"}'), 'clue', 'outcome kind reads through');
assert.equal(ccssStageKindFromResult(null), null, 'no result, no kind');
console.log('PASS: the stage feed reader keeps the newest outcome for its tool and knows where the scene is.');

// 18c. Source invariants: interactivity exists ONLY behind the stage flag,
// and the audience path never opts in.
const fsStage = require('node:fs');
const overlaySrc = fsStage.readFileSync('components/CityCrimeSceneOverlay.tsx', 'utf8');
const onClickCount = (overlaySrc.match(/onClick/g) || []).length;
assert.equal(onClickCount, 2, 'the overlay component carries exactly two click handlers — the stage map card and the stage hotspot — and no others');
assert.ok(overlaySrc.includes('onClick={() => onStageAction?.(ccssStageInvestigateAction(l.id))}'), 'the map card click fires investigate for that location');
assert.ok(overlaySrc.includes('onClick={() => onStageAction?.(ccssStageRevealAction(c.id))}'), 'the hotspot click fires revealClue for its bound clue');
assert.ok(overlaySrc.includes('const stage = interactive && !!onStageAction;'), 'both handlers sit behind the stage flag');
assert.ok(overlaySrc.includes('if (stage) return <button key={l.id}'), 'the audience map card stays a plain div; only the stage renders a button');
assert.ok(overlaySrc.includes('if (stage) return <button key={c.id}'), 'the audience hotspot stays a plain div; only the stage renders a button');
const runtimeSrc = fsStage.readFileSync('components/RuntimeActionLayers.tsx', 'utf8');
assert.ok(runtimeSrc.includes('<CityCrimeSceneOverlay tool={tool} result={run.result} assets={assets}/>'), 'the audience runtime renders the overlay with no stage props');
assert.ok(!/CityCrimeSceneOverlay[^>]*interactive/.test(runtimeSrc), 'the audience runtime never enables stage mode');
const audiencePageSrc = fsStage.readFileSync('app/published/[slug]/overlay/page.tsx', 'utf8');
assert.ok(!audiencePageSrc.includes('CityCrimeSceneHostStage') && !audiencePageSrc.includes('onStageAction') && !audiencePageSrc.includes('interactive='), 'the public overlay page never reaches the stage');
const stageSrc = fsStage.readFileSync('components/CityCrimeSceneHostStage.tsx', 'utf8');
assert.ok(stageSrc.includes('"x-host-key": hostKey') && stageSrc.includes('ccssStagePostBody(tool.id, action)'), 'stage clicks POST the panel body with the host key header');
assert.ok(stageSrc.includes('init=1') && stageSrc.includes('since=${cursor}'), 'the stage consumes the same init/since feed as the overlay');
assert.ok(stageSrc.includes('interactive onStageAction='), 'the stage renders the shared overlay in stage mode');
const dashSrc = fsStage.readFileSync('app/published/[slug]/page.tsx', 'utf8');
assert.ok(dashSrc.includes('<CityCrimeSceneHostStage') && dashSrc.includes('assets={project.assets}'), 'the host dashboard mounts the stage with the project assets beside the host panel');
console.log('PASS: stage interactivity is host-only — the audience component, runtime, and page render no handlers and never opt in.');

// 16d. The generation runner refuses an unresolvable helper reference
// instead of silently generating without it.
(async () => {
  await assert.rejects(
    () => ccssMediaLib.generateCcssMedia({ kind: 'image', prompt: 'portrait', name: 'n', referenceKey: 'gone.jpg' }, { projectId: 'p1', registerAsset: () => {}, resolveAssetUrl: async () => undefined }),
    /could not be loaded/,
    'an unresolvable reference fails truthfully rather than falling back'
  );
  console.log('PASS: generation runner never falls back silently when the helper reference cannot load.');

  // 16e. Image poller: transient tolerance, immediate hard failure, failed
  // jobs, deadline honesty, and queue-position progress.
  const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const noSleep = async () => {};
  let calls = 0;
  const flaky = async () => { calls++; if (calls <= 2) throw new Error('network blip'); if (calls === 3) return jsonRes(503, {}); return jsonRes(200, { status: 'completed', url: 'https://cdn.example/img.jpg' }); };
  const url = await pollForGeneratedImageUrl('req-1', 'https://q/status', 'https://q/response', 'nano-banana-2', { fetchImpl: flaky, sleep: noSleep });
  assert.equal(url, 'https://cdn.example/img.jpg', 'poller returns the finished image URL');
  assert.equal(calls, 4, 'transient throws and 5xx are tolerated before success');
  let calls404 = 0;
  await assert.rejects(() => pollForGeneratedImageUrl('r', 's', 'resp', 'm', { fetchImpl: async () => { calls404++; return jsonRes(404, { status: 'error', error: 'request gone' }); }, sleep: noSleep }), /request gone/);
  assert.equal(calls404, 1, 'a non-retryable 4xx throws immediately');
  await assert.rejects(() => pollForGeneratedImageUrl('r', 's', 'resp', 'm', { fetchImpl: async () => jsonRes(200, { status: 'failed', error: 'render exploded' }), sleep: noSleep }), /render exploded/, 'a failed job surfaces its error');
  let tick = 0;
  await assert.rejects(() => pollForGeneratedImageUrl('r', 's', 'resp', 'm', { fetchImpl: async () => jsonRes(200, { status: 'processing' }), sleep: noSleep, now: () => (tick += 61 * 60 * 1000), deadlineMs: 1000 }), /still processing/, 'the deadline reports still-processing instead of success');
  const positions = [];
  let pollCount = 0;
  const queuedUrl = await pollForGeneratedImageUrl('r', 's', 'resp', 'm', { fetchImpl: async () => { pollCount++; return pollCount === 1 ? jsonRes(200, { status: 'in_queue', queuePosition: 3 }) : jsonRes(200, { status: 'completed', url: 'https://cdn.example/q.jpg' }); }, sleep: noSleep, onProgress: p => positions.push(p) });
  assert.equal(queuedUrl, 'https://cdn.example/q.jpg');
  assert(positions.includes(3), 'queue position is reported to the caller');
  console.log('PASS: image poller tolerates transients, fails hard errors at once, and never fakes completion.');

  // 16f. End to end at the draft-edit layer: applyBuildChanges expands a
  // partial Jewel case patch into the full merged case, applies a media
  // attach patch, and refuses an invalid case edit without touching it.
  const buildEdits = require('./load.cjs')('lib/build-edits.ts');
  const fixtureProject = () => ({ id: 'p1', name: 'Fixture', assets: [], controls: [], sequences: [], assetPools: [], gameTools: [{ id: 'ccs1', type: 'city-crime-scene', name: 'Case', config: { mystery: JSON.parse(JSON.stringify(sample)) } }] });
  const okRes = buildEdits.applyBuildChanges(fixtureProject(), { gameTools: [{ id: 'ccs1', config: { mystery: { suspects: [{ id: otherId, alibi: 'Patched alibi.' }] } } }] });
  assert.ok(okRes.applied >= 1, 'clean case patch applies');
  assert.equal(okRes.warnings.length, 0, 'clean case patch warns about nothing: ' + okRes.warnings.join(' | '));
  const afterSuspect = okRes.project.gameTools[0].config.mystery.suspects.find(s => s.id === otherId);
  assert.equal(afterSuspect.alibi, 'Patched alibi.', 'the patch landed');
  assert.equal(afterSuspect.potentialMotive, sample.suspects.find(s => s.id === otherId).potentialMotive, 'the rest of the case survived the shallow-merge layer');
  const badRes = buildEdits.applyBuildChanges(fixtureProject(), { gameTools: [{ id: 'ccs1', config: { mystery: { suspects: [{ id: guiltyId, isGuilty: false }] } } }] });
  assert(badRes.warnings.some(w => /City Crime Scene case edit was not applied/.test(w)), 'an invalid case edit is refused with a warning');
  assert.equal(badRes.project.gameTools[0].config.mystery.suspects.find(s => s.id === guiltyId).isGuilty, true, 'a refused edit leaves the case untouched');
  const attRes = buildEdits.applyBuildChanges(fixtureProject(), ccssMediaAttachPatch({ toolId: 'ccs1', kind: 'location', itemId: locId, field: 'imageKey' }, 'projects/p1/scene.jpg'));
  assert.equal(attRes.warnings.length, 0, 'attach patch applies cleanly: ' + attRes.warnings.join(' | '));
  assert.equal(attRes.project.gameTools[0].config.mystery.locations.find(l => l.id === locId).imageKey, 'projects/p1/scene.jpg', 'generated media key lands on the case item');
  console.log('PASS: applyBuildChanges expands CCS mystery patches, refuses invalid ones, and applies media attach patches.');
  console.log('ALL CITY CRIME SCENE TESTS PASSED');
})().catch(err => { console.error(err); process.exit(1); });
