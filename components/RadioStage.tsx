"use client";

import type { ReactNode } from "react";
import type { Project } from "../lib/project";
import JewelWandScene from "./JewelWandScene";
import "./gameshow-workshop.css";
import "./game-night-stage.css";

/**
 * The Radio, DJ, or Karaoke Imagine & Create stage (2026-11-24).
 *
 * A radio project used to open the old shared workshop here: the
 * heavy topbar, the "Brainstorm & create" flow heading, the
 * ProjectWorkflowNav with its workshop substeps, the Current Task
 * entry guide, the gameshow game-plan form (rounds, turns, scoring,
 * winning), Jewel's panel buried in the workspace grid with her
 * progress strip and the BOARD / TOOL TEMPLATES picker shelves —
 * a wall of gameshow furniture for a music show. Radio now gets
 * the light treatment the finished stages set (Gameshow and Talk
 * at stage 0, Game Night after them): this stage does ONE job —
 * letting the creator CUSTOMIZE their show with Jewel. In order:
 *
 *   Jewel as the doorway FIRST — her wand scene, the same pictured
 *   card that introduces her on the landing page, one button into
 *   the conversation below it.
 *   A branch-aware heading: the format the creator picked at
 *   creation (project.radioBranch, slice 1) names the show — a
 *   radio / DJ show, a karaoke night — and on the radio/DJ branch
 *   the kind of music show they named stands under it, because
 *   that answer is the show's theme and Jewel's compass.
 *   A few pictured example asks for this branch, each one putting
 *   its request into Jewel's conversation — playlists first,
 *   because the music is the core work of a radio show.
 *   Her conversation itself (the page hands it in with its
 *   progress strip withheld, the same treatment the Gameshow/Talk
 *   stages get): the checking off and the directing live inside
 *   it, never piled onto the page.
 *   The gold "Your library & uploads" door (the PR #177 door):
 *   uploads and the library belong to Imagine and Create, and the
 *   door leads to the project's own library in the shared stage-0
 *   area below — the same door the Gameshow and Talk stages carry.
 *
 * NO form, NO nav rows, NO shelves, NO pieces picker on this
 * stage: after the format + title (+ music kind) creation already
 * asked for, everything happens by talking to Jewel. The branch
 * built-in pieces (sound board, break timer, requests & shout-outs
 * board, running order, singer queue) arrive in a later slice —
 * nothing here promises them. Name editing stays where every kind
 * keeps it — the top-bar rename.
 */

type StageProps = {
  project: Project;
  jewelPanel?: ReactNode;
  /** Stepping into Jewel through the wand scene: the page reveals
   *  her conversation if it was hidden and lands on her input. */
  onEnterJewel: () => void;
  onAskJewel: (text: string) => void;
  doors: {
    /** The gold library door's target: the project's own library &
     *  uploads in the shared stage-0 area below (openSavedWorkshop). */
    showSavedWork: () => void;
  };
};

const RADIO_ART = "/redesign/kind-radio.webp";

type RadioAsk = { label: string; say: string };

const LOOK_ASK: RadioAsk = {
  label: "Design my show's look",
  say: "Design the look of my show for the overlay — a background with my show's name lettered on it, in my style. Ask me about the style if you need to.",
};

const DJ_ASKS: RadioAsk[] = [
  {
    label: "Build my playlist",
    say: "Help me build the playlist for my show — ask me which songs and artists I want in it.",
  },
  {
    label: "Make my theme song",
    say: "Make a theme song for my show — ask me what sound I want first, then create it.",
  },
  LOOK_ASK,
];

const KARAOKE_ASKS: RadioAsk[] = [
  {
    label: "Build my song list",
    say: "Help me build the list of songs for my karaoke night — ask me which songs I want ready for singers to pick from.",
  },
  {
    label: "Make an intro",
    say: "Make a short intro for my karaoke night — ask me what sound I want first, then create it.",
  },
  LOOK_ASK,
];

/** A radio project whose branch was never recorded (created before
 *  the format question existed, or converted to radio by hand):
 *  the asks stay neutral and let the conversation settle it. */
const STARTER_ASKS: RadioAsk[] = [
  {
    label: "Build my playlist",
    say: "Help me build the music for my show — ask me whether this is a radio/DJ live stream or a karaoke live, then help me build its playlist.",
  },
  {
    label: "Make my theme song",
    say: "Make a theme song for my show — ask me what sound I want first, then create it.",
  },
  LOOK_ASK,
];

export default function RadioStage({ project, jewelPanel, onEnterJewel, onAskJewel, doors }: StageProps) {
  const branch = project.radioBranch;
  const heading = branch === "karaoke"
    ? "Your karaoke night"
    : branch === "radio-dj"
      ? "Your radio / DJ show"
      : "Your radio show";
  const asks = branch === "karaoke" ? KARAOKE_ASKS : branch === "radio-dj" ? DJ_ASKS : STARTER_ASKS;
  const musicKind = branch === "radio-dj" ? (project.gamePlan?.theme || "").trim() : "";
  return (
    <section className="gsw gsw-stage radio-stage" aria-label="Imagine and Create — your radio show, built with Jewel">
      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <JewelWandScene onEnter={onEnterJewel} />
      </div>

      <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>{heading}</div>
      {musicKind && <p className="gsw-hint" style={{ marginBottom: 12 }}>Your kind of music show: {musicKind}</p>}

      <div className="gn-asks" aria-label="Example requests for Jewel">
        {asks.map(ask => (
          <button type="button" className="gn-ask" key={ask.label} onClick={() => onAskJewel(ask.say)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RADIO_ART} alt="" />
            <span>{ask.label}</span>
            <b aria-hidden="true">→</b>
          </button>
        ))}
      </div>

      {jewelPanel}

      <button type="button" className="gsw-demobtn gold gsw-library-door" onClick={() => doors.showSavedWork()}>Your library &amp; uploads</button>
    </section>
  );
}
