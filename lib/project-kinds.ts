import type { GameTool, GameToolType, Project, ProjectKind } from "./project";
import { toolDefaults } from "./game-tools";
import { createCardSystem } from "./question-cards";

// The four project kinds from the redesign's new-project flow. Wording is
// Jessica's approved demo copy — change it here and every surface (kind
// picker, landing card tags, project settings) follows.
export type ProjectKindInfo = {
  id: ProjectKind;
  kicker: string;
  title: string;
  description: string;
  image: string;
  tagLabel: string;
  chipLabel: string;
  scratchHeading: string;
  nameSuggestion: string;
  /** Not yet open for new projects (Jessica, 2026-11-04): the kind picker
   * shows the card with a "Coming Soon!" band and the card cannot be
   * chosen. Existing projects of the kind are untouched — the gate is
   * only on STARTING a new one. */
  comingSoon?: boolean;
};

export const PROJECT_KINDS: ProjectKindInfo[] = [
  {
    id: "gameshow",
    kicker: "Design, Produce, and Host",
    title: "Host a Gameshow Live",
    description: "Custom built from scratch by you, or easy-to-build templates for fun games that will keep your audience coming back for more.",
    image: "/redesign/kind-gameshow.webp",
    tagLabel: "Gameshow",
    chipLabel: "Gameshow project",
    scratchHeading: "Build your gameshow",
    nameSuggestion: "My Gameshow",
  },
  {
    id: "talk",
    kicker: "Talk · Teach · Live",
    title: "Talk Show or Classroom",
    description: "Host a talk show with your guests — or teach live, classroom-style, with your students right there with you.",
    image: "/redesign/kind-talkshow.webp",
    tagLabel: "Talk show",
    chipLabel: "Talk show project",
    scratchHeading: "Build your talk show",
    nameSuggestion: "My Talk Show",
  },
  {
    id: "radio",
    kicker: "Voice & music · Always live",
    title: "Radio, DJ, or Karaoke",
    description: "A live broadcast, start to finish — a DJ set, karaoke night, or talk radio. This one always streams.",
    image: "/redesign/kind-radio.webp",
    tagLabel: "Radio, DJ, karaoke",
    chipLabel: "Radio project",
    scratchHeading: "Build your broadcast",
    nameSuggestion: "My Radio Show",
    comingSoon: true,
  },
  {
    id: "multiplayer",
    kicker: "Play together · No stream",
    title: "Off-Stream Multiplayer Game Night",
    description: "All the fun of a gameshow that even a host can enjoy on their night off — friends join by link, the game runs itself, you play along.",
    image: "/redesign/kind-multiplayer.webp",
    tagLabel: "Off-stream game",
    chipLabel: "Game night project",
    scratchHeading: "Build your game night",
    nameSuggestion: "Game Night",
    comingSoon: true,
  },
];

/** Kinds whose new-project start is gated with "Coming Soon!" — the
 * picker card is shown but cannot be chosen, and creation guards refuse
 * the kind so no path (picker, kind conversion, future deep link) can
 * start a new project of a gated kind. Existing projects keep working. */
export function isKindComingSoon(kind: ProjectKind | undefined): boolean {
  return !!kind && PROJECT_KINDS.some(info => info.id === kind && info.comingSoon);
}

/** The Coming Soon gate as it applies to a specific viewer: gated for
 * everyone, EXCEPT the site admin starting a MULTIPLIER project for
 * testing (Jessica, 2026-11-12 — her admin account may create
 * Off-Stream Multiplayer Game Night projects while the gate stays up
 * for everyone else; radio stays gated for everyone, admin included).
 * `viewerIsAdmin` is the site's own admin notion — server-side that is
 * lib/auth/server's isAdmin (role "admin" or an ADMIN_EMAILS address),
 * surfaced to client surfaces as the viewerIsAdmin flag the project
 * APIs already return. */
export function isKindGatedFor(kind: ProjectKind | undefined, viewerIsAdmin: boolean): boolean {
  if (!isKindComingSoon(kind)) return false;
  return !(viewerIsAdmin && kind === "multiplayer");
}

/** The setup pieces a kind's from-scratch screen offers. A talk show's
 * screen offers only talk pieces — quiz cards and YouTube clips — never
 * pictured gameshow tools (Jessica, 2026-11-03: the Talk space holds only
 * talk pieces). Other kinds keep the full shared list. */
export function setupPiecesForKind(kind: ProjectKind): SetupPiece[] {
  if (kind === "talk") return SETUP_PIECES.filter(piece => piece.id === "question-cards" || piece.id === "video-clips");
  return SETUP_PIECES;
}

/** The pieces pre-tapped for a kind: the talk defaults are its own two
 * pieces; every other kind keeps the shared defaults. */
export function defaultSetupPieces(kind: ProjectKind): string[] {
  if (kind === "talk") return ["question-cards", "video-clips"];
  return SETUP_PIECES.filter(piece => piece.defaultOn).map(piece => piece.id);
}

export function projectKindInfo(kind: ProjectKind | undefined): ProjectKindInfo | undefined {
  return PROJECT_KINDS.find(info => info.id === kind);
}

// The "tap the pieces your show needs" tiles on the scratch setup screen.
// Each tile maps to the closest EXISTING tool, created with the same
// factories the Workshop / Build Space use. The demo also showed
// "Music & sounds" and "Effects" tiles; neither exists as a standalone
// tool (music/SFX are generated assets, effects live inside compositions),
// so they are deliberately NOT offered rather than faked.
export type SetupPiece = {
  id: string;
  label: string;
  defaultOn: boolean;
  image?: string;
  glyph?: string;
  toolType?: GameToolType;
  toolName?: string;
};

export const SETUP_PIECES: SetupPiece[] = [
  { id: "question-cards", label: "Question cards", defaultOn: true, image: "/redesign/kind-talkshow.webp" },
  { id: "prize-wheel", label: "Prize wheel", defaultOn: true, glyph: "◐", toolType: "wheel", toolName: "Game Wheel" },
  { id: "dice", label: "Dice", defaultOn: false, glyph: "⚄", toolType: "dice", toolName: "Dice Roll" },
  { id: "timer", label: "Timer", defaultOn: true, glyph: "1:00", toolType: "countdown", toolName: "Countdown" },
  { id: "scoreboard", label: "Scoreboard", defaultOn: true, image: "/redesign/kind-gameshow.webp", toolType: "scoreboard", toolName: "Scoreboard" },
  { id: "video-clips", label: "Video clips", defaultOn: false, glyph: "▶", toolType: "youtube", toolName: "YouTube search" },
];

// Add the tapped pieces to a freshly created project. Question cards go
// through createCardSystem — the exact creator the Workshop's card flow
// uses, controls included. Every other piece is minted the way Build
// Space mints a tool from the Library: enabled, in the toolbox, default
// config, and NOT wired to any dashboard button (wiring stays the user's
// Library choice, as always). Untapped pieces are simply not added.
export function applySetupPieces(project: Project, pieceIds: readonly string[]): Project {
  let next = project;
  for (const piece of SETUP_PIECES) {
    if (!pieceIds.includes(piece.id)) continue;
    if (piece.id === "question-cards") {
      next = createCardSystem(next);
      continue;
    }
    if (!piece.toolType || !piece.toolName) continue;
    const tool: GameTool = {
      id: crypto.randomUUID(),
      type: piece.toolType,
      name: piece.toolName,
      enabled: true,
      inToolbox: true,
      config: { ...toolDefaults(piece.toolType) },
    };
    next = { ...next, gameTools: [...next.gameTools, tool] };
  }
  return next;
}
