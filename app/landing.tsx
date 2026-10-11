import Link from "next/link";

/* Pre-signup landing page: explain the product, show what a creator builds,
   and answer the obvious questions before asking for an account. */

const page = {
  minHeight: "100vh",
  background: "#05060a",
  color: "#eef1f6",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 24px" };
const nav = { display: "flex", alignItems: "center", gap: 16, padding: "18px 0" };
const brand = { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" };
const brandMark = {
  width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center",
  background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a", fontWeight: 800,
};
const navLinks = { display: "flex", alignItems: "center", gap: 18, marginLeft: "auto", fontSize: 14 };
const navLink = { color: "#9aa3b5", textDecoration: "none" };
const primaryBtn = {
  display: "inline-block", background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a",
  fontWeight: 800, padding: "13px 26px", borderRadius: 12, textDecoration: "none", fontSize: 15,
};
const loginBtn = {
  display: "inline-block", border: "1px solid #2a3348", color: "#eef1f6",
  padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 14,
};
const signupBtn = { ...primaryBtn, padding: "9px 18px", fontSize: 14 };
const ghostBtn = {
  display: "inline-block", border: "1px solid #2a3348", color: "#eef1f6",
  padding: "13px 26px", borderRadius: 12, textDecoration: "none", fontWeight: 600, fontSize: 15,
};
const hero = {
  display: "flex", gap: 48, alignItems: "center", padding: "64px 0 72px", flexWrap: "wrap",
};
const heroCopy = { flex: "1 1 340px", minWidth: 0 };
const eyebrow = {
  display: "inline-block", fontSize: 12, letterSpacing: ".18em", color: "#20e8ff",
  border: "1px solid #1c3a44", borderRadius: 999, padding: "6px 14px", marginBottom: 20,
};
const h1 = { fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.06, margin: "0 0 18px", letterSpacing: "-.02em" };
const lede = { fontSize: 18, color: "#9aa3b5", margin: "0 0 28px", lineHeight: 1.65 };
const ctaRow = { display: "flex", gap: 12, flexWrap: "wrap" };
const trustLine = { color: "#7f8797", fontSize: 13, marginTop: 16 };

/* ---- Product mockup: audience overlay + host dashboard ---- */
const mockWrap = { flex: "1 1 420px", minWidth: 0 };
const mockCaption = { textAlign: "center", color: "#7f8797", fontSize: 12, letterSpacing: ".14em", margin: "0 0 10px" };
const overlayMock = {
  aspectRatio: "16 / 9", borderRadius: 14, overflow: "hidden", position: "relative",
  background: "radial-gradient(circle at 70% 20%, #1b2b4a 0%, #0a0f1e 55%, #05070d 100%)",
  border: "1px solid #2a3348", boxShadow: "0 24px 70px rgba(0,0,0,.5)",
};
const liveBadge = {
  position: "absolute", top: 10, left: 10, background: "#ff3b5c", color: "#fff",
  fontSize: 10, fontWeight: 800, letterSpacing: ".1em", padding: "4px 8px", borderRadius: 6,
};
const overlayTitle = {
  position: "absolute", top: 12, left: 0, right: 0, textAlign: "center",
  color: "#20e8ff", fontWeight: 900, letterSpacing: ".22em", fontSize: 13,
};
const triviaGrid = {
  position: "absolute", top: "22%", left: "8%", right: "8%", bottom: "30%",
  display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "auto repeat(4, 1fr)", gap: 6,
};
const triviaCat = {
  color: "#aeb8cc", fontSize: 9, fontWeight: 700, textAlign: "center",
  letterSpacing: ".06em", alignSelf: "end", paddingBottom: 2,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const triviaTile = {
  border: "1px solid #2e3d5c", borderRadius: 6, display: "grid", placeItems: "center",
  color: "#ffd76a", fontWeight: 800, fontSize: 12, background: "rgba(20,30,55,.75)",
};
const scoreStrip = {
  position: "absolute", left: "8%", right: "8%", bottom: "7%", display: "flex", gap: 8,
};
const scoreChip = {
  flex: 1, border: "1px solid #2e3d5c", borderRadius: 8, padding: "6px 10px",
  background: "rgba(10,16,30,.8)", fontSize: 11, color: "#dfe5ee",
  display: "flex", justifyContent: "space-between", alignItems: "center",
};
const dashMock = {
  marginTop: 14, border: "1px solid #2a3348", borderRadius: 14, background: "#0b0d14", padding: 16,
};
const dashTitle = { fontSize: 11, letterSpacing: ".14em", color: "#7f8797", fontWeight: 700, marginBottom: 10 };
const dashBtns = { display: "flex", gap: 8, flexWrap: "wrap" };
const dashBtn = {
  border: "1px solid rgba(32,232,255,.4)", background: "rgba(32,232,255,.07)", color: "#baf8ff",
  borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700,
};

const section = { padding: "24px 0 64px" };
const sectionTitle = { fontSize: "clamp(26px, 3.4vw, 36px)", margin: "0 0 12px", letterSpacing: "-.01em", textAlign: "center" };
const sectionSub = { color: "#9aa3b5", textAlign: "center", maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.65, fontSize: 16 };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 };
const card = { border: "1px solid #20263a", borderRadius: 16, padding: 24, background: "#0b0d14" };
const cardIcon = { fontSize: 28, marginBottom: 12 };
const cardTitle = { fontSize: 18, margin: "0 0 8px" };
const cardText = { color: "#9aa3b5", fontSize: 14, lineHeight: 1.65, margin: 0 };
const stepNum = {
  width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center",
  background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a", fontWeight: 800, marginBottom: 14,
};
const faqItem = {
  border: "1px solid #20263a", borderRadius: 12, background: "#0b0d14",
  padding: "16px 20px", marginBottom: 10,
};
const faqQ = { fontWeight: 700, fontSize: 16, cursor: "pointer", color: "#eef1f6" };
const faqA = { color: "#9aa3b5", fontSize: 15, lineHeight: 1.7, margin: "10px 0 0" };
const needBox = {
  border: "1px solid #2a3a2e", borderRadius: 16, padding: 24, background: "#0c100c",
  margin: "0 0 64px",
};
const finalCta = {
  textAlign: "center", border: "1px solid #1c3a44", borderRadius: 20,
  background: "radial-gradient(circle at 50% 0%, rgba(32,232,255,.08), transparent 60%), #0a0d13",
  padding: "56px 24px", marginBottom: 64,
};
const footer = {
  borderTop: "1px solid #1a2030", padding: "24px 0 40px", color: "#7f8797", fontSize: 13,
  display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
};

const EXAMPLES = [
  { icon: "🎯", title: "Trivia & quiz nights", text: "A question board on screen. You press one button to reveal each question, another for the answer. Scores update live." },
  { icon: "🎁", title: "Prize draws & giveaways", text: "Spinning wheels and random pickers that draw from your own image or prize pools — no repeats until you reset." },
  { icon: "📊", title: "Polls & predictions", text: "Let your audience vote on what happens next, then reveal the results on the overlay with a single press." },
  { icon: "🏆", title: "Challenges & scoreboards", text: "Team-vs-team scoring, countdowns and challenge trackers that everyone can see. Update them from your dashboard." },
  { icon: "🎬", title: "Media moments", text: "Intros, reveals, sound effects, music and voiceovers — generated or uploaded — triggered exactly when you want them." },
  { icon: "✨", title: "Your own format", text: "A talk segment, a live tutorial, a watch party — describe your idea in plain language and the AI sets up the dashboard, overlay and interactions. No code, ever." },
];

const FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. Describe your show in plain language and the AI builds the dashboard, overlay and interactions. Everything is point-and-click after that.",
  },
  {
    q: "What do I need to actually stream?",
    a: "A PC running TikTok Live Studio (or similar streaming software), a TikTok account that can go LIVE, and the overlay added as a browser source at 1920 × 1080. Building and rehearsing works on any device.",
  },
  {
    q: "Can anything go live before I'm ready?",
    a: "No. Everything you build is a private draft. Nothing reaches your stream until you explicitly choose Publish — and you can rehearse the whole show first.",
  },
  {
    q: "Do my viewers need to install anything?",
    a: "No. Viewers just watch your TikTok LIVE as normal. The overlay is part of your stream picture; the dashboard is only on your side.",
  },
  {
    q: "Can I try it before creating an account?",
    a: "Yes. The practice project lets you press real dashboard buttons and watch a preview react, and the narrated walkthrough shows the full workflow — both with no account required.",
  },
];

function ProductMockup() {
  const cats = ["MOVIES", "MUSIC", "SPORTS", "GAMES", "WILD"];
  const values = [100, 200, 300, 400];
  return (
    <div style={mockWrap}>
      <p style={mockCaption}>AUDIENCE OVERLAY · WHAT YOUR VIEWERS SEE</p>
      <div style={overlayMock}>
        <span style={liveBadge}>● LIVE</span>
        <div style={overlayTitle}>NEON TRIVIA NIGHT</div>
        <div style={triviaGrid}>
          {cats.map(c => <div key={c} style={triviaCat}>{c}</div>)}
          {values.flatMap(v => cats.map(c => <div key={c + v} style={triviaTile}>${v}</div>))}
        </div>
        <div style={scoreStrip}>
          <div style={scoreChip}><span>🔴 Red Team</span><strong>1,200</strong></div>
          <div style={scoreChip}><span>🔵 Blue Team</span><strong>950</strong></div>
        </div>
      </div>
      <div style={dashMock}>
        <div style={dashTitle}>HOST DASHBOARD · YOUR PRIVATE CONTROLS</div>
        <div style={dashBtns}>
          <span style={dashBtn}>Show question</span>
          <span style={dashBtn}>Reveal answer</span>
          <span style={dashBtn}>＋ Red scores</span>
          <span style={dashBtn}>Draw prize</span>
          <span style={dashBtn}>Play intro</span>
        </div>
      </div>
    </div>
  );
}

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
            <Link href="/auth/sign-in" style={loginBtn}>Log in</Link>
            <Link href="/auth/sign-up" style={signupBtn}>Create account</Link>
          </div>
        </nav>

        <section style={hero}>
          <div style={heroCopy}>
            <span style={eyebrow}>✦ FOR TIKTOK LIVE CREATORS</span>
            <h1 style={h1}>Turn your livestream into an interactive experience for your audience</h1>
            <p style={lede}>
              TTCGameLab builds you two things: a <strong style={{ color: "#eef1f6" }}>private host dashboard</strong> with
              buttons that run your stream, and an <strong style={{ color: "#eef1f6" }}>audience overlay</strong> your viewers
              see. Polls, reveals, giveaways, live challenges — you press the buttons, your audience joins in.
            </p>
            <div style={ctaRow}>
              <Link href="/auth/sign-up" style={primaryBtn}>Start building free</Link>
              <Link href="/reference" style={ghostBtn}>Try the live demo</Link>
            </div>
            <p style={trustLine}>No code · Nothing goes live until you publish · Try before you sign up</p>
            <p style={{ color: "#7f8797", fontSize: 13, marginTop: 8 }}>Already have an account? <Link href="/auth/sign-in" style={{ color: "#20e8ff", fontWeight: 700 }}>Log in →</Link></p>
          </div>
          <ProductMockup />
        </section>

        <section style={section} aria-label="What you can build">
          <h2 style={sectionTitle}>What will you create?</h2>
          <p style={sectionSub}>Real formats creators run with TTCGameLab. Describe yours in plain language and the AI sets up the dashboard, overlay and interactions.</p>
          <div style={cardGrid}>
            {EXAMPLES.map(e => (
              <div key={e.title} style={card}>
                <div style={cardIcon}>{e.icon}</div>
                <h3 style={cardTitle}>{e.title}</h3>
                <p style={cardText}>{e.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={section} aria-label="How it works">
          <h2 style={sectionTitle}>From idea to live in three steps</h2>
          <p style={sectionSub}>You stay in control at every step. AI does the heavy lifting; you make the calls.</p>
          <div style={cardGrid}>
            <div style={card}>
              <div style={stepNum}>1</div>
              <h3 style={cardTitle}>Workshop — create your materials</h3>
              <p style={cardText}>Generate or upload images, video, voice and music. Build question boards, wheels, scoreboards and prize pools — with AI help or by hand.</p>
            </div>
            <div style={card}>
              <div style={stepNum}>2</div>
              <h3 style={cardTitle}>Build Space — assemble the show</h3>
              <p style={cardText}>Arrange the 1920 × 1080 audience overlay and connect dashboard buttons that trigger each moment. Rehearse the whole thing privately.</p>
            </div>
            <div style={card}>
              <div style={stepNum}>3</div>
              <h3 style={cardTitle}>Publish — go live when you choose</h3>
              <p style={cardText}>When the rehearsal feels right, publish and add the overlay as a browser source in TikTok Live Studio. Your dashboard runs the show.</p>
            </div>
          </div>
        </section>

        <section style={needBox} aria-label="What you need">
          <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>🖥️ What you need to stream</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#c7cdd8", lineHeight: 1.9, fontSize: 15 }}>
            <li>A PC running <strong>TikTok Live Studio</strong> (or similar streaming software).</li>
            <li>The audience overlay added as a <strong>browser source at 1920 × 1080</strong>.</li>
            <li>A TikTok account that can go LIVE.</li>
          </ul>
          <p style={{ color: "#9aa3b5", fontSize: 14, margin: "12px 0 0" }}>
            Building and rehearsing works anywhere — the overlay itself is designed for a desktop streaming setup.
          </p>
        </section>

        <section style={section} aria-label="Frequently asked questions">
          <h2 style={sectionTitle}>Questions new creators ask</h2>
          <p style={sectionSub}>The short answers, before you create an account.</p>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {FAQS.map(f => (
              <details key={f.q} style={faqItem}>
                <summary style={faqQ}>{f.q}</summary>
                <p style={faqA}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section style={finalCta}>
          <h2 style={{ fontSize: "clamp(26px, 3.4vw, 38px)", margin: "0 0 14px", letterSpacing: "-.01em" }}>Your audience is ready to join in.</h2>
          <p style={{ color: "#9aa3b5", maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.65 }}>
            Start with the practice project to feel how an interactive stream runs, or jump in and describe
            the experience you want to create.
          </p>
          <div style={{ ...ctaRow, justifyContent: "center" }}>
            <Link href="/auth/sign-up" style={primaryBtn}>Create your account</Link>
            <Link href="/reference" style={ghostBtn}>Try the practice project</Link>
          </div>
        </section>

        <footer style={footer}>
          <span>© TTCGameLab</span>
          <Link href="/guide" style={navLink}>How it works</Link>
          <Link href="/reference" style={navLink}>Practice project</Link>
          <Link href="/auth/sign-in" style={navLink}>Log in</Link>
        </footer>
      </div>
    </main>
  );
}
