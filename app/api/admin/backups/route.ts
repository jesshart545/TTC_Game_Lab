import { NextResponse } from "next/server";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { getDb } from "../../../../lib/db";
import { createBackupSnapshot, listBackupSnapshots, listDeletionAudit } from "../../../../lib/project-protection";

// Admin-only: backup snapshot list + recent deletion audit log.
export async function GET() {
  const user = await requireCreator();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Backups are unavailable right now. Please try again later." }, { status: 503 });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const snapshots = await listBackupSnapshots(db);
  const audit = await listDeletionAudit(db, 100);
  return NextResponse.json({
    snapshots: snapshots.map((row: any) => ({ id: Number(row.id), createdAt: row.created_at ? new Date(row.created_at).toISOString() : null, projectCount: Number(row.project_count ?? 0) })),
    audit: audit.map((row: any) => ({ id: Number(row.id), projectId: String(row.project_id), projectTitle: String(row.project_title ?? ""), ownerId: row.owner_id ?? null, actorEmail: row.actor_email ?? null, action: String(row.action), createdAt: row.created_at ? new Date(row.created_at).toISOString() : null })),
  }, { headers: { "Cache-Control": "no-store" } });
}

// Admin-only "Back up now": runs the exact same export as the nightly cron.
export async function POST() {
  const user = await requireCreator();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Backups are unavailable right now. Please try again later." }, { status: 503 });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const snapshot = await createBackupSnapshot(db);
  return NextResponse.json({ ok: true, snapshot: { id: Number(snapshot.id), createdAt: snapshot.createdAt ? new Date(snapshot.createdAt as string).toISOString() : null, projectCount: snapshot.projectCount, pruned: snapshot.pruned } });
}
