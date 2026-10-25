import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { listTrashedProjects } from "../../../../lib/project-protection";

// Lists the signed-in creator's trashed projects (admins see everyone's),
// newest deletion first. Used by the Trash view in the project library.
export async function GET() {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, projects: [] });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  const projects = await listTrashedProjects(db, { id: user.id, admin: isAdmin(user) });
  return NextResponse.json({ configured: true, projects });
}
