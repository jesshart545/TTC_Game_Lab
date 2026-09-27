import { NextResponse } from "next/server";
import { deleteAssetsByPrefix, getAssetUrl, putAsset } from "../../../lib/object-storage";
import { getDb } from "../../../lib/db";
import { requireCreator, isAdmin } from "../../../lib/auth/server";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}
function projectFromKey(key: string) {
  const match = /^projects\/([^/]+)\/[^/]+$/.exec(key);
  return match?.[1] || "";
}
async function canUseProject(projectId: string, user: { id: string; email: string; role: string }, claim = false) {
  const db = getDb();
  if (!db) return false;
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT`;
  await db`CREATE TABLE IF NOT EXISTS project_asset_owners (project_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL)`;
  if (isAdmin(user)) return true;
  const project = await db`SELECT owner_id FROM projects WHERE id = ${projectId} LIMIT 1`;
  if (project.length) return project[0].owner_id === user.id;
  const assetOwner = await db`SELECT owner_id FROM project_asset_owners WHERE project_id = ${projectId} LIMIT 1`;
  if (assetOwner.length) return assetOwner[0].owner_id === user.id;
  if (!claim) return false;
  await db`INSERT INTO project_asset_owners (project_id, owner_id) VALUES (${projectId}, ${user.id}) ON CONFLICT (project_id) DO NOTHING`;
  const claimed = await db`SELECT owner_id FROM project_asset_owners WHERE project_id = ${projectId} LIMIT 1`;
  return claimed[0]?.owner_id === user.id;
}

export async function POST(request: Request) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const projectId = safeName(String(form.get("projectId") || ""));
    if (!projectId) return NextResponse.json({ error: "A project is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
    if (!(await canUseProject(projectId, user, true))) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const key = `projects/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await putAsset(key, new Uint8Array(await file.arrayBuffer()), file.type);
    const url = await getAssetUrl(key);
    return NextResponse.json({ name: file.name, type: file.type || "application/octet-stream", storageKey: key, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") || "";
  const projectId = projectFromKey(key);
  if (!projectId) return NextResponse.json({ error: "Invalid asset key." }, { status: 400 });
  if (!(await canUseProject(projectId, user))) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  try { return NextResponse.json({ url: await getAssetUrl(key) }); }
  catch { return NextResponse.json({ error: "Could not refresh the asset URL." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") || "";
  const projectId = projectFromKey(key);
  if (!projectId) return NextResponse.json({ error: "Invalid asset key." }, { status: 400 });
  if (!(await canUseProject(projectId, user))) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  try { const deleted = await deleteAssetsByPrefix(key); return NextResponse.json({ deleted }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Asset delete failed." }, { status: 500 }); }
}
