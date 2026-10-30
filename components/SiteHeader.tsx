"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

/**
 * The one public header, shared by the landing page, Who we are, and Help
 * so every public page carries the same brand and the same links.
 */
const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL || "https://buy.stripe.com/8x25kwaJhdu23J95UGawo00";

const nav: CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "18px 0" };
const brand: CSSProperties = { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" };
const brandMark: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center",
  background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a", fontWeight: 800,
};
const navLinks: CSSProperties = { display: "flex", alignItems: "center", gap: 18, marginLeft: "auto", fontSize: 14 };
const navLink: CSSProperties = { color: "#9aa3b5", textDecoration: "none" };
const loginBtn: CSSProperties = {
  display: "inline-block", border: "1px solid #2a3348", color: "#eef1f6",
  padding: "9px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 14,
};
const signupBtn: CSSProperties = {
  display: "inline-block", background: "linear-gradient(135deg,#20e8ff,#7a5cff)", color: "#04121a",
  fontWeight: 800, padding: "9px 18px", borderRadius: 12, textDecoration: "none", fontSize: 14,
};

export default function SiteHeader() {
  return (
    <nav style={nav} aria-label="Site">
      <Link href="/" style={brand}>
        <span style={brandMark}>TT</span>
        <span><strong>TTCGameLab</strong><br /><small style={{ color: "#7f8797", fontSize: 11, letterSpacing: ".12em" }}>LIVE CREATIVE STUDIO</small></span>
      </Link>
      <div style={navLinks}>
        <Link href="/guide" style={navLink}>How it works</Link>
        <Link href="/reference" style={navLink}>Practice project</Link>
        <Link href="/about" style={navLink}>Who we are</Link>
        <Link href="/help" style={navLink}>Help</Link>
        <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" style={navLink}>Donate</a>
        <Link href="/auth/sign-in" style={loginBtn}>Log in</Link>
        <Link href="/auth/sign-up" style={signupBtn}>Create account</Link>
      </div>
    </nav>
  );
}
