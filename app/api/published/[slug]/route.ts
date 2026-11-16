import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getAssetUrl } from "../../../../lib/object-storage";
import type { Project } from "../../../../lib/project";
import { convertPrizeWheelTools } from "../../../../lib/game-tools";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Published project unavailable." }, { status: 503 });
  await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  // A trashed project is unpublished while it sits in Trash; restoring it
  // from Trash brings the published page back.
  const rows = await db`SELECT data FROM projects WHERE slug = ${slug} AND deleted_at IS NULL LIMIT 1`;
  const storedSnapshot = (rows[0]?.data as Project | undefined)?.publishedSnapshot;
  if (!storedSnapshot) return NextResponse.json({ error: "Project not published." }, { status: 404 });
  // A snapshot saved before the second wheel's removal can still
  // hold one: it serves as the selector wheel it converts to
  // (lib/game-tools convertPrizeWheelTools), never as a dead tool.
  const snapshot = convertPrizeWheelTools(storedSnapshot as Project);
  const gameTools = (snapshot.gameTools || []).filter(tool => tool.enabled && (tool.inToolbox || tool.inOverlayBuild));
  const compositions = (snapshot.compositions || []).filter(comp => comp.inProject);
  const referenced = JSON.stringify({ gameTools, compositions, controls: snapshot.controls });
  const assets = await Promise.all((snapshot.assets || []).filter(asset => asset.inProject || asset.inOverlayBuild || referenced.includes(asset.storageKey || asset.name)).map(async asset => ({
    ...asset, url: asset.storageKey?.startsWith("projects/") ? await getAssetUrl(asset.storageKey) : asset.url,
  })));
  const project = {
    id: snapshot.id, name: snapshot.name, slug: snapshot.slug, description: snapshot.description,
    status: "Published", theme: snapshot.theme, updatedAt: snapshot.updatedAt,
    prompt: "", messages: [], controls: snapshot.controls, overlay: snapshot.overlay,
    wheel: snapshot.wheel, gameTools, compositions, assets,
  };
  return NextResponse.json({ project }, { headers: { "Cache-Control": "no-store" } });
}
