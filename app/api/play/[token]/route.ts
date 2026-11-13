import { NextResponse } from "next/server";
import { roomView } from "../../../../lib/game-room";
import { loadPlayRoom } from "./helpers";

type Context = { params: Promise<{ token: string }> };

/** The ~1s poll every player's screen runs on: current room state,
 * advanced by the time since the last look. */
export async function GET(request: Request, context: Context) {
  const { token } = await context.params;
  const loaded = await loadPlayRoom(token);
  if ("error" in loaded) return loaded.error;
  const playerId = new URL(request.url).searchParams.get("player");
  return NextResponse.json({ view: roomView(loaded.room, loaded.players, playerId, Date.now()) });
}
