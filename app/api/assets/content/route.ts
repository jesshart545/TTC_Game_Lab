import { NextResponse } from "next/server";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { getDb } from "../../../../lib/db";
import { getAssetUrl } from "../../../../lib/object-storage";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({error:"Unauthorized."},{status:401});
  const key = new URL(request.url).searchParams.get("key") || "";
  const match = /^projects\/([^/]+)\/[^/]+$/.exec(key);
  if (!match) return NextResponse.json({error:"Invalid asset."},{status:400});
  const db = getDb();
  if (!db) return NextResponse.json({error:"Storage unavailable."},{status:503});
  const rows = await db`SELECT data, owner_id FROM projects WHERE id = ${match[1]} LIMIT 1`;
  const row = rows[0];
  if (!row || (!isAdmin(user) && row.owner_id !== user.id) || !row.data?.assets?.some((asset:{storageKey?:string})=>asset.storageKey===key)) return NextResponse.json({error:"Asset not found."},{status:404});
  const source = await fetch(await getAssetUrl(key),{cache:"no-store"});
  if (!source.ok) return NextResponse.json({error:"Media could not be loaded."},{status:502});
  return new Response(source.body,{headers:{"Content-Type":source.headers.get("content-type") || "application/octet-stream","Cache-Control":"private, no-store"}});
}
