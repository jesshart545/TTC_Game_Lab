import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, projects: [] });
  const rows = await db`SELECT id, slug, name, description, status, theme, updated_at, prompt, data FROM projects ORDER BY updated_at DESC`;
  return NextResponse.json({ configured: true, projects: rows });
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const body = await request.json();
  const id = String(body.id);
  const slug = String(body.slug);
  const name = String(body.name);
  const description = String(body.description ?? "");
  const status = String(body.status ?? "Draft");
  const theme = String(body.theme ?? "cyan");
  const prompt = String(body.prompt ?? "");
  const data = JSON.stringify(body.data ?? body);
  await db`INSERT INTO projects (id, slug, name, description, status, theme, prompt, data, updated_at) VALUES (${id}, ${slug}, ${name}, ${description}, ${status}, ${theme}, ${prompt}, ${data}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status, theme=EXCLUDED.theme, prompt=EXCLUDED.prompt, data=EXCLUDED.data, updated_at=NOW()`;
  return NextResponse.json({ ok: true, id });
}
