import type { Project, ProjectAsset } from "./project";
import { assetBackdropText, backgroundAssets } from "./backdrop-text";
import { fontCatalog } from "./fonts";
import type { ChangeItem } from "./gameshow-path";

/**
 * Talk Show or Classroom — Imagine and Create path data, in the layout
 * Jessica dictated (2026-11-04) after judging the earlier page "way too
 * much going on": eight areas, one subject each, in HER order — theme &
 * subject first (the box Jewel checks off once answered), background,
 * title sign (which Jewel suggests once a background exists), opening
 * prompt, then the optional areas: research, quiz or follow-up questions,
 * media, and "Anything we missed?". Governing rules: SHOW, don't describe
 * — every capability is demonstrated with a real visual — and the goal is
 * always to keep the user engaged and on task.
 *
 * Everything the path SAYS lives here as data, in the Gameshow shape
 * (per-area meta, quoted example asks, "What you can change" lists).
 * Every change named in those lists is a real field of a real editor or
 * a real Jewel capability. Area completeness never lives here: it comes
 * only from lib/workflow-progress.ts (evaluateWorkflow).
 */

export type TalkStepId = "theme" | "background" | "sign" | "prompt" | "research" | "quiz" | "media" | "missed";

export const TALK_STEP_ORDER: TalkStepId[] = ["theme", "background", "sign", "prompt", "research", "quiz", "media", "missed"];

/** The optional areas: a skip counts as complete (Jessica, 2026-11-04). */
export const TALK_SKIPPABLE_STEPS: TalkStepId[] = ["research", "quiz", "media", "missed"];

/** The tool types that belong to a talk show's own creation space: the
 * quiz and its cards, and YouTube. Gameshow tools (wheels, boards,
 * scoreboards, dice…) are never pictured or listed in a talk project —
 * the talk toolbox shows talk pieces only (Jessica, 2026-11-03). */
export const TALK_TOOL_TYPES: readonly string[] = ["trivia-list", "question-card", "blank-card", "card-list", "youtube"];

export const TALK_CREATIVITY_BANNER = "These are examples, not limits. If you can describe it, Jewel will try to make it happen — this site exists to accommodate your creativity.";

export type TalkStepInfo = {
  id: TalkStepId;
  kicker: string;
  intro: string;
  doneWhen: string;
  jewelNote: string;
  asks: { chip: string; say: string }[];
  adjust?: string;
};

export const TALK_STEPS: Record<TalkStepId, TalkStepInfo> = {
  theme: {
    id: "theme",
    kicker: "Step 1 of 8",
    intro: "One subject here: what your show is all about. Type it in the box — Jewel checks this box off the moment it's answered.",
    doneWhen: "you've typed what your show is all about in the theme & subject box.",
    jewelNote: "This one aims everything I do for you — my research, your sign's flavor, your questions. Give me the show in a line or two.",
    asks: [
      { chip: "“My show is about…”", say: "My show is about: " },
      { chip: "“Help me say what my show is about”", say: "Help me write a line about what my show is all about" },
    ],
    adjust: "Your title itself is set with Rename at the top of the page; the theme was asked first when your show was created — this box is where it lives and grows.",
  },
  background: {
    id: "background",
    kicker: "Step 2 of 8",
    intro: "One subject here: the world behind you. First let's decide on a background (flat/animated) — see both, then design yours with Jewel.",
    doneWhen: "a background is saved with your show — a flat one or an animated one.",
    jewelNote: "Describe the scene and I'll design your background with you — flat and artistic, or animated and alive. It lands with your show, ready for the stage.",
    asks: [
      { chip: "“Design my background with me”", say: "Design a background for my show with me" },
      { chip: "“An animated backdrop — a cozy studio, lamplight”", say: "Make me an animated backdrop for my show" },
      { chip: "“A flat, artistic backdrop for my show”", say: "Make me a flat, artistic backdrop for my show" },
    ],
    adjust: "Putting a backdrop on your overlay is the existing background choice — tap one on the shelf on this step.",
  },
  sign: {
    id: "sign",
    kicker: "Step 3 of 8",
    intro: "One subject here: your title sign — your show's name, lettered over the background you just designed. Jewel suggests it now that your background exists.",
    doneWhen: "a sign exists — Jewel's lettered sign, or one you uploaded.",
    jewelNote: "Your background is ready, so here's my suggestion: let's add your title sign. I'll letter your title over it in your font and colors — real lettering, never baked in.",
    asks: [
      { chip: "“Add my title sign”", say: "Add the title sign for my show over my background" },
      { chip: "“My sign — gold letters, cozy studio”", say: "Make the sign for my show: a backdrop with my show's name lettered on it as a real text layer" },
      { chip: "“Change the sign's font”", say: "Change the font on my sign" },
      { chip: "“Help me name my show”", say: "Help me come up with a name for my show" },
    ],
    adjust: "Your title comes from you — tell Jewel, or set it with Rename at the top of the page, and she letters the sign from it.",
  },
  prompt: {
    id: "prompt",
    kicker: "Step 4 of 8",
    intro: "One subject here: your opening prompt — the talking point that appears as text on your background, in a thought bubble, a frame, or plain.",
    doneWhen: "your opening prompt is set on your background, in the font and color you chose.",
    jewelNote: "Give me the talking point and I'll set it on your background — you pick the words, the font, the color, and the bubble, frame, or plain look.",
    asks: [
      { chip: "“Set my opening prompt”", say: "Set my opening prompt on my background — I'll tell you the words" },
      { chip: "“Suggest a talking point for my show”", say: "Suggest a good opening talking point for my show" },
      { chip: "“Put my prompt in a thought bubble”", say: "Put my opening prompt in a thought bubble" },
    ],
    adjust: "The words, font, color, and bubble/frame/plain are chosen right on this step — your hands, saved as you choose.",
  },
  research: {
    id: "research",
    kicker: "Step 5 of 8",
    intro: "One subject here: backup for your talking point. Ask Jewel to help with research on your topic/talking point — she brings data points, with sources.",
    doneWhen: "Jewel has run a web search in this project — her data points and their sources are in your conversation with her.",
    jewelNote: "Ask me to look into your talking point and I'll search the web, aimed by your theme, and bring back data points with their sources.",
    asks: [
      { chip: "“Research my talking point”", say: "Research my talking point and give me data points with sources" },
      { chip: "“Find data points for my prompt”", say: "Find data points that support my opening prompt" },
      { chip: "“Research first, then build my questions”", say: "Research my talking point first, then help me build questions from what you find" },
    ],
    adjust: "Optional — skip it and it still counts as complete. Jewel's answers always cite the sources she found.",
  },
  quiz: {
    id: "quiz",
    kicker: "Step 6 of 8",
    intro: "One subject here: questions for your audience. Quiz your class, or create follow-up questions for your prompt — two paths, both through Jewel.",
    doneWhen: "a quiz is saved, or your follow-up question cards exist.",
    jewelNote: "First I'll ask: should this be a quiz? If yes, I'll ask how you want it to work, then generate it. If you'd rather follow up, I'll suggest questions from your prompt and you'll design the cards.",
    asks: [
      { chip: "“Quiz my class on my prompt”", say: "I want a quiz for my class — ask me how I want it to work, then build it" },
      { chip: "“Suggest follow-up questions for my prompt”", say: "Suggest good follow-up questions based on my opening prompt" },
      { chip: "“Build the quiz from our research”", say: "Build a quiz from the research we did for my show" },
      { chip: "“Restyle my cards”", say: "Restyle my question cards" },
    ],
    adjust: "Optional — skip it and it still counts as complete. A quiz's right answers stay on your side until the reveal, always.",
  },
  media: {
    id: "media",
    kicker: "Step 7 of 8",
    intro: "One subject here: the extras that play. Upload your media here, add a YouTube moment, or have Jewel make an opening, a song, or a cutscene.",
    doneWhen: "media beyond your background and sign is filed — an upload, a made clip, or YouTube added to your dashboard.",
    jewelNote: "An opening sequence and theme song, a short commercial cutscene, a video moment — tap an example and I'll make it with you, or upload your own and it files here.",
    asks: [
      { chip: "“Make an opening sequence and theme song”", say: "Make an opening sequence and theme song for my show" },
      { chip: "“Make a short commercial cutscene”", say: "Make a short commercial cutscene for my show" },
      { chip: "“Add YouTube to my dashboard”", say: "Add the YouTube feature to my show" },
    ],
    adjust: "Optional — skip it and it still counts as complete. Nothing plays until you send it, live, from your dashboard.",
  },
  missed: {
    id: "missed",
    kicker: "Step 8 of 8",
    intro: "One subject here: anything else. Anything we missed? Tell Jewel any other idea you have for your talk show — she'll try to handle it.",
    doneWhen: "you've opened this review of everything you've made — or told Jewel there's nothing else.",
    jewelNote: "Any other ideas for your show that we haven't mentioned? Tell me, and I'll try to handle them. Everything you've made is below, and every editor door is here too.",
    asks: [
      { chip: "“I have another idea for my show”", say: "I have another idea for my show: " },
      { chip: "“What else could my show use?”", say: "What else could my show use that we haven't covered?" },
      { chip: "“What have I made so far?”", say: "What have I made so far for my show?" },
    ],
    adjust: "Optional — skip it and it still counts as complete. Complete never locks: every area stays open to change, any time.",
  },
};

/** "What you can change" lists — real fields of real editors/capabilities only. */
export const THEME_CHANGES: ChangeItem[] = [
  { label: "What your show is all about", sub: "Typed in the box on this step — it aims Jewel's research", say: "My show is about: " },
  { label: "Your show's title", sub: "Set with Rename at the top of the page, or tell Jewel", say: "My show's title is: " },
];

export const SIGN_CHANGES: ChangeItem[] = [
  { label: "Your show's title", sub: "Yours to give — tell Jewel and she sets it on your project", say: "My show's title is: " },
  { label: "The sign's artwork — animated or artistic", say: "Make the sign for my show over an animated backdrop" },
  { label: "The lettering's font", sub: "Any display font in the site's catalog — name it to Jewel", say: "Change the font on my sign" },
  { label: "The lettering's colors", sub: "The text color and an accent color — name them to Jewel", say: "Change the colors of the lettering on my sign" },
];

export const BACKDROP_CHANGES: ChangeItem[] = [
  { label: "Flat or animated", sub: "A still, artistic backdrop — or one that moves and loops", say: "Design a background for my show with me" },
  { label: "The scene itself", sub: "Any place, mood, or style you can describe", say: "Make me an artistic backdrop for my show" },
  { label: "Words over the backdrop", sub: "Your opening prompt — set on the Opening prompt step, in your font and colors", say: "Set my opening prompt on my background" },
  { label: "Which backdrop opens your show", sub: "Set on the overlay in Set the Stage" },
];

export const PROMPT_CHANGES: ChangeItem[] = [
  { label: "The words", sub: "Your opening prompt or talking point, typed on this step" },
  { label: "The font", sub: "A display font from the site's catalog — the chips on this step, or name any catalog font to Jewel", say: "Change the font of my opening prompt" },
  { label: "The color of the text", sub: "The color chips on this step", say: "Change the color of my opening prompt" },
  { label: "Thought bubble, frame, or plain", sub: "How the words sit on your background — switch it live on this step" },
];

export const RESEARCH_CHANGES: ChangeItem[] = [
  { label: "The topic you ask about", sub: "Your talking point — or any topic for your show", say: "Research my talking point and give me data points with sources" },
  { label: "What aims the search", sub: "Your theme & subject — the one in the first box" },
  { label: "Data points into questions", say: "Research my talking point first, then help me build questions from what you find" },
  { label: "Data points into a backdrop", say: "Research my topic first, then make a backdrop shaped by what you find" },
];

export const QUIZ_CHANGES: ChangeItem[] = [
  { label: "Quiz or follow-ups", sub: "Jewel asks which one first — then how you want it to work", say: "I want questions for my show — ask me quiz or follow-ups first" },
  { label: "The questions", sub: "Yours, or suggested by Jewel from your prompt and research", say: "Suggest good follow-up questions based on my opening prompt" },
  { label: "The choices (quiz)", sub: "Two to six per question", say: "Add more questions to my quiz" },
  { label: "Which choice is right", sub: "Kept for you until the reveal — never shown early" },
  { label: "The cards' look", sub: "Your own background, text color, font and all — in the card designer", say: "Restyle my question cards" },
];

export const MEDIA_CHANGES: ChangeItem[] = [
  { label: "Your uploads", sub: "Filed here from the upload button — images, clips, and sounds for your show" },
  { label: "An opening sequence & theme song", sub: "Made with Jewel — tap the example", say: "Make an opening sequence and theme song for my show" },
  { label: "A commercial cutscene", sub: "A short made clip for a break in your show", say: "Make a short commercial cutscene for my show" },
  { label: "YouTube on your dashboard", sub: "You search privately during the show and send the video to your backdrop — the audience never sees the search", say: "Add the YouTube feature to my show" },
];

export const SLIDES_CHANGES: ChangeItem[] = [
  { label: "The order", sub: "By hand — the arrows on each deck row. Jewel can advise on the order, never reorder it herself" },
  { label: "What goes in the deck", sub: "Anything you've made — sign, backdrops, quiz, YouTube, packages, placed media" },
];

/** Example quiz used only when the project has no saved quiz yet. */
export const EXAMPLE_QUIZ: { question: string; options: string[]; correctIndex: number }[] = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter"], correctIndex: 1 },
  { question: "How many sides does a hexagon have?", options: ["Five", "Six", "Eight"], correctIndex: 1 },
  { question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Pacific"], correctIndex: 2 },
];

/** A clearly-labelled sample research answer, demonstrated interactively:
 * the sample question on a card, its findings revealed one tap at a time,
 * each with its source — the shape of every real answer Jewel gives. */
export const SAMPLE_RESEARCH = {
  question: "“What should my class know about the water cycle?”",
  findings: [
    { text: "Most classroom sources describe the water cycle in four stages: evaporation, condensation, precipitation, and collection.", source: "Source · a national science-education site" },
    { text: "About 96.5% of Earth's water sits in the oceans — the freshwater a class drinks is a small share, mostly ice and groundwater.", source: "Source · an encyclopedia entry on the water cycle" },
  ],
  note: "A demonstration — your answers come from live web results, with their real sources linked.",
};

/** The sample opening prompt lettered in the Prompt step's examples. */
export const SAMPLE_PROMPT = "Tonight's talking point: small habits, big change";

/**
 * Fonts offered in the lettering demonstrations: the site's real display
 * fonts — the self-hosted catalog faces (the ones carrying a font file),
 * picked for sign character across the catalog's groups. The system
 * stacks that open the catalog (Arial, Georgia, Verdana, Trebuchet MS,
 * Monospace) are never offered here: a sign is lettered in a display
 * face, the way the product actually letters it.
 */
const DEMO_FONT_NAMES = ["Bebas Neue", "Playfair Display", "Pacifico", "Anton", "Cinzel", "Bungee", "Monoton", "Montserrat"];
export const DEMO_FONTS: { name: string; family: string }[] = DEMO_FONT_NAMES
  .map(name => fontCatalog.find(font => font.name === name))
  .filter((font): font is (typeof fontCatalog)[number] => Boolean(font && "file" in font))
  .map(font => ({ name: font.name, family: font.family }));

/** Color pairs offered in the backdrop-text demonstration. */
export const DEMO_COLOR_PAIRS: { name: string; textColor: string; accentColor: string }[] = [
  { name: "Gold on the night", textColor: "#ffd700", accentColor: "#b3123f" },
  { name: "Clean white", textColor: "#ffffff", accentColor: "#20e8ff" },
  { name: "Rose & cream", textColor: "#ffe9f3", accentColor: "#ff5d8f" },
  { name: "Mint & lime", textColor: "#d9ffe8", accentColor: "#37e08b" },
];

/** The project's sign backdrop asset, or the first background to letter over. */
export function demoBackdrop(project: Project): ProjectAsset | null {
  const backgrounds = backgroundAssets(project);
  return backgrounds.find(asset => asset.sign) || backgrounds[0] || null;
}

/** The text spec a demo should show: the asset's own, or a starter over the show name. */
export function demoTextSpec(project: Project, asset: ProjectAsset | null): { text: string; fontFamily: string; textColor: string; accentColor?: string } {
  const own = assetBackdropText(asset);
  if (own) return own;
  return {
    text: (project.name || "Your Show").trim() || "Your Show",
    fontFamily: DEMO_FONTS[0]?.family || "Georgia, serif",
    textColor: "#ffd700",
    accentColor: "#b3123f",
  };
}
