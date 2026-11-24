// The Sound Board — a host-run grid of sound pads (Jessica, 2026-11-23:
// "the full sound board" for the Radio, DJ, or Karaoke kind).
//
// Each pad is bound to one of the project's OWN audio assets — an
// upload, a sound effect, a song or sting Jewel generated — and lives
// in the tool's saved config (config.pads). Firing a pad is a host
// command: the dashboard only sends the instruction, and the sound
// itself plays on the overlay page through the live runtime, because
// the overlay page is where the audience's audio comes from. Firing a
// pad that is playing stops it. Several pads can sound at once — that
// is what a sound board is for.
//
// This module is the ONE shared state layer, the Bank pattern: the
// live server (lib/audio-live-server.ts), the draft runtime and both
// faces settle and transition through these functions, so the
// dashboard and the overlay can never disagree about what is playing.

import { cleanLabelText } from "./game-tools";

export type SoundPad = { id: string; label: string; assetKey: string };

export type SoundPadState = { playing: boolean; startedAt: number; nonce: number };

export type SoundBoardState = {
  pads: Record<string, SoundPadState>;
  /** The creator's show/hide choice for the board's overlay face,
   *  flipped by its one dashboard button (the Bank's model): the
   *  sounds play from the overlay page either way — only the pad
   *  labels' visibility rides on this flag. */
  visible: boolean;
  version: number;
};

export type SoundBoardAction = "play-pad" | "stop-pad" | "toggle";

export const MAX_SOUND_PADS = 24;

/** Sanitize the pad list Jewel or an editor supplies: every pad keeps
 *  its own id (one is assigned when missing), its label is cleaned
 *  like every other overlay label (dollar signs stripped, trimmed —
 *  labels render on the overlay, where no dollar sign may appear),
 *  and a pad counts only when it names an asset. The creator's own
 *  pads are preserved in position; stock pads are never padded in. */
export function cleanSoundPads(input: unknown): SoundPad[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const pads: SoundPad[] = [];
  for (const raw of input) {
    if (pads.length >= MAX_SOUND_PADS) break;
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!item) continue;
    const assetKey = typeof item.assetKey === "string" ? item.assetKey : "";
    if (!assetKey) continue;
    let id = typeof item.id === "string" && item.id ? item.id : crypto.randomUUID();
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    pads.push({ id, label: cleanLabelText(item.label).slice(0, 60), assetKey });
  }
  return pads;
}

/** The tool's saved pads, cleaned on the way out so every reader —
 *  editor, host panel, overlay face — sees the same list. */
export function soundPadsOf(config?: Record<string, unknown> | null): SoundPad[] {
  return cleanSoundPads(config?.pads);
}

export function freshSoundBoardState(): SoundBoardState {
  return { pads: {}, visible: false, version: 0 };
}

export function soundBoardTransition(
  previous: SoundBoardState,
  action: SoundBoardAction,
  at: number,
  padId?: string,
): SoundBoardState {
  if (action === "toggle") {
    return { ...previous, visible: !previous.visible, version: previous.version + 1 };
  }
  if (!padId) return previous;
  const pad = previous.pads[padId] || { playing: false, startedAt: 0, nonce: 0 };
  if (action === "play-pad") {
    if (pad.playing) return previous;
    return {
      ...previous,
      pads: { ...previous.pads, [padId]: { playing: true, startedAt: at, nonce: pad.nonce + 1 } },
      version: previous.version + 1,
    };
  }
  if (action === "stop-pad") {
    if (!pad.playing) return previous;
    return {
      ...previous,
      pads: { ...previous.pads, [padId]: { playing: false, startedAt: pad.startedAt, nonce: pad.nonce + 1 } },
      version: previous.version + 1,
    };
  }
  return previous;
}

/** The public copy both views read (the board holds no secrets, so
 *  the whole state is safe to show the overlay). */
export function publicSoundBoardState(state: SoundBoardState): SoundBoardState {
  return { ...state, pads: { ...state.pads } };
}
