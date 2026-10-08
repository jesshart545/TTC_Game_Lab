"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkedSupportReply, fallbackSupport, type SupportContext, type SupportReply, type SupportTarget } from "../lib/site-support";
import { getSupportBridge, subscribeSupportBridge, supportPanelEvent, type SupportTurn } from "../lib/support-client";

type Turn = SupportTurn & { targets?: SupportTarget[]; offline?: boolean };
const targetLabels: Record<SupportTarget, string> = {
  "game-plan": "Open game plan", materials: "Open materials", scenes: "Open scenes & effects",
  background: "Choose a background", "add-items": "Add items in Build Space", test: "Open draft test",
  "publish-review": "Open publishing review", "media-generator": "Open media generator", "media-editor": "Open media editor",
  "game-tools": "Open game tools", "web-research": "Open Web Research", projects: "Choose a project",
  assets: "Open Asset Library", guide: "Open walkthrough", contact: "Contact support",
};
const pageName = (path: string) => path === "/assets" ? "assets" : path === "/projects" ? "projects" : path.startsWith("/auth/") ? "sign-in" : path === "/help" ? "help" : "home";

export default function SiteSupportChat({ path }: { path: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bridgeVersion, setBridgeVersion] = useState(0);
  const candidate = getSupportBridge();
  const bridge = candidate && (candidate.context.page === "project" ? path === "/project/" + candidate.context.scope.replace(/^project:/, "") : candidate.context.page === "host" ? (path.startsWith("/published/") || path === "/") : false) ? candidate : null;
  const context: SupportContext = bridge?.context ?? { scope: `page:${path}`, page: pageName(path) };
  const scope = context.scope;
  const sessions = useRef(new Map<string, Turn[]>());
  const [turnState, setTurnState] = useState<{ scope: string; turns: Turn[] }>({ scope, turns: [] });
  const turns = turnState.scope === scope ? turnState.turns : (sessions.current.get(scope) || []);
  const [inputState, setInputState] = useState({ scope, text: "" });
  const input = inputState.scope === scope ? inputState.text : "";
  const setInput = (text: string) => setInputState({ scope, text });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [pending, setPending] = useState(false);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => subscribeSupportBridge(() => setBridgeVersion(n => n + 1)), []);
  useEffect(() => {
    ++operation.current;
    controller.current?.abort();
    setTurnState({ scope, turns: sessions.current.get(scope) || [] });
    setInput(""); setBusy(false); setProgress(""); setPending(false);
  }, [scope]);
  useEffect(() => () => { ++operation.current; controller.current?.abort(); }, []);
  useEffect(() => {
    if (open) field.current?.focus();
    const onPanel = (event: Event) => { if ((event as CustomEvent).detail === "research") setOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && open) close(); };
    window.addEventListener("ttc-assistant-panel", onPanel);
    window.addEventListener("keydown", onEscape);
    return () => { window.removeEventListener("ttc-assistant-panel", onPanel); window.removeEventListener("keydown", onEscape); };
  }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "nearest" }); }, [turns, progress, open]);
  // The subscription makes newly loaded project context visible to this sibling widget.
  void bridgeVersion;
  function close() { setOpen(false); window.setTimeout(() => launcher.current?.focus(), 0); }
  function commit(next: Turn[], taskScope = scope) {
    const limited = next.slice(-30);
    sessions.current.set(taskScope, limited);
    if (sessions.current.size > 10) sessions.current.delete(sessions.current.keys().next().value!);
    if (scopeRef.current === taskScope) setTurnState({ scope: taskScope, turns: limited });
  }
  function navigate(target: SupportTarget) {
    const active = getSupportBridge();
    if (active && active.context.scope === scope && active.navigate(target)) return;
    const routes: Partial<Record<SupportTarget, string>> = { projects: "/projects", assets: "/assets", guide: "/guide", contact: "/help" };
    const route = routes[target];
    if (route) {
      close();
      if (context.page === "host" && window.location.hostname !== "www.ttcgamelab.com" && window.location.hostname !== "ttcgamelab.com") window.location.assign("https://www.ttcgamelab.com" + route);
      else router.push(route);
    }
    else commit([...turns, { role: "assistant", text: "Open an editable project first so I can take you to that tool.", targets: ["projects"] }]);
  }
  async function submit(text = input.trim()) {
    if (!text || busy || text.length > 3000) return;
    const taskScope = scope, id = ++operation.current;
    const active = bridge;
    let taskStarted = false;
    const next: Turn[] = [...turns, { role: "user", text }];
    commit(next); setInput(""); setBusy(true); setProgress("Understanding your request…");
    controller.current = new AbortController();
    try {
      const compactHistory = turns.slice(-20).map(({role,text}) => ({role,text:text.slice(0,3000)}));
      while (JSON.stringify(compactHistory).length > 22000) compactHistory.shift();
      const response = await fetch("/api/site-support", {
        method: "POST", headers: { "Content-Type": "application/json", ...(active?.hostKey ? { "x-host-key": active.hostKey } : {}) },
        body: JSON.stringify({ request: text, history: compactHistory, context, ...(active?.slug ? { slug: active.slug } : {}), pendingTask: pending }),
        signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "AI is temporarily unavailable.");
      const answer: SupportReply = checkedSupportReply(data, { allowTask: Boolean(active?.execute) });
      if (scopeRef.current !== taskScope || id !== operation.current) return;
      if (answer.kind === "task" && active?.execute && active.context.scope === taskScope && getSupportBridge()?.context.scope === taskScope) {
        setPending(true); setProgress("Working on your draft. Keep this project open…");
        taskStarted = true;
        const result = await active.execute(text, next.map(({ role, text }) => ({ role, text })), message => {
          if (scopeRef.current === taskScope && operation.current === id) setProgress(message);
        });
        const completed: Turn = { role: "assistant", text: result.reply };
        // Keep the originating conversation updated, never display its result in another project.
        commit([...next, completed], taskScope);
        if (scopeRef.current === taskScope && operation.current === id) setPending(result.status === "clarification");
      } else {
        setPending(false);
        const reply = answer.kind === "task" ? "Open an editable project and I can carry out that request there. Your live game has not been changed." : answer.reply;
        commit([...next, { role: "assistant", text: reply, targets: answer.kind === "task" ? ["projects"] : answer.targets, offline: answer.offline }], taskScope);
      }
    } catch (error) {
      if (scopeRef.current !== taskScope || id !== operation.current) return;
      if (error instanceof Error && error.name === "AbortError") return;
      const fallback = fallbackSupport(text, context);
      commit([...next, { role: "assistant", text: `${taskStarted ? "The task could not finish. Review your draft for completed steps before retrying." : "AI is unavailable right now. No new task was started."}\n\n${fallback.reply}`, targets: fallback.targets, offline: true }], taskScope);
    } finally {
      if (scopeRef.current === taskScope && operation.current === id) { setBusy(false); setProgress(""); }
    }
  }
  async function undo() {
    const active = getSupportBridge();
    if (!active || active.context.scope !== scope || !active.undo || busy) return;
    const taskScope = scope, id = ++operation.current;
    setBusy(true); setProgress("Saving the undo…");
    try { commit([...turns, { role: "assistant", text: await active.undo() }], taskScope); }
    catch { commit([...turns, { role: "assistant", text: "Undo could not be saved. Review your draft and use Save progress to retry." }], taskScope); }
    finally { if (scopeRef.current === taskScope && operation.current === id) { setBusy(false); setProgress(""); } }
  }
  return <div className="ttc-support-root">
    <button ref={launcher} type="button" className="ttc-support-launcher" aria-expanded={open} aria-controls="ttc-support-panel" onClick={() => { if (open) close(); else { supportPanelEvent("support"); setOpen(true); } }}>
      <span>Ask TTC AI</span><small>Help, create & edit</small>
    </button>
    {open && <section id="ttc-support-panel" className="ttc-support-panel" role="dialog" aria-modal="false" aria-labelledby="ttc-support-title">
      <header><div><small>YOUR APP ASSISTANT</small><h2 id="ttc-support-title">What would you like to do?</h2></div><button type="button" aria-label="Close AI assistant" onClick={close}>×</button></header>
      <p className="ttc-support-context">{context.page === "project" ? `${context.stage || "Project"}${context.section ? ` · ${context.section}` : ""}` : context.page === "host" ? "Private host dashboard · live controls stay manual" : "TTCGameLab help"}</p>
      <div className="ttc-support-transcript" role="log" aria-live="polite" aria-relevant="additions">
        {!turns.length && <div className="ttc-support-welcome"><p>Tell me what you want in your own words. I can explain the app, help you get unstuck, or carry out supported changes and generation in your open project.</p><p>If something important is missing, I’ll ask a short question.</p><div className="ttc-support-suggestions">{["Help me get started", "What can you create or edit for me?", "I’m stuck—help me figure it out"].map(text => <button type="button" key={text} onClick={() => void submit(text)}>{text}</button>)}</div></div>}
        {turns.map((turn, index) => <article className={`ttc-support-turn ${turn.role}`} key={index}><strong>{turn.role === "user" ? "You" : turn.offline ? "Documented help · AI offline" : "TTC AI"}</strong><p>{turn.text}</p>{turn.targets?.length ? <div className="ttc-support-targets">{turn.targets.map(target => <button type="button" key={target} disabled={busy} onClick={() => navigate(target)}>{targetLabels[target]}</button>)}</div> : null}</article>)}
        {busy && <p className="ttc-support-progress" role="status">{progress}</p>}{bridge?.resumeMedia && <button type="button" onClick={bridge.resumeMedia}>Start video trim</button>}<div ref={end}/>
      </div>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}><label htmlFor="ttc-support-input">Describe your goal or ask a question</label><textarea ref={field} id="ttc-support-input" value={input} onChange={event => setInput(event.target.value)} maxLength={3000} rows={3} placeholder="Example: Make my background fit without cropping it" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }}/><button type="submit" disabled={busy || !input.trim()}>{busy ? "Working…" : "Send"}</button></form>
      <footer><p>Your messages go to the app’s AI provider. Requested tasks can change your draft and generate assets; help alone changes nothing. Keep the project open until tasks finish.</p><div>{bridge?.undo && <button type="button" disabled={busy} onClick={undo}>Undo last AI edit</button>}<button type="button" disabled={busy} onClick={() => { ++operation.current; commit([]); setPending(false); setInput(""); }}>New conversation</button><a href={context.page === "host" ? "https://www.ttcgamelab.com/help" : "/help"}>Contact support</a></div></footer>
    </section>}
  </div>;
}
