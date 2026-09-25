export type DemoChapter = {
  title: string;
  area: string;
  narration: string;
  steps: string[];
  result: string;
};

export const demoChapters: DemoChapter[] = [
  {
    title: "Welcome to TTCGameLab",
    area: "START HERE",
    narration: "This guided demo uses a fictional creator and project. Nothing you do here changes a real account. You can watch the complete workflow before signing up.",
    steps: ["Meet the demo creator, Nova.", "Preview the finished livestream goal.", "Pause, replay, or jump to any chapter."],
    result: "You can learn TTCGameLab before creating an account."
  },
  {
    title: "Create your private project",
    area: "PROJECTS",
    narration: "Nova creates Neon Trivia Night. A real project begins private to its owner. Other TTCGameLab creators cannot browse the project, prompts, dashboard, or private assets.",
    steps: ["Name the project.", "Describe the livestream in conversational English.", "Build the first draft with TTCGameLab AI."],
    result: "A private editable project and first Dashboard and Overlay draft are created."
  },
  {
    title: "Generate and upload assets",
    area: "ASSETS",
    narration: "TTCGameLab uses the site's configured AI and media services. Creators do not need their own API keys. Nova generates artwork, voice, music and effects, and uploads a logo.",
    steps: ["Choose Generate Asset and select the media type.", "Describe the asset.", "Upload personal media when needed."],
    result: "New assets are private and belong to Nova's project unless Nova deliberately shares them."
  },
  {
    title: "Edit the audience Overlay",
    area: "OVERLAY",
    narration: "The Overlay is what viewers see. Nova can move, resize, layer and animate elements manually or ask TTCGameLab AI for the same changes in ordinary language.",
    steps: ["Select an element in the Overlay preview.", "Adjust position, size, timing, opacity and animation.", "Ask AI for a change and review the same preview."],
    result: "The editable draft matches the intended audience scene."
  },
  {
    title: "Build Dashboard actions",
    area: "DASHBOARD",
    narration: "The Dashboard is the creator's control surface. Buttons can trigger compositions, reveals, sound, animation and game state on the Overlay.",
    steps: ["Create or choose an action package.", "Assign it to a Dashboard control.", "Test the trigger against the Overlay preview."],
    result: "Dashboard controls and Overlay reactions work as one finished experience."
  },
  {
    title: "Use games and interactive tools",
    area: "GAME TOOLS",
    narration: "Nova adds interactive game tools such as trivia and a wheel. The host controls the experience while the audience sees only the intended Overlay output.",
    steps: ["Add a game tool.", "Configure its content and behavior.", "Run a full host-side test before publishing."],
    result: "The game is ready to operate from the host Dashboard."
  },
  {
    title: "Understand My Assets and Public Library",
    area: "PRIVACY",
    narration: "Assets stay private by default. If Nova intentionally contributes an asset, Transfer Once lets one creator claim that item, while Reusable Template lets other creators make independent copies.",
    steps: ["Keep normal work in My Assets.", "Choose Move to Public Library only intentionally.", "Select Transfer Once or Reusable Template."],
    result: "Sharing an asset never automatically shares the private project or prompts behind it."
  },
  {
    title: "Protect and recover access",
    area: "SECURITY",
    narration: "Projects can have optional password protection. Account passwords use verified recovery, and an authenticated project owner can reset a forgotten project password instead of retrieving the old password.",
    steps: ["Enable a project password only if desired.", "Use Forgot Password for account recovery.", "Use Project Settings to reset a project password."],
    result: "Passwords are reset securely rather than displayed or recovered in readable form."
  },
  {
    title: "Publish Dashboard and Overlay",
    area: "PUBLISH",
    narration: "Publishing creates the live experience. The Dashboard remains the creator control surface, while the Overlay is the browser-source view for livestream software. Knowing the Overlay address does not grant editor access.",
    steps: ["Publish the tested draft.", "Open the protected host Dashboard.", "Load the Overlay URL into the livestream browser source."],
    result: "The finished livestream is ready for a live test."
  },
  {
    title: "Get help inside the project",
    area: "SUPPORT",
    narration: "If something goes wrong, the creator can open Help and Support inside the project. A support request can include safe diagnostics and, when the creator chooses, permission for TTCGameLab support to inspect the project.",
    steps: ["Choose a support category.", "Describe the problem.", "Grant project access only when desired and follow ticket status."],
    result: "The creator can get help without sending passwords or exposing unrelated private work."
  },
  {
    title: "Download the finished livestream",
    area: "EXPORT",
    narration: "Download Project creates a portable ZIP of the finished creation, not just a bag of media. The export is designed to include the Dashboard, Overlay, project assets the creator can export, and a machine-readable blueprint another AI or developer can understand.",
    steps: ["Download the project ZIP.", "Keep the finished Dashboard to Overlay behavior blueprint.", "Use the package with another host, developer, or capable AI if desired."],
    result: "The creator can leave with the outcome they built while TTCGameLab's private APIs, credentials and infrastructure stay with TTCGameLab."
  },
  {
    title: "Request project closure",
    area: "PROJECT CLOSURE",
    narration: "Downloading does not close a project. Full closure begins with a support request and includes a secondary human verification before the hosted TTCGameLab project is closed.",
    steps: ["Download first if desired.", "Submit Request Project Closure.", "Complete human verification and receive the closure confirmation."],
    result: "Closing TTCGameLab hosting does not disable or restrict the creator's downloaded project."
  },
  {
    title: "Start your real project",
    area: "READY",
    narration: "You now know the complete TTCGameLab workflow. Create or sign in to your real account, start a private project, and use the same process you just saw.",
    steps: ["Create or sign in to your account.", "Start a project.", "Return to this walkthrough any time from Help."],
    result: "You are ready to build without needing a class or one-on-one setup."
  }
];
