"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";

/**
 * The one "Submit feedback" affordance: a floating pill rendered on every
 * page by FloatingFeedback (from the root layout), so a signed-in user can
 * share something without leaving the page they're on. It opens a small
 * in-page dialog — following the ConfirmDialog pattern — where the user
 * picks a kind and writes a message. Submissions post to /api/help, which
 * saves them to the admin's support inbox and emails a copy to the site
 * admin. The pill's fixed positioning lives in the `.feedback-fab` rule in
 * app/globals.css (bottom-left, clear of the bottom-right support/Jewel
 * launchers), with a shift rule in the project shell CSS for the one
 * surface whose docked chat panel occupies that corner.
 *
 * The dialog shows plain-language kinds; each maps to the topic the help
 * route stores ("Issue" is the route's long-standing "Site issue" topic).
 */
const KINDS = [
  { label: "Issue", topic: "Site issue" },
  { label: "Comment", topic: "Comment" },
  { label: "Request", topic: "Request" },
  { label: "Other", topic: "Other" },
] as const;

const fieldLabel: CSSProperties = { display: "block", margin: "14px 0 0", fontSize: 13.5, color: "#c6d2e4" };
const field: CSSProperties = {
  display: "block", width: "100%", margin: "8px 0 0", padding: 10, background: "#0c1623",
  color: "#fff", border: "1px solid #526783", borderRadius: 8, font: "inherit", boxSizing: "border-box",
};

export default function SubmitFeedback() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["label"]>("Issue");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  function close() {
    setOpen(false);
    setKind("Issue");
    setMessage("");
    setBusy(false);
    setSent(false);
    setError("");
  }

  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    if (!open && node?.open) node.close();
  }, [open ]);

  // After a successful send, show the thank-you briefly, then close.
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(close, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const topic = KINDS.find((k) => k.label === kind)?.topic || "Other";
    setBusy(true);
    setError("");
    try {
      const page = typeof window !== "undefined" ? window.location.pathname : "";
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message: message.trim(), page }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your feedback could not be sent. Please try again.");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your feedback could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="feedback-fab" onClick={() => setOpen(true)}>Submit feedback</button>
      {open && (
        <dialog ref={dialog} className="confirm-dialog" aria-label="Submit feedback" onCancel={close}>
          <div className="confirm-dialog-panel">
            {sent ? (
              <>
                <h3>Thank you!</h3>
                <p>Your feedback was sent to the site owner.</p>
                <div className="confirm-dialog-actions">
                  <button type="button" className="build-btn" onClick={close}>Close</button>
                </div>
              </>
            ) : (
              <form onSubmit={submit}>
                <h3>Submit feedback</h3>
                <p>Issues, comments, requests — anything you want the site owner to know. Every message goes straight to her.</p>
                <label style={fieldLabel}>
                  What kind of feedback is this?
                  <select style={field} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                    {KINDS.map((k) => <option key={k.label} value={k.label}>{k.label}</option>)}
                  </select>
                </label>
                <label style={fieldLabel}>
                  Your message
                  <textarea
                    style={{ ...field, minHeight: 110, resize: "vertical" }}
                    required
                    minLength={5}
                    maxLength={5000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell the admin what happened, what you think, or what you'd like to see."
                  />
                </label>
                {error && <p role="status" style={{ color: "#ffb4b4", marginTop: 12 }}>{error}</p>}
                <div className="confirm-dialog-actions">
                  <button type="button" className="outline-btn" onClick={close} disabled={busy}>Cancel</button>
                  <button type="submit" className="build-btn" disabled={busy || message.trim().length < 5}>{busy ? "Sending…" : "Send"}</button>
                </div>
              </form>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
