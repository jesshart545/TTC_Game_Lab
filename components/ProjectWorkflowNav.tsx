"use client";

import type { ReactNode } from "react";

const projectStages = ["Imagine and Create", "Set the Stage", "Showtime!"];
const workshopSections = [
  { label: "Game plan", hint: "Name and describe the game" },
  { label: "Assets & tools", hint: "Media, cards, boards, tools" },
  { label: "Scenes & effects", hint: "Optional timed sequences" },
];

type Props = {
  stage: number;
  workshopSection: number;
  onStageChange: (stage: number, workshopSection?: number) => void;
  entryGuide?: ReactNode;
  /** Bare mode (Talk Show Imagine and Create): only the stage buttons —
   *  no explanatory note, no section tab trio, nothing stacked above the
   *  talk areas (Jessica's layout, 2026-11-04). */
  bare?: boolean;
  /** Stage indexes that are locked (the talk gate: Set the Stage and
   *  Showtime! unlock when every Imagine and Create area is complete —
   *  done or skipped). Undefined/empty = nothing locked. */
  lockedStages?: number[];
  /** The line shown under the stage buttons while any stage is locked. */
  lockNote?: string;
};

export default function ProjectWorkflowNav({ stage, workshopSection, onStageChange, entryGuide, bare, lockedStages, lockNote }: Props) {
  const locked = new Set(lockedStages || []);
  return (
    <>
      <nav className="workshop-steps" aria-label="Project stages">
        {projectStages.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={stage === index ? "step" : undefined}
            className={stage === index ? "active" : ""}
            disabled={locked.has(index)}
            title={locked.has(index) ? "Finish every area in Imagine and Create first — done or skipped" : undefined}
            onClick={() => onStageChange(index)}
          >
            <span aria-hidden="true">{locked.has(index) ? "🔒" : index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {locked.size > 0 && lockNote && <p className="workflow-navigation-note">{lockNote}</p>}
      {!bare && (
        <p className="workflow-navigation-note">
          Imagine and Create is for creating materials. Set the Stage assembles the overlay and host dashboard. Showtime! only when you choose to.
        </p>
      )}
      {!bare && stage === 0 && (
        <div className="workflow-local-navigation">
          <span className="workflow-section-label">Imagine and Create · create materials</span>
          <nav className="workshop-substeps" aria-label="Imagine and Create sections">
            {workshopSections.map((section, index) => (
              <button
                key={section.label}
                type="button"
                aria-pressed={workshopSection === index}
                title={section.hint}
                className={workshopSection === index ? "active" : ""}
                onClick={() => onStageChange(0, index)}
              >
                <span className="workshop-substep-label">{section.label}</span>
                <small className="workshop-substep-hint">{section.hint}</small>
              </button>
            ))}
          </nav>
        </div>
      )}
      {entryGuide}
    </>
  );
}
