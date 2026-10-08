"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type FolderBulkAction = { open: boolean; sequence: number };
type Props = {
  title: string;
  count?: number;
  description?: string;
  children: ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  expandKey?: string;
  bulkAction?: FolderBulkAction;
  keepMounted?: boolean;
};

export function rememberFolderState(storageKey: string, open: boolean) {
  try { window.sessionStorage.setItem(`ttc-folder:${storageKey}`, open ? "open" : "closed"); } catch {}
}

export default function CollapsibleFolder({
  title, count, description, children, storageKey, defaultOpen = false,
  expandKey = "", bulkAction, keepMounted = false,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen || Boolean(expandKey));
  const previousBulkSequence = useRef(bulkAction?.sequence || 0);

  function remember(next: boolean) {
    setOpen(next);
    if (storageKey) rememberFolderState(storageKey, next);
  }

  useEffect(() => {
    if (!bulkAction?.sequence || bulkAction.sequence === previousBulkSequence.current) return;
    previousBulkSequence.current = bulkAction.sequence;
    remember(bulkAction.open);
    // Sequence changes identify an explicit expand/collapse-all action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkAction?.sequence]);

  useEffect(() => {
    if (expandKey) { setOpen(true); return; }
    let saved: string | null = null;
    try { if (storageKey) saved = window.sessionStorage.getItem(`ttc-folder:${storageKey}`); } catch {}
    setOpen(saved === null ? defaultOpen : saved === "open");
  }, [storageKey, defaultOpen, expandKey]);

  return (
    <section className={`asset-folder${open ? " is-open" : ""}`} data-folder-title={title}>
      <button
        type="button" className="asset-folder-toggle" id={`${id}-heading`}
        aria-expanded={open} aria-controls={`${id}-contents`}
        onClick={() => remember(!open)}
      >
        <svg className="asset-folder-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
        <svg className="asset-folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5h7l2 2h9v13H3Z" /></svg>
        <span className="asset-folder-label"><strong>{title}</strong>{description && <small>{description}</small>}</span>
        {count !== undefined && <span className="asset-folder-count" aria-label={`${count} items`}>{count}</span>}
      </button>
      <div id={`${id}-contents`} className="asset-folder-contents" hidden={!open} role="region" aria-labelledby={`${id}-heading`}>
        {(open || keepMounted) && children}
      </div>
    </section>
  );
}
