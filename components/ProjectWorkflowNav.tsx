"use client";

import type { ReactNode } from "react";

const projectStages = ["Workshop", "Build Space", "Publish"];
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
};

export default function ProjectWorkflowNav({ stage, workshopSection, onStageChange, entryGuide }: Props) {
  return (
    <>
      <nav className="workshop-steps" aria-label="Project stages">
        {projectStages.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={stage === index ? "step" : undefined}
            className={stage === index ? "active" : ""}
            onClick={() => onStageChange(index)}
          >
            <span aria-hidden="true">{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <p className="workflow-navigation-note">
        Workshop is for creating materials. Build Space assembles the overlay and host dashboard. Publish only when you choose to.
      </p>
      {stage === 0 && (
        <div className="workflow-local-navigation">
          <span className="workflow-section-label">Workshop · create materials</span>
          <nav className="workshop-substeps" aria-label="Workshop sections">
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
