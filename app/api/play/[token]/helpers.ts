import { NextResponse } from "next/server";
import { ensureGameTables, gameDb, loadRoom, saveRoom } from "../../../../lib/game-room-store";
import { tickRoom, type Room, type RoomPlayer } from "../../../../lib/game-room";

/** Shared entry for every /api/play route: the database, the room behind
 * this token with time-based state advanced, persisted when it moved. */
export async function loadPlayRoom(token: string): Promise<
  | { error: NextResponse }
  | { db: NonNullable<ReturnType<typeof gameDb>>; room: Room; players: RoomPlayer[]; ownerEmail: string }
> {
  const db = gameDb();
  if (!db) return { error: NextResponse.json({ error: "Game rooms are unavailable right now." }, { status: 503 }) };
  await ensureGameTables(db);
  const loaded = await loadRoom(db, token);
  if (!loaded) return { error: NextResponse.json({ error: "That game link doesn't lead anywhere — check it and try again." }, { status: 404 }) };
  const now = Date.now();
  if (tickRoom(loaded.room, loaded.players, now)) {
    await saveRoom(db, loaded.room, loaded.players);
  }
  return { db, room: loaded.room, players: loaded.players, ownerEmail: loaded.ownerEmail };
}

/** The signed-in creator, if this request carries their session. The play
 * pages are public (players join by name only), so a missing or broken
 * auth setup simply means "not the creator" — never a failed request. */
export async function sessionUser(): Promise<{ id: string; email: string } | null> {
  try {
    const { requireCreator } = await import("../../../../lib/auth/server");
    const user = await requireCreator();
    return user ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}
