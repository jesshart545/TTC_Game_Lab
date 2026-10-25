import { NextResponse } from "next/server";
import { requireCreator, isAdmin } from "../../../../../../lib/auth/server";
import { getDb } from "../../../../../../lib/db";
import { restoreProjectFromBackup } from "../../../../../../lib/project-protection";

// Admin-only: restore ONE project from one backup snapshot.
// The restore never overwrites an existing project row (live or trashed):
// if a row with the same id or slug exists, it reports a conflict instead.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireCreator();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Backups are unavailable right now. Please try again later." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const projectId = String((body as { projectId?: unknown }).projectId ?? "");
  if (!projectId) return NextResponse.json({ error: "A projectId is required." }, { status: 400 });
  const result = await restoreProjectFromBackup(db, Number(id), projectId, { id: user.id, email: user.email });
  if (!result.ok) {
    if (result.reason === "snapshot-not-found") return NextResponse.json({ error: "Backup snapshot not found." }, { status: 404 });
    if (result.reason === "project-not-in-backup") return NextResponse.json({ error: "That project is not in this backup snapshot." }, { status: 404 });
    return NextResponse.json({ error: "A project with this id or slug already exists (live or in Trash). Nothing was overwritten — restore it from Trash, or delete it forever, then retry." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
