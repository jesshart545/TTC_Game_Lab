import { capMusicWav } from "../../../lib/music-wav";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireCreator, isAdmin } from "../../../lib/auth/server";
import { deleteAssetsByPrefix, getAssetUploadUrl, getAssetUrl, putAsset } from "../../../lib/object-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

export async function POST(request: Request) {
  try {
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const body = await request.json();
      if (body.presign === true) {
        const name = String(body.name || "asset");
        const type = String(body.type || "application/octet-stream");
        const key = `projects/${safeName(String(body.projectId || "unassigned"))}/${crypto.randomUUID()}-${safeName(name)}`;
        return NextResponse.json({ name, type, storageKey: key, uploadUrl: await getAssetUploadUrl(key, type), url: await getAssetUrl(key) });
      }
      const source = new URL(String(body.sourceUrl || ""));
      // Server-side store allowlist — mirrors the server-stored hosts in
      // lib/asset-store.ts (fal.media + the Agnes outputs host). Anything
      // else is rejected: this fetch must never become a general proxy.
      if (source.protocol !== "https:" || source.username || source.password ||
          !(source.hostname === "fal.media" || source.hostname.endsWith(".fal.media") ||
            source.hostname === "platform-outputs.agnes-ai.space" || source.hostname.endsWith(".platform-outputs.agnes-ai.space"))) {
        return NextResponse.json({ error: "Unsupported generated media source." }, { status: 400 });
      }
      const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error("Unable to download generated media.");
      const maximum = 64 * 1024 * 1024;
      if (Number(response.headers.get("content-length") || 0) > maximum) throw new Error("Generated media exceeds the 64 MB limit.");
      let bytes: Uint8Array = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > maximum) throw new Error("Generated media exceeds the 64 MB limit.");
      if (body.durationSeconds != null) bytes = capMusicWav(bytes, Number(body.durationSeconds));
      const name = String(body.name || "Generated media");
      const type = response.headers.get("content-type") || "application/octet-stream";
      const key = `projects/${safeName(String(body.projectId || "unassigned"))}/${crypto.randomUUID()}-${safeName(name)}`;
      await putAsset(key, bytes, type);
      return NextResponse.json({ name, type, storageKey: key, url: await getAssetUrl(key) });
    }
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") || "unassigned");
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });

    const key = `projects/${safeName(projectId)}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await putAsset(key, new Uint8Array(await file.arrayBuffer()), file.type);
    const url = await getAssetUrl(key);
    return NextResponse.json({ name: file.name, type: file.type || "application/octet-stream", storageKey: key, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^projects\/[^/]+\/[^/]+$/.test(key)) return NextResponse.json({ error: "Invalid asset key." }, { status: 400 });
  try { return NextResponse.json({ url: await getAssetUrl(key) }); }
  catch { return NextResponse.json({ error: "Could not refresh the asset URL." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^projects\/[^/]+\/[^/]+$/.test(key)) return NextResponse.json({ error: "Invalid asset key." }, { status: 400 });
  // Deleting stored media is destructive, so — like every other project
  // route — the caller must be signed in and own the project the asset
  // belongs to (the key's second segment is the project id). Admins keep
  // the broader access they have everywhere else. Anything else fails
  // closed and nothing is deleted.
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ configured: false, error: "DATABASE_URL is not configured." }, { status: 503 });
  await db`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Draft', theme TEXT NOT NULL DEFAULT 'cyan', prompt TEXT NOT NULL DEFAULT '', data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  const projectId = key.split("/")[1];
  const rows = isAdmin(user)
    ? await db`SELECT id, owner_id FROM projects WHERE id = ${projectId} LIMIT 1`
    : await db`SELECT id, owner_id FROM projects WHERE id = ${projectId} AND owner_id = ${user.id} LIMIT 1`;
  if (!rows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  try { const deleted = await deleteAssetsByPrefix(key); return NextResponse.json({ deleted }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Asset delete failed." }, { status: 500 }); }
}
