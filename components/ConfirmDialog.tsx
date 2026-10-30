"use client";

import { useEffect, useRef } from "react";

// In-app confirmation dialog (replaces window.confirm) so destructive
// actions stay inside the site's own design and explain themselves.
export default function ConfirmDialog({ title, message, confirmLabel, danger = false, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="confirm-dialog" aria-label={title} onCancel={onCancel}>
      <div className="confirm-dialog-panel">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="outline-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className={danger ? "danger-btn" : "build-btn"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
