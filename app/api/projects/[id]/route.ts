import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const { id } = await context.params;
  const rows = await db`SELECT data FROM projects WHERE id = ${id} OR slug = ${id} LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project: rows[0].data });
}
