"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { WebResult } from "../lib/web-search";
import {
  MAX_RESEARCH_NOTES,
  readResearchNotes,
  researchModes,
  type ResearchNote,
  type ResearchPurpose,
  type ResearchResponse,
  writeResearchNotes,
} from "../lib/web-research";

type SavePool = (name: string, results: WebResult[]) => void;

type AnalysisState = {
  response: ResearchResponse;
  query: string;
  purpose: ResearchPurpose;
  urls: string[];
};

export type WebResearchWorkspaceProps = {
  slug?: string;
  hostKey?: string;
  projectId?: string;
  docked?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onSavePool?: SavePool;
};

const MAX_QUERY_LENGTH = 200;
const MAX_POOL_NAME_LENGTH = 100;
const MAX_NOTE_TITLE_LENGTH = 160;
const MAX_NOTE_TEXT_LENGTH = 2000;
const MAX_NOTE_URL_LENGTH = 3000;

function domainFor(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Source link"; }
}

function urlsMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((url, index) => url === right[index]);
}

function safeResponse(value: unknown): ResearchResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { analysis?: unknown; sources?: unknown };
  if (!Array.isArray(candidate.sources) || !candidate.analysis || typeof candidate.analysis !== "object") return null;
  const analysis = candidate.analysis as Record<string, unknown>;
  if (![
    "supported", "conflicting", "insufficient", "overview",
  ].includes(String(analysis.verdict)) || typeof analysis.summary !== "string" || typeof analysis.limitation !== "string") return null;
  if (!Array.isArray(analysis.findings) || !Array.isArray(analysis.evidence)) return null;
  const sources: WebResult[] = [];
  for (const source of candidate.sources) {
    if (!source || typeof source !== "object") return null;
    const item = source as Record<string, unknown>;
    if (typeof item.title !== "string" || typeof item.url !== "string" || typeof item.summary !== "string") return null;
    sources.push({ title: item.title, url: item.url, summary: item.summary });
  }
  const findings = analysis.findings.flatMap((finding) => {
    if (!finding || typeof finding !== "object") return [];
    const item = finding as Record<string, unknown>;
    if (typeof item.text !== "string" || !Array.isArray(item.sourceIds) || !item.sourceIds.every((id) => Number.isInteger(id))) return [];
    return [{ text: item.text, sourceIds: item.sourceIds as number[] }];
  });
  const evidence = analysis.evidence.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const evidenceItem = item as Record<string, unknown>;
    if (!Number.isInteger(evidenceItem.sourceId) || typeof evidenceItem.quote !== "string") return [];
    return [{ sourceId: evidenceItem.sourceId as number, quote: evidenceItem.quote }];
  });
  return {
    sources,
    analysis: {
      verdict: analysis.verdict as ResearchResponse["analysis"]["verdict"],
      summary: analysis.summary,
      findings,
      evidence,
      limitation: analysis.limitation,
    },
  };
}

function verdictLabel(verdict: ResearchResponse["analysis"]["verdict"]) {
  if (verdict === "supported") return "Evidence supports";
  if (verdict === "conflicting") return "Conflicting evidence";
  if (verdict === "insufficient") return "Insufficient evidence";
  return "Source overview";
}

function makeNoteId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `research-note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function WebResearchWorkspace(props: WebResearchWorkspaceProps) {
  const scope = props.slug ? `live:${props.slug}` : `draft:${props.projectId || "workspace"}`;
  return <ResearchWorkspaceInstance key={scope} {...props} />;
}

function ResearchWorkspaceInstance({
  slug,
  hostKey,
  projectId,
  docked = false,
  isOpen = true,
  onClose,
  onSavePool,
}: WebResearchWorkspaceProps) {
  const scope = slug ? `live:${slug}` : `draft:${projectId || "workspace"}`;
  const visibleRef = useRef(isOpen);
  visibleRef.current = isOpen;
  const searchController = useRef<AbortController | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const searchRequest = useRef(0);
  const analysisRequest = useRef(0);
  const queryInput = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ResearchPurpose>("general");
  const [results, setResults] = useState<WebResult[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [expandedUrls, setExpandedUrls] = useState<string[]>([]);
  const [lastSuccessfulQuery, setLastSuccessfulQuery] = useState("");
  const [lastSuccessfulMode, setLastSuccessfulMode] = useState<ResearchPurpose>("general");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [poolName, setPoolName] = useState("");
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolMessage, setPoolMessage] = useState("");
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [notesUnavailable, setNotesUnavailable] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteUrl, setNoteUrl] = useState("");

  const selectedResults = useMemo(
    () => results.filter((result) => selectedUrls.includes(result.url)),
    [results, selectedUrls],
  );
  const selectedResultUrls = useMemo(() => selectedResults.map((result) => result.url), [selectedResults]);
  const activeMode = researchModes.find((item) => item.id === mode) || researchModes[0];
  const analysisIsCurrent = Boolean(
    analysis
      && analysis.query === lastSuccessfulQuery
      && query.trim() === lastSuccessfulQuery
      && analysis.purpose === mode
      && mode === lastSuccessfulMode
      && urlsMatch(analysis.urls, selectedResultUrls),
  );

  function stopAnalysis() {
    analysisRequest.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalysisBusy(false);
    setAnalysis(null);
  }

  function invalidateEvidence() {
    stopAnalysis();
    setAnalysisError("");
  }

  useEffect(() => {
    searchRequest.current += 1;
    searchController.current?.abort();
    searchController.current = null;
    setSearchBusy(false);
    setSearchError("");
    setQuery("");
    setMode("general");
    setResults([]);
    setSelectedUrls([]);
    setExpandedUrls([]);
    setLastSuccessfulQuery("");
    setLastSuccessfulMode("general");
    invalidateEvidence();
    setPoolName("");
    setPoolMessage("");
    const loaded = readResearchNotes(scope);
    setNotes(loaded.notes);
    setNotesUnavailable(loaded.unavailable);
    setNoteMessage(loaded.unavailable ? "Browser storage is unavailable or unreadable. Notes remain usable for this session only." : "");
    setNoteTitle("");
    setNoteText("");
    setNoteUrl("");
  }, [scope]);

  useEffect(() => {
    if (!docked || isOpen) return;
    searchRequest.current += 1;
    searchController.current?.abort();
    searchController.current = null;
    analysisRequest.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    setSearchBusy(false);
    setAnalysisBusy(false);
  }, [docked, isOpen]);

  useEffect(() => {
    if (!docked || !isOpen) return;
    const timer = window.setTimeout(() => queryInput.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [docked, isOpen]);

  useEffect(() => {
    if (!docked || !isOpen || !onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [docked, isOpen, onClose]);

  useEffect(() => () => {
    searchController.current?.abort();
    analysisController.current?.abort();
  }, []);

  function persistNotes(next: ResearchNote[]) {
    setNotes(next);
    if (!writeResearchNotes(scope, next)) {
      setNotesUnavailable(true);
      setNoteMessage("Browser storage is unavailable. Your current notes stay in this session, but are not saved across refreshes.");
    } else {
      setNoteMessage("Saved privately in this browser.");
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    searchRequest.current += 1;
    const requestId = searchRequest.current;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    invalidateEvidence();
    setSearchBusy(true);
    setSearchError("");
    setPoolMessage("");
    try {
      const response = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(hostKey ? { "x-host-key": hostKey } : {}) },
        body: JSON.stringify({ q, slug }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Search is temporarily unavailable.");
      if (searchRequest.current !== requestId || controller.signal.aborted || !visibleRef.current) return;
      const nextResults = Array.isArray(data?.results) ? data.results as WebResult[] : [];
      setResults(nextResults);
      setSelectedUrls([]);
      setExpandedUrls([]);
      setLastSuccessfulQuery(q);
      setLastSuccessfulMode(mode);
      if (!nextResults.length) setSearchError("No results found. Try a different search.");
    } catch (error) {
      if (!controller.signal.aborted && searchRequest.current === requestId && visibleRef.current) {
        setSearchError(error instanceof Error ? error.message : "Search is temporarily unavailable.");
      }
    } finally {
      if (searchRequest.current === requestId) setSearchBusy(false);
    }
  }

  function updateQuery(value: string) {
    setQuery(value);
    invalidateEvidence();
  }

  function changeMode(nextMode: ResearchPurpose) {
    if (nextMode === mode) return;
    setMode(nextMode);
    invalidateEvidence();
  }

  function toggleResult(url: string) {
    setSelectedUrls((current) => current.includes(url) ? current.filter((item) => item !== url) : [...current, url]);
    invalidateEvidence();
    setPoolMessage("");
  }

  function toggleExcerpt(url: string) {
    setExpandedUrls((current) => current.includes(url) ? current.filter((item) => item !== url) : [...current, url]);
  }

  function analysisRequirement() {
    if (!lastSuccessfulQuery) return "Search the web before requesting an evidence explanation.";
    if (query.trim() !== lastSuccessfulQuery) return "Search the current query before requesting an evidence explanation.";
    if (mode !== lastSuccessfulMode) return "Search again after changing the research mode.";
    if (selectedResults.length > 6) return "Evidence explanations accept up to 6 selected sources. Your wider selection remains available for comparison or a pool.";
    if (mode === "fact-check" && selectedResults.length < 2) return "Fact-check explanations need at least 2 selected sources to compare.";
    if (mode !== "fact-check" && selectedResults.length < 1) return "Select at least 1 source before requesting an evidence explanation.";
    return "";
  }

  async function explainEvidence() {
    const requirement = analysisRequirement();
    if (requirement) return;
    analysisRequest.current += 1;
    const requestId = analysisRequest.current;
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    setAnalysis(null);
    setAnalysisBusy(true);
    setAnalysisError("");
    try {
      const response = await fetch("/api/web-research", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(hostKey ? { "x-host-key": hostKey } : {}) },
        body: JSON.stringify({ q: lastSuccessfulQuery, purpose: lastSuccessfulMode, sources: selectedResults, slug }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Evidence explanation is temporarily unavailable.");
      const parsed = safeResponse(data);
      if (!parsed) throw new Error("Evidence explanation returned an unavailable response. You can still compare the search snippets manually.");
      if (analysisRequest.current !== requestId || controller.signal.aborted || !visibleRef.current) return;
      const urls = selectedResults.map((result) => result.url);
      setAnalysis({ response: parsed, query: lastSuccessfulQuery, purpose: lastSuccessfulMode, urls });
    } catch (error) {
      if (!controller.signal.aborted && analysisRequest.current === requestId && visibleRef.current) {
        setAnalysisError(error instanceof Error ? error.message : "Evidence explanation is temporarily unavailable. You can still compare the search snippets manually.");
      }
    } finally {
      if (analysisRequest.current === requestId) setAnalysisBusy(false);
    }
  }

  async function savePool() {
    if (!onSavePool || !poolName.trim() || !selectedResults.length) return;
    setPoolBusy(true);
    setPoolMessage("");
    try {
      await onSavePool(poolName.trim(), selectedResults);
      setPoolMessage("Added to your draft pool. Open it in Workshop to create cards when ready.");
      setPoolName("");
      setSelectedUrls([]);
      invalidateEvidence();
    } catch (error) {
      setPoolMessage(error instanceof Error ? error.message : "The pool could not be saved. Your selected results are still available.");
    } finally {
      setPoolBusy(false);
    }
  }

  function saveNewNote() {
    const text = noteText.trim();
    const title = noteTitle.trim();
    if (!text && !title) return;
    if (notes.length >= MAX_RESEARCH_NOTES) {
      setNoteMessage(`This browser workspace can keep up to ${MAX_RESEARCH_NOTES} saved findings. Remove one before adding another.`);
      return;
    }
    const next = [...notes, {
      id: makeNoteId(),
      title: (title || "Untitled finding").slice(0, MAX_NOTE_TITLE_LENGTH),
      text: text.slice(0, MAX_NOTE_TEXT_LENGTH),
      ...(noteUrl.trim() ? { url: noteUrl.trim().slice(0, MAX_NOTE_URL_LENGTH) } : {}),
      createdAt: Date.now(),
    }];
    persistNotes(next);
    setNoteTitle("");
    setNoteText("");
    setNoteUrl("");
  }

  function saveSelectedAsNote(result: WebResult) {
    if (notes.length >= MAX_RESEARCH_NOTES) {
      setNoteMessage(`This browser workspace can keep up to ${MAX_RESEARCH_NOTES} saved findings. Remove one before adding another.`);
      return;
    }
    persistNotes([...notes, {
      id: makeNoteId(),
      title: result.title.slice(0, MAX_NOTE_TITLE_LENGTH),
      text: result.summary.slice(0, MAX_NOTE_TEXT_LENGTH),
      url: result.url,
      createdAt: Date.now(),
    }]);
  }

  function updateNote(id: string, changes: Partial<Pick<ResearchNote, "title" | "text" | "url">>) {
    persistNotes(notes.map((note) => note.id === id ? {
      ...note,
      ...changes,
      ...(changes.title !== undefined ? { title: changes.title.slice(0, MAX_NOTE_TITLE_LENGTH) } : {}),
      ...(changes.text !== undefined ? { text: changes.text.slice(0, MAX_NOTE_TEXT_LENGTH) } : {}),
      ...(changes.url !== undefined ? { url: changes.url.slice(0, MAX_NOTE_URL_LENGTH) || undefined } : {}),
    } : note));
  }

  function removeNote(id: string) {
    persistNotes(notes.filter((note) => note.id !== id));
  }

  const requirement = analysisRequirement();
  const currentAnalysis = analysisIsCurrent ? analysis : null;
  const isMusic = mode === "music";

  return <section
    id={docked ? "web-research-panel" : undefined}
    className={`web-research-workspace${docked ? " web-research-panel" : " web-research-embedded"}`}
    aria-label="Private Web Research"
    hidden={docked && !isOpen}
  >
    <header className="web-research-header">
      <div>
        <p className="web-research-eyebrow">PRIVATE HOST WORKSPACE</p>
        <h2>Web Research</h2>
        <p>General web research for this dashboard. It is separate from YouTube and never appears on the audience overlay.</p>
      </div>
      {docked && onClose && <button className="web-research-close" type="button" onClick={onClose} aria-label="Close Web Research">Close</button>}
    </header>

    <form className="web-research-search" onSubmit={search}>
      <label htmlFor="web-research-query">Search the web</label>
      <div className="web-research-search-row">
        <input
          ref={queryInput}
          id="web-research-query"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          required
          placeholder={activeMode.placeholder}
        />
        <button className="web-research-primary" type="submit" disabled={searchBusy}>{searchBusy ? "Searching…" : "Search the web"}</button>
      </div>
    </form>

    <fieldset className="web-research-modes">
      <legend>Optional research mode</legend>
      <div>
        {researchModes.map((item) => <button
          key={item.id}
          type="button"
          className={mode === item.id ? "web-research-mode-active" : ""}
          aria-pressed={mode === item.id}
          onClick={() => changeMode(item.id)}
        >{item.label}</button>)}
      </div>
      <p>{activeMode.help}</p>
    </fieldset>

    {isMusic && <p className="web-research-caveat"><strong>Music reference care:</strong> use source links and metadata to investigate song or lyric references. Full lyric text is not reproduced by the AI explanation. Check permission or licensing before broadcast; search results do not grant usage rights.</p>}
    <p className="web-research-privacy">Searches, comparisons and notes stay private. They never play media, create cards, change the draft, or update the audience overlay.{onSavePool ? " Only an explicit pool save adds selected sources to your draft." : " Research does not edit the live game."}</p>
    {searchBusy && <p role="status">Searching the web…</p>}
    {searchError && <p className="web-research-error" role="alert">{searchError}</p>}

    {lastSuccessfulQuery && <section className="web-research-results" aria-label="Web search results">
      <div className="web-research-section-heading">
        <div><h3>Results for “{lastSuccessfulQuery}”</h3><p>Select sources to compare their search snippets side by side.</p></div>
        <span>{selectedResults.length} selected</span>
      </div>
      <div className="web-research-results-list">
        {results.map((result) => {
          const selected = selectedUrls.includes(result.url);
          const expanded = expandedUrls.includes(result.url);
          const snippet = result.summary.slice(0, isMusic ? 360 : 700);
          return <article className={`web-research-result${selected ? " web-research-result-selected" : ""}`} key={result.url}>
            <div className="web-research-result-topline">
              <label className="web-research-select"><input type="checkbox" aria-label={`Select source: ${result.title}`} checked={selected} onChange={() => toggleResult(result.url)} />Select source</label>
              <span>{domainFor(result.url)}</span>
            </div>
            <h4><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a></h4>
            <a className="web-research-source-link" href={result.url} target="_blank" rel="noopener noreferrer">Open source: {domainFor(result.url)}</a>
            {snippet && <>
              <button className="web-research-snippet-toggle" type="button" aria-expanded={expanded} onClick={() => toggleExcerpt(result.url)}>{expanded ? "Hide search snippet" : "Read search snippet"}</button>
              {expanded && <div className="web-research-snippet"><strong>Search snippet</strong><p>{snippet}</p><small>This is a search snippet, not full-page content.</small></div>}
            </>}
          </article>;
        })}
      </div>
    </section>}

    {selectedResults.length > 0 && <section className="web-research-comparison" aria-label="Selected source comparison">
      <div className="web-research-section-heading"><div><h3>Compare selected sources</h3><p>Search snippets are shown side by side; open a source separately for full-page context.</p></div></div>
      <div className="web-research-comparison-grid">
        {selectedResults.map((result) => <article key={result.url} className="web-research-comparison-card">
          <p>{domainFor(result.url)}</p>
          <h4><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a></h4>
          <p className="web-research-snippet-label">Search snippet — not full-page content</p>
          <p>{result.summary.slice(0, isMusic ? 360 : 700) || "No search snippet was provided."}</p>
          <div><button type="button" onClick={() => saveSelectedAsNote(result)} disabled={notes.length >= MAX_RESEARCH_NOTES}>Save finding to private notes</button><button type="button" onClick={() => toggleResult(result.url)}>Remove from comparison</button></div>
        </article>)}
      </div>
    </section>}

    <section className="web-research-analysis" aria-label="Optional evidence explanation">
      <div className="web-research-section-heading"><div><h3>Optional evidence explanation</h3><p>Request a sourced AI explanation only when you choose. It does not run automatically.</p></div></div>
      <button className="web-research-primary" type="button" onClick={explainEvidence} disabled={Boolean(requirement) || analysisBusy}>{analysisBusy ? "Explaining evidence…" : "Explain selected evidence"}</button>
      {requirement && <p className="web-research-help">{requirement}</p>}
      {analysisBusy && <p role="status">Preparing a sourced evidence explanation…</p>}
      {analysisError && <p className="web-research-error" role="alert">{analysisError}</p>}
      {currentAnalysis && <EvidenceExplanation response={currentAnalysis.response} />}
    </section>

    {onSavePool && lastSuccessfulQuery && <section className="web-research-pool" aria-label="Save selected results as pool">
      <h3>Save selected results as a pool</h3>
      <p>This is a draft-only, named save. It does not create cards or show anything on the overlay.</p>
      <label>Pool name<input value={poolName} maxLength={MAX_POOL_NAME_LENGTH} onChange={(event) => setPoolName(event.target.value)} placeholder="Name this source pool" /></label>
      <button type="button" onClick={savePool} disabled={poolBusy || !poolName.trim() || !selectedResults.length}>{poolBusy ? "Saving pool…" : "Save selected results as pool"}</button>
      {poolMessage && <p role={poolMessage.startsWith("Added to your draft") ? "status" : "alert"}>{poolMessage}</p>}
    </section>}

    <section className="web-research-notes" aria-label="Private browser-local notes">
      <div className="web-research-section-heading"><div><h3>Private notes and saved findings</h3><p>Browser-local and private: these notes are not synced across devices and never appear on the overlay.</p></div><span>{notes.length}/{MAX_RESEARCH_NOTES}</span></div>
      {notesUnavailable && <p className="web-research-storage-warning" role="status">Browser storage is unavailable or unreadable. Continue working; notes stay only in this browser session.</p>}
      <div className="web-research-note-form">
        <label>Finding title<input value={noteTitle} maxLength={MAX_NOTE_TITLE_LENGTH} onChange={(event) => setNoteTitle(event.target.value)} placeholder="What should you remember?" /></label>
        <label>Private note<textarea value={noteText} maxLength={MAX_NOTE_TEXT_LENGTH} onChange={(event) => setNoteText(event.target.value)} placeholder="Write a finding, caveat, or follow-up…" rows={3} /></label>
        <label>Optional source link<input value={noteUrl} maxLength={MAX_NOTE_URL_LENGTH} onChange={(event) => setNoteUrl(event.target.value)} placeholder="https://example.com/source" /></label>
        <button type="button" onClick={saveNewNote} disabled={notes.length >= MAX_RESEARCH_NOTES || (!noteTitle.trim() && !noteText.trim())}>Save private finding</button>
      </div>
      {notes.length >= MAX_RESEARCH_NOTES && <p className="web-research-help">This browser workspace has reached its {MAX_RESEARCH_NOTES}-finding limit. Remove a saved finding before adding another; nothing has been discarded.</p>}
      {noteMessage && <p role="status">{noteMessage}</p>}
      <div className="web-research-notes-list">
        {notes.map((note) => <article className="web-research-note" key={note.id}>
          <label>Finding title<input value={note.title} maxLength={MAX_NOTE_TITLE_LENGTH} onChange={(event) => updateNote(note.id, { title: event.target.value })} /></label>
          <label>Private note<textarea value={note.text} maxLength={MAX_NOTE_TEXT_LENGTH} onChange={(event) => updateNote(note.id, { text: event.target.value })} rows={3} /></label>
          <label>Source link<input value={note.url || ""} maxLength={MAX_NOTE_URL_LENGTH} onChange={(event) => updateNote(note.id, { url: event.target.value })} /></label>
          <div><small>Saved in this browser</small><button type="button" onClick={() => removeNote(note.id)}>Remove saved finding</button></div>
        </article>)}
      </div>
    </section>

    <p className="web-research-powered">Powered by <a href="https://github.com/searxng/searxng" target="_blank" rel="noopener noreferrer">SearXNG</a>. Open a source separately for full context and usage terms.</p>
  </section>;
}

function EvidenceExplanation({ response }: { response: ResearchResponse }) {
  const { analysis, sources } = response;
  const cite = (sourceId: number) => {
    const source = sources[sourceId];
    if (!source) return null;
    return <a key={sourceId} href={source.url} target="_blank" rel="noopener noreferrer">Source {sourceId + 1}: {domainFor(source.url)}</a>;
  };
  return <article className="web-research-evidence-result">
    <h4>{verdictLabel(analysis.verdict)}</h4>
    <p>{analysis.summary}</p>
    {analysis.findings.length > 0 && <ul>{analysis.findings.map((finding, index) => <li key={`${finding.text}-${index}`}><span>{finding.text}</span><span className="web-research-citations">{finding.sourceIds.map(cite).filter(Boolean)}</span></li>)}</ul>}
    {analysis.evidence.length > 0 && <div className="web-research-evidence-quotes"><h5>Cited evidence excerpts</h5>{analysis.evidence.map((evidence, index) => {
      const source = sources[evidence.sourceId];
      if (!source) return null;
      return <blockquote key={`${evidence.sourceId}-${index}`}><p>{evidence.quote}</p><cite><a href={source.url} target="_blank" rel="noopener noreferrer">Source {evidence.sourceId + 1}: {source.title}</a></cite></blockquote>;
    })}</div>}
    <p className="web-research-limitation"><strong>Snippet / AI limitation:</strong> {analysis.limitation} This explanation is based on returned search snippets and is not full-page reading or a fact determination.</p>
  </article>;
}
