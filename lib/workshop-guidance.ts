import type { Project } from "./project";

export type WorkshopIntent = "plan" | "materials" | "media" | "tools" | "scene" | "library" | "scenes" | "build";
export type WorkshopTask = {
  stage: string;
  firstTitle: string;
  firstDescription: string;
  firstAction: { label: string; intent: WorkshopIntent };
  nextQuestion: string;
  nextDescription: string;
  nextActions: { label: string; intent: WorkshopIntent }[];
};

export function workshopGuidance(project: Project, section: number): WorkshopTask {
  const media = project.assets.filter(asset => Boolean(asset.url || asset.storageKey)).length;
  const tools = project.gameTools.filter(tool => tool.enabled).length;
  const scenes = (project.compositions || []).length;
  const name = project.name.trim();
  const named = Boolean(name && !["New Project", "New LIVE Experience"].includes(name));
  const hasIdea = Object.values(project.gamePlan || {}).some(value => String(value || "").trim());
  const saved = `${media} media ${media === 1 ? "file" : "files"} · ${tools} game ${tools === 1 ? "tool" : "tools"} in this draft`;

  if (section === 0) {
    const planned = named && hasIdea;
    return {
      stage: "Workshop / Game plan",
      firstTitle: "Describe your game idea",
      firstDescription: "Give the game a name and describe what players do. Refine rules and scoring here when you need them.",
      firstAction: { label: "Start my game plan", intent: "plan" },
      nextQuestion: planned ? "Create the materials for your idea" : "Write a name and a game idea",
      nextDescription: planned ? "Your plan now has a name and an idea. Open Assets & tools to make or upload the pieces; you can return to refine the plan." : "The plan is still being written. Add the name and idea below before moving on, or use AI to help. Opening the form did not complete the plan.",
      nextActions: [
        planned ? { label: "Open Assets & tools", intent: "materials" } : { label: "Edit my game plan", intent: "plan" },
        planned ? { label: "Edit my game plan", intent: "plan" } : { label: "Explore Assets & tools", intent: "materials" },
      ],
    };
  }
  if (section === 2) return {
    stage: "Workshop / Scenes & effects",
    firstTitle: "Create an optional scene or effect",
    firstDescription: "Combine your media on a timeline when the game needs a sequence. You can skip scenes and go straight to Build Space.",
    firstAction: { label: scenes ? "Review saved scenes" : "Open Asset Composer", intent: scenes ? "scenes" : "scene" },
    nextQuestion: scenes ? "Review your saved scenes" : "Combine media into a scene",
    nextDescription: scenes ? `${scenes} ${scenes === 1 ? "scene is" : "scenes are"} in your draft. Edit one below or continue to assemble the game; this does not mean tested.` : "Scenes are optional. Use Asset Composer for timed media, text and effects; skip this section if you do not need them.",
    nextActions: [
      { label: scenes ? "Review saved scenes" : "Open Asset Composer", intent: scenes ? "scenes" : "scene" },
      { label: "Continue to Build Space", intent: "build" },
      ...(scenes ? [{ label: "Create another scene", intent: "scene" as const }] : []),
    ],
  };
  const intent: WorkshopIntent = tools > 0 ? "build" : media > 0 ? "tools" : "media";
  return {
    stage: "Workshop / Assets & tools",
    firstTitle: media || tools ? "Review the pieces in your draft" : "Create your first game piece",
    firstDescription: media || tools ? `${saved}. Review them here before assembling the game.` : "Start with a background, upload your own media, or choose a game tool. A background is not required for every game.",
    firstAction: { label: media || tools ? "Review saved materials" : "Create a background", intent: media || tools ? "library" : "media" },
    nextQuestion: tools ? "Arrange the pieces you have created" : media ? "Add a game interaction" : "Create your first game piece",
    nextDescription: `${saved}. ${tools ? "Open Build Space to place items and connect host buttons. You can keep creating here whenever you need more." : media ? "Your media is in this draft. Choose a tool or use the card options below, then assemble it in Build Space." : "Create or upload media, or choose a tool instead. The creation options and saved library are here; nothing is published yet."}`,
    nextActions: [
      { label: intent === "build" ? "Continue to Build Space" : intent === "tools" ? "Choose a game tool" : "Create a background", intent },
      ...(intent !== "build" ? [{ label: "Continue to Build Space", intent: "build" as const }] : [{ label: "Review saved materials", intent: "library" as const }]),
      ...(intent !== "tools" ? [{ label: "Choose a game tool", intent: "tools" as const }] : [{ label: "Create more media", intent: "media" as const }]),
    ],
  };
}
