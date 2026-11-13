import { NextResponse } from "next/server";
import { joinPlayer, roomView } from "../../../../../lib/game-room";
import { insertPlayer, saveRoom } from "../../../../../lib/game-room-store";
import { loadPlayRoom, sessionUser } from "../helpers";

type Context = { params: Promise<{ token: string }> };

/** Join by name only — no account, no sign-in. A request that happens to
 * carry the creator's session flags that player as the creator (still a
 * player: same screens, same actions, just able to press Start). */
export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  const loaded = await loadPlayRoom(token);
  if ("error" in loaded) return loaded.error;
  let body: { name?: unknown } = {};
  try { body = await request.json(); } catch { /* handled by the name check */ }
  const user = await sessionUser();
  const isCreator = !!user && (user.id === loaded.room.ownerId || (!!user.email && user.email.toLowerCase() === loaded.ownerEmail.toLowerCase()));
  const result = joinPlayer(loaded.room, loaded.players, { name: String(body.name ?? ""), isCreator }, Date.now());
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  if (result.joined) {
    await insertPlayer(loaded.db, loaded.room.id, result.player);
  } else if (result.player.isCreator) {
    await saveRoom(loaded.db, loaded.room, loaded.players);
  }
  return NextResponse.json({
    playerId: result.player.id,
    view: roomView(loaded.room, loaded.players, result.player.id, Date.now()),
  });
}
