import { NextResponse } from "next/server";
import { requireCreator } from "../../../lib/auth/server";
import { searchYoutube, verifyYoutube } from "../../../lib/youtube-server";
import { youtubeId } from "../../../lib/youtube";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await requireCreator()) return NextResponse.json({ error: "Sign in to use YouTube." }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const region = /^[A-Z]{2}$/.test(params.get("region") || "") ? params.get("region")! : "US";
    if (params.has("video")) {
      const id = youtubeId(params.get("video"));
      if (!id) return NextResponse.json({ error: "Enter a valid YouTube link." }, { status: 400 });
      return NextResponse.json({ video: await verifyYoutube(id, region) }, { headers: { "Cache-Control": "no-store" } });
    }
    const q = (params.get("q") || "").trim();
    if (!q || q.length > 200) return NextResponse.json({ error: "Enter a search from 1 to 200 characters." }, { status: 400 });
    return NextResponse.json({ videos: await searchYoutube(q, region) }, { headers: { "Cache-Control": "no-store" } });
  } catch(error) { return NextResponse.json({ error: error instanceof Error ? error.message : "YouTube request failed." }, { status: 502 }); }
}
