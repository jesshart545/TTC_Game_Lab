export const SUPPORT_TARGETS = [
  "game-plan",
  "materials",
  "scenes",
  "background",
  "add-items",
  "test",
  "publish-review",
  "media-generator",
  "media-editor",
  "game-tools",
  "web-research",
  "projects",
  "assets",
  "guide",
  "contact",
] as const;

export type SupportTarget = (typeof SUPPORT_TARGETS)[number];
export type SupportMessage = { role: "user" | "assistant"; text: string };

/** A deliberately small, page-supplied summary. It is never a project payload. */
export type SupportContext = {
  scope: string;
  page: string;
  stage?: string;
  section?: string;
  assetCount?: number;
  toolCount?: number;
  controlCount?: number;
  selection?: string;
  status?: string;
  busy?: boolean;
};

export type SupportReply = {
  kind: "help" | "task";
  reply: string;
  targets: SupportTarget[];
  /** True when this came from the local feature guide rather than Agnes. */
  offline?: boolean;
};

export const SUPPORT_TARGET_LABELS: Record<SupportTarget, string> = {
  "game-plan": "Game plan",
  materials: "Assets & tools",
  scenes: "Scenes & effects",
  background: "Background",
  "add-items": "Add items",
  test: "Test",
  "publish-review": "Publish review",
  "media-generator": "Media generator",
  "media-editor": "Media editor",
  "game-tools": "Game tools",
  "web-research": "Web Research",
  projects: "Projects",
  assets: "Asset Library",
  guide: "Guide",
  contact: "Contact support",
};

export type SupportCatalogEntry = {
  id: string;
  title: string;
  terms: readonly string[];
  excerpt: string;
  targets: readonly SupportTarget[];
};

/**
 * This compact catalog is the support route's source of truth. Its wording is
 * limited to controls and services that exist in this repository today.
 */
export const SUPPORT_CATALOG: readonly SupportCatalogEntry[] = [
  {
    id: "game-plan",
    title: "Game plan",
    terms: ["game plan", "plan", "idea", "title", "write", "rules", "concept"],
    excerpt: "In Workshop, Game plan is where you name the game and describe its idea before arranging its media and tools. Naming a plan does not publish or start a live game.",
    targets: ["game-plan"],
  },
  {
    id: "materials",
    title: "Assets and tools",
    terms: ["asset", "material", "upload", "media", "image", "video", "audio", "folder"],
    excerpt: "Assets & tools keeps uploaded and generated media, cards, pools, boards, and tool templates in the draft. Saving an item there does not place it on the overlay by itself.",
    targets: ["materials", "assets"],
  },
  {
    id: "scenes",
    title: "Scenes and effects",
    terms: ["scene", "composition", "effect", "clip", "timeline", "transition"],
    excerpt: "Scenes & effects can arrange saved media into an optional composition. A scene remains a draft creation until it is connected and tested in Build Space.",
    targets: ["scenes", "add-items"],
  },
  {
    id: "background",
    title: "Backgrounds",
    terms: ["background", "board", "fit", "cover", "contain", "resize", "layout"],
    excerpt: "Build Space can use one saved image, animated background, or board as the initial background. Contain keeps the whole image visible, cover fills the frame with cropping, and fill is only for intentional stretching.",
    targets: ["background", "materials"],
  },
  {
    id: "connections",
    title: "Controls and connections",
    terms: ["connect", "connection", "control", "button", "sequence", "placement", "position", "appearance"],
    excerpt: "Build Space adds the matching dashboard controls when you use a saved creation. Customize then lets you adjust a selected control's label, appearance, placement, or connected action before rehearsal.",
    targets: ["add-items", "game-tools", "test"],
  },
  {
    id: "testing",
    title: "Rehearsal",
    terms: ["test", "rehearse", "preview", "check", "overlay", "live"],
    excerpt: "Test rehearses the private dashboard and paired draft overlay. It is the place to verify show, reveal, play, hide, and stop controls; it does not automatically publish or play the live game.",
    targets: ["test", "publish-review"],
  },
  {
    id: "publish",
    title: "Publish review",
    terms: ["publish", "share", "review", "go live", "live", "release"],
    excerpt: "Publish review checks the draft after rehearsal. Publishing and live controls remain deliberate actions in their own controls; support cannot publish, reset, delete, or start a live game automatically.",
    targets: ["publish-review", "test"],
  },
  {
    id: "generator",
    title: "Media generation",
    terms: ["generate", "generator", "voice", "music", "sound", "sfx", "animation", "image to video"],
    excerpt: "The media generator supports images, voice, music, and sound effects when their configured providers are available. Image-to-video animation uses a selected image reference. Video without a reference depends on the current provider configuration, so availability is not guaranteed.",
    targets: ["media-generator", "materials"],
  },
  {
    id: "editing",
    title: "Media editing",
    terms: ["edit image", "edit video", "retouch", "remove", "trim", "crop", "transform"],
    excerpt: "The media editor can request supported AI image and video edits when its provider is configured. Chat can render a new image copy with crop, resize, rotate and color adjustments, or trim a video using browser capture/MediaRecorder to WebM when supported. Preview settings alone are not exported files. Original media is preserved.",
    targets: ["media-editor", "materials"],
  },
  {
    id: "trivia-research",
    title: "Trivia, pools, and research",
    terms: ["trivia", "question", "pool", "search", "research", "source", "fact"],
    excerpt: "Workshop can make sourced trivia and saved list pools. Web Research is a private workspace for searching and comparing source excerpts; it does not automatically create cards, change the draft, or send findings to viewers.",
    targets: ["web-research", "game-tools", "materials"],
  },
  {
    id: "tools",
    title: "Game tools",
    terms: ["wheel", "picker", "countdown", "timer", "poll", "dice", "coin", "scoreboard", "tool"],
    excerpt: "Game tools include wheels, random pickers, countdowns, polls, dice, coin tosses, scoreboards, prize lists, and game-tool lists. Their saved settings and dashboard connections can be reviewed in Workshop and Build Space.",
    targets: ["game-tools", "add-items"],
  },
  {
    id: "countdown",
    title: "Answer timers and countdowns",
    terms: ["answer timer", "countdown", "timer", "auto hide", "timer colors"],
    excerpt: "Countdowns support numbers, bar, circle, numbers-bar and numbers-circle displays; background/text/accent colors, supported fonts, font size, shape, border visibility, transparency and placement. Connected control transitions support none, fade, slide or zoom for appearance/removal. Show-only, start/pause, reset and hide are distinct operations. An existing fresh Start and Hide control can be combined into an additional sequence button only when the user asks for automation. Matching a background can use sampled colors, not full artwork understanding. The timer editor supports custom minutes/seconds and duration preset buttons. A duration popup on the live trigger button is not available. Countdown color-phase changes, automatic ticking/warning sounds, player-answer submission feedback and automatic fastest-answer scoring are not implemented countdown features. Do not recommend them as settings the user can switch on. Suggest one supported improvement, and leave implementation to the user's request.",
    targets: ["game-tools", "test"],
  },
  {
    id: "projects",
    title: "Projects and contact",
    terms: ["project", "project list", "account", "sign in", "contact", "problem", "error", "help"],
    excerpt: "Projects is where you choose a draft to edit. For account, deployment, or site problems that the editor cannot change, use Contact support rather than expecting the assistant to alter account or hosting settings.",
    targets: ["projects", "contact"],
  },
];

const TARGET_SET = new Set<string>(SUPPORT_TARGETS);
const allowedScopes = new Set(["creator", "host", "workspace", "site"]);
const allowedPages = new Set(["project", "live", "projects", "assets", "guide", "contact", "help", "home", "reference", "tutorial", "host", "sign-in"]);
const allowedStages = new Set(["workshop", "build", "publish", "review", "live"]);
const allowedSections = new Set<SupportTarget>(SUPPORT_TARGETS);
const allowedSelections = new Set(["none", "background", "asset", "image", "video", "audio", "tool", "control", "composition", "card", "pool", "board"]);

const aliases: Record<string, string> = {
  "asset-library": "assets",
  "build-space": "build",
  "game-plan": "game-plan",
  "assets-tools": "materials",
  "scenes-effects": "scenes",
  "game-tools": "game-tools",
  "host-dashboard": "live",
  "publish-review": "publish-review",
  "web-research": "web-research",
  "add-item": "add-items",
  add: "add-items",
  customize: "game-tools",
};

function identifier(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return aliases[normalized] || normalized;
}

/** Removes values that should never become model context or a support reply. */
export function redactSupportText(value: unknown, maximum = 3000): string {
  if (typeof value !== "string") return "";
  const withoutHtml = value.replace(/<[^>]{0,500}>/g, " ");
  const redacted = withoutHtml
    .replace(/https?:\/\/[^\s<>"']+/gi, "[private link]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[private value]")
    .replace(/\b(?:authorization|bearer|api[ _-]?key|secret|token|password|host[ _-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "[private credential]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return redacted.slice(0, maximum);
}

function allowed(value: unknown, values: Set<string>): string | undefined {
  const normalized = identifier(value);
  return values.has(normalized) ? normalized : undefined;
}

function safeCount(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10000 ? value as number : undefined;
}

/**
 * Converts page-supplied context into a fixed vocabulary. Unknown fields and
 * arbitrary project data are intentionally discarded rather than serialized.
 */
export function checkedSupportContext(value: unknown): SupportContext {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const context: SupportContext = {
    scope: typeof raw.scope === "string" && /^(?:project|live|page):[a-zA-Z0-9_:/.-]{1,200}$/.test(raw.scope) ? raw.scope : allowed(raw.scope, allowedScopes) || "site",
    page: allowed(raw.page, allowedPages) || "home",
  };
  const stage = allowed(raw.stage, allowedStages);
  const section = allowed(raw.section, allowedSections);
  const selection = redactSupportText(raw.selection, 100);
  const status = redactSupportText(raw.status, 260);
  const assetCount = safeCount(raw.assetCount);
  const toolCount = safeCount(raw.toolCount);
  const controlCount = safeCount(raw.controlCount);
  if (stage) context.stage = stage;
  if (section) context.section = section;
  if (selection) context.selection = selection;
  // A page's visible save/error status is useful, but only in redacted plain text.
  if (status) context.status = status;
  if (assetCount !== undefined) context.assetCount = assetCount;
  if (toolCount !== undefined) context.toolCount = toolCount;
  if (controlCount !== undefined) context.controlCount = controlCount;
  if (typeof raw.busy === "boolean") context.busy = raw.busy;
  return context;
}

/** Validates and redacts a single user turn without accepting a hidden payload. */
export function checkedSupportText(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a support question.");
  const original = value.trim();
  if (!original || original.length > 3000) throw new Error("Enter a support question from 1 to 3,000 characters.");
  const text = redactSupportText(original, 3000);
  if (!text) throw new Error("Enter a support question.");
  return text;
}

/** History is bounded before it can reach a provider or a future draft executor. */
export function checkedSupportHistory(value: unknown): SupportMessage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error("Keep support history to at most 20 messages.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Support message ${index + 1} is invalid.`);
    const raw = item as Record<string, unknown>;
    if (raw.role !== "user" && raw.role !== "assistant") throw new Error(`Support message ${index + 1} has an invalid role.`);
    if (typeof raw.text !== "string" || !raw.text.trim() || raw.text.trim().length > 3000) throw new Error(`Support message ${index + 1} must be 1 to 3,000 characters.`);
    const text = redactSupportText(raw.text, 3000);
    if (!text) throw new Error(`Support message ${index + 1} is empty after removing private data.`);
    return { role: raw.role, text };
  });
}

function replyText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 3000) throw new Error("The support reply was incomplete.");
  // Replies are prose plus target IDs. Do not let a provider smuggle a link, HTML,
  // code block, or an executable-looking instruction through this route.
  if (/<[^>]*>|https?:\/\/|```|`[^`]+`|(?:^|\n)\s*(?:curl|fetch|npm|pnpm|yarn|GET|POST)\b|\/api\//im.test(value)) {
    throw new Error("The support reply contained unsafe content.");
  }
  const text = redactSupportText(value, 2000);
  if (!text) throw new Error("The support reply was incomplete.");
  return text;
}

function checkedTargets(value: unknown): SupportTarget[] {
  if (!Array.isArray(value)) return [];
  const targets: SupportTarget[] = [];
  for (const candidate of value) {
    const target = typeof candidate === "string" ? identifier(candidate) : "";
    if (TARGET_SET.has(target) && !targets.includes(target as SupportTarget)) targets.push(target as SupportTarget);
    if (targets.length === 4) break;
  }
  return targets;
}

function taskIsClaimedComplete(text: string) {
  return /\b(?:done|completed|finished|created|generated|updated|changed|saved|published|deleted|reset|played)\b/i.test(text);
}

/**
 * Normalizes provider output. `allowTask` is a server decision based on actual
 * authenticated access, never on context.scope or a model assertion.
 */
export function checkedSupportReply(value: unknown, policy: boolean | { allowTask?: boolean } = false): SupportReply {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The support reply was incomplete.");
  const raw = value as Record<string, unknown>;
  if (raw.kind !== "help" && raw.kind !== "task") throw new Error("The support reply used an invalid kind.");
  const allowTask = typeof policy === "boolean" ? policy : policy.allowTask === true;
  const targets = checkedTargets(raw.targets);
  const reply = replyText(raw.reply);
  if (raw.kind === "task" && !allowTask) {
    return {
      kind: "help",
      reply: "I can help you find the relevant controls, but draft changes and generation are available only from an editable creator project.",
      targets: targets.length ? targets : ["projects"],
    };
  }
  if (raw.kind === "task" && taskIsClaimedComplete(reply)) {
    return {
      kind: "task",
      reply: "I will pass your original request to the project executor. It has not run yet.",
      targets,
    };
  }
  return { kind: raw.kind, reply, targets, ...(raw.offline === true ? {offline:true} : {}) };
}

function selectedCatalog(text: string, context: SupportContext): SupportCatalogEntry {
  const source = `${text} ${context.page} ${context.stage || ""} ${context.section || ""}`.toLowerCase();
  let best = SUPPORT_CATALOG[0];
  let score = -1;
  for (const entry of SUPPORT_CATALOG) {
    let nextScore = 0;
    for (const term of entry.terms) if (source.includes(term)) nextScore += term.includes(" ") ? 3 : 1;
    if (context.section && entry.targets.includes(context.section as SupportTarget)) nextScore += 4;
    if (context.page === "projects" && entry.id === "projects") nextScore += 3;
    if (context.page === "assets" && entry.id === "materials") nextScore += 3;
    if (context.page === "live" && entry.id === "testing") nextScore += 2;
    if (nextScore > score) { best = entry; score = nextScore; }
  }
  return best;
}

/** Returns local, explicitly non-AI support when Agnes is unavailable or unsafe. */
export function fallbackSupport(text: string, context: SupportContext): SupportReply {
  const entry = selectedCatalog(text, context);
  return {
    kind: "help",
    reply: `Offline feature guide — ${entry.title}: ${entry.excerpt}`,
    targets: [...entry.targets],
  };
}

/** The relevant, compact catalog entry sent to Agnes; no project data is included. */
export function supportCatalogExcerpt(text: string, context: SupportContext) {
  const entry = selectedCatalog(text, context);
  return { title: entry.title, excerpt: entry.excerpt, targets: [...entry.targets] };
}
