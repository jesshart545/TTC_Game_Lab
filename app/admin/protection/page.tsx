"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Snapshot = { id: number; createdAt: string | null; projectCount: number; exportKey: string | null; exportedAt: string | null; exportError: string | null };
type AuditEntry = { id: number; projectId: string; projectTitle: string; ownerId: string | null; actorEmail: string | null; action: string; createdAt: string | null };
type SnapshotProject = { id: string; name: string; status: string; ownerId: string | null; trashedAtBackup: string | null };

export default function AdminProtectionPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [openSnapshot, setOpenSnapshot] = useState<number | null>(null);
  const [snapshotProjects, setSnapshotProjects] = useState<SnapshotProject[]>([]);

  async function load() {
    const response = await fetch("/api/admin/backups", { cache: "no-store" });
    if (response.status === 403) { setAdmin(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load backups.");
    setAdmin(true);
    setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
    setAudit(Array.isArray(data.audit) ? data.audit : []);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try { await load(); } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load backups."); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function backUpNow() {
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/backups", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backup failed.");
      setNotice(`Backup #${data.snapshot.id} saved — ${data.snapshot.projectCount} project(s)${data.snapshot.pruned ? `, ${data.snapshot.pruned} old snapshot(s) pruned` : ""}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Backup failed."); } finally { setBusy(false); }
  }

  async function toggleSnapshot(id: number) {
    if (openSnapshot === id) { setOpenSnapshot(null); setSnapshotProjects([]); return; }
    setError("");
    try {
      const response = await fetch(`/api/admin/backups/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load that snapshot.");
      setOpenSnapshot(id);
      setSnapshotProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load that snapshot."); }
  }

  async function restoreProject(snapshotId: number, project: SnapshotProject) {
    const confirmed = window.confirm(`Restore "${project.name}" from backup #${snapshotId}? It comes back as a normal project with its original id. If a project with that id already exists (live or in Trash), nothing is overwritten and the restore is refused.`);
    if (!confirmed) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch(`/api/admin/backups/${snapshotId}/restore`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restore failed.");
      setNotice(`"${project.name}" was restored from backup #${snapshotId}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Restore failed."); } finally { setBusy(false); }
  }

  return <main className="help-page"><Link href="/admin">← Admin dashboard</Link><h1>Project protection</h1>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {admin === null && !error && <p>Loading…</p>}
    {admin === false && <p role="alert">Admin access required. Sign in with an admin account to manage backups.</p>}
    {admin === true && <>
      <section><h2>Backups</h2>
        <p>Every night all project data is backed up automatically; the newest {14} snapshots are kept. Each snapshot is also copied to external object storage, so a copy survives even if the database itself is lost — the newest snapshot's storage key is shown below, which is what you would retrieve in a disaster. A backup can recreate a project exactly as it was — use it when a project disappears outside the normal delete flow.</p>
        <button type="button" className="build-btn" disabled={busy} onClick={backUpNow}>Back up now</button>
        {snapshots.length === 0 && <p>No backups yet. Run one now, or wait for tonight's automatic backup.</p>}
        <ul>
          {snapshots.map(snapshot => <li key={snapshot.id}>
            <button type="button" className="outline-btn" onClick={() => toggleSnapshot(snapshot.id)}>
              Backup #{snapshot.id} — {snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : "unknown time"} — {snapshot.projectCount} project(s)
            </button>
            <div><small>
              {snapshot.exportError
                ? <>External copy: <strong>failed</strong> — {snapshot.exportError}</>
                : snapshot.exportedAt
                  ? <>External copy: saved {new Date(snapshot.exportedAt).toLocaleString()}{snapshot.exportKey ? <> · <code>{snapshot.exportKey}</code></> : null}</>
                  : <>External copy: none recorded</>}
            </small></div>
            {openSnapshot === snapshot.id && <ul>
              {snapshotProjects.map(project => <li key={project.id}>
                {project.name} <small>({project.status}{project.trashedAtBackup ? ", was in Trash" : ""})</small>{" "}
                <button type="button" className="outline-btn" disabled={busy} onClick={() => restoreProject(snapshot.id, project)}>Restore this project</button>
              </li>)}
              {snapshotProjects.length === 0 && <li><small>No projects in this snapshot.</small></li>}
            </ul>}
          </li>)}
        </ul>
      </section>
      <section><h2>Deletion audit log</h2>
        <p>Every Trash, Restore, Delete forever, and Restore-from-backup action, with who did it.</p>
        {audit.length === 0 && <p>No deletion events recorded yet.</p>}
        <ul>
          {audit.map(entry => <li key={entry.id}>
            <strong>{entry.action}</strong> — {entry.projectTitle || entry.projectId}{" "}
            <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}{entry.actorEmail ? ` · by ${entry.actorEmail}` : ""} · project {entry.projectId}</small>
          </li>)}
        </ul>
      </section>
    </>}
  </main>;
}
