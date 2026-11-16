import type { GameToolType, ProjectAsset } from "./project";
import { mediaKind } from "./board-design";

export function isImage(asset: ProjectAsset | null | undefined) {
  if (!asset?.url) return false;
  const type = (asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const url = asset.url.toLowerCase().split("?")[0];
  return type.includes("image")
    || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(name)
    || /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/.test(url)
    || name.startsWith("image");
}

export const GENERATORS = [
  { type: "image", label: "Image", icon: "▣" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "voice", label: "Voice", icon: "◖" },
  { type: "music", label: "Music", icon: "♫" },
  { type: "sfx", label: "Sound Effect", icon: "✦" },
] as const;

export type GeneratorType = (typeof GENERATORS)[number]["type"];

/** How a shelf tile creates its tool. "add" is the plain template add
 *  (addGameTool, on Jewel's own construction — toolDefaults). The
 *  routed kinds hand the tap to the creation machinery those tools
 *  already have (the card creators, the list door, the trivia
 *  generation entry) instead of minting a bare tool. */
export type ShelfRoute = "add" | "question-card" | "blank-card" | "card-list" | "trivia-list";

export type LibraryItem = { type: GameToolType; name: string; description: string; restricted?: boolean; route?: ShelfRoute };

export const BOARD_LIBRARY: LibraryItem[] = [
  { type:"trivia-board", name:"5×5 Trivia Board", description:"Start with a functional 5×5 board, then customize its content, visuals and interactive areas with chat." },
  { type:"blank-board", name:"Blank Board", description:"Start a custom audience board and build its background and interactive areas with chat and project assets." },
];

export const TOOL_LIBRARY: LibraryItem[] = [
  { type:"wheel", name:"Game Wheel", description:"Spin configurable segments on the live overlay." },
  { type:"random-picker", name:"Random Picker", description:"Randomly draw an unused image or card. The same button removes it." },
  { type:"scoreboard",name:"Scoreboard",description:"Show players or teams and adjust their scores during the game." },
  { type:"game-tool-list",name:"TikTok Gift Guide",description:"Show which gifts activate steals, skips, or other host-defined actions." },
  { type:"countdown", name:"Countdown", description:"Show a host-triggered countdown timer." },
  { type:"poll", name:"Live Poll", description:"Show choices and a live audience poll." },
  { type:"coin-toss", name:"Coin Toss", description:"Flip an animated coin for a random Heads or Tails result. Customize its look and connect it in Build Space." },
  { type:"dice", name:"Dice Roll", description:"Roll animated dice for a quick game." },
  { type:"plinko", name:"Plinko", description:"Drop the ball through the pegs and land in a prize slot." },
  { type:"higher-lower", name:"Higher or Lower", description:"Guess whether the next card is higher or lower." },
  { type:"cliffhanger", name:"Cliffhanger", description:"Guess the price — every amount off moves the climber one step toward the edge." },
  { type:"bank", name:"Bank", description:"A bank that grows with every press: the host sets the press value each round, presses climb the balance, and banking locks it in before the timer stops." },
  { type:"youtube", name:"YouTube", description:"Play a YouTube video on your overlay, sent from your dashboard." },
  { type:"city-crime-scene" as GameToolType, name:"City Crime Scene", description:"Improv whodunnit mystery game — Law & Order style. Restricted to entitled accounts.", restricted:true },
  { type:"question-card", name:"Question Cards", description:"Question and answer cards you design — one set per project.", route:"question-card" },
  { type:"blank-card", name:"Blank Card", description:"A blank card in your own design, ready for anything.", route:"blank-card" },
  { type:"card-list", name:"Card List", description:"A pool of cards or entries your other tools draw from.", route:"card-list" },
  { type:"trivia-list", name:"Trivia Question List", description:"A generated list of sourced trivia questions for your show.", route:"trivia-list" },
];

/** The full Imagine and Create tool shelf: every GameToolType, boards
 *  first, exactly once. Jessica's rule (stated repeatedly, re-stated
 *  2026-11-15): in any non-talkshow project the creator can access
 *  ALL of the site's game tools from Imagine and Create — a tool
 *  moves to Set the Stage only when the creator chooses it. */
export const SHELF_LIBRARY: LibraryItem[] = [...BOARD_LIBRARY, ...TOOL_LIBRARY];

export function shelfRoute(item: LibraryItem): ShelfRoute {
  return item.route ?? "add";
}

export function isVideo(asset: ProjectAsset | null | undefined) {
  return Boolean(asset?.url && mediaKind(asset)==="video");
}

export function isAudio(asset: ProjectAsset | null | undefined) {
  return Boolean(asset?.url && (asset.type.toLowerCase().includes("audio") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music") || asset.name.toLowerCase().startsWith("sfx")));
}
