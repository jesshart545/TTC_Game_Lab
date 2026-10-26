/**
 * Host stage wiring for City Crime Scene.
 *
 * The audience overlay (components/CityCrimeSceneOverlay.tsx) is purely
 * presentational: it renders the scene the host presents and never takes
 * input. The HOST STAGE renders that exact same component for the
 * authenticated host, with the map's location cards and the location
 * scene's hotspots turned into real controls. A click on the stage must
 * produce EXACTLY the live action the host panel's labeled buttons produce
 * — the same `cityCrimeSceneAction` POST body to /api/live/[slug], sent
 * with the same x-host-key header — so the server cannot tell (and does
 * not care) which surface the host used. All server-side gates (unlock
 * checks, the arrest gate, verdict judging) apply identically.
 *
 * The helpers here are pure so the payload mapping is unit-testable: a
 * hotspot either maps to the revealClue action for its bound clue, or the
 * wiring is broken — there is no third state.
 */

export type CcssStageAction = {
  kind: string;
  locationId?: string;
  clueId?: string;
};

/** Clicking a location card on the stage map enters that location. */
export function ccssStageInvestigateAction(locationId: string): CcssStageAction {
  return { kind: "investigate", locationId };
}

/** Clicking a hotspot in a location scene reveals the clue bound to it. */
export function ccssStageRevealAction(clueId: string): CcssStageAction {
  return { kind: "revealClue", clueId };
}

/** Stage chrome: show the free-roam map again. */
export function ccssStageMapAction(): CcssStageAction {
  return { kind: "map" };
}

/** Opening choreography, step 1: present the detective's case brief — the
 *  typewritten form the host reads aloud to open the game. The same action
 *  pulls the brief back up later whenever the detective asks to see it. */
export function ccssStageBriefingAction(): CcssStageAction {
  return { kind: "briefing" };
}

/** Opening choreography, step 2: present the character cards/summaries.
 *  Also the way back to the cards when the detective wants them again. */
export function ccssStageLineupAction(): CcssStageAction {
  return { kind: "suspectLineup" };
}

export type CcssOpeningStep = { step: number; label: string; action: CcssStageAction };

/**
 * THE OPENING SEQUENCE, in order: (1) the host reads the case brief from
 * their dashboard script (the typewritten brief document on screen);
 * (2) the character cards are presented; (3) the brief and the cards are
 * FILED AWAY — and filing them away is what opens the interactive game
 * board, the map, as the live surface; (4) THE HANDOVER — the map opens
 * and the investigation is handed to the detective: the host-led opening
 * ends, detective-led free investigation begins (the detective directs
 * verbally; the host operates the board). The handover presents the same
 * board — what changes is who leads. The brief and cards never disappear
 * from the case: steps 1 and 2 stay available all game as the detective's
 * reference.
 */
export function ccssOpeningSequence(): CcssOpeningStep[] {
  return [
    { step: 1, label: "Read the case brief", action: ccssStageBriefingAction() },
    { step: 2, label: "Present the characters", action: ccssStageLineupAction() },
    { step: 3, label: "File the brief away — open the game board", action: ccssStageMapAction() },
    { step: 4, label: "Hand the investigation to the detective", action: ccssStageMapAction() },
  ];
}

/** Stage chrome: clear the presented scene. */
export function ccssStageHideAction(): CcssStageAction {
  return { kind: "hide" };
}

/**
 * The exact POST body the host panel sends for a City Crime Scene action:
 * `{ cityCrimeSceneAction: { toolId, kind, ...extra } }`.
 */
export function ccssStagePostBody(toolId: string, action: CcssStageAction): { cityCrimeSceneAction: CcssStageAction & { toolId: string } } {
  return { cityCrimeSceneAction: { toolId, ...action } };
}

type LiveEventLike = {
  id?: number;
  controlId?: string;
  payload?: { outcomes?: Record<string, { result?: string } | undefined> } | null;
};

/**
 * From a batch of live events (the same init/since feed the audience
 * overlay consumes), find the newest City Crime Scene outcome result for
 * one tool. Events carry the tool id as their controlId and the outcome
 * JSON string at payload.outcomes[toolId].result — the same extraction the
 * overlay page performs. Returns null when the batch says nothing about
 * this tool, so the stage keeps showing its current outcome.
 */
export function latestCcssStageResult(events: LiveEventLike[], toolId: string): string | null {
  let found: string | null = null;
  for (const event of events || []) {
    if (!event || event.controlId !== toolId) continue;
    const result = event.payload?.outcomes?.[toolId]?.result;
    if (typeof result === "string" && result) found = result;
  }
  return found;
}

/**
 * Which location a stage outcome is presenting, when it presents one.
 * The stage remembers this so its "back to the scene" control can
 * re-enter the same location after a clue reveal replaced the view.
 */
export function ccssStageLocationIdFromResult(result: string | null | undefined): string | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as { kind?: string; location?: { id?: string } };
    if (parsed?.kind === "location" && typeof parsed.location?.id === "string" && parsed.location.id) return parsed.location.id;
  } catch { /* not an outcome payload — no location */ }
  return null;
}

/** The outcome kind a stage result string carries ("map", "location", "clue", …). */
export function ccssStageKindFromResult(result: string | null | undefined): string | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as { kind?: string };
    return typeof parsed?.kind === "string" ? parsed.kind : null;
  } catch { return null; }
}
