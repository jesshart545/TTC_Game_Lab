"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createProject, saveProjectToServer } from "../../../lib/project";

export default function NewProject() {
  const router = useRouter();
  // Keep one creation request across React's development effect replay.
  const creation = useRef<Promise<string> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!creation.current) {
      const project = createProject("");
      project.name = "New Project";
      project.description = "Your TikTok LIVE creation workspace.";
      project.controls = [];
      project.overlay = { ...project.overlay, title: "YOUR LIVESTREAM", showCharacter: false };
      project.messages = [{
        role: "assistant",
        text: "Tell me what you want to create, or start with the trivia generator, board and tool templates, uploads, or Asset Composer. Your draft is ready to customize.",
      }];
      creation.current = saveProjectToServer(project).then(() => project.id);
    }
    creation.current.then(
      id => { if (!cancelled) router.replace(`/project/${id}`); },
      failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Project could not be created."); },
    );
    return () => { cancelled = true; };
  }, [router, attempt]);

  function retry() {
    creation.current = null;
    setError("");
    setAttempt(value => value + 1);
  }

  return (
    <main className="loading-page">
      <div className="ai-orb">✦</div>
      <h1>{error ? "Could not open your workshop" : "Opening your workshop…"}</h1>
      {error ? <><p role="alert">{error}</p><button className="build-btn" onClick={retry}>Try again</button><Link href="/">Back to projects</Link></> : <p>Creating your blank draft with the full workshop tools.</p>}
    </main>
  );
}
