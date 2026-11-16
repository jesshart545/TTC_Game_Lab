"use client";
import { useEffect, useState } from "react";
import type { GameTool } from "../lib/project";
import { freshBankState, settleBankState, type BankState } from "../lib/bank";

// The Bank's audience face (Jessica, 2026-11-15 17:58): exactly TWO
// numerical values — Balance, the at-risk amount still climbing with each
// press, and Banked, only what the bank button has locked in. No timer, no
// round number, no press value on the overlay; those live on the host
// panel. Plain numbers only — no currency symbol anywhere on this face.
export function BankDisplay({ tool, state, preview = false }: { tool: GameTool; state?: BankState | null; preview?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const running = !preview && state?.phase === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);
  const shown = preview ? { balance: 125, banked: 250 } : settleBankState(state || freshBankState(tool.config), now);
  const title = String(tool.config.title || tool.name || "Bank");
  const accent = String((tool.config.appearance as Record<string, unknown> | undefined)?.accentColor || "#f5c542");
  return <div className="bank-face" style={{ width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6%", padding: "6%", borderRadius: 18, background: "radial-gradient(120% 120% at 50% 0%, #1d3a2a 0%, #0d1f16 55%, #07130c 100%)", border: `2px solid ${accent}`, color: "#ffffff", textAlign: "center", overflow: "hidden" }}>
    <div className="bank-face-title" style={{ fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", fontSize: "clamp(13px,2.2cqw,26px)", color: accent }}>{title}</div>
    <div style={{ display: "flex", gap: "8%", width: "100%", justifyContent: "center" }}>
      <div className="bank-face-cell" style={{ flex: "1 1 0", minWidth: 0 }}>
        <div className="bank-face-label" style={{ fontSize: "clamp(11px,1.6cqw,19px)", letterSpacing: ".12em", textTransform: "uppercase", opacity: .85 }}>Balance</div>
        <div className="bank-face-amount bank-balance" style={{ fontSize: "clamp(26px,5cqw,64px)", fontWeight: 900, lineHeight: 1.05 }}>{shown.balance.toLocaleString("en-US")}</div>
      </div>
      <div className="bank-face-cell" style={{ flex: "1 1 0", minWidth: 0 }}>
        <div className="bank-face-label" style={{ fontSize: "clamp(11px,1.6cqw,19px)", letterSpacing: ".12em", textTransform: "uppercase", opacity: .85 }}>Banked</div>
        <div className="bank-face-amount bank-banked" style={{ fontSize: "clamp(26px,5cqw,64px)", fontWeight: 900, lineHeight: 1.05, color: accent }}>{shown.banked.toLocaleString("en-US")}</div>
      </div>
    </div>
  </div>;
}
