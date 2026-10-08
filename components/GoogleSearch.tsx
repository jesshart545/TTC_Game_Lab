"use client";

import { useEffect, useRef, useState } from "react";
import { supportPanelEvent } from "../lib/support-client";
import type { WebResult } from "../lib/web-search";
import WebResearchWorkspace from "./WebResearchWorkspace";

export type GoogleSearchProps = {
  slug?: string;
  hostKey?: string;
  projectId?: string;
  docked?: boolean;
  onSavePool?: (name: string, results: WebResult[]) => void;
};

/**
 * Backward-compatible Web Research entry point. Embedded use stays open for
 * draft rehearsal; docked use keeps its workspace mounted so closing it never
 * discards a host's search, comparison, or private note state.
 */
export default function GoogleSearch({ slug, hostKey, projectId, docked = false, onSavePool }: GoogleSearchProps) {
  const [open, setOpen] = useState(!docked);
  const launcher = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!docked) setOpen(true);
  }, [docked]);

  useEffect(() => {
    const panel = (event: Event) => { if (docked && (event as CustomEvent).detail === "support") setOpen(false); };
    const reveal = () => { supportPanelEvent("research"); setOpen(true); };
    window.addEventListener("ttc-assistant-panel", panel);
    window.addEventListener("ttc-open-research", reveal);
    return () => { window.removeEventListener("ttc-assistant-panel", panel); window.removeEventListener("ttc-open-research", reveal); };
  }, [docked]);
  function close() {
    setOpen(false);
    window.setTimeout(() => launcher.current?.focus(), 0);
  }

  if (!docked) {
    return <WebResearchWorkspace slug={slug} hostKey={hostKey} projectId={projectId} onSavePool={onSavePool} />;
  }

  return <section className="web-research-launcher" aria-label="Web Research tools">
    <button
      ref={launcher}
      className="web-research-launch-button"
      type="button"
      aria-expanded={open}
      aria-controls="web-research-panel"
      onClick={() => { supportPanelEvent("research"); setOpen(true); }}
    >
      <span>Web Research</span>
      <small>Search and compare sources privately</small>
    </button>
    <WebResearchWorkspace
      slug={slug}
      hostKey={hostKey}
      projectId={projectId}
      docked
      isOpen={open}
      onClose={close}
      onSavePool={onSavePool}
    />
  </section>;
}
