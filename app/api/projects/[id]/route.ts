import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { ensureProtectionSchema, trashProject } from "../../../../lib/project-protection";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await ensureProtectionSchema(db);
  // A trashed project is not openable; it comes back only via Trash restore.
  const rows = isAdmin(user)
    ? await db`SELECT data FROM projects WHERE (id = ${id} OR slug = ${id}) AND deleted_at IS NULL LIMIT 1`
    : await db`SELECT data FROM projects WHERE (id = ${id} OR slug = ${id}) AND owner_id = ${user.id} AND deleted_at IS NULL LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: rows[0].data });
}


// Deleting a project is now a soft delete: the project moves to Trash
// (deleted_at/deleted_by set, event written to the deletion audit log) and
// can be restored from the project library's Trash view. Stored assets and
// live data are intentionally kept — they are removed only by the explicit
// "Delete forever" action in Trash (see app/api/projects/trash/[id]).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await ensureProtectionSchema(db);
  const rows = isAdmin(user)
    ? await db`SELECT id, name, owner_id FROM projects WHERE (id = ${id} OR slug = ${id}) AND deleted_at IS NULL LIMIT 1`
    : await db`SELECT id, name, owner_id FROM projects WHERE (id = ${id} OR slug = ${id}) AND owner_id = ${user.id} AND deleted_at IS NULL LIMIT 1`;
  // Built-in demo projects may exist only in the client seed data and therefore have no Neon row.
  if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const project = { id: String(rows[0].id), name: String(rows[0].name ?? ""), owner_id: (rows[0].owner_id as string | null) ?? null };
  const trashed = await trashProject(db, project, { id: user.id, email: user.email });
  if (!trashed) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ ok: true, id: project.id, trashed: true });
}
