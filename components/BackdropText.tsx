"use client";

import { useEffect, useRef, useState } from "react";
import type { BackdropTextSpec } from "../lib/project";
import { fitBackdropTextSize } from "../lib/backdrop-text";
import "./backdrop-text.css";

/**
 * The backdrop text layer: renders a background asset's text spec
 * (lib/backdrop-text.ts) as a real DOM text layer over the background —
 * the show's name lettered in the creator's chosen font and colors, never
 * burned into the artwork. Auto-fits like the question cards do
 * (document.fonts.load + canvas measure + shrink to fit). Rendered in all
 * three places a background renders: the project page's draft preview
 * (which Build Space reuses), and the published overlay.
 *
 * Two roles share the layer: the SIGN (no placement) letters as large as
 * the frame allows — a title's job — while the opening PROMPT
 * (placement="lower") is a lower-third caption and fits under the
 * prompt caps in fitBackdropTextSize, so a talking-point sentence can
 * never grow to title scale and bury the sign beneath it.
 */
export default function BackdropTextLayer({ spec, placement }: { spec: BackdropTextSpec; placement?: "center" | "lower" }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(44);
  const presentation = spec.presentation || "plain";

  useEffect(() => {
    let live = true;
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      const best = fitBackdropTextSize({
        text: spec.text,
        width,
        height,
        lower: placement === "lower",
        measure: (value, px) => {
          context.font = `800 ${px}px ${spec.fontFamily}`;
          const measured = context.measureText(value);
          return {
            width: measured.width,
            // The font's full bounding extents, not the tight glyph
            // box: display/script faces paint swashes beyond their
            // actualBoundingBox (Sacramento's glyph box reports
            // ~1.17em while its painted extent is its ~1.46em font
            // bounding box), and the bounding box is what decides
            // how far ink can reach toward the frame's edge.
            inkAscent: measured.fontBoundingBoxAscent ?? measured.actualBoundingBoxAscent ?? px * 0.8,
            inkDescent: measured.fontBoundingBoxDescent ?? measured.actualBoundingBoxDescent ?? px * 0.25,
          };
        },
      });
      if (live) setSize(best);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    document.fonts?.load(`800 40px ${spec.fontFamily}`).then(() => { if (live) fit(); }).catch(() => {});
    document.fonts?.ready.then(() => { if (live) fit(); }).catch(() => {});
    return () => { live = false; observer.disconnect(); };
  }, [spec.text, spec.fontFamily, placement]);

  return (
    <div ref={hostRef} className={`backdrop-text-layer pres-${presentation}${placement === "lower" ? " place-lower" : ""}`} style={{ fontSize: size }} aria-label={spec.text}>
      <div
        className="backdrop-text-line"
        style={{
          fontFamily: spec.fontFamily,
          color: spec.textColor,
          ...(presentation === "frame" && spec.accentColor ? { borderColor: spec.accentColor } : {}),
          ...(spec.accentColor && presentation === "plain" ? { textShadow: `0 2px 22px rgba(0,0,0,.5), 0 0 34px ${spec.accentColor}` } : {}),
        }}
      >{spec.text}</div>
      {spec.accentColor && presentation === "plain" && <div className="backdrop-text-rule" style={{ background: spec.accentColor }} />}
    </div>
  );
}
