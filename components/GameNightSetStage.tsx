"use client";

import { useState, type ReactNode } from "react";
import type { Project } from "../lib/project";
import { CREATIVE_LIBERTY_TEXT } from "../lib/gameshow-path";
import { buildReadiness, publishReviewSummary } from "../lib/build-readiness";
import GameNightGameView, { type GameNightDoors } from "./GameNightGameView";
import GameNightShare from "./GameNightShare";
import JewelAvatar from "./JewelAvatar";
import "./gameshow-workshop.css";
import "./game-night-stage.css";

/**
 * The Game Night Set the Stage (Jessica, 2026-11-15).
 *
 * A game night has no stream to stage: no background, no overlay,
 * no host dashboard. What its stage holds instead — her locked
 * design — is SEE it, TEST it, PUBLISH it, SHARE it:
 *
 *   The creative-liberty banner FIRST (once, her exact wording) —
 *   the creator's freedom leads this area too.
 *   Jewel's doorway SECOND — her conversation up top, reachable
 *   without scrolling past the game, the test door and the publish
 *   block (her 2026-11-15 correction: in the first cut of this frame
 *   she sat at the very bottom, "hidden way down at the bottom
 *   again"), her progress strip withheld as in every light view.
 *   Then the game itself, pictured — the same presentation as
 *   Imagine & Create (GameNightGameView).
 *   A TEST door: a game night is tested by playing the real thing.
 *   The creator share route builds the play room from the PUBLISHED
 *   snapshot, so once the game is published, "Test your game" opens
 *   its real lobby — the creator joins by name and plays it through,
 *   exactly as their friends will. There is no draft-test path in
 *   the code today, so for an unpublished game the page says so in
 *   one plain line — publishing comes first, and Jewel can publish —
 *   rather than faking a test that does not exist.
 *   PUBLISH + SHARE in one visible place: readiness in plain words
 *   (lib/build-readiness.ts — for multiplayer it already judges the
 *   game content only), the site's real Publish action (the page's
 *   own publish — the same action Jewel runs when asked in chat),
 *   and once published, the GameNightShare panel (play link + QR
 *   code) front and center.
 *
 * NONE of the livestream staging renders here for this kind — no
 * background picker, no overlay or dashboard preview, no addition
 * dropdown, no staging library, no task-button row, no rehearsal.
 */

type StageProps = {
  project: Project;
  jewelPanel?: ReactNode;
  doors: GameNightDoors;
  /** The page's own publish action — the same one Jewel runs. */
  onPublish: () => void;
  publishing: boolean;
  publishOutcome?: string | null;
};

export default function GameNightSetStage({ project, jewelPanel, doors, onPublish, publishing, publishOutcome }: StageProps) {
  const published = Boolean(project.publishedSnapshot);
  const issues = buildReadiness(project);
  const review = publishReviewSummary(project, issues);
  const [testBusy, setTestBusy] = useState(false);
  const [testStatus, setTestStatus] = useState("");

  async function testGame() {
    if (testBusy) return;
    setTestBusy(true);
    setTestStatus("");
    try {
      const response = await fetch(`/api/projects/${project.id}/game-room`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.room?.path) {
        setTestStatus(data.error || "Testing didn't start — try again in a moment.");
        return;
      }
      window.open(data.room.path, "_blank", "noopener");
      setTestStatus("Your game's lobby opened in a new tab — type your name and play it through, just like your friends will.");
    } catch {
      setTestStatus("Testing didn't start — check your connection and try again.");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <section className="gsw gsw-stage gn-stage" aria-label="Set the Stage — see your game, test it, publish it, share it">
      <div className="gsw-liberty">
        <JewelAvatar size={58} />
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{CREATIVE_LIBERTY_TEXT}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>

      {jewelPanel}

      <GameNightGameView project={project} doors={doors} />

      <div className="gn-test">
        <h2>Test your game</h2>
        {published ? (
          <>
            <p>Your game is tested by playing the real thing. Open its lobby, join with your name, and play it through — exactly what your friends will do.</p>
            <button type="button" className="gn-test-btn" onClick={() => void testGame()} disabled={testBusy}>
              {testBusy ? "Opening your lobby…" : "▶ Test your game"}
            </button>
            {testStatus && <p role="status">{testStatus}</p>}
          </>
        ) : (
          <p>Testing opens once your game is published — a game night is tested by playing the real thing from its play link. Publish below, or ask Jewel and she&apos;ll publish it for you.</p>
        )}
      </div>

      <div className="gn-publish">
        <h2>Publish &amp; share</h2>
        {!review.titleOk && <p>Your game still needs its real name — rename it at the top of this page, and it is ready to go out under that name.</p>}
        {issues.map(issue => <p key={issue.id}>{issue.message}</p>)}
        {review.checksOut && <p className="gn-ready">✓ Everything checks out — your game is ready to publish.</p>}
        {publishOutcome && <p role="status">{publishOutcome}</p>}
        <button type="button" className="gn-publish-btn" onClick={onPublish} disabled={publishing}>
          {publishing ? "Publishing…" : published ? "Publish latest changes" : "Publish your game"}
        </button>
        {published && <GameNightShare projectId={project.id} published={published} />}
      </div>
    </section>
  );
}
