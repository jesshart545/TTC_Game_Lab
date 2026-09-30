import { NextResponse } from "next/server";

// Read only the existing public published snapshot, never the creator's draft.
export async function GET() {
  try {
    const response = await fetch("https://www.ttcgamelab.com/api/published/new-live-experience-b554b", { cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Reference project unavailable." }, { status: 503 });
    const data = await response.json();
    if (!data.project) return NextResponse.json({ error: "Reference project unavailable." }, { status: 503 });
    return NextResponse.json({ project: data.project }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Reference project unavailable." }, { status: 503 });
  }
}
