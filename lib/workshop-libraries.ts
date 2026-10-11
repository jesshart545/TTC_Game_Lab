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
  { type: "image", label: "Image · Nano Banana 2", icon: "▣" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "voice", label: "Voice", icon: "◖" },
  { type: "music", label: "Music", icon: "♫" },
  { type: "sfx", label: "Sound Effect", icon: "✦" },
] as const;

export type GeneratorType = (typeof GENERATORS)[number]["type"];

export type LibraryItem = { type: GameToolType; name: string; description: string; restricted?: boolean };

export const BOARD_LIBRARY: LibraryItem[] = [
  { type:"trivia-board", name:"5×5 Trivia Board", description:"Start with a functional 5×5 board, then customize its content, visuals and interactive areas with chat." },
  { type:"blank-board", name:"Blank Board", description:"Start a custom audience board and build its background and interactive areas with chat and project assets." },
];

export const TOOL_LIBRARY: LibraryItem[] = [
  { type:"wheel", name:"Game Wheel", description:"Spin configurable segments on the live overlay." },
  { type:"random-picker", name:"Random Picker", description:"Randomly draw an unused image or card. The same button removes it." },
  { type:"scoreboard",name:"Scoreboard",description:"Show players or teams and adjust their scores during the game." },
  { type:"prize-list",name:"Prize List",description:"List prizes and mark who wins each one." },
  { type:"game-tool-list",name:"TikTok Gift Guide",description:"Show which gifts activate steals, skips, or other host-defined actions." },
  { type:"countdown", name:"Countdown", description:"Show a host-triggered countdown timer." },
  { type:"poll", name:"Live Poll", description:"Show choices and a live audience poll." },
  { type:"coin-toss", name:"Coin Toss", description:"Flip an animated coin for a random Heads or Tails result. Customize its look and connect it in Build Space." },
  { type:"dice", name:"Dice Roll", description:"Roll animated dice for a quick game." },
  { type:"city-crime-scene" as GameToolType, name:"City Crime Scene", description:"Improv whodunnit mystery game — Law & Order style. Restricted to entitled accounts.", restricted:true },
];

export function isVideo(asset: ProjectAsset | null | undefined) {
  return Boolean(asset?.url && mediaKind(asset)==="video");
}

export function isAudio(asset: ProjectAsset | null | undefined) {
  return Boolean(asset?.url && (asset.type.toLowerCase().includes("audio") || asset.name.toLowerCase().startsWith("voice") || asset.name.toLowerCase().startsWith("music") || asset.name.toLowerCase().startsWith("sfx")));
}
