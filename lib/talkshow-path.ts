import type { Project, ProjectAsset } from "./project";
import { assetBackdropText, backgroundAssets } from "./backdrop-text";
import { fontCatalog } from "./fonts";
import type { ChangeItem } from "./gameshow-path";

/**
 * Talk Show or Classroom — Imagine and Create path data.
 *
 * Everything the guided path SAYS lives here as data, in the same shape
 * the Gameshow path uses (lib/gameshow-path.ts): per-step meta (kicker,
 * one-subject intro, a short done-when line, a short Jewel note), example
 * asks as quoted chips (which only fill Jewel's input — nothing here
 * generates or saves), and "What you can change" lists of ChangeItems.
 * Every change named in those lists is a real field of a real editor or a
 * real Jewel capability in this codebase — no invented controls.
 * Demonstrations in the step screens render the project's real saved
 * backdrops, quiz, and tools, or the clearly-labelled examples below.
 * Step completeness never lives here: it comes only from
 * lib/workflow-progress.ts (evaluateWorkflow).
 */

export type TalkStepId = "sign" | "backdrops" | "research" | "quiz" | "youtube" | "slides" | "toolbox";

export const TALK_STEP_ORDER: TalkStepId[] = ["sign", "backdrops", "research", "quiz", "youtube", "slides", "toolbox"];

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
  sign: {
    id: "sign",
    kicker: "Step 1 of 7",
    intro: "One subject here: what your show is called, what it's about — and the sign that puts the name on screen. Set the name and theme right here; Jewel letters the sign.",
    doneWhen: "your show has a real name, and a sign exists — Jewel's lettered sign, or one you uploaded.",
    jewelNote: "Tell me the look and I'll make your sign — artwork made for your show, your title lettered over it in your font and colors. I only help with the name when you ask.",
    asks: [
      { chip: "“Make my sign — gold letters, cozy studio”", say: "Make the sign for my show: a backdrop with my show's name lettered on it as a real text layer" },
      { chip: "“An animated backdrop behind my sign”", say: "Make my sign over an animated backdrop" },
      { chip: "“Change the sign's font”", say: "Change the font on my sign" },
      { chip: "“Help me name my show”", say: "Help me come up with a name for my show" },
    ],
    adjust: "Name and theme are typed by you, in the fields on this step. Jewel helps with the name only if you ask her.",
  },
  backdrops: {
    id: "backdrops",
    kicker: "Step 2 of 7",
    intro: "One subject here: the world behind you. Watch a backdrop play, switch the lettering over one live — then describe yours to Jewel.",
    doneWhen: "at least one backdrop is saved with your backgrounds.",
    jewelNote: "Describe the scene and I'll make your backdrop — animated or artistic — and letter your words over it in any catalog font. It lands with your backgrounds, ready for the overlay.",
    asks: [
      { chip: "“An animated backdrop — a cozy studio, lamplight”", say: "Make me an animated backdrop for my show" },
      { chip: "“An artistic backdrop for my teaching segment”", say: "Make me an artistic backdrop for my show" },
      { chip: "“Words over my backdrop — my font, my colors”", say: "Put words over my backdrop — I'll tell you the text, font and colors" },
      { chip: "“A backdrop for my guest segment”", say: "Make a backdrop for one segment of my show" },
    ],
    adjust: "Putting a backdrop on your overlay is the existing background choice — tap one on the shelf on this step.",
  },
  research: {
    id: "research",
    kicker: "Step 3 of 7",
    intro: "One subject here: what your show needs to know. Jewel searches the web, aimed by your theme — and answers with sources, not guesses.",
    doneWhen: "Jewel has run a web search in this project — her findings and their sources are in your conversation with her.",
    jewelNote: "Ask me to look something up and I'll search the web, aimed by your theme, and answer with the sources I found. Then we can turn the findings into a backdrop or a quiz.",
    asks: [
      { chip: "“Research the topic of my next show”", say: "Research the topic of my next show" },
      { chip: "“Find sources for what I teach”", say: "Find sources that support what I want to teach in my show" },
      { chip: "“Research first, then build my quiz”", say: "Research my topic first, then build a short quiz from what you find" },
    ],
    adjust: "Jewel's answers cite the sources she found. Ask her to save anything useful as a list in your toolbox.",
  },
  quiz: {
    id: "quiz",
    kicker: "Step 4 of 7",
    intro: "One subject here: a short multiple-choice quiz. Flip the cards — the answer stays on the back until the reveal — then have Jewel build yours.",
    doneWhen: "a quiz with at least one multiple-choice question is saved in your toolbox.",
    jewelNote: "Give me a topic — or the research we did — and I'll write the questions with their choices. The right answers stay on my side until you reveal them.",
    asks: [
      { chip: "“A short quiz on my topic”", say: "Build me a short multiple-choice quiz for my show" },
      { chip: "“Build the quiz from our research”", say: "Build a quiz from the research we did for my show" },
      { chip: "“More questions for my quiz”", say: "Add more questions to my quiz" },
      { chip: "“Restyle my quiz cards”", say: "Restyle my quiz cards" },
    ],
    adjust: "Your quiz lives in your toolbox as a question list with its cards — edit any question there, exactly as it works today.",
  },
  youtube: {
    id: "youtube",
    kicker: "Step 5 of 7",
    intro: "One subject here: bringing a video into your show — a clip to react to, a lesson to share. Nothing plays until you send it, live, from your dashboard.",
    doneWhen: "the YouTube tool is in your toolbox, ready for your dashboard.",
    jewelNote: "Say the word and I'll add the YouTube feature to your toolbox. During the show you search and send videos from your dashboard — nothing plays on its own.",
    asks: [
      { chip: "“Add YouTube to my show”", say: "Add the YouTube feature to my show" },
      { chip: "“How does the video moment work?”", say: "How does showing a YouTube video during my show work?" },
    ],
    adjust: "Where YouTube's button sits, and what it opens, is decided in Set the Stage.",
  },
  slides: {
    id: "slides",
    kicker: "Step 6 of 7",
    intro: "One subject here: your show's moments, in the order you'll present them. Line the deck up here — running it live comes in Set the Stage.",
    doneWhen: "your deck holds at least two slides, in the order your show will follow.",
    jewelNote: "Reordering the deck is your hands on this step, not mine — but ask me what order works, or what your show is missing, and I'll look at it with you.",
    asks: [
      { chip: "“What order works for my show?”", say: "Help me decide a good order for my show's slides" },
      { chip: "“What is my show missing?”", say: "Look at my slides — what is my show missing?" },
    ],
    adjust: "Adding and reordering slides is yours, by hand — the deck on this step is the order your show will follow.",
  },
  toolbox: {
    id: "toolbox",
    kicker: "Step 7 of 7",
    intro: "Everything you've made, in one place — your sign, backdrops, research, quiz, videos and slides — and a door to every manual editor, exactly as it works today.",
    doneWhen: "every earlier step is complete, and you have opened this review. Then the path is complete: head to Set the Stage when you're ready to place it all.",
    jewelNote: "Anything on any earlier step can be remade or changed from here too — just say what you want different.",
    asks: [
      { chip: "“What have I made so far?”", say: "What have I made so far for my show?" },
      { chip: "“What's still missing?”", say: "What's still missing before I set the stage?" },
    ],
  },
};

/** "What you can change" lists — real fields of real editors/capabilities only. */
export const SIGN_CHANGES: ChangeItem[] = [
  { label: "Show name", sub: "Typed by you, in the field on this step — saved to your project" },
  { label: "Theme & style", sub: "Typed by you, in the field on this step — it aims Jewel's research" },
  { label: "The sign's artwork — animated or artistic", say: "Make the sign for my show over an animated backdrop" },
  { label: "The lettering's font", sub: "Any font in the site's catalog — try them above", say: "Change the font on my sign" },
  { label: "The lettering's colors", sub: "The text color and an accent color", say: "Change the colors of the lettering on my sign" },
  { label: "Your own uploaded sign", sub: "Replaces Jewel's sign — uploaded on this step, used exactly as you made it" },
];

export const BACKDROP_CHANGES: ChangeItem[] = [
  { label: "Animated or still", sub: "A moving backdrop or an artistic one", say: "Make me an animated backdrop for my show" },
  { label: "The scene itself", sub: "Any place, mood, or style you can describe", say: "Make me an artistic backdrop for my show" },
  { label: "Words over the backdrop", sub: "The text, in your font and colors — switch them above", say: "Put words over my backdrop — I'll tell you the text, font and colors" },
  { label: "Which backdrop opens your show", sub: "Set on the overlay in Set the Stage" },
];

export const RESEARCH_CHANGES: ChangeItem[] = [
  { label: "The topic you ask about", say: "Research the topic of my next show" },
  { label: "What aims the search", sub: "Your theme & style — set on the Name & sign step" },
  { label: "Findings into a backdrop", say: "Research my topic first, then make a backdrop shaped by what you find" },
  { label: "Findings into a quiz", say: "Research my topic first, then build a short quiz from what you find" },
];

export const QUIZ_CHANGES: ChangeItem[] = [
  { label: "The questions", sub: "Yours, or written by Jewel on your topic", say: "Build me a short multiple-choice quiz for my show" },
  { label: "The choices", sub: "Two to six per question", say: "Add more questions to my quiz" },
  { label: "Which choice is right", sub: "Kept for you until the reveal — never shown early" },
  { label: "The cards' look", sub: "Colors, font, shape, and placement", say: "Restyle my quiz cards" },
];

export const YOUTUBE_CHANGES: ChangeItem[] = [
  { label: "Nothing is placed for you", sub: "YouTube waits in your toolbox: you search privately on your dashboard during the show, and Play sends the video to the overlay — the audience never sees the search" },
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

/**
 * Fonts offered in the sign/backdrop lettering demonstration: the site's
 * real display fonts — the self-hosted catalog faces (the ones carrying a
 * font file), picked for sign character across the catalog's groups. The
 * system stacks that open the catalog (Arial, Georgia, Verdana, Trebuchet
 * MS, Monospace) are never offered here: a sign is lettered in a display
 * face, the way the product actually letters it.
 */
const DEMO_FONT_NAMES = ["Bebas Neue", "Playfair Display", "Pacifico", "Anton", "Cinzel", "Montserrat"];
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
