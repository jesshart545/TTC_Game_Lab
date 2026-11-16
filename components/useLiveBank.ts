"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BankAction, BankState } from "../lib/bank";

export function useLiveBank(slug: string, hostKey = "") {
  const [states, setStates] = useState<Record<string, BankState>>({});
  const latest = useRef(states); latest.current = states;
  const refresh = useCallback(async () => {
    if (!slug) return;
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/bank`, { cache: "no-store", headers: hostKey ? { "x-host-key": hostKey } : undefined });
    if (!response.ok) return;
    const data = await response.json() as { states?: Record<string, BankState> };
    if (data.states) { latest.current = data.states; setStates(data.states); }
  }, [slug, hostKey]);
  useEffect(() => { void refresh(); if (!slug) return; const timer = setInterval(() => { void refresh(); }, 500); return () => clearInterval(timer); }, [refresh, slug]);
  const command = useCallback(async (toolId: string, action: BankAction, pressValue?: number) => {
    if (!slug || !hostKey) throw new Error("Open the private host dashboard from the builder.");
    const current = latest.current[toolId];
    const response = await fetch(`/api/live/${encodeURIComponent(slug)}/bank`, { method: "POST", headers: { "content-type": "application/json", "x-host-key": hostKey }, body: JSON.stringify({ toolId, action, pressValue, version: current?.version }) });
    const data = await response.json().catch(() => ({})) as { state?: BankState; error?: string };
    if (!response.ok || !data.state) throw new Error(data.error || "Bank action failed.");
    latest.current = { ...latest.current, [toolId]: data.state }; setStates(latest.current);
  }, [slug, hostKey]);
  return { states, command, refresh };
}
