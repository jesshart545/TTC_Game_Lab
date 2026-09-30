import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getAssetUrl } from "../../../../lib/object-storage";
import type { Project } from "../../../../lib/project";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Published project unavailable." }, { status: 503 });
  const rows = await db`SELECT data FROM projects WHERE slug = ${slug} LIMIT 1`;
  const snapshot = (rows[0]?.data as Project | undefined)?.publishedSnapshot;
  if (!snapshot) return NextResponse.json({ error: "Project not published." }, { status: 404 });
  const gameTools = (snapshot.gameTools || []).filter(tool => tool.enabled && (tool.inToolbox || tool.inOverlayBuild));
  const compositions = (snapshot.compositions || []).filter(comp => comp.inProject);
  const referenced = JSON.stringify({ gameTools, compositions, controls: snapshot.controls });
  const assets = await Promise.all((snapshot.assets || []).filter(asset => asset.inProject || referenced.includes(asset.storageKey || asset.name)).map(async asset => ({
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
