import type { Project } from "./project";
import type { TemplateDraft } from "./game-templates";

// Game Night templates — the starting points for Off-Stream Multiplayer
// Game Night projects (Jessica's design, 2026-11-15). The Game Night
// builder opens on pictured cards, one per game: picture + name ONLY on
// the card. Clicking a card opens it with a SHORT description of the game
// and a plain prompt — continue with this template, or go back. Continue
// creates the project with the template's starter content, and the
// creator customizes it in Imagine & Create with Jewel. A build-from-
// scratch option sits alongside the shelf, exactly like the Gameshow
// builder.
//
// Each template's starter content is written in the exact shape the
// game-room engine reads out of a published snapshot (lib/game-room.ts
// pickGame + the module extractors), so a project started from a template
// resolves to that template's game and passes multiplayer readiness on
// its content alone. Game-night projects have NO host dashboard, so every
// draft carries game content only — controls are always empty.
//
// This list is deliberately a plain data list: when a new game-night
// module lands in the engine registry, its template is appended here —
// nothing else needs restructuring. A game only appears on this shelf
// once its engine module is live, so a card never promises a game the
// site cannot run yet.

export type GameNightTemplate = {
  id: string;
  /** The lib/game-room.ts module id a project from this template plays. */
  gameType: string;
  name: string;
  /** Short — one or two plain sentences. Shown ONLY in the click-open
   *  view, never on the card. */
  description: string;
  icon: string;
  /** Card artwork. Every card on the shelf today uses the Game Night
   *  kind artwork, the same way every Gameshow template card uses the
   *  Gameshow kind artwork. */
  image: string;
  buildDraft: () => TemplateDraft;
};

const KIND_ART = "/redesign/kind-multiplayer.webp";

const cardsOf = (prefix: string, texts: string[]) =>
  texts.map((text, i) => ({ id: `${prefix}-${i + 1}`, text, design: {} }));

// ---------------------------------------------------------------------------
// Bingo — the classic call-and-mark game
// ---------------------------------------------------------------------------
const bingo: GameNightTemplate = {
  id: "game-night-bingo",
  gameType: "bingo",
  name: "Bingo",
  description:
    "The classic call-and-mark game. Items are called one by one, and the first player to complete a line on their card wins.",
  icon: "🎱",
  image: KIND_ART,
  buildDraft: () => {
    const items = [
      "Birthday Cake", "Beach Ball", "Popcorn", "Disco Ball", "Karaoke Mic",
      "Pizza Slice", "Party Hat", "Balloons", "Confetti", "Dance Floor",
      "Photo Booth", "Gift Box", "Cupcake", "Sunglasses", "Pool Party",
      "Campfire", "Board Game", "Movie Night", "Ice Cream Sundae", "Treasure Hunt",
      "Costume Party", "Talent Show", "Picnic Basket", "Lemonade", "Fireworks",
      "Snow Cone", "Pinata", "Bubble Machine", "Face Paint", "Limbo Stick",
    ];
    return {
      name: "Bingo",
      description: "Classic bingo night — a 30-item call list, ready to play. Rename it, swap in your own items, make it yours.",
      overlay: { title: "BINGO", subtitle: "MARK YOUR CARD · FIRST LINE WINS", showChat: false, showAlerts: false, showCharacter: false },
      gameTools: [
        {
          id: "gn-bingo-pool", type: "card-list", name: "Bingo Call List", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: { cards: cardsOf("gn-bingo-item", items) },
        },
        {
          id: "gn-bingo-picker", type: "random-picker", name: "Bingo Draw", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: { source: "cards", listId: "gn-bingo-pool" },
        },
      ],
      controls: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Quiz Board — categories × point squares, everyone answers
// ---------------------------------------------------------------------------
const quizBoard: GameNightTemplate = {
  id: "game-night-quiz-board",
  gameType: "quiz-board",
  name: "Quiz Board",
  description:
    "A trivia board of categories and point squares. Players take turns picking a square and everyone answers — right answers gain the points, wrong answers lose them.",
  icon: "🧠",
  image: KIND_ART,
  buildDraft: () => ({
    name: "Quiz Board",
    description: "A ready-to-play quiz board: three categories, nine questions. Swap in your own questions and categories with Jewel.",
    overlay: { title: "QUIZ BOARD", subtitle: "PICK A SQUARE · EVERYONE ANSWERS", showChat: false, showAlerts: false, showCharacter: false },
    gameTools: [
      {
        id: "gn-quiz-board", type: "trivia-board", name: "Quiz Board", enabled: true, inToolbox: true, inOverlayBuild: false,
        config: {
          title: "Quiz Board",
          categories: [
            {
              name: "Animals",
              questions: [
                { value: 100, question: "What is the largest land animal in the world?", answer: "African elephant", used: false },
                { value: 200, question: "What is the only mammal that can fly?", answer: "Bat", used: false },
                { value: 300, question: "What is the fastest land animal?", answer: "Cheetah", used: false },
              ],
            },
            {
              name: "Space",
              questions: [
                { value: 100, question: "Which planet is known as the Red Planet?", answer: "Mars", used: false },
                { value: 200, question: "What is the closest star to Earth?", answer: "The Sun", used: false },
                { value: 300, question: "Who was the first person to walk on the Moon?", answer: "Neil Armstrong", used: false },
              ],
            },
            {
              name: "Food",
              questions: [
                { value: 100, question: "What is the main ingredient in guacamole?", answer: "Avocado", used: false },
                { value: 200, question: "Sushi comes from which country?", answer: "Japan", used: false },
                { value: 300, question: "Which fruit is said to keep the doctor away?", answer: "An apple", used: false },
              ],
            },
          ],
        },
      },
    ],
    controls: [],
  }),
};

// ---------------------------------------------------------------------------
// Survey Showdown — guess what the survey said
// ---------------------------------------------------------------------------
const surveyShowdown: GameNightTemplate = {
  id: "game-night-survey-showdown",
  gameType: "survey-showdown",
  name: "Survey Showdown",
  description:
    "Two teams face off to guess what the survey said. Name the most popular answers to clear the board — three strikes and the other team can steal the pot.",
  icon: "📋",
  image: KIND_ART,
  buildDraft: () => ({
    name: "Survey Showdown",
    description: "Three survey questions with ranked answers, ready to play. Ask Jewel for new questions on any theme you like.",
    overlay: { title: "SURVEY SHOWDOWN", subtitle: "GUESS WHAT THE SURVEY SAID", showChat: false, showAlerts: false, showCharacter: false },
    gameTools: [
      {
        id: "gn-survey-board", type: "trivia-board", name: "Survey Board", enabled: true, inToolbox: true, inOverlayBuild: false,
        config: {
          title: "Survey Board",
          categories: [
            {
              name: "Name something you do first thing in the morning",
              questions: [
                { value: 38, answer: "Check your phone" },
                { value: 27, answer: "Brush your teeth" },
                { value: 21, answer: "Drink coffee" },
                { value: 14, answer: "Hit the snooze button" },
              ],
            },
            {
              name: "Name a favorite pizza topping",
              questions: [
                { value: 42, answer: "Pepperoni" },
                { value: 26, answer: "Extra cheese" },
                { value: 18, answer: "Mushrooms" },
                { value: 14, answer: "Peppers" },
              ],
            },
            {
              name: "Name something people bring to the beach",
              questions: [
                { value: 34, answer: "A towel" },
                { value: 29, answer: "Sunscreen" },
                { value: 22, answer: "Snacks" },
                { value: 15, answer: "An umbrella" },
              ],
            },
          ],
        },
      },
    ],
    controls: [],
  }),
};

// ---------------------------------------------------------------------------
// Perfect Match — prompt cards and answer cards
// ---------------------------------------------------------------------------
const perfectMatch: GameNightTemplate = {
  id: "game-night-perfect-match",
  gameType: "perfect-match",
  name: "Perfect Match",
  description:
    "A prompt card is shown and everyone plays an answer card from their hand. The rotating judge picks the best match each round.",
  icon: "💘",
  image: KIND_ART,
  buildDraft: () => {
    const prompts = [
      "Spooky", "Worth a million followers", "Smells amazing", "Best birthday surprise",
      "Loud", "Impossible to ignore", "Cozy", "Lightning fast",
      "From grandma's kitchen", "Pure chaos", "Tiny but mighty", "Better at midnight",
    ];
    const answers = [
      "A haunted house", "Grandma's chili", "A marching band", "Bubble wrap", "A thunderstorm",
      "Fresh-baked bread", "A karaoke machine", "Hot sauce", "A sleepy cat", "Roller skates",
      "A treasure map", "Glitter", "A fog machine", "Pickles", "A disco ball",
      "Thunder", "A warm blanket", "Espresso", "A trumpet", "Confetti",
      "A lighthouse", "Popcorn", "A robot vacuum", "Fireworks", "A hammock",
      "Chili peppers", "A drum kit", "Moonlight", "A waffle iron", "Sparklers",
      "A wool sweater", "A siren", "Honey", "A trampoline", "Stage lights",
      "A campfire",
    ];
    return {
      name: "Perfect Match",
      description: "A matching game with 12 prompt cards and 36 answer cards, ready to deal. Add your own prompts and answers with Jewel.",
      overlay: { title: "PERFECT MATCH", subtitle: "PLAY YOUR BEST MATCH", showChat: false, showAlerts: false, showCharacter: false },
      gameTools: [
        {
          id: "gn-match-prompts", type: "card-list", name: "Prompt Cards", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: { cards: cardsOf("gn-prompt", prompts) },
        },
        {
          id: "gn-match-answers", type: "card-list", name: "Answer Cards", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: { cards: cardsOf("gn-answer", answers) },
        },
      ],
      controls: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Word Chain — one word leads to the next, against the clock
// ---------------------------------------------------------------------------
const wordChain: GameNightTemplate = {
  id: "game-night-word-chain",
  gameType: "word-chain",
  name: "Word Chain",
  description:
    "One word leads to the next against the clock. Repeat a word or run out of time and you take a strike — two strikes and you're out.",
  icon: "🔗",
  image: KIND_ART,
  buildDraft: () => {
    const starters = [
      "Ocean", "Mountain", "River", "Forest", "Desert", "Garden", "Winter",
      "Summer", "Harbor", "Meadow", "Canyon", "Island", "Thunder", "Velvet",
    ];
    return {
      name: "Word Chain",
      description: "A word-chain game with 14 starter words, ready to play. The chain starts from a new starter every game.",
      overlay: { title: "WORD CHAIN", subtitle: "KEEP THE CHAIN GOING", showChat: false, showAlerts: false, showCharacter: false },
      gameTools: [
        {
          id: "gn-word-starters", type: "card-list", name: "Word Starters", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: { cards: cardsOf("gn-starter", starters) },
        },
      ],
      controls: [],
    };
  },
};

// ---------------------------------------------------------------------------
// The shelf — append new game-night templates here as their engine
// modules land; the create flow renders this list as-is.
// ---------------------------------------------------------------------------
export const GAME_NIGHT_TEMPLATES: GameNightTemplate[] = [
  bingo,
  quizBoard,
  surveyShowdown,
  perfectMatch,
  wordChain,
];

export function getGameNightTemplate(id: string): GameNightTemplate | undefined {
  return GAME_NIGHT_TEMPLATES.find((template) => template.id === id);
}

/** Start a project from a game-night template: the project exists with
 *  the template's starter content and kind "multiplayer", no dashboard
 *  controls (a game night has no host), and a first word from Jewel
 *  pointing at customization — the site's model for every template. */
export function applyGameNightTemplate(project: Project, template: GameNightTemplate, nameOverride?: string): Project {
  const draft = template.buildDraft();
  project.name = nameOverride?.trim() || draft.name;
  project.description = draft.description;
  project.overlay = { ...project.overlay, ...draft.overlay };
  project.gameTools = draft.gameTools;
  project.controls = [];
  project.kind = "multiplayer";
  project.templateId = template.id;
  project.prompt = `Started from the "${template.name}" game night template.`;
  project.messages = [{
    role: "assistant",
    text: `Your "${template.name}" game night is ready! ${template.description} Tell me what you want different — the name, the items, the questions — and I'll change it. When it plays the way you want, publish it and share the play link: friends join by name, no account needed, and the game runs itself.`,
  }];
  return project;
}
