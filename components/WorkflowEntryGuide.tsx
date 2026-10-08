"use client";

export type EntryAction = { label: string; onClick: () => void };
type Props = {
  stage: string;
  started: boolean;
  firstTitle: string;
  firstDescription: string;
  firstAction: EntryAction;
  nextQuestion: string;
  nextDescription: string;
  nextActions: EntryAction[];
  onShowFirst: () => void;
};

export default function WorkflowEntryGuide({
  stage, started, firstTitle, firstDescription, firstAction,
  nextQuestion, nextDescription, nextActions, onShowFirst,
}: Props) {
  return <section className={`workflow-entry-guide${started ? " entry-started" : ""}`} aria-label={`${stage} getting started`} data-entry-phase={started ? "next" : "first"}>
    <div className="entry-guide-copy">
      <span className="entry-guide-kicker">{started ? "WHAT NEXT?" : "START HERE"} <span aria-hidden="true">·</span> {stage}</span>
      <h2>{started ? nextQuestion : firstTitle}</h2>
      <p>{started ? nextDescription : firstDescription}</p>
    </div>
    {started ? <>
      <div className="entry-guide-actions" role="group" aria-label="What next actions">
        {nextActions.map((action, index) => <button type="button" key={action.label} className={index === 0 ? "build-btn" : "outline-btn"} onClick={action.onClick}>{action.label}</button>)}
      </div>
      <button type="button" className="entry-guide-replay" onClick={onShowFirst}>Show the first step</button>
    </> : <div className="entry-guide-actions">
      <button type="button" className="build-btn" onClick={firstAction.onClick}>{firstAction.label}</button>
      <span className="entry-guide-note">Start with this one action. Follow-up choices appear afterward.</span>
    </div>}
  </section>;
}
