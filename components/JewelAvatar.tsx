"use client";

/**
 * Jewel herself, pictured the way the site introduces her: her real
 * waving portrait (public/redesign/jewel-wave.mp4 — the same artwork the
 * home Tips card shows in its glowing bubble, beside the "Meet Jewel —
 * your magic wand" tip) in a gold-ringed bubble, with her wand at its
 * edge. Continuity, not decoration (Jessica, 2026-11-04: at least once
 * on each page, never stamped on every control). Where the creator
 * steps INTO her conversation, she stands at full presence: a larger
 * bubble and a wand rendered at wandSize, so the wand reads as an
 * actual magic wand — never a tiny sparkle badge.
 */
export default function JewelAvatar({ size = 56, wandSize }: { size?: number; wandSize?: number }) {
  return (
    <span className="jewel-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <video src="/redesign/jewel-wave.mp4" autoPlay muted loop playsInline />
      <span className="jewel-avatar-wand" style={wandSize ? { fontSize: wandSize } : undefined}>🪄</span>
    </span>
  );
}
