"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authClient } from "../../../lib/auth/client";

export default function AuthPage() {
  const params = useParams<{ path: string }>();
  const router = useRouter();
  const signUp = params.path === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result: any = signUp
      ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result?.error) {
      setError(result.error.message || "Authentication failed.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-logo">TT</div>
      <div className="eyebrow">✦ TTCGAMELAB CREATOR ACCESS</div>
      <h1>{signUp ? "Create your account" : "Welcome back"}</h1>
      <p>{signUp ? "Your projects and creative assets stay private to your account." : "Sign in to open your private creator workspace."}</p>
      <form onSubmit={submit}>
        {signUp && <label>Display name<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}
        <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={signUp ? "new-password" : "current-password"} /></label>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}</button>
      </form>
      <div className="auth-switch">{signUp ? <>Already have an account? <Link href="/auth/sign-in">Sign in</Link></> : <>Need an account? <Link href="/auth/sign-up">Create one</Link></>}</div>
    </section>
  </main>;
}
