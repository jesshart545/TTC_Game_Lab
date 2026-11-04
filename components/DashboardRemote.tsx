"use client";
import "./dashboard-remote.css";
import type { Project, ProjectEvent } from "../lib/project";
import { mediaKind } from "../lib/board-design";

/**
 * The host dashboard as a REMOTE CONTROL (Jessica, 2026-11-04):
 * "The dashboard shouldn't look like some flat black and white
 * screen — it should look and function like a remote control to
 * power the overlay."
 *
 * This module is the shared chrome of that remote: the top strip
 * every dashboard surface wears, the glyph a button carries when
 * its meaning has an obvious one, and the stylesheet
 * (dashboard-remote.css) that frames the surface as a device.
 * It is imported by BOTH dashboard surfaces — the Set the Stage
 * dashboard review (components/StageReview.tsx) and the published
 * host dashboard (app/published/[slug]/page.tsx) — so the remote
 * the creator rehearses on is the remote the host holds live:
 * same body, same keys, same panels. There is no review-only
 * remote. The functions were always a remote (a press here fires
 * the overlay through the shared runtime); this is the look
 * catching up with the function.
 */

/** The remote's top strip: a lit power dot, the word REMOTE, and
 *  the show it powers. Pure chrome — it presses nothing. */
export function RemoteTopBar({ name }: { name: string }) {
  return (
    <div className="dash-remote-top" aria-hidden="true">
      <span className="dash-remote-led" />
      <span className="dash-remote-title">Host Remote</span>
      <span className="dash-remote-name">{name}</span>
      <span className="dash-remote-tag">powers the overlay</span>
    </div>
  );
}

/**
 * The glyph a dashboard button carries NEXT TO its label — never
 * instead of it. Only meanings with an obvious glyph get one:
 * play/show for media and compositions, a frame for backgrounds
 * and pictures, ✕ for hide, ▶▶ for a sequence, a card for card
 * toggles, ▶ for the YouTube tool. Anything else carries none —
 * a forced icon would be decoration, not information.
 */
export function controlGlyph(project: Project, control: ProjectEvent): string {
  const action = control.action || "";
  if (action === "sequence") return "▶▶";
  if (action.startsWith("result.hide.")) return "✕";
  if (action.startsWith("background.show.")) return "▣";
  if (action.startsWith("composition.play.")) return "▶";
  if (action.startsWith("asset.show.")) {
    const key = action.slice("asset.show.".length);
    const asset = (project.assets || []).find(a => (a.storageKey || a.name) === key);
    const kind = asset ? mediaKind(asset) : "unknown";
    return kind === "video" || kind === "audio" ? "▶" : "▣";
  }
  if (action.startsWith("cards.toggle.")) return "▤";
  if ((control.toolIds || []).some(id => (project.gameTools || []).find(t => t.id === id)?.type === "youtube")) return "▶";
  return "";
}
