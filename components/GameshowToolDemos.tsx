"use client";

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GameTool } from "../lib/project";
import type { WorkflowStepState } from "../lib/workflow-progress";
import { gameEntries } from "../lib/game-tools";
import { TOOL_CHANGES, JEWEL_ONLY_TILES, TOOL_ICONS, demoTool, projectWheelSegmentSets, type ToolTile } from "../lib/gameshow-path";
import { freshCardState, type CardState } from "../lib/question-cards";
import { WheelDisplay, DiceDisplay, CoinDisplay, PlinkoDisplay, HigherLowerDisplay, CliffhangerDisplay, PrizeWheelDisplay } from "./ChanceTools";
import { StyledTimer } from "./QuestionCards";
import { GameInfoOverlay } from "./GameInfoTools";
import { AskStrip, BareStageContext, ChangeList, StepShell, useNow, type GameshowWorkshopProps } from "./GameshowWorkshop";

type ScreenProps = GameshowWorkshopProps & { step?: WorkflowStepState };

function DemoFrame({ tag, children }: { tag: string; children: ReactNode }) {
  return <div className="gsw-demo"><span className="gsw-demotag">{tag}</span>{children}</div>;
}

function cfgOf(tool: GameTool): Record<string, any> { return (tool.config || {}) as Record<string, any>; }
function appearanceColor(tool: GameTool): string { return String(cfgOf(tool).appearance?.textColor || "#ffffff"); }
function segmentTexts(segments: unknown): string[] {
  return (Array.isArray(segments) ? segments : []).map(s => typeof s === "string" ? s : String((s as any)?.text ?? s));
}

/* ---------------- Wheel ---------------- */

function WheelDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "wheel");
  const cfg = cfgOf(tool);
  const sets = useMemo(() => projectWheelSegmentSets(project), [project]);
  const ownSegments = segmentTexts(cfg.segments);
  const [setIndex, setSetIndex] = useState(0);
  const entries = sets.length > 1 ? sets[setIndex] : ownSegments;
  const duration = 4000;
  const [run, setRun] = useState<{ at: number; result: number } | null>(null);
  const [note, setNote] = useState("Tap spin — that’s the real wheel, with your real segments on it.");
  const now = useNow(run !== null && Date.now() - (run?.at ?? 0) < duration + 300);
  const elapsed = run ? now - run.at : 0;
  const announced = useRef(0);
  useEffect(() => {
    if (run && elapsed >= duration && announced.current !== run.at) {
      announced.current = run.at;
      setNote(`It landed on “${entries[run.result]}” — the real wheel, start to finish.`);
    }
  });
  return (
    <>
      <DemoFrame tag="Live demonstration — the wheel itself">
        <WheelDisplay
          entries={entries} result={run ? entries[run.result] : entries[0] || ""} elapsed={elapsed} duration={duration}
          colors={[String(cfg.slotColor || "#154c69"), String(cfg.alternateSlotColor || "#512b75")]}
          textColor={appearanceColor(tool)}
        />
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          <button type="button" className="gsw-demobtn gold" onClick={() => {
            if (!entries.length) return;
            setRun({ at: Date.now(), result: Math.floor(Math.random() * entries.length) });
            setNote("Spinning…");
          }}>Spin the wheel</button>
          {sets.length > 1 && (
            <button type="button" className="gsw-vchip" onClick={() => {
              const next = (setIndex + 1) % sets.length;
              setSetIndex(next); setRun(null);
              setNote(`Wheel rebuilt with your other segment set: ${sets[next].join(" · ")}. That’s an edit, demonstrated — the wheel above is the same tool, new segments.`);
            }}>⟳ Show my other segments ({sets.length} sets)</button>
          )}
        </div>
        <p className="gsw-demostatus">{note}</p>
      </DemoFrame>
      <ChangeList title="What you can change — the wheel" items={TOOL_CHANGES.wheel} onAsk={onAsk} />
    </>
  );
}

/* ---------------- Random picker (honest local draw — no standalone renderer exists) ---------------- */

function RandomPickerDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "random-picker");
  const options = segmentTexts(cfgOf(tool).options);
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <DemoFrame tag="Live demonstration — a draw from your list">
        {options.length ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {options.map((option, i) => (
                <div key={i} style={{
                  padding: "9px 12px", borderRadius: 10, fontWeight: 700, fontSize: 14.5,
                  border: picked === i ? "2px solid #e9c979" : "1px solid rgba(233,201,121,.25)",
                  background: picked === i ? "rgba(233,201,121,.16)" : "rgba(255,255,255,.04)",
                  color: picked === i ? "#ffe9a8" : "#e8e2f5",
                }}>{option}{picked === i ? " ← drawn" : ""}</div>
              ))}
            </div>
            <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
              <button type="button" className="gsw-demobtn gold" onClick={() => setPicked(Math.floor(Math.random() * options.length))}>Draw one</button>
            </div>
            <p className="gsw-demostatus">{picked === null ? "Every draw is a real random pick from your saved options." : `Drawn: “${options[picked]}” — during your live, the pick appears on the overlay.`}</p>
          </>
        ) : (
          <p className="gsw-demostatus">No options saved yet — add your list in the picker’s editor, or ask Jewel to build it.</p>
        )}
      </DemoFrame>
      <ChangeList title="What you can change — the picker" items={TOOL_CHANGES["random-picker"]} onAsk={onAsk} />
    </>
  );
}

/* ---------------- Scoreboard / prize list / gifts (real GameInfoOverlay) ---------------- */

function ScoreboardDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "scoreboard");
  const entries = gameEntries(tool);
  const [added, setAdded] = useState<Record<string, number>>({});
  const state: CardState = {
    ...freshCardState(),
    scores: Object.fromEntries(entries.map(entry => [entry.id, (Number(entry.score) || 0) + (added[entry.id] || 0)])),
  };
  return (
    <>
      <DemoFrame tag="Live demonstration — the scoreboard itself">
        {entries.length ? (
          <>
            <div className="gsw-gistage"><GameInfoOverlay tool={tool} project={project} state={state} /></div>
            <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
              {entries.map(entry => (
                <button key={entry.id} type="button" className="gsw-vchip" onClick={() => setAdded(current => ({ ...current, [entry.id]: (current[entry.id] || 0) + 100 }))}>{entry.name} +100</button>
              ))}
            </div>
            <p className="gsw-demostatus">Those +100s moved the real scoreboard — the same one your audience sees. (This demonstration doesn’t save; your live scores change from the dashboard.)</p>
          </>
        ) : (
          <p className="gsw-demostatus">No players or teams yet — add names in the scoreboard’s editor, or ask Jewel to set it up.</p>
        )}
      </DemoFrame>
      <ChangeList title="What you can change — the scoreboard" items={TOOL_CHANGES.scoreboard} onAsk={onAsk} />
    </>
  );
}

function PrizeListDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "prize-list");
  const entries = gameEntries(tool);
  const [awarded, setAwarded] = useState<Record<string, string>>({});
  const state: CardState = { ...freshCardState(), awarded };
  return (
    <>
      <DemoFrame tag="Live demonstration — the prize list itself">
        {entries.length ? (
          <>
            <div className="gsw-gistage"><GameInfoOverlay tool={tool} project={project} state={state} /></div>
            <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
              {entries.filter(entry => !awarded[entry.id]).map(entry => (
                <button key={entry.id} type="button" className="gsw-vchip" onClick={() => setAwarded(current => ({ ...current, [entry.id]: "Demo winner" }))}>Award “{entry.name}”</button>
              ))}
              {Object.keys(awarded).length > 0 && <button type="button" className="gsw-vchip" onClick={() => setAwarded({})}>Reset</button>}
            </div>
            <p className="gsw-demostatus">Awarding flips the real list to “Awarded” — try it. (Demonstration only; nothing is saved.)</p>
          </>
        ) : (
          <p className="gsw-demostatus">No prizes yet — add them in the prize list’s editor, or ask Jewel to stock it.</p>
        )}
      </DemoFrame>
      <ChangeList title="What you can change — the prize list" items={TOOL_CHANGES["prize-list"]} onAsk={onAsk} />
    </>
  );
}

function GiftListDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "game-tool-list");
  const entries = gameEntries(tool);
  const state: CardState = freshCardState();
  return (
    <>
      <DemoFrame tag="Live demonstration — the gift list itself">
        {entries.length ? (
          <>
            <div className="gsw-gistage"><GameInfoOverlay tool={tool} project={project} state={state} /></div>
            <p className="gsw-demostatus">During your live, a viewer sends one of these and its action shows right here — the host carries it out.</p>
          </>
        ) : (
          <p className="gsw-demostatus">No gifts yet — add them in the gift list’s editor, or ask Jewel to stock it.</p>
        )}
      </DemoFrame>
      <ChangeList title="What you can change — gifts & actions" items={TOOL_CHANGES["game-tool-list"]} onAsk={onAsk} />
    </>
  );
}

/* ---------------- Countdown ---------------- */

function CountdownDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "countdown");
  const seconds = Number(cfgOf(tool).seconds) || 10;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const now = useNow(startedAt !== null && !done);
  const remaining = startedAt === null ? seconds : Math.max(0, seconds - (now - startedAt) / 1000);
  useEffect(() => { if (startedAt !== null && remaining <= 0) setDone(true); }, [remaining, startedAt]);
  return (
    <>
      <DemoFrame tag="Live demonstration — the timer itself">
        <div className="gsw-timerstage"><StyledTimer tool={tool} remaining={remaining} total={seconds} /></div>
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          <button type="button" className="gsw-demobtn gold" onClick={() => { setStartedAt(Date.now()); setDone(false); }}>Start countdown</button>
          <button type="button" className="gsw-vchip" onClick={() => { setStartedAt(null); setDone(false); }}>Reset</button>
        </div>
        <p className="gsw-demostatus">{done ? "Time! The real timer simply reaches zero — exactly what your audience sees." : startedAt !== null ? "Counting down — the real timer display, in its saved style." : `Set for ${seconds} seconds. Start it — this is your actual timer, in its saved display style.`}</p>
      </DemoFrame>
      <ChangeList
        title="What you can change — the timer" items={TOOL_CHANGES.countdown} onAsk={onAsk}
        spring="The real timer has no built-in chime — if you want a sound at zero, package an SFX clip with it in Compose your scenes & effects (step 6)."
      />
    </>
  );
}

/* ---------------- Poll (local votes over the real saved options) ---------------- */

function PollDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "poll");
  const cfg = cfgOf(tool);
  const options = segmentTexts(cfg.options);
  const [votes, setVotes] = useState<Record<number, number>>({});
  const total = Object.values(votes).reduce((sum, n) => sum + n, 0);
  return (
    <>
      <DemoFrame tag="Live demonstration — tap an option to vote">
        <p style={{ fontWeight: 800, fontSize: 17, margin: "2px 0 12px" }}>{String(cfg.question || "Choose what happens next")}</p>
        {options.map((option, i) => {
          const pct = total ? Math.round(((votes[i] || 0) / total) * 100) : 0;
          return (
            <button key={i} type="button" className="gsw-pollbar" onClick={() => setVotes(current => ({ ...current, [i]: (current[i] || 0) + 1 }))}>
              <span className="gsw-pb-track"><span className="gsw-pb-fill" style={{ width: `${pct}%` }} /></span>
              <span className="gsw-pb-label">{option}</span><span className="gsw-pb-pct">{total ? `${pct}%` : ""}</span>
            </button>
          );
        })}
        <p className="gsw-demostatus">{total ? `${total} demonstration vote${total === 1 ? "" : "s"} — during your live, your audience’s votes fill these same bars.` : "Your saved question and options — during your live, the audience votes and the bars fill for real."}</p>
      </DemoFrame>
      <ChangeList title="What you can change — the poll" items={TOOL_CHANGES.poll} onAsk={onAsk} />
    </>
  );
}

/* ---------------- Coin & dice ---------------- */

function CoinDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "coin-toss");
  const cfg = cfgOf(tool);
  const [run, setRun] = useState<{ at: number; result: string } | null>(null);
  const now = useNow(run !== null && Date.now() - (run?.at ?? 0) < 2000);
  const elapsed = run ? now - run.at : 9999;
  return (
    <>
      <DemoFrame tag="Live demonstration — the coin itself">
        <CoinDisplay
          result={run?.result || "Heads"} elapsed={elapsed} ready={!run || elapsed >= 1800}
          faceColor={String(cfg.faceColor || "#ffd166")} textColor={String(cfg.textColor || "#382608")}
        />
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          <button type="button" className="gsw-demobtn gold" onClick={() => setRun({ at: Date.now(), result: Math.random() < 0.5 ? "Heads" : "Tails" })}>Flip the coin</button>
        </div>
        <p className="gsw-demostatus">{run && elapsed >= 1800 ? `It landed on ${run.result} — a real flip, every time.` : "A real flip, with your coin’s saved colors."}</p>
      </DemoFrame>
      <ChangeList title="What you can change — the coin" items={TOOL_CHANGES["coin-toss"]} onAsk={onAsk} />
    </>
  );
}

function DiceDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool } = demoTool(project, "dice");
  const cfg = cfgOf(tool);
  const [sides, setSides] = useState(Number(cfg.sides) || 6);
  const [run, setRun] = useState<{ at: number; result: number } | null>(null);
  const now = useNow(run !== null && Date.now() - (run?.at ?? 0) < 1600);
  const elapsed = run ? now - run.at : 9999;
  return (
    <>
      <DemoFrame tag="Live demonstration — the dice themselves">
        <DiceDisplay
          result={run?.result ?? Math.min(6, sides)} sides={sides} elapsed={elapsed}
          faceColor={String(cfg.faceColor || "#f5faff")} pipColor={String(cfg.pipColor || "#102132")}
        />
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          <button type="button" className="gsw-demobtn gold" onClick={() => setRun({ at: Date.now(), result: 1 + Math.floor(Math.random() * sides) })}>Roll</button>
          {[6, 12, 20].map(n => (
            <button key={n} type="button" className={"gsw-vchip" + (sides === n ? " on" : "")} onClick={() => { setSides(n); setRun(null); }}>{n} sides</button>
          ))}
        </div>
        <p className="gsw-demostatus">Sides: {sides} — switching sides re-rolls the real dice display. (Demonstration only; your saved dice keep their sides until you or Jewel change them.)</p>
      </DemoFrame>
      <ChangeList title="What you can change — the dice" items={TOOL_CHANGES.dice} onAsk={onAsk} />
    </>
  );
}

/* ---------------- The four Jewel-only tools ---------------- */

function PlinkoDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool, fromProject } = demoTool(project, "plinko");
  const cfg = cfgOf(tool);
  const slots = segmentTexts(cfg.slots?.map((n: unknown) => String(n)));
  const duration = 3000;
  const [run, setRun] = useState<{ at: number; winner: number } | null>(null);
  const now = useNow(run !== null && Date.now() - (run?.at ?? 0) < duration + 300);
  const elapsed = run ? now - run.at : 0;
  return (
    <>
      <DemoFrame tag="Live demonstration — the real Plinko board">
        <PlinkoDisplay
          slots={slots} winner={run?.winner ?? Math.floor(slots.length / 2)} rows={Number(cfg.rows) || 9}
          elapsed={elapsed} duration={duration}
          pegColor={String(cfg.pegColor || "#8b9bb4")} ballColor={String(cfg.ballColor || "#ff5d5d")}
          colors={[String(cfg.slotColor || "#154c69"), String(cfg.alternateSlotColor || "#512b75")]}
          textColor={appearanceColor(tool)} title={String(cfg.title || tool.name || "Plinko")}
        />
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          <button type="button" className="gsw-demobtn gold" onClick={() => setRun({ at: Date.now(), winner: Math.floor(Math.random() * slots.length) })}>Drop the ball</button>
        </div>
        <p className="gsw-demostatus">{fromProject ? "Your Plinko board, with your saved slots — drop it as many times as you like." : "The real Plinko board with its built-in slots — Jewel builds yours with your prizes on it."}</p>
      </DemoFrame>
      <ChangeList title="What you can change — Plinko" items={TOOL_CHANGES.plinko} onAsk={onAsk} />
    </>
  );
}

function PrizeWheelDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool, fromProject } = demoTool(project, "prize-wheel");
  const cfg = cfgOf(tool);
  const values = segmentTexts(cfg.values);
  const duration = 4000;
  const [total, setTotal] = useState(0);
  const [run, setRun] = useState<{ at: number; winner: number; total: number; busted: boolean } | null>(null);
  const now = useNow(run !== null && Date.now() - (run?.at ?? 0) < duration + 300);
  const elapsed = run ? now - run.at : 0;
  const shownTotal = run ? run.total : total;
  return (
    <>
      <DemoFrame tag="Live demonstration — the real prize wheel">
        <PrizeWheelDisplay
          outcome={{ phase: "spin", winner: run?.winner ?? 0, values, total: shownTotal, busted: run?.busted ?? false }}
          elapsed={elapsed} duration={duration}
          colors={[String(cfg.slotColor || "#b3123f"), String(cfg.alternateSlotColor || "#0f6b4f")]}
          textColor={appearanceColor(tool)}
        />
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          <button type="button" className="gsw-demobtn gold" onClick={() => {
            const winner = Math.floor(Math.random() * values.length);
            const cents = Math.round(parseFloat(values[winner].replace(/[^0-9.]/g, "")) * 100) || 0;
            const nextTotal = total + cents;
            const busted = nextTotal > 100;
            setRun({ at: Date.now(), winner, total: nextTotal, busted });
            setTotal(busted ? 0 : nextTotal);
          }}>Spin for money</button>
          <button type="button" className="gsw-vchip" onClick={() => { setTotal(0); setRun(null); }}>New player (reset)</button>
        </div>
        <p className="gsw-demostatus">{fromProject ? "Your prize wheel and your values — totals add up, and over $1.00 busts, exactly like the real game." : "Values run 5¢ to $1.00 — spin twice and watch the total climb; over $1.00 busts. Jewel builds yours with your values."}</p>
      </DemoFrame>
      <ChangeList title="What you can change — the Big Prize Wheel" items={TOOL_CHANGES["prize-wheel"]} onAsk={onAsk} />
    </>
  );
}

function HigherLowerDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool, fromProject } = demoTool(project, "higher-lower");
  const cards: { label: string; value: number }[] = Array.isArray(cfgOf(tool).cards) && cfgOf(tool).cards.length
    ? cfgOf(tool).cards.map((c: any) => ({ label: String(c?.label ?? c?.value ?? "?"), value: Number(c?.value) || 0 }))
    : [{ label: "?", value: 0 }];
  const [current, setCurrent] = useState(0);
  const [outcome, setOutcome] = useState<any>({ phase: "draw", card: cards[0] });
  const guess = (direction: "higher" | "lower") => {
    let next = Math.floor(Math.random() * cards.length);
    if (cards.length > 1 && next === current) next = (next + 1) % cards.length;
    const correct = direction === "higher" ? cards[next].value > cards[current].value : cards[next].value < cards[current].value;
    setOutcome({ phase: "reveal", prev: cards[current], next: cards[next], guess: direction, correct });
    setCurrent(next);
  };
  return (
    <>
      <DemoFrame tag="Live demonstration — call it">
        <HigherLowerDisplay outcome={outcome} elapsed={9999} textColor={appearanceColor(tool)} />
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          {outcome.phase === "draw" ? (
            <>
              <button type="button" className="gsw-demobtn gold" onClick={() => guess("higher")}>Higher ↑</button>
              <button type="button" className="gsw-demobtn gold" onClick={() => guess("lower")}>Lower ↓</button>
            </>
          ) : (
            <button type="button" className="gsw-demobtn gold" onClick={() => setOutcome({ phase: "draw", card: cards[current] })}>Next card</button>
          )}
        </div>
        <p className="gsw-demostatus">{fromProject ? "Your deck, your cards — call it like your players will." : "The real game with its built-in deck — Jewel deals yours with your cards and rules."}</p>
      </DemoFrame>
      <ChangeList title="What you can change — Higher or Lower" items={TOOL_CHANGES["higher-lower"]} onAsk={onAsk} />
    </>
  );
}

function CliffhangerDemo(props: GameshowWorkshopProps) {
  const { project, onAskJewel: onAsk } = props;
  const { tool, fromProject } = demoTool(project, "cliffhanger");
  const cfg = cfgOf(tool);
  const items: { label: string; price: number }[] = Array.isArray(cfg.items) && cfg.items.length
    ? cfg.items.map((item: any) => ({ label: String(item?.label ?? "Item"), price: Number(item?.price) || 0 }))
    : [{ label: "Item", price: 50 }];
  const stepsToFall = Number(cfg.stepsToFall) || 25;
  const dollarsPerStep = Math.max(1, Number(cfg.dollarsPerStep) || 1);
  const [itemIndex, setItemIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [guessText, setGuessText] = useState("");
  const [outcome, setOutcome] = useState<any>({ phase: "item", item: items[0], position: 0, stepsToFall });
  const [runAt, setRunAt] = useState<number | null>(null);
  const now = useNow(runAt !== null && Date.now() - (runAt ?? 0) < 1700);
  const elapsed = runAt ? now - runAt : 9999;
  const item = items[itemIndex];
  const submitGuess = () => {
    const guess = Math.max(0, Math.round(Number(guessText) || 0));
    const diff = Math.abs(guess - item.price);
    const steps = Math.floor(diff / dollarsPerStep);
    const nextPosition = position + steps;
    const fell = nextPosition >= stepsToFall;
    setOutcome({ phase: "guess", item, guess, price: item.price, diff, steps, position: nextPosition, fell, stepsToFall, dollarsPerStep });
    setPosition(nextPosition);
    setRunAt(Date.now());
  };
  const nextItem = () => {
    const next = (itemIndex + 1) % items.length;
    setItemIndex(next);
    setOutcome({ phase: "item", item: items[next], position, stepsToFall, dollarsPerStep });
    setGuessText("");
  };
  const reset = () => {
    setPosition(0); setItemIndex(0); setGuessText("");
    setOutcome({ phase: "reset", position: 0, stepsToFall, dollarsPerStep });
  };
  return (
    <>
      <DemoFrame tag="Live demonstration — guess the price, watch him climb">
        <CliffhangerDisplay outcome={outcome} elapsed={elapsed} textColor={appearanceColor(tool)} />
        {outcome.phase !== "guess" && !outcome.fell && (
          <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
            <span className="gsw-vchip">Price the {item.label}: $</span>
            <input
              className="gsw-guess" type="number" min={0} value={guessText} placeholder="your guess"
              onChange={event => setGuessText(event.target.value)} aria-label={`Your guess for the ${item.label}`}
            />
            <button type="button" className="gsw-demobtn gold" onClick={submitGuess}>Lock in the guess</button>
          </div>
        )}
        <div className="gsw-chipsrow" style={{ justifyContent: "center" }}>
          {outcome.phase === "guess" && !outcome.fell && <button type="button" className="gsw-vchip" onClick={nextItem}>Next item</button>}
          {(position > 0 || outcome.fell) && <button type="button" className="gsw-vchip" onClick={reset}>Reset the climber</button>}
        </div>
        <p className="gsw-demostatus">
          {outcome.fell
            ? "He fell! Off by too much — in the real game, that’s the round over."
            : outcome.phase === "guess"
              ? `Off by $${outcome.diff} → ${outcome.steps} step${outcome.steps === 1 ? "" : "s"} up. ${stepsToFall - position} from the edge.`
              : fromProject
                ? "Your items and prices — every dollar off moves him one step toward the edge."
                : "The real game with its built-in items — every dollar off moves him toward the edge. Jewel stocks yours with your items."}
        </p>
      </DemoFrame>
      <ChangeList title="What you can change — Cliffhanger" items={TOOL_CHANGES.cliffhanger} onAsk={onAsk} />
    </>
  );
}

/* ---------------- YouTube & City Crime Scene cards ---------------- */

function YoutubeDemo(props: GameshowWorkshopProps) {
  const { onAskJewel: onAsk, onNavigateStep } = props;
  const bare = useContext(BareStageContext);
  return (
    <>
      <div className="gsw-card">
        <h4>▶ YouTube — plays inside your media</h4>
        <p>{bare
          ? "A YouTube video isn’t a game tool with settings to demonstrate here — it’s media. Ask Jewel to add a link and it becomes a playable tile in your show."
          : "A YouTube video isn’t a game tool with settings to demonstrate here — it’s media. Paste a link on the media step and it becomes a playable tile in your show."}</p>
        {!bare && <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={() => onNavigateStep(0, "media")}>Go to Make your media</button></div>}
      </div>
      <ChangeList title="What you can change — YouTube" items={TOOL_CHANGES.youtube} onAsk={onAsk} />
    </>
  );
}

function CityCrimeSceneDemo(props: GameshowWorkshopProps) {
  const { doors, onAskJewel: onAsk } = props;
  return (
    <>
      <div className="gsw-card">
        <h4>🔎 City Crime Scene — the whodunnit</h4>
        <p>A whole mystery game: a storyline, suspects, evidence and a map, built inside its own builder. It opens from here, exactly as it does today.</p>
        <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={doors.openCityCrimeScene}>Open the City Crime Scene builder</button></div>
      </div>
      <ChangeList title="What you can change — City Crime Scene" items={TOOL_CHANGES["city-crime-scene"]} onAsk={onAsk} />
    </>
  );
}

/* ---------------- The step ---------------- */

const TYPE_ORDER = ["wheel", "random-picker", "scoreboard", "prize-list", "countdown", "poll", "coin-toss", "dice", "game-tool-list", "youtube"];
const TYPE_BLURBS: Record<string, string> = {
  wheel: "Spin for a segment", "random-picker": "Draw from your list", scoreboard: "Names & scores on screen",
  "prize-list": "Prizes waiting to be won", countdown: "Seconds on the clock", poll: "Let the audience vote",
  "coin-toss": "Heads or tails", dice: "Roll the dice", "game-tool-list": "Gifts viewers send, actions they cause",
  youtube: "Play a video in your show",
};

const DEMOS: Record<string, (props: GameshowWorkshopProps) => ReactNode> = {
  wheel: p => <WheelDemo {...p} />,
  "random-picker": p => <RandomPickerDemo {...p} />,
  scoreboard: p => <ScoreboardDemo {...p} />,
  "prize-list": p => <PrizeListDemo {...p} />,
  countdown: p => <CountdownDemo {...p} />,
  poll: p => <PollDemo {...p} />,
  "coin-toss": p => <CoinDemo {...p} />,
  dice: p => <DiceDemo {...p} />,
  "game-tool-list": p => <GiftListDemo {...p} />,
  youtube: p => <YoutubeDemo {...p} />,
  plinko: p => <PlinkoDemo {...p} />,
  "prize-wheel": p => <PrizeWheelDemo {...p} />,
  "higher-lower": p => <HigherLowerDemo {...p} />,
  cliffhanger: p => <CliffhangerDemo {...p} />,
  "city-crime-scene": p => <CityCrimeSceneDemo {...p} />,
};

export default function ToolsStep(props: ScreenProps) {
  const { project, doors, ccssEntitled } = props;
  const present = new Map<string, GameTool>();
  for (const tool of project.gameTools || []) {
    if (tool.enabled && TYPE_ORDER.includes(tool.type) && !present.has(tool.type)) present.set(tool.type, tool);
  }
  const tiles: ToolTile[] = [
    ...TYPE_ORDER.filter(type => present.has(type)).map(type => ({
      type, name: present.get(type)!.name, description: TYPE_BLURBS[type] || "", icon: TOOL_ICONS[type] || "◆",
    })),
    ...JEWEL_ONLY_TILES,
    ...(ccssEntitled ? [{ type: "city-crime-scene", name: "City Crime Scene", description: "The whodunnit builder", icon: "🔎" }] : []),
  ];
  const [selected, setSelected] = useState<string>(tiles[0]?.type || "wheel");
  const active = tiles.some(tile => tile.type === selected) ? selected : tiles[0]?.type || "wheel";
  const Demo = DEMOS[active];
  return (
    <StepShell stepId="tools" step={props.step}>
      <div className="gsw-cols">
        <div>
          {tiles.some(tile => !tile.jewelMade && tile.type !== "city-crime-scene") && (
            <>
              <div className="gsw-seclabel">Your tools — tap one and watch it work</div>
              <div className="gsw-tiles">
                {tiles.filter(tile => !tile.jewelMade && tile.type !== "city-crime-scene").map(tile => (
                  <button key={tile.type} type="button" className={"gsw-tile" + (active === tile.type ? " on" : "")} onClick={() => setSelected(tile.type)}>
                    <div className="gsw-ic">{tile.icon}</div><div className="gsw-tt">{tile.name}</div><div className="gsw-td">{tile.description}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="gsw-seclabel" style={{ marginTop: 20 }}>Only Jewel can make these — watch them work, then ask her</div>
          <div className="gsw-tiles">
            {JEWEL_ONLY_TILES.map(tile => (
              <button key={tile.type} type="button" className={"gsw-tile" + (active === tile.type ? " on" : "")} onClick={() => setSelected(tile.type)}>
                <div className="gsw-ic">{tile.icon}</div><div className="gsw-tt">{tile.name}</div><div className="gsw-td">{tile.description}</div>
                <span className="gsw-jmade">✦ Made by Jewel</span>
              </button>
            ))}
            {ccssEntitled && (
              <button type="button" className={"gsw-tile" + (active === "city-crime-scene" ? " on" : "")} onClick={() => setSelected("city-crime-scene")}>
                <div className="gsw-ic">🔎</div><div className="gsw-tt">City Crime Scene</div><div className="gsw-td">The whodunnit builder</div>
              </button>
            )}
          </div>
          {Demo && <div style={{ marginTop: 18 }}>{Demo(props)}</div>}
        </div>
        <AskStrip
          {...props}
          stepId="tools"
          extra="Adjust opens the tools folder below — every tool’s own editor (Name · Setup · Look · Preview) exactly as it works today. Tools you switched off in the toolbox stay off; nothing is added behind your back."
        />
      </div>
      <p className="gsw-hint" style={{ marginTop: 14 }}>Every tool above demonstrates itself with your real settings — or with the tool’s own built-in defaults when you don’t have one yet. Nothing here saves or changes your project; trying things is free.</p>
    </StepShell>
  );
}
