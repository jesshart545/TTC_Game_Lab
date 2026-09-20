export type ProjectEvent = { id: string; label: string; action: string; detail: string };
export type ProjectAssetEdits = {
  crop?: "original" | "square" | "landscape" | "portrait";
  trimStart?: number;
  trimEnd?: number;
};
export type ProjectAsset = { name: string; type: string; url?: string; storageKey?: string; edits?: ProjectAssetEdits };
export type GameWheel = { enabled: boolean; title: string; segments: string[]; spinning: boolean; visible: boolean };
export type GameToolType = "wheel" | "random-picker" | "countdown" | "poll" | "dice" | "trivia-board";
export type GameTool = { id: string; type: GameToolType; name: string; enabled: boolean; config: Record<string, unknown> };
export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: "Draft" | "Published";
  theme: "cyan" | "purple" | "pink";
  updatedAt: string;
  prompt: string;
  messages: { role: "user" | "assistant"; text: string }[];
  controls: ProjectEvent[];
  assets: ProjectAsset[];
  overlay: { title: string; subtitle: string; showChat: boolean; showAlerts: boolean; showCharacter: boolean };
  wheel: GameWheel;
  gameTools: GameTool[];
};

export const demoProjects: Project[] = [
  {
    id: "haunted-gaming", name: "Haunted Gaming", slug: "haunted-gaming-8f3k2", description: "Spooky alerts, reactive character and horror effects.", status: "Published", theme: "cyan", updatedAt: "12 min ago", prompt: "Create a spooky gaming stream where my character reacts when someone follows.",
    messages: [{ role: "user", text: "Create a spooky gaming stream where my character reacts when someone follows." }, { role: "assistant", text: "I built the horror scene, follower reaction, alert system, and host controls. Your project is ready to test." }],
    controls: [
      { id: "hype", label: "HYPE", action: "character.hype", detail: "Character celebrates with a neon burst" },
      { id: "scare", label: "SCARE", action: "scene.scare", detail: "Flash, shake and horror hit" },
      { id: "follow", label: "TEST FOLLOW", action: "alert.follow", detail: "Play the follower animation" },
      { id: "hide", label: "HIDE CHARACTER", action: "character.toggle", detail: "Toggle the character layer" },
    ],
    assets: [{ name: "Creator Character", type: "PNG" }, { name: "Horror SFX", type: "Audio" }, { name: "Neon Fog", type: "Generated" }],
    overlay: { title: "HAUNTED NIGHT", subtitle: "FOLLOW FOR A SURPRISE", showChat: true, showAlerts: true, showCharacter: true }, wheel: { enabled: false, title: "Game Wheel", segments: ["Prize", "Challenge", "Bonus", "Mystery"], spinning: false, visible: false }, gameTools: [] ,
  },
  { id: "space-battle", name: "Space Battle", slug: "space-battle-2m9qp", description: "Futuristic battles with interactive audience events.", status: "Published", theme: "purple", updatedAt: "Yesterday", prompt: "Create a futuristic space battle stream with interactive audience events.", messages: [{ role: "user", text: "Create a futuristic space battle stream with interactive audience events." }, { role: "assistant", text: "Your battle arena, alert HUD, and host triggers are ready." }], controls: [{ id: "attack", label: "LASER ATTACK", action: "scene.attack", detail: "Launch a laser volley" }, { id: "boost", label: "SHIELD BOOST", action: "scene.shield", detail: "Raise the shield" }, { id: "follow", label: "TEST FOLLOW", action: "alert.follow", detail: "Play the follower animation" }], assets: [{ name: "Ship", type: "Generated" }, { name: "Starfield", type: "Generated" }], overlay: { title: "SPACE BATTLE", subtitle: "PILOT STATUS: READY", showChat: true, showAlerts: true, showCharacter: false }, wheel: { enabled: true, title: "Battle Wheel", segments: ["LASER ATTACK", "SHIELD BOOST", "BONUS", "WILD CARD"], spinning: false, visible: false }, gameTools: [{ id:"wheel-1", type:"wheel", name:"Battle Wheel", enabled:true, config:{ title:"Battle Wheel", segments:["LASER ATTACK","SHIELD BOOST","BONUS","WILD CARD"] } }] },
  { id: "christmas-giveaway", name: "Christmas Giveaway", slug: "christmas-giveaway-4x1tt", description: "Festive scenes, giveaways and animated alerts.", status: "Draft", theme: "pink", updatedAt: "Dec 18", prompt: "Create a Christmas giveaway stream with festive animated alerts.", messages: [], controls: [{ id: "draw", label: "DRAW WINNER", action: "giveaway.draw", detail: "Run a giveaway winner animation" }, { id: "snow", label: "SNOW", action: "effect.snow", detail: "Toggle snowfall" }], assets: [{ name: "Holiday Logo", type: "PNG" }], overlay: { title: "HOLIDAY GIVEAWAY", subtitle: "GOOD LUCK!", showChat: true, showAlerts: true, showCharacter: false }, wheel: { enabled: false, title: "Giveaway Wheel", segments: ["WINNER", "BONUS", "TRY AGAIN", "DOUBLE"], spinning: false, visible: false }, gameTools: [] },
];

const KEY = "ttc-gamelab-projects-v1";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return demoProjects;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (!saved) {
      window.localStorage.setItem(KEY, JSON.stringify(demoProjects));
      return demoProjects;
    }
    return JSON.parse(saved) as Project[];
  } catch { return demoProjects; }
}

export function saveProjects(projects: Project[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function deleteProject(projectId: string): boolean {
  if (typeof window === "undefined") return false;
  const projects = loadProjects();
  const next = projects.filter(project => project.id !== projectId);
  if (next.length === projects.length) return false;
  saveProjects(next);
  return true;
}

export function replaceProjectAssets(projectId: string, assets: ProjectAsset[]): boolean {
  if (typeof window === "undefined") return false;
  const projects = loadProjects();
  let changed = false;
  const next = projects.map(project => {
    if (project.id !== projectId) return project;
    changed = true;
    return {
      ...project,
      assets: assets.map(asset => asset.storageKey ? { ...asset, url: undefined } : asset),
      updatedAt: "just now",
    };
  });
  if (changed) saveProjects(next);
  return changed;
}

export function createProject(prompt: string): Project {
  const id = `project-${Date.now()}`;
  const base = prompt.toLowerCase();
  const name = base.includes("space") ? "Space Battle" : base.includes("christmas") || base.includes("holiday") ? "Holiday Live" : base.includes("horror") || base.includes("spooky") ? "Haunted Gaming" : "New LIVE Experience";
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, name, slug, description: "AI-generated interactive TikTok LIVE experience.", status: "Draft", theme: "cyan", updatedAt: "just now", prompt, messages: [{ role: "user", text: prompt }], controls: [{ id: "alert", label: "TEST ALERT", action: "alert.test", detail: "Trigger a project alert" }, { id: "effect", label: "TRIGGER EFFECT", action: "effect.trigger", detail: "Play the generated visual effect" }], assets: [], overlay: { title: name.toUpperCase(), subtitle: "YOUR LIVE EXPERIENCE", showChat: true, showAlerts: true, showCharacter: true }, wheel: { enabled: false, title: "Game Wheel", segments: ["Prize", "Challenge", "Bonus", "Mystery"], spinning: false, visible: false }, gameTools: [] };
}
