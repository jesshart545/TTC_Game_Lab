"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DjState } from "../lib/dj-deck";
import type { SoundBoardState } from "../lib/sound-board";

// The live audio tools' client sync (useLiveBank is the pattern):
// the overlay reads the states publicly, the private host dashboard
// also sends commands with its host key. Polling keeps the dashboard
// and the overlay on the same shared state.
export function useLiveAudio(slug: string, hostKey = "") {
  const [deckStates, setDeckStates] = useState<Record<string, DjState>>({});
  const [soundStates, setSoundStates] = useState<Record<string, SoundBoardState>>({});
  const latest = useRef<{ decks: Record<string, DjState>; sounds: Record<string, SoundBoardState> }>({ decks: {}, sounds: {} });
  const refresh = useCallback(async () => {
    if (!slug) return;
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/audio`, { cache: "no-store", headers: hostKey ? { "x-host-key": hostKey } : undefined });
    if (!response.ok) return;
    const data = await response.json() as { decks?: Record<string, DjState>; sounds?: Record<string, SoundBoardState> };
    if (data.decks || data.sounds) {
      latest.current = { decks: data.decks || {}, sounds: data.sounds || {} };
      setDeckStates(latest.current.decks);
      setSoundStates(latest.current.sounds);
    }
  }, [slug, hostKey]);
  useEffect(() => { void refresh(); if (!slug) return; const timer = setInterval(() => { void refresh(); }, 500); return () => clearInterval(timer); }, [refresh, slug]);
  const command = useCallback(async (toolId: string, action: string, arg?: string) => {
    if (!slug || !hostKey) throw new Error("Open the private host dashboard from the builder.");
    const current = latest.current.decks[toolId] || latest.current.sounds[toolId];
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/audio`, { method: "POST", headers: { "content-type": "application/json", "x-host-key": hostKey }, body: JSON.stringify({ toolId, action, arg, version: current?.version }) });
    const data = await response.json().catch(() => ({})) as { state?: DjState | SoundBoardState; error?: string };
    if (!response.ok || !data.state) throw new Error(data.error || "Audio action failed.");
    if (latest.current.decks[toolId]) { latest.current = { ...latest.current, decks: { ...latest.current.decks, [toolId]: data.state as DjState } }; setDeckStates(latest.current.decks); }
    else { latest.current = { ...latest.current, sounds: { ...latest.current.sounds, [toolId]: data.state as SoundBoardState } }; setSoundStates(latest.current.sounds); }
  }, [slug, hostKey]);
  return { deckStates, soundStates, command, refresh };
}
