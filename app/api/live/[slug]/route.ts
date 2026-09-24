import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import type { Project } from "../../../../lib/project";
import { createHash, timingSafeEqual } from "node:crypto";

type Context = { params: Promise<{ slug: string }> };

async function published(slug: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db`SELECT data FROM projects WHERE slug = ${slug} LIMIT 1`;
  const project = rows[0]?.data as Project | undefined;
  return project?.publishedSnapshot ? { db, project: project.publishedSnapshot } : null;
}

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const live = await published(slug);
  if (!live) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
  await live.db`CREATE TABLE IF NOT EXISTS live_events (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, control_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const since = Number(new URL(request.url).searchParams.get("since") || 0);
  if (!Number.isSafeInteger(since) || since < 0) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  // A fresh overlay starts at the current event, so an old trigger cannot replay on reload.
  if (new URL(request.url).searchParams.has("init")) {
    const rows = await live.db`SELECT COALESCE(MAX(id), 0) AS cursor FROM live_events WHERE project_id = ${live.project.id}`;
    return NextResponse.json({ cursor: Number(rows[0].cursor), events: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const rows = await live.db`SELECT id, control_id FROM live_events WHERE project_id = ${live.project.id} AND id > ${since} ORDER BY id ASC LIMIT 100`;
  return NextResponse.json({ cursor: rows.length ? Number(rows[rows.length - 1].id) : since, events: rows.map(row => ({ id: Number(row.id), controlId: row.control_id })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: Context) {
  const { slug } = await context.params;
  const live = await published(slug);
  if (!live) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const key = request.headers.get("x-host-key") || "";
  if (!/^[a-f0-9]{64}$/.test(key)) return NextResponse.json({ error: "Open the private host dashboard link from the builder." }, { status: 403 });
  await live.db`CREATE TABLE IF NOT EXISTS live_hosts (project_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`;
  const hosts = await live.db`SELECT token_hash FROM live_hosts WHERE project_id = ${live.project.id}`;
  const expected = String(hosts[0]?.token_hash || "");
  const actual = createHash("sha256").update(key).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))) {
    return NextResponse.json({ error: "Host access has expired. Open the dashboard from the builder again." }, { status: 403 });
  }
  const control = live.project.controls.find(item => item.id === body.controlId);
  if (!control || (control.compositionId && !live.project.compositions?.some(comp => comp.id === control.compositionId && comp.inProject))) {
    return NextResponse.json({ error: "Control is not in the published experience." }, { status: 400 });
  }
  await live.db`CREATE TABLE IF NOT EXISTS live_events (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, control_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows = await live.db`INSERT INTO live_events (project_id, control_id) VALUES (${live.project.id}, ${control.id}) RETURNING id`;
  return NextResponse.json({ ok: true, id: Number(rows[0].id) });
}
