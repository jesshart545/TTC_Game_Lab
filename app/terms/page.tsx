"use client";

import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";

const shell: React.CSSProperties = {
  minHeight: "100vh", background: "radial-gradient(1200px 600px at 80% -10%, #16233d 0%, #0b0f1a 55%, #070a12 100%)",
  color: "#eef1f6", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "0 24px 80px" };
const h1: React.CSSProperties = { fontSize: "clamp(32px, 5vw, 48px)", margin: "48px 0 16px", letterSpacing: "-.02em" };
const lede: React.CSSProperties = { color: "#9aa3b5", fontSize: 17, lineHeight: 1.7, margin: "0 0 20px" };
const h2: React.CSSProperties = { fontSize: 24, margin: "48px 0 12px", letterSpacing: "-.01em" };
const fine: React.CSSProperties = { color: "#7f8797", fontSize: 13, lineHeight: 1.6, marginTop: 16 };
const list: React.CSSProperties = { color: "#9aa3b5", lineHeight: 1.8, paddingLeft: 20, margin: "12px 0" };

export default function TermsPage() {
  return (
    <div style={shell}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}><SiteHeader /></div>

      <main style={wrap}>
        <h1 style={h1}>Ownership, Use &amp; Takedowns</h1>
        <p style={lede}>
          Plain and simple: what you create here is yours, what we built is ours, and nobody
          gets to take either one without permission. This page explains who owns what, what
          is not allowed, and how to report a copy of your work if you find one.
        </p>

        <h2 style={h2}>What you create is yours</h2>
        <p style={lede}>
          Everything you create on TTC Game Lab stays yours — your projects, images, videos,
          music, voice clips, and any other materials you make or upload here. Using the site
          does not hand your work over to us or to anyone else.
        </p>

        <h2 style={h2}>What belongs to TTF Creators Group</h2>
        <p style={lede}>
          TTF Creators Group owns the site&rsquo;s own materials: the TTC Game Lab name and
          crest, the site design, the templates the site provides, its text, and its software.
        </p>

        <h2 style={h2}>What nobody may do</h2>
        <p style={lede}>
          Nobody may copy, reuse, repost, sell, or redistribute another creator&rsquo;s
          creations — or TTF Creators Group&rsquo;s materials — without the owner&rsquo;s
          written permission. If you did not make it and you do not have permission, you may
          not use it.
        </p>

        <h2 style={h2}>Your proof of creation</h2>
        <p style={lede}>
          Everything made here is automatically recorded with its creation date and a file
          fingerprint in the project&rsquo;s saved history. That record stays with the
          project, and the owner can use it as proof of ownership and of when the work was
          created.
        </p>

        <h2 style={h2}>Report misuse</h2>
        <p style={lede}>
          If you find your work copied somewhere it should not be, email{" "}
          <a href="mailto:admin@ttcgamelab.com" style={{ color: "#20e8ff" }}>admin@ttcgamelab.com</a>{" "}
          with:
        </p>
        <ul style={list}>
          <li>Your name and how to reach you.</li>
          <li>Which of your works was copied, and when you created it here.</li>
          <li>The exact link to the page where the copy appears.</li>
          <li>A statement that the work is yours and you did not give permission for it to be used there.</li>
        </ul>
        <p style={lede}>
          We review every report. We will help the owner put together the proof from the
          project&rsquo;s saved history and file the takedown with the platform where the
          copy appears.
        </p>

        <p style={{ ...fine, marginTop: 40, textAlign: "center" }}>
          <Link href="/" style={{ color: "#9aa3b5" }}>Home</Link>
          {" · "}
          <Link href="/guide" style={{ color: "#9aa3b5" }}>How it works</Link>
          {" · "}
          <Link href="/about" style={{ color: "#9aa3b5" }}>Who we are</Link>
          {" · "}
          <Link href="/help" style={{ color: "#9aa3b5" }}>Help</Link>
        </p>
        <p style={{ ...fine, textAlign: "center" }}>© 2026 TTF Creators Group</p>
      </main>
    </div>
  );
}
