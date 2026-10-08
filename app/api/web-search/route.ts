import { NextResponse } from "next/server";
import { webResults } from "../../../lib/web-search";
import { researchAccess, researchLimit, signResearchSource } from "../../../lib/web-research-server";

export const maxDuration = 30;
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const q = typeof body?.q === "string" ? body.q.trim() : "";
  if (!q || q.length > 200) return NextResponse.json({ error: "Enter a search from 1 to 200 characters." }, { status: 400 });
  try {
    const access = await researchAccess(request, body.slug);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    const base = process.env.SEARCH_INTERNAL_URL;
    const serviceKey = process.env.SEARCH_SERVICE_KEY;
    if (!base || !serviceKey) return NextResponse.json({ error: "Embedded search is not available in this deployment yet." }, { status: 503 });
    if (!await researchLimit(access, "search")) return NextResponse.json({ error: "Please wait a minute before searching again." }, { status: 429, headers: { "Retry-After": "60" } });
    const url = new URL("/search", base);
    url.search = new URLSearchParams({ q, format: "json", categories: "general", language: "en-US", safesearch: "1" }).toString();
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(18000), headers: { Accept: "application/json", "x-search-service-key": serviceKey } });
    if (!response.ok) throw new Error(`Search provider returned ${response.status}`);
    const data = await response.json();
    const results = webResults(data.results);
    if (!results.length && data.unresponsive_engines?.length) throw new Error("Search engines unavailable");
    return NextResponse.json({ results: results.map(source => signResearchSource(source, access.identity, serviceKey)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Web search request failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Search is temporarily unavailable. Your previous results are still here; try again shortly." }, { status: 502 });
  }
}
