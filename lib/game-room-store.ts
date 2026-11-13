// Persistence for Game Night rooms (Off-Stream Multiplayer Game Night).
//
// Follows the repo's own convention: tables are created lazily with
// CREATE TABLE IF NOT EXISTS wherever they are used (the same DDL also
// lives in db/schema.sql). A room row freezes the game's published
// snapshot at share time; the room's state JSONB is the server-
// authoritative game state, advanced by lib/game-room.ts on every
// request. Players join by name only — a game_players row is their seat.

import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db";
import { newRoomState, type Room, type RoomPlayer, type RoomStatus } from "./game-room";

type Db = NonNullable<ReturnType<typeof getDb>>;

export function gameDb(): Db | null {
  return getDb();
}

export async function ensureGameTables(db: Db) {
  await db`CREATE TABLE IF NOT EXISTS game_rooms (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL,
    owner_id TEXT NOT NULL DEFAULT '',
    owner_email TEXT NOT NULL DEFAULT '',
    game_type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'lobby',
    round INTEGER NOT NULL DEFAULT 1,
    countdown_ends_at BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS game_rooms_project_idx ON game_rooms (project_id, created_at DESC)`;
  await db`CREATE TABLE IF NOT EXISTS game_players (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_creator BOOLEAN NOT NULL DEFAULT FALSE,
    ready BOOLEAN NOT NULL DEFAULT FALSE,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS game_players_room_idx ON game_players (room_id, joined_at)`;
}

type RoomRow = {
  id: string; token: string; project_id: string; owner_id: string; owner_email: string;
  game_type: string; title: string; snapshot: unknown; config: unknown; state: unknown;
  status: string; round: number; countdown_ends_at: number | string | null; created_at: string | Date;
};

type PlayerRow = {
  id: string; room_id: string; name: string; is_creator: boolean; ready: boolean;
  state: unknown; joined_at: string | Date;
};

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    token: row.token,
    projectId: row.project_id,
    ownerId: row.owner_id || "",
    gameType: row.game_type,
    title: row.title || "",
    status: (row.status || "lobby") as RoomStatus,
    snapshot: row.snapshot,
    config: (row.config || {}) as Record<string, unknown>,
    state: (row.state || {}) as Record<string, unknown>,
    countdownEndsAt: row.countdown_ends_at === null || row.countdown_ends_at === undefined ? null : Number(row.countdown_ends_at),
    round: Number(row.round) || 1,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function toPlayer(row: PlayerRow): RoomPlayer {
  return {
    id: row.id,
    name: row.name,
    isCreator: !!row.is_creator,
    ready: !!row.ready,
    joinedAt: new Date(row.joined_at).getTime(),
    state: (row.state || {}) as Record<string, unknown>,
  };
}

export async function createGameRoom(db: Db, input: {
  projectId: string;
  ownerId: string;
  ownerEmail: string;
  gameType: string;
  title: string;
  snapshot: unknown;
  config: Record<string, unknown>;
}): Promise<Room> {
  const base = newRoomState(input.gameType, input.config);
  const room: Room = {
    id: randomUUID(),
    token: randomBytes(24).toString("hex"),
    projectId: input.projectId,
    ownerId: input.ownerId,
    gameType: input.gameType,
    title: input.title,
    status: base.status,
    snapshot: input.snapshot,
    config: input.config,
    state: base.state,
    countdownEndsAt: base.countdownEndsAt,
    round: base.round,
    createdAt: Date.now(),
  };
  await db`INSERT INTO game_rooms (id, token, project_id, owner_id, owner_email, game_type, title, snapshot, config, state, status, round, countdown_ends_at)
    VALUES (${room.id}, ${room.token}, ${room.projectId}, ${room.ownerId}, ${input.ownerEmail}, ${room.gameType}, ${room.title}, ${JSON.stringify(room.snapshot)}::jsonb, ${JSON.stringify(room.config)}::jsonb, ${JSON.stringify(room.state)}::jsonb, ${room.status}, ${room.round}, ${room.countdownEndsAt})`;
  return room;
}

/** The room a project's Share button reuses: the newest one for the project. */
export async function findRoomForProject(db: Db, projectId: string): Promise<Room | null> {
  const rows = await db`SELECT * FROM game_rooms WHERE project_id = ${projectId} ORDER BY created_at DESC LIMIT 1` as RoomRow[];
  return rows.length ? toRoom(rows[0]) : null;
}

export async function loadRoom(db: Db, token: string): Promise<{ room: Room; players: RoomPlayer[]; ownerEmail: string } | null> {
  const rows = await db`SELECT * FROM game_rooms WHERE token = ${token} LIMIT 1` as RoomRow[];
  if (!rows.length) return null;
  const room = toRoom(rows[0]);
  const playerRows = await db`SELECT * FROM game_players WHERE room_id = ${room.id} ORDER BY joined_at, name` as PlayerRow[];
  return { room, players: playerRows.map(toPlayer), ownerEmail: rows[0].owner_email || "" };
}

export async function insertPlayer(db: Db, roomId: string, player: RoomPlayer) {
  await db`INSERT INTO game_players (id, room_id, name, is_creator, ready, state)
    VALUES (${player.id}, ${roomId}, ${player.name}, ${player.isCreator}, ${player.ready}, ${JSON.stringify(player.state)}::jsonb)
    ON CONFLICT (id) DO NOTHING`;
}

/** Persist the room's mutable fields and every player's mutable fields. */
export async function saveRoom(db: Db, room: Room, players: RoomPlayer[]) {
  await db`UPDATE game_rooms SET state = ${JSON.stringify(room.state)}::jsonb, status = ${room.status}, round = ${room.round}, countdown_ends_at = ${room.countdownEndsAt} WHERE id = ${room.id}`;
  for (const player of players) {
    await db`UPDATE game_players SET is_creator = ${player.isCreator}, ready = ${player.ready}, state = ${JSON.stringify(player.state)}::jsonb WHERE id = ${player.id}`;
  }
}
