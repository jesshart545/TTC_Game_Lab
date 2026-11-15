"use client";

import type { ReactNode } from "react";
import type { Project } from "../lib/project";
import { pickGame } from "../lib/game-room";
import { isAudio, isImage, isVideo } from "../lib/workshop-libraries";
import GameNightGameView, { GameNightShelf, gameInfoFor, type GameNightDoors } from "./GameNightGameView";
import JewelWandScene from "./JewelWandScene";
import "./gameshow-workshop.css";
import "./game-night-stage.css";

/**
 * The Game Night Imagine & Create stage (Jessica, 2026-11-15).
 *
 * A multiplayer project used to open the old shared workshop here:
 * an eleven-field game-plan form, a progress pill row with its
 * "Next / Go there" machinery, a current-task card, Creation Tools
 * tiles, the Gameshow template gallery, and the game's own content
 * shown as word-list rows stamped "In Dashboard Toolbox" — a wall
 * of words with zero pictures, for a kind that has no host, no
 * dashboard and no stream. Her ruling: the Gameshow rebuild is the
 * guide — and this stage does ONE job (her sharpening, 2026-11-15):
 * CUSTOMIZING the game. Every element in it exists only for that.
 * Creative freedom is SHOWN here, never written: no statement about
 * it stands anywhere in the view (the liberty text banner the first
 * cut carried was never authorized — words go on the site only
 * where she says so). In order:
 *
 *   Jewel as the doorway FIRST — her wand scene, a few pictured
 *   customization asks, and her conversation. She is the first
 *   thing on the page: the creator changes the game by asking her,
 *   and she can change anything in it.
 *   The game's pieces as a WORKBENCH (GameNightGameView in its
 *   workbench framing): the same pieces the engine resolves, each
 *   family led by its own prominent door into the real hand editor.
 *   Showing the game off is Set the Stage's job, not this area's —
 *   here the pieces stand to be changed. Or, when the project holds
 *   no game yet, the pictured shelf of the seven games — picking
 *   one puts its build ask in Jewel's conversation and starts
 *   customizing.
 *   The gold "Your library & uploads" door and the library under
 *   its heading — the creator's materials, there to be used in the
 *   game and changed as the game changes.
 *
 * NO form: after the title + theme creation already asked for,
 * everything happens with Jewel. NO progress machinery on the page:
 * Jewel owns the check-offs and the directing inside her
 * conversation (the page passes her panel in with its progress
 * strip withheld, the same treatment the Gameshow/Talk stages get).
 * Name editing stays where every kind keeps it — the top-bar rename.
 */

type StageProps = {
  project: Project;
  jewelPanel?: ReactNode;
  /** Stepping into Jewel through the wand scene: the page reveals
   *  her conversation if it was hidden and lands on her input. */
  onEnterJewel: () => void;
  onAskJewel: (text: string) => void;
  doors: GameNightDoors;
};

function scrollToLibrary() {
  document.getElementById("game-night-library")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const EXAMPLE_ASKS: { label: string; say: (gameName: string) => string }[] = [
  {
    label: "Change my cards",
    say: gameName => `I want to change the cards in my ${gameName} game — ask me which ones and what they should say instead.`,
  },
  {
    label: "Make it my topic",
    say: gameName => `Make my ${gameName} game about a topic I choose — ask me for the topic, then redo its questions, cards and words to fit it.`,
  },
  {
    label: "Swap my words",
    say: gameName => `I want to swap my own words into my ${gameName} game — ask me what to swap in and what each one replaces.`,
  },
];

export default function GameNightStage({ project, jewelPanel, onEnterJewel, onAskJewel, doors }: StageProps) {
  const picked = pickGame(project);
  const resolved = !("error" in picked);
  const info = resolved ? gameInfoFor(picked.gameType) : null;
  const assets = project.assets || [];
  return (
    <section className="gsw gsw-stage gn-stage" aria-label="Imagine and Create — your game night, built with Jewel">
      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <JewelWandScene onEnter={onEnterJewel} />
      </div>

      {resolved && info && (
        <div className="gn-asks" aria-label="Example requests for Jewel">
          {EXAMPLE_ASKS.map(ask => (
            <button type="button" className="gn-ask" key={ask.label} onClick={() => onAskJewel(ask.say(info.name))}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.image} alt="" />
              <span>{ask.label}</span>
              <b aria-hidden="true">→</b>
            </button>
          ))}
        </div>
      )}

      {jewelPanel}

      {resolved ? (
        <GameNightGameView project={project} doors={doors} framing="workbench" />
      ) : (
        <GameNightShelf onAskJewel={onAskJewel} />
      )}

      <button type="button" className="gsw-demobtn gold gsw-library-door" onClick={scrollToLibrary}>Your library &amp; uploads</button>

      <div className="gn-library" id="game-night-library">
        <div className="gn-library-head">
          <h2>Your library — everything in this project</h2>
          <button type="button" className="gn-upload" onClick={doors.upload}>⬆ Upload pictures, sounds &amp; clips</button>
        </div>
        {assets.length === 0 ? (
          <p className="gn-library-empty">Nothing here yet. Upload pictures, sounds and clips with the button above — or ask Jewel to make what your game needs, and it lands here.</p>
        ) : (
          <div className="gn-assets">
            {assets.map((asset, index) => (
              <div className="gn-asset" key={(asset.storageKey || asset.name) + index}>
                {asset.url && isImage(asset) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="" />
                ) : asset.url && isVideo(asset) ? (
                  <video src={asset.url} muted preload="metadata" aria-label={asset.name} />
                ) : (
                  <span className="gn-asset-glyph" aria-hidden="true">{isAudio(asset) ? "♪" : "▦"}</span>
                )}
                <b>{asset.name}</b>
                <div className="gn-asset-doors">
                  <button type="button" onClick={() => doors.openMediaEditor(index)}>Edit</button>
                  <button type="button" onClick={() => doors.deleteAsset(asset)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
