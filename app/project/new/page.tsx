"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createProject, saveProjectToServer } from "../../../lib/project";
import { GAME_TEMPLATES, getGameTemplate } from "../../../lib/game-templates";

export default function NewProject() {
  const router = useRouter();
  // Keep one creation request across React's development effect replay.
  const creation = useRef<Promise<string> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [begun, setBegun] = useState(false);
  const [plain, setPlain] = useState<boolean | null>(null);
  const [stage, setStage] = useState<"name" | "template">("name");
  const [chosenTemplate, setChosenTemplate] = useState("");

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
      const templateId = params.get("template")?.trim() || chosenTemplate;
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
        project.name = name.trim() || draft.name;
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
  }, [router, attempt, begun, chosenTemplate]);

  function retry() {
    creation.current = null;
    setError("");
    setAttempt(value => value + 1);
  }

  if (plain && !begun && !error && stage === "name") {
    return (
      <main className="loading-page">
        <div className="ai-orb">✦</div>
        <h1>Name your project</h1>
        <p>You can rename it anytime — this is how it will appear in your library.</p>
        <form onSubmit={event => { event.preventDefault(); setStage("template"); }} style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          <input aria-label="Project name" autoFocus maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Dragon Night Trivia" style={{ minWidth: 260, maxWidth: "80vw", padding: "10px 12px", borderRadius: 8, color: "#fff", background: "#172032", border: "1px solid #3ddde6", fontSize: 15 }} />
          <button type="submit" className="build-btn" disabled={!name.trim()}>Continue</button>
          <button type="button" className="outline-btn" onClick={() => setStage("template")}>Skip — name it later</button>
        </form>
        <Link href="/projects">Back to projects</Link>
      </main>
    );
  }

  if (plain && !begun && !error && stage === "template") {
    // City Crime Scene is not a template — it has its own builder inside a
    // project — so restricted entries never appear in this gallery.
    const visibleTemplates = GAME_TEMPLATES.filter(template => !template.restricted);
    return (
      <main className="loading-page">
        <div className="ai-orb">✦</div>
        <h1>Start blank, or with a template?</h1>
        <p>A template sets up the game tools and dashboard buttons for you — you can change everything afterward.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, width: "min(760px, 92vw)", textAlign: "left" }}>
          <button type="button" className="outline-btn" style={{ display: "grid", gap: 4, justifyItems: "start", padding: "14px 16px" }} onClick={() => { setChosenTemplate(""); setBegun(true); }}>
            <strong>✦ Start blank</strong>
            <span>A clean slate — build everything yourself.</span>
          </button>
          {visibleTemplates.map(template => (
            <button key={template.id} type="button" className="outline-btn" style={{ display: "grid", gap: 4, justifyItems: "start", padding: "14px 16px" }} onClick={() => { setChosenTemplate(template.id); setBegun(true); }}>
              <strong>{template.icon} {template.name}</strong>
              <span>{template.tagline}</span>
            </button>
          ))}
        </div>
        <button type="button" className="outline-btn" onClick={() => setStage("name")}>← Back to the name</button>
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

