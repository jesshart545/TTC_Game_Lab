import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { createHash, randomBytes } from "node:crypto";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, projects: [] });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows = await db`SELECT id, slug, name, description, status, theme, updated_at, prompt, data FROM projects ORDER BY updated_at DESC`;
  return NextResponse.json({ configured: true, projects: rows });
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  const incoming = await request.json();
  const body = incoming.project ?? incoming;
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const id = String(body.id);
  const slug = String(body.slug);
  const name = String(body.name);
  const description = String(body.description ?? "");
  const status = String(body.status ?? "Draft");
  const theme = String(body.theme ?? "cyan");
  const prompt = String(body.prompt ?? "");
  const data = JSON.stringify(body.data ?? body);
  await db`INSERT INTO projects (id, slug, name, description, status, theme, prompt, data, updated_at) VALUES (${id}, ${slug}, ${name}, ${description}, ${status}, ${theme}, ${prompt}, ${data}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status, theme=EXCLUDED.theme, prompt=EXCLUDED.prompt, data=EXCLUDED.data, updated_at=NOW()`;
  if (incoming.publish === true && body.publishedSnapshot) {
    await db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
    const existing = await db`SELECT token_hash FROM live_hosts WHERE project_id = ${id}`;
    const suppliedKey = typeof incoming.hostKey === "string" && /^[a-f0-9]{64}$/.test(incoming.hostKey) ? incoming.hostKey : "";
    const hostKey = suppliedKey && existing[0]?.token_hash === createHash("sha256").update(suppliedKey).digest("hex") ? suppliedKey : randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(hostKey).digest("hex");
    await db`INSERT INTO live_hosts (project_id, token_hash) VALUES (${id}, ${hash}) ON CONFLICT (project_id) DO UPDATE SET token_hash = EXCLUDED.token_hash`;
    return NextResponse.json({ ok: true, id, hostKey });
  }
  return NextResponse.json({ ok: true, id });
}
