"use client";

import "./jewel-avatar.css";

/**
 * Jewel herself, pictured the way the site introduces her: her real
 * waving portrait (public/redesign/jewel-wave.mp4 — the same artwork the
 * home Tips card shows in its glowing bubble, beside the "Meet Jewel —
 * your magic wand" tip) in a gold-ringed bubble, with her wand at its
 * edge. Continuity, not decoration (Jessica, 2026-11-04: at least once
 * on each page, never stamped on every control).
 *
 * This component is her CONTINUITY bubble — the small instance in
 * the talk liberty banner and the legacy workshop. The entry into
 * her conversation does NOT use it: that spot carries her landing
 * page introduction itself (JewelWandScene — the first Tips card's
 * pictured scene, where the wand and the sparkles dominate and her
 * bubble is small at the wand's tip). A `landing` variant of this
 * avatar (the Tips bubble alone at 112px with a tiny wand badge)
 * stood at the entry through PR #141 and was removed: a lone big
 * bubble is the opposite composition of the landing picture.
 *
 * Self-sufficiency (2026-11-04 fix): the component imports its own
 * stylesheet and carries the critical box inline — display:inline-block
 * plus explicit width/height on the bubble AND the video. A bare <span>
 * is an inline box and inline boxes ignore width/height: rendered in a
 * plain block parent (the talk entry placement), the bubble used to
 * lose its 112px box entirely and the portrait video ballooned to
 * intrinsic size — a giant, ringless, bob-less circle. Inside a flex
 * parent (the liberty banner) the same span was blockified and sized
 * correctly, which is why the banner never showed the bug. The box now
 * holds in any parent, styled sheet or not.
 */
export default function JewelAvatar({ size = 56, wandSize }: { size?: number; wandSize?: number }) {
  return (
    <span className="jewel-avatar" style={{ width: size, height: size, display: "inline-block" }} aria-hidden="true">
      <video src="/redesign/jewel-wave.mp4" autoPlay muted loop playsInline style={{ width: size, height: size, display: "block", objectFit: "cover", borderRadius: "50%" }} />
      <span className="jewel-avatar-wand" style={wandSize ? { fontSize: wandSize } : undefined}>🪄</span>
    </span>
  );
}
