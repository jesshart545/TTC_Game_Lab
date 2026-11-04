"use client";

/**
 * Jewel herself, pictured the way the site introduces her: her real
 * waving portrait (public/redesign/jewel-wave.mp4 — the same artwork the
 * home Tips card shows in its glowing bubble, beside the "Meet Jewel —
 * your magic wand" tip) in a gold-ringed bubble, with her wand at its
 * edge. Used ONCE per surface that carries her presence — continuity,
 * not decoration (Jessica, 2026-11-04: at least once on each page, never
 * stamped on every control).
 */
export default function JewelAvatar({ size = 56 }: { size?: number }) {
  return (
    <span className="jewel-avatar" style={{ width: size, height: size }} aria-hidden="true">
      <video src="/redesign/jewel-wave.mp4" autoPlay muted loop playsInline />
      <span className="jewel-avatar-wand">🪄</span>
    </span>
  );
}
