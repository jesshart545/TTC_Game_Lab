import { createHmac, timingSafeEqual } from "node:crypto";
import { requireCreator } from "./auth/server";
import { getDb } from "./db";
import { validLiveHost } from "./youtube-server";
import type { WebResult } from "./web-search";
import type { ResearchAnalysis, ResearchPurpose } from "./web-research";

type Access = { ok: true; identity: string; db: NonNullable<ReturnType<typeof getDb>> } | { ok: false; status: number; error: string };
export async function researchAccess(request: Request, slug: unknown): Promise<Access> {
  const db = getDb();
  if (!db) return { ok: false, status: 503, error: "Research is temporarily unavailable." };
  const key = request.headers.get("x-host-key");
  if (key) {
    if (typeof slug !== "string" || !slug || slug.length > 200) return { ok: false, status: 401, error: "Open your private host dashboard to research." };
    const rows = await db`SELECT id FROM projects WHERE slug=${slug} LIMIT 1`;
    if (rows[0] && await validLiveHost(db, String(rows[0].id), key)) return { ok: true, db, identity: `host:${rows[0].id}` };
    return { ok: false, status: 401, error: "Open your private host dashboard to research." };
  }
  const user = await requireCreator();
  return user ? { ok: true, db, identity: `user:${user.id}` } : { ok: false, status: 401, error: "Sign in or open your private dashboard to research." };
}
export async function researchLimit(access: Extract<Access, { ok: true }>, bucket: "search" | "analysis"): Promise<boolean> {
  const db = access.db;
  const identity = bucket === "search" ? access.identity : `${access.identity}:analysis`;
  const windowStart = Math.floor(Date.now() / 60000) * 60000;
  await db`CREATE TABLE IF NOT EXISTS web_search_limits (identity TEXT PRIMARY KEY, window_start BIGINT NOT NULL, count INTEGER NOT NULL)`;
  const rows = await db`INSERT INTO web_search_limits (identity,window_start,count) VALUES (${identity},${windowStart},1) ON CONFLICT (identity) DO UPDATE SET count=CASE WHEN web_search_limits.window_start=${windowStart} THEN web_search_limits.count+1 ELSE 1 END, window_start=${windowStart} RETURNING count`;
  return Number(rows[0]?.count) <= (bucket === "search" ? 20 : 5);
}
function evidenceMac(source: WebResult, identity: string, issued: number, secret: string) {
  return createHmac("sha256", secret).update("ttc-research-evidence-v1:").update(JSON.stringify([identity, issued, source.title, source.url, source.summary])).digest("hex");
}
export function signResearchSource(source: WebResult, identity: string, secret: string, now = Date.now()): WebResult {
  return { ...source, evidenceToken: `${now}.${evidenceMac(source, identity, now, secret)}` };
}
export function checkedResearchSources(value: unknown, identity: string, secret: string, now = Date.now()): WebResult[] {
  if (!secret || !Array.isArray(value) || value.length < 1 || value.length > 6) throw new Error("Select between one and six current search results.");
  const sources: WebResult[] = [];
  const found = new Set<string>();
  for (const item of value) {
    const raw = item && typeof item === "object" ? item as Record<string, unknown> : {};
    if (typeof raw.title !== "string" || !raw.title || raw.title.length > 300 || typeof raw.url !== "string" || raw.url.length > 4000 || typeof raw.summary !== "string" || raw.summary.length > 1800) throw new Error("Search again to use authenticated, current source excerpts.");
    const url = new URL(raw.url);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hash || url.href !== raw.url) throw new Error("The source link was not an authenticated search result.");
    const source: WebResult = { title: raw.title, url: raw.url, summary: raw.summary };
    const token = raw.evidenceToken;
    if (!source || found.has(source.url) || typeof token !== "string" || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) throw new Error("Search again to use authenticated, current source excerpts.");
    const [issuedText, signature] = token.split(".");
    const issued = Number(issuedText);
    if (issued > now + 60000 || now - issued > 3600000 || !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(evidenceMac(source, identity, issued, secret), "hex"))) throw new Error("Search again to use authenticated, current source excerpts.");
    found.add(source.url);
    sources.push(source); // Model and response get actual source fields, never client tokens or host keys.
  }
  return sources;
}
export function distinctResearchDomains(sources: WebResult[]): number {
  return new Set(sources.map(source => new URL(source.url).hostname.toLowerCase().replace(/^www\./, ""))).size;
}
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";
}
function sourceIds(value: unknown, sources: WebResult[]): number[] {
  if (!Array.isArray(value) || !value.length || value.length > sources.length || value.some(id => !Number.isInteger(id) || id < 0 || id >= sources.length)) throw new Error("The explanation referenced unavailable sources.");
  return Array.from(new Set(value as number[]));
}
export function checkedResearchAnalysis(value: unknown, sources: WebResult[], purpose: ResearchPurpose): ResearchAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The evidence explanation was incomplete.");
  const raw = value as Record<string, unknown>;
  if (!["supported", "conflicting", "insufficient", "overview"].includes(String(raw.verdict))) throw new Error("The evidence verdict was incomplete.");
  const summary = text(raw.summary, 900);
  if (!summary || !Array.isArray(raw.findings) || raw.findings.length > 6 || !Array.isArray(raw.evidence) || raw.evidence.length > 8) throw new Error("The evidence explanation was incomplete.");
  const evidence = raw.evidence.map(entry => {
    if (!entry || typeof entry !== "object") throw new Error("A supporting excerpt was missing.");
    const quote = typeof entry.quote === "string" ? entry.quote.trim() : "";
    if (!Number.isInteger(entry.sourceId) || entry.sourceId < 0 || entry.sourceId >= sources.length || !quote || quote.length > 90 || !sources[entry.sourceId].summary.includes(quote)) throw new Error("The explanation's supporting quote was not in its source excerpt.");
    return { sourceId: entry.sourceId as number, quote };
  });
  const findings = raw.findings.map(entry => {
    if (!entry || typeof entry !== "object") throw new Error("A research finding was missing.");
    const finding = text(entry.text, 450);
    const ids = sourceIds(entry.sourceIds, sources);
    if (!finding || (purpose !== "music" && ids.some(id => !evidence.some(quote => quote.sourceId === id)))) throw new Error("A research finding lacked a matching source excerpt.");
    return { text: finding, sourceIds: ids };
  });
  const verdict = raw.verdict as ResearchAnalysis["verdict"];
  if ((verdict === "supported" || verdict === "conflicting") && (!findings.length || !evidence.length)) throw new Error("The evidence verdict lacked source support.");
  if (verdict === "conflicting" && new Set(evidence.map(entry => entry.sourceId)).size < 2) throw new Error("Conflicting evidence needs more than one source.");
  if (purpose === "fact-check" && (verdict === "supported" || verdict === "conflicting") && distinctResearchDomains(sources) < 2) throw new Error("A fact check needs sources from different domains.");
  if (purpose === "music" && (evidence.length || !["overview", "insufficient"].includes(verdict))) throw new Error("Song and lyric research uses source links and metadata, not reproduced lyric excerpts.");
  return { verdict, summary, findings, evidence, limitation: text(raw.limitation, 600) || "This analyzes search snippets, not full pages. Check the original sources before using a claim live. Different sites can repeat the same original report." };
}
