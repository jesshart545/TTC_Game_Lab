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
  },
];

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
