import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import type { Project } from '../../../../../lib/project';
import { validLiveHost } from '../../../../../lib/youtube-server';
import { changeBank, readBankStates } from '../../../../../lib/bank-server';
import type { BankAction } from '../../../../../lib/bank';
type Context = { params: Promise<{ slug: string }> };
async function published(slug: string) { const db = getDb(); if (!db) return null; const rows = await db`SELECT data FROM projects WHERE slug=${slug} LIMIT 1`; const project = (rows[0]?.data as Project | undefined)?.publishedSnapshot; return project ? { db, project } : null; }
export async function GET(request: Request, context: Context) {
  const { slug } = await context.params; const live = await published(slug); if (!live) return NextResponse.json({ error: 'Published project unavailable.' }, { status: 404 });
  const key = request.headers.get('x-host-key'); const privateView = key ? await validLiveHost(live.db, live.project.id, key) : false;
  if (key && !privateView) return NextResponse.json({ error: 'Open the private dashboard from the builder.' }, { status: 403 });
  return NextResponse.json({ states: await readBankStates(live.db, live.project) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request, context: Context) {
  const { slug } = await context.params; const live = await published(slug); if (!live) return NextResponse.json({ error: 'Published project unavailable.' }, { status: 404 });
  if (!await validLiveHost(live.db, live.project.id, request.headers.get('x-host-key') || '')) return NextResponse.json({ error: 'Open the private host dashboard from the builder.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!['start', 'add', 'bank', 'end-game', 'new-game'].includes(body.action)) return NextResponse.json({ error: 'Invalid bank action.' }, { status: 400 });
  if (body.version !== undefined && (!Number.isSafeInteger(body.version) || body.version < 0)) return NextResponse.json({ error: 'Invalid bank version.' }, { status: 400 });
  if (body.pressValue !== undefined && (typeof body.pressValue !== 'number' || !Number.isFinite(body.pressValue))) return NextResponse.json({ error: 'Invalid press value.' }, { status: 400 });
  try { return NextResponse.json({ state: await changeBank(live.db, live.project, String(body.toolId), body.action as BankAction, body.version, body.pressValue) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Bank action failed.' }, { status: 409 }); }
}
