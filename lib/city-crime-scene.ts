/** City Crime Scene: reusable improv whodunnit game format. Law & Order energy. */

export type CityCrimeSceneSuspect = {
  id: string; name: string;
  characterBrief: string; potentialMotive: string; alibi: string;
  demeanor: string; tells: string; extraInfo: string;
  questions: string[];
  guideVideoPrompt: string; guideVideoKey?: string;
  isGuilty: boolean;
};
export type CityCrimeSceneClue = {
  id: string; title: string; description: string;
  locationId: string; cutScenePrompt: string; relatedSuspectIds: string[];
};
export type CityCrimeSceneLocation = { id: string; name: string; description: string; imagePrompt?: string };
export type CityCrimeSceneHelperWitness = {
  id: string; name: string; role: string; description: string;
  info: string; giftToUnlock: string;
  portraitPrompt?: string; videoPrompt?: string; voice?: string;
};
export type CityCrimeSceneTimelineEvent = { id: string; time: string; event: string };
export type CityCrimeSceneTwist = { id: string; title: string; description: string; triggerMoment: string };

export type CityCrimeSceneConfig = {
  title: string; premise: string;
  detectiveCount: 1 | 2; suspectCount: number;
  crime: string; actualCrimeDetails: string; victim: string;
  backstory: string; plot: string;
  locations: CityCrimeSceneLocation[];
  clues: CityCrimeSceneClue[];
  suspects: CityCrimeSceneSuspect[];
  witnessStatements: string[];
  helperWitnesses: CityCrimeSceneHelperWitness[];
  timeline: CityCrimeSceneTimelineEvent[];
  twists: CityCrimeSceneTwist[];
  caseInsightVideoPrompts: string[];
  interrogationSeconds: number; courtroomSeconds: number;
};

/** Public-safe suspect: everything the audience may see. Never guilt, tells, or detective intel. */
export type PublicCityCrimeSceneSuspect = {
  id: string; name: string; characterBrief: string; potentialMotive: string; alibi: string;
  guideVideoPrompt: string; guideVideoKey?: string;
};
export type PublicCityCrimeSceneConfig = Omit<CityCrimeSceneConfig, "suspects" | "actualCrimeDetails" | "twists"> & {
  suspects: PublicCityCrimeSceneSuspect[];
};

const blankSuspect = (id: string, name: string): CityCrimeSceneSuspect => ({
  id, name, characterBrief: "", potentialMotive: "", alibi: "",
  demeanor: "", tells: "", extraInfo: "", questions: ["", "", ""],
  guideVideoPrompt: "", isGuilty: false,
});

export function cityCrimeSceneDefaults(): CityCrimeSceneConfig {
  return {
    title: "City Crime Scene: The Last Set",
    premise: "A beloved jazz club owner is found dead in his locked office after closing. Four people had reason to want him gone — but only one of them did it.",
    detectiveCount: 1, suspectCount: 4,
    crime: "Marcus Reed, 58, owner of The Velvet Note jazz club, was found dead in his office shortly after midnight — slumped at his desk, a half-finished brandy at his elbow. The door was locked from the inside.",
    actualCrimeDetails: "HOST ONLY — THE TRUTH: Priya Raman poisoned Reed's after-show brandy with oleander extract at 11:40 PM, slipping in through the side door while Danny was restocking the bar. Reed discovered her year-long embezzlement that afternoon and confronted her at 9 PM. She unplugged the side-door camera at 11:02 PM on her way back in. The threatening note was written by Reed himself as a publicity stunt — it is a red herring.",
    victim: "Marcus Reed, 58 — owner of The Velvet Note jazz club for 22 years. Charismatic, stubborn, and weeks away from selling the club to a developer.",
    backstory: "The Velvet Note has been the heart of the city's jazz scene for two decades, but money has been tight. Reed recently discovered $40,000 missing from the club's accounts and told someone close to him he knew who took it.",
    plot: "The detective investigates the club's two key locations, uncovers three pieces of physical evidence, and interrogates four suspects — each with a reason to look guilty. When the evidence is compiled, the detective makes an arrest. If the accusation is correct, the case goes to trial.",
    locations: [
      { id: "loc-stage", name: "The Main Stage & Bar", description: "Velvet curtains, a baby grand, and a long mahogany bar. The last set ended at 11:30 PM.", imagePrompt: "Noir jazz club stage and bar at night, empty, moody spotlight, cinematic" },
      { id: "loc-office", name: "Reed's Office", description: "A cramped back office. Desk, decanter, ledger books — and a locked door.", imagePrompt: "Noir detective office interior, desk with brandy decanter and ledger books, venetian blind shadows, cinematic" },
    ],
    clues: [
      { id: "clue-decanter", title: "The Brandy Decanter", description: "The decanter Reed poured from smells faintly of bitter almonds — the signature of oleander. Someone dosed his after-show ritual.", locationId: "loc-office", cutScenePrompt: "Extreme close-up: amber brandy swirling in a crystal decanter, a single oleander petal drifting on the surface. Low strings swell.", relatedSuspectIds: ["sus-priya", "sus-danny"] },
      { id: "clue-ledger", title: "The Torn Ledger Page", description: "A page ripped from the club's ledger shows $40,000 in unaccounted cash over twelve months — and Reed's angry margin note: 'I KNOW.'", locationId: "loc-office", cutScenePrompt: "A gloved hand smooths a torn ledger page under a desk lamp. The camera pushes in on the words 'I KNOW' circled in red.", relatedSuspectIds: ["sus-priya"] },
      { id: "clue-note", title: "The Threatening Note", description: "An angry note in block letters, found crumpled by the stage: 'YOU STOLE MY ACT — YOU'LL PAY.'", locationId: "loc-stage", cutScenePrompt: "Rain-streaked spotlight. A crumpled note unfolds in slow motion: 'YOU STOLE MY ACT — YOU'LL PAY.'", relatedSuspectIds: ["sus-elena", "sus-sam"] },
    ],
    suspects: [
      { id: "sus-elena", name: "Elena Voss", characterBrief: "The club's headliner — a torch singer with a voice like smoke and a temper like gasoline.", potentialMotive: "Reed cut her headline set short two nights running and docked her pay. She threatened him backstage, loudly, in front of witnesses.", alibi: "On stage performing until 11:55 PM — fifty witnesses in the room.", demeanor: "Fiery and theatrical; performs even in conversation.", tells: "Touches her throat when cornered; her accent thickens when she lies.", extraInfo: "She genuinely loved Reed like a father — the fight was about respect, not money. She cries when she talks about him if pressed gently.", questions: ["You threatened Marcus backstage — what exactly did you say to him?", "Who was with you between your last set and midnight?", "That note by the stage — is that your handwriting?"], guideVideoPrompt: "Noir character intro: Elena Voss, torch singer, smoky spotlight, defiant gaze into camera", isGuilty: false },
      { id: "sus-danny", name: "Danny Cole", characterBrief: "The bartender — quick with a pour, quicker with a joke, and three months behind on rent.", potentialMotive: "He owes Reed three months' back rent on the apartment above the club. Reed threatened eviction that very week.", alibi: "Behind the bar all night; the register log and the regulars back him up.", demeanor: "Easygoing, deflects with humor; goes quiet when the rent comes up.", tells: "Polishes the same glass when nervous; avoids eye contact on direct questions.", extraInfo: "He saw Priya near the side door around 11 PM but assumed she was taking out trash. He feels guilty for not mentioning it sooner.", questions: ["Walk me through your night behind the bar, hour by hour.", "Reed threatened to evict you — how did that make you feel?", "Did you see anyone near the office or the side door after 11?"], guideVideoPrompt: "Noir character intro: Danny Cole, bartender, wiping a glass, neon bar glow, uneasy smile", isGuilty: false },
      { id: "sus-priya", name: "Priya Raman", characterBrief: "The club's bookkeeper — precise, soft-spoken, and the only person who truly understands the finances.", potentialMotive: "She has been quietly skimming from the club's accounts for a year. Reed found the discrepancy that afternoon.", alibi: "Claims she left the club at 11:00 PM — but the side-door camera was unplugged at 11:02 PM.", demeanor: "Calm, precise, almost clinical; never raises her voice.", tells: "Straightens objects on any surface; her answers get shorter the closer you get.", extraInfo: "She is the guilty party. She is terrified but disciplined — she will only crack if confronted with the ledger page AND the camera gap together.", questions: ["The ledger shows $40,000 missing. As bookkeeper, how do you explain that?", "You say you left at 11 — then why was the side-door camera unplugged at 11:02?", "Marcus confronted you at 9 PM. What did he say, exactly?"], guideVideoPrompt: "Noir character intro: Priya Raman, bookkeeper, desk lamp glow, ledger in hand, unreadable expression", isGuilty: true },
      { id: "sus-sam", name: "Sam Whitaker", characterBrief: "Owner of the rival club across town — all handshakes and grievances.", potentialMotive: "Reed poached his star act last month. Sam was heard saying 'the Velvet Note won't survive the month.'", alibi: "At his own club across town until 1 AM — his staff and a dozen patrons confirm.", demeanor: "Blustery, big gestures; plays the wronged businessman.", tells: "Laughs too loud at his own jokes; drums his fingers when impatient.", extraInfo: "His alibi is airtight — he was genuinely across town. The note is not his; his threats were always public and performative.", questions: ["You said the Velvet Note wouldn't survive the month — what did you mean?", "Where were you between 11 PM and midnight?", "Did you write the threatening note found by the stage?"], guideVideoPrompt: "Noir character intro: Sam Whitaker, rival club owner, cigar smoke, city lights through blinds", isGuilty: false },
    ],
    witnessStatements: [
      "DOORMAN (Frank): 'Mr. Reed argued with Miss Priya in the office around 9. I heard it through the door — he said something about numbers not adding up.'",
      "WAITRESS (Lucia): 'Miss Elena stormed off stage at 10:30, furious. But she went straight to the green room — I saw her.'",
      "REGULAR (Old Pete): 'Danny never left that bar all night. Poured my whiskey at 11:45 himself.'",
    ],
    helperWitnesses: [
      { id: "wit-tommy", name: "Old Tommy", role: "Piano tuner", description: "Has tuned the club's baby grand for 30 years; sees everything, says little.", info: "Tommy saw Priya come BACK through the side door around 11:15 PM carrying nothing — odd, since she'd 'left' at 11.", giftToUnlock: "Coffee", portraitPrompt: "Noir portrait: elderly Black piano tuner, kind eyes, flat cap, warm practical lighting" },
      { id: "wit-mara", name: "Mara", role: "Coat-check girl", description: "Twenty-two, sharp-eyed, remembers every face.", info: "Mara remembers Sam Whitaker leaving the club at 9:45 PM in a huff — and not coming back. His alibi checks out.", giftToUnlock: "Rose", portraitPrompt: "Noir portrait: young coat-check girl, curious eyes, red scarf, dim cloakroom light" },
    ],
    timeline: [
      { id: "t1", time: "9:00 PM", event: "Reed argues with Priya in his office — the doorman hears 'numbers not adding up.'" },
      { id: "t2", time: "10:30 PM", event: "Reed cuts Elena's set short; she storms off stage to the green room." },
      { id: "t3", time: "11:00 PM", event: "Priya says she leaves for the night. The side-door camera is unplugged at 11:02 PM." },
      { id: "t4", time: "11:30 PM", event: "Last set ends. Danny restocks the bar; the office door stays closed." },
      { id: "t5", time: "12:05 AM", event: "Danny takes Reed his usual nightcap and finds the body. The office door was locked from the inside." },
    ],
    twists: [
      { id: "tw1", title: "The note is a plant", description: "The threatening note was written by Reed himself as a publicity stunt for the weekend crowd — a complete red herring.", triggerMoment: "Deploy when the detective zeroes in on Elena or Sam over the note." },
    ],
    caseInsightVideoPrompts: [
      "Noir case-insight: a detective's corkboard filling with photos and red string, voiceover tone, cinematic",
      "Noir case-insight: rain on a window with the club's neon sign reflected, pensive detective silhouette",
    ],
    interrogationSeconds: 120, courtroomSeconds: 180,
  };
}

/** Read the mystery config out of a tool config, defensively merged over defaults. */
export function readCityCrimeSceneConfig(config: Record<string, unknown>): CityCrimeSceneConfig {
  const raw = (config?.mystery || {}) as Partial<CityCrimeSceneConfig>;
  const d = cityCrimeSceneDefaults();
  const arr = <T>(v: unknown, fb: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fb);
  return {
    title: String(raw.title ?? d.title),
    premise: String(raw.premise ?? d.premise),
    detectiveCount: raw.detectiveCount === 2 ? 2 : 1,
    suspectCount: Math.max(1, Math.min(12, Math.floor(Number(raw.suspectCount) || d.suspectCount))),
    crime: String(raw.crime ?? d.crime),
    actualCrimeDetails: String(raw.actualCrimeDetails ?? d.actualCrimeDetails),
    victim: String(raw.victim ?? d.victim),
    backstory: String(raw.backstory ?? d.backstory),
    plot: String(raw.plot ?? d.plot),
    locations: arr(raw.locations, d.locations),
    clues: arr(raw.clues, d.clues),
    suspects: arr(raw.suspects, d.suspects),
    witnessStatements: arr<string>(raw.witnessStatements, d.witnessStatements).map(String),
    helperWitnesses: arr(raw.helperWitnesses, d.helperWitnesses),
    timeline: arr(raw.timeline, d.timeline),
    twists: arr(raw.twists, d.twists),
    caseInsightVideoPrompts: arr<string>(raw.caseInsightVideoPrompts, d.caseInsightVideoPrompts).map(String),
    interrogationSeconds: Math.max(15, Math.min(3600, Math.floor(Number(raw.interrogationSeconds) || d.interrogationSeconds))),
    courtroomSeconds: Math.max(15, Math.min(3600, Math.floor(Number(raw.courtroomSeconds) || d.courtroomSeconds))),
  };
}

/**
 * Strip every host-only field. The result is safe for the published snapshot,
 * live-event payloads, and the audience overlay. NEVER add secrets here.
 */
export function sanitizeCityCrimeSceneForOverlay(config: CityCrimeSceneConfig): PublicCityCrimeSceneConfig {
  const { actualCrimeDetails: _a, twists: _t, ...rest } = config;
  void _a; void _t;
  return {
    ...rest,
    suspects: config.suspects.map(s => ({
      id: s.id, name: s.name,
      characterBrief: s.characterBrief, potentialMotive: s.potentialMotive, alibi: s.alibi,
      guideVideoPrompt: s.guideVideoPrompt, guideVideoKey: s.guideVideoKey,
    })),
  };
}

/** Narrative-coherence validation. Returns human-readable problems; empty means clean. */
export function validateCityCrimeScene(config: CityCrimeSceneConfig): string[] {
  const problems: string[] = [];
  const suspectIds = new Set(config.suspects.map(s => s.id));
  const locationIds = new Set(config.locations.map(l => l.id));
  const guilty = config.suspects.filter(s => s.isGuilty);
  if (guilty.length === 0) problems.push("No suspect is marked guilty — the host's case file needs exactly one guilty party.");
  if (guilty.length > 1) problems.push(`${guilty.length} suspects are marked guilty (${guilty.map(s => s.name).join(", ")}) — exactly one may be guilty.`);
  if (config.suspects.length !== config.suspectCount)
    problems.push(`Suspect list has ${config.suspects.length} suspects but the cast size is set to ${config.suspectCount}.`);
  // Detective count is not user-configurable — it defaults to 1 and needs no validation.
  if (!config.crime.trim()) problems.push("The crime is empty — the briefing needs it.");
  if (!config.actualCrimeDetails.trim()) problems.push("The host-only actual crime details are empty.");
  const dupes = config.suspects.map(s => s.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) problems.push(`Duplicate suspect ids: ${[...new Set(dupes)].join(", ")}.`);
  for (const clue of config.clues) {
    if (!clue.title.trim()) problems.push("A clue is missing its title.");
    if (!locationIds.has(clue.locationId))
      problems.push(`Clue "${clue.title || clue.id}" points at unknown location "${clue.locationId}".`);
    if (!Array.isArray(clue.relatedSuspectIds) || !clue.relatedSuspectIds.length)
      problems.push(`Clue "${clue.title || clue.id}" has no related suspects — every clue must implicate at least one suspect.`);
    for (const sid of clue.relatedSuspectIds || [])
      if (!suspectIds.has(sid)) problems.push(`Clue "${clue.title || clue.id}" references unknown suspect "${sid}".`);
  }
  for (const loc of config.locations)
    if (!config.clues.some(c => c.locationId === loc.id))
      problems.push(`Location "${loc.name}" has no clues — the detective must find at least one clue in every location.`);
  for (const s of config.suspects) {
    if (!s.name.trim()) problems.push("A suspect is missing a name.");
    if (!s.potentialMotive.trim()) problems.push(`Suspect "${s.name || s.id}" has no potential motive.`);
    if (!s.alibi.trim()) problems.push(`Suspect "${s.name || s.id}" has no alibi.`);
    if (!s.questions.filter(q => String(q || "").trim()).length)
      problems.push(`Suspect "${s.name || s.id}" has no interrogation questions for the detective.`);
  }
  if (config.twists.length < 1) problems.push("Add at least one pre-woven twist for the host to deploy.");
  return problems;
}

/** Split revealed clues for the courtroom: what points at the defendant vs what pointed elsewhere. */
export function splitCourtroomEvidence(config: CityCrimeSceneConfig, revealedClueIds: string[], defendantId: string) {
  const revealed = config.clues.filter(c => revealedClueIds.includes(c.id));
  return {
    pointingAt: revealed.filter(c => c.relatedSuspectIds.includes(defendantId)),
    pointedElsewhere: revealed.filter(c => !c.relatedSuspectIds.includes(defendantId)),
  };
}

/** Accounts entitled to build with City Crime Scene. Overridable via CITY_CRIME_SCENE_EMAILS (comma-separated). */
const DEFAULT_CITY_CRIME_SCENE_EMAILS = ["biscoe1972@gmail.com", "ladylovelace0627@gmail.com"];
export function cityCrimeSceneEmails(): string[] {
  const raw = typeof process !== "undefined" ? (process.env.CITY_CRIME_SCENE_EMAILS || "") : "";
  const fromEnv = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_CITY_CRIME_SCENE_EMAILS;
}
export function canUseCityCrimeScene(email: string | null | undefined): boolean {
  return !!email && cityCrimeSceneEmails().includes(email.toLowerCase());
}
/** Save-time backstop: remove city-crime-scene tools from a project-shaped object for non-entitled accounts. */
export function stripCityCrimeSceneTools<T extends { gameTools?: Array<{ type?: string }> }>(project: T): T {
  if (!project || !Array.isArray(project.gameTools)) return project;
  const kept = project.gameTools.filter(t => t?.type !== "city-crime-scene");
  if (kept.length === project.gameTools.length) return project;
  return { ...project, gameTools: kept };
}

/** Verdict on the detective's accusation. Pure and testable; the live route feeds it the full (draft) config server-side. */
export function accusationVerdict(config: CityCrimeSceneConfig, suspectId: string): { accusedId: string; accusedName: string; correct: boolean } | { error: string } {
  const accused = config.suspects.find(s => s.id === suspectId);
  if (!accused) return { error: "Choose a suspect for the verdict." };
  const guilty = config.suspects.find(s => s.isGuilty);
  return { accusedId: accused.id, accusedName: accused.name, correct: !!guilty && accused.id === guilty.id };
}
