"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createProject, saveProjectToServer } from "../../../lib/project";
import { getGameTemplate } from "../../../lib/game-templates";

export default function NewProject() {
  const router = useRouter();
  // Keep one creation request across React's development effect replay.
  const creation = useRef<Promise<string> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [begun, setBegun] = useState(false);
  const [plain, setPlain] = useState<boolean | null>(null);

  // Template and idea links carry their own starting point, so they create
  // immediately. A plain New Project visit asks for a name first.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasStart = !!(params.get("template")?.trim() || params.get("idea")?.trim());
    setPlain(!hasStart);
    if (hasStart) setBegun(true);
  }, []);

  useEffect(() => {
    if (!begun) return;
    let cancelled = false;
    if (!creation.current) {
      const params = new URLSearchParams(window.location.search);
      const idea = params.get("idea")?.trim().slice(0, 12000) || "";
      const templateId = params.get("template")?.trim() || "";
      const template = templateId ? getGameTemplate(templateId) : undefined;
      // Restricted templates (e.g. City Crime Scene): verify entitlement before creating.
      // The save-time backstop strips restricted tools server-side, but this avoids
      // a confusing create-then-strip for unauthorized users.
      const checkEntitlement = (async () => {
        if (!template || !template.restricted) return true;
        try {
          const res = await fetch("/api/me", { cache: "no-store" });
          const me = await res.json();
          const email = String(me?.email || "").toLowerCase();
          const allowed = ["biscoe1972@gmail.com", "ladylovelace0627@gmail.com"];
          return allowed.includes(email);
        } catch {
          return false;
        }
      })();
      const project = createProject("");
      if (template) {
        const draft = template.buildDraft();
        project.name = draft.name;
        project.description = draft.description;
        project.overlay = { ...project.overlay, ...draft.overlay };
        project.gameTools = draft.gameTools;
        project.controls = draft.controls;
        project.prompt = `Started from the "${template.name}" template.`;
        project.templateId = template.id;
        project.messages = [{
          role: "assistant",
          text: `Your "${template.name}" game is ready! ${template.tagline} Use "Edit with AI" below to customize anything — the questions, prizes, look, rules — or dive into the workshop and tweak it yourself.`,
        }];
      } else {
        project.prompt = idea;
        project.workflow = { stage: 0, workshopStep: 0, promptDraft: idea };
        if (idea) project.gamePlan = { theme: idea };
        project.name = name.trim() || "New Project";
        project.description = "Your TikTok LIVE creation workspace.";
        project.controls = [];
        project.overlay = { ...project.overlay, title: name.trim() ? name.trim().toUpperCase() : "YOUR LIVESTREAM", showCharacter: false };
        project.messages = [{
          role: "assistant",
          text: "Tell me what you want to create, or start with the trivia generator, board and tool templates, uploads, or Asset Composer. Your draft is ready to customize.",
        }];
      }
      creation.current = checkEntitlement.then(entitled => {
        if (!entitled) throw new Error("This template is restricted to specific accounts.");
        return saveProjectToServer(project);
      }).then(() => project.id);
    }
    creation.current.then(
      id => { if (!cancelled) router.replace(`/project/${id}`); },
      failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Project could not be created."); },
    );
    return () => { cancelled = true; };
  }, [router, attempt, begun]);

  function retry() {
    creation.current = null;
    setError("");
    setAttempt(value => value + 1);
  }

  if (plain && !begun && !error) {
    return (
      <main className="loading-page">
        <div className="ai-orb">✦</div>
        <h1>Name your project</h1>
        <p>You can rename it anytime — this is how it will appear in your library.</p>
        <form onSubmit={event => { event.preventDefault(); setBegun(true); }} style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          <input aria-label="Project name" autoFocus maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Dragon Night Trivia" style={{ minWidth: 260, maxWidth: "80vw", padding: "10px 12px", borderRadius: 8, color: "#fff", background: "#172032", border: "1px solid #3ddde6", fontSize: 15 }} />
          <button type="submit" className="build-btn" disabled={!name.trim()}>Create project</button>
          <button type="button" className="outline-btn" onClick={() => setBegun(true)}>Skip — name it later</button>
        </form>
        <Link href="/projects">Back to projects</Link>
      </main>
    );
  }

  return (
    <main className="loading-page">
      <div className="ai-orb">✦</div>
      <h1>{error ? "Could not open your workshop" : "Opening your workshop…"}</h1>
      {error ? <><p role="alert">{error}</p><button className="build-btn" onClick={retry}>Try again</button><Link href="/">Back to projects</Link></> : <p>Creating your blank draft with the full workshop tools.</p>}
    </main>
  );
}

