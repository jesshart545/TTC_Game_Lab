import { useRef, useState, useEffect, useCallback } from "react";
import type { Project } from "./project";

const MAX_HISTORY = 50;

function undoableKey(p: Project): string {
  return JSON.stringify({
    gameTools: p.gameTools, controls: p.controls, assets: p.assets,
    assetPools: p.assetPools, compositions: p.compositions, overlay: p.overlay,
    wheel: p.wheel ? { ...p.wheel, spinning: false, visible: false } : p.wheel,
    gamePlan: p.gamePlan, name: p.name, description: p.description,
    theme: p.theme, prompt: p.prompt,
  });
}

export function useManualHistory(
  projectRef: React.MutableRefObject<Project | null>,
  persist: (next: Project) => void,
) {
  const undoStack = useRef<Project[]>([]);
  const redoStack = useRef<Project[]>([]);
  const suppressHistory = useRef(false);
  const [historyDepth, setHistoryDepth] = useState({ undo: 0, redo: 0 });

  const recordHistory = useCallback((prev: Project) => {
    if (suppressHistory.current) return;
    const key = undoableKey(prev);
    const last = undoStack.current[undoStack.current.length - 1];
    if (last && undoableKey(last) === key) return;
    undoStack.current.push(prev);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setHistoryDepth({ undo: undoStack.current.length, redo: 0 });
  }, []);

  const applySnapshot = useCallback((snapshot: Project) => {
    const current = projectRef.current;
    if (!current) return;
    suppressHistory.current = true;
    try {
      persist({ ...snapshot, messages: current.messages, workflow: current.workflow, publishedSnapshot: current.publishedSnapshot, status: current.status, updatedAt: "just now" });
    } finally {
      suppressHistory.current = false;
    }
  }, [projectRef, persist]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    const current = projectRef.current;
    if (!prev || !current) return;
    redoStack.current.push(current);
    applySnapshot(prev);
    setHistoryDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  }, [projectRef, applySnapshot]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    const current = projectRef.current;
    if (!next || !current) return;
    undoStack.current.push(current);
    applySnapshot(next);
    setHistoryDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  }, [projectRef, applySnapshot]);

  // Keyboard shortcuts, skipped in text fields so native text undo works.
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (!e.shiftKey && key === "z") { e.preventDefault(); undoRef.current(); }
      else if (key === "y" || (e.shiftKey && key === "z")) { e.preventDefault(); redoRef.current(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { recordHistory, suppressHistory, undo, redo, historyDepth };
}
