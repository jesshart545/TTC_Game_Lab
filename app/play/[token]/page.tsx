"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import "./play.css";

// The Game Night player page (Off-Stream Multiplayer Game Night).
// Everyone who opens the link lands here: type your name, you're in the
// lobby. No account, no sign-in, no host — the game runs itself and this
// page just polls it about once a second and renders what it says. The
// creator plays on this exact page too, as one of the players.

type PlayerView = { id: string; name: string; isCreator: boolean; ready: boolean; me: boolean };
type Standing = { playerId: string; name: string; score: number; detail: string; winner: boolean };
type BingoPublic = {
  accent?: string;
  drawnItems?: string[];
  currentItem?: string | null;
  drawCount?: number;
  totalItems?: number;
  nextDrawInMs?: number | null;
  progress?: Record<string, { marks: number; away: number | null }>;
};
type RoomView = {
  title: string;
  gameType: string;
  status: "lobby" | "countdown" | "playing" | "finished";
  round: number;
  countdownEndsAt: number | null;
  players: PlayerView[];
  game: BingoPublic;
  me: { id: string; isCreator: boolean; state: { card?: string[]; markedCells?: number[] } } | null;
  standings: Standing[] | null;
};

const CONFETTI_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

export default function PlayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [view, setView] = useState<RoomView | null>(null);
  const [missing, setMissing] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const playerIdRef = useRef<string | null>(null);
  playerIdRef.current = playerId;

  const storageKey = `ttc-play-player-${token}`;

  const refresh = useCallback(async () => {
    try {
      const id = playerIdRef.current;
      const response = await fetch(`/api/play/${token}${id ? `?player=${id}` : ""}`, { cache: "no-store" });
      if (response.status === 404) { setMissing(true); return; }
      if (!response.ok) return;
      const data = await response.json();
      if (data.view) {
        setView(data.view as RoomView);
        // If the server no longer knows this seat (room was recreated), drop it.
        if (id && !data.view.me) {
          playerIdRef.current = null;
          setPlayerId(null);
          try { localStorage.removeItem(storageKey); } catch { /* private mode */ }
        }
      }
    } catch { /* a missed poll is fine; the next one lands a second later */ }
  }, [token, storageKey]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { playerIdRef.current = saved; setPlayerId(saved); }
    } catch { /* private mode */ }
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [refresh, storageKey]);

  useEffect(() => {
    if (view?.status !== "countdown") return;
    const timer = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(timer);
  }, [view?.status]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(""), 3200);
    return () => clearTimeout(timer);
  }, [flash]);

  async function join() {
    const name = nameDraft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/play/${token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) { setFlash(data.error || "Couldn't join — try again."); return; }
      playerIdRef.current = data.playerId;
      setPlayerId(data.playerId);
      try { localStorage.setItem(storageKey, data.playerId); } catch { /* private mode */ }
      if (data.view) setView(data.view as RoomView);
    } catch { setFlash("Couldn't join — check your connection and try again."); }
    finally { setBusy(false); }
  }

  async function act(action: Record<string, unknown>) {
    if (!playerIdRef.current || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/play/${token}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: playerIdRef.current, action }),
      });
      const data = await response.json();
      if (!response.ok) { setFlash(data.error || "That didn't go through — try again."); return; }
      if (data.view) setView(data.view as RoomView);
    } catch { setFlash("That didn't go through — check your connection."); }
    finally { setBusy(false); }
  }

  if (missing) {
    return (
      <main className="gn-shell">
        <div className="gn-card gn-center">
          <div className="gn-big-emoji">🕵️</div>
          <h1>That game link doesn&apos;t lead anywhere</h1>
          <p>Check the link and try again — or ask whoever shared it for a fresh one.</p>
        </div>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="gn-shell">
        <div className="gn-card gn-center">
          <div className="gn-spinner" aria-hidden="true" />
          <p>Opening the game…</p>
        </div>
      </main>
    );
  }

  const accent = view.game.accent || "#a855f7";
  const me = view.players.find(player => player.me);
  const myCard = view.me?.state.card || [];
  const myMarked = new Set(view.me?.state.markedCells || []);
  const drawn = new Set(view.game.drawnItems || []);
  const myProgress = me ? view.game.progress?.[me.id] : undefined;

  return (
    <main className="gn-shell" style={{ "--gn-accent": accent } as React.CSSProperties}>
      <div className="gn-blobs" aria-hidden="true"><span /><span /><span /></div>

      {!playerId || !me ? (
        <section className="gn-card gn-join">
          <p className="gn-kicker">🎲 Game Night</p>
          <h1 className="gn-title">{view.title}</h1>
          <p className="gn-sub">{view.status === "lobby" ? "The lobby is open — grab your seat." : view.status === "finished" ? "That round just ended — hop in for the next one." : "A game is already running — join in and play along!"}</p>
          <label className="gn-name-label" htmlFor="gn-name">Your name</label>
          <input
            id="gn-name"
            className="gn-name-input"
            value={nameDraft}
            onChange={event => setNameDraft(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") join(); }}
            placeholder="e.g. Aunt May"
            maxLength={24}
            autoFocus
          />
          <button type="button" className="gn-big-btn" onClick={join} disabled={busy || !nameDraft.trim()}>
            {busy ? "Joining…" : "Join the game →"}
          </button>
          {view.players.length > 0 && (
            <div className="gn-already-in">
              <p>Already in:</p>
              <div className="gn-chips gn-chips-small">
                {view.players.map(player => <PlayerChip key={player.id} player={player} small />)}
              </div>
            </div>
          )}
        </section>
      ) : view.status === "lobby" ? (
        <section className="gn-card gn-lobby">
          <p className="gn-kicker">🎲 Game Night · Lobby</p>
          <h1 className="gn-title">{view.title}</h1>
          <p className="gn-sub">Waiting for players — share the link with your friends!</p>
          <div className="gn-chips">
            {view.players.map(player => <PlayerChip key={player.id} player={player} />)}
          </div>
          <div className="gn-lobby-actions">
            <button
              type="button"
              className={me.ready ? "gn-big-btn gn-ready-on" : "gn-big-btn gn-ready-off"}
              onClick={() => act({ type: "ready", ready: !me.ready })}
              disabled={busy}
            >
              {me.ready ? "✓ You're ready!" : "Tap when you're ready"}
            </button>
            {me.isCreator && (
              <button type="button" className="gn-big-btn gn-start" onClick={() => act({ type: "start" })} disabled={busy}>
                ▶ Start the game
              </button>
            )}
            {!me.isCreator && <p className="gn-hint">The game&apos;s creator presses Start when everyone&apos;s in.</p>}
          </div>
        </section>
      ) : view.status === "countdown" ? (
        <section className="gn-card gn-center gn-countdown">
          <p className="gn-kicker">Get ready…</p>
          <div className="gn-count" key={Math.max(0, Math.ceil(((view.countdownEndsAt || 0) - nowMs) / 1000))}>
            {Math.max(1, Math.ceil(((view.countdownEndsAt || 0) - nowMs) / 1000))}
          </div>
          <h1 className="gn-title">{view.title}</h1>
          <div className="gn-chips gn-chips-small">
            {view.players.map(player => <PlayerChip key={player.id} player={player} small />)}
          </div>
        </section>
      ) : view.status === "playing" ? (
        <section className="gn-play">
          <header className="gn-play-head">
            <h1>{view.title}</h1>
            <span className="gn-round">Round {view.round}</span>
          </header>

          <div className="gn-call-zone">
            {view.game.currentItem ? (
              <div className="gn-call" key={view.game.drawCount}>
                <span className="gn-call-label">Now calling</span>
                <span className="gn-call-item">{view.game.currentItem}</span>
                {view.game.nextDrawInMs !== null && view.game.nextDrawInMs !== undefined && (
                  <span className="gn-next-bar" key={`bar-${view.game.drawCount}`} style={{ animationDuration: `${view.game.nextDrawInMs}ms` }} />
                )}
              </div>
            ) : (
              <div className="gn-call gn-call-waiting">First call coming up…</div>
            )}
            {(view.game.drawnItems || []).length > 1 && (
              <div className="gn-history" aria-label="Called so far">
                {[...(view.game.drawnItems || [])].slice(0, -1).reverse().map((item, index) => (
                  <span key={`${item}-${index}`} className="gn-history-chip">{item}</span>
                ))}
              </div>
            )}
          </div>

          {myCard.length === 25 ? (
            <>
              <div className="gn-progress-line" role="status">
                {myProgress?.away === 1
                  ? "🔥 One square away from BINGO!"
                  : myProgress
                    ? `${myProgress.marks} marked · ${myProgress.away} away from a line`
                    : "Your card"}
              </div>
              <div className="gn-board" role="grid" aria-label="Your bingo card">
                {myCard.map((item, cell) => {
                  const free = cell === 12;
                  const marked = myMarked.has(cell);
                  const called = !free && drawn.has(item);
                  return (
                    <button
                      key={cell}
                      type="button"
                      role="gridcell"
                      className={`gn-cell${free ? " gn-cell-free" : ""}${marked ? " gn-cell-marked" : ""}${!marked && called ? " gn-cell-called" : ""}`}
                      onClick={() => { if (!free && !marked && called) act({ type: "mark", cell }); }}
                      disabled={free || marked || !called}
                      aria-label={free ? "Free square" : marked ? `${item} — marked` : called ? `${item} — called, tap to mark` : item}
                    >
                      <span>{free ? "★ FREE" : item}</span>
                      {marked && !free && <span className="gn-cell-check" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="gn-hint">Your card is being dealt…</p>
          )}

          <div className="gn-standings-strip" aria-label="How everyone is doing">
            {view.players.map(player => {
              const progress = view.game.progress?.[player.id];
              return (
                <span key={player.id} className={`gn-strip-chip${player.me ? " gn-strip-me" : ""}`}>
                  {player.isCreator ? "⭐ " : ""}{player.name}: <strong>{progress?.marks ?? 0}</strong>
                  {progress?.away === 1 ? " 🔥" : ""}
                </span>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="gn-card gn-finished">
          <Confetti />
          <p className="gn-kicker">🏆 Final standings</p>
          <h1 className="gn-title">{view.title}</h1>
          {view.standings && view.standings.length > 0 && (
            <>
              <div className="gn-podium">
                {[view.standings[1], view.standings[0], view.standings[2]].map((standing, slot) => standing ? (
                  <div key={standing.playerId} className={`gn-podium-slot gn-podium-${slot}${standing.playerId === me.id ? " gn-podium-me" : ""}`}>
                    <div className="gn-podium-face">{standing.winner ? "👑" : slot === 1 ? "🥇" : slot === 0 ? "🥈" : "🥉"}</div>
                    <div className="gn-podium-name">{standing.name}{standing.playerId === me.id ? " (you)" : ""}</div>
                    <div className="gn-podium-detail">{standing.detail}</div>
                    <div className="gn-podium-bar" />
                  </div>
                ) : <div key={slot} className="gn-podium-slot gn-podium-empty" />)}
              </div>
              {view.standings.length > 3 && (
                <div className="gn-rest">
                  {view.standings.slice(3).map((standing, index) => (
                    <div key={standing.playerId} className="gn-rest-row">
                      <span>{index + 4}. {standing.name}{standing.playerId === me.id ? " (you)" : ""}</span>
                      <span>{standing.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              {view.standings[0] && (
                <p className="gn-winner-line">
                  {view.standings[0].playerId === me.id ? "🎉 You won! " : `🎉 ${view.standings[0].name} wins! `}
                  {view.standings[0].detail}
                </p>
              )}
            </>
          )}
          <button type="button" className="gn-big-btn gn-start" onClick={() => act({ type: "play-again" })} disabled={busy}>
            ↻ Play again — same game, fresh cards
          </button>
          <p className="gn-hint">Anyone can press Play Again — the first press deals everyone back in.</p>
        </section>
      )}

      {flash && <div className="gn-flash" role="status">{flash}</div>}
    </main>
  );
}

function PlayerChip({ player, small = false }: { player: PlayerView; small?: boolean }) {
  const initials = player.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className={`gn-chip${player.ready ? " gn-chip-ready" : ""}${small ? " gn-chip-small" : ""}`}>
      <span className="gn-chip-avatar" aria-hidden="true">{initials}</span>
      <span className="gn-chip-name">{player.isCreator ? "⭐ " : ""}{player.name}{player.me ? " (you)" : ""}</span>
      {player.ready && <span className="gn-chip-check" aria-hidden="true">✓ ready</span>}
    </div>
  );
}

function Confetti() {
  return (
    <div className="gn-confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <span
          key={index}
          style={{
            left: `${(index * 37) % 100}%`,
            background: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
            animationDelay: `${(index % 7) * 0.35}s`,
            animationDuration: `${2.6 + (index % 5) * 0.4}s`,
            transform: `rotate(${index * 47}deg)`,
          }}
        />
      ))}
    </div>
  );
}
