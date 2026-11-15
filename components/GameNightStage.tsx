"use client";

import type { ReactNode } from "react";
import type { Project } from "../lib/project";
import { CREATIVE_LIBERTY_TEXT } from "../lib/gameshow-path";
import { pickGame } from "../lib/game-room";
import { isAudio, isImage, isVideo } from "../lib/workshop-libraries";
import GameNightGameView, { GameNightShelf, gameInfoFor, type GameNightDoors } from "./GameNightGameView";
import JewelAvatar from "./JewelAvatar";
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
 * guide. This stage is that light composition, holding ONLY
 * game-night pieces:
 *
 *   the creative-liberty banner FIRST (once, her exact wording) —
 *   the creator's freedom is the first thing the page takes into
 *   account,
 *   Jewel as the doorway SECOND — her wand scene, a few pictured
 *   example asks, and her conversation, reachable without scrolling
 *   past the game or the library (her 2026-11-15 correction: in the
 *   first cut of this frame Jewel sat below the game, "hidden way
 *   down at the bottom again"),
 *   the game itself, shown as itself (GameNightGameView) — or, when
 *   the project holds no game yet, the pictured shelf of the seven
 *   games as examples,
 *   and the gold "Your library & uploads" door with the library
 *   under its heading, with the upload door.
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
    label: "Add more pieces",
    say: gameName => `Add more pieces to my ${gameName} game — new ones in the same style as the pieces it already has.`,
  },
  {
    label: "Change a piece",
    say: gameName => `I want to change one of the pieces in my ${gameName} game — ask me which one and what it should say instead.`,
  },
  {
    label: "A fresh look",
    say: gameName => `Give my ${gameName} game a fresh look — ask me what style I want, then restyle it.`,
  },
];

export default function GameNightStage({ project, jewelPanel, onEnterJewel, onAskJewel, doors }: StageProps) {
  const picked = pickGame(project);
  const resolved = !("error" in picked);
  const info = resolved ? gameInfoFor(picked.gameType) : null;
  const assets = project.assets || [];
  return (
    <section className="gsw gsw-stage gn-stage" aria-label="Imagine and Create — your game night, built with Jewel">
      <div className="gsw-liberty">
        <JewelAvatar size={58} />
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{CREATIVE_LIBERTY_TEXT}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>
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
        <GameNightGameView project={project} doors={doors} />
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
