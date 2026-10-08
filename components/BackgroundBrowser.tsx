"use client";

import { useState } from "react";
import type { Project } from "../lib/project";
import { assetCategory } from "../lib/asset-folders";
import AssetThumbnail from "./AssetThumbnail";
import CollapsibleFolder, { type FolderBulkAction } from "./CollapsibleFolder";

type Props = {
  project: Project;
  onChoose: (id: string, board?: boolean) => void;
  onWorkshop: () => void;
};

export default function BackgroundBrowser({ project, onChoose, onWorkshop }: Props) {
  const [query, setQuery] = useState("");
  const [bulkAction, setBulkAction] = useState<FolderBulkAction>({ open: false, sequence: 0 });
  const search = query.trim().toLowerCase();
  const matches = (name: string) => !search || name.toLowerCase().includes(search);
  const media = project.assets.filter(asset => ["image", "video"].includes(assetCategory(asset)) && matches(asset.name));
  const boards = project.gameTools.filter(tool => tool.enabled && ["blank-board", "trivia-board"].includes(tool.type) && matches(tool.name));
  const current = project.assets.find(asset => asset.inProject && asset.role === "background")?.name
    || project.gameTools.find(tool => tool.enabled && tool.inOverlayBuild && ["blank-board", "trivia-board"].includes(tool.type))?.name;

  return <section className="build-background-browser" aria-label="Initial background">
    <h3>Choose the initial background or board</h3>
    <p className="workflow-quick-help">{current ? `Current background: ${current}. Open a folder to choose a different one.` : "Open a folder to choose your starting scene, or create one in Workshop."}</p>
    <label>Find a background or board<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search backgrounds and boards" /></label>
    <div className="folder-toolbar" role="group" aria-label="Background folder controls">
      <span>{media.length + boards.length} choices</span>
      <button type="button" onClick={() => setBulkAction(value => ({ open: true, sequence: value.sequence + 1 }))}>Expand all backgrounds</button>
      <button type="button" onClick={() => setBulkAction(value => ({ open: false, sequence: value.sequence + 1 }))}>Collapse all backgrounds</button>
    </div>
    <div className="asset-folders">
      {(["image", "video"] as const).map(kind => {
        const assets = media.filter(asset => assetCategory(asset) === kind);
        if (!assets.length) return null;
        return <CollapsibleFolder key={kind} title={kind === "image" ? "Image backgrounds" : "Animated / video backgrounds"} count={assets.length}
          storageKey={`build:${project.id}:backgrounds:${kind}`} expandKey={search} bulkAction={bulkAction}>
          <div className="creation-tray">
            {assets.map(asset => {
              const id = asset.storageKey || asset.name;
              const selected = Boolean(asset.inProject && asset.role === "background");
              return <article key={id}>
                <button type="button" className="build-asset-thumbnail" aria-label={`Use ${asset.name} as initial background`} aria-pressed={selected} onClick={() => onChoose(id)}>
                  <AssetThumbnail key={asset.url || id} asset={asset} kind={kind}/>
                </button>
                <strong>{asset.name}</strong><small>{kind === "video" ? "Animated background" : "Image background"}</small>
                <button type="button" onClick={() => onChoose(id)}>{selected ? "Current background" : "Use as initial background"}</button>
              </article>;
            })}
          </div>
        </CollapsibleFolder>;
      })}
      {boards.length > 0 && <CollapsibleFolder title="Interactive boards" count={boards.length}
        storageKey={`build:${project.id}:backgrounds:boards`} expandKey={search} bulkAction={bulkAction}>
        <div className="creation-tray">{boards.map(tool => <article key={tool.id}>
          <strong>{tool.name}</strong><small>{tool.type === "trivia-board" ? "Trivia board" : "Custom board"}</small>
          <button type="button" onClick={() => onChoose(tool.id, true)}>{tool.inOverlayBuild ? "Current board" : "Use as initial board"}</button>
        </article>)}</div>
      </CollapsibleFolder>}
      {!media.length && !boards.length && <p className="empty-note">{search ? "No backgrounds or boards match that search." : "No backgrounds or boards saved yet."}</p>}
    </div>
    <button type="button" className="outline-btn" onClick={onWorkshop}>Create or design in Workshop</button>
  </section>;
}
