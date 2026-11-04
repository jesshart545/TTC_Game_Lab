"use client";

import "./jewel-wand-scene.css";

/**
 * Jewel's introduction scene — the pictured card that introduces her
 * on the signed-in landing page, standing here at the movement into
 * her conversation (Jessica, 2026-11-04: the enter-Jewel area shows
 * the same way it does on the landing page).
 *
 * The composition is the landing picture's own (the first Tips card,
 * "Meet Jewel — your magic wand", public/redesign/tip-jewel-wand.webp):
 * the WAND AND THE SPARKLES DOMINATE — the huge ornate golden wand
 * angled across the scene, its tip blazing, gold sparkles everywhere —
 * and Jewel herself is SMALL: her glowing bubble rides at the wand's
 * tip, exactly where the pictured Jewel floats, waving. She is nowhere
 * near as big as the wand.
 *
 * The markup and values replicate the home Tips card's Jewel
 * presentation (app/workspace-home.tsx's TipsCard and the .rd-* rules
 * in app/home.css): the pictured card gently floating (rd-floaty),
 * the shade over it, the four twinkling ✦ sparkles in their landing
 * positions, and her bubble (.rd-bubble: 112px, gold ring, landing
 * glow, rd-bob) with her real waving portrait inside. The values are
 * carried in this component's own stylesheet rather than importing
 * app/home.css — that sheet is the whole home page's layout, and
 * pulling it into the project page would drag the landing layout
 * into an unrelated page; the treatment itself is copied exactly.
 *
 * This replaces the oversized entry avatar PRs #140–#142 stood here:
 * a 112px Jewel bubble with a tiny wand badge — the opposite
 * composition (Jewel dominant, the wand a speck). Jessica's
 * instruction all along was the landing picture: wand first,
 * Jewel small.
 *
 * THE SCENE IS THE DOORWAY (Jessica, 2026-11-04): standing the
 * picture above her panel was not enough — nothing at the picture
 * itself took the user to Jewel. The whole pictured card is now one
 * button: tapping it steps into her conversation directly below
 * (the page's onEnter reveals the conversation if it was hidden and
 * lands on her input). One short label on the picture itself names
 * the move — "Create with Jewel" — on the card, never in a text
 * block below it. The composition is unchanged from the landing
 * picture: wand and sparkles dominant, Jewel small at the tip.
 */
export default function JewelWandScene({ onEnter }: { onEnter: () => void }) {
  return (
    <button type="button" className="jewel-scene" onClick={onEnter} aria-label="Create with Jewel">
      <img className="jewel-scene-img" src="/redesign/tip-jewel-wand.webp" alt="" />
      <span className="jewel-scene-shade" />
      <span className="jewel-scene-sparkle" style={{ top: "16%", left: "56%", fontSize: 15 }}>✦</span>
      <span className="jewel-scene-sparkle" style={{ top: "38%", left: "78%", fontSize: 11, animationDelay: ".4s" }}>✦</span>
      <span className="jewel-scene-sparkle" style={{ top: "10%", left: "84%", fontSize: 18, animationDelay: ".8s" }}>✦</span>
      <span className="jewel-scene-sparkle" style={{ top: "52%", left: "62%", fontSize: 10, animationDelay: "1.1s" }}>✦</span>
      <span className="jewel-scene-bubble">
        <video src="/redesign/jewel-wave.mp4" autoPlay muted loop playsInline />
      </span>
      <span className="jewel-scene-cta">🪄 Create with Jewel</span>
    </button>
  );
}
