// The Bank — a host-run accumulation game tool (Jessica, 2026-11-15).
//
// Mechanics, exactly as specified: at the start of every timed round the
// HOST sets the value of one button press for that round (set higher round
// over round, host-set each time; within a round the press value is FIXED —
// no per-press escalation). Pressing ADD adds the round's press value to
// the at-risk Balance. Pressing the bank button moves the whole Balance
// into Banked — it can happen multiple times within a round and neither
// ends the round nor changes the press value. When the round timer stops,
// ONLY the still-unbanked Balance clears to zero; Banked remains through
// to the end of the game and climbs ONLY when the bank button is pressed.
// Ending the game presents the final Banked total; a new game resets
// everything to the pre-round-1 state.
//
// This module is the ONE shared state layer: the live server
// (lib/bank-server.ts), the draft runtime and both displays settle and
// transition through these functions, so the dashboard and the overlay can
// never disagree — in particular the timer-expiry clear happens here, in
// settleBankState, not in any single view.

export type BankPhase = "idle" | "running" | "ended" | "over";

export type BankState = {
  banked: number;
  balance: number;
  pressValue: number;
  round: number;
  phase: BankPhase;
  endsAt: number;
  roundSeconds: number;
  visible: boolean;
  version: number;
};

export type BankAction = "start" | "add" | "bank" | "toggle" | "end-game" | "new-game";

export const BANK_DEFAULT_ROUND_SECONDS = 60;
export const BANK_DEFAULT_PRESS_VALUE = 10;
export const BANK_MIN_ROUND_SECONDS = 5;
export const BANK_MAX_ROUND_SECONDS = 3600;
export const BANK_MIN_PRESS_VALUE = 1;
export const BANK_MAX_PRESS_VALUE = 1000000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Any numeric config the model or a form supplies is coerced and clamped
// to sane ranges (the sanitizer lesson from the Plinko creation fix).
export function clampBankRoundSeconds(value: unknown): number {
  return clampInt(value, BANK_DEFAULT_ROUND_SECONDS, BANK_MIN_ROUND_SECONDS, BANK_MAX_ROUND_SECONDS);
}

export function clampBankPressValue(value: unknown): number {
  return clampInt(value, BANK_DEFAULT_PRESS_VALUE, BANK_MIN_PRESS_VALUE, BANK_MAX_PRESS_VALUE);
}

// A fresh, pre-round-1 state. Config (the tool's saved settings) seeds the
// round length and the starting press value; live rounds then take the
// host's per-round input.
export function freshBankState(config?: Record<string, unknown> | null): BankState {
  return {
    banked: 0,
    balance: 0,
    pressValue: clampBankPressValue(config?.pressValue),
    round: 0,
    phase: "idle",
    endsAt: 0,
    roundSeconds: clampBankRoundSeconds(config?.roundSeconds),
    visible: false,
    version: 0,
  };
}

// The timer-expiry clear, in the shared layer: when a running round's time
// is up, the still-unbanked Balance clears to zero and the round is marked
// ended. Banked is never touched here.
export function settleBankState(state: BankState, at: number): BankState {
  if (state.phase === "running" && at >= state.endsAt) {
    return { ...state, balance: 0, phase: "ended", endsAt: 0 };
  }
  return state;
}

// The settled, public copy both views read (the bank holds no secrets, so
// the whole state is safe to show the overlay).
export function publicBankState(state: BankState, at: number): BankState {
  return settleBankState({ ...state }, at);
}

export function bankRemaining(state: BankState, at: number): number {
  const settled = settleBankState(state, at);
  if (settled.phase !== "running") return 0;
  return Math.max(0, Math.ceil((settled.endsAt - at) / 1000));
}

export function bankTransition(
  previous: BankState,
  action: BankAction,
  at: number,
  input: { pressValue?: unknown; roundSeconds?: unknown } = {},
): BankState {
  if (action === "new-game") {
    // Reset for the next game / next live stream: Banked and Balance zero,
    // back to the pre-round-1 state. Placement (visible) is the creator's,
    // not the game's, so it survives the reset.
    const fresh = freshBankState({
      roundSeconds: input.roundSeconds !== undefined ? input.roundSeconds : previous.roundSeconds,
      pressValue: input.pressValue !== undefined ? input.pressValue : previous.pressValue,
    });
    return { ...fresh, visible: previous.visible, version: previous.version + 1 };
  }
  const settled = settleBankState(previous, at);
  const changed = settled !== previous;
  const bump = (next: BankState): BankState => ({ ...next, version: previous.version + 1 });
  switch (action) {
    case "start": {
      // A finished game must be reset before a new one starts.
      if (settled.phase === "over") return changed ? bump(settled) : previous;
      const roundSeconds = input.roundSeconds !== undefined ? clampBankRoundSeconds(input.roundSeconds) : settled.roundSeconds;
      const pressValue = input.pressValue !== undefined && input.pressValue !== null ? clampBankPressValue(input.pressValue) : settled.pressValue;
      return bump({
        ...settled,
        round: settled.round + 1,
        balance: 0,
        pressValue,
        roundSeconds,
        endsAt: at + roundSeconds * 1000,
        phase: "running",
      });
    }
    case "add": {
      // Presses count only while a round is running.
      if (settled.phase !== "running") return changed ? bump(settled) : previous;
      return bump({ ...settled, balance: settled.balance + settled.pressValue });
    }
    case "bank": {
      // Banking moves the Balance shown at this moment into Banked, on top
      // of whatever was banked before; Balance restarts at 0 within the
      // same round and the press value does not change.
      if (settled.balance <= 0) return changed ? bump(settled) : previous;
      return bump({ ...settled, banked: settled.banked + settled.balance, balance: 0 });
    }
    case "toggle":
      return bump({ ...settled, visible: !settled.visible });
    case "end-game": {
      // The game is over: the unbanked Balance is lost (it was only ever
      // saved by banking), and the final Banked total stands as the result.
      if (settled.phase === "over") return changed ? bump(settled) : previous;
      return bump({ ...settled, balance: 0, endsAt: 0, phase: "over" });
    }
    default:
      return changed ? bump(settled) : previous;
  }
}
