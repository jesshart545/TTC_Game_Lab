import type { WebResult } from "./web-search";

export type ResearchPurpose = "general" | "fact-check" | "quotes" | "music";
export const researchModes: { id: ResearchPurpose; label: string; placeholder: string; help: string }[] = [
  { id: "general", label: "General web", placeholder: "Search any topic for your LIVE", help: "Search the web freely. Results stay private in this workspace." },
  { id: "fact-check", label: "Trivia / fact-check", placeholder: "Enter a trivia question or claim to check", help: "Compare evidence from different sources. Search snippets and AI analysis are not verified facts." },
  { id: "quotes", label: "Movie quotes", placeholder: "Movie, character, quotation or scene", help: "Find quote references and check attribution against sources." },
  { id: "music", label: "Songs / lyrics", placeholder: "Song, artist, lyrics reference or music clue", help: "Find song information and lyric source links. Finding material does not grant broadcast permission." },
];
export function isResearchPurpose(value: unknown): value is ResearchPurpose {
  return researchModes.some(mode => mode.id === value);
}
export type ResearchAnalysis = {
  verdict: "supported" | "conflicting" | "insufficient" | "overview";
  summary: string;
  findings: { text: string; sourceIds: number[] }[];
  evidence: { sourceId: number; quote: string }[];
  limitation: string;
};
export type ResearchResponse = { analysis: ResearchAnalysis; sources: WebResult[] };
export type ResearchNote = { id: string; title: string; text: string; url?: string; createdAt: number };
export const MAX_RESEARCH_NOTES = 30;

export function researchNotesKey(scope: string) {
  return `ttc-private-research:${encodeURIComponent(scope.slice(0, 240))}`;
}
function safeLink(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 3000) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
export function normalizeResearchNotes(value: unknown): ResearchNote[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const notes: ResearchNote[] = [];
  for (const entry of value.slice(0, MAX_RESEARCH_NOTES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id.trim() || typeof item.text !== "string" || typeof item.title !== "string") continue;
    const id = item.id.slice(0, 120);
    if (ids.has(id)) continue;
    ids.add(id);
    notes.push({ id, title: item.title.slice(0, 160), text: item.text.slice(0, 2000), url: safeLink(item.url), createdAt: typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : Date.now() });
  }
  return notes;
}
export function readResearchNotes(scope: string): { notes: ResearchNote[]; unavailable: boolean } {
  if (typeof window === "undefined") return { notes: [], unavailable: false };
  try {
    const value = window.localStorage.getItem(researchNotesKey(scope));
    return { notes: value ? normalizeResearchNotes(JSON.parse(value)) : [], unavailable: false };
  } catch { return { notes: [], unavailable: true }; }
}
export function writeResearchNotes(scope: string, notes: ResearchNote[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Persist only note fields: never host keys, source evidence tokens or model context.
    window.localStorage.setItem(researchNotesKey(scope), JSON.stringify(normalizeResearchNotes(notes)));
    return true;
  } catch { return false; }
}
