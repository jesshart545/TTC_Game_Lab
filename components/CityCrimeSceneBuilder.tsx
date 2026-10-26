"use client";

import { useState } from "react";
import CityCrimeSceneEditor from "./CityCrimeSceneEditor";
import { hydrateAsset } from "../lib/asset-store";
import type { CcssMediaContext } from "../lib/city-crime-scene-media";
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
  onAskJewel: () => void;
};

export function useCityCrimeSceneBuilder(deps: Deps) {
  const { project, projectRef, persist, setAssetStatus, ccssEntitled, toolDefaults, toolLibrary, onAskJewel } = deps;
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
    if (!editingCcss || !project) return null;
    return (
      <main className="workspace-page">
        <div className="ccss-builder">
          <div className="ccss-builder-topbar">
            <button type="button" className="outline-btn" onClick={() => setCityCrimeSceneId("")}>← Back to Workshop</button>
            <button type="button" className="build-btn ask-jewel-btn" aria-label="Ask Jewel" onClick={() => { setCityCrimeSceneId(""); onAskJewel(); }}>✦ Ask Jewel</button>
          </div>
          <CityCrimeSceneEditor
            key={editingCcss.id}
            tool={editingCcss}
            media={{
              projectId: project.id,
              registerAsset: asset => { const current = projectRef.current || project; persist({ ...current, assets: [...(current.assets || []), asset], updatedAt: "just now" }); },
              resolveAssetUrl: async key => { const current = projectRef.current || project; const found = (current.assets || []).find(a => (a.storageKey || a.name) === key); if (!found) return undefined; const hydrated = await hydrateAsset(found).catch(() => found); return hydrated.url && !hydrated.url.startsWith("blob:") ? hydrated.url : undefined; },
            }}
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
