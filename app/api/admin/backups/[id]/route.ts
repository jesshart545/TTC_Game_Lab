import { NextResponse } from "next/server";
import { requireCreator, isAdmin } from "../../../../../lib/auth/server";
import { getDb } from "../../../../../lib/db";
import { getBackupSnapshot, type BackupPayload } from "../../../../../lib/project-protection";

// Admin-only: one snapshot's project list, so the admin can pick a project
// to restore. The full payload (project data) is never sent to the client.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireCreator();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Backups are unavailable right now. Please try again later." }, { status: 503 });
  const { id } = await context.params;
  const snapshot = await getBackupSnapshot(db, Number(id));
  if (!snapshot) return NextResponse.json({ error: "Backup snapshot not found." }, { status: 404 });
  const payload = snapshot.payload as BackupPayload;
  return NextResponse.json({
    id: Number(snapshot.id),
    createdAt: snapshot.created_at ? new Date(snapshot.created_at as string).toISOString() : null,
    projectCount: Number(snapshot.project_count ?? 0),
    projects: (payload.projects || []).map(project => ({
      id: String(project.id), name: String(project.name ?? ""), status: String(project.status ?? "Draft"),
      ownerId: (project.owner_id as string | null) ?? null, trashedAtBackup: project.deleted_at ? String(project.deleted_at) : null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
