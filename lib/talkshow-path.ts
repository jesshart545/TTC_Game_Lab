import type { Project, ProjectAsset } from "./project";
import { assetBackdropText, backgroundAssets } from "./backdrop-text";
import { fontCatalog } from "./fonts";

/**
 * Talk Show or Classroom — Imagine and Create path data.
 *
 * Everything the guided path SAYS lives here as data: the step copy, the
 * per-step "Talk to Jewel about…" chips, the example asks (which only fill
 * Jewel's input — nothing here generates or saves), and the "What you can
 * change" lists. Every change named in those lists is a real field of a
 * real editor or a real Jewel capability in this codebase — no invented
 * controls. Demonstrations in the step screens render the project's real
 * saved backdrops, quiz, and tools, or the clearly-labelled examples below.
 */

export type TalkStepId = "sign" | "backdrops" | "research" | "quiz" | "youtube" | "slides" | "toolbox";

export const TALK_STEP_ORDER: TalkStepId[] = ["sign", "backdrops", "research", "quiz", "youtube", "slides", "toolbox"];

export const TALK_CREATIVITY_BANNER = "These are examples, not limits. If you can describe it, Jewel will try to make it happen — this site exists to accommodate your creativity.";

export type TalkStepInfo = {
  id: TalkStepId;
  title: string;
  sub: string;
  status: string;
  cta: string;
  askTitle: string;
  asks: { label: string; ask: string }[];
  adjust: string;
};

export const TALK_STEPS: Record<TalkStepId, TalkStepInfo> = {
  sign: {
    id: "sign",
    title: "Name & sign your show",
    sub: "Your show's name, its theme — and the sign that carries the name onto your backdrop.",
    status: "Your sign is the first thing your audience sees: your title, lettered for real in the font and colors you choose, over artwork made for your show.",
    cta: "Make my sign",
    askTitle: "Talk to Jewel about your sign…",
    asks: [
      { label: "Make my sign", ask: "Make the sign for my show: a backdrop with my show's name lettered on it as a real text layer" },
      { label: "Animated sign backdrop", ask: "Make my sign over an animated backdrop" },
      { label: "Change the sign's font", ask: "Change the font on my sign" },
      { label: "Change the sign's colors", ask: "Change the colors of the lettering on my sign" },
      { label: "Help me name my show", ask: "Help me come up with a name for my show" },
    ],
    adjust: "Name and theme save from the fields on this step — they are yours to type. Jewel only helps with the name when you ask her to.",
  },
  backdrops: {
    id: "backdrops",
    title: "Make your backdrops",
    sub: "The world behind you: animated or artistic, with your words lettered over it when you want them.",
    status: "Backdrops set the scene for every moment of your show. Make a few — your opening look, a teaching look, a quiet one.",
    cta: "Make a backdrop",
    askTitle: "Talk to Jewel about your backdrops…",
    asks: [
      { label: "Animated backdrop", ask: "Make me an animated backdrop for my show" },
      { label: "Artistic backdrop", ask: "Make me an artistic backdrop for my show" },
      { label: "Words over my backdrop", ask: "Put words over my backdrop — I'll tell you the text, font and colors" },
      { label: "Change the words", ask: "Change the text over my backdrop" },
      { label: "A backdrop for a segment", ask: "Make a backdrop for one segment of my show" },
    ],
    adjust: "Any backdrop can go on your overlay from the library below — adding it is the existing background choice, exactly as it works today.",
  },
  research: {
    id: "research",
    title: "Research with Jewel",
    sub: "Jewel looks it up on the web — aimed by your show's theme — and brings back sources, not guesses.",
    status: "Tell Jewel what your show needs to know. Her research follows your theme and style, and her findings can shape your backdrops and your quiz.",
    cta: "Research my topic",
    askTitle: "Talk to Jewel about research…",
    asks: [
      { label: "Research my topic", ask: "Research the topic of my next show" },
      { label: "Find sources for my claims", ask: "Find sources that support what I want to teach in my show" },
      { label: "What's new in my field", ask: "Research what's new in my show's field right now" },
      { label: "Research, then make a backdrop", ask: "Research my topic first, then make a backdrop shaped by what you find" },
      { label: "Research, then build a quiz", ask: "Research my topic first, then build a short quiz from what you find" },
    ],
    adjust: "Jewel's answers cite the sources she found. Ask her to save anything useful as a list in your toolbox.",
  },
  quiz: {
    id: "quiz",
    title: "Build a quiz",
    sub: "Short multiple-choice questions that check what your audience just learned.",
    status: "A few good questions turn viewers into participants. Jewel writes them with the choices — the right answer stays yours until the reveal.",
    cta: "Build my quiz",
    askTitle: "Talk to Jewel about your quiz…",
    asks: [
      { label: "Build a short quiz", ask: "Build me a short multiple-choice quiz for my show" },
      { label: "Quiz from my research", ask: "Build a quiz from the research we did for my show" },
      { label: "More questions", ask: "Add more questions to my quiz" },
      { label: "Change a question", ask: "Change one of my quiz questions" },
      { label: "Style my quiz cards", ask: "Restyle my quiz cards" },
    ],
    adjust: "Your quiz lives in your toolbox as a question list with its cards — edit any question there, exactly as it works today.",
  },
  youtube: {
    id: "youtube",
    title: "Add YouTube",
    sub: "Bring a video into your show — a clip to react to, a lesson to share.",
    status: "With YouTube in your toolbox, you search for and send the video during your show, from your dashboard — nothing plays until you send it.",
    cta: "Add YouTube",
    askTitle: "Talk to Jewel about YouTube…",
    asks: [
      { label: "Add YouTube to my show", ask: "Add the YouTube feature to my show" },
      { label: "How the video moment works", ask: "How does showing a YouTube video during my show work?" },
    ],
    adjust: "YouTube joins your dashboard toolbox. Where its button sits and what it opens is decided in Set the Stage.",
  },
  slides: {
    id: "slides",
    title: "Arrange your slides",
    sub: "Your show's moments, in the order you'll present them.",
    status: "Line up what you made — sign, backdrops, quiz, video, packages — in the order your show will flow. Running them live comes in Set the Stage.",
    cta: "Arrange my slides",
    askTitle: "Talk to Jewel about your slides…",
    asks: [
      { label: "What order works?", ask: "Help me decide a good order for my show's slides" },
      { label: "What am I missing?", ask: "Look at my slides — what is my show missing?" },
    ],
    adjust: "Adding and reordering slides here is yours, by hand — the list below is the deck your show will follow.",
  },
  toolbox: {
    id: "toolbox",
    title: "Review your toolbox",
    sub: "Everything you made, in one place — and every editor that can still change it.",
    status: "This is the review: your sign, backdrops, research, quiz, videos and slides, filed and ready for Set the Stage.",
    cta: "Review my toolbox",
    askTitle: "Talk to Jewel about your show…",
    asks: [
      { label: "What have I made?", ask: "What have I made so far for my show?" },
      { label: "What's still missing?", ask: "What's still missing before I set the stage?" },
    ],
    adjust: "Every manual editor is a door below — they open the same editors that exist today.",
  },
};

/** "What you can change" lists — real fields of real editors/capabilities only. */
export const SIGN_CHANGES: string[] = [
  "The show name — typed by you, saved to your project",
  "The theme & style — typed by you; it aims Jewel's research",
  "The sign's artwork — animated or artistic, made by Jewel",
  "The lettering's font — any font in the site's font catalog",
  "The lettering's colors — the text color and an accent color",
  "Your own uploaded sign — it replaces Jewel's sign when you add it",
];

export const BACKDROP_CHANGES: string[] = [
  "Animated or still — a moving backdrop or an artistic one",
  "The scene itself — describe any place, mood, or style",
  "Words over the backdrop — the text, in your font and colors",
  "Which backdrop opens your show — set on the overlay in Set the Stage",
];

export const QUIZ_CHANGES: string[] = [
  "The questions — yours, or written by Jewel on your topic",
  "The choices — two to six per question",
  "Which choice is right — kept for you until the reveal",
  "The cards' look — colors, font, shape, and placement",
];

/** Example quiz used only when the project has no saved quiz yet. */
export const EXAMPLE_QUIZ: { question: string; options: string[]; correctIndex: number }[] = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter"], correctIndex: 1 },
  { question: "How many sides does a hexagon have?", options: ["Five", "Six", "Eight"], correctIndex: 1 },
  { question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Pacific"], correctIndex: 2 },
];

/** A clearly-labelled sample of what a research answer looks like. */
export const SAMPLE_RESEARCH = {
  heading: "Demonstration — a sample research answer",
  body: "Asked about a classroom show on the water cycle, Jewel would search the web, read the strongest sources, and answer with what they support — something like: “Most classroom sources describe the water cycle in four stages: evaporation, condensation, precipitation, and collection.”",
  sources: ["Source: a national science-education site", "Source: an encyclopedia entry on the water cycle"],
  note: "This sample is a demonstration. Your research answers come from live web results, with their real sources linked.",
};

/** Fonts offered in the backdrop-text demonstration (all real catalog fonts). */
export const DEMO_FONTS: { name: string; family: string }[] = fontCatalog.slice(0, 30).map(font => ({ name: font.name, family: font.family }));

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
