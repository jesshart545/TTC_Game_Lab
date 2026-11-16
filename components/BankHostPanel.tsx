"use client";
import { useEffect, useState } from "react";
import type { GameTool } from "../lib/project";
import { bankRemaining, clampBankPressValue, freshBankState, settleBankState, type BankAction, type BankState } from "../lib/bank";

// The Bank's host panel (Jessica, 2026-11-15): the host sets each round's
// press value here, next to Start Round. The two game buttons are labeled
// exactly "+" (add one press) and with the bank glyph (lock the Balance
// into Banked) — the bank glyph appears ONLY on this host dashboard, her
// explicit scoped exception to the no-dollar-signs rule, so it is built
// from its char code and never appears on the overlay, the previews, the
// tool name, or any value. Round, press-value and timer readouts live here
// too; the overlay shows only Balance and Banked. End game presents the
// final banked total already calculated; Start new game (behind a
// confirm, like the other host panels) resets for the next game.
const BANK_GLYPH = String.fromCharCode(36);

export function BankHostPanel({ tool, state, onCommand }: { tool: GameTool; state?: BankState; onCommand: (toolId: string, action: BankAction, pressValue?: number) => Promise<void> | void }) {
  const [now, setNow] = useState(() => Date.now());
  const [pressDraft, setPressDraft] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState("");
  const shown = settleBankState(state || freshBankState(tool.config), now);
  const running = shown.phase === "running";
  const over = shown.phase === "over";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);
  const run = async (action: BankAction, pressValue?: number) => {
    try { await onCommand(tool.id, action, pressValue); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Bank action failed."); }
  };
  const remaining = bankRemaining(shown, now);
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return <section className="card-host bank-host" aria-label={`${tool.name} host controls`}>
    <h3>{tool.name}</h3>
    {over
      ? <div className="bank-final" role="status" style={{ textAlign: "center", padding: "10px 6px", border: "2px solid #f5c542", borderRadius: 12 }}>
          <div style={{ letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, opacity: .85 }}>Final banked total</div>
          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1 }}>{shown.banked.toLocaleString("en-US")}</div>
        </div>
      : <div className="bank-readouts" style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14 }}>
          <span>Round <strong>{shown.round || "—"}</strong></span>
          <span>Press value <strong>{shown.pressValue.toLocaleString("en-US")}</strong></span>
          <span>Time left <strong>{running ? clock : "—"}</strong></span>
          <span>Balance <strong>{shown.balance.toLocaleString("en-US")}</strong></span>
          <span>Banked <strong>{shown.banked.toLocaleString("en-US")}</strong></span>
        </div>}
    {!over && <div className="bank-round-start" style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Press value for this round
        <input type="number" min={1} max={1000000} value={pressDraft ?? String(shown.pressValue)} onChange={e => setPressDraft(e.target.value)} disabled={running} style={{ width: 130 }} />
      </label>
      <button type="button" disabled={running} onClick={() => { void run("start", clampBankPressValue(pressDraft ?? shown.pressValue)); setPressDraft(null); }}>Start Round</button>
    </div>}
    {!over && <div className="bank-press-buttons" style={{ display: "flex", gap: 10 }}>
      <button type="button" aria-label={`Add ${shown.pressValue}`} disabled={!running} onClick={() => void run("add")} style={{ flex: "1 1 0", fontSize: 30, fontWeight: 900, padding: "10px 0" }}>+</button>
      <button type="button" aria-label="Bank the balance" disabled={!running} onClick={() => void run("bank")} style={{ flex: "1 1 0", fontSize: 30, fontWeight: 900, padding: "10px 0" }}>{BANK_GLYPH}</button>
    </div>}
    {!over && <button type="button" disabled={!running && shown.phase !== "ended"} onClick={() => void run("end-game")}>End game</button>}
    {confirmReset
      ? <div role="alert" style={{ display: "grid", gap: 8 }}>
          <p>Start a new game? The banked total resets to zero for the next game.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => { setConfirmReset(false); void run("new-game"); }}>Yes, start new game</button>
            <button type="button" onClick={() => setConfirmReset(false)}>Keep current game</button>
          </div>
        </div>
      : <button type="button" onClick={() => setConfirmReset(true)}>Start new game</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
