import { NextResponse } from "next/server";
import { requireCreator, isAdmin } from "../../../../lib/auth/server";
import { getDb } from "../../../../lib/db";
import { getAssetUrl } from "../../../../lib/object-storage";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await requireCreator();
  if (!user) return NextResponse.json({error:"Unauthorized."},{status:401});
  const params = new URL(request.url).searchParams;
  const key = params.get("key") || "";
  const match = /^projects\/([^/]+)\/[^/]+$/.exec(key);
  if (!match) return NextResponse.json({error:"Invalid asset."},{status:400});
  const db = getDb();
  if (!db) return NextResponse.json({error:"Storage unavailable."},{status:503});
  const rows = await db`SELECT data, owner_id FROM projects WHERE id = ${match[1]} LIMIT 1`;
  const row = rows[0];
  if (!row || (!isAdmin(user) && row.owner_id !== user.id) || !row.data?.assets?.some((asset:{storageKey?:string})=>asset.storageKey===key)) return NextResponse.json({error:"Asset not found."},{status:404});
  const source = await fetch(await getAssetUrl(key),{cache:"no-store"});
  if (!source.ok) return NextResponse.json({error:"Media could not be loaded."},{status:502});
  const headers: Record<string, string> = {"Content-Type":source.headers.get("content-type") || "application/octet-stream","Cache-Control":"private, no-store"};
  const length = source.headers.get("content-length");
  if (length) headers["Content-Length"] = length;
  if (params.get("download") === "1") {
    // Save-to-device: same-origin attachment response, so the browser saves
    // the file instead of playing or previewing it.
    let fileName = (params.get("name") || key.split("/").pop() || "asset").replace(/["\\\r\n]/g, "").slice(0, 120) || "asset";
    const keyExt = key.match(/\.([a-z0-9]+)$/i)?.[1];
    if (keyExt && !/\.[a-z0-9]+$/i.test(fileName)) fileName = `${fileName}.${keyExt}`;
    headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
    // A streamed body with a forwarded Content-Length aborts the download if
    // the byte counts ever disagree; attachment responses stream chunked.
    delete headers["Content-Length"];
  }
  return new Response(source.body,{headers});
}
