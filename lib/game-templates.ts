import type { GameTool, ProjectEvent } from "./project";

export type TemplateCategory =
  | "Trivia & Knowledge"
  | "Word Games"
  | "Visual Guessing"
  | "Chance & Giveaways"
  | "Puzzle & Adventure";

export type TemplateDraft = {
  name: string;
  description: string;
  overlay: {
    title: string;
    subtitle: string;
    showChat: boolean;
    showAlerts: boolean;
    showCharacter: boolean;
  };
  gameTools: GameTool[];
  controls: ProjectEvent[];
};

export type GameTemplate = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  category: TemplateCategory | "Restricted";
  buildDraft: () => TemplateDraft;
  restricted?: boolean;
};

const cardSkin = (bg: string, accent: string) => ({
  questionCard: { backgroundColor: bg, textColor: "#ffffff", accentColor: accent, fontSize: 36 },
  answerCard: { backgroundColor: "#1c1030", textColor: "#ffffff", accentColor: "#ffd166", fontSize: 36 },
});

// ---------------------------------------------------------------------------
// 1. Trivia Night — classic Q&A trivia board with live team scoring
// ---------------------------------------------------------------------------
const triviaNight: GameTemplate = {
  id: "trivia-night",
  name: "Trivia Night",
  tagline: "Classic Q&A showdown with live team scoring",
  description:
    "The headliner. A Jeopardy-style trivia board with 10 ready-to-play questions across four categories, a question card for dramatic reveals, and a four-team scoreboard. Swap in your own questions and you're live.",
  icon: "🧠",
  category: "Trivia & Knowledge",
  buildDraft: () => ({
    name: "Trivia Night",
    description: "Classic Q&A trivia board with live team scoring. Edit the questions, rename the teams, go live.",
    overlay: { title: "TRIVIA NIGHT", subtitle: "THINK FAST · SCORE BIG", showChat: true, showAlerts: true, showCharacter: false },
    gameTools: [
      {
        id: "tn-board", type: "trivia-board", name: "Trivia Board", enabled: true, inToolbox: false, inOverlayBuild: true,
        config: { placement: {x:10,y:10,width:80,height:75},
          title: "Trivia Night Board",
          categories: [
            {
              name: "General Knowledge",
              questions: [
                { value: 100, question: "What is the largest planet in our solar system?", answer: "Jupiter", used: false },
                { value: 200, question: "How many continents are there on Earth?", answer: "7", used: false },
                { value: 300, question: "In what year did the Berlin Wall fall?", answer: "1989", used: false },
              ],
            },
            {
              name: "Movies & Music",
              questions: [
                { value: 100, question: "Which movie features the song “My Heart Will Go On”?", answer: "Titanic", used: false },
                { value: 200, question: "Who is known as the King of Pop?", answer: "Michael Jackson", used: false },
                { value: 300, question: "Which actor played Forrest Gump?", answer: "Tom Hanks", used: false },
              ],
            },
            {
              name: "Science",
              questions: [
                { value: 100, question: "What is H2O commonly known as?", answer: "Water", used: false },
                { value: 200, question: "What force keeps our feet on the ground?", answer: "Gravity", used: false },
              ],
            },
            {
              name: "Sports",
              questions: [
                { value: 100, question: "How many players does a soccer team field at once?", answer: "11", used: false },
                { value: 200, question: "In which sport would you perform a slam dunk?", answer: "Basketball", used: false },
              ],
            },
          ],
        },
      },
      {
        id: "tn-pool", type: "trivia-list", name: "Trivia Question Pool", enabled: true, inToolbox: false,
        config: {
          questions: [
            { question: "What is the largest planet in our solar system?", answer: "Jupiter", category: "General Knowledge" },
            { question: "How many continents are there on Earth?", answer: "7", category: "General Knowledge" },
            { question: "In what year did the Berlin Wall fall?", answer: "1989", category: "General Knowledge" },
            { question: "Which movie features the song “My Heart Will Go On”?", answer: "Titanic", category: "Movies & Music" },
            { question: "Who is known as the King of Pop?", answer: "Michael Jackson", category: "Movies & Music" },
            { question: "Which actor played Forrest Gump?", answer: "Tom Hanks", category: "Movies & Music" },
            { question: "What is H2O commonly known as?", answer: "Water", category: "Science" },
            { question: "What force keeps our feet on the ground?", answer: "Gravity", category: "Science" },
            { question: "How many players does a soccer team field at once?", answer: "11", category: "Sports" },
            { question: "In which sport would you perform a slam dunk?", answer: "Basketball", category: "Sports" },
          ],
        },
      },
      {
        id: "tn-card", type: "question-card", name: "Question Card", enabled: true, inToolbox: true, inOverlayBuild: true,
        config: { placement: {x:20,y:20,width:60,height:55}, poolId: "tn-pool", ...cardSkin("#101827", "#20e8ff") },
      },
      {
        id: "tn-scores", type: "scoreboard", name: "Team Scores", enabled: true, inToolbox: true, inOverlayBuild: true,
        config: { placement: {x:72,y:12,width:24,height:55},
          entries: [
            { id: "team-alpha", name: "Team Alpha", score: 0 },
            { id: "team-bravo", name: "Team Bravo", score: 0 },
            { id: "team-charlie", name: "Team Charlie", score: 0 },
            { id: "team-delta", name: "Team Delta", score: 0 },
          ],
        },
      },
    ],
    controls: [
      { id: "tn-show", label: "Show Question", action: "cards.show.tn-card", detail: "Draw an unused trivia question", toolIds: ["tn-card"] },
      { id: "tn-reveal", label: "Reveal Answer", action: "cards.reveal.tn-card", detail: "Reveal the answer when the host is ready", toolIds: ["tn-card"] },
      { id: "tn-clear", label: "Clear Card", action: "cards.clear.tn-card", detail: "Hide the question or answer", toolIds: ["tn-card"] },
      { id: "tn-new", label: "New Round", action: "cards.new-game.tn-card", detail: "Reset used questions for a fresh round", toolIds: ["tn-card"] },
      { id: "tn-board", label: "Show Trivia Board", action: "tool.tn-board", detail: "Display the full category board", toolIds: ["tn-board"] },
      { id: "tn-scores", label: "Show Scores", action: "cards.toggle.tn-scores", detail: "Show or hide the team scoreboard", toolIds: ["tn-scores"] },
    ],
  }),
};

// ---------------------------------------------------------------------------
// 2. Million Quiz — money-ladder quiz, $100 to $1,000,000
// ---------------------------------------------------------------------------
const millionQuiz: GameTemplate = {
  id: "million-quiz",
  name: "Million Quiz",
  tagline: "Climb the money ladder to $1,000,000",
  description:
    "Who-Wants-to-Be-a-Millionaire style. Ten escalating questions from $100 to $1,000,000, a winnings tracker, and lifelines. One wrong answer ends the run — the drama is built in.",
  icon: "💰",
  category: "Trivia & Knowledge",
  buildDraft: () => {
    const rungs: { value: string; question: string; answer: string }[] = [
      { value: "$100", question: "What color do you get when you mix blue and yellow?", answer: "Green" },
      { value: "$200", question: "How many days are there in a leap year?", answer: "366" },
      { value: "$500", question: "What is the capital of France?", answer: "Paris" },
      { value: "$1,000", question: "Which planet is known as the Red Planet?", answer: "Mars" },
      { value: "$5,000", question: "Who wrote “Romeo and Juliet”?", answer: "William Shakespeare" },
      { value: "$10,000", question: "What is the chemical symbol for gold?", answer: "Au" },
      { value: "$50,000", question: "In what year did humans first land on the Moon?", answer: "1969" },
      { value: "$100,000", question: "What is the largest ocean on Earth?", answer: "The Pacific Ocean" },
      { value: "$500,000", question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci" },
      { value: "$1,000,000", question: "What is the only metal that is liquid at room temperature?", answer: "Mercury" },
    ];
    const controls: ProjectEvent[] = [
      { id: "mq-show", label: "Show Question", action: "cards.show.mq-card", detail: "Draw the next ladder question", toolIds: ["mq-card"] },
      { id: "mq-reveal", label: "Reveal Answer", action: "cards.reveal.mq-card", detail: "Reveal the answer", toolIds: ["mq-card"] },
      { id: "mq-clear", label: "Clear Card", action: "cards.clear.mq-card", detail: "Hide the question or answer", toolIds: ["mq-card"] },
      { id: "mq-ladder", label: "Show Money Ladder", action: "tool.mq-board", detail: "Display the full money ladder", toolIds: ["mq-board"] },
      { id: "mq-winnings", label: "Show Winnings", action: "cards.toggle.mq-winnings", detail: "Show or hide the winnings tracker", toolIds: ["mq-winnings"] },
      { id: "mq-lifelines", label: "Show Lifelines", action: "cards.toggle.mq-lifelines", detail: "Show the remaining lifelines", toolIds: ["mq-lifelines"] },
      { id: "mq-new", label: "New Quiz", action: "cards.new-game.mq-card", detail: "Reset the ladder for a new contestant", toolIds: ["mq-card"] },
      ...rungs.map((rung, i) => ({
        id: `mq-rung-${i + 1}`,
        label: `Play ${rung.value}`,
        action: "cards.show.mq-card",
        detail: `Play the ${rung.value} question`,
        toolIds: ["mq-card"],
      })),
    ];
    return {
      name: "Million Quiz",
      description: "Money-ladder quiz from $100 to $1,000,000 with lifelines and a winnings tracker.",
      overlay: { title: "MILLION QUIZ", subtitle: "ONE QUESTION AWAY FROM $1,000,000", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "mq-board", type: "trivia-board", name: "Money Ladder", enabled: true, inToolbox: false, inOverlayBuild: true,
          config: { placement: {x:10,y:10,width:80,height:75},
            title: "Money Ladder",
            categories: [
              {
                name: "The Ladder",
                questions: rungs.map((rung) => ({ value: rung.value, question: rung.question, answer: rung.answer, used: false })),
              },
            ],
          },
        },
        {
          id: "mq-pool", type: "trivia-list", name: "Ladder Question Pool", enabled: true, inToolbox: false,
          config: { questions: rungs.map((rung) => ({ question: rung.question, answer: rung.answer, category: rung.value })) },
        },
        {
          id: "mq-card", type: "question-card", name: "Million Question Card", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55}, poolId: "mq-pool", ...cardSkin("#0d1b2a", "#ffd166") },
        },
        {
          id: "mq-winnings", type: "scoreboard", name: "Winnings", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55}, entries: [{ id: "contestant", name: "Contestant", score: 0 }] },
        },
        {
          id: "mq-lifelines", type: "game-tool-list", name: "Lifelines", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:65,y:15,width:30,height:60},
            entries: [
              { id: "fifty", name: "50:50", meaning: "Remove two wrong answers" },
              { id: "phone", name: "Phone a Friend", meaning: "Call someone for 30 seconds of help" },
              { id: "audience", name: "Ask the Audience", meaning: "Chat votes on the answer" },
            ],
          },
        },
      ],
      controls,
    };
  },
};

// ---------------------------------------------------------------------------
// 3. Guess the Word — hidden-word letter board with progressive reveals
// ---------------------------------------------------------------------------
const guessTheWord: GameTemplate = {
  id: "guess-the-word",
  name: "Guess the Word",
  tagline: "Reveal letters until chat cracks the word",
  description:
    "A Wheel-of-Fortune-style letter board pre-loaded with the sample word STREAMER. Reveal letters one at a time while viewers shout guesses — the host types the current reveal state into the word card.",
  icon: "🔤",
  category: "Word Games",
  buildDraft: () => {
    const sampleWord = "STREAMER";
    const letters = sampleWord.split("");
    const areas = letters.map((letter, i) => ({
      id: `gw-letter-${i + 1}`,
      label: "_",
      x: 8 + i * 10.5,
      y: 35,
      width: 9,
      height: 22,
      controlId: "",
    }));
    return {
      name: "Guess the Word",
      description: "Hidden-word letter board. Reveal letters live; chat guesses the word. Sample word: STREAMER.",
      overlay: { title: "GUESS THE WORD", subtitle: "SHOUT YOUR GUESSES IN CHAT", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "gw-board", type: "blank-board", name: "Letter Board", enabled: true, inToolbox: false, inOverlayBuild: true,
          config: { placement: {x:10,y:10,width:80,height:75},
            title: "Mystery Word — 8 letters",
            areas,
            sampleWord,
            hint: "Sample word: STREAMER. Rename letters as you reveal them, or rebuild the grid for your own word.",
          },
        },
        {
          id: "gw-word", type: "blank-card", name: "Word Reveal Card", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55},
            sampleText: "_ _ _ _ _ _ _ _",
            hint: "Type the current reveal state (e.g. S _ R E A _ E R) in the card panel, then press Reveal Letters.",
          },
        },
        {
          id: "gw-scores", type: "scoreboard", name: "Word Scores", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55},
            entries: [
              { id: "player-1", name: "Player 1", score: 0 },
              { id: "player-2", name: "Player 2", score: 0 },
              { id: "player-3", name: "Player 3", score: 0 },
              { id: "player-4", name: "Player 4", score: 0 },
            ],
          },
        },
      ],
      controls: [
        { id: "gw-board-show", label: "Show Letter Board", action: "tool.gw-board", detail: "Display the letter grid", toolIds: ["gw-board"] },
        { id: "gw-reveal", label: "Reveal Letters", action: "cards.blank.gw-word", detail: "Show the current letter state — type it in the card panel first (e.g. S _ R E A _ E R)", toolIds: ["gw-word"] },
        { id: "gw-hide", label: "Hide Word Card", action: "cards.clear.gw-word", detail: "Hide the word card", toolIds: ["gw-word"] },
        { id: "gw-scores", label: "Show Scores", action: "cards.toggle.gw-scores", detail: "Show or hide the scoreboard", toolIds: ["gw-scores"] },
      ],
    };
  },
};
// ---------------------------------------------------------------------------
// 4. Word Association — prompt word with round-by-round associations
// ---------------------------------------------------------------------------
const wordAssociation: GameTemplate = {
  id: "word-association",
  name: "Word Association",
  tagline: "One prompt word, endless connections",
  description:
    "Flash a prompt word, reveal its associations round by round, and score whoever matches the most. Ships with five ready rounds (OCEAN, FIRE, MUSIC, SPACE, JUNGLE) — swap in your own in seconds.",
  icon: "🧩",
  category: "Word Games",
  buildDraft: () => {
    const rounds = [
      { prompt: "OCEAN", associations: ["Wave", "Beach", "Blue", "Fish", "Tide"] },
      { prompt: "FIRE", associations: ["Flame", "Hot", "Smoke", "Campfire", "Alarm"] },
      { prompt: "MUSIC", associations: ["Song", "Dance", "Concert", "Guitar", "Rhythm"] },
      { prompt: "SPACE", associations: ["Stars", "Moon", "Rocket", "Alien", "Planet"] },
      { prompt: "JUNGLE", associations: ["Lion", "Trees", "Wild", "Vines", "Adventure"] },
    ];
    return {
      name: "Word Association",
      description: "Prompt-word association game with 5 sample rounds and live scoring.",
      overlay: { title: "WORD ASSOCIATION", subtitle: "MATCH THE ASSOCIATIONS · SCORE POINTS", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "wa-card", type: "blank-card", name: "Prompt Word Card", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55},
            sampleText: "OCEAN",
            sampleAssociations: rounds[0].associations,
            hint: "Type the prompt word in the card panel and press Show Prompt. Reveal associations one per round.",
          },
        },
        {
          id: "wa-rounds", type: "card-list", name: "Round Bank", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: {
            cards: rounds.map((round, i) => ({
              id: `wa-round-${i + 1}`,
              text: `Round ${i + 1} — Prompt: ${round.prompt}\nAssociations: ${round.associations.join(", ")}`,
              design: {},
            })),
          },
        },
        {
          id: "wa-scores", type: "scoreboard", name: "Association Scores", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55},
            entries: [
              { id: "player-1", name: "Player 1", score: 0 },
              { id: "player-2", name: "Player 2", score: 0 },
              { id: "player-3", name: "Player 3", score: 0 },
              { id: "player-4", name: "Player 4", score: 0 },
            ],
          },
        },
      ],
      controls: [
        { id: "wa-prompt", label: "Show Prompt Word", action: "cards.blank.wa-card", detail: "Display the prompt word — type it in the card panel first", toolIds: ["wa-card"] },
        { id: "wa-hide", label: "Hide Prompt", action: "cards.clear.wa-card", detail: "Hide the prompt word card", toolIds: ["wa-card"] },
        { id: "wa-scores", label: "Show Scores", action: "cards.toggle.wa-scores", detail: "Show or hide the scoreboard", toolIds: ["wa-scores"] },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 5. Guess the Logo — zoomed logo stages, host reveals step by step
// ---------------------------------------------------------------------------
const guessTheLogo: GameTemplate = {
  id: "guess-the-logo",
  name: "Guess the Logo",
  tagline: "Zoomed-in logos, big guesses",
  description:
    "Show a logo in extreme close-up, then zoom out in stages until chat names it. Five sample logo rounds with scripted reveal stages — upload your own logo images and crop tighter for harder rounds.",
  icon: "👁️",
  category: "Visual Guessing",
  buildDraft: () => {
    const rounds = [
      {
        answer: "A famous soft-drink logo",
        stages: [
          "Stage 1 — Extreme close-up: a curved ribbon of red against white.",
          "Stage 2 — Zoom out: white script lettering appears on the red ribbon.",
          "Stage 3 — Full reveal: the full wordmark on a red disc.",
        ],
      },
      {
        answer: "A famous fruit-tech logo",
        stages: [
          "Stage 1 — Extreme close-up: a smooth silver curve with a small bite-like notch.",
          "Stage 2 — Zoom out: the curve resolves into a bitten fruit silhouette.",
          "Stage 3 — Full reveal: the complete monochrome fruit logo.",
        ],
      },
      {
        answer: "A famous fast-food arches logo",
        stages: [
          "Stage 1 — Extreme close-up: a single golden arch curve on red.",
          "Stage 2 — Zoom out: a second arch appears — the iconic “M” takes shape.",
          "Stage 3 — Full reveal: the golden arches, full and centered.",
        ],
      },
      {
        answer: "A famous swoosh sportswear logo",
        stages: [
          "Stage 1 — Extreme close-up: a sharp black check-like flick.",
          "Stage 2 — Zoom out: the flick stretches into the full swoosh.",
          "Stage 3 — Full reveal: the swoosh with the brand name beneath.",
        ],
      },
      {
        answer: "A famous coffee-siren logo",
        stages: [
          "Stage 1 — Extreme close-up: green waves and a hint of a crown.",
          "Stage 2 — Zoom out: a twin-tailed figure emerges in the circle.",
          "Stage 3 — Full reveal: the full green siren emblem.",
        ],
      },
    ];
    return {
      name: "Guess the Logo",
      description: "Logo guessing with staged zoom reveals. 5 sample rounds with scripted stages.",
      overlay: { title: "GUESS THE LOGO", subtitle: "NAME THAT BRAND BEFORE THE FULL REVEAL", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "gl-card", type: "blank-card", name: "Logo Reveal Card", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55},
            sampleText: rounds[0].stages[0],
            hint: "Paste the current stage description (or upload your logo image as an overlay asset) then press Show Stage.",
          },
        },
        {
          id: "gl-rounds", type: "card-list", name: "Logo Rounds", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: {
            cards: rounds.map((round, i) => ({
              id: `gl-round-${i + 1}`,
              text: `Round ${i + 1} — Answer: ${round.answer}\n${round.stages.join("\n")}`,
              design: {},
            })),
          },
        },
        {
          id: "gl-scores", type: "scoreboard", name: "Logo Scores", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55},
            entries: [
              { id: "player-1", name: "Player 1", score: 0 },
              { id: "player-2", name: "Player 2", score: 0 },
              { id: "player-3", name: "Player 3", score: 0 },
              { id: "player-4", name: "Player 4", score: 0 },
            ],
          },
        },
      ],
      controls: [
        { id: "gl-stage", label: "Show Stage", action: "cards.blank.gl-card", detail: "Display the current zoom stage — paste the stage text in the card panel first", toolIds: ["gl-card"] },
        { id: "gl-hide", label: "Hide Logo Card", action: "cards.clear.gl-card", detail: "Hide the logo card between stages", toolIds: ["gl-card"] },
        { id: "gl-scores", label: "Show Scores", action: "cards.toggle.gl-scores", detail: "Show or hide the scoreboard", toolIds: ["gl-scores"] },
      ],
    };
  },
};
// ---------------------------------------------------------------------------
// 6. Picture Reveal — tile-cover image reveal, tiles come off one by one
// ---------------------------------------------------------------------------
const pictureReveal: GameTemplate = {
  id: "picture-reveal",
  name: "Picture Reveal",
  tagline: "Tiles come off, the picture comes out",
  description:
    "Cover an image with a 12-tile grid and remove tiles while chat guesses what it is. The host reveals tiles on their image and tracks progress live on the tile card.",
  icon: "🖼️",
  category: "Visual Guessing",
  buildDraft: () => {
    const tiles = Array.from({ length: 12 }, (_, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return {
        id: `pr-tile-${i + 1}`,
        label: `Tile ${i + 1}`,
        x: 6 + col * 23,
        y: 12 + row * 28,
        width: 21,
        height: 26,
        controlId: "",
      };
    });
    return {
      name: "Picture Reveal",
      description: "Tile-cover image reveal with a 12-tile grid and live progress tracking.",
      overlay: { title: "PICTURE REVEAL", subtitle: "GUESS THE PICTURE BEFORE IT'S FULLY REVEALED", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "pr-board", type: "blank-board", name: "Reveal Grid", enabled: true, inToolbox: false, inOverlayBuild: true,
          config: { placement: {x:10,y:10,width:80,height:75},
            title: "Mystery Picture — 12 tiles",
            areas: tiles,
            hint: "Place your image behind this grid (overlay asset or board background). Remove or relabel tiles as you reveal them.",
          },
        },
        {
          id: "pr-tiles", type: "blank-card", name: "Tiles Removed", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55},
            sampleText: "Tiles removed: —",
            hint: "Type the removed tile numbers (e.g. “Tiles removed: 3, 7, 11”) in the card panel, then press Update Tiles.",
          },
        },
        {
          id: "pr-scores", type: "scoreboard", name: "Reveal Scores", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55},
            entries: [
              { id: "player-1", name: "Player 1", score: 0 },
              { id: "player-2", name: "Player 2", score: 0 },
              { id: "player-3", name: "Player 3", score: 0 },
              { id: "player-4", name: "Player 4", score: 0 },
            ],
          },
        },
      ],
      controls: [
        { id: "pr-grid", label: "Show Reveal Grid", action: "tool.pr-board", detail: "Display the 12-tile grid over your image", toolIds: ["pr-board"] },
        { id: "pr-update", label: "Update Tiles", action: "cards.blank.pr-tiles", detail: "Show removed tile numbers — type them in the card panel first", toolIds: ["pr-tiles"] },
        { id: "pr-hide", label: "Hide Tile Card", action: "cards.clear.pr-tiles", detail: "Hide the tile tracker", toolIds: ["pr-tiles"] },
        { id: "pr-scores", label: "Show Scores", action: "cards.toggle.pr-scores", detail: "Show or hide the scoreboard", toolIds: ["pr-scores"] },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 7. Prize Draw Wheel — spinning prize wheel with winner tracking
// ---------------------------------------------------------------------------
const prizeDrawWheel: GameTemplate = {
  id: "prize-draw-wheel",
  name: "Prize Draw Wheel",
  tagline: "Spin the wheel, crown a winner",
  description:
    "The giveaway machine. An 8-prize wheel, a draw-entries list, and a prize tracker that records who won what. Add your viewers as entries and spin live.",
  icon: "🎡",
  category: "Chance & Giveaways",
  buildDraft: () => ({
    name: "Prize Draw Wheel",
    description: "Spinning prize wheel with 8 sample prizes, draw entries, and winner tracking.",
    overlay: { title: "PRIZE DRAW", subtitle: "GOOD LUCK — SPIN TO WIN", showChat: true, showAlerts: true, showCharacter: false },
    gameTools: [
      {
        id: "pd-wheel", type: "wheel", name: "Prize Wheel", enabled: true, inToolbox: true, inOverlayBuild: true,
        config: { placement: {x:25,y:15,width:50,height:65},
          title: "Prize Wheel",
          segments: [
            "$25 Gift Card",
            "Free Subscription",
            "Mystery Box",
            "Channel Shoutout",
            "Bonus Entry",
            "Merch Pack",
            "Game Key",
            "JACKPOT",
          ],
        },
      },
      {
        id: "pd-entries", type: "card-list", name: "Draw Entries", enabled: true, inToolbox: true, inOverlayBuild: false,
        config: {
          cards: ["LuckyViewer42", "ChatChamp", "NightOwl", "PixelFan", "StreamSniper", "ModSquad"].map((name, i) => ({
            id: `pd-entry-${i + 1}`,
            text: name,
            design: {},
          })),
        },
      },
      {
        id: "pd-prizes", type: "prize-list", name: "Prize Tracker", enabled: true, inToolbox: true, inOverlayBuild: true,
        config: { placement: {x:65,y:15,width:30,height:60},
          entries: [
            { id: "pd-prize-1", name: "$25 Gift Card" },
            { id: "pd-prize-2", name: "Free Subscription" },
            { id: "pd-prize-3", name: "Mystery Box" },
            { id: "pd-prize-4", name: "Channel Shoutout" },
            { id: "pd-prize-5", name: "Bonus Entry" },
            { id: "pd-prize-6", name: "Merch Pack" },
            { id: "pd-prize-7", name: "Game Key" },
            { id: "pd-prize-8", name: "JACKPOT" },
          ],
        },
      },
    ],
    controls: [
      { id: "pd-spin", label: "Spin the Wheel", action: "tool.pd-wheel", detail: "Spin the prize wheel live", toolIds: ["pd-wheel"] },
      { id: "pd-prizes", label: "Show Prizes", action: "cards.toggle.pd-prizes", detail: "Show the prize tracker — award winners in its host panel", toolIds: ["pd-prizes"] },
      { id: "pd-hide", label: "Hide Wheel", action: "tool.pd-wheel", detail: "Remove the wheel from the overlay", toolIds: ["pd-wheel"] },
    ],
  }),
};
// ---------------------------------------------------------------------------
// 8. Playlist Bingo — music bingo with live song draws
// ---------------------------------------------------------------------------
const playlistBingo: GameTemplate = {
  id: "playlist-bingo",
  name: "Playlist Bingo",
  tagline: "Music bingo — mark your card",
  description:
    "Music bingo for the stream. A 24-song pool, a random song draw with no repeats, and a called-songs card so chat can track along. Play the clips, call the songs, first bingo wins.",
  icon: "🎵",
  category: "Chance & Giveaways",
  buildDraft: () => {
    const songs = [
      "Bohemian Rhapsody — Queen",
      "Billie Jean — Michael Jackson",
      "Shape of You — Ed Sheeran",
      "Rolling in the Deep — Adele",
      "Uptown Funk — Mark Ronson ft. Bruno Mars",
      "Smells Like Teen Spirit — Nirvana",
      "Hey Ya! — Outkast",
      "Dancing Queen — ABBA",
      "Sweet Child O' Mine — Guns N' Roses",
      "Blinding Lights — The Weeknd",
      "Hotel California — Eagles",
      "Respect — Aretha Franklin",
      "Imagine — John Lennon",
      "Lose Yourself — Eminem",
      "Wonderwall — Oasis",
      "Halo — Beyoncé",
      "Viva la Vida — Coldplay",
      "Bad Guy — Billie Eilish",
      "Take On Me — a-ha",
      "Superstition — Stevie Wonder",
      "All Star — Smash Mouth",
      "Watermelon Sugar — Harry Styles",
      "Don't Stop Believin' — Journey",
      "Levitating — Dua Lipa",
    ];
    return {
      name: "Playlist Bingo",
      description: "Music bingo with a 24-song pool, random no-repeat draws, and called-song tracking.",
      overlay: { title: "PLAYLIST BINGO", subtitle: "HEAR IT · MARK IT · SHOUT BINGO", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "pb-songs", type: "card-list", name: "Song Pool", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: {
            cards: songs.map((song, i) => ({ id: `pb-song-${i + 1}`, text: song, design: {} })),
          },
        },
        {
          id: "pb-picker", type: "random-picker", name: "Song Draw", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { source: "cards", listId: "pb-songs", placement: { x: 15, y: 20, width: 70, height: 60 } },
        },
        {
          id: "pb-called", type: "blank-card", name: "Called Songs", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55},
            sampleText: "Called so far: —",
            hint: "Type the called songs in the card panel (e.g. “Called: Billie Jean, Halo, …”) then press Show Called Songs.",
          },
        },
        {
          id: "pb-scores", type: "scoreboard", name: "Bingo Scores", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55},
            entries: [
              { id: "player-1", name: "Player 1", score: 0 },
              { id: "player-2", name: "Player 2", score: 0 },
              { id: "player-3", name: "Player 3", score: 0 },
              { id: "player-4", name: "Player 4", score: 0 },
            ],
          },
        },
      ],
      controls: [
        { id: "pb-draw", label: "Draw a Song", action: "cards.toggle.pb-picker", detail: "Draw a random unused song — no repeats this game", toolIds: ["pb-picker"] },
        { id: "pb-called", label: "Show Called Songs", action: "cards.blank.pb-called", detail: "Display the called-songs list — type it in the card panel first", toolIds: ["pb-called"] },
        { id: "pb-hide", label: "Hide Called Songs", action: "cards.clear.pb-called", detail: "Hide the called-songs card", toolIds: ["pb-called"] },
        { id: "pb-scores", label: "Show Scores", action: "cards.toggle.pb-scores", detail: "Show or hide the scoreboard", toolIds: ["pb-scores"] },
        { id: "pb-new", label: "New Bingo Game", action: "cards.new-game.pb-picker", detail: "Reset the draw history for a fresh game", toolIds: ["pb-picker"] },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 9. Escape Room — puzzle-room framework with clues, locks, and a timer
// ---------------------------------------------------------------------------
const escapeRoom: GameTemplate = {
  id: "escape-room",
  name: "Create Your Own Escape Room",
  tagline: "Clues, locks, and a ticking clock",
  description:
    "A puzzle-room framework for the stream. Five ready-made puzzles with solutions and lock codes, an active-puzzle card with dramatic reveals, a combination-lock card, and a 60-minute countdown. Chat solves together — beat the clock.",
  icon: "🔐",
  category: "Puzzle & Adventure",
  buildDraft: () => {
    const puzzles = [
      {
        title: "The Riddle Painting",
        question: "PUZZLE 1 — The Riddle Painting: “I have keys but open no locks. I have space but no room. You can enter, but you can't go outside. What am I?”",
        answer: "A KEYBOARD — lock code: 7-3-9",
      },
      {
        title: "The Number Safe",
        question: "PUZZLE 2 — The Number Safe: “What comes once in a minute, twice in a moment, but never in a thousand years?”",
        answer: "The letter M — lock code: 1-3-1",
      },
      {
        title: "The Ancient Map",
        question: "PUZZLE 3 — The Ancient Map: “The more of me you take, the more you leave behind. What am I?”",
        answer: "FOOTSTEPS — lock code: 8-8-8",
      },
      {
        title: "The Locked Diary",
        question: "PUZZLE 4 — The Locked Diary: “I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?”",
        answer: "An ECHO — lock code: 4-1-4",
      },
      {
        title: "The Final Door",
        question: "PUZZLE 5 — The Final Door: “What has a head and a tail, but no body?”",
        answer: "A COIN — lock code: 5-0-5",
      },
    ];
    return {
      name: "Create Your Own Escape Room",
      description: "Puzzle-room framework: 5 sample puzzles with solutions and lock codes, 60-minute timer.",
      overlay: { title: "ESCAPE ROOM", subtitle: "SOLVE THE PUZZLES · BEAT THE CLOCK", showChat: true, showAlerts: true, showCharacter: false },
      gameTools: [
        {
          id: "er-clues", type: "card-list", name: "All Puzzle Cards", enabled: true, inToolbox: true, inOverlayBuild: false,
          config: {
            cards: puzzles.map((puzzle, i) => ({
              id: `er-puzzle-${i + 1}`,
              text: `${puzzle.question}\nSolution: ${puzzle.answer}`,
              design: {},
            })),
          },
        },
        {
          id: "er-pool", type: "trivia-list", name: "Puzzle Pool", enabled: true, inToolbox: false,
          config: {
            questions: puzzles.map((puzzle) => ({ question: puzzle.question, answer: puzzle.answer, category: puzzle.title })),
          },
        },
        {
          id: "er-active", type: "question-card", name: "Active Puzzle", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55}, poolId: "er-pool", ...cardSkin("#141021", "#b388ff") },
        },
        {
          id: "er-timer", type: "countdown", name: "Escape Timer", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:40,y:10,width:20,height:15}, seconds: 3600 },
        },
        {
          id: "er-lock", type: "blank-card", name: "Combination Lock", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:20,y:20,width:60,height:55},
            sampleText: "LOCK 1: _ _ _",
            hint: "Type the lock state (e.g. “LOCK 1: 7 _ 9”) in the card panel, then press Show Lock.",
          },
        },
        {
          id: "er-progress", type: "scoreboard", name: "Puzzles Solved", enabled: true, inToolbox: true, inOverlayBuild: true,
          config: { placement: {x:72,y:12,width:24,height:55}, entries: [{ id: "escape-team", name: "Escape Team", score: 0 }] },
        },
      ],
      controls: [
        { id: "er-show", label: "Show Active Puzzle", action: "cards.show.er-active", detail: "Draw an unsolved puzzle", toolIds: ["er-active"] },
        { id: "er-reveal", label: "Reveal Solution", action: "cards.reveal.er-active", detail: "Reveal the puzzle solution and lock code", toolIds: ["er-active"] },
        { id: "er-hide", label: "Hide Puzzle", action: "cards.clear.er-active", detail: "Hide the active puzzle", toolIds: ["er-active"] },
        { id: "er-lock-show", label: "Show Lock", action: "cards.blank.er-lock", detail: "Display the combination lock — type its state in the card panel first", toolIds: ["er-lock"] },
        { id: "er-lock-hide", label: "Hide Lock", action: "cards.clear.er-lock", detail: "Hide the combination lock", toolIds: ["er-lock"] },
        { id: "er-timer-show", label: "Show Timer", action: "timer.show.er-timer", detail: "Display the 60-minute timer without starting it", toolIds: ["er-timer"] },
        { id: "er-timer-toggle", label: "Start / Pause Timer", action: "timer.toggle.er-timer", detail: "Start the countdown — press again to pause", toolIds: ["er-timer"] },
        { id: "er-timer-hide", label: "Hide Timer", action: "timer.hide.er-timer", detail: "Hide the timer from the audience overlay", toolIds: ["er-timer"] },
        { id: "er-timer-reset", label: "Reset Timer", action: "timer.reset.er-timer", detail: "Restore 60 minutes and stop the countdown", toolIds: ["er-timer"] },
        { id: "er-progress", label: "Show Progress", action: "cards.toggle.er-progress", detail: "Show puzzles-solved progress", toolIds: ["er-progress"] },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 10. City Crime Scene — restricted improv whodunnit (entitled accounts only)
// ---------------------------------------------------------------------------
const cityCrimeScene: GameTemplate = {
  id: "city-crime-scene",
  name: "City Crime Scene",
  tagline: "Improv whodunnit mystery game — Law & Order style",
  description:
    "A reusable improv-style murder mystery game. The host builds a case with suspects, clues, and twists; detectives investigate, interrogate, and accuse. For entitled accounts only.",
  icon: "🔍",
  category: "Restricted",
  restricted: true,
  buildDraft: () => ({
    name: "City Crime Scene",
    description: "Improv whodunnit mystery game. Customize the case, suspects, and clues.",
    overlay: {
      title: "CITY CRIME SCENE",
      subtitle: "A MURDER MYSTERY",
      showChat: true,
      showAlerts: true,
      showCharacter: false,
    },
    gameTools: [
      {
        id: `city-crime-scene-${Date.now()}`,
        type: "city-crime-scene" as any,
        name: "City Crime Scene",
        enabled: true,
        config: {},
      },
    ],
    controls: [],
  }),
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const GAME_TEMPLATES: GameTemplate[] = [
  triviaNight,
  millionQuiz,
  guessTheWord,
  wordAssociation,
  guessTheLogo,
  pictureReveal,
  prizeDrawWheel,
  playlistBingo,
  escapeRoom,
  cityCrimeScene,
];

export function getGameTemplate(id: string): GameTemplate | undefined {
  return GAME_TEMPLATES.find((template) => template.id === id);
}

// ---------------------------------------------------------------------------
// Instantiate a template's game into an EXISTING project (additive).
// Every tool and control id is remapped to a fresh UUID so a template can be
// added repeatedly without collisions, and every internal reference
// (control toolIds, action strings, chain refIds, config poolId/listId)
// is rewritten to the new ids. Returns undefined for unknown or
// unauthorized (restricted) templates.
// ---------------------------------------------------------------------------
const TEMPLATE_CONFIG_ID_KEYS = ["poolId", "listId"] as const;

export function instantiateTemplateTools(
  templateId: string,
  opts?: { ccssEntitled?: boolean }
): { gameTools: GameTool[]; controls: ProjectEvent[] } | undefined {
  const template = getGameTemplate(templateId);
  if (!template) return undefined;
  if (template.restricted && !opts?.ccssEntitled) return undefined;
  const draft = template.buildDraft();
  const idMap = new Map<string, string>();
  for (const tool of draft.gameTools) idMap.set(tool.id, crypto.randomUUID());
  const remapId = (id: string) => idMap.get(id) ?? id;
  const remapAction = (action: string): string => {
    if (action.startsWith("tool.")) return "tool." + remapId(action.slice(5));
    if (action.startsWith("cards.")) {
      const lastDot = action.lastIndexOf(".");
      if (lastDot > 6) {
        const toolId = action.slice(lastDot + 1);
        const mapped = idMap.get(toolId);
        if (mapped) return action.slice(0, lastDot + 1) + mapped;
      }
    }
    return action;
  };
  const gameTools: GameTool[] = draft.gameTools.map((tool) => {
    const config: Record<string, unknown> = { ...tool.config };
    for (const key of TEMPLATE_CONFIG_ID_KEYS) {
      if (typeof config[key] === "string") config[key] = remapId(config[key] as string);
    }
    return { ...tool, id: idMap.get(tool.id)!, config: { ...config, templateId: template.id } };
  });
  const controls: ProjectEvent[] = draft.controls.map((control) => ({
    ...control,
    id: crypto.randomUUID(),
    toolIds: (control.toolIds || []).map(remapId),
    action: remapAction(control.action),
    chain: (control.chain || []).map((step) => ({
      ...step,
      id: crypto.randomUUID(),
      refId: step.kind === "tool" ? remapId(step.refId) : step.refId,
    })),
  }));
  return { gameTools, controls };
}
