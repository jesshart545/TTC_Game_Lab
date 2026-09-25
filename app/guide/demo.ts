export type DemoChapter = {
  title: string;
  area: string;
  narration: string;
  steps: string[];
  result: string;
};

export const demoChapters: DemoChapter[] = [
  {
    title: "See what we're building",
    area: "FINISHED PREVIEW",
    narration: "Before we start, here's where we're going. Neon Trivia Night is a finished TTCGameLab livestream experience: a colorful neon trivia board, host controls, animated reveals, original music, sound effects and a between-round video cut scene. Everything shown in this training is something we build inside TTCGameLab.",
    steps: ["Preview the finished audience Overlay.", "Watch the host trigger a real Dashboard action.", "Return to the empty project and build the same experience step by step."],
    result: "You know what the finished project will look and feel like before we begin."
  },
  {
    title: "Name and protect the working project",
    area: "NEW PROJECT",
    narration: "This is where we start our build. We'll name the project Neon Trivia Night and keep it Private because this is the real project we're going to build and use. Private projects belong to their creator; other people do not get to enter or change the working project.",
    steps: ["Create a new project.", "Name it Neon Trivia Night.", "Choose Private for the working livestream project."],
    result: "Our real working project has a clear name and stays under the creator's control."
  },
  {
    title: "Tell the AI Creative Partner what we're making",
    area: "AI CREATIVE PARTNER",
    narration: "You don't have to write a perfect prompt. Tell your AI partner what you want in normal language. We're making a fast, colorful neon trivia game with a custom title, five categories, animated question moments and simple host controls. If something isn't right later, we'll ask the AI to change it.",
    steps: ["Open the AI conversation in the workspace.", "Describe the neon trivia experience and the controls the host needs.", "Build the first draft and review what TTCGameLab created."],
    result: "We have a starting project we can improve instead of trying to describe everything perfectly up front."
  },
  {
    title: "Generate the trivia game",
    area: "TRIVIA BOARD",
    narration: "Now we'll add the Trivia Board and let TTCGameLab generate the questions. We'll review the categories and clues before using them live, and we'll change anything that doesn't fit our game.",
    steps: ["Add Trivia Board from Game Tools.", "Generate five categories with five clues each.", "Review the questions and customize a category or clue when needed."],
    result: "The game has real playable trivia content instead of a decorative board."
  },
  {
    title: "Turn the board into our show",
    area: "VISUAL DESIGN",
    narration: "The game works, but it doesn't have to look generic. We'll create a dark rainbow-neon game-show background, a custom Neon Trivia Night title sign, glowing board accents and light sparkle effects while keeping the questions easy to read.",
    steps: ["Generate the background and title artwork.", "Add the visuals to the Overlay and arrange their layers.", "Use glow, animation and decorative effects without covering the functional board."],
    result: "A simple trivia mechanic now has a distinct, polished visual identity."
  },
  {
    title: "Keep a good idea that doesn't fit",
    area: "PUBLIC IDEAS",
    narration: "Sometimes a generation is good but wrong for the project you're building. If we make an image that doesn't fit Neon Trivia Night, we don't have to force it into the show or throw the idea away. We can intentionally share that separate idea with our peers while our real working project stays private.",
    steps: ["Review an unused generated visual.", "Keep it out of the private working Overlay.", "Share the separate idea through the Public area when we intentionally want peers to see it."],
    result: "Public sharing can pass along a creative idea without giving anyone access to the private working project."
  },
  {
    title: "Create the opening theme",
    area: "MUSIC",
    narration: "Our show needs an identity before the first question appears. We'll generate a short original theme clip, add it to an action package and connect it to the control that starts the show.",
    steps: ["Generate an original roughly twenty-second game-show theme.", "Add the music to the opening action package.", "Assign the package to the Start Show Dashboard control and test it."],
    result: "Starting the show now has a custom audio identity created for this project."
  },
  {
    title: "Add reactions with generated sound effects",
    area: "SOUND EFFECTS",
    narration: "Live games feel better when actions have immediate feedback. We'll generate applause, cheering and short correct and wrong-answer sounds, then connect them to controls we can reach quickly while hosting.",
    steps: ["Generate the reaction sounds we actually need.", "Build or update the action packages that use them.", "Test each sound from its Dashboard control."],
    result: "Correct answers, misses and wins can have immediate host-triggered reactions."
  },
  {
    title: "Create a between-round video cut scene",
    area: "VIDEO",
    narration: "This is where generated video becomes part of the live experience instead of a separate file. We'll create a short transition clip, place it full-screen on the Overlay and connect it to a Next Round control so the host can break one round from the next without leaving TTCGameLab.",
    steps: ["Generate a short neon round-transition video.", "Add it to a composition and place the result full-screen.", "Assign it to Next Round and trigger it against the Overlay."],
    result: "The host can trigger a real full-screen generated video cut scene between rounds."
  },
  {
    title: "Animate the audience experience",
    area: "OVERLAY ANIMATION",
    narration: "Animation should support the show, not turn it into a slideshow. We'll use the animation controls available in TTCGameLab to give important elements deliberate entrances and exits, then test the exact result viewers will see.",
    steps: ["Select an Overlay result that should animate.", "Choose and tune its supported entrance and exit behavior.", "Test the trigger and keep only animation that plays correctly in the real Overlay."],
    result: "The finished Overlay has movement that the creator can actually reproduce."
  },
  {
    title: "Build the Dashboard around the way you host",
    area: "HOST DASHBOARD",
    narration: "The Dashboard isn't a random remote control. It's your control room. We'll organize the controls around the order of our show and rename them in language that makes sense to us while we're live.",
    steps: ["Keep frequent controls like Correct, Wrong, Applause and Cheer easy to reach.", "Place Start Show, Next Round and the final celebration where they fit the show's flow.", "Rename a technical or unclear control to a personal label such as Big Bang, then test it."],
    result: "The host can run the show from a control surface designed around their own workflow and language."
  },
  {
    title: "Run the trivia from the host side",
    area: "LIVE TRIVIA CONTROL",
    narration: "Now we prove the game works as a livestream experience. From the host side, we'll choose a clue, show it to the audience, reveal the answer, return to the board and continue without asking the audience to see our editing workspace.",
    steps: ["Select a clue from the live host controls.", "Confirm the question and answer states appear correctly on the Overlay.", "Return to the board and confirm the used clue stays unavailable."],
    result: "The creator can operate the playable trivia experience while viewers see only the intended Overlay output."
  },
  {
    title: "Publish and test the real pair",
    area: "DASHBOARD + OVERLAY",
    narration: "Before going live, we test the same two surfaces we'll actually use: the private Host Dashboard and the audience Overlay. A Dashboard action isn't finished until we see and hear the correct reaction on the Overlay.",
    steps: ["Publish the tested project.", "Open the private Host Dashboard and Overlay separately.", "Run Start Show, a trivia clue, a reaction and the round-transition cut scene end to end."],
    result: "The published Dashboard and Overlay behave as one finished livestream experience."
  },
  {
    title: "Watch the finished Neon Trivia Night",
    area: "FINISHED EXPERIENCE",
    narration: "This is the result we built together. The host starts the theme, runs the neon trivia board, reveals questions, triggers reactions, uses the generated video between rounds and finishes with the show's celebration. The editing tools disappear from the audience experience; what remains is the livestream creation.",
    steps: ["Run the opening sequence.", "Play through a short sample round using the real host controls.", "Trigger the between-round video and final celebration."],
    result: "You can see the complete endpoint: an attainable finished livestream built with the TTCGameLab tools demonstrated in this training."
  },
  {
    title: "Start yours",
    area: "READY",
    narration: "You don't have to build Neon Trivia Night. The point is the process: start with your idea, work with the AI Creative Partner, customize the media and Overlay, design controls that make sense to you, test the Dashboard against the Overlay and keep improving until the finished experience feels like yours. TTCGameLab will continue to grow, so your workspace may gain additional options over time.",
    steps: ["Create or sign in to your account.", "Start your own private working project.", "Return to training or Help whenever you need it."],
    result: "You're ready to turn your own idea into a finished TTCGameLab livestream experience."
  }
];
