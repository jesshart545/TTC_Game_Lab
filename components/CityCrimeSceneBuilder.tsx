"use client";

import { useState } from "react";
import CityCrimeSceneEditor from "./CityCrimeSceneEditor";
import type { GameTool, Project } from "../lib/project";
import type { GameToolType } from "../lib/project";

type Deps = {
  project: Project | null;
  projectRef: React.MutableRefObject<Project | null>;
  persist: (p: Project) => void;
  setAssetStatus: (s: string) => void;
  ccssEntitled: boolean;
  toolDefaults: (type: GameToolType) => Record<string, unknown>;
  toolLibrary: { type: string; name: string }[];
};

export function useCityCrimeSceneBuilder(deps: Deps) {
  const { project, projectRef, persist, setAssetStatus, ccssEntitled, toolDefaults, toolLibrary } = deps;
  const [cityCrimeSceneId, setCityCrimeSceneId] = useState("");

  function openCityCrimeScene() {
    if (!ccssEntitled) {
      setAssetStatus("City Crime Scene is restricted to specific accounts.");
      return;
    }
    const current = projectRef.current || project;
    if (!current) return;
    let tool: GameTool | undefined = (current.gameTools || []).find(t => t.type === "city-crime-scene" && t.enabled);
    if (!tool) {
      const info = toolLibrary.find(t => t.type === "city-crime-scene");
      if (!info) { setAssetStatus("City Crime Scene is unavailable."); return; }
      tool = { id: `city-crime-scene-${Date.now()}`, type: "city-crime-scene", name: info.name, enabled: true, inToolbox: true, config: { ...toolDefaults("city-crime-scene") } };
      persist({ ...current, gameTools: [...(current.gameTools || []), tool], updatedAt: "just now" });
    }
    setCityCrimeSceneId(tool.id);
  }

  function renderBuilder() {
    const editingCcss = (project?.gameTools || []).find(t => t.id === cityCrimeSceneId && t.type === "city-crime-scene");
    if (!editingCcss) return null;
    return (
      <main className="workspace-page">
        <div className="ccss-builder">
          <div className="ccss-builder-header">
            <button type="button" className="outline-btn" onClick={() => setCityCrimeSceneId("")}>← Back to Workshop</button>
            <div>
              <h1>City Crime Scene</h1>
              <p>Curate and configure your improv whodunnit — premise, detectives, suspects, clues, locations, witnesses, timeline, and twists. Your input decides every detail.</p>
            </div>
          </div>
          <CityCrimeSceneEditor
            key={editingCcss.id}
            tool={editingCcss}
            onSave={next => {
              const current = projectRef.current || project;
              if (!current) return;
              persist({ ...current, gameTools: (current.gameTools || []).map(t => t.id === next.id ? next : t), updatedAt: "just now" });
            }}
          />
        </div>
      </main>
    );
  }

  return { openCityCrimeScene, renderBuilder };
}
