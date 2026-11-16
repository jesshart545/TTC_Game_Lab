"use client";
import type { GameTool, Project } from "../lib/project";
import { PlinkoDisplay, HigherLowerDisplay, CliffhangerDisplay } from "./ChanceTools";
import { StyledTimer } from "./QuestionCards";
import { GameInfoOverlay } from "./GameInfoTools";
import { ToolArtwork } from "./GameToolEditor";
import { toolStyle, overlayToolPlacement } from "../lib/tool-style";
import { cardPhase, freshCardState, type CardState } from "../lib/question-cards";
import { BankDisplay } from "./BankDisplay";
import type { BankState } from "../lib/bank";
import { plinkoBoardArtUrl } from "../lib/plinko-art";
import { chanceArtUrl } from "../lib/chance-art";
import { pickerCards } from "../lib/card-lists";

/**
 * Standing faces — when a tool stands on the overlay, it shows the
 * game itself, not an empty frame with a picture (Jessica,
 * 2026-11-14: "actual working game tools in the site not just empty
 * spaces", and the standing tools must work and be customizable).
 * Each face is the tool's real display in its idle/preview mode,
 * reading the same saved config the hand editor and Jewel edit —
 * never a result, never a winner: outcomes exist only when a
 * dashboard button fires the tool and the existing run layer
 * (RuntimeActionLayers ToolRun) presents them, unchanged.
 * The displays carry only their own game text; no instructions,
 * labels, or explanatory copy are added here (the site shows, it
 * doesn't tell).
 */
export const standingToolTypes = ["plinko", "higher-lower", "cliffhanger", "game-tool-list", "random-picker", "countdown", "bank"];

/** The three chance games. They are features of the whole gameshow
 *  live: the host brings one up on the overlay by firing it from the
 *  dashboard, and it is NOT on the overlay the whole time unless the
 *  creator wants it to be — that is why they are game show tools
 *  (Jessica, corrected 2026-11-14). Standing is the creator's
 *  per-tool choice, recorded as config.alwaysVisible === true;
 *  absent or false means fire-only. */
export const chanceToolTypes = ["plinko", "higher-lower", "cliffhanger"];

/** Would this tool stand on the overlay through StandingTools / the
 *  published overlay's standing branches? Countdown and the random
 *  picker stand as they always have; the gift guide follows the
 *  blank-board/trivia precedent — a triggerOnly tool appears only
 *  when fired; the chance games stand only on the creator's explicit
 *  alwaysVisible opt-in. */
export function standsOnOverlay(tool: GameTool | undefined): boolean {
  if (!tool || !tool.enabled || !tool.inOverlayBuild || !standingToolTypes.includes(tool.type)) return false;
  if (tool.type === "countdown" || tool.type === "random-picker") return true;
  // A placed Bank is a standing candidate like the countdown; whether its
  // face actually shows is the shared bank state's visible flag, flipped
  // by the host's Show button (the scoreboard's show/remove model).
  if (tool.type === "bank") return true;
  if (chanceToolTypes.includes(tool.type)) return tool.config?.alwaysVisible === true;
  return !tool.config?.triggerOnly;
}

function appearanceTextColor(tool: GameTool): string {
  return String(((tool.config.appearance || {}) as Record<string, unknown>).textColor || "#ffffff");
}

/** The standing face for the tools that render inside the standard
 *  placed-tool wrapper (toolStyle + overlayToolPlacement + artwork).
 *  Countdown and the gift guide position themselves, so they return
 *  null here and are rendered by the standing layer / overlay map. */
export function StandingToolFace({ tool, project }: { tool: GameTool; project: Project }) {
  const config = tool.config;
  const textColor = appearanceTextColor(tool);
  if (tool.type === "plinko") {
    const slots = (Array.isArray(config.slots) ? config.slots : []).map(String);
    return <PlinkoDisplay title={String(config.title || tool.name)} slots={slots} rows={Math.min(14, Math.max(4, Number(config.rows) || 9))} preview pegColor={String(config.pegColor || "#8b9bb4")} ballColor={String(config.ballColor || "#ff5d5d")} colors={[String(config.slotColor || "#154c69"), String(config.alternateSlotColor || "#512b75")]} textColor={textColor} artSrc={plinkoBoardArtUrl(tool, project.assets)} />;
  }
  if (tool.type === "higher-lower") {
    const deck = (Array.isArray(config.cards) ? config.cards : []).map((c: any) => ({ label: String(c?.label ?? c?.value ?? "?"), value: Number(c?.value) || 0 }));
    return <HigherLowerDisplay outcome={{ phase: "draw", card: deck[0] || { label: "?", value: 0 } }} preview textColor={textColor} artSrc={chanceArtUrl(tool, project.assets)} />;
  }
  if (tool.type === "cliffhanger") {
    const items = (Array.isArray(config.items) ? config.items : []).map((c: any) => ({ label: String(c?.label ?? "Item"), price: Number(c?.price) || 0 }));
    return <CliffhangerDisplay outcome={{ phase: "item", item: items[0] || { label: "Item", price: 0 }, position: 0, stepsToFall: Number(config.stepsToFall) || 25, dollarsPerStep: Math.max(1, Number(config.dollarsPerStep) || 1) }} preview textColor={textColor} artSrc={chanceArtUrl(tool, project.assets)} />;
  }
  if (tool.type === "random-picker") {
    // The honest standing face: the picker's title and everything in
    // its pool, with NO item presented as the pick. The draw itself
    // stays with the card cycle, unchanged.
    const configured = (Array.isArray(config.segments) ? config.segments : Array.isArray(config.items) ? config.items : []).map(String);
    const pool = configured.length ? configured : config.source === "cards" ? pickerCards(project, tool).map(card => card.text) : [];
    return <><small>{String(config.title || tool.name)}</small>{pool.length > 0 && <div>{pool.join(" · ")}</div>}</>;
  }
  return null;
}

/** True when a card-state source would already render this info tool
 *  through the QuestionCards path (state present and not hidden). */
function infoToolShown(project: Project, tool: GameTool, states?: Record<string, CardState>): boolean {
  const state = states?.[tool.id];
  return !!state && cardPhase(project, tool, state) !== "hidden";
}

/**
 * The standing layer for surfaces that have no standing map of their
 * own (the builder's draft overlay and preview panel): every placed
 * in-scope tool stands here exactly as it stands on the published
 * overlay. `states` is the surface's card-state source (the draft
 * runtime's); `extraStates` lets the published overlay also account
 * for its live card states, so the gift guide renders exactly once —
 * through QuestionCards when a state shows it, standing here (or in
 * the overlay's map) when none does.
 */
export default function StandingTools({ project, states, extraStates, bankStates }: { project: Project; states?: Record<string, CardState>; extraStates?: Record<string, CardState>; bankStates?: Record<string, BankState> }) {
  const placed = (project.gameTools || []).filter(tool => standsOnOverlay(tool));
  return <>{placed.map(tool => {
    if (tool.type === "countdown") {
      const total = Number(tool.config.seconds) || 10;
      return <StyledTimer key={tool.id} tool={tool} remaining={total} total={total} />;
    }
    if (tool.type === "bank") {
      const state = bankStates?.[tool.id];
      if (!state?.visible) return null;
      return <div key={tool.id} className={`runtime-game-tool runtime-tool-${tool.type}`} style={{ ...toolStyle(tool), ...overlayToolPlacement(tool) }}><ToolArtwork tool={tool} assets={project.assets} /><BankDisplay tool={tool} state={state} /></div>;
    }
    if (tool.type === "game-tool-list") {
      if (infoToolShown(project, tool, states) || infoToolShown(project, tool, extraStates)) return null;
      return <GameInfoOverlay key={tool.id} tool={tool} project={project} state={states?.[tool.id] || extraStates?.[tool.id] || freshCardState()} />;
    }
    return <div key={tool.id} className={`runtime-game-tool runtime-tool-${tool.type}`} style={{ ...toolStyle(tool), ...overlayToolPlacement(tool) }}><ToolArtwork tool={tool} assets={project.assets} /><StandingToolFace tool={tool} project={project} /></div>;
  })}</>;
}
