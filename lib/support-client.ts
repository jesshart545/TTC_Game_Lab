"use client";

import { useEffect, useRef } from "react";
import type { SupportContext, SupportTarget } from "./site-support";

export type SupportTurn = { role: "user" | "assistant"; text: string };
export type SupportTaskResult = { reply: string; changed?: boolean; status?: "complete" | "clarification" | "failed" };
export type SupportBridge = {
  context: SupportContext;
  hostKey?: string;
  slug?: string;
  navigate: (target: SupportTarget) => boolean;
  execute?: (text: string, history: SupportTurn[], progress: (text: string) => void) => Promise<SupportTaskResult>;
  undo?: () => Promise<string>;
  resumeMedia?: () => void;
};

const listeners = new Set<() => void>();
let current: { owner: symbol; bridge: SupportBridge } | null = null;
export function getSupportBridge() { return current?.bridge ?? null; }
export function subscribeSupportBridge(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notify() { listeners.forEach(listener => listener()); }

/** Keeps callbacks fresh without asking pages to serialize their entire project. */
export function useSupportBridge(bridge: SupportBridge) {
  const owner = useRef(Symbol("support-page"));
  const latest = useRef(bridge);
  latest.current = bridge;
  const scope = bridge.context.scope;
  useEffect(() => {
    current = { owner: owner.current, bridge: latest.current };
    notify();
    return () => {
      if (current?.owner === owner.current) { current = null; notify(); }
    };
  }, [scope]);
  useEffect(() => {
    if (current?.owner === owner.current) {
      current = { owner: owner.current, bridge: latest.current };
      notify();
    }
  });
}

export function supportPanelEvent(panel: "support" | "research") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ttc-assistant-panel", { detail: panel }));
}
export function requestResearchOpen() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ttc-open-research"));
}
