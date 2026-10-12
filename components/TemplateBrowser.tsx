"use client";

import { useState } from "react";
import type { Project } from "../lib/project";
import { GAME_TEMPLATES, type TemplateCategory } from "../lib/game-templates";
import CollapsibleFolder, { type FolderBulkAction } from "./CollapsibleFolder";

type Props = {
  project: Project;
  onChoose: (templateId: string) => void;
  ccssEntitled: boolean;
};

const CATEGORY_ORDER: TemplateCategory[] = [
  "Trivia & Knowledge",
  "Word Games",
  "Visual Guessing",
  "Chance & Giveaways",
  "Puzzle & Adventure",
];

export default function TemplateBrowser({ project, onChoose, ccssEntitled }: Props) {
  const [query, setQuery] = useState("");
  const [bulkAction, setBulkAction] = useState<FolderBulkAction>({ open: false, sequence: 0 });
  const search = query.trim().toLowerCase();
  const matches = (name: string, tagline: string) =>
    !search || name.toLowerCase().includes(search) || tagline.toLowerCase().includes(search);
  const visible = GAME_TEMPLATES.filter((t) => (!t.restricted || ccssEntitled) && matches(t.name, t.tagline));
  const addedIds = new Set(
    project.gameTools.map((t) => (t.config as Record<string, unknown>)?.templateId).filter((v): v is string => typeof v === "string")
  );

  return (
    <section className="build-background-browser" aria-label="Game templates">
      <h3>Game templates</h3>
      <p className="workflow-quick-help">
        Add a ready-made game to this project. Open the folder, pick a template, and its tools and dashboard buttons join your game — your existing setup stays untouched.
      </p>
      <label>
        Find a template
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search game templates"
        />
      </label>
      <div className="folder-toolbar" role="group" aria-label="Template folder controls">
        <span>{visible.length} choices</span>
        <button type="button" onClick={() => setBulkAction((value) => ({ open: true, sequence: value.sequence + 1 }))}>
          Expand all templates
        </button>
        <button type="button" onClick={() => setBulkAction((value) => ({ open: false, sequence: value.sequence + 1 }))}>
          Collapse all templates
        </button>
      </div>
      <div className="asset-folders">
        {CATEGORY_ORDER.map((category) => {
          const templates = visible.filter((t) => t.category === category);
          if (!templates.length) return null;
          return (
            <CollapsibleFolder
              key={category}
              title={category}
              count={templates.length}
              storageKey={`build:${project.id}:templates:${category}`}
              expandKey={search}
              bulkAction={bulkAction}
            >
              <div className="creation-tray">
                {templates.map((template) => {
                  const added = addedIds.has(template.id);
                  return (
                    <article key={template.id}>
                      <div style={{ fontSize: "2rem" }} aria-hidden="true">{template.icon}</div>
                      <strong>{template.name}</strong>
                      <small>{template.tagline}</small>
                      <button type="button" onClick={() => onChoose(template.id)}>
                        {added ? "Add again" : "Add to my game"}
                      </button>
                      {added && <small style={{ color: "#8a96a8" }}>Already in your game</small>}
                    </article>
                  );
                })}
              </div>
            </CollapsibleFolder>
          );
        })}
        {!visible.length && <p>No templates match your search.</p>}
      </div>
    </section>
  );
}
