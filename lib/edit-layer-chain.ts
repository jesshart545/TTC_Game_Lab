import type { AssistantMediaAction } from "./assistant-media-actions";

export type EditVideoAction = Extract<AssistantMediaAction, { type: "edit-video" }>;

/** Hard cap on chained single-change video edits for one user request. */
export const MAX_EDIT_LAYERS = 5;

export interface EditLayerOutcome {
  /** Saved identity (storageKey, or the asset name when it has none) of the layer's output asset. */
  resultKey: string;
  /** Display name of the layer's output asset. */
  resultName: string;
}

export interface EditLayerTurn {
  /** The next layer to run, already validated against the current project assets; null ends the chain. */
  action: EditVideoAction | null;
  /** Jewel's accompanying line: an announcement mid-chain, or the closing summary at the end. */
  reply?: string;
}

export interface EditLayerChainDeps {
  /** Runs one layer end to end (submit, wait, save) and resolves with the saved output. A throw stops the chain. */
  runLayer: (action: EditVideoAction, layerNumber: number) => Promise<EditLayerOutcome>;
  /** Reports a finished layer and asks for the next one; null also ends the chain (e.g. the assistant was unreachable). */
  askNext: (completed: { action: EditVideoAction; outcome: EditLayerOutcome; layer: number }) => Promise<EditLayerTurn | null>;
  /** Receives Jewel's one-line announcement before each follow-up layer runs. */
  onAnnounce?: (line: string, nextLayerNumber: number) => void;
}

export interface EditLayerChainResult {
  /** How many layers actually ran and saved. */
  layers: number;
  /** Display name of the final layer's output ("" when no layer ran). */
  finalName: string;
  /** Jewel's closing line from the turn that ended the chain, when she gave one. */
  finalReply: string;
}

/**
 * Runs a video edit as a chain of single-change layers: layer 1 is the
 * caller's action; after each layer saves, askNext decides whether another
 * layer follows (aimed at the newest saved asset). The chain stops when
 * askNext returns no action, returns null, or MAX_EDIT_LAYERS layers have
 * run. A throwing runLayer aborts the chain — layers already saved stay
 * saved, and the error propagates to the caller.
 */
export async function runEditLayerChain(first: EditVideoAction, deps: EditLayerChainDeps): Promise<EditLayerChainResult> {
  let layers = 0;
  let finalName = "";
  let finalReply = "";
  let current: EditVideoAction | null = first;
  while (current) {
    const outcome = await deps.runLayer(current, layers + 1);
    layers += 1;
    finalName = outcome.resultName;
    if (layers >= MAX_EDIT_LAYERS) break;
    const turn = await deps.askNext({ action: current, outcome, layer: layers });
    if (!turn) break;
    if (!turn.action) {
      finalReply = typeof turn.reply === "string" ? turn.reply : "";
      break;
    }
    if (turn.reply) deps.onAnnounce?.(turn.reply, layers + 1);
    current = turn.action;
  }
  return { layers, finalName, finalReply };
}
