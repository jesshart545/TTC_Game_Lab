import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { requireCreator, isAdmin } from "../../../../../lib/auth/server";
import { deleteAssetsByPrefix } from "../../../../../lib/object-storage";
import { ensureProtectionSchema, restoreTrashedProject, deleteProjectForever } from "../../../../../lib/project-protection";

// POST { action: "restore" }        — bring a trashed project back to the library.
// POST { action: "delete-forever" } — the old hard delete: stored assets are
// removed first (aborting on failure, exactly like the pre-trash delete),
// then the project row and its live-host/live-event rows are deleted.
// Both actions are written to the deletion audit log.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String((body as { action?: unknown }).action ?? "");
  if (action !== "restore" && action !== "delete-forever") {
    return NextResponse.json({ error: "Action must be \"restore\" or \"delete-forever\"." }, { status: 400 });
  }
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await ensureProtectionSchema(db);
  const rows = isAdmin(user)
    ? await db`SELECT id, name, owner_id, deleted_at FROM projects WHERE (id = ${id} OR slug = ${id}) AND deleted_at IS NOT NULL LIMIT 1`
    : await db`SELECT id, name, owner_id, deleted_at FROM projects WHERE (id = ${id} OR slug = ${id}) AND owner_id = ${user.id} AND deleted_at IS NOT NULL LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Trashed project not found." }, { status: 404 });
  const project = { id: String(rows[0].id), name: String(rows[0].name ?? ""), owner_id: (rows[0].owner_id as string | null) ?? null };
  const actor = { id: user.id, email: user.email };
  if (action === "restore") {
    const restored = await restoreTrashedProject(db, project, actor);
    if (!restored) return NextResponse.json({ error: "Trashed project not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id: project.id, restored: true });
  }
  let deletedAssets = 0;
  try {
    deletedAssets = await deleteAssetsByPrefix(`projects/${project.id}/`);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `Could not delete project assets: ${error.message}` : "Could not delete project assets." }, { status: 500 });
  }
  await deleteProjectForever(db, project, actor);
  return NextResponse.json({ ok: true, id: project.id, deletedForever: true, deletedAssets });
}
