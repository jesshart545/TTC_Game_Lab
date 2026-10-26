/** City Crime Scene: reusable improv whodunnit game format. Law & Order energy. */

export type CityCrimeSceneSuspect = {
  id: string; name: string;
  occupation: string;
  /** Suspect clue-card fields (public, shown on the suspect's card/intro). */
  age: string; knownFor: string; personality: string; quote: string;
  /** The ONLY character attributes adjustable to fit the live performer. */
  gender: string; ethnicity: string;
  characterBrief: string; potentialMotive: string; alibi: string;
  demeanor: string; tells: string; extraInfo: string;
  /** THE APPROVED STORY (master truth, HOST-ONLY): what role this character
   *  ACTUALLY played in the crime. Never published — the sanitizer strips it. */
  trueRole?: string;
  /** THE APPROVED STORY (master truth, HOST-ONLY): the reality of their
   *  alibi — whether it holds, and how it actually took place. The public
   *  `alibi` above is only the claim in their basic character file. */
  alibiReality?: string;
  questions: string[];
  guideVideoPrompt: string; guideVideoKey?: string;
  isGuilty: boolean;
};
export type CityCrimeSceneClue = {
  id: string; title: string; description: string;
  /** Generalized, suspect-facing summary for clue cards/rundowns. The specific
   *  detail lives in `description` and is revealed only during play. */
  summary: string;
  locationId: string; cutScenePrompt: string; cutSceneVideoKey?: string;
  audioPrompt?: string; audioKey?: string;
  /** The clickable item/area in the place this evidence is bound to (its name). */
  hotspot: string; hotspotX?: number; hotspotY?: number;
  /** The scene item of this clue's location the evidence pertains to. When
   *  set, the item's region IS the clickable/highlightable area in play; the
   *  per-clue hotspotX/hotspotY remain only as the legacy fallback (and the
   *  migration source the item was derived from). */
  itemId?: string;
  /** THE APPROVED STORY (master truth, HOST-ONLY): this evidence's importance
   *  and relevance — to the characters and to the crime. Never published. */
  storySignificance?: string;
  /** THE DETECTIVE'S CASE BRIEF: true when this piece of evidence is part of
   *  the opening brief — initially present when the game opens. Everything
   *  not flagged is discovered through play only. */
  initiallyPresent?: boolean;
  /** Map discoveries unlock ONLY the initial ability: questioning this suspect
   *  or using this clue helper. Empty means no unlock (open as before). */
  unlocksSuspectId?: string; unlocksHelperId?: string;
  /** New, previously-unknown information that can change the investigation. */
  turningPoint?: boolean;
  relatedSuspectIds: string[];
};
/** A crime flashback snippet: a short cinematic video uncovering a fragment of
 *  what happened. Fairness rule: every suspect must appear across the clues and
 *  flashbacks — no single suspect may dominate, or the audience solves it by
 *  screen time. */
export type CityCrimeSceneFlashback = {
  id: string; title: string; description: string;
  videoPrompt: string; videoKey?: string; relatedSuspectIds: string[];
};
/** A scene item: a NAMED thing, object, or area actually visible in a
 *  location's picture ("the drawer", "the employees-only staircase", a
 *  dumpster in an alley, a mooring post on a dock) — a location is a PLACE,
 *  interior or exterior. x/y/w/h are percentages of the scene image: the
 *  region that IS that thing's area. Items are the game's clickable surface:
 *  only items bound to chosen evidence ever highlight in play; the rest are
 *  scenery. Items derive strictly from the approved storyline — what the
 *  place really contains as the story establishes it. */
export type CityCrimeSceneSceneItem = {
  id: string; name: string;
  x: number; y: number; w: number; h: number;
};
export type CityCrimeSceneLocation = {
  id: string; name: string; description: string; imagePrompt?: string;
  /** Exactly one location per case must be the crime scene itself. */
  isCrimeScene?: boolean;
  /** Generated/uploaded scene visual (asset key), shown when the detective enters. */
  imageKey?: string;
  /** The place's visible items/objects/areas, as laid out on its picture. */
  items: CityCrimeSceneSceneItem[];
};
/** A required witness: a real character with a statement the detective must hear
 *  before the accusation. Distinct from helper witnesses, who are optional. */
export type CityCrimeSceneWitness = {
  id: string; name: string; role: string; statement: string;
  /** When set, this witness's account is the key evidence of that location. */
  locationId?: string;
};
/** Cast roles, fixed by the case file at build time: suspect, required witness,
 *  or optional helper. Characters are never moved between roles — live
 *  performers improvise the role the case file assigns them. */
export type CityCrimeSceneCastRole = "suspect" | "witness" | "helper";
export type CityCrimeSceneHelperWitness = {
  id: string; name: string; role: string; description: string;
  info: string; giftToUnlock: string;
  /** Info-card field: how this helper's information helps the detective move forward. */
  howItHelps: string;
  /** How the host presents the helper when triggered: generated media, or the host relays it. */
  mediaMode?: "generate" | "relay";
  /** Host-uploaded pre-created media (asset key). Feeds the info card and is the
   *  reference base for any further image/video generation of this helper. */
  mediaKey?: string;
  portraitPrompt?: string; videoPrompt?: string; voice?: string;
  /** Media generated for this helper from the prompts above (asset keys),
   *  produced inside the builder or by Jewel and attached automatically. */
  portraitKey?: string; videoKey?: string;
};
export type CityCrimeSceneTimelineEvent = { id: string; time: string; event: string };
export type CityCrimeSceneTwist = { id: string; title: string; description: string; triggerMoment: string };

export type CityCrimeSceneConfig = {
  title: string; premise: string;
  /** THE HOST'S BRIEF SCRIPT (HOST-ONLY — the dashboard layer): the FULL
   *  narrative scripted case intro the host reads aloud from their
   *  dashboard. Its beats: the victim and who they were; the place; how the
   *  body/situation was found and where; who discovered it and when; the
   *  discoverer's statement; and ONE initial observed discrepancy — the
   *  deliberate first analytical thread, drawn only from what was observed,
   *  never from the master truth. Under the same boundary rules as the other
   *  host-only content: the sanitizer strips it, so it never reaches the
   *  audience payload. The audience instead sees briefDocument. */
  briefNarration: string;
  /** THE DETECTIVE'S CASE BRIEF DOCUMENT (the brief's audience face): a
   *  typed, official-document SUMMARY of the pertinent info in the host's
   *  script — shown on screen during the opening, filed away with the
   *  character cards, and referenceable later. Not the full script. */
  briefDocument: string;
  detectiveCount: 1 | 2; suspectCount: number;
  crime: string;
  /** THE APPROVED STORY (master truth, HOST-ONLY): the reality of what
   *  happened in the crime — the true sequence. Together with each clue's
   *  storySignificance and each suspect's trueRole/alibiReality, this is the
   *  full story the host approved. The audience never sees it laid out: the
   *  published game carries only THE DETECTIVE'S CASE BRIEF layer (basic
   *  character files + the evidence flagged initiallyPresent). */
  actualCrimeDetails: string; victim: string;
  backstory: string; plot: string;
  locations: CityCrimeSceneLocation[];
  clues: CityCrimeSceneClue[];
  flashbacks: CityCrimeSceneFlashback[];
  suspects: CityCrimeSceneSuspect[];
  witnesses: CityCrimeSceneWitness[];
  helperWitnesses: CityCrimeSceneHelperWitness[];
  timeline: CityCrimeSceneTimelineEvent[];
  twists: CityCrimeSceneTwist[];
  caseInsightVideoPrompts: string[];
  interrogationSeconds: number; courtroomSeconds: number;
};

/** Public-safe suspect: everything the audience may see. Never guilt, tells, or detective intel. */
export type PublicCityCrimeSceneSuspect = {
  id: string; name: string; occupation: string;
  age: string; gender: string; ethnicity: string;
  knownFor: string; personality: string; quote: string;
  characterBrief: string; potentialMotive: string; alibi: string;
  guideVideoPrompt: string; guideVideoKey?: string;
};
export type PublicCityCrimeSceneFlashback = {
  id: string; title: string; description: string; videoPrompt: string; videoKey?: string;
};
/** Public-safe clue: everything about a piece of evidence EXCEPT its
 *  storySignificance — the master-truth layer never publishes. */
export type PublicCityCrimeSceneClue = Omit<CityCrimeSceneClue, "storySignificance">;
export type PublicCityCrimeSceneConfig = Omit<CityCrimeSceneConfig, "suspects" | "flashbacks" | "clues" | "actualCrimeDetails" | "twists" | "briefNarration"> & {
  suspects: PublicCityCrimeSceneSuspect[];
  flashbacks: PublicCityCrimeSceneFlashback[];
  clues: PublicCityCrimeSceneClue[];
};

const blankSuspect = (id: string, name: string): CityCrimeSceneSuspect => ({
  id, name, occupation: "", age: "", knownFor: "", personality: "", quote: "",
  gender: "", ethnicity: "",
  characterBrief: "", potentialMotive: "", alibi: "",
  demeanor: "", tells: "", extraInfo: "", questions: ["", "", ""],
  guideVideoPrompt: "", isGuilty: false,
});

export function cityCrimeSceneDefaults(): CityCrimeSceneConfig {
  return {
    title: "City Crime Scene: The Last Set",
    premise: "A beloved jazz club owner is found dead in his locked office after closing. Four people had reason to want him gone — but only one of them did it.",
    briefNarration: "Marcus Reed was fifty-eight years old, and for twenty-two years he owned The Velvet Note — the jazz club this city treats like a second living room. If you heard live music in this town, odds are you heard it under his roof, at a table he probably comped you.\n\nThe Velvet Note sits just off the main strip — a low-lit room of velvet curtains, a baby grand, and a long mahogany bar, with Reed's cramped office tucked behind the stage. Last night the club ran like always. The last set ended at eleven-thirty.\n\nShortly after midnight, Reed was found in that office, slumped at his desk, a half-finished brandy at his elbow. The door was locked — from the inside.\n\nHe was discovered at five past twelve by Danny Cole, the bartender, bringing Reed his usual after-show nightcap — the same ritual, every night, for years.\n\nDanny's statement, given at the scene: \"I knocked twice, like always. Nothing. I could see him through the glass, just sitting there, so we forced the door. He never missed that nightcap. Never. Somebody tell me how a man locks himself in and doesn't drink.\"\n\nOne thing doesn't sit right, detective. The brandy at Reed's elbow was still faintly warm — poured recently, by someone. The office door was locked from the inside. And nobody — nobody — admits to seeing Marcus Reed alive after the last set ended at eleven-thirty. Someone was in that room with him. The room says they never left.",
    briefDocument: "VICTIM: Marcus Reed, 58 — owner of The Velvet Note jazz club for 22 years.\n\nSCENE: The victim's office, The Velvet Note. Door locked from the inside.\n\nFOUND: 12:05 AM, seated at his desk, a half-finished brandy at his elbow — still faintly warm.\n\nDISCOVERED BY: Danny Cole, bartender — bringing the victim his usual after-show nightcap.\n\nDISCOVERER'S STATEMENT (summary): Knocked twice, no answer; saw the victim through the glass; the door was forced. \"He never missed that nightcap. Never.\"\n\nNOTED AT THE SCENE: The last set ended at 11:30 PM. No one admits to seeing the victim alive after it — yet the brandy in that locked room was poured recently, by someone.",
    detectiveCount: 1, suspectCount: 4,
    crime: "Marcus Reed, 58, owner of The Velvet Note jazz club, was found dead in his office shortly after midnight — slumped at his desk, a half-finished brandy at his elbow. The door was locked from the inside.",
    actualCrimeDetails: "HOST ONLY — THE TRUTH: Priya Raman poisoned Reed's after-show brandy with oleander extract at 11:40 PM, slipping in through the side door while Danny was restocking the bar. Reed discovered her year-long embezzlement that afternoon and confronted her at 9 PM. She unplugged the side-door camera at 11:02 PM on her way back in. The threatening note was written by Reed himself as a publicity stunt — it is a red herring.",
    victim: "Marcus Reed, 58 — owner of The Velvet Note jazz club for 22 years. Charismatic, stubborn, and weeks away from selling the club to a developer.",
    backstory: "The Velvet Note has been the heart of the city's jazz scene for two decades, but money has been tight. Reed recently discovered $40,000 missing from the club's accounts and told someone close to him he knew who took it.",
    plot: "The detective investigates the club's two key locations, uncovers three pieces of physical evidence, and interrogates four suspects — each with a reason to look guilty. When the evidence is compiled, the detective makes an arrest. If the accusation is correct, the case goes to trial.",
    locations: [
      { id: "loc-stage", name: "The Main Stage & Bar", description: "Velvet curtains, a baby grand, and a long mahogany bar. The last set ended at 11:30 PM.", imagePrompt: "Noir jazz club stage and bar at night, empty, moody spotlight, cinematic", items: [] },
      { id: "loc-office", name: "Reed's Office", description: "A cramped back office. Desk, decanter, ledger books — and a locked door.", imagePrompt: "Noir detective office interior, desk with brandy decanter and ledger books, venetian blind shadows, cinematic", isCrimeScene: true, items: [] },
    ],
    clues: [
      { id: "clue-decanter", title: "The Brandy Decanter", description: "The decanter Reed poured from smells faintly of bitter almonds — the signature of oleander. Someone dosed his after-show ritual.", summary: "Something about the drink Reed poured that night isn't right.", locationId: "loc-office", cutScenePrompt: "Extreme close-up: amber brandy swirling in a crystal decanter, a single oleander petal drifting on the surface. Low strings swell.", hotspot: "The crystal decanter on the desk", hotspotX: 62, hotspotY: 44, initiallyPresent: true, storySignificance: "The murder weapon itself: Priya dosed this decanter. It ties the crime to Reed's after-show ritual — only someone who knew the ritual, and had access to the office, could have planned it.", relatedSuspectIds: ["sus-priya", "sus-danny"] },
      { id: "clue-ledger", title: "The Torn Ledger Page", description: "A page ripped from the club's ledger shows $40,000 in unaccounted cash over twelve months — and Reed's angry margin note: 'I KNOW.'", summary: "The club's books don't add up — money has gone missing.", locationId: "loc-office", cutScenePrompt: "A gloved hand smooths a torn ledger page under a desk lamp. The camera pushes in on the words 'I KNOW' circled in red.", hotspot: "The ledger books on the desk", hotspotX: 30, hotspotY: 58, storySignificance: "The motive, in ink: Reed discovered Priya's year-long embezzlement that afternoon and confronted her. This page is why the bookkeeper could not let him reach the morning.", unlocksSuspectId: "sus-priya", relatedSuspectIds: ["sus-priya"] },
      { id: "clue-note", title: "The Threatening Note", description: "An angry note in block letters, found crumpled by the stage: 'YOU STOLE MY ACT — YOU'LL PAY.'", summary: "Someone left Reed a threatening note.", locationId: "loc-stage", cutScenePrompt: "Rain-streaked spotlight. A crumpled note unfolds in slow motion: 'YOU STOLE MY ACT — YOU'LL PAY.'", hotspot: "The crumpled paper by the stage", hotspotX: 48, hotspotY: 72, storySignificance: "A red herring with a real author: Reed wrote this note himself as a publicity stunt. It makes Elena and Sam look guilty — and means the loudest evidence in the case points nowhere.", unlocksSuspectId: "sus-elena", relatedSuspectIds: ["sus-elena", "sus-sam"] },
    ],
    flashbacks: [
      { id: "fb-argument", title: "9:00 PM — The Argument", description: "The office door, half open. Raised voices inside — Reed's, sharp with accusation, and a second voice answering low and steady. A ledger slams onto the desk.", videoPrompt: "Noir flashback: office door ajar, two silhouettes arguing, a ledger slammed on a desk, venetian blind shadows", relatedSuspectIds: ["sus-priya", "sus-elena"] },
      { id: "fb-sidedoor", title: "11:02 PM — The Side Door", description: "The alley behind the club. A figure slips through the side door as the security camera's red light dies. A second figure crosses the far end of the alley, unaware.", videoPrompt: "Noir flashback: rainy alley at night, a figure slipping through a side door, a security camera light going dark", relatedSuspectIds: ["sus-priya", "sus-danny", "sus-sam"] },
      { id: "fb-stage", title: "10:30 PM — The Walkout", description: "Mid-song, the music stops. A singer storms off the stage past the tables while the crowd murmurs — and across the room, a rival watches with a thin smile.", videoPrompt: "Noir flashback: jazz singer storming off a stage mid-song, murmuring crowd, a rival watching from a dark corner", relatedSuspectIds: ["sus-elena", "sus-sam", "sus-danny"] },
    ],
    suspects: [
      { id: "sus-elena", name: "Elena Voss", occupation: "Headliner torch singer at The Velvet Note", age: "Late 30s", knownFor: "The voice of The Velvet Note — the headliner every table goes quiet for.", personality: "Fiery and theatrical; performs even in conversation, and feels everything at full volume.", quote: "I sing other people's heartbreak, detective. I don't live it.", gender: "Female", ethnicity: "", characterBrief: "The club's headliner — a torch singer with a voice like smoke and a temper like gasoline.", potentialMotive: "Reed cut her headline set short two nights running and docked her pay. She threatened him backstage, loudly, in front of witnesses.", alibi: "On stage performing until 11:55 PM — fifty witnesses in the room.", demeanor: "Fiery and theatrical; performs even in conversation.", tells: "Touches her throat when cornered; her accent thickens when she lies.", extraInfo: "She genuinely loved Reed like a father — the fight was about respect, not money. She cries when she talks about him if pressed gently.", trueRole: "No part in the crime. Her backstage threat was about her cut set — anger, in public, in front of witnesses — and she never went near the office or the brandy.", alibiReality: "It holds completely: she was on stage until 11:55 PM in front of fifty witnesses, then went straight to the green room, where Lucia saw her.", questions: ["You threatened Marcus backstage — what exactly did you say to him?", "Who was with you between your last set and midnight?", "That note by the stage — is that your handwriting?"], guideVideoPrompt: "Noir character intro: Elena Voss, torch singer, smoky spotlight, defiant gaze into camera", isGuilty: false },
      { id: "sus-danny", name: "Danny Cole", occupation: "Bartender at The Velvet Note", age: "Early 30s", knownFor: "Knows every regular's order — and every regular's secrets.", personality: "Easygoing and quick with a joke; the smile thins when money comes up.", quote: "I pour drinks, detective. I don't pour poison.", gender: "Male", ethnicity: "", characterBrief: "The bartender — quick with a pour, quicker with a joke, and three months behind on rent.", potentialMotive: "He owes Reed three months' back rent on the apartment above the club. Reed threatened eviction that very week.", alibi: "Behind the bar all night; the register log and the regulars back him up.", demeanor: "Easygoing, deflects with humor; goes quiet when the rent comes up.", tells: "Polishes the same glass when nervous; avoids eye contact on direct questions.", extraInfo: "He saw Priya near the side door around 11 PM but assumed she was taking out trash. He feels guilty for not mentioning it sooner.", trueRole: "No part in the crime — he is the one who found the body, taking Reed his usual nightcap at 12:05 AM.", alibiReality: "It holds: he was behind the bar all night. The register log and the regulars — Old Pete among them — place him there at 11:45 PM.", questions: ["Walk me through your night behind the bar, hour by hour.", "Reed threatened to evict you — how did that make you feel?", "Did you see anyone near the office or the side door after 11?"], guideVideoPrompt: "Noir character intro: Danny Cole, bartender, wiping a glass, neon bar glow, uneasy smile", isGuilty: false },
      { id: "sus-priya", name: "Priya Raman", occupation: "Bookkeeper at The Velvet Note", age: "Mid 30s", knownFor: "The only person who truly understands the club's finances.", personality: "Composed and exact; treats every conversation like an audit.", quote: "Numbers don't lie, detective. People do.", gender: "Female", ethnicity: "", characterBrief: "The club's bookkeeper — precise, soft-spoken, and the only person who truly understands the finances.", potentialMotive: "She has been quietly skimming from the club's accounts for a year. Reed found the discrepancy that afternoon.", alibi: "Claims she left the club at 11:00 PM — but the side-door camera was unplugged at 11:02 PM.", demeanor: "Calm, precise, almost clinical; never raises her voice.", tells: "Straightens objects on any surface; her answers get shorter the closer you get.", extraInfo: "She is the guilty party. She is terrified but disciplined — she will only crack if confronted with the ledger page AND the camera gap together.", trueRole: "She did it. She poisoned Reed's after-show brandy with oleander extract at 11:40 PM, slipping back in through the side door after unplugging its camera at 11:02 PM — because Reed had discovered her year-long embezzlement that afternoon and confronted her at 9 PM.", alibiReality: "Half true, and the false half is the tell: she really did leave at 11:00 PM — then came back through the side door at 11:02 PM, which is exactly when its camera went dark.", questions: ["The ledger shows $40,000 missing. As bookkeeper, how do you explain that?", "You say you left at 11 — then why was the side-door camera unplugged at 11:02?", "Marcus confronted you at 9 PM. What did he say, exactly?"], guideVideoPrompt: "Noir character intro: Priya Raman, bookkeeper, desk lamp glow, ledger in hand, unreadable expression", isGuilty: true },
      { id: "sus-sam", name: "Sam Whitaker", occupation: "Owner of the rival club across town", age: "Late 40s", knownFor: "Owner of the rival club across town — all handshakes and grievances.", personality: "Blustery and grand; plays the wronged businessman to any audience.", quote: "Marcus stole my act, not the other way around.", gender: "Male", ethnicity: "", characterBrief: "Owner of the rival club across town — all handshakes and grievances.", potentialMotive: "Reed poached his star act last month. Sam was heard saying 'the Velvet Note won't survive the month.'", alibi: "At his own club across town until 1 AM — his staff and a dozen patrons confirm.", demeanor: "Blustery, big gestures; plays the wronged businessman.", tells: "Laughs too loud at his own jokes; drums his fingers when impatient.", extraInfo: "His alibi is airtight — he was genuinely across town. The note is not his; his threats were always public and performative.", trueRole: "No part in the crime. His feud with Reed was real but loud and public — a rival's bluster, not a murder plan. He never entered the club that night.", alibiReality: "It holds completely: he was at his own club across town until 1 AM, confirmed by his staff and a dozen patrons. Mara saw him leave the Velvet Note at 9:45 PM and never return.", questions: ["You said the Velvet Note wouldn't survive the month — what did you mean?", "Where were you between 11 PM and midnight?", "Did you write the threatening note found by the stage?"], guideVideoPrompt: "Noir character intro: Sam Whitaker, rival club owner, cigar smoke, city lights through blinds", isGuilty: false },
    ],
    witnesses: [
      { id: "wit-frank", name: "Frank", role: "Doorman", statement: "Mr. Reed argued with Miss Priya in the office around 9. I heard it through the door — he said something about numbers not adding up.", locationId: "loc-stage" },
      { id: "wit-lucia", name: "Lucia", role: "Waitress", statement: "Miss Elena stormed off stage at 10:30, furious. But she went straight to the green room — I saw her." },
      { id: "wit-pete", name: "Old Pete", role: "Regular", statement: "Danny never left that bar all night. Poured my whiskey at 11:45 himself." },
    ],
    helperWitnesses: [
      { id: "wit-tommy", name: "Old Tommy", role: "Piano tuner", description: "Has tuned the club's baby grand for 30 years; sees everything, says little.", info: "Tommy saw Priya come BACK through the side door around 11:15 PM carrying nothing — odd, since she'd 'left' at 11.", giftToUnlock: "Coffee", howItHelps: "Places the bookkeeper back inside the club after she claimed to have left — the detective can use it to press her on her timeline.", mediaMode: "generate", portraitPrompt: "Noir portrait: elderly Black piano tuner, kind eyes, flat cap, warm practical lighting" },
      { id: "wit-mara", name: "Mara", role: "Coat-check girl", description: "Twenty-two, sharp-eyed, remembers every face.", info: "Mara remembers Sam Whitaker leaving the club at 9:45 PM in a huff — and not coming back. His alibi checks out.", giftToUnlock: "Rose", howItHelps: "Corroborates the rival owner's alibi from an independent witness — the detective can stop spending time on him and focus elsewhere.", mediaMode: "generate", portraitPrompt: "Noir portrait: young coat-check girl, curious eyes, red scarf, dim cloakroom light" },
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
    interrogationSeconds: 300, courtroomSeconds: 180,
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
/** Fill newer fields on stored records so legacy cases migrate in place. */
function normalizeSuspect(s: Partial<CityCrimeSceneSuspect>): CityCrimeSceneSuspect {
  return {
    id: str(s.id), name: str(s.name), occupation: str(s.occupation),
    age: str(s.age), knownFor: str(s.knownFor), personality: str(s.personality), quote: str(s.quote),
    gender: str(s.gender), ethnicity: str(s.ethnicity),
    characterBrief: str(s.characterBrief), potentialMotive: str(s.potentialMotive), alibi: str(s.alibi),
    demeanor: str(s.demeanor), tells: str(s.tells), extraInfo: str(s.extraInfo),
    trueRole: s.trueRole ? str(s.trueRole) : undefined,
    alibiReality: s.alibiReality ? str(s.alibiReality) : undefined,
    questions: Array.isArray(s.questions) ? s.questions.map(str) : [],
    guideVideoPrompt: str(s.guideVideoPrompt), guideVideoKey: s.guideVideoKey ? str(s.guideVideoKey) : undefined,
    isGuilty: s.isGuilty === true,
  };
}
function normalizeClue(c: Partial<CityCrimeSceneClue>): CityCrimeSceneClue {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : undefined);
  return {
    id: str(c.id), title: str(c.title), description: str(c.description),
    summary: str(c.summary), locationId: str(c.locationId),
    cutScenePrompt: str(c.cutScenePrompt), cutSceneVideoKey: c.cutSceneVideoKey ? str(c.cutSceneVideoKey) : undefined,
    audioPrompt: c.audioPrompt ? str(c.audioPrompt) : undefined, audioKey: c.audioKey ? str(c.audioKey) : undefined,
    hotspot: str(c.hotspot), hotspotX: num(c.hotspotX), hotspotY: num(c.hotspotY),
    itemId: c.itemId ? str(c.itemId) : undefined,
    storySignificance: c.storySignificance ? str(c.storySignificance) : undefined,
    initiallyPresent: c.initiallyPresent === true ? true : undefined,
    unlocksSuspectId: c.unlocksSuspectId ? str(c.unlocksSuspectId) : undefined,
    unlocksHelperId: c.unlocksHelperId ? str(c.unlocksHelperId) : undefined,
    turningPoint: c.turningPoint === true ? true : undefined,
    relatedSuspectIds: Array.isArray(c.relatedSuspectIds) ? c.relatedSuspectIds.map(str) : [],
  };
}
function normalizeSceneItem(it: Partial<CityCrimeSceneSceneItem>): CityCrimeSceneSceneItem | null {
  const id = str(it?.id);
  if (!id) return null;
  const pct = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const w = Math.max(2, Math.min(100, pct(it.w, 22)));
  const h = Math.max(2, Math.min(100, pct(it.h, 22)));
  return {
    id, name: str(it.name),
    x: Math.max(0, Math.min(100 - w, pct(it.x, 0))),
    y: Math.max(0, Math.min(100 - h, pct(it.y, 0))),
    w, h,
  };
}
function normalizeLocation(l: Partial<CityCrimeSceneLocation>): CityCrimeSceneLocation {
  return {
    id: str(l.id), name: str(l.name), description: str(l.description),
    imagePrompt: l.imagePrompt ? str(l.imagePrompt) : undefined,
    isCrimeScene: l.isCrimeScene === true ? true : undefined,
    imageKey: l.imageKey ? str(l.imageKey) : undefined,
    items: Array.isArray(l.items)
      ? l.items.map(normalizeSceneItem).filter((it): it is CityCrimeSceneSceneItem => !!it)
      : [],
  };
}
function normalizeWitness(w: Partial<CityCrimeSceneWitness>): CityCrimeSceneWitness {
  return {
    id: str(w.id), name: str(w.name), role: str(w.role), statement: str(w.statement),
    locationId: w.locationId ? str(w.locationId) : undefined,
  };
}
function normalizeHelper(h: Partial<CityCrimeSceneHelperWitness>): CityCrimeSceneHelperWitness {
  return {
    id: str(h.id), name: str(h.name), role: str(h.role), description: str(h.description),
    info: str(h.info), giftToUnlock: str(h.giftToUnlock), howItHelps: str(h.howItHelps),
    mediaMode: h.mediaMode === "relay" ? "relay" : h.mediaMode === "generate" ? "generate" : undefined,
    mediaKey: h.mediaKey ? str(h.mediaKey) : undefined,
    portraitPrompt: h.portraitPrompt ? str(h.portraitPrompt) : undefined,
    videoPrompt: h.videoPrompt ? str(h.videoPrompt) : undefined,
    voice: h.voice ? str(h.voice) : undefined,
    portraitKey: h.portraitKey ? str(h.portraitKey) : undefined,
    videoKey: h.videoKey ? str(h.videoKey) : undefined,
  };
}

/** Normalize a visible thing's name for matching: case, a leading "the",
 *  and punctuation/spacing never decide whether two names are the same item. */
export function ccssNormalizeItemName(name: string): string {
  return String(name || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
}
/** True when two names plausibly name the same visible thing — one contains
 *  the other once normalized ("the ledger" vs "The ledger on the desk"). */
export function ccssItemNamesMatch(a: string, b: string): boolean {
  const na = ccssNormalizeItemName(a), nb = ccssNormalizeItemName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Width/height (percent of the scene image) of a scene item derived from a
 *  legacy clue that recorded only a center point. */
export const CCSS_DERIVED_ITEM_SIZE = 22;

/**
 * Scene-item migration, run on every read so any stored shape plays under the
 * scene-items model:
 * - A location with NO items is a legacy case: each of its clues that carries
 *   a marked position becomes a scene item — the item named by the clue's
 *   bound-item text (else the clue's title), its region centered on the
 *   clue's position — and the clue is bound to that item. Existing games
 *   therefore highlight the same things they did before, now as items.
 * - A location WITH items: an unbound clue whose bound-item text names one
 *   of the items (AI drafts and hand-built cases name the item in the clue
 *   text before an explicit binding exists) is bound to that item.
 * Derived ids are deterministic (`item-<clueId>`) and derivation is skipped
 * once items exist, so reading the same case twice yields identical items —
 * no duplicates, no drift.
 */
function deriveSceneItems(config: CityCrimeSceneConfig): void {
  for (const loc of config.locations) {
    const locClues = config.clues.filter(c => c.locationId === loc.id);
    if (!loc.items.length) {
      for (const clue of locClues) {
        if (clue.hotspotX === undefined && clue.hotspotY === undefined) continue;
        const name = String(clue.hotspot || "").trim() || clue.title;
        let item = loc.items.find(it => ccssItemNamesMatch(it.name, name));
        if (!item) {
          const size = CCSS_DERIVED_ITEM_SIZE;
          const cx = clue.hotspotX ?? 50, cy = clue.hotspotY ?? 50;
          item = {
            id: `item-${clue.id}`, name,
            x: Math.max(0, Math.min(100 - size, cx - size / 2)),
            y: Math.max(0, Math.min(100 - size, cy - size / 2)),
            w: size, h: size,
          };
          loc.items.push(item);
        }
        if (!clue.itemId) clue.itemId = item.id;
      }
    } else {
      for (const clue of locClues) {
        if (clue.itemId) continue;
        const item = loc.items.find(it => ccssItemNamesMatch(it.name, clue.hotspot || ""));
        if (item) clue.itemId = item.id;
      }
    }
  }
}

/** Read the mystery config out of a tool config, defensively merged over defaults. */
export function readCityCrimeSceneConfig(config: Record<string, unknown>): CityCrimeSceneConfig {
  const raw = (config?.mystery || {}) as Partial<CityCrimeSceneConfig> & { witnessStatements?: unknown };
  const d = cityCrimeSceneDefaults();
  const arr = <T>(v: unknown, fb: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fb);
  // Migrate legacy string witness statements into structured required witnesses.
  let witnesses = arr<CityCrimeSceneWitness>(raw.witnesses, []);
  if (!witnesses.length && Array.isArray(raw.witnessStatements)) {
    witnesses = (raw.witnessStatements as unknown[]).map((s, i) => ({
      id: `wit-legacy-${i}`, name: "", role: "", statement: String(s ?? ""),
    }));
  }
  if (!witnesses.length) witnesses = d.witnesses;
  const result: CityCrimeSceneConfig = {
    title: String(raw.title ?? d.title),
    briefNarration: String(raw.briefNarration ?? d.briefNarration),
    briefDocument: String(raw.briefDocument ?? d.briefDocument),
    premise: String(raw.premise ?? d.premise),
    detectiveCount: raw.detectiveCount === 2 ? 2 : 1,
    suspectCount: Math.max(1, Math.min(12, Math.floor(Number(raw.suspectCount) || d.suspectCount))),
    crime: String(raw.crime ?? d.crime),
    actualCrimeDetails: String(raw.actualCrimeDetails ?? d.actualCrimeDetails),
    victim: String(raw.victim ?? d.victim),
    backstory: String(raw.backstory ?? d.backstory),
    plot: String(raw.plot ?? d.plot),
    locations: arr(raw.locations, d.locations).map(normalizeLocation),
    clues: arr(raw.clues, d.clues).map(normalizeClue),
    flashbacks: arr(raw.flashbacks, d.flashbacks),
    suspects: arr(raw.suspects, d.suspects).map(normalizeSuspect),
    witnesses: witnesses.map(normalizeWitness),
    helperWitnesses: arr(raw.helperWitnesses, d.helperWitnesses).map(normalizeHelper),
    timeline: arr(raw.timeline, d.timeline),
    twists: arr(raw.twists, d.twists),
    caseInsightVideoPrompts: arr<string>(raw.caseInsightVideoPrompts, d.caseInsightVideoPrompts).map(String),
    interrogationSeconds: Math.max(15, Math.min(3600, Math.floor(Number(raw.interrogationSeconds) || d.interrogationSeconds))),
    courtroomSeconds: Math.max(15, Math.min(3600, Math.floor(Number(raw.courtroomSeconds) || d.courtroomSeconds))),
  };
  deriveSceneItems(result);
  return result;
}

/**
 * Strip every host-only field. The result is safe for the published snapshot,
 * live-event payloads, and the audience overlay. NEVER add secrets here.
 */
export function sanitizeCityCrimeSceneForOverlay(config: CityCrimeSceneConfig): PublicCityCrimeSceneConfig {
  // Host-only, stripped before anything publishes: the master truth
  // (actualCrimeDetails, twists) and the host's full brief SCRIPT — the
  // audience payload carries only the brief DOCUMENT summary.
  const { actualCrimeDetails: _a, twists: _t, briefNarration: _b, ...rest } = config;
  void _a; void _t; void _b;
  return {
    ...rest,
    suspects: config.suspects.map(s => ({
      id: s.id, name: s.name, occupation: s.occupation || "",
      age: s.age || "", gender: s.gender || "", ethnicity: s.ethnicity || "",
      knownFor: s.knownFor || "", personality: s.personality || "", quote: s.quote || "",
      characterBrief: s.characterBrief, potentialMotive: s.potentialMotive, alibi: s.alibi,
      guideVideoPrompt: s.guideVideoPrompt, guideVideoKey: s.guideVideoKey,
    })),
    // Clues are rebuilt field by field (like suspects): the master-truth
    // layer — storySignificance — is never copied, so it cannot leak through
    // the spread. Suspects likewise never carry trueRole/alibiReality here.
    clues: config.clues.map(c => ({
      id: c.id, title: c.title, description: c.description, summary: c.summary,
      locationId: c.locationId, cutScenePrompt: c.cutScenePrompt, cutSceneVideoKey: c.cutSceneVideoKey,
      audioPrompt: c.audioPrompt, audioKey: c.audioKey,
      hotspot: c.hotspot, hotspotX: c.hotspotX, hotspotY: c.hotspotY, itemId: c.itemId,
      initiallyPresent: c.initiallyPresent,
      unlocksSuspectId: c.unlocksSuspectId, unlocksHelperId: c.unlocksHelperId,
      turningPoint: c.turningPoint, relatedSuspectIds: c.relatedSuspectIds,
    })),
    flashbacks: (config.flashbacks || []).map(f => ({
      id: f.id, title: f.title, description: f.description,
      videoPrompt: f.videoPrompt, videoKey: f.videoKey,
    })),
  };
}

/**
 * THE DETECTIVE'S CASE BRIEF — the opening layer of a published case, read
 * from the SANITIZED config (so it can only ever contain brief material):
 * the game's title (based on the crime), the brief DOCUMENT — the typed
 * case-brief summary shown on the audience screen (never the host's full
 * script, which is stripped before publish) — the basic character files,
 * and the pieces of evidence flagged initiallyPresent, in their generalized
 * suspect-facing form. Everything beyond this is discovered through play
 * only.
 */
export function ccssDetectiveBrief(config: PublicCityCrimeSceneConfig): {
  title: string;
  document: string;
  suspects: PublicCityCrimeSceneSuspect[];
  evidence: { clueId: string; title: string; summary: string; locationName: string; itemName?: string }[];
} {
  const locationById = new Map(config.locations.map(l => [l.id, l]));
  return {
    title: config.title,
    document: config.briefDocument || "",
    suspects: config.suspects,
    evidence: config.clues
      .filter(c => c.initiallyPresent)
      .map(c => {
        const loc = locationById.get(c.locationId);
        const item = c.itemId ? loc?.items?.find(it => it.id === c.itemId) : undefined;
        return {
          clueId: c.id, title: c.title, summary: c.summary,
          locationName: loc?.name || "",
          itemName: item?.name,
        };
      }),
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
  // Detectives are the host's choice: one by default, two if the host adds a second.
  // Detectives never get character descriptions — they are simply the players solving the mystery.
  if (config.detectiveCount !== 1 && config.detectiveCount !== 2)
    problems.push("Detective count must be 1 or 2.");
  if (!config.crime.trim()) problems.push("The crime is empty — the briefing needs it.");
  if (!config.actualCrimeDetails.trim()) problems.push("The host-only actual crime details are empty.");
  const dupes = config.suspects.map(s => s.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) problems.push(`Duplicate suspect ids: ${[...new Set(dupes)].join(", ")}.`);
  // Scene items: the named visible things of each place. An item with no name
  // or a duplicated id cannot drive highlighting honestly.
  const itemIdsByLocation = new Map<string, Set<string>>();
  for (const loc of config.locations) {
    const seen = new Set<string>();
    for (const item of loc.items || []) {
      if (seen.has(item.id))
        problems.push(`Location "${loc.name}" has two scene items with the same id "${item.id}".`);
      seen.add(item.id);
      if (!String(item.name || "").trim())
        problems.push(`A scene item in location "${loc.name}" has no name — name the visible thing it marks in the picture.`);
    }
    itemIdsByLocation.set(loc.id, seen);
  }
  for (const clue of config.clues) {
    if (!clue.title.trim()) problems.push("A clue is missing its title.");
    if (!String(clue.description || "").trim())
      problems.push(`Clue "${clue.title || clue.id}" has no description — evidence needs its specific detail for the playthrough.`);
    if (!String(clue.summary || "").trim())
      problems.push(`Clue "${clue.title || clue.id}" has no generalized summary — suspect-facing materials may only generalize evidence, so every clue needs a summary.`);
    if (!String(clue.hotspot || "").trim())
      problems.push(`Clue "${clue.title || clue.id}" is not bound to a clickable item or area in its location.`);
    if (clue.unlocksSuspectId && !suspectIds.has(clue.unlocksSuspectId))
      problems.push(`Clue "${clue.title || clue.id}" unlocks unknown suspect "${clue.unlocksSuspectId}".`);
    if (clue.unlocksHelperId && !(config.helperWitnesses || []).some(h => h.id === clue.unlocksHelperId))
      problems.push(`Clue "${clue.title || clue.id}" unlocks unknown clue helper "${clue.unlocksHelperId}".`);
    if (!locationIds.has(clue.locationId))
      problems.push(`Clue "${clue.title || clue.id}" points at unknown location "${clue.locationId}".`);
    if (clue.itemId && locationIds.has(clue.locationId) && !itemIdsByLocation.get(clue.locationId)?.has(clue.itemId))
      problems.push(`Clue "${clue.title || clue.id}" is bound to scene item "${clue.itemId}", which is not one of its location's visible items.`);
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
    if (!String(s.occupation || "").trim()) problems.push(`Suspect "${s.name || s.id}" has no occupation — the opening character card needs what they do.`);
    if (!String(s.age || "").trim()) problems.push(`Suspect "${s.name || s.id}" has no age — the suspect clue card needs it.`);
    if (!String(s.knownFor || "").trim()) problems.push(`Suspect "${s.name || s.id}" has no "known for" line — the suspect clue card needs it.`);
    if (!String(s.personality || "").trim()) problems.push(`Suspect "${s.name || s.id}" has no personality line — the suspect clue card needs it.`);
    if (!String(s.quote || "").trim()) problems.push(`Suspect "${s.name || s.id}" has no signature quote — the suspect clue card needs their voice.`);
    if (!s.potentialMotive.trim()) problems.push(`Suspect "${s.name || s.id}" has no potential motive.`);
    if (!s.alibi.trim()) problems.push(`Suspect "${s.name || s.id}" has no alibi.`);
    if (!s.questions.filter(q => String(q || "").trim()).length)
      problems.push(`Suspect "${s.name || s.id}" has no interrogation questions for the detective.`);
  }
  // Required witnesses: real characters the detective must hear before the accusation.
  const witnessIds = new Set<string>();
  for (const w of config.witnesses || []) {
    if (!w.name.trim()) problems.push("A required witness is missing a name.");
    if (!String(w.statement || "").trim()) problems.push(`Witness "${w.name || w.id}" has no statement for the detective to hear.`);
    if (w.locationId && !locationIds.has(w.locationId))
      problems.push(`Witness "${w.name || w.id}" is the key evidence of unknown location "${w.locationId}".`);
    if (witnessIds.has(w.id)) problems.push(`Duplicate witness id: ${w.id}.`);
    witnessIds.add(w.id);
  }
  // Clue helpers: static authored content — their info card must be complete
  // (what they reveal, and how it helps the detective) before the case ships.
  for (const h of config.helperWitnesses || []) {
    if (!h.name.trim()) problems.push("A clue helper is missing a name.");
    if (!String(h.description || "").trim()) problems.push(`Clue helper "${h.name || h.id}" has no character description — the host describes each helper first.`);
    if (!String(h.info || "").trim()) problems.push(`Clue helper "${h.name || h.id}" has no information to reveal.`);
    if (!String(h.howItHelps || "").trim()) problems.push(`Clue helper "${h.name || h.id}" does not say how their information helps the detective.`);
    if (!String(h.giftToUnlock || "").trim()) problems.push(`Clue helper "${h.name || h.id}" has no gift that unlocks them.`);
  }
  // Flashback fairness: every suspect must appear across the clues and flashbacks,
  // or the audience solves the case by screen time. No single suspect may be singled out.
  const implicated = new Set<string>();
  for (const clue of config.clues) for (const sid of clue.relatedSuspectIds || []) implicated.add(sid);
  for (const fb of config.flashbacks || []) {
    if (!fb.title.trim()) problems.push("A flashback is missing its title.");
    if (!Array.isArray(fb.relatedSuspectIds) || !fb.relatedSuspectIds.length)
      problems.push(`Flashback "${fb.title || fb.id}" has no related suspects — every flashback must implicate at least one suspect.`);
    for (const sid of fb.relatedSuspectIds || []) {
      if (!suspectIds.has(sid)) problems.push(`Flashback "${fb.title || fb.id}" references unknown suspect "${sid}".`);
      implicated.add(sid);
    }
  }
  for (const s of config.suspects)
    if (!implicated.has(s.id))
      problems.push(`Suspect "${s.name || s.id}" appears in no clue or flashback — every suspect must look potentially guilty, or the flashbacks give the game away.`);
  if (config.twists.length < 1) problems.push("Add at least one pre-woven twist for the host to deploy.");
  return problems;
}

/**
 * Design standards for a complete case — the generation targets the builder
 * holds every case to (checked in the builder and reported for AI drafts).
 * Stricter than coherence validation: a case can be coherent yet unfinished.
 */
export function validateCityCrimeSceneStandards(config: CityCrimeSceneConfig): string[] {
  const problems: string[] = [];
  const cluesAt = (locId: string) => config.clues.filter(c => c.locationId === locId);
  if (!String(config.briefNarration || "").trim())
    problems.push("The case has no host brief script — the full narrative the host reads aloud from their dashboard to open the game: the victim and who they were, the place, how the body was found and where, who discovered it and when, the discoverer's statement, and the first observed discrepancy.");
  if (!String(config.briefDocument || "").trim())
    problems.push("The case has no audience brief document — the typed case-brief summary that appears on screen during the opening (the official-document version of the script's pertinent info, not the full script).");
  if (config.locations.length < 5 || config.locations.length > 7)
    problems.push(`The map has ${config.locations.length} locations — a full case builds around 6 locations pertinent to the storyline.`);
  const crimeScenes = config.locations.filter(l => l.isCrimeScene);
  if (crimeScenes.length === 0)
    problems.push("No location is marked as the crime scene — one of the locations must always be the crime scene itself.");
  if (crimeScenes.length > 1)
    problems.push(`${crimeScenes.length} locations are marked as the crime scene (${crimeScenes.map(l => l.name).join(", ")}) — exactly one may be.`);
  for (const loc of config.locations) {
    const n = cluesAt(loc.id).length;
    if (n < 4)
      problems.push(`Location "${loc.name}" holds ${n} evidence piece${n === 1 ? "" : "s"} — every location needs at least 4 relevant evidence pieces to discover.`);
    if (!String(loc.imagePrompt || "").trim() && !loc.imageKey)
      problems.push(`Location "${loc.name}" has no visual yet — the map is a visual medium; every location needs an image prompt or scene image.`);
  }
  // Suspect unlocks: every suspect is unlocked by exactly one map discovery,
  // and that discovery's cinematic cut scene shows how the evidence ties them in.
  const unlockLocations = new Set<string>();
  for (const s of config.suspects) {
    const unlocks = config.clues.filter(c => c.unlocksSuspectId === s.id);
    if (!unlocks.length)
      problems.push(`Suspect "${s.name || s.id}" has no unlock discovery — a piece of map evidence must point to their connection and unlock their questioning.`);
    if (unlocks.length > 1)
      problems.push(`Suspect "${s.name || s.id}" has ${unlocks.length} unlock discoveries — exactly one discovery unlocks each suspect.`);
    for (const u of unlocks) {
      unlockLocations.add(u.locationId);
      if (!(u.relatedSuspectIds || []).includes(s.id))
        problems.push(`The unlock discovery "${u.title || u.id}" does not list ${s.name || "its suspect"} in its related suspects — the unlock evidence must point at that suspect's connection.`);
      if (!String(u.cutScenePrompt || "").trim())
        problems.push(`The unlock discovery "${u.title || u.id}" has no cinematic cut-scene prompt — every suspect unlock plays a cut scene showing the evidence and how it ties the suspect to the crime.`);
    }
    if (!String(s.guideVideoPrompt || "").trim())
      problems.push(`Suspect "${s.name || s.id}" has no character guide video prompt.`);
    if (!String(s.gender || "").trim() || !String(s.ethnicity || "").trim())
      problems.push(`Suspect "${s.name || s.id}" has no gender/ethnicity set yet — the only attributes adjusted to fit the live performer, set them on the clue card.`);
    // The approved story is the FULL story: what each character actually did
    // and the reality of their alibi are part of it, host-only.
    if (!String(s.trueRole || "").trim())
      problems.push(`Suspect "${s.name || s.id}" has no true role recorded — the approved story states what role each character actually played in the crime (host-only).`);
    if (!String(s.alibiReality || "").trim())
      problems.push(`Suspect "${s.name || s.id}" has no alibi reality recorded — the approved story states how their alibi actually took place (host-only).`);
  }
  for (const c of config.clues)
    if (!String(c.storySignificance || "").trim())
      problems.push(`Evidence "${c.title || c.id}" carries no story significance — the approved story records every piece of evidence's importance to the characters and to the crime (host-only).`);
  const suspectsWithUnlock = new Set(config.clues.map(c => c.unlocksSuspectId).filter(Boolean));
  if (suspectsWithUnlock.size >= 4 && unlockLocations.size < 4)
    problems.push("Fewer than 4 locations hold a suspect unlock — at least 4 locations must each unlock a suspect.");
  // STRICT STORY ADHERENCE: every location must carry a storyline role — the
  // crime scene itself, a suspect's unlock discovery, a witness account as its
  // key evidence, or turning-point information. A location with no story role
  // is filler and fails loudly: the map derives strictly from the approved
  // story, so a place the story does not establish cannot be on it.
  for (const loc of config.locations) {
    const roles: string[] = [];
    if (loc.isCrimeScene) roles.push("the crime scene");
    if (cluesAt(loc.id).some(c => c.unlocksSuspectId)) roles.push("a suspect unlock discovery");
    if ((config.witnesses || []).some(w => w.locationId === loc.id)) roles.push("a witness account");
    if (cluesAt(loc.id).some(c => c.turningPoint)) roles.push("turning-point information");
    if (!roles.length)
      problems.push(`Location "${loc.name}" has no storyline role — it is not the crime scene, unlocks no suspect, and carries neither a witness account nor turning-point information. Every location must serve the approved story; filler locations are not allowed.`);
  }
  return problems;
}

/** Evidence archetypes for the builder's per-location evidence list. The list
 *  offered for a location contains ONLY options that fit the overall storyline
 *  AND are relevant to that location — no tire tracks in an upstairs bedroom.
 *  Every possibility is expressed against a visible thing of the place:
 *  `itemName` is the scene item the evidence pertains to, so choosing the
 *  evidence binds it to that item (creating the item when the host has not
 *  laid it out yet). A location is a place, interior or exterior — the
 *  catalog's location keywords cover alleys, docks, streets, and yards as
 *  much as rooms. */
export type CityCrimeSceneEvidenceSuggestion = {
  archetypeId: string; label: string; hotspot: string; summary: string; detail: string;
  /** The visible scene item this evidence pertains to (e.g. "The ledger on the desk"). */
  itemName: string;
};
const EVIDENCE_CATALOG: (Omit<CityCrimeSceneEvidenceSuggestion, "itemName"> & { item: string; locations: string[]; story: string[] })[] = [
  { archetypeId: "tire-tracks", label: "Tire tracks", hotspot: "The mud by the vehicle tracks", item: "The vehicle tracks", summary: "A vehicle came and went from here in a hurry.", detail: "Fresh tire tracks cut through the soft ground — a vehicle arrived quietly and left in a hurry, far later than anyone admits to being here.", locations: ["alley", "street", "road", "driveway", "garage", "parking", "yard", "grounds", "exterior", "dock", "lot", "carriage"], story: ["car", "vehicle", "getaway", "drove", "drive", "tire"] },
  { archetypeId: "muddy-footprints", label: "Muddy footprints", hotspot: "The floor by the door", item: "The floor by the door", summary: "Someone tracked mud through here that night.", detail: "A trail of muddy footprints crosses the floor — the tread is distinctive, and the mud is fresh enough to have been tracked in that night.", locations: ["door", "entrance", "hall", "stairs", "staircase", "office", "room", "garden", "yard", "floor", "foyer", "porch"], story: [] },
  { archetypeId: "broken-glass", label: "Broken glass", hotspot: "The window frame", item: "The window", summary: "Glass was broken here — and recently.", detail: "Shards of glass glitter along the frame, most of them on the inside — whatever broke this window, it was not an accident.", locations: ["window", "door", "office", "room", "bar", "stage", "greenhouse", "shop", "studio", "conservatory"], story: ["broke", "smashed", "break-in", "window", "glass"] },
  { archetypeId: "shell-casing", label: "A spent shell casing", hotspot: "The floorboards by the wall", item: "The floorboards by the wall", summary: "A shot was fired here.", detail: "A single spent shell casing rests against the baseboard, half-hidden — a shot was fired here, whatever anyone claims.", locations: ["floor", "alley", "room", "office", "stage", "street", "hall", "basement", "attic"], story: ["shot", "gun", "pistol", "shooting", "firearm", "revolver"] },
  { archetypeId: "torn-fabric", label: "Torn fabric snagged on a fixture", hotspot: "The fixture by the passage", item: "The fixture by the passage", summary: "Someone passed through here in a rush — and left a piece of themselves behind.", detail: "A scrap of torn fabric clings to the fixture — someone squeezed through here in a hurry and left part of their clothing behind.", locations: ["fence", "door", "window", "stairs", "staircase", "stage", "room", "office", "gate"], story: [] },
  { archetypeId: "ledger-page", label: "A torn-out ledger page", hotspot: "The ledger on the desk", item: "The ledger on the desk", summary: "The books don't add up — and someone tore out the page that would prove it.", detail: "A page has been ripped from the ledger; the remaining figures show money unaccounted for, month after month.", locations: ["office", "desk", "study", "back room", "counting", "library"], story: ["money", "embezzle", "accounts", "ledger", "cash", "stole", "funds", "debt", "books"] },
  { archetypeId: "dropped-key", label: "A dropped key", hotspot: "The floor by the door", item: "The floor by the door", summary: "Someone dropped a key here — a key they were never supposed to have.", detail: "A single key lies where it fell, half under the doorframe — and it is not a key anyone admits to owning.", locations: ["door", "hallway", "entrance", "stairs", "staircase", "alley", "office", "porch"], story: ["lock", "key", "locked"] },
  { archetypeId: "cigarette-butt", label: "A fresh cigarette butt", hotspot: "The ground by the doorway", item: "The ground by the doorway", summary: "Someone stood here a while — waiting, and watching.", detail: "A cigarette butt, ground out where someone stood for some time — long enough to smoke it down to the filter while watching this spot.", locations: ["alley", "doorway", "balcony", "fire escape", "street", "stage door", "porch", "terrace"], story: ["smoke", "smoker", "waited", "cigarette", "watch"] },
  { archetypeId: "lipstick-glass", label: "A lipstick-marked glass", hotspot: "The table by the seat", item: "The table", summary: "Someone drank here with the victim — and never mentioned it.", detail: "A second glass sits beside the victim's own, lipstick on the rim — someone shared a drink here that night and told no one.", locations: ["bar", "table", "dressing", "lounge", "kitchen", "office", "parlor", "salon"], story: ["drink", "glass", "toast", "brandy", "wine", "whiskey", "poured"] },
  { archetypeId: "camera-gap", label: "A disabled security camera", hotspot: "The camera above the door", item: "The security camera", summary: "The camera watching this spot was put out of action that night.", detail: "The security camera's cable hangs cut — or its light is dark. Someone made sure this spot went unseen at the crucial hour.", locations: ["office", "hallway", "entrance", "security", "stage", "bar", "door", "lobby"], story: ["camera", "surveillance", "unplugged", "footage", "security"] },
  { archetypeId: "threatening-note", label: "A threatening note", hotspot: "The note left where it would be found", item: "The note", summary: "Someone left the victim a threat in writing.", detail: "A note in block letters, left where the victim was sure to find it — a threat made in writing, by someone who wanted it felt.", locations: ["stage", "desk", "door", "mailbox", "dressing", "office", "table"], story: ["note", "threat", "threatened", "letter", "wrote"] },
  { archetypeId: "perfume-trace", label: "A trace of perfume", hotspot: "The air by the doorway", item: "The doorway", summary: "A distinctive scent still hangs here — someone's signature fragrance.", detail: "Hours later, a distinctive perfume still hangs in the air here — a signature scent that belongs to exactly one person in this case.", locations: ["room", "office", "dressing", "closet", "bathroom", "bedroom", "parlor"], story: ["perfume", "scent", "fragrance"] },
  { archetypeId: "phone-record", label: "A phone left behind", hotspot: "The phone on the desk", item: "The phone on the desk", summary: "A phone was left here — and its call log tells a story.", detail: "A phone lies forgotten here, and its recent calls do not match the story its owner has been telling.", locations: ["office", "desk", "room", "table", "bar"], story: ["phone", "call", "called", "telephone"] },
  { archetypeId: "ticket-stub", label: "A ticket stub", hotspot: "The coat left hanging here", item: "The coat", summary: "A ticket stub puts someone somewhere they deny being.", detail: "A ticket stub, dated that very night — it places its owner somewhere their alibi says they never were.", locations: ["coat", "dressing", "office", "stage", "pocket", "cloakroom"], story: ["train", "show", "ticket", "theater", "theatre", "travel", "performance"] },
  { archetypeId: "tool-marks", label: "Fresh tool marks", hotspot: "The lock on the door", item: "The lock on the door", summary: "This lock was worked on with a tool — recently.", detail: "Bright, fresh scratches score the metal around the lock — someone worked this lock open with a tool, and not long ago.", locations: ["door", "window", "safe", "lock", "office", "basement", "cellar"], story: ["pried", "forced", "safe", "lock", "jimmy"] },
  { archetypeId: "warm-ashtray", label: "An ashtray still warm", hotspot: "The ashtray on the table", item: "The ashtray", summary: "Someone lingered here not long before the crime.", detail: "The ashtray is still faintly warm — someone sat here smoking within the hour, though no one was supposed to be here at all.", locations: ["office", "lounge", "room", "bar", "study", "parlor"], story: ["smoke", "cigar", "waited", "sat"] },
  { archetypeId: "scuff-marks", label: "Scuff marks across the floor", hotspot: "The floor by the door", item: "The floor by the door", summary: "Something heavy was dragged across this floor.", detail: "Parallel scuff marks score the floorboards from the door to the corner — something heavy was dragged here, not carried.", locations: ["floor", "stairs", "staircase", "hallway", "stage", "door", "basement"], story: ["drag", "struggle", "moved", "body"] },
  { archetypeId: "torn-photograph", label: "Half of a torn photograph", hotspot: "The ground where it fell", item: "The ground", summary: "Half a photograph — someone kept the other half.", detail: "One half of a torn photograph lies here; the tear is fresh. Whoever holds the other half holds the rest of this story.", locations: ["alley", "street", "yard", "grounds", "office", "desk", "stage"], story: ["photo", "photograph", "picture"] },
  { archetypeId: "fiber-thread", label: "A caught thread of fabric", hotspot: "The fixture on the stairs", item: "The fixture on the stairs", summary: "A thread of distinctive fabric caught here as someone passed.", detail: "A single thread of distinctive fabric is caught on the fixture — it matches a garment in this case, thread for thread.", locations: ["stairs", "staircase", "window", "fence", "stage", "curtain", "banister"], story: [] },
  { archetypeId: "discarded-glove", label: "A discarded glove", hotspot: "The bin by the door", item: "The bin", summary: "A glove, thrown away in a hurry.", detail: "A single glove, discarded in haste — whoever wore it did not want their hands remembered here.", locations: ["alley", "trash", "bin", "dumpster", "garden", "yard", "street"], story: ["glove", "prints", "fingerprint", "hands"] },
  { archetypeId: "purchase-receipt", label: "A purchase receipt", hotspot: "The counter by the register", item: "The counter", summary: "A receipt for something bought that day — something that matters now.", detail: "A receipt dated that day, for a purchase nobody has mentioned — and it connects to the means of the crime.", locations: ["desk", "office", "counter", "bar", "register", "coat", "shop"], story: ["bought", "purchased", "receipt", "store", "shop", "poison", "bought"] },
];

/**
 * The evidence list for one location: ONLY archetypes that fit the overall
 * storyline AND are relevant to that specific location. STRICT STORY
 * ADHERENCE: the storyline filter reads the APPROVED story fields (title,
 * premise, crime, victim, backstory, plot) — an archetype whose story needs
 * are absent from the approved story is never offered, however well it fits
 * the place.
 */
export function suggestEvidenceForLocation(
  config: CityCrimeSceneConfig,
  locationId: string,
): CityCrimeSceneEvidenceSuggestion[] {
  const loc = config.locations.find(l => l.id === locationId);
  if (!loc) return [];
  const locText = `${loc.name} ${loc.description}`.toLowerCase();
  const storyText = [config.title, config.premise, config.crime, config.victim, config.backstory, config.plot]
    .join(" ").toLowerCase();
  return EVIDENCE_CATALOG
    .filter(a => a.locations.some(k => locText.includes(k)))
    .filter(a => !a.story.length || a.story.some(k => storyText.includes(k)))
    .map(({ archetypeId, label, hotspot, summary, detail, item }) => ({ archetypeId, label, hotspot, summary, detail, itemName: item }));
}

/**
 * The evidence possibilities that pertain to ONE scene item of a location:
 * the location's storyline-filtered list, narrowed to the possibilities whose
 * visible item is this item. An item that is physically present but
 * story-irrelevant yields nothing — both filters always apply.
 */
export function suggestEvidenceForItem(
  config: CityCrimeSceneConfig,
  locationId: string,
  itemId: string,
): CityCrimeSceneEvidenceSuggestion[] {
  const loc = config.locations.find(l => l.id === locationId);
  const item = loc?.items?.find(it => it.id === itemId);
  if (!loc || !item) return [];
  return suggestEvidenceForLocation(config, locationId)
    .filter(s => ccssItemNamesMatch(s.itemName, item.name));
}

export type CcssSceneRegion = {
  item: CityCrimeSceneSceneItem;
  /** The chosen clues bound to this item, in case order. */
  clueIds: string[];
  /** The clue a click on this item reveals next: the first unrevealed bound
   *  clue, in case order. Undefined once the item's evidence is exhausted. */
  nextClueId?: string;
  /** True while the item still holds unrevealed evidence. Only active items
   *  highlight under the spyglass; once inactive, the item is scenery again. */
  active: boolean;
};

/**
 * The play surface of one location: the scene items that carry chosen
 * evidence. Items with no chosen clue bound to them NEVER appear here —
 * they are scenery and never highlight. A location with no scene items
 * returns [] and play falls back to the legacy per-clue markers.
 */
export function ccssSceneRegions(
  config: Pick<CityCrimeSceneConfig, "locations" | "clues">,
  locationId: string,
  revealedClueIds: string[],
): CcssSceneRegion[] {
  const loc = config.locations.find(l => l.id === locationId);
  if (!loc || !loc.items?.length) return [];
  const revealed = new Set(revealedClueIds || []);
  const regions: CcssSceneRegion[] = [];
  for (const item of loc.items) {
    const clueIds = config.clues
      .filter(c => c.locationId === locationId && c.itemId === item.id)
      .map(c => c.id);
    if (!clueIds.length) continue;
    const nextClueId = clueIds.find(id => !revealed.has(id));
    regions.push({ item, clueIds, nextClueId, active: nextClueId !== undefined });
  }
  return regions;
}

/** Split revealed clues for the courtroom: what points at the defendant vs what pointed elsewhere. */
export function splitCourtroomEvidence(config: CityCrimeSceneConfig, revealedClueIds: string[], defendantId: string) {
  const revealed = config.clues.filter(c => revealedClueIds.includes(c.id));
  return {
    pointingAt: revealed.filter(c => c.relatedSuspectIds.includes(defendantId)),
    pointedElsewhere: revealed.filter(c => !c.relatedSuspectIds.includes(defendantId)),
  };
}

/** Live investigation state tracked across host actions. */
export type CityCrimeSceneLiveState = {
  revealedClueIds: string[];
  introducedSuspectIds: string[];
  questionedSuspectIds: string[];
  heardWitnessIds: string[];
  unlockedHelperIds: string[];
  /** Suspects whose questioning the map has unlocked (initial ability only). */
  unlockedSuspectIds: string[];
  /** Clue helpers the map has made available (before any gift unlock). */
  availableHelperIds: string[];
};

export type CityCrimeSceneProgress = {
  clues: number; cluesTotal: number;
  introduced: number; suspectsTotal: number;
  questioned: number; questionedTotal: number;
  witnesses: number; witnessesTotal: number;
  helpers: number; helpersTotal: number;
  /** Map unlocks (initial abilities). Reported for the host; they never gate the accusation. */
  suspectsUnlocked: number; suspectsUnlockedTotal: number;
  helpersAvailable: number; helpersAvailableTotal: number;
  /** The accusation unlocks only when every required element is done.
   *  Optional helper witnesses NEVER gate the accusation. */
  complete: boolean;
};

const emptyLiveState = (): CityCrimeSceneLiveState => ({
  revealedClueIds: [], introducedSuspectIds: [], questionedSuspectIds: [],
  heardWitnessIds: [], unlockedHelperIds: [], unlockedSuspectIds: [], availableHelperIds: [],
});

/** Read live state defensively out of a stored outcome payload. */
export function readCityCrimeSceneLiveState(prev: any): CityCrimeSceneLiveState {
  const s = emptyLiveState();
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  s.revealedClueIds = ids(prev?.revealedClueIds);
  s.introducedSuspectIds = ids(prev?.introducedSuspectIds);
  s.questionedSuspectIds = ids(prev?.questionedSuspectIds);
  s.heardWitnessIds = ids(prev?.heardWitnessIds);
  // Legacy payloads tracked helper unlocks as unlockedWitnessIds.
  s.unlockedHelperIds = ids(prev?.unlockedHelperIds ?? prev?.unlockedWitnessIds);
  s.unlockedSuspectIds = ids(prev?.unlockedSuspectIds);
  s.availableHelperIds = ids(prev?.availableHelperIds);
  return s;
}

/**
 * The map unlocks ONLY initial abilities: discovering a clue whose
 * `unlocksSuspectId`/`unlocksHelperId` is set opens questioning for that
 * suspect / availability for that helper. Pure derivation from revealed clues.
 */
export function ccssUnlocksForRevealedClues(
  config: { clues: CityCrimeSceneClue[] },
  revealedClueIds: string[],
): { unlockedSuspectIds: string[]; availableHelperIds: string[] } {
  const revealed = new Set(revealedClueIds);
  const unlockedSuspectIds = new Set<string>();
  const availableHelperIds = new Set<string>();
  for (const clue of config.clues) {
    if (!revealed.has(clue.id)) continue;
    if (clue.unlocksSuspectId) unlockedSuspectIds.add(clue.unlocksSuspectId);
    if (clue.unlocksHelperId) availableHelperIds.add(clue.unlocksHelperId);
  }
  return { unlockedSuspectIds: [...unlockedSuspectIds], availableHelperIds: [...availableHelperIds] };
}

/** Whether questioning this suspect is open. Cases that define no unlock clue
 *  for a suspect keep questioning open (legacy behavior); a defined unlock
 *  clue must have been discovered first. Detective chooses WHEN after that. */
export function ccssQuestioningOpen(
  config: { clues: CityCrimeSceneClue[] },
  state: CityCrimeSceneLiveState,
  suspectId: string,
): boolean {
  const gated = config.clues.some(c => c.unlocksSuspectId === suspectId);
  if (!gated) return true;
  const derived = ccssUnlocksForRevealedClues(config, state.revealedClueIds).unlockedSuspectIds;
  return state.unlockedSuspectIds.includes(suspectId) || derived.includes(suspectId);
}

/** Whether a clue helper can be used yet (gift unlock still applies on top).
 *  Helpers with no availability clue on the map are available from the start. */
export function ccssHelperAvailable(
  config: { clues: CityCrimeSceneClue[] },
  state: CityCrimeSceneLiveState,
  helperId: string,
): boolean {
  const gated = config.clues.some(c => c.unlocksHelperId === helperId);
  if (!gated) return true;
  const derived = ccssUnlocksForRevealedClues(config, state.revealedClueIds).availableHelperIds;
  return state.availableHelperIds.includes(helperId) || derived.includes(helperId);
}

/** Generalized key evidence for one suspect — the only evidence text that may
 *  appear in suspect-facing materials (rundowns, clue cards). Never specifics. */
export function generalizedKeyEvidence(
  config: { clues: CityCrimeSceneClue[] },
  suspectId: string,
): { clueId: string; title: string; summary: string }[] {
  return config.clues
    .filter(c => (c.relatedSuspectIds || []).includes(suspectId))
    .map(c => ({ clueId: c.id, title: c.title, summary: c.summary || "" }));
}

/**
 * Investigation progress. Pure and testable. The accusation gate requires:
 * every clue revealed, every suspect introduced AND questioned, and every
 * REQUIRED witness heard. Optional helpers are reported but never required.
 */
export function ccssProgress(
  config: { clues: CityCrimeSceneClue[]; suspects: { id: string }[]; witnesses: { id: string }[]; helperWitnesses: { id: string }[] },
  state: CityCrimeSceneLiveState,
): CityCrimeSceneProgress {
  const has = (list: { id: string }[], ids: string[]) => {
    const valid = new Set(list.map(x => x.id));
    return new Set(ids.filter(id => valid.has(id))).size;
  };
  const clues = has(config.clues, state.revealedClueIds);
  const introduced = has(config.suspects, state.introducedSuspectIds);
  const questioned = has(config.suspects, state.questionedSuspectIds);
  const witnesses = has(config.witnesses, state.heardWitnessIds);
  const helpers = has(config.helperWitnesses, state.unlockedHelperIds);
  const gatedSuspects = new Set(config.clues.map(c => c.unlocksSuspectId).filter(Boolean) as string[]);
  const gatedHelpers = new Set(config.clues.map(c => c.unlocksHelperId).filter(Boolean) as string[]);
  const suspectsUnlocked = config.suspects.filter(s => ccssQuestioningOpen(config, state, s.id)).length;
  const helpersAvailable = config.helperWitnesses.filter(h => ccssHelperAvailable(config, state, h.id)).length;
  const complete =
    clues >= config.clues.length &&
    introduced >= config.suspects.length &&
    questioned >= config.suspects.length &&
    witnesses >= config.witnesses.length;
  return {
    clues, cluesTotal: config.clues.length,
    introduced, suspectsTotal: config.suspects.length,
    questioned, questionedTotal: config.suspects.length,
    witnesses, witnessesTotal: config.witnesses.length,
    helpers, helpersTotal: config.helperWitnesses.length,
    suspectsUnlocked, suspectsUnlockedTotal: gatedSuspects.size,
    helpersAvailable, helpersAvailableTotal: gatedHelpers.size,
    complete,
  };
}

/**
 * Field-level patching of a case, shared by the AI draft-edit pipeline
 * (applyBuildChanges) for Jewel case edits. A patch names only what changes:
 * scalar fields replace when provided; collection items (locations, clues,
 * flashbacks, suspects, witnesses, helperWitnesses, timeline, twists) are
 * matched by their existing "id" and merged field-by-field, so omitted fields
 * keep their saved values; an item whose id is new is appended. Mirrors the
 * editor's own rule: marking one suspect guilty clears every other suspect.
 * The merged case is re-normalized and validated; problems are returned so
 * callers can refuse the edit instead of saving a broken case.
 */
const CCSS_PATCH_SCALARS = ["title", "premise", "crime", "actualCrimeDetails", "victim", "backstory", "plot"] as const;
const CCSS_PATCH_NUMBERS = ["suspectCount", "detectiveCount", "interrogationSeconds", "courtroomSeconds"] as const;
const CCSS_PATCH_COLLECTIONS = ["locations", "clues", "flashbacks", "suspects", "witnesses", "helperWitnesses", "timeline", "twists"] as const;
export function mergeCityCrimeSceneMysteryPatch(existingRaw: unknown, patchRaw: unknown): { config: CityCrimeSceneConfig; problems: string[] } {
  const existing = readCityCrimeSceneConfig({ mystery: existingRaw && typeof existingRaw === "object" ? existingRaw : {} });
  if (!patchRaw || typeof patchRaw !== "object" || Array.isArray(patchRaw)) {
    return { config: existing, problems: ["The case edit was not an object — no case changes were applied."] };
  }
  const patch = patchRaw as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing };
  for (const key of CCSS_PATCH_SCALARS) if (typeof patch[key] === "string") merged[key] = patch[key];
  for (const key of CCSS_PATCH_NUMBERS) if (typeof patch[key] === "number" && Number.isFinite(patch[key])) merged[key] = patch[key];
  if (Array.isArray(patch.caseInsightVideoPrompts)) merged.caseInsightVideoPrompts = patch.caseInsightVideoPrompts.filter(x => typeof x === "string");
  for (const key of CCSS_PATCH_COLLECTIONS) {
    const patchItems = patch[key];
    if (!Array.isArray(patchItems)) continue;
    const items = [...(((existing as unknown) as Record<string, unknown>)[key] as Record<string, unknown>[] || [])];
    for (const rawItem of patchItems) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
      const item = rawItem as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      if (!id) continue;
      const idx = items.findIndex(x => x.id === id);
      if (idx >= 0) items[idx] = { ...items[idx], ...item };
      else items.push({ ...item });
    }
    merged[key] = items;
  }
  const config = readCityCrimeSceneConfig({ mystery: merged });
  const patchSuspects = Array.isArray(patch.suspects) ? patch.suspects : [];
  const newlyGuilty = [...patchSuspects].reverse().find(s => !!s && typeof s === "object" && (s as Record<string, unknown>).isGuilty === true && typeof (s as Record<string, unknown>).id === "string") as Record<string, unknown> | undefined;
  if (newlyGuilty) config.suspects = config.suspects.map(s => ({ ...s, isGuilty: s.id === newlyGuilty.id }));
  return { config, problems: validateCityCrimeScene(config) };
}

/** Attaching generated media to a case item (Jewel media actions). */
export type CcssMediaKind = "image" | "video" | "audio";
export type CcssAttachKind = "location" | "clue" | "suspect" | "flashback" | "helper";
export type CcssMediaAttach = { toolId: string; kind: CcssAttachKind; itemId: string; field: string; mediaKind: CcssMediaKind };
const CCSS_ATTACH_FIELDS: Record<CcssAttachKind, Record<string, CcssMediaKind>> = {
  location: { imageKey: "image" },
  clue: { cutSceneVideoKey: "video", audioKey: "audio" },
  suspect: { guideVideoKey: "video" },
  flashback: { videoKey: "video" },
  helper: { portraitKey: "image", videoKey: "video" },
};
const CCSS_ATTACH_COLLECTIONS: Record<CcssAttachKind, "locations" | "clues" | "suspects" | "flashbacks" | "helperWitnesses"> = {
  location: "locations", clue: "clues", suspect: "suspects", flashback: "flashbacks", helper: "helperWitnesses",
};
/**
 * Validate a requested media attachment against the actual draft: the tool
 * must be this project's City Crime Scene tool, the item must exist in the
 * case, and the field must be that item kind's real media field. Accepts
 * saved identity only — never a URL. Throws a plain Error on any mismatch.
 */
export function checkedCcssAttach(raw: unknown, project: { gameTools?: Array<{ id?: string; type?: string; config?: Record<string, unknown> }> }): CcssMediaAttach {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The place to attach the new media was not understood.");
  const input = raw as Record<string, unknown>;
  const toolId = typeof input.toolId === "string" ? input.toolId : "";
  const kind = typeof input.kind === "string" ? input.kind : "";
  const itemId = typeof input.itemId === "string" ? input.itemId : "";
  const field = typeof input.field === "string" ? input.field : "";
  if (!Object.prototype.hasOwnProperty.call(CCSS_ATTACH_FIELDS, kind)) throw new Error("Choose where in the case the new media belongs: a location image, a clue cut scene or audio clip, a suspect guide video, a flashback video, or a helper portrait or intro video.");
  const attachKind = kind as CcssAttachKind;
  const tool = (project?.gameTools || []).find(t => t.id === toolId && t.type === "city-crime-scene");
  if (!tool) throw new Error("The City Crime Scene case to attach media to could not be found in this project.");
  const mediaKind = CCSS_ATTACH_FIELDS[attachKind][field];
  if (!mediaKind) throw new Error(`"${field}" is not a media field for a ${attachKind}.`);
  const config = readCityCrimeSceneConfig(tool.config || {});
  const items = config[CCSS_ATTACH_COLLECTIONS[attachKind]] as Array<{ id: string }>;
  if (!items.some(item => item.id === itemId)) throw new Error(`That ${attachKind} is not part of this case.`);
  return { toolId, kind: attachKind, itemId, field, mediaKind };
}
/** The draft-changes object that writes a finished asset's key onto a case item. */
export function ccssMediaAttachPatch(attach: CcssMediaAttach, assetKey: string): { gameTools: Array<{ id: string; config: { mystery: Record<string, unknown> } }> } {
  const collection = CCSS_ATTACH_COLLECTIONS[attach.kind];
  return { gameTools: [{ id: attach.toolId, config: { mystery: { [collection]: [{ id: attach.itemId, [attach.field]: assetKey }] } } }] };
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
