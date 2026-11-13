"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "../lib/auth/client";
import SubmitFeedback from "./SubmitFeedback";

/**
 * Renders the floating Submit feedback button from the root layout so a
 * user can reach it from every page, in place — nobody has to leave the
 * page they're on to share something.
 *
 * Signed-in only: /api/help refuses submissions without a session (401
 * "Sign in to contact the admin."), so the button follows the endpoint
 * and renders only when the client session has a user — the same
 * authClient.useSession() check SiteHeader used for the old header
 * placement.
 *
 * Hard exclusions:
 * - Published overlays (any path ending in "/overlay", which covers
 *   /published/[slug]/overlay): the overlay shows ONLY what the user put
 *   there — no site chrome, ever.
 * - Embedded frames (window.self !== window.top, the same check HelpLink
 *   makes): an overlay or page iframed into OBS / LIVE Studio must not
 *   grow a feedback button either.
 */
export default function FloatingFeedback() {
  const path = usePathname();
  const { data: session } = authClient.useSession();
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => { setEmbedded(window.self !== window.top); }, []);
  if (embedded || !session?.user) return null;
  if (path === "/overlay" || (path !== null && path.endsWith("/overlay"))) return null;
  return <SubmitFeedback />;
}
