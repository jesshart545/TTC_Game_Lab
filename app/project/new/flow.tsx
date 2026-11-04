"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createProject, saveProjectToServer, type ProjectKind } from "../../../lib/project";
import { GAME_TEMPLATES, getGameTemplate } from "../../../lib/game-templates";
import { PROJECT_KINDS, SETUP_PIECES, applySetupPieces, defaultSetupPieces, isKindComingSoon, projectKindInfo, setupPiecesForKind } from "../../../lib/project-kinds";
import "./new-project.css";

type ScratchStart = { kind: ProjectKind; pieces: string[]; theme?: string };

export default function NewProjectFlow({ ccssEntitled }: { ccssEntitled: boolean }) {
  const router = useRouter();
  // Keep one creation request across React's development effect replay.
  const creation = useRef<Promise<string> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [begun, setBegun] = useState(false);
  const [plain, setPlain] = useState<boolean | null>(null);
  const [chosenTemplate, setChosenTemplate] = useState("");
  const [start, setStart] = useState<ScratchStart | null>(null);
  const [kind, setKind] = useState<ProjectKind | null>(null);
  const [screen, setScreen] = useState<"kinds" | "scratch" | "templates">("kinds");
  const [popup, setPopup] = useState(false);
  const [pieces, setPieces] = useState<string[]>(() => SETUP_PIECES.filter(piece => piece.defaultOn).map(piece => piece.id));

  // Template and idea links carry their own starting point, so they create
  // immediately. A plain New Project visit gets the kind-picker flow.
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
      let project = createProject("");
      if (template) {
        const draft = template.buildDraft();
        project.name = name.trim() || draft.name;
        project.description = draft.description;
        project.overlay = { ...project.overlay, ...draft.overlay };
        project.gameTools = draft.gameTools;
        project.controls = draft.controls;
        project.prompt = `Started from the "${template.name}" template.`;
        project.templateId = template.id;
        // Every template in the gallery is a gameshow; City Crime Scene too.
        project.kind = "gameshow";
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
        if (start) {
          // Scratch start from the kind flow: stamp the kind and add the
          // pieces the user tapped, using the Workshop's own creators.
          project.kind = start.kind;
          // A talk show starts with the ask (Jessica, 2026-11-03): the
          // title and the theme/vibe/subject the creator gave on the
          // setup screen seed the project before anything else exists.
          if (start.kind === "talk" && start.theme) {
            project.gamePlan = { ...(project.gamePlan || {}), theme: start.theme };
          }
          project = applySetupPieces(project, start.pieces);
        }
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
  }, [router, attempt, begun, chosenTemplate, start]);

  function retry() {
    creation.current = null;
    setError("");
    setAttempt(value => value + 1);
  }

  function chooseKind(next: ProjectKind) {
    // Coming Soon kinds cannot be chosen — the card is disabled, and this
    // guard keeps every other caller out of the scratch screen too.
    if (isKindComingSoon(next)) return;
    setKind(next);
    setPieces(defaultSetupPieces(next));
    if (next === "gameshow") {
      setPopup(true);
      return;
    }
    const info = projectKindInfo(next);
    if (info && !name.trim()) setName(info.nameSuggestion);
    setScreen("scratch");
  }

  function closePopup() {
    setPopup(false);
    setKind(null);
  }

  function startScratch() {
    if (!kind || isKindComingSoon(kind)) return;
    setStart({ kind, pieces: [...pieces], theme: kind === "talk" ? theme.trim() || undefined : undefined });
    setBegun(true);
  }

  function chooseTemplate(templateId: string) {
    setChosenTemplate(templateId);
    setBegun(true);
  }

  if (plain && !begun && !error) {
    const kindInfo = kind ? projectKindInfo(kind) : undefined;
    // City Crime Scene is not a template — it has its own builder inside a
    // project — so restricted entries never appear in this gallery.
    const visibleTemplates = GAME_TEMPLATES.filter(template => !template.restricted);
    return (
      <main className="np-page">
        <div className="np-flow">
          <Link href="/" className="np-logo display">TTC <span>GAME LAB</span></Link>
          <div className="np-fstep on">1 · Imagine and Create</div><div className="np-arrow">→</div>
          <div className="np-fstep">2 · Set the Stage</div><div className="np-arrow">→</div>
          <div className="np-fstep">3 · Showtime!</div>
        </div>

        <div className="np-main">
          <div className="np-proj">
            <div className={`np-chip${kindInfo ? " set" : ""}`}>{kindInfo ? kindInfo.chipLabel : "New project"}</div>
          </div>

          {screen === "kinds" && (
            <div>
              <div className="np-ask">One question: <b>what are you making?</b></div>
              <div className="np-kinds">
                {PROJECT_KINDS.map(info => info.comingSoon ? (
                  <button key={info.id} type="button" className="np-kind soon" disabled aria-disabled="true" aria-label={`${info.title} — Coming Soon!`}>
                    <img src={info.image} alt="" />
                    <div className="np-shade" />
                    <div className="np-txt">
                      <div className="np-kick">{info.kicker}</div>
                      <div className="np-t display">{info.title}</div>
                      <div className="np-d">{info.description}</div>
                    </div>
                    <div className="np-soonband display" aria-hidden="true">Coming Soon!</div>
                  </button>
                ) : (
                  <button key={info.id} type="button" className="np-kind" onClick={() => chooseKind(info.id)}>
                    <img src={info.image} alt="" />
                    <div className="np-shade" />
                    <div className="np-txt">
                      <div className="np-kick">{info.kicker}</div>
                      <div className="np-t display">{info.title}</div>
                      <div className="np-d">{info.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {screen === "scratch" && kindInfo && (
            <div>
              <button type="button" className="np-back" onClick={() => { setScreen("kinds"); setKind(null); }}>← Back to kinds</button>
              <div className="np-setuphead">
                <div className="display">{kindInfo.scratchHeading}</div>
                <div className="np-chip set">From scratch</div>
              </div>
              {kind === "talk" ? (
                <>
                  <div className="np-ask">First things first — two things only you can give: <b>the title of your show</b>, and <b>its theme, vibe, or subject</b>. Then tap the pieces your show needs.</div>
                  <input className="np-nameinput" aria-label="Show title" maxLength={100} value={name} onChange={event => setName(event.target.value)} />
                  <input className="np-nameinput" aria-label="Theme, vibe, or subject" maxLength={200} placeholder="Its theme, vibe, or subject — e.g. cozy faith-and-life chat" value={theme} onChange={event => setTheme(event.target.value)} />
                </>
              ) : (
                <>
                  <div className="np-ask">Two things on this screen: <b>name it</b>, and <b>tap the pieces your show needs</b>.</div>
                  <input className="np-nameinput" aria-label="Show name" maxLength={100} value={name} onChange={event => setName(event.target.value)} />
                </>
              )}
              <div className="np-pieces">
                {setupPiecesForKind(kindInfo.id).map(piece => {
                  const on = pieces.includes(piece.id);
                  return (
                    <div
                      key={piece.id}
                      className={`np-piece${on ? " on" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      onClick={() => setPieces(current => on ? current.filter(id => id !== piece.id) : [...current, piece.id])}
                      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPieces(current => on ? current.filter(id => id !== piece.id) : [...current, piece.id]); } }}
                    >
                      {piece.image
                        ? <img src={piece.image} alt="" />
                        : <div className="np-glyph display">{piece.glyph}</div>}
                      <div className="np-shade" />
                      <div className="np-check">✓</div>
                      <div className="np-pn">{piece.label}</div>
                    </div>
                  );
                })}
              </div>
              <div className="np-nextrow">
                <button type="button" className="np-nextbtn" onClick={startScratch}>Next — make it look like yours →</button>
                <span className="np-hint">You can add or remove pieces any time. Nothing is final here.</span>
              </div>
            </div>
          )}

          {screen === "templates" && (
            <div>
              <button type="button" className="np-back" onClick={() => { setScreen("kinds"); setKind(null); }}>← Back to kinds</button>
              <div className="np-setuphead">
                <div className="display">Pick your show</div>
                <div className="np-chip set">Templates</div>
              </div>
              <div className="np-ask">Each one is <b>mostly finished</b>. Pick it, then change anything — tell Jewel what you want different.</div>
              <div className="np-tplgrid">
                {visibleTemplates.map(template => (
                  <div
                    key={template.id}
                    className="np-tplcard"
                    role="button"
                    tabIndex={0}
                    onClick={() => chooseTemplate(template.id)}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseTemplate(template.id); } }}
                  >
                    <img src="/redesign/kind-gameshow.webp" alt="" />
                    <div className="np-shade" />
                    <div className="np-txt">
                      <div className="np-kick">{template.category}</div>
                      <div className="np-t display">{template.name}</div>
                      <div className="np-d">{template.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {popup && (
          <div className="np-popwrap" onClick={event => { if (event.target === event.currentTarget) closePopup(); }}>
            <div className="np-pop" role="dialog" aria-modal="true" aria-label="How do you want to start?">
              <button type="button" className="np-popx" aria-label="Close" onClick={closePopup}>✕</button>
              <div className="np-kick">Gameshow project</div>
              <h3 className="display">How do you want to start?</h3>
              <div className="np-sub">Two ways in — pick one and you&apos;re building.</div>
              <button type="button" className="np-opt" onClick={() => { setPopup(false); setPieces(defaultSetupPieces("gameshow")); const info = projectKindInfo("gameshow"); if (info && !name.trim()) setName(info.nameSuggestion); setScreen("scratch"); }}>
                <div className="np-ic">✨</div>
                <div>
                  <div className="np-t">Build from Scratch</div>
                  <div className="np-d">A blank stage. Every piece made by you, with Jewel beside you.</div>
                </div>
              </button>
              <button type="button" className="np-opt" onClick={() => { setPopup(false); setScreen("templates"); }}>
                <div className="np-ic">🎭</div>
                <div>
                  <div className="np-t">Start with a Template</div>
                  <div className="np-d">A mostly-finished show — Trivia Night, Million Quiz, and more — then make it yours.</div>
                </div>
              </button>
              {ccssEntitled && (
                <button type="button" className="np-opt" onClick={() => { setPopup(false); chooseTemplate("city-crime-scene"); }}>
                  <div className="np-ic">🔎</div>
                  <div>
                    <div className="np-t">City Crime Scene</div>
                    <div className="np-d">The improv whodunnit — build tonight&apos;s case.</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="np-foot"><Link href="/projects">Back to projects</Link></div>
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
