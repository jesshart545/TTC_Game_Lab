"use client";

/**
 * Jewel herself, pictured the way the site introduces her: her real
 * waving portrait (public/redesign/jewel-wave.mp4 — the same artwork the
 * home Tips card shows in its glowing bubble, beside the "Meet Jewel —
 * your magic wand" tip) in a gold-ringed bubble, with her wand at its
 * edge. Continuity, not decoration (Jessica, 2026-11-04: at least once
 * on each page, never stamped on every control).
 *
 * The `landing` variant mirrors her introduction presentation on the
 * home page exactly (Jessica, 2026-11-04: "we need the enter Jewel
 * area to show the same way it does on the landing page"): the Tips
 * card's bubble (.rd-bubble in app/home.css) — a 112px gold-ringed
 * circle with the stronger landing glow (0 0 34px 10px
 * rgba(255,215,94,.45)) and the gentle rd-bob bobbing motion. The
 * landing bubble itself carries no wand badge — there her wand reads
 * from the tip's picture and its "your magic wand" words — while this
 * component keeps her 🪄 badge at its standard size, per her standing
 * rule that the wand itself must appear where the creator steps in.
 * Callers pass size={112} with `landing` to render that presentation.
 */
export default function JewelAvatar({ size = 56, wandSize, landing }: { size?: number; wandSize?: number; landing?: boolean }) {
  return (
    <span className={`jewel-avatar${landing ? " jewel-avatar-landing" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <video src="/redesign/jewel-wave.mp4" autoPlay muted loop playsInline />
      <span className="jewel-avatar-wand" style={wandSize ? { fontSize: wandSize } : undefined}>🪄</span>
    </span>
  );
}
