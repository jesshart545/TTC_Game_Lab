import type {CardState} from "./question-cards";
export type OverlayResult = {
  x: number; y: number; width: number; height: number;
  entrance: "none" | "fade" | "slide" | "zoom";
  exit: "none" | "fade" | "slide" | "zoom";
  entranceSeconds: number; exitSeconds: number;
  layer: number;
};
export type ChainTiming = { mode: "immediate" | "delay"; seconds?: number };
export type ChainStep = { id: string; kind: "tool" | "asset" | "composition" | "animation" | "control"; refId: string; label: string; cardAction?: "clear" | "reveal"; timing: ChainTiming };
export type ProjectEvent = { appearance?: {backgroundColor?:string;color?:string;fontFamily?:string;fontSize?:number;borderRadius?:number}; id: string; label: string; action: string; detail: string; compositionId?: string; overlayResult?: OverlayResult; sequenceOnly?: boolean; sequenceMode?: "all" | "per-press"; buttonMode?: "single" | "chain"; toolIds?: string[]; chain?: ChainStep[] };
export type ProjectAssetEdits = {
  fit?: "contain" | "cover" | "fill";
  loop?: boolean;
  sound?: boolean;
  volume?: number;
  placement?: { x: number; y: number; width: number; height: number };
  crop?: "original" | "square" | "landscape" | "portrait";
  trimStart?: number;
  trimEnd?: number;
  zoom?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
};
export type ProjectAssetGeneration = { type: string; prompt: string; aspectRatio?: string; durationSeconds?: number; lyrics?: string; instrumental?: boolean; voice?: string; stability?: number; sourceKey?: string | null };

/**
 * A real text layer rendered over a background asset (see
 * lib/backdrop-text.ts): the lettering is a DOM layer in the font the
 * creator chose — never burned into the image by a generator.
 */
export type BackdropTextSpec = { text: string; fontFamily: string; textColor: string; accentColor?: string; presentation?: "plain" | "bubble" | "frame" };
export type ProjectAsset = { name: string; type: string; url?: string; storageKey?: string; edits?: ProjectAssetEdits; inProject?: boolean; role?: "background" | "layer" | "video" | "audio"; generation?: ProjectAssetGeneration; textOverlay?: BackdropTextSpec | null; promptOverlay?: BackdropTextSpec | null; sign?: boolean };
export type AssetPool = { id: string; name: string; assetKeys: string[] };
export type CompositionTrackType = "video" | "visual" | "voice" | "music" | "sfx" | "text" | "effect";
export type CompositionClip = { id:string; track:CompositionTrackType; assetName:string; storageKey?:string; url?:string; start:number; duration:number; trimStart?:number; loop?:boolean; volume:number; fadeIn:number; fadeOut:number; playbackRate:number; text?:string; effect?:string };
export type AssetComposition = { id:string; name:string; duration:number; clips:CompositionClip[]; createdAt:string; inProject?:boolean };
export type GameWheel = { enabled: boolean; title: string; segments: string[]; spinning: boolean; visible: boolean };
export type GameToolType = "wheel" | "random-picker" | "card-list" | "countdown" | "poll" | "dice" | "coin-toss" | "plinko" | "higher-lower" | "cliffhanger" | "prize-wheel" | "trivia-board" | "blank-board" | "trivia-list" | "youtube" | "question-card" | "blank-card" | "scoreboard" | "prize-list" | "game-tool-list" | "city-crime-scene";
export type GameTool = { id: string; type: GameToolType; name: string; enabled: boolean; config: Record<string, unknown>; inToolbox?: boolean; inOverlayBuild?: boolean };
export type ProjectKind = "gameshow" | "talk" | "radio" | "multiplayer";
/**
 * The few workflow facts that cannot be derived from project data (see
 * lib/workflow-progress.ts): the creator opened the toolbox review, a
 * rehearsal happened in Test, and the check-offs Jewel has already spoken
 * (so a check, once issued in her voice, is not repeated). Everything else
 * about progress is computed from the project itself — a stored record can
 * never make a step complete when its evaluator says it is not.
 */
export type WorkflowProgressRecord = {
  toolboxOpened?: boolean;
  rehearsed?: boolean;
  /** Talk Show or Classroom: Jewel has run a web search in this project. */
  researched?: boolean;
  /** Talk Show or Classroom: the optional areas (research, quiz, media,
   * anything-missed) the creator chose to skip. A skip counts as complete
   * (Jessica, 2026-11-04) — and never locks the area against later edits. */
  skipped?: string[];
  issuedChecks?: string[];
};
/**
 * One prepared moment in a Talk Show or Classroom deck (the Arrange your
 * slides step): an ordered reference to something the creator already made —
 * the sign, a backdrop, a quiz, the YouTube tool, a media asset, or a saved
 * package. The deck only orders existing work; dashboard clicker controls
 * are a later stage's concern.
 */
export type TalkSlideKind = "sign" | "backdrop" | "quiz" | "youtube" | "media" | "composition";
export type TalkSlide = { id: string; kind: TalkSlideKind; label: string; refKey?: string };
export type Project = {
  pendingVideos?: { videoId: string; model: string; prompt: string; durationSeconds?: number }[];
  id: string;
  kind?: ProjectKind;
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
  assetPools?: AssetPool[];
  compositions?: AssetComposition[];
  overlay: { title: string; subtitle: string; showChat: boolean; showAlerts: boolean; showCharacter: boolean };
  wheel: GameWheel;
  gameTools: GameTool[];
  gamePlan?: Record<string, string>;
  cardPreviewStates?:Record<string,CardState>;
  workflow?: { stage: number; workshopStep: number; promptDraft: string; generatorPrompt?: string };
  workflowProgress?: WorkflowProgressRecord;
  /** Talk Show or Classroom: the creator's arranged slide deck (ordered). */
  talkDeck?: TalkSlide[];
  templateId?: string;
  publishedSnapshot?: Omit<Project, "publishedSnapshot">;
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
  return [];
}

export function saveProjects(_projects: Project[]) {
  // Project persistence is server-authoritative. Kept only for legacy callers during migration.
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
      updatedAt: new Date().toISOString(),
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
  return { id, name, slug, description: "AI-generated interactive TikTok LIVE experience.", status: "Draft", theme: "cyan", updatedAt: new Date().toISOString(), prompt, messages: [{ role: "user", text: prompt }], compositions: [], controls: [{ id: "alert", label: "TEST ALERT", action: "alert.test", detail: "Trigger a project alert" }, { id: "effect", label: "TRIGGER EFFECT", action: "effect.trigger", detail: "Play the generated visual effect" }], assets: [], overlay: { title: name.toUpperCase(), subtitle: "YOUR LIVE EXPERIENCE", showChat: true, showAlerts: true, showCharacter: true }, wheel: { enabled: false, title: "Game Wheel", segments: ["Prize", "Challenge", "Bonus", "Mystery"], spinning: false, visible: false }, gameTools: [] };
}


// The title a creator gives their game inside the tool that IS the game is
// the project's title too. City Crime Scene is the case in point: the case
// title typed in its editor (stored at config.mystery.title) is the game's
// title, so saving that tool names the project after it — the library then
// lists the game by the title its creator gave it, not the "City Crime
// Scene" template name the project started from. Only a title actually
// stored on the tool counts; a never-titled tool (and every other tool
// type) leaves the project name exactly as it was.
export function titleFromToolSave(project: Project, tool: GameTool): string {
  if (tool.type !== "city-crime-scene") return project.name;
  const stored = (tool.config?.mystery as { title?: unknown } | undefined)?.title;
  const title = typeof stored === "string" ? stored.trim().slice(0, 100) : "";
  return title || project.name;
}

// The project-wide form of titleFromToolSave: a case title stored on any
// City Crime Scene tool in the project names the whole project. Applied on
// EVERY save (see saveProjectToServer below), so the name syncs no matter
// which screen, button or flow saved — the topbar "Save progress", publish,
// Jewel's edits, undo — not only when the case editor itself saved. Before
// this, a case title stored before the sync existed (or between editor
// saves) never reached the project name through an ordinary project save.
export function titleFromProjectTools(project: Project): string {
  for (const tool of project.gameTools || []) {
    const name = titleFromToolSave(project, tool);
    if (name !== project.name) return name;
  }
  return project.name;
}

export async function saveProjectToServer(project: Project, publish = false, hostKey?: string): Promise<{ ok: boolean; hostKey?: string }> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project: { ...project, name: titleFromProjectTools(project), updatedAt: new Date().toISOString() }, publish, hostKey }),
  });
  if (!response.ok) throw new Error("Could not save project to Neon.");
  return response.json();
}

export async function deleteProjectFromServer(idOrSlug: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(idOrSlug)}`, { method: "DELETE" });
  if (response.status === 404) return { ok: true };
  if (!response.ok) throw new Error("Could not delete project from Neon.");
  return response.json();
}

export type TrashedProject = {
  id: string;
  slug: string;
  name: string;
  deletedAt: string | null;
  deletedBy: string | null;
  project: Project | null;
};

export async function loadTrashedProjects(): Promise<TrashedProject[]> {
  const response = await fetch("/api/projects/trash", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the trash.");
  const data = await response.json();
  const rows: any[] = Array.isArray(data.projects) ? data.projects : [];
  return rows.map(row => ({
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? row.data?.name ?? "Untitled project"),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    deletedBy: row.deleted_by ? String(row.deleted_by) : null,
    project: (row.data as Project) ?? null,
  }));
}

export async function trashAction(idOrSlug: string, action: "restore" | "delete-forever") {
  const response = await fetch(`/api/projects/trash/${encodeURIComponent(idOrSlug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) throw new Error("That trash action could not be completed.");
  return response.json();
}

export async function loadProjectFromServer(idOrSlug: string): Promise<Project | null> {
  const response = await fetch(`/api/projects/${encodeURIComponent(idOrSlug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load project from Neon.");
  const data = await response.json();
  return data.project as Project;
}

export async function loadPublishedProjectFromServer(slug: string): Promise<Project | null> {
  const response = await fetch(`/api/published/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load the published experience.");
  return (await response.json()).project as Project;
}

