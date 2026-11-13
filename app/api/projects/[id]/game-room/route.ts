import { NextResponse } from "next/server";
import { requireCreator, isAdmin } from "../../../../../lib/auth/server";
import { ensureGameTables, gameDb, findRoomForProject, createGameRoom } from "../../../../../lib/game-room-store";
import { pickGame } from "../../../../../lib/game-room";
import type { Project } from "../../../../../lib/project";

type Context = { params: Promise<{ id: string }> };

/** Game Night sharing (Off-Stream Multiplayer Game Night): a multiplayer
 * project's publish surface creates (or reuses) its play room from the
 * FROZEN published snapshot and hands back the /play/<token> link the
 * creator shares — Jewel/the creator publish first, then share. The room
 * is the game: no host key, no dashboard, the creator plays along. */

async function ownedProject(id: string, user: { id: string; email?: string; role?: string }) {
  const db = gameDb();
  if (!db) return { error: NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 }) };
  await ensureGameTables(db);
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  const rows = isAdmin(user)
    ? await db`SELECT data, owner_id FROM projects WHERE (id = ${id} OR slug = ${id}) AND deleted_at IS NULL LIMIT 1`
    : await db`SELECT data, owner_id FROM projects WHERE (id = ${id} OR slug = ${id}) AND owner_id = ${user.id} AND deleted_at IS NULL LIMIT 1`;
  if (!rows.length) return { error: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  return { db, project: rows[0].data as Project, ownerId: String(rows[0].owner_id || user.id) };
}

export async function GET(_request: Request, context: Context) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const found = await ownedProject(id, user);
  if ("error" in found) return found.error;
  const room = await findRoomForProject(found.db, found.project.id);
  return NextResponse.json({
    published: !!found.project.publishedSnapshot,
    room: room ? { token: room.token, path: `/play/${room.token}`, status: room.status, gameType: room.gameType } : null,
  });
}

export async function POST(_request: Request, context: Context) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const found = await ownedProject(id, user);
  if ("error" in found) return found.error;
  const { db, project } = found;
  if (project.kind !== "multiplayer") {
    return NextResponse.json({ error: "Game Night sharing is for Off-Stream Multiplayer projects." }, { status: 400 });
  }
  const existing = await findRoomForProject(db, project.id);
  if (existing) {
    return NextResponse.json({ room: { token: existing.token, path: `/play/${existing.token}`, status: existing.status, gameType: existing.gameType }, reused: true });
  }
  const snapshot = project.publishedSnapshot;
  if (!snapshot) {
    return NextResponse.json({ error: "Publish this game first — the share link is made from the published version, so what your friends play is exactly what you approved." }, { status: 400 });
  }
  const picked = pickGame(snapshot);
  if ("error" in picked) return NextResponse.json({ error: picked.error }, { status: 422 });
  const title = typeof (picked.config as { title?: unknown }).title === "string" ? String((picked.config as { title: string }).title) : project.name;
  const room = await createGameRoom(db, {
    projectId: project.id,
    ownerId: found.ownerId,
    ownerEmail: user.email,
    gameType: picked.gameType,
    title,
    snapshot,
    config: picked.config,
  });
  return NextResponse.json({ room: { token: room.token, path: `/play/${room.token}`, status: room.status, gameType: room.gameType }, reused: false });
}
