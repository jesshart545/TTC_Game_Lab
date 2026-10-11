import Link from "next/link";

const page = {
  minHeight: "100vh",
  background: "#05060a",
  color: "#eef1f6",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const nav = {
  display: "flex", alignItems: "center", gap: 16, padding: "18px 0",
};
const brand = { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" };
const brandMark = {
  width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center",
  background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a", fontWeight: 800,
};
const navLinks = { display: "flex", alignItems: "center", gap: 18, marginLeft: "auto", fontSize: 14 };
const navLink = { color: "#9aa3b5", textDecoration: "none" };
const primaryBtn = {
  display: "inline-block", background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a",
  fontWeight: 800, padding: "12px 22px", borderRadius: 12, textDecoration: "none",
};
const ghostBtn = {
  display: "inline-block", border: "1px solid #2a3348", color: "#eef1f6",
  padding: "12px 22px", borderRadius: 12, textDecoration: "none", fontWeight: 600,
};
const hero = { padding: "72px 0 56px", textAlign: "center" };
const eyebrow = {
  display: "inline-block", fontSize: 12, letterSpacing: ".18em", color: "#20e8ff",
  border: "1px solid #1c3a44", borderRadius: 999, padding: "6px 14px", marginBottom: 20,
};
const h1 = { fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.08, margin: "0 0 16px", letterSpacing: "-.02em" };
const lede = { fontSize: 18, color: "#9aa3b5", maxWidth: 680, margin: "0 auto 28px", lineHeight: 1.6 };
const ctaRow = { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" };
const steps = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16, padding: "8px 0 56px",
};
const card = {
  border: "1px solid #20263a", borderRadius: 16, padding: 24, background: "#0b0d14",
};
const cardStep = { fontSize: 12, letterSpacing: ".14em", color: "#20e8ff", fontWeight: 700 };
const cardTitle = { fontSize: 20, margin: "8px 0" };
const cardText = { color: "#9aa3b5", fontSize: 15, lineHeight: 1.6, margin: 0 };
const needBox = {
  border: "1px solid #2a3a2e", borderRadius: 16, padding: 24, background: "#0c100c", marginBottom: 56,
};
const needTitle = { fontSize: 18, margin: "0 0 12px" };
const needList = { margin: 0, paddingLeft: 20, color: "#c7cdd8", lineHeight: 1.9, fontSize: 15 };
const trySection = { textAlign: "center", padding: "0 0 72px" };
const footer = {
  borderTop: "1px solid #1a2030", padding: "24px 0 40px", color: "#7f8797", fontSize: 13,
  display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
};

export default function LandingPage() {
  return (
    <main style={page}>
      <div style={wrap}>
        <nav style={nav} aria-label="Site">
          <Link href="/" style={brand}>
            <span style={brandMark}>TT</span>
            <span><strong>TTCGameLab</strong><br /><small style={{ color: "#7f8797", fontSize: 11, letterSpacing: ".12em" }}>LIVE CREATIVE STUDIO</small></span>
          </Link>
          <div style={navLinks}>
            <Link href="/guide" style={navLink}>How it works</Link>
            <Link href="/reference" style={navLink}>Practice project</Link>
            <Link href="/auth/sign-in" style={navLink}>Sign in</Link>
            <Link href="/auth/sign-up" style={{ ...primaryBtn, padding: "9px 18px" }}>Create account</Link>
          </div>
        </nav>

        <section style={hero}>
          <span style={eyebrow}>✦ AI-POWERED LIVESTREAM CREATION</span>
          <h1 style={h1}>Build interactive TikTok LIVE experiences</h1>
          <p style={lede}>
            TTCGameLab is an AI creative studio for TikTok LIVE creators. Describe your show idea and get a
            working host dashboard plus an audience overlay — trivia, polls, scoreboards, prize draws, videos
            and music — ready for your livestream.
          </p>
          <div style={ctaRow}>
            <Link href="/auth/sign-up" style={primaryBtn}>Create your account</Link>
            <Link href="/reference" style={ghostBtn}>Try the practice project</Link>
          </div>
        </section>

        <section aria-label="How it works" style={steps}>
          <div style={card}>
            <div style={cardStep}>STEP 1 · WORKSHOP</div>
            <h2 style={cardTitle}>Create your materials</h2>
            <p style={cardText}>Generate or upload images, videos, voice and music, and build game tools like trivia boards, wheels and scoreboards — with AI help or by hand.</p>
          </div>
          <div style={card}>
            <div style={cardStep}>STEP 2 · BUILD SPACE</div>
            <h2 style={cardTitle}>Assemble the show</h2>
            <p style={cardText}>Arrange the 1920 × 1080 audience overlay and connect dashboard buttons that trigger each moment during your stream.</p>
          </div>
          <div style={card}>
            <div style={cardStep}>STEP 3 · PUBLISH</div>
            <h2 style={cardTitle}>Go live when you choose</h2>
            <p style={cardText}>Rehearse everything first. Nothing goes live until you choose Publish — then open the overlay as a browser source in your streaming software.</p>
          </div>
        </section>

        <section aria-label="What you need" style={needBox}>
          <h2 style={needTitle}>🖥️ What you need to stream</h2>
          <ul style={needList}>
            <li>A PC running <strong>TikTok Live Studio</strong> (or similar streaming software).</li>
            <li>Add the audience overlay as a <strong>browser source at 1920 × 1080</strong>.</li>
            <li>A TikTok account that can go LIVE.</li>
          </ul>
          <p style={{ color: "#9aa3b5", fontSize: 14, margin: "12px 0 0" }}>
            Building and rehearsing works anywhere — the overlay itself is designed for a desktop streaming setup.
          </p>
        </section>

        <section style={trySection}>
          <h2 style={{ fontSize: 26, margin: "0 0 12px" }}>See it before you sign up</h2>
          <p style={{ color: "#9aa3b5", maxWidth: 620, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Explore a working example project with safe practice controls, or take the narrated
            step-by-step walkthrough — no account required.
          </p>
          <div style={ctaRow}>
            <Link href="/reference" style={ghostBtn}>Open the practice project</Link>
            <Link href="/guide" style={ghostBtn}>Watch the walkthrough</Link>
          </div>
        </section>

        <footer style={footer}>
          <span>© TTCGameLab</span>
          <Link href="/guide" style={navLink}>How it works</Link>
          <Link href="/auth/sign-in" style={navLink}>Sign in</Link>
        </footer>
      </div>
    </main>
  );
}
