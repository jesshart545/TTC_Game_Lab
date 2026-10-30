"use client";

import Link from "next/link";
import { FormEvent, use, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../../lib/auth/client";

export default function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const router = useRouter();
  const { path } = use(params);
  const [mode, setModeState] = useState<"sign-in" | "sign-up" | "forgot">(path === "sign-up" ? "sign-up" : path === "forgot-password" ? "forgot" : "sign-in");

  function setMode(next: "sign-in" | "sign-up" | "forgot") {
    setModeState(next);
    setError("");
    setSent(false);
    window.history.replaceState(null, "", `/auth/${next === "forgot" ? "forgot-password" : next}`);
  }
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "forgot") {
        const result: any = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/auth/reset-password` });
        if (result?.error) throw new Error(result.error.message || "The reset link could not be sent.");
        setSent(true);
        return;
      }
      const result: any = mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result?.error) throw new Error(result.error.message || "Authentication failed.");
      router.replace("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page" style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#05060a",color:"white",padding:24}}>
    <section style={{width:"min(440px,100%)",border:"1px solid #262b3b",borderRadius:20,padding:32,background:"#0b0d14"}}>
      <div style={{fontWeight:800,fontSize:22,marginBottom:6}}>Welcome to TTCGameLab</div>
      <p style={{color:"#9aa3b5",marginTop:0}}>{mode === "sign-up" ? "Create your private creator workspace" : mode === "forgot" ? "Reset your password" : "Sign in to your private creator workspace"}</p>
      {mode !== "forgot" && <div className="auth-tabs" role="group" aria-label="Account access">
        <button aria-pressed={mode === "sign-in"} disabled={busy} onClick={()=>setMode("sign-in")} type="button">Sign in</button>
        <button aria-pressed={mode === "sign-up"} disabled={busy} onClick={()=>setMode("sign-up")} type="button">Create account</button>
      </div>}
      {mode === "forgot" && sent ? <div style={{display:"grid",gap:14}}>
        <p role="status" style={{color:"#dfe5ee",margin:0,lineHeight:1.6}}>If an account exists for that email, a reset link is on its way. Check your inbox and follow the link to set a new password.</p>
        <button className="auth-submit" onClick={()=>setMode("sign-in")} type="button">Back to sign in</button>
      </div> : <form onSubmit={submit} style={{display:"grid",gap:14}}>
        {mode === "sign-up" && <label htmlFor="auth-name">Display name<input id="auth-name" name="name" autoComplete="name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Your display name" /></label>}
        <label htmlFor="auth-email">Email<input id="auth-email" name="email" autoComplete="email" required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
        {mode !== "forgot" && <label htmlFor="auth-password">Password<input id="auth-password" name="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" /></label>}
        {mode === "sign-up" && <p style={{color:"#7f8797",fontSize:12,margin:"-6px 0 0"}}>Use at least 8 characters.</p>}
        {mode === "forgot" && <p style={{color:"#7f8797",fontSize:12,margin:"-6px 0 0"}}>We will email you a link to set a new password.</p>}
        {error && <p role="alert" style={{color:"#ff7b91",margin:0}}>{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Email me a reset link" : "Sign in"}</button>
        {mode === "sign-in" && <button onClick={()=>setMode("forgot")} type="button" style={{background:"none",border:"none",color:"#9aa3b5",fontSize:13,cursor:"pointer",justifySelf:"end",padding:0}}>Forgot password?</button>}
        {mode === "forgot" && <button onClick={()=>setMode("sign-in")} type="button" style={{background:"none",border:"none",color:"#9aa3b5",fontSize:13,cursor:"pointer",justifySelf:"start",padding:0}}>← Back to sign in</button>}
      </form>}
      <p style={{color:"#7f8797",fontSize:13,marginTop:20}}>Your projects and assets belong to your account.</p>
      <div style={{marginTop:16,padding:14,border:"1px solid #2a3a2e",borderRadius:12,background:"#0a0f0a"}}>
        <p style={{color:"#dfe5ee",fontSize:13,fontWeight:700,margin:"0 0 8px"}}>🖥️ To take your overlay live you will need:</p>
        <ul style={{color:"#9aa3b5",fontSize:13,margin:0,paddingLeft:18,lineHeight:1.8}}>
          <li>A PC running TikTok Live Studio</li>
          <li>The overlay added as a browser source at 1920 × 1080</li>
        </ul>
      </div>
      <p style={{marginTop:16}}><Link href="/guide" style={{color:"#9aa3b5",fontSize:13}}>How TTCGameLab works — no account needed</Link></p>
    </section>
  </main>;
}
