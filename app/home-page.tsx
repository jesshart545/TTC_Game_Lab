"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SignOutButton from "./sign-out-button";
import { TipsCard } from "./workspace-home";
import "./home.css";

/* The main site HOME page — the front door every signed-in creator lands
   on (Jessica, 2026-11-15). Brand up front, news about what has been
   added to the site, upcoming features to look out for, the Tips &
   Tricks slides, a prominent Donate section, and the nav and buttons
   onward: My Projects (the library), New project, FAQs and Contact Us
   (both on /help). The projects grid itself is NOT the landing — it
   lives at /projects. The AI assistant is not here; she lives inside
   projects. (The two big picture door cards that first shipped here
   were removed later on 2026-11-15 at Jessica's direction — the nav
   and buttons already do that job.) */

const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL || "https://buy.stripe.com/8x25kwaJhdu23J95UGawo00";

const NEWS = [
  {
    img: "/redesign/kind-multiplayer.webp",
    t: "Game Night templates are here",
    d: "Seven pictured games to start from: Bingo, Quiz Board, Survey Showdown, Perfect Match, Word Chain, Draw & Guess, and Property Tycoon. Pick one and make it yours.",
  },
];

const COMING_SOON = [
  {
    t: "Game Night opens to everyone",
    d: "Off-stream multiplayer game nights are in final testing — soon every creator can host one.",
  },
  {
    t: "More painted game faces",
    d: "The wheel, Higher or Lower, and Cliffhanger are getting the full-artwork treatment next.",
  },
];

export default function HomePage() {
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

  const initial = (accountEmail.trim()[0] || "C").toUpperCase();

  return (
    <main className="rd-home">
      <header className="rd-top">
        <Link href="/" className="rd-logo display">TTC <span>GAME LAB</span></Link>
        <nav className="rd-nav" aria-label="Workspace">
          <Link href="/" className="on">Home</Link>
          <Link href="/projects">My Projects</Link>
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
        <h1 className="rd-h1 display">TTC Game Lab</h1>
        <p className="rd-tagline">Turning ideas into experiences</p>
        <p className="rd-homelede">
          This is home base — what&apos;s new on the site, what&apos;s coming next,
          and the way to everything you make here.
        </p>

        <div className="rd-cols">
          <section aria-label="Site news">
            <div className="rd-seclabel">New on the site</div>
            <div className="rd-news">
              {NEWS.map(item => (
                <article className="rd-news-card" key={item.t}>
                  <div className="rd-news-imgwrap"><img src={item.img} alt="" /></div>
                  <div className="rd-news-body">
                    <div className="rd-news-t">{item.t}</div>
                    <p className="rd-news-d">{item.d}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <TipsCard />
        </div>

        <section aria-label="Coming soon" className="rd-soonwrap">
          <div className="rd-seclabel">Coming soon — look out for</div>
          <div className="rd-soon">
            {COMING_SOON.map(item => (
              <article className="rd-soon-card" key={item.t}>
                <span className="rd-soon-star" aria-hidden="true">✦</span>
                <div>
                  <div className="rd-news-t">{item.t}</div>
                  <p className="rd-news-d">{item.d}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Donate" className="rd-donate">
          <div className="rd-seclabel">Support the lab</div>
          <h2 className="rd-donate-h">Donate — keep TTC Game Lab free</h2>
          <p className="rd-donate-p">
            The site is free to use, and donations help keep it that way. They cover the
            servers that keep your shows online, the AI that generates your images, video,
            voice and music, and the work of building new features. Tap Donate, choose any
            amount on the secure page, and give what you like — every bit genuinely helps.
          </p>
          <div className="rd-donate-row">
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="rd-donatebtn">Donate</a>
            <Link href="/about" className="rd-donate-story">Our story — Who we are →</Link>
          </div>
          <p className="rd-donate-fine">
            Donations are voluntary and support the site itself — they don&apos;t buy credits
            or features. TTC Game Lab is an independent project, not a registered nonprofit,
            so donations aren&apos;t tax-deductible.
          </p>
        </section>

        <section aria-label="Help and contact" className="rd-helpdoors">
          <Link href="/help" className="rd-helpdoor">
            <div className="rd-news-t">FAQs</div>
            <p className="rd-news-d">Quick answers and the step-by-step walkthrough live on the Help page.</p>
          </Link>
          <Link href="/help" className="rd-helpdoor">
            <div className="rd-news-t">Contact Us</div>
            <p className="rd-news-d">Reach the company at admin@ttcgamelab.com or 901-501-6378, or send a message from the Help page.</p>
          </Link>
        </section>
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
