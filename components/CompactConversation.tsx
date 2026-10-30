"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Message = { role: string; text: string };

/** Renders **bold** spans and line breaks in Jewel's replies instead of
 *  showing the raw formatting marks to the creator. */
function renderRichText(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => {
    const parts = line.split(/\*\*([^*]+)\*\*/g);
    return (
      <span key={lineIndex}>
        {parts.map((part, partIndex) => (partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part))}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export default function CompactConversation({ messages, busy = false, progressText }: { messages: Message[]; busy?: boolean; progressText?: string }) {
  const [hidden, setHidden] = useState(false), [history, setHistory] = useState(false), [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const viewport = useRef<HTMLDivElement>(null), nearBottom = useRef(true);
  const start = history ? 0 : Math.max(0, messages.length - 4);
  useEffect(() => { const node = viewport.current; if (node && !hidden && (!history || nearBottom.current)) node.scrollTop = node.scrollHeight; }, [messages.length, messages.at(-1)?.text, busy, hidden, history]);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(timer);
  }, [busy]);
  const elapsedLabel = elapsed >= 3 ? ` · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "";
  return <section className="compact-conversation" aria-label="AI conversation"><div className="conversation-toolbar"><span>{messages.length ? `${messages.length} messages` : "Conversation"}</span><button type="button" aria-expanded={!hidden} onClick={() => setHidden(value => !value)}>{hidden ? "Show conversation" : "Hide conversation"}</button></div>{!hidden && <><div className="conversation-history-controls">{messages.length > 4 && <button type="button" aria-expanded={history} onClick={() => { setHistory(value => !value); nearBottom.current = false; }}>{history ? "Show recent messages" : `Show ${messages.length - 4} earlier messages`}</button>}</div><div ref={viewport} className="compact-messages" role="log" aria-label="Conversation messages" aria-live="polite" onScroll={() => { const node = viewport.current; if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; }}>{messages.slice(start).map((message, offset) => { const index = start + offset, long = message.text.length > 600, full = expanded[index]; const display = long && !full ? message.text.slice(0, 600) + "…" : message.text; return <div className={`compact-message ${message.role}`} key={index}><strong>{message.role === "assistant" ? "Jewel" : "You"}</strong><p>{message.role === "assistant" ? renderRichText(display) : display}</p>{long && <button type="button" aria-expanded={!!full} onClick={() => setExpanded(value => ({ ...value, [index]: !value[index] }))}>{full ? "Show less" : "Read full response"}</button>}</div>; })}{busy && <div className="compact-chat-working"><p role="status">{progressText || "Working on your request…"}{elapsedLabel}</p>{elapsed >= 20 && <p>Media and multi-step requests can take a few minutes — Jewel is still working.</p>}</div>}</div></>}</section>;
}
