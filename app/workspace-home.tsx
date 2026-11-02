"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "../lib/project";
import { formatUpdatedAt } from "../lib/relative-time";
import { projectKindInfo } from "../lib/project-kinds";
import SignOutButton from "./sign-out-button";
import "./home.css";

const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL || "https://buy.stripe.com/8x25kwaJhdu23J95UGawo00";

type LibraryAsset = Project["assets"][number];

function isLibraryImage(asset: LibraryAsset) {
  return !!asset.url && !asset.url.startsWith("blob:") && (asset.type || "").toLowerCase().includes("image");
}

// Same artwork choice as the My Projects library: the project's background
// image if it has one, else its first image asset.
function projectThumbnail(project: Project): LibraryAsset | undefined {
  return project.assets?.find(asset => asset.role === "background" && isLibraryImage(asset))
    || project.assets?.find(isLibraryImage);
}

function editedLabel(project: Project): string {
  const rel = formatUpdatedAt(project.updatedAt, project.id);
  if (rel === "Yesterday") return "Edited yesterday";
  if (/ago$/.test(rel) || rel === "just now") return `Edited ${rel}`;
  return rel;
}

const TIPS = [
  {
    img: "/redesign/tip-jewel-wand.webp",
    magic: true,
    t: "Meet Jewel — your magic wand",
    d: "Jewel is your AI guide, helper, and co-creator. Tell her what you're dreaming up and she'll help you build it — she's how the magic gets made.",
  },
  {
    img: "/redesign/kind-gameshow.webp",
    magic: false,
    t: "One button can do three things",
    d: "In Set the Stage, give a button steps: show the card, play a sting, then confetti. One tap runs them all, in order.",
  },
  {
    img: "/redesign/kind-radio.webp",
    magic: false,
    t: "Effects are picked by watching them",
    d: "Every effect tile moves, so you see what it does before you choose it. No guessing from names.",
  },
  {
    img: "/redesign/kind-talkshow.webp",
    magic: false,
    t: "The Library choice pops up where you click",
    d: "Tap anything in your Library and choose right there: put it on the stage, or give it a button.",
  },
];

function TipsCard() {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => (value + 1) % TIPS.length), 6000);
    return () => clearInterval(timer);
  }, [cycle]);
  const go = (next: number) => {
    setIndex(((next % TIPS.length) + TIPS.length) % TIPS.length);
    setCycle(value => value + 1);
  };
  const tip = TIPS[index];
  return (
    <div>
      <div className="rd-seclabel">Tips &amp; tricks</div>
      <div className="rd-tips">
        <div className={`rd-tips-imgwrap${tip.magic ? " magic" : ""}`}>
          <img className="rd-tipimg" src={tip.img} alt="" />
          <div className="rd-shade" />
          <span className="rd-sparkle" style={{ top: "16%", left: "56%", fontSize: 15 }}>✦</span>
          <span className="rd-sparkle" style={{ top: "38%", left: "78%", fontSize: 11, animationDelay: ".4s" }}>✦</span>
          <span className="rd-sparkle" style={{ top: "10%", left: "84%", fontSize: 18, animationDelay: ".8s" }}>✦</span>
          <span className="rd-sparkle" style={{ top: "52%", left: "62%", fontSize: 10, animationDelay: "1.1s" }}>✦</span>
          {tip.magic && (
            <div className="rd-bubble" aria-hidden="true">
              <video src="/redesign/jewel-wave.mp4" autoPlay muted loop playsInline />
            </div>
          )}
          <div className="rd-tips-kick">Tip of the moment</div>
        </div>
        <div className="rd-tips-body">
          <div className="rd-tips-tt">{tip.t}</div>
          <div className="rd-tips-td">{tip.d}</div>
        </div>
        <div className="rd-tips-ctrl">
          <div className="rd-tips-dots">
            {TIPS.map((entry, i) => (
              <button key={entry.t} type="button" aria-label={`Show tip ${i + 1}`} className={`rd-dot${i === index ? " on" : ""}`} onClick={() => go(i)} />
            ))}
          </div>
          <button type="button" className="rd-arrowbtn" aria-label="Previous tip" onClick={() => go(index - 1)}>‹</button>
          <button type="button" className="rd-arrowbtn" aria-label="Next tip" onClick={() => go(index + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceHome() {
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled && typeof data?.email === "string") setAccountEmail(data.email);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setLoading(true); setLoadError("");
    void fetch("/api/projects", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load projects.");
      const data = await response.json();
      setProjects(Array.isArray(data.projects) ? data.projects.map((row: any) => row.data as Project).filter(Boolean) : []);
    }).catch(() => setLoadError("Your saved projects could not be loaded. Please try again.")).finally(() => setLoading(false));
  }, [retry]);

  const initial = (accountEmail.trim()[0] || "C").toUpperCase();

  return (
    <main className="rd-home">
      <header className="rd-top">
        <Link href="/" className="rd-logo display">TTC <span>GAME LAB</span></Link>
        <nav className="rd-nav" aria-label="Workspace">
          <Link href="/" className="on">Home</Link>
          <Link href="/projects">My Projects {projects.length > 0 && <b>{projects.length}</b>}</Link>
          <Link href="/assets">Asset Library</Link>
          <Link href="/reference">Reference Project</Link>
          <Link href="/help">Help</Link>
        </nav>
        <div className="rd-right">
          <Link href="/project/new" className="rd-newbtn">＋ New project</Link>
          <div className="rd-who">
            <div className="rd-avatar" aria-hidden="true">{initial}</div>
            <div className="rd-whotext">
              <span>{accountEmail || "Creator"}</span>
              <small>Your private workspace</small>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="rd-main">
        <div className="rd-hello">Welcome back.</div>
        <h1 className="rd-h1 display">Your projects</h1>
        <div className="rd-cols">
          <div>
            {loading && <p role="status" className="rd-status">Loading your saved projects…</p>}
            {loadError && (
              <div role="alert" className="rd-alert">
                <p>{loadError}</p>
                <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>
              </div>
            )}
            <div className="rd-grid">
              <Link href="/project/new" className="rd-newcard">
                <div className="plus">＋</div>
                <div className="t">Start something new</div>
                <div className="d">Gameshow · Talk &amp; classroom · Radio, DJ, karaoke · Game night</div>
              </Link>
              {projects.map(project => {
                const thumb = projectThumbnail(project);
                const kind = projectKindInfo(project.kind);
                const img = thumb?.url || kind?.image || "";
                return (
                  <Link href={`/project/${project.id}`} className="rd-proj" key={project.id}>
                    {img
                      ? <img src={img} alt="" />
                      : <div className={`rd-proj-fallback ${project.theme}`}><span>{project.overlay?.title || project.name}</span></div>}
                    <div className="rd-shade" />
                    <div className="rd-txt">
                      <div className="rd-t">{project.name || project.overlay?.title || ""}</div>
                      <div className="rd-meta">
                        <span className={`rd-tag ${project.status === "Published" ? "live" : "draft"}`}>{project.status}</span>
                        {kind && <span className="rd-tag">{kind.tagLabel}</span>}
                        <span className="rd-edited">{editedLabel(project)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <section className="rd-reference">
              <div>
                <h2>Shared reference project</h2>
                <p>Try verified tools and dashboard controls while learning the workflow.</p>
              </div>
              <Link href="/reference">Explore reference project →</Link>
            </section>
          </div>
          <TipsCard />
        </div>
      </div>

      <footer className="rd-foot">
        <span>© 2026 TTF Creators Group — TTC Game Lab™. Creators own what they create here.</span>
        <Link href="/guide">How it works</Link>
        <Link href="/tutorial">How to use TTCGameLab</Link>
        <Link href="/reference">Practice project</Link>
        <Link href="/about">Who we are</Link>
        <Link href="/help">Help</Link>
        <Link href="/terms">Ownership &amp; Takedowns</Link>
        <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">Donate</a>
        <a href="mailto:admin@ttcgamelab.com">Contact</a>
      </footer>
    </main>
  );
}
