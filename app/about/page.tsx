"use client";

import Link from "next/link";

/**
 * Donation link configuration.
 * Set NEXT_PUBLIC_DONATE_URL (e.g. a Stripe payment link, Ko-fi or PayPal URL)
 * to enable the donate button. Until then the page shows a "coming soon" note.
 */
const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL || "";

const shell: React.CSSProperties = {
  minHeight: "100vh", background: "radial-gradient(1200px 600px at 80% -10%, #16233d 0%, #0b0f1a 55%, #070a12 100%)",
  color: "#eef1f6", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "0 24px 80px" };
const nav: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "20px 0", maxWidth: 1080, margin: "0 auto",
};
const brand: React.CSSProperties = { fontWeight: 800, fontSize: 18, color: "#fff", textDecoration: "none" };
const navLink: React.CSSProperties = { color: "#9aa3b5", textDecoration: "none", fontSize: 14, marginLeft: 20 };
const h1: React.CSSProperties = { fontSize: "clamp(32px, 5vw, 48px)", margin: "48px 0 16px", letterSpacing: "-.02em" };
const lede: React.CSSProperties = { color: "#9aa3b5", fontSize: 17, lineHeight: 1.7, margin: "0 0 20px" };
const h2: React.CSSProperties = { fontSize: 24, margin: "48px 0 12px", letterSpacing: "-.01em" };
const card: React.CSSProperties = {
  background: "#101828", border: "1px solid #1d2740", borderRadius: 16, padding: 32, marginTop: 16,
};
const donateBtn: React.CSSProperties = {
  display: "inline-block", background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a",
  fontWeight: 800, padding: "14px 34px", borderRadius: 12, textDecoration: "none", fontSize: 16,
};
const fine: React.CSSProperties = { color: "#7f8797", fontSize: 13, lineHeight: 1.6, marginTop: 16 };
const list: React.CSSProperties = { color: "#9aa3b5", lineHeight: 1.8, paddingLeft: 20, margin: "12px 0" };

export default function AboutPage() {
  return (
    <div style={shell}>
      <nav style={nav}>
        <Link href="/" style={brand}>TTC Game Lab</Link>
        <div>
          <Link href="/guide" style={navLink}>How it works</Link>
          <Link href="/auth/sign-in" style={navLink}>Log in</Link>
        </div>
      </nav>

      <main style={wrap}>
        <h1 style={h1}>Who we are</h1>
        <p style={lede}>
          TTC Game Lab was inspired by a supporter who watched her creator friends give everything
          to their streams — and wanted to help them optimize their lives around it. When
          you&rsquo;re live every day, saturation sets in: the same formats, the same grind,
          the same ceiling. She believed everyday creators deserved better than burnout for
          average output.
        </p>
        <p style={lede}>
          Her vision was simple: studio-quality output within reach of the everyday creator —
          no production team, no big budget, no code. So this was built for them, and for the
          💜 TTF 💜 family on TikTok: describe the interactive show you want — trivia nights,
          giveaways, polls, live challenges — and get a host dashboard plus an audience overlay
          that make it real. Then go live.
        </p>
        <p style={lede}>
          The site is free to use, and we&rsquo;d like to keep it that way. If TTC Game Lab has made
          your streams better, a donation helps keep it running and growing.
        </p>

        <h2 style={h2}>What donations support</h2>
        <ul style={list}>
          <li><strong style={{ color: "#eef1f6" }}>Keeping the lights on</strong> — servers and hosting so your projects and overlays stay online.</li>
          <li><strong style={{ color: "#eef1f6" }}>AI generation costs</strong> — the images, video, voice and music features run on paid AI services.</li>
          <li><strong style={{ color: "#eef1f6" }}>New features</strong> — more game tools, more overlay options, and everything on the roadmap.</li>
        </ul>

        <div style={card}>
          <h2 style={{ ...h2, marginTop: 0 }}>Support TTC Game Lab</h2>
          <p style={lede}>
            Donations are voluntary and go directly toward running and improving the site.
            Every contribution — large or small — genuinely helps.
          </p>
          {DONATE_URL ? (
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" style={donateBtn}>
              Donate
            </a>
          ) : (
            <p style={{ ...lede, marginBottom: 0 }}>
              Online donations are being set up right now — please check back soon.
            </p>
          )}
          <p style={fine}>
            TTC Game Lab is an independent project, not a registered nonprofit, so donations
            aren&rsquo;t tax-deductible. Donations support the site itself and aren&rsquo;t a purchase —
            they don&rsquo;t buy credits or features.
          </p>
        </div>

        <p style={{ ...fine, marginTop: 40, textAlign: "center" }}>
          <Link href="/" style={{ color: "#9aa3b5" }}>Home</Link>
          {" · "}
          <Link href="/guide" style={{ color: "#9aa3b5" }}>How it works</Link>
          {" · "}
          <Link href="/reference" style={{ color: "#9aa3b5" }}>Practice project</Link>
        </p>
      </main>
    </div>
  );
}
