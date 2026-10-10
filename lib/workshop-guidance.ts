import type { Project } from "./project";

export type WorkshopIntent = "plan" | "materials" | "media" | "generate" | "tools" | "scene" | "library" | "scenes" | "build";
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
      firstTitle: "Name and describe your game",
      firstDescription: "This is only for organizing your draft. You design the pieces next; the host dashboard and overlay are assembled in Build Space.",
      firstAction: { label: "Start my game plan", intent: "plan" },
      nextQuestion: planned ? "Create the materials for this idea" : "Add a name and idea",
      nextDescription: planned
        ? "Your plan has a name and idea. Open Assets & tools to upload or create media, cards, boards, and tools. Nothing is published until you say so."
        : "Add a project name and a short idea below. Opening the form does not finish the plan or publish anything.",
      nextActions: [
        planned ? { label: "Open Assets & tools", intent: "materials" } : { label: "Edit my game plan", intent: "plan" },
        planned ? { label: "Edit my game plan", intent: "plan" } : { label: "Explore Assets & tools", intent: "materials" },
      ],
    };
  }
  if (section === 2) return {
    stage: "Workshop / Scenes & effects",
    firstTitle: "Optional timed scenes",
    firstDescription: "Combine media on a timeline when you need a sequence. Skip this section if you do not need scenes. Connecting host buttons happens in Build Space.",
    firstAction: { label: scenes ? "Review saved scenes" : "Open Asset Composer", intent: scenes ? "scenes" : "scene" },
    nextQuestion: scenes ? "Edit a scene or continue" : "Create a scene only if you need one",
    nextDescription: scenes
      ? `${scenes} ${scenes === 1 ? "scene is" : "scenes are"} saved in this draft. Edit here; place and test them in Build Space.`
      : "Scenes are optional. Use Asset Composer for timed media and effects, or go straight to Build Space to assemble the overlay and dashboard.",
    nextActions: [
      { label: scenes ? "Review saved scenes" : "Open Asset Composer", intent: scenes ? "scenes" : "scene" },
      { label: "Continue to Build Space", intent: "build" },
      ...(scenes ? [{ label: "Create another scene", intent: "scene" as const }] : []),
    ],
  };
  const intent: WorkshopIntent = tools > 0 ? "build" : media > 0 ? "tools" : "media";
  return {
    stage: "Workshop / Assets & tools",
    firstTitle: media || tools ? "Review materials in this draft" : "Create your first materials",
    firstDescription: media || tools
      ? `${saved}. Edit media, cards, boards, and tools here. Wire host buttons and the overlay in Build Space.`
      : "Upload media, generate assets, or create cards, boards, and tools. Customize everything yourself—nothing is filled in for you.",
    firstAction: { label: media || tools ? "Review saved materials" : "Create a background", intent: media || tools ? "library" : "media" },
    nextQuestion: tools ? "Assemble in Build Space when ready" : media ? "Add a tool or card if you need one" : "Create or upload something",
    nextDescription: `${saved}. ${tools
      ? "When materials look right, open Build Space to place overlay results and connect dashboard buttons. You can return here anytime."
      : media
        ? "Media is in this draft. Create tools or cards below if you need them, then assemble in Build Space."
        : "Use Creation tools or upload. Everything stays in the draft until you publish."}`,
    nextActions: [
      { label: intent === "build" ? "Continue to Build Space" : intent === "tools" ? "Choose a game tool" : "Create a background", intent },
      ...(intent !== "build" ? [{ label: "Continue to Build Space", intent: "build" as const }] : [{ label: "Review saved materials", intent: "library" as const }]),
      ...(intent !== "tools" ? [{ label: "Choose a game tool", intent: "tools" as const }] : [{ label: "Create more media", intent: "generate" as const }]),
    ],
  };
}
