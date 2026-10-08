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
  const primary = started ? nextActions[0] : firstAction;
  return <section className={`workflow-entry-guide${started ? " entry-started" : ""}`} aria-label={`${stage} getting started`} data-entry-phase={started ? "next" : "first"}>
    <div className="entry-guide-copy">
      <span className="entry-guide-kicker">{started ? "CURRENT TASK" : "START HERE"} <span aria-hidden="true">·</span> {stage}</span>
      <h2>{started ? nextQuestion : firstTitle}</h2>
      <p>{started ? nextDescription : firstDescription}</p>
    </div>
    <div className="entry-guide-actions" role={started ? "group" : undefined} aria-label={started ? "What next actions" : undefined}>
      {primary && <button type="button" className="build-btn" onClick={primary.onClick}>{primary.label}</button>}
      {!started && <span className="entry-guide-note">This opens the work area; it does not complete the step.</span>}
      {started && <details className="entry-guide-options" key={stage}>
        <summary>Other options &amp; help</summary>
        {nextActions.slice(1).map(action => <button type="button" key={action.label} className="outline-btn" onClick={action.onClick}>{action.label}</button>)}
        <button type="button" className="entry-guide-replay" onClick={onShowFirst}>Show the first step</button>
      </details>}
    </div>
  </section>;
}
