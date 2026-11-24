// The DJ Deck — the Radio/DJ branch's music player (Jessica,
// 2026-11-23: "the dj should be able to merge and play their songs
// with dj functions", playing "their own music").
//
// The deck's track list is built from the project's OWN music only —
// audio assets the creator uploaded or Jewel generated for them, and
// the project's asset pools (a .zip of songs already becomes one
// pool) — never an external account or service. The host runs the
// deck from a private dashboard panel (play, pause, previous, next,
// play a chosen track, and MERGE: a crossfade that blends the song
// playing into the next one). The customization a DJ expects rides
// the same panel and state (Jessica, 2026-11-24): a song can FADE IN
// when it starts and FADE OUT smoothly into a pause, songs can LOOP
// (the one song, or the whole list), and the playback SPEED can be
// raised or lowered. The dashboard only sends instructions: every
// sound the audience hears plays on the overlay page through the
// live runtime, because the overlay page is where a live show's
// audio comes from.
//
// This module is the ONE shared state layer, the Bank pattern: the
// live server (lib/audio-live-server.ts), the draft runtime, the host
// panel and the overlay player settle and transition through these
// functions. Playback position is anchored (a position plus the time
// it was true), so any view can compute where the show's music is
// right now — walkDjPlayback walks that anchor across the track
// durations, which is also how a freshly opened overlay rejoins a
// show already in progress instead of restarting the first song.

import type { GameTool, Project, ProjectAsset } from "./project";
import { poolAudioTracks } from "./asset-pools";

export type DjStatus = "stopped" | "playing" | "paused";

export type DjFade = { fromKey: string; fromPosition: number; startedAt: number; seconds: number };

/** A fade-out in progress: when it began, and how long the song
 *  takes to sink to silence before it pauses. */
export type DjFadeOut = { startedAt: number; seconds: number };

/** Looping: "off" plays the list once, "one" repeats the song on
 *  the deck, "all" repeats the whole track list. */
export type DjLoopMode = "off" | "one" | "all";

export type DjState = {
  status: DjStatus;
  /** The asset key of the track on the deck (the incoming track
   *  while a merge fade runs). */
  trackKey: string | null;
  /** Seconds into trackKey at anchorAt. */
  position: number;
  anchorAt: number;
  /** A merge in progress: the outgoing track, where it was when the
   *  merge began, and the blend's length. Null outside a merge. */
  fade: DjFade | null;
  /** A fade-out in progress: the song keeps playing while its
   *  volume sinks; when the window passes, the walk reports the
   *  deck paused at the position the fade reached. Null otherwise. */
  fadeOut: DjFadeOut | null;
  /** The host's loop choice, changeable mid-show from the panel. */
  loopMode: DjLoopMode;
  /** The playback rate the overlay applies (1 is normal speed).
   *  Positions are measured in song seconds, so the anchored walk
   *  grows at this rate while the deck plays. */
  speed: number;
  /** The creator's show/hide choice for the deck's overlay face,
   *  flipped by its one dashboard button (the Bank's model): the
   *  music plays from the overlay page either way — only the
   *  now-playing face's visibility rides on this flag. */
  visible: boolean;
  version: number;
};

export type DjAction = "play" | "pause" | "stop" | "next" | "previous" | "merge" | "play-track" | "toggle" | "fade-out" | "loop" | "speed";

export const DJ_DEFAULT_CROSSFADE_SECONDS = 4;
export const DJ_MIN_CROSSFADE_SECONDS = 0;
export const DJ_MAX_CROSSFADE_SECONDS = 30;
export const DJ_DEFAULT_FADE_IN_SECONDS = 2;
export const DJ_DEFAULT_FADE_OUT_SECONDS = 3;
export const DJ_MIN_FADE_SECONDS = 0;
export const DJ_MAX_FADE_SECONDS = 30;
export const DJ_DEFAULT_SPEED = 1;
export const DJ_MIN_SPEED = 0.5;
export const DJ_MAX_SPEED = 2;
/** The speed choices the deck's panel offers, slowest to fastest. */
export const DJ_SPEED_PRESETS: number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const MAX_DECK_TRACKS = 200;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** A merge's blend length, coerced and clamped to sane ranges (the
 *  sanitizer lesson from the Plinko creation fix). */
export function clampDjCrossfadeSeconds(value: unknown): number {
  return clampInt(value, DJ_DEFAULT_CROSSFADE_SECONDS, DJ_MIN_CROSSFADE_SECONDS, DJ_MAX_CROSSFADE_SECONDS);
}

/** How long a song takes to fade in when it starts playing. */
export function clampDjFadeInSeconds(value: unknown): number {
  return clampInt(value, DJ_DEFAULT_FADE_IN_SECONDS, DJ_MIN_FADE_SECONDS, DJ_MAX_FADE_SECONDS);
}

/** How long the Fade Out control takes to bring the song down. */
export function clampDjFadeOutSeconds(value: unknown): number {
  return clampInt(value, DJ_DEFAULT_FADE_OUT_SECONDS, DJ_MIN_FADE_SECONDS, DJ_MAX_FADE_SECONDS);
}

/** The playback rate, coerced and clamped to the deck's range
 *  (half speed to double speed); anything unreadable is normal. */
export function clampDjSpeed(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DJ_DEFAULT_SPEED;
  return Math.round(Math.max(DJ_MIN_SPEED, Math.min(DJ_MAX_SPEED, n)) * 100) / 100;
}

/** The loop mode a saved or supplied value names; anything else
 *  is off. */
export function cleanDjLoopMode(value: unknown): DjLoopMode {
  return value === "one" || value === "all" ? value : "off";
}

/** The rate a state plays at — a state saved before speeds existed
 *  carries none and plays at normal speed. */
export function djSpeedOf(state: DjState): number {
  return clampDjSpeed(state.speed);
}

/** Sanitize a saved key list Jewel or an editor supplies (the deck's
 *  tracks, or its pool ids): strings only, trimmed, deduped in
 *  position, capped. */
export function cleanDeckKeyList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const raw of input) {
    if (keys.length >= MAX_DECK_TRACKS) break;
    if (typeof raw !== "string") continue;
    const key = raw.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export type DjTrack = { key: string; name: string; url: string };

function isPlayableAudio(asset: ProjectAsset): boolean {
  return Boolean(asset.url) && (asset.type || "").toLowerCase().includes("audio");
}

/** The deck's track list, resolved from the project itself: the
 *  tool's own saved tracks first (config.tracks — asset keys, in the
 *  creator's order), then the tracks of each pool it draws on
 *  (config.poolIds — the zip-playlist pools), in pool order. A key
 *  counts once, at its first position; members that are missing from
 *  the project or are not playable audio are left out without
 *  disturbing the order of the rest. */
export function deckTracks(project: Project, tool: GameTool): DjTrack[] {
  const byKey = new Map<string, ProjectAsset>();
  for (const asset of project.assets || []) {
    const key = asset.storageKey || asset.name;
    if (!byKey.has(key)) byKey.set(key, asset);
  }
  const tracks: DjTrack[] = [];
  const seen = new Set<string>();
  const push = (asset: ProjectAsset | undefined) => {
    if (!asset || !isPlayableAudio(asset)) return;
    const key = asset.storageKey || asset.name;
    if (seen.has(key)) return;
    seen.add(key);
    tracks.push({ key, name: asset.name, url: asset.url as string });
  };
  for (const key of cleanDeckKeyList(tool.config?.tracks)) push(byKey.get(key));
  const pools = project.assetPools || [];
  for (const poolId of cleanDeckKeyList(tool.config?.poolIds)) {
    const pool = pools.find(p => p.id === poolId);
    if (!pool) continue;
    for (const asset of poolAudioTracks(pool, project.assets || [])) push(asset);
  }
  return tracks;
}

export function deckTrackKeys(project: Project, tool: GameTool): string[] {
  return deckTracks(project, tool).map(t => t.key);
}

export function freshDjState(): DjState {
  return { status: "stopped", trackKey: null, position: 0, anchorAt: 0, fade: null, fadeOut: null, loopMode: "off", speed: DJ_DEFAULT_SPEED, visible: false, version: 0 };
}

/** Where the deck's current track has reached at a moment: the
 *  anchored position, grown by the time passed while playing — at
 *  the deck's playback rate, because positions are song seconds
 *  and a song played at double speed covers them twice as fast. */
export function djPosition(state: DjState, at: number): number {
  if (state.status !== "playing") return state.position;
  return state.position + (Math.max(0, at - state.anchorAt) / 1000) * djSpeedOf(state);
}

export function djTransition(
  previous: DjState,
  action: DjAction,
  at: number,
  trackKeys: string[],
  config?: Record<string, unknown> | null,
  argKey?: string,
): DjState {
  const bump = (next: DjState): DjState => ({ ...next, version: previous.version + 1 });
  if (action === "toggle") return bump({ ...previous, visible: !previous.visible });
  if (action === "loop") {
    // Looping is a standing choice about the show, not about one
    // song: the host can set it before or during playback.
    const mode = cleanDjLoopMode(argKey);
    if (cleanDjLoopMode(previous.loopMode) === mode) return previous;
    return bump({ ...previous, loopMode: mode });
  }
  if (action === "speed") {
    // Changing speed mid-song first settles the position at the
    // OLD rate, so the song never jumps: from the new anchor it
    // grows at the new rate.
    const speed = clampDjSpeed(argKey);
    if (djSpeedOf(previous) === speed) return previous;
    return bump({ ...previous, speed, position: djPosition(previous, at), anchorAt: at });
  }
  if (!trackKeys.length) return previous;
  const indexOf = (key: string | null) => (key ? trackKeys.indexOf(key) : -1);
  switch (action) {
    case "play": {
      if (previous.status === "playing") {
        // Pressing Play during a fade-out calls it off: the song
        // stays up at full volume.
        if (previous.fadeOut) return bump({ ...previous, fadeOut: null });
        return previous;
      }
      if (previous.status === "paused") return bump({ ...previous, status: "playing", anchorAt: at, fadeOut: null });
      const trackKey = indexOf(previous.trackKey) >= 0 ? previous.trackKey : trackKeys[0];
      return bump({ ...previous, status: "playing", trackKey, position: 0, anchorAt: at, fade: null, fadeOut: null });
    }
    case "pause": {
      if (previous.status !== "playing") return previous;
      // Pausing settles the position and completes any merge in
      // progress: the incoming track stays, the outgoing one goes.
      // A fade-out that already ran its course settles the song
      // where the fade ended, not where the clock ran on to.
      const settleAt = previous.fadeOut ? Math.min(at, previous.fadeOut.startedAt + previous.fadeOut.seconds * 1000) : at;
      return bump({ ...previous, status: "paused", position: djPosition(previous, settleAt), anchorAt: at, fade: null, fadeOut: null });
    }
    case "fade-out": {
      if (previous.status !== "playing" || previous.fadeOut) return previous;
      const seconds = clampDjFadeOutSeconds(config?.fadeOutSeconds);
      // A zero-second fade-out is just a pause.
      if (seconds <= 0) return djTransition(previous, "pause", at, trackKeys, config);
      return bump({ ...previous, fadeOut: { startedAt: at, seconds } });
    }
    case "stop": {
      if (previous.status === "stopped" && previous.position === 0 && !previous.fade && !previous.fadeOut) return previous;
      return bump({ ...previous, status: "stopped", position: 0, anchorAt: at, fade: null, fadeOut: null });
    }
    case "next":
    case "previous": {
      const current = indexOf(previous.trackKey);
      const index = action === "next"
        ? (current < 0 ? 0 : (current + 1) % trackKeys.length)
        : (current < 0 ? trackKeys.length - 1 : (current - 1 + trackKeys.length) % trackKeys.length);
      return bump({ ...previous, status: "playing", trackKey: trackKeys[index], position: 0, anchorAt: at, fade: null, fadeOut: null });
    }
    case "play-track": {
      if (!argKey || !trackKeys.includes(argKey)) return previous;
      return bump({ ...previous, status: "playing", trackKey: argKey, position: 0, anchorAt: at, fade: null, fadeOut: null });
    }
    case "merge": {
      // A merge needs a song playing and another to blend into; in
      // every other state it behaves as Next (start the next song).
      if (previous.status !== "playing" || trackKeys.length < 2) {
        return djTransition(previous, "next", at, trackKeys, config);
      }
      const current = indexOf(previous.trackKey);
      if (current < 0) return djTransition(previous, "next", at, trackKeys, config);
      const nextKey = trackKeys[(current + 1) % trackKeys.length];
      const seconds = clampDjCrossfadeSeconds(config?.crossfadeSeconds);
      if (seconds <= 0 || nextKey === previous.trackKey) {
        return djTransition(previous, "next", at, trackKeys, config);
      }
      // The outgoing track is the one on the deck — mid-fade that is
      // already the incoming track of the fade being replaced, at
      // its live position; the older outgoing track drops away.
      return bump({
        ...previous,
        status: "playing",
        trackKey: nextKey,
        position: 0,
        anchorAt: at,
        fade: { fromKey: previous.trackKey as string, fromPosition: djPosition(previous, at), startedAt: at, seconds },
        fadeOut: null,
      });
    }
    default:
      return previous;
  }
}

export type DjWalkTrack = { key: string; duration?: number | null };
export type DjWalk = {
  index: number;
  position: number;
  status: DjStatus | "ended";
  fade: { fromIndex: number; fromPosition: number; progress: number } | null;
};

/** Where the show's music actually is at a moment, computed from the
 *  anchored state and the tracks' durations: the position walks
 *  forward across track ends (a song that finished moves the show to
 *  the next one), and a merge in its window reports both sides of
 *  the blend. A track whose duration is unknown holds the walk at
 *  that track — the position still grows, so a player can correct
 *  the duration from the real audio when it ends. Looping bends the
 *  walk: "one" wraps the position inside the song on the deck,
 *  "all" wraps the whole list around, and either way the show never
 *  ends while it plays. A fade-out that has run its course reports
 *  the deck paused at the position the fade reached. */
export function walkDjPlayback(state: DjState, tracks: DjWalkTrack[], at: number): DjWalk {
  if (!tracks.length) return { index: -1, position: 0, status: state.status, fade: null };
  let index = state.trackKey ? tracks.findIndex(t => t.key === state.trackKey) : -1;
  if (index < 0) index = 0;
  // A completed fade-out froze the song where the fade ended: walk
  // the position only as far as that moment, and report paused.
  let walkAt = at;
  let fadedOut = false;
  if (state.fadeOut && state.status === "playing") {
    const fadeEnd = state.fadeOut.startedAt + state.fadeOut.seconds * 1000;
    if (at >= fadeEnd) { walkAt = fadeEnd; fadedOut = true; }
  }
  let position = djPosition(state, walkAt);
  let status: DjStatus | "ended" = fadedOut ? "paused" : state.status;
  const loopMode = cleanDjLoopMode(state.loopMode);
  const usable = (duration: number | null | undefined): duration is number => duration != null && Number.isFinite(duration) && duration > 0;
  if (state.status !== "stopped") {
    if (loopMode === "one") {
      const duration = tracks[index].duration;
      if (usable(duration) && position >= duration) position = position % duration;
    } else if (loopMode === "all") {
      // Each pass subtracts a whole song, so the position strictly
      // shrinks and the wrap always settles; an unknown duration
      // holds the walk at that song, as it does without looping.
      while (usable(tracks[index].duration) && position >= (tracks[index].duration as number)) {
        position -= tracks[index].duration as number;
        index = (index + 1) % tracks.length;
      }
    } else {
      while (index < tracks.length - 1) {
        const duration = tracks[index].duration;
        if (!usable(duration) || position < duration) break;
        position -= duration;
        index++;
      }
      const last = tracks[index].duration;
      if (status === "playing" && index === tracks.length - 1 && usable(last) && position >= last) {
        position = last;
        status = "ended";
      }
    }
  } else {
    position = 0;
  }
  let fade: DjWalk["fade"] = null;
  if (state.fade && state.status === "playing" && state.fade.seconds > 0) {
    const fadeEnd = state.fade.startedAt + state.fade.seconds * 1000;
    if (at < fadeEnd) {
      const fromIndex = tracks.findIndex(t => t.key === (state.fade as DjFade).fromKey);
      if (fromIndex >= 0) {
        const fromPosition = state.fade.fromPosition + ((at - state.fade.startedAt) / 1000) * djSpeedOf(state);
        const fromDuration = tracks[fromIndex].duration;
        if (fromDuration == null || !Number.isFinite(fromDuration) || fromPosition < fromDuration) {
          fade = { fromIndex, fromPosition, progress: Math.min(1, Math.max(0, (at - state.fade.startedAt) / (state.fade.seconds * 1000))) };
        }
      }
    }
  }
  return { index, position, status, fade };
}

/** The public copy both views read (the deck holds no secrets, so
 *  the whole state is safe to show the overlay). */
export function publicDjState(state: DjState): DjState {
  return { ...state, fade: state.fade ? { ...state.fade } : null, fadeOut: state.fadeOut ? { ...state.fadeOut } : null, loopMode: cleanDjLoopMode(state.loopMode), speed: djSpeedOf(state) };
}
