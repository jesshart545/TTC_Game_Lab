import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { deleteAssetsByPrefix } from "../../../../lib/object-storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows = await db`SELECT data FROM projects WHERE id = ${id} OR slug = ${id} LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: rows[0].data });
}


export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows = await db`SELECT id FROM projects WHERE id = ${id} OR slug = ${id} LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const projectId = String(rows[0].id);
  let deletedAssets = 0;
  try {
    deletedAssets = await deleteAssetsByPrefix(`projects/${projectId}/`);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `Could not delete project assets: ${error.message}` : "Could not delete project assets." }, { status: 500 });
  }
  await db`DELETE FROM projects WHERE id = ${projectId}`;
  return NextResponse.json({ ok: true, id: projectId, deletedAssets });
}
