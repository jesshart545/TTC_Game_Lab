"use client";

import type { ReactNode } from "react";

const projectStages = ["Workshop", "Build Space", "Publish"];
const workshopSections = ["Game plan", "Assets & tools", "Scenes & effects"];

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
        Move between stages whenever you need. Your draft stays separate from your published game.
      </p>
      {stage === 0 && (
        <div className="workflow-local-navigation">
          <span className="workflow-section-label">Workshop sections</span>
          <nav className="workshop-substeps" aria-label="Workshop sections">
            {workshopSections.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-pressed={workshopSection === index}
                className={workshopSection === index ? "active" : ""}
                onClick={() => onStageChange(0, index)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}
      {entryGuide}
    </>
  );
}
