import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { searchYoutube, verifyYoutube, validLiveHost, youtubeSearchConfigured } from "../../../../../lib/youtube-server";
import { youtubeId } from "../../../../../lib/youtube";
import type { Project } from "../../../../../lib/project";
export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { slug } = await context.params, db = getDb();
    if (!db) return NextResponse.json({ error: "Live service unavailable." }, { status: 503 });
    const rows = await db`SELECT data FROM projects WHERE slug = ${slug} LIMIT 1`;
    const project = (rows[0]?.data as Project | undefined)?.publishedSnapshot;
    if (!project) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
    if (!await validLiveHost(db, project.id, request.headers.get("x-host-key") || "")) return NextResponse.json({ error: "Open the private dashboard link from the builder." }, { status: 403 });
    const params = new URL(request.url).searchParams;
    if (params.get("mode") === "status") {
      await db`CREATE TABLE IF NOT EXISTS live_events (id BIGSERIAL PRIMARY KEY, project_id TEXT NOT NULL, control_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await db`ALTER TABLE live_events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'control'`;
      await db`ALTER TABLE live_events ADD COLUMN IF NOT EXISTS payload JSONB`;
      const state = await db`SELECT payload FROM live_events WHERE project_id=${project.id} AND event_type='youtube' ORDER BY id DESC LIMIT 1`;
      const feedback = await db`SELECT payload FROM live_events WHERE project_id=${project.id} AND event_type='youtube-feedback' ORDER BY id DESC LIMIT 1`;
      return NextResponse.json({ state: state[0]?.payload || null, feedback: feedback[0]?.payload || null, searchConfigured: youtubeSearchConfigured() }, { headers: { "Cache-Control": "no-store" } });
    }
    const region = /^[A-Z]{2}$/.test(params.get("region") || "") ? params.get("region")! : "US";
    if (params.has("video")) {
      const id = youtubeId(params.get("video"));
      if (!id) return NextResponse.json({ error: "Enter a valid YouTube link." }, { status: 400 });
      return NextResponse.json({ video: await verifyYoutube(id, region) }, { headers: { "Cache-Control": "no-store" } });
    }
    const q = (params.get("q") || "").trim();
    if (!q || q.length > 200) return NextResponse.json({ error: "Enter a search from 1 to 200 characters." }, { status: 400 });
    return NextResponse.json({ videos: await searchYoutube(q, region) }, { headers: { "Cache-Control": "no-store" } });
  } catch(error) { return NextResponse.json({ error: error instanceof Error ? error.message : "YouTube request failed." }, { status: 502 }); }
}
export async function POST(request: Request, context: Context) {
  // Overlay feedback cannot issue playback commands or change video selection.
  try {
    const { slug } = await context.params, db = getDb();
    if (!db) return NextResponse.json({ error: "Live service unavailable." }, { status: 503 });
    const body = await request.json().catch(() => ({}));
    if (!["playing","playing-muted","paused","ended","blocked","error","buffering","timeout"].includes(body.status) || !/^[\w-]{36}$/.test(body.playbackId || "")) return NextResponse.json({ error: "Invalid player feedback." }, { status: 400 });
    const rows = await db`SELECT data FROM projects WHERE slug=${slug} LIMIT 1`;
    const project = (rows[0]?.data as Project | undefined)?.publishedSnapshot;
    if (!project) return NextResponse.json({ error: "Published project unavailable." }, { status: 404 });
    const states = await db`SELECT payload FROM live_events WHERE project_id=${project.id} AND event_type='youtube' ORDER BY id DESC LIMIT 1`;
    if (states[0]?.payload?.playbackId !== body.playbackId || states[0]?.payload?.action === "stop") return NextResponse.json({ ok: true });
    const latest = await db`SELECT payload FROM live_events WHERE project_id=${project.id} AND event_type='youtube-feedback' ORDER BY id DESC LIMIT 1`;
    if (latest[0]?.payload?.playbackId === body.playbackId && latest[0]?.payload?.status === body.status) return NextResponse.json({ ok: true });
    const position = Number(body.position);
    const payload = JSON.stringify({ playbackId: body.playbackId, status: body.status, at: Date.now(), ...([2,5,100,101,150,153].includes(body.errorCode) ? {errorCode:body.errorCode} : {}), ...(Number.isFinite(position) && position >= 0 && position <= 86400 ? {position} : {}) });
    await db`INSERT INTO live_events (project_id,control_id,event_type,payload) VALUES (${project.id},'youtube','youtube-feedback',${payload}::jsonb)`;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Player feedback unavailable." }, { status: 502 }); }
}
