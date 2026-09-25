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

async function ensureLiveEvents(db: ReturnType<typeof getDb>) {
  if (!db) return;
  await db`CREATE TABLE IF NOT EXISTS live_events (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, control_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE live_events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'control'`;
  await db`ALTER TABLE live_events ADD COLUMN IF NOT EXISTS payload JSONB`;
}

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const live = await published(slug);
  if (!live) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
  await ensureLiveEvents(live.db);
  const since = Number(new URL(request.url).searchParams.get("since") || 0);
  if (!Number.isSafeInteger(since) || since < 0) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  if (new URL(request.url).searchParams.has("init")) {
    const rows = await live.db`SELECT COALESCE(MAX(id), 0) AS cursor FROM live_events WHERE project_id = ${live.project.id}`;
    const usedRows = await live.db`SELECT payload FROM live_events WHERE project_id = ${live.project.id} AND event_type = 'trivia' AND payload->>'action' = 'question' ORDER BY id ASC`;
    const usedTrivia = usedRows.map(row => {
      const payload = row.payload as { categoryIndex?: number; questionIndex?: number } | null;
      return Number.isInteger(payload?.categoryIndex) && Number.isInteger(payload?.questionIndex) ? `${payload!.categoryIndex}:${payload!.questionIndex}` : null;
    }).filter(Boolean);
    return NextResponse.json({ cursor: Number(rows[0].cursor), events: [], usedTrivia }, { headers: { "Cache-Control": "no-store" } });
  }
  const rows = await live.db`SELECT id, control_id, event_type, payload FROM live_events WHERE project_id = ${live.project.id} AND id > ${since} ORDER BY id ASC LIMIT 100`;
  return NextResponse.json({ cursor: rows.length ? Number(rows[rows.length - 1].id) : since, events: rows.map(row => ({ id: Number(row.id), controlId: row.control_id, type: row.event_type, payload: row.payload })) }, { headers: { "Cache-Control": "no-store" } });
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

  await ensureLiveEvents(live.db);

  if (body.trivia) {
    const triviaTool = (live.project.gameTools || []).find(tool => tool.type === "trivia-board" && tool.enabled);
    if (!triviaTool) return NextResponse.json({ error: "Trivia Board is not enabled in this published experience." }, { status: 400 });
    const action = String(body.trivia.action || "");
    if (!['question', 'answer', 'close'].includes(action)) return NextResponse.json({ error: "Invalid trivia action." }, { status: 400 });

    let payload: Record<string, unknown> = { action };
    if (action !== "close") {
      const categoryIndex = Number(body.trivia.categoryIndex);
      const questionIndex = Number(body.trivia.questionIndex);
      const categories = Array.isArray(triviaTool.config.categories) ? triviaTool.config.categories as Array<{ name?: string; questions?: Array<{ value?: number; prompt?: string; answer?: string; source?: string; sourceUrl?: string }> }> : [];
      const category = categories[categoryIndex];
      const question = category?.questions?.[questionIndex];
      if (!Number.isInteger(categoryIndex) || !Number.isInteger(questionIndex) || !category || !question) {
        return NextResponse.json({ error: "Trivia question is not in the published board." }, { status: 400 });
      }
      payload = { action, categoryIndex, questionIndex, category: category.name || "Trivia", value: question.value || 0, prompt: question.prompt || "", answer: question.answer || "", source: question.source || "", sourceUrl: question.sourceUrl || "" };
    }
    const payloadJson = JSON.stringify(payload);
    const rows = await live.db`INSERT INTO live_events (project_id, control_id, event_type, payload) VALUES (${live.project.id}, ${"trivia"}, ${"trivia"}, ${payloadJson}::jsonb) RETURNING id`;
    return NextResponse.json({ ok: true, id: Number(rows[0].id) });
  }

  const control = live.project.controls.find(item => item.id === body.controlId);
  if (!control || (control.compositionId && !live.project.compositions?.some(comp => comp.id === control.compositionId && comp.inProject))) {
    return NextResponse.json({ error: "Control is not in the published experience." }, { status: 400 });
  }
  const rows = await live.db`INSERT INTO live_events (project_id, control_id, event_type) VALUES (${live.project.id}, ${control.id}, ${"control"}) RETURNING id`;
  return NextResponse.json({ ok: true, id: Number(rows[0].id) });
}
