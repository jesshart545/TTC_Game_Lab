"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import "./play.css";
import { DRAW_GUESS_CANVAS, DRAW_GUESS_COLORS, DRAW_GUESS_WIDTHS } from "../../../lib/draw-guess";

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
type QuizPublic = {
  categories?: { name: string; squares: { value: number; used: boolean }[] }[];
  phase?: "pick" | "answer" | "reveal";
  turnPlayerId?: string | null;
  turnName?: string | null;
  current?: { key: string; categoryName: string; value: number; prompt: string; endsAt: number | null; answeredCount: number; playerCount: number } | null;
  reveal?: { answer: string; value: number; results: { playerId: string; name: string; answered: boolean; correct: boolean; delta: number; answerText: string }[] } | null;
  scores?: Record<string, number>;
  remaining?: number;
  totalSquares?: number;
};
type SurveyPublic = {
  teams?: { name: string; color: string; score: number; members: { id: string; name: string }[]; control: boolean }[];
  stage?: "faceoff" | "play" | "steal" | "reveal" | "done";
  questionIndex?: number;
  questionCount?: number;
  question?: string | null;
  board?: { rank: number; open: boolean; text?: string; points?: number }[];
  pot?: number;
  strikes?: number;
  controlTeam?: number | null;
  faceoff?: { playerIds: (string | null)[]; names: (string | null)[]; endsAt: number; submitted: boolean[] } | null;
  guesser?: { playerId: string; name: string | null; team: number; endsAt: number } | null;
  lastRound?: { winnerTeam: number | null; winnerName: string | null; potAwarded: number; stolen: boolean } | null;
};
type PerfectMatchPublic = {
  matchStage?: "submit" | "judge" | "reveal" | "done";
  prompt?: string | null;
  promptNumber?: number;
  promptCount?: number;
  judgeId?: string | null;
  judgeName?: string | null;
  endsAt?: number | null;
  winPoints?: number;
  handCounts?: Record<string, number>;
  scores?: Record<string, number>;
  submittedIds?: string[];
  waitingOn?: number;
  revealedCards?: { text: string; ownerId?: string; ownerName?: string; winner?: boolean }[];
  lastRound?: { prompt: string; winnerId: string | null; winnerName: string | null; winningCard: string | null; judgeName: string | null } | null;
};
type WordChainPublic = {
  chainStage?: "play" | "done";
  chain?: string[];
  currentWord?: string | null;
  chainLength?: number;
  chainTarget?: number;
  turnPlayerId?: string | null;
  turnName?: string | null;
  turnEndsAt?: number | null;
  turnNumber?: number;
  maxStrikes?: number;
  wordPlayers?: Record<string, { strikes: number; out: boolean; added: number }>;
  lastPlay?: { playerId: string; name: string; word: string; result: "in" | "repeat" | "invalid" | "timeout" } | null;
};
type DrawGuessPublic = {
  drawStage?: "draw" | "reveal" | "done";
  drawerId?: string | null;
  drawerName?: string | null;
  blanks?: string | null;
  strokes?: { color: string; width: number; points: [number, number][] }[];
  guesses?: { playerId: string; name: string; text: string }[];
  endsAt?: number | null;
  wordNumber?: number;
  wordCount?: number;
  scores?: Record<string, number>;
  drawReveal?: { word: string; drawerId: string | null; drawerName: string | null; guesserId: string | null; guesserName: string | null } | null;
};
type RoomView = {
  title: string;
  gameType: string;
  status: "lobby" | "countdown" | "playing" | "finished";
  round: number;
  countdownEndsAt: number | null;
  players: PlayerView[];
  game: BingoPublic & QuizPublic & SurveyPublic & PerfectMatchPublic & WordChainPublic & DrawGuessPublic;
  me: { id: string; isCreator: boolean; state: { card?: string[]; markedCells?: number[]; score?: number; answerKey?: string; answerText?: string; team?: number; guessText?: string; hand?: string[]; submittedCard?: string; submittedRound?: number; drawWord?: string } } | null;
  standings: Standing[] | null;
};

const CONFETTI_COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

export default function PlayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [view, setView] = useState<RoomView | null>(null);
  const [missing, setMissing] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");
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

  // A fresh question means a fresh answer box (Quiz Board).
  const quizQuestionKey = view?.gameType === "quiz-board" ? view.game.current?.key : undefined;
  useEffect(() => { setAnswerDraft(""); }, [quizQuestionKey]);

  // A fresh guess slot means a fresh guess box (Survey Showdown).
  const surveySlotKey = view?.gameType === "survey-showdown"
    ? [view.game.questionIndex, view.game.stage, view.game.guesser?.playerId || "", (view.game.faceoff?.playerIds || []).join(","), view.game.guesser?.endsAt || view.game.faceoff?.endsAt || ""].join(":")
    : undefined;
  useEffect(() => { setAnswerDraft(""); }, [surveySlotKey]);

  // A fresh turn means a fresh word box (Word Chain).
  const chainTurnKey = view?.gameType === "word-chain"
    ? [view.game.turnNumber, view.game.turnPlayerId || ""].join(":")
    : undefined;
  useEffect(() => { setAnswerDraft(""); }, [chainTurnKey]);

  // The drawer's pen (Draw & Guess): the in-progress stroke lives
  // locally so the drawer sees it the instant they move; finished
  // strokes are sent to the room and come back in the public state.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [penColor, setPenColor] = useState<string>(DRAW_GUESS_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(DRAW_GUESS_WIDTHS[1]);
  const [penPoints, setPenPoints] = useState<[number, number][]>([]);

  // A fresh drawing round means a fresh guess box (Draw & Guess).
  const drawRoundKey = view?.gameType === "draw-guess"
    ? [view.game.wordNumber, view.game.drawerId || "", view.game.drawStage || ""].join(":")
    : undefined;
  useEffect(() => { setAnswerDraft(""); setPenPoints([]); }, [drawRoundKey]);

  function canvasPoint(event: React.PointerEvent): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return [
      Math.round(((event.clientX - rect.left) / rect.width) * DRAW_GUESS_CANVAS.width),
      Math.round(((event.clientY - rect.top) / rect.height) * DRAW_GUESS_CANVAS.height),
    ];
  }

  async function sendStroke(stroke: { color: string; width: number; points: [number, number][] }) {
    if (!playerIdRef.current) return;
    try {
      const response = await fetch(`/api/play/${token}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: playerIdRef.current, action: { type: "stroke", stroke } }),
      });
      const data = await response.json();
      if (!response.ok) { setFlash(data.error || "That stroke didn't go through — try again."); return; }
      if (data.view) setView(data.view as RoomView);
    } catch { /* a missed stroke is visible at once; the next poll shows the room's truth */ }
  }

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
  const quiz = view.gameType === "quiz-board" ? view.game : null;
  const myTurn = !!quiz && !!me && quiz.phase === "pick" && quiz.turnPlayerId === me.id;
  const myAnswered = !!quiz && quiz.phase === "answer" && !!quiz.current && !!view.me && view.me.state.answerKey === quiz.current.key;
  const survey = view.gameType === "survey-showdown" ? view.game : null;
  const myFaceoffIndex = survey?.faceoff && me ? survey.faceoff.playerIds.findIndex(id => id === me.id) : -1;
  const myFaceoffIn = myFaceoffIndex >= 0 && !!survey?.faceoff?.submitted[myFaceoffIndex];
  const myGuessTurn = !!survey && !!me && (survey.stage === "play" || survey.stage === "steal") && survey.guesser?.playerId === me.id;
  const myTeamIndex = survey?.teams && me ? survey.teams.findIndex(team => team.members.some(member => member.id === me.id)) : -1;
  const match = view.gameType === "perfect-match" ? view.game : null;
  const myHand = view.me?.state.hand || [];
  const isJudge = !!match && !!me && match.judgeId === me.id;
  const mySubmitted = !!match && !!me && (match.submittedIds || []).includes(me.id);
  const chain = view.gameType === "word-chain" ? view.game : null;
  const myChainState = chain && me ? chain.wordPlayers?.[me.id] : undefined;
  const myChainTurn = !!chain && !!me && chain.turnPlayerId === me.id && !myChainState?.out;
  const chainWords = chain?.chain || [];
  const drawGame = view.gameType === "draw-guess" ? view.game : null;
  const iAmDrawer = !!drawGame && !!me && drawGame.drawerId === me.id;
  const myDrawWord = view.me?.state.drawWord || "";

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
          {view.gameType === "survey-showdown" && (
            <p className="gn-hint">Two teams are dealt automatically when the game starts — you play for whichever team your seat gives you.</p>
          )}
          {view.gameType === "perfect-match" && (
            <p className="gn-hint">Everyone is dealt a hand of cards when the game starts. Each round one player judges — everyone else plays the card from their hand that best matches the prompt.</p>
          )}
          {view.gameType === "word-chain" && (
            <p className="gn-hint">A starter word goes up BIG — then everyone takes turns adding one word that goes with the word before it. You have 10 seconds a turn; a repeat or a missed turn is a strike, and two strikes and you&apos;re out. Last one standing wins — or finish a 30-word chain together!</p>
          )}
          {view.gameType === "draw-guess" && (
            <p className="gn-hint">Everyone takes a turn at the easel: when you draw, only you see your word — sketch it on the big canvas while everyone else races to guess it. First right guess scores 3 points, and the drawer scores 1. Everyone draws twice!</p>
          )}
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

          {match ? (
            <>
              <div className="gn-standings-strip" aria-label="Scores">
                {[...view.players].sort((a, b) => (match.scores?.[b.id] ?? 0) - (match.scores?.[a.id] ?? 0)).map(player => (
                  <span key={player.id} className={`gn-strip-chip${player.me ? " gn-strip-me" : ""}${match.judgeId === player.id ? " gn-strip-turn" : ""}`}>
                    {player.isCreator ? "⭐ " : ""}{player.name}: <strong>{match.scores?.[player.id] ?? 0}</strong>
                    {match.judgeId === player.id ? " · judging" : ""}
                  </span>
                ))}
              </div>

              <div className="gn-call-zone">
                <div className="gn-call" key={`mp-${match.promptNumber}`}>
                  <span className="gn-call-label">Prompt {match.promptNumber ?? 1} of {match.promptCount ?? 0} · {match.judgeName ?? "A player"} is judging · first to {match.winPoints ?? 5}</span>
                  <span className="gn-call-item gn-match-prompt">{match.prompt}</span>
                  {match.matchStage === "submit" && match.endsAt && (
                    <span className="gn-next-bar" key={`mpbar-${match.promptNumber}`} style={{ animationDuration: `${Math.max(0, match.endsAt - Date.now())}ms` }} />
                  )}
                </div>
              </div>

              {match.matchStage === "submit" ? (
                <>
                  <div className="gn-match-backs" aria-label="Cards played so far">
                    {(match.submittedIds || []).map(id => (
                      <span key={id} className={`gn-match-back${me && id === me.id ? " gn-match-back-mine" : ""}`} aria-hidden="true" />
                    ))}
                    {(match.submittedIds || []).length === 0 && <span className="gn-hint gn-match-backs-empty">No cards in yet…</span>}
                  </div>
                  {isJudge ? (
                    <p className="gn-progress-line" role="status">
                      🧑‍⚖️ You&apos;re the judge this round — {(match.submittedIds || []).length} card{(match.submittedIds || []).length === 1 ? "" : "s"} in, waiting on {match.waitingOn ?? 0} more
                    </p>
                  ) : mySubmitted ? (
                    <>
                      <p className="gn-progress-line" role="status">✓ Your card is in — face-down with the rest</p>
                      {view.me?.state.submittedCard && <p className="gn-hint">You played “{view.me.state.submittedCard}” — only you can see that until the pick.</p>}
                    </>
                  ) : (
                    <>
                      <p className="gn-progress-line" role="status">Play the card from your hand that fits the prompt best:</p>
                      <div className="gn-hand" aria-label="Your hand">
                        {myHand.map((card, index) => (
                          <button
                            key={`${card}-${index}`}
                            type="button"
                            className="gn-hand-card"
                            onClick={() => act({ type: "submit", card })}
                            disabled={busy}
                            aria-label={`Play ${card}`}
                          >
                            {card}
                          </button>
                        ))}
                      </div>
                      <p className="gn-hint">Tap a card to play it face-down — nobody sees whose is whose.</p>
                    </>
                  )}
                </>
              ) : match.matchStage === "judge" ? (
                <>
                  <p className="gn-progress-line" role="status">
                    {isJudge ? "👀 The cards are in — tap the best match!" : `${match.judgeName ?? "The judge"} is picking the best match…`}
                  </p>
                  <div className="gn-match-reveal" aria-label="Played cards">
                    {(match.revealedCards || []).map((card, index) => isJudge ? (
                      <button
                        key={index}
                        type="button"
                        className="gn-match-card gn-match-card-pick"
                        onClick={() => act({ type: "pick", index })}
                        disabled={busy}
                        aria-label={`Pick ${card.text}`}
                      >
                        {card.text}
                      </button>
                    ) : (
                      <div key={index} className="gn-match-card">{card.text}</div>
                    ))}
                  </div>
                  <p className="gn-hint">The cards were shuffled — nobody knows whose is whose, not even the judge.</p>
                </>
              ) : match.matchStage === "reveal" ? (
                <>
                  <p className="gn-progress-line" role="status">
                    {match.lastRound?.winnerName
                      ? `🏆 ${match.lastRound.winnerName} takes the round with “${match.lastRound.winningCard}”!`
                      : "No cards were played that round — no point for anyone."}
                  </p>
                  <div className="gn-match-reveal" aria-label="Played cards and their players">
                    {(match.revealedCards || []).map((card, index) => (
                      <div key={index} className={`gn-match-card${card.winner ? " gn-match-winner" : ""}`}>
                        <span className="gn-match-card-text">{card.text}</span>
                        <span className="gn-match-owner">{card.winner ? "🏆 " : ""}{card.ownerName}{me && card.ownerId === me.id ? " (you)" : ""}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : survey ? (
            <>
              <div className="gn-survey-teams">
                {(survey.teams || []).map((team, ti) => (
                  <div key={ti} className={`gn-team-panel${team.control ? " gn-team-control" : ""}${myTeamIndex === ti ? " gn-team-mine" : ""}`} style={{ "--gn-team": team.color } as React.CSSProperties}>
                    <div className="gn-team-head">
                      <span className="gn-team-dot" aria-hidden="true" />
                      <span className="gn-team-name">{team.name}</span>
                      <span className="gn-team-score">{team.score}</span>
                    </div>
                    <div className="gn-team-members">
                      {team.members.map(member => (
                        <span key={member.id} className={`gn-team-member${me && member.id === me.id ? " gn-team-member-me" : ""}`}>
                          {view.players.find(p => p.id === member.id)?.isCreator ? "⭐ " : ""}{member.name}{me && member.id === me.id ? " (you)" : ""}
                        </span>
                      ))}
                    </div>
                    {team.control && (survey.stage === "play" || survey.stage === "steal") && (
                      <div className="gn-team-strikes" aria-label={`${survey.strikes ?? 0} of 3 strikes`}>
                        {[0, 1, 2].map(i => <span key={i} className={i < (survey.strikes ?? 0) ? "gn-x gn-x-on" : "gn-x"} aria-hidden="true">✕</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="gn-call-zone">
                <div className="gn-call" key={`sq-${survey.questionIndex}`}>
                  <span className="gn-call-label">Question {(survey.questionIndex ?? 0) + 1} of {survey.questionCount ?? 0} · Pot {survey.pot ?? 0}</span>
                  <span className="gn-call-item gn-survey-question">{survey.question}</span>
                  {(survey.stage === "faceoff" || survey.stage === "play" || survey.stage === "steal") && (
                    <span className="gn-next-bar" key={`sbar-${surveySlotKey}`} style={{ animationDuration: `${Math.max(0, (survey.guesser?.endsAt || survey.faceoff?.endsAt || 0) - Date.now())}ms` }} />
                  )}
                </div>
              </div>

              <div className="gn-survey-board" aria-label="Survey board">
                {(survey.board || []).map(slot => (
                  <div key={slot.rank} className={`gn-slot${slot.open ? " gn-slot-open" : ""}`}>
                    <span className="gn-slot-rank">{slot.rank}</span>
                    {slot.open ? (
                      <>
                        <span className="gn-slot-text">{slot.text}</span>
                        <span className="gn-slot-points">{slot.points}</span>
                      </>
                    ) : (
                      <span className="gn-slot-cover" aria-hidden="true">· · ·</span>
                    )}
                  </div>
                ))}
              </div>

              {survey.stage === "faceoff" && survey.faceoff ? (
                <div className="gn-survey-action">
                  <p className="gn-progress-line" role="status">
                    ⚔️ Face-off: {survey.faceoff.names.filter(Boolean).join(" vs ") || "…"}
                  </p>
                  {myFaceoffIndex >= 0 ? (
                    myFaceoffIn ? (
                      <p className="gn-progress-line" role="status">✓ Your answer is in — waiting on the other side…</p>
                    ) : (
                      <div className="gn-answer-row">
                        <input
                          className="gn-name-input gn-answer-input"
                          value={answerDraft}
                          onChange={event => setAnswerDraft(event.target.value)}
                          onKeyDown={event => { if (event.key === "Enter" && answerDraft.trim()) act({ type: "guess", text: answerDraft }); }}
                          placeholder="Name an answer…"
                          maxLength={200}
                          autoFocus
                          aria-label="Your face-off answer"
                        />
                        <button type="button" className="gn-big-btn gn-answer-btn" onClick={() => act({ type: "guess", text: answerDraft })} disabled={busy || !answerDraft.trim()}>
                          {busy ? "Locking in…" : "Lock it in"}
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="gn-hint">Whoever names the higher answer wins control for their team.</p>
                  )}
                </div>
              ) : survey.stage === "play" || survey.stage === "steal" ? (
                <div className="gn-survey-action">
                  <p className="gn-progress-line" role="status">
                    {survey.stage === "steal"
                      ? `💥 Steal chance! ${survey.guesser?.name ?? "A player"} guesses for ${survey.teams?.[survey.guesser?.team ?? 0]?.name ?? "their team"} — one match takes the whole pot`
                      : `${survey.guesser?.name ?? "A player"} is guessing for ${survey.teams?.[survey.controlTeam ?? 0]?.name ?? "their team"}`}
                  </p>
                  {myGuessTurn ? (
                    <div className="gn-answer-row">
                      <input
                        className="gn-name-input gn-answer-input"
                        value={answerDraft}
                        onChange={event => setAnswerDraft(event.target.value)}
                        onKeyDown={event => { if (event.key === "Enter" && answerDraft.trim()) act({ type: "guess", text: answerDraft }); }}
                        placeholder="Name an answer…"
                        maxLength={200}
                        autoFocus
                        aria-label="Your guess"
                      />
                      <button type="button" className="gn-big-btn gn-answer-btn" onClick={() => act({ type: "guess", text: answerDraft })} disabled={busy || !answerDraft.trim()}>
                        {busy ? "Locking in…" : "Lock it in"}
                      </button>
                    </div>
                  ) : (
                    <p className="gn-hint">{survey.stage === "steal" ? "If it matches, their team takes the pot." : "A match banks its points in the pot — three misses and the other team can steal."}</p>
                  )}
                </div>
              ) : survey.stage === "reveal" ? (
                <div className="gn-survey-action">
                  <p className="gn-progress-line" role="status">
                    {survey.lastRound
                      ? survey.lastRound.winnerName
                        ? survey.lastRound.stolen
                          ? `💥 Stolen! ${survey.lastRound.winnerName} takes the pot — ${survey.lastRound.potAwarded} points!`
                          : `🏆 ${survey.lastRound.winnerName} takes the pot — ${survey.lastRound.potAwarded} points!`
                        : "Nobody found the board that time — no points."
                      : "Round over!"}
                  </p>
                </div>
              ) : null}
            </>
          ) : quiz ? (
            <>
              <div className="gn-standings-strip" aria-label="Scores">
                {[...view.players].sort((a, b) => (quiz.scores?.[b.id] ?? 0) - (quiz.scores?.[a.id] ?? 0)).map(player => (
                  <span key={player.id} className={`gn-strip-chip${player.me ? " gn-strip-me" : ""}${quiz.phase === "pick" && quiz.turnPlayerId === player.id ? " gn-strip-turn" : ""}`}>
                    {player.isCreator ? "⭐ " : ""}{player.name}: <strong>{quiz.scores?.[player.id] ?? 0}</strong>
                    {quiz.phase === "pick" && quiz.turnPlayerId === player.id ? " · picking" : ""}
                  </span>
                ))}
              </div>

              {quiz.phase === "answer" && quiz.current ? (
                <div className="gn-call-zone">
                  <div className="gn-call" key={quiz.current.key}>
                    <span className="gn-call-label">{quiz.current.categoryName} · {quiz.current.value} points</span>
                    <span className="gn-call-item gn-quiz-prompt">{quiz.current.prompt}</span>
                    {quiz.current.endsAt && (
                      <span className="gn-next-bar" key={`bar-${quiz.current.key}`} style={{ animationDuration: `${Math.max(0, quiz.current.endsAt - Date.now())}ms` }} />
                    )}
                  </div>
                  {myAnswered ? (
                    <p className="gn-progress-line" role="status">
                      ✓ Your answer is in{view.me?.state.answerText ? `: “${view.me.state.answerText}”` : ""} — {quiz.current.answeredCount} of {quiz.current.playerCount} answered
                    </p>
                  ) : (
                    <div className="gn-answer-row">
                      <input
                        className="gn-name-input gn-answer-input"
                        value={answerDraft}
                        onChange={event => setAnswerDraft(event.target.value)}
                        onKeyDown={event => { if (event.key === "Enter" && answerDraft.trim()) act({ type: "answer", text: answerDraft }); }}
                        placeholder="Type your answer…"
                        maxLength={200}
                        autoFocus
                        aria-label="Your answer"
                      />
                      <button type="button" className="gn-big-btn gn-answer-btn" onClick={() => act({ type: "answer", text: answerDraft })} disabled={busy || !answerDraft.trim()}>
                        {busy ? "Locking in…" : "Lock it in"}
                      </button>
                    </div>
                  )}
                </div>
              ) : quiz.phase === "reveal" && quiz.reveal ? (
                <div className="gn-call-zone">
                  <div className="gn-call gn-reveal-card">
                    <span className="gn-call-label">The answer</span>
                    <span className="gn-call-item">{quiz.reveal.answer}</span>
                  </div>
                  <div className="gn-reveal-list">
                    {quiz.reveal.results.map(result => (
                      <div key={result.playerId} className={`gn-reveal-row${me && result.playerId === me.id ? " gn-reveal-me" : ""}`}>
                        <span className="gn-reveal-name">{result.name}{me && result.playerId === me.id ? " (you)" : ""}</span>
                        <span className="gn-reveal-answer">{result.answered ? result.answerText : "no answer"}</span>
                        <span className={result.correct ? "gn-delta gn-delta-good" : result.answered ? "gn-delta gn-delta-bad" : "gn-delta"}>
                          {result.correct ? `✓ +${result.delta}` : result.answered ? `✗ ${result.delta}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="gn-progress-line" role="status">
                    {myTurn ? "🎯 Your pick — choose a square!" : quiz.turnName ? `${quiz.turnName} is choosing a square…` : "Choosing the next square…"}
                  </p>
                  <div className="gn-quiz-board" role="grid" aria-label="Quiz board" style={{ gridTemplateColumns: `repeat(${Math.max(1, (quiz.categories || []).length)}, 1fr)` }}>
                    {(quiz.categories || []).map((category, ci) => (
                      <div key={ci} className="gn-quiz-col">
                        <div className="gn-quiz-cat">{category.name}</div>
                        {category.squares.map((square, qi) => (
                          <button
                            key={qi}
                            type="button"
                            role="gridcell"
                            className={`gn-quiz-square${square.used ? " gn-quiz-used" : ""}${myTurn && !square.used ? " gn-quiz-live" : ""}`}
                            onClick={() => act({ type: "pick", category: ci, question: qi })}
                            disabled={!myTurn || square.used || busy}
                            aria-label={square.used ? `${category.name} ${square.value} — already played` : `${category.name} for ${square.value} points`}
                          >
                            {square.used ? "✓" : square.value}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="gn-hint">{quiz.remaining ?? 0} squares left on the board</p>
                </>
              )}
            </>
          ) : chain ? (
            <>
              <div className="gn-standings-strip" aria-label="Players and strikes">
                {view.players.map(player => {
                  const state = chain.wordPlayers?.[player.id];
                  const isTurn = chain.turnPlayerId === player.id && !state?.out;
                  return (
                    <span key={player.id} className={`gn-strip-chip${player.me ? " gn-strip-me" : ""}${isTurn ? " gn-strip-turn" : ""}${state?.out ? " gn-strip-out" : ""}`}>
                      {player.isCreator ? "⭐ " : ""}{player.name}
                      {state?.out ? " · out" : (
                        <> · {state?.added ?? 0} added{" "}
                          <span className="gn-strip-strikes" aria-label={`${state?.strikes ?? 0} of ${chain.maxStrikes ?? 2} strikes`}>
                            {[0, 1].map(i => <span key={i} className={i < (state?.strikes ?? 0) ? "gn-x gn-x-on" : "gn-x"} aria-hidden="true">✕</span>)}
                          </span>
                        </>
                      )}
                      {isTurn ? " · thinking…" : ""}
                    </span>
                  );
                })}
              </div>

              <div className="gn-call-zone">
                <div className="gn-call" key={`wc-${chain.chainLength}`}>
                  <span className="gn-call-label">
                    {chain.chainLength === 1 ? "The starter word" : `Word ${chain.chainLength} of ${chain.chainTarget ?? 30}`} · {chain.turnName ? `${chain.turnName} is up` : "Next word"}
                  </span>
                  <span className="gn-call-item gn-chain-current">{chain.currentWord}</span>
                  {chain.turnEndsAt && (
                    <span className="gn-next-bar" key={`wcbar-${chain.turnNumber}`} style={{ animationDuration: `${Math.max(0, chain.turnEndsAt - Date.now())}ms` }} />
                  )}
                </div>
              </div>

              {chain.lastPlay && (
                <p className="gn-progress-line" role="status">
                  {chain.lastPlay.result === "in"
                    ? `🔗 ${chain.lastPlay.name} linked “${chain.lastPlay.word}”`
                    : chain.lastPlay.result === "repeat"
                      ? `✕ “${chain.lastPlay.word}” is already in the chain — strike for ${chain.lastPlay.name}`
                      : chain.lastPlay.result === "invalid"
                        ? `✕ “${chain.lastPlay.word}” isn't one word of letters — strike for ${chain.lastPlay.name}`
                        : `⏰ Time ran out — strike for ${chain.lastPlay.name}`}
                </p>
              )}

              {myChainState?.out ? (
                <p className="gn-progress-line" role="status">You&apos;re out of this chain — two strikes. Watch it finish!</p>
              ) : myChainTurn ? (
                <div className="gn-answer-row">
                  <input
                    className="gn-name-input gn-answer-input"
                    value={answerDraft}
                    onChange={event => setAnswerDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === "Enter" && answerDraft.trim()) act({ type: "play", text: answerDraft }); }}
                    placeholder={`A word that goes with ${chain.currentWord ?? "it"}…`}
                    maxLength={60}
                    autoFocus
                    aria-label="Your word"
                  />
                  <button type="button" className="gn-big-btn gn-answer-btn" onClick={() => act({ type: "play", text: answerDraft })} disabled={busy || !answerDraft.trim()}>
                    {busy ? "Linking…" : "Link it 🔗"}
                  </button>
                </div>
              ) : (
                <p className="gn-progress-line" role="status">{chain.turnName ? `${chain.turnName} is thinking of a word…` : "The chain is moving…"}</p>
              )}
              <p className="gn-hint">One word, letters only, and no repeats — the group decides if it truly goes together.</p>

              <div className="gn-chain-trail" aria-label="The chain so far">
                {chainWords.map((word, index) => (
                  <span key={`${word}-${index}`} className="gn-chain-step">
                    {index > 0 && <span className="gn-chain-link" aria-hidden="true">🔗</span>}
                    <span className={`gn-chain-word${index === chainWords.length - 1 ? " gn-chain-word-now" : ""}${index === 0 ? " gn-chain-word-start" : ""}`}>{word}</span>
                  </span>
                ))}
              </div>
            </>
          ) : drawGame ? (
            <>
              <div className="gn-standings-strip" aria-label="Scores">
                {[...view.players].sort((a, b) => (drawGame.scores?.[b.id] ?? 0) - (drawGame.scores?.[a.id] ?? 0)).map(player => (
                  <span key={player.id} className={`gn-strip-chip${player.me ? " gn-strip-me" : ""}${drawGame.drawerId === player.id ? " gn-strip-turn" : ""}`}>
                    {player.isCreator ? "⭐ " : ""}{player.name}: <strong>{drawGame.scores?.[player.id] ?? 0}</strong>
                    {drawGame.drawerId === player.id ? " · ✏️ drawing" : ""}
                  </span>
                ))}
              </div>

              <div className="gn-call-zone">
                <div className="gn-call" key={`dg-${drawGame.wordNumber}-${drawGame.drawerId || ""}`}>
                  <span className="gn-call-label">
                    {drawGame.drawStage === "reveal"
                      ? "The word was"
                      : iAmDrawer
                        ? `✏️ Your word to draw · word ${drawGame.wordNumber ?? 1} of ${drawGame.wordCount ?? 0}`
                        : `${drawGame.drawerName ?? "A player"} is drawing · word ${drawGame.wordNumber ?? 1} of ${drawGame.wordCount ?? 0}`}
                  </span>
                  {drawGame.drawStage === "reveal" && drawGame.drawReveal ? (
                    <span className="gn-call-item gn-draw-word">{drawGame.drawReveal.word}</span>
                  ) : iAmDrawer ? (
                    <span className="gn-call-item gn-draw-word">{myDrawWord}</span>
                  ) : (
                    <span className="gn-call-item gn-draw-blanks" aria-label="The word as letter blanks">{(drawGame.blanks || "").split("").map(char => char === "_" ? "▁" : char).join(" ")}</span>
                  )}
                  {drawGame.drawStage === "draw" && drawGame.endsAt && (
                    <span className="gn-next-bar" key={`dgbar-${drawGame.wordNumber}-${drawGame.drawerId || ""}`} style={{ animationDuration: `${Math.max(0, drawGame.endsAt - Date.now())}ms` }} />
                  )}
                </div>
              </div>

              {drawGame.drawStage === "reveal" && drawGame.drawReveal && (
                <p className="gn-progress-line" role="status">
                  {drawGame.drawReveal.guesserName
                    ? `🎉 ${drawGame.drawReveal.guesserName} guessed it — +3 points, and +1 for ${drawGame.drawReveal.drawerName ?? "the drawer"}!`
                    : `⏰ Time! Nobody guessed “${drawGame.drawReveal.word}”.`}
                </p>
              )}

              <div className="gn-draw-board">
                <svg
                  ref={svgRef}
                  className={`gn-draw-canvas${iAmDrawer && drawGame.drawStage === "draw" ? " gn-draw-live" : ""}`}
                  viewBox={`0 0 ${DRAW_GUESS_CANVAS.width} ${DRAW_GUESS_CANVAS.height}`}
                  role="img"
                  aria-label={iAmDrawer ? "Your drawing canvas" : "The drawing"}
                  onPointerDown={event => {
                    if (!iAmDrawer || drawGame.drawStage !== "draw") return;
                    const point = canvasPoint(event);
                    if (!point) return;
                    svgRef.current?.setPointerCapture?.(event.pointerId);
                    setPenPoints([point]);
                  }}
                  onPointerMove={event => {
                    if (!penPoints.length) return;
                    const point = canvasPoint(event);
                    if (!point) return;
                    const last = penPoints[penPoints.length - 1];
                    if (Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) < 6) return;
                    setPenPoints([...penPoints, point]);
                  }}
                  onPointerUp={() => {
                    if (penPoints.length) sendStroke({ color: penColor, width: penWidth, points: penPoints });
                    setPenPoints([]);
                  }}
                  onPointerCancel={() => setPenPoints([])}
                >
                  {(drawGame.strokes || []).map((stroke, index) => stroke.points.length === 1 ? (
                    <circle key={index} cx={stroke.points[0][0]} cy={stroke.points[0][1]} r={stroke.width / 2} fill={stroke.color} />
                  ) : (
                    <polyline key={index} points={stroke.points.map(point => point.join(",")).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {penPoints.length === 1 ? (
                    <circle cx={penPoints[0][0]} cy={penPoints[0][1]} r={penWidth / 2} fill={penColor} />
                  ) : penPoints.length > 1 ? (
                    <polyline points={penPoints.map(point => point.join(",")).join(" ")} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                </svg>
              </div>

              {iAmDrawer && drawGame.drawStage === "draw" ? (
                <div className="gn-draw-tools">
                  <div className="gn-draw-colors" role="group" aria-label="Pen colors">
                    {DRAW_GUESS_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`gn-draw-color${penColor === color ? " gn-draw-color-on" : ""}`}
                        style={{ background: color }}
                        onClick={() => setPenColor(color)}
                        aria-label={`Pen color ${color}`}
                        aria-pressed={penColor === color}
                      />
                    ))}
                  </div>
                  <div className="gn-draw-widths" role="group" aria-label="Pen sizes">
                    {DRAW_GUESS_WIDTHS.map(width => (
                      <button
                        key={width}
                        type="button"
                        className={`gn-draw-width${penWidth === width ? " gn-draw-width-on" : ""}`}
                        onClick={() => setPenWidth(width)}
                        aria-label={`Pen size ${width}`}
                        aria-pressed={penWidth === width}
                      >
                        <span style={{ width: Math.max(4, width), height: Math.max(4, width) }} />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="gn-big-btn gn-draw-clear" onClick={() => act({ type: "clear" })} disabled={busy}>
                    🧹 Clear the canvas
                  </button>
                </div>
              ) : drawGame.drawStage === "draw" ? (
                <div className="gn-answer-row">
                  <input
                    className="gn-name-input gn-answer-input"
                    value={answerDraft}
                    onChange={event => setAnswerDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === "Enter" && answerDraft.trim()) act({ type: "guess", text: answerDraft }); }}
                    placeholder="What are they drawing?"
                    maxLength={60}
                    autoFocus
                    aria-label="Your guess"
                  />
                  <button type="button" className="gn-big-btn gn-answer-btn" onClick={() => act({ type: "guess", text: answerDraft })} disabled={busy || !answerDraft.trim()}>
                    {busy ? "Guessing…" : "Guess it!"}
                  </button>
                </div>
              ) : null}

              {(drawGame.guesses || []).length > 0 && (
                <div className="gn-draw-feed" aria-label="Guesses so far">
                  {[...(drawGame.guesses || [])].reverse().map((guess, index) => (
                    <span key={`${guess.playerId}-${index}`} className="gn-history-chip">✗ {guess.name}: {guess.text}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
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
                  {view.gameType === "survey-showdown" || view.gameType === "word-chain"
                    ? `🎉 ${view.standings[0].detail}`
                    : <>{view.standings[0].playerId === me.id ? "🎉 You won! " : `🎉 ${view.standings[0].name} wins! `}{view.standings[0].detail}</>}
                </p>
              )}
            </>
          )}
          <button type="button" className="gn-big-btn gn-start" onClick={() => act({ type: "play-again" })} disabled={busy}>
            {view.gameType === "quiz-board" ? "↻ Play again — same game, fresh board" : view.gameType === "survey-showdown" ? "↻ Play again — same teams, fresh board" : view.gameType === "perfect-match" ? "↻ Play again — fresh hands, new prompts" : view.gameType === "word-chain" ? "↻ Play again — new starter word, everyone back in" : view.gameType === "draw-guess" ? "↻ Play again — fresh words, everyone draws again" : "↻ Play again — same game, fresh cards"}
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
