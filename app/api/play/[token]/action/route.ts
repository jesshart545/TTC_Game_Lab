import { NextResponse } from "next/server";
import { applyAction, roomView, type GameAction } from "../../../../../lib/game-room";
import { saveRoom } from "../../../../../lib/game-room-store";
import { loadPlayRoom } from "../helpers";

type Context = { params: Promise<{ token: string }> };

/** One action from one player: ready, start (creator), play-again, or a
 * module action (for bingo: marking a square). The room is ticked first,
 * so the action always lands on state that is current to the second. */
export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  const loaded = await loadPlayRoom(token);
  if ("error" in loaded) return loaded.error;
  let body: { playerId?: unknown; action?: GameAction } = {};
  try { body = await request.json(); } catch { /* the checks below answer it */ }
  const playerId = String(body.playerId ?? "");
  if (!playerId || !loaded.players.some(player => player.id === playerId)) {
    return NextResponse.json({ error: "Join the game first." }, { status: 401 });
  }
  if (!body.action || typeof body.action.type !== "string") {
    return NextResponse.json({ error: "That move didn't come through — try again." }, { status: 400 });
  }
  const error = applyAction(loaded.room, loaded.players, playerId, body.action, Date.now());
  if (error) return NextResponse.json({ error }, { status: 400 });
  await saveRoom(loaded.db, loaded.room, loaded.players);
  return NextResponse.json({ view: roomView(loaded.room, loaded.players, playerId, Date.now()) });
}
