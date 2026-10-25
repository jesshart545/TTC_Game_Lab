import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { createBackupSnapshot, isCronAuthorized } from "../../../../lib/project-protection";

// Nightly project backup, invoked by Vercel Cron (see vercel.json). Vercel
// sends `Authorization: Bearer <CRON_SECRET>` automatically when the
// CRON_SECRET environment variable is set in the project. Anything else is
// rejected — this endpoint exports every project, so it must never be
// publicly callable.
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const snapshot = await createBackupSnapshot(db);
  return NextResponse.json({ ok: true, snapshot });
}
