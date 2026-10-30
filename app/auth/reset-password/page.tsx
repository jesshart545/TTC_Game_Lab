"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "../../../lib/auth/client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const linkError = searchParams.get("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true); setError("");
    try {
      const result: any = await authClient.resetPassword({ newPassword: password, token });
      if (result?.error) throw new Error(result.error.message || "The password could not be updated.");
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "The password could not be updated. The reset link may have expired — request a new one.");
    } finally { setBusy(false); }
  }

  if (done) return <div style={{display:"grid",gap:14}}>
    <p role="status" style={{color:"#dfe5ee",margin:0,lineHeight:1.6}}>Your password has been updated.</p>
    <Link href="/auth/sign-in" className="auth-submit" style={{textAlign:"center",textDecoration:"none"}}>Sign in with your new password</Link>
  </div>;

  if (!token || linkError) return <div style={{display:"grid",gap:14}}>
    <p role="alert" style={{color:"#ff7b91",margin:0,lineHeight:1.6}}>This reset link is invalid or has expired.</p>
    <Link href="/auth/forgot-password" className="auth-submit" style={{textAlign:"center",textDecoration:"none"}}>Request a new reset link</Link>
  </div>;

  return <form onSubmit={submit} style={{display:"grid",gap:14}}>
    <label htmlFor="reset-password">New password<input id="reset-password" name="password" autoComplete="new-password" required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="New password" /></label>
    <label htmlFor="reset-confirm">Type it again<input id="reset-confirm" name="confirm" autoComplete="new-password" required minLength={8} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat new password" /></label>
    <p style={{color:"#7f8797",fontSize:12,margin:"-6px 0 0"}}>Use at least 8 characters.</p>
    {error && <p role="alert" style={{color:"#ff7b91",margin:0}}>{error}</p>}
    <button className="auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : "Set new password"}</button>
  </form>;
}

export default function ResetPasswordPage() {
  return <main className="auth-page" style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#05060a",color:"white",padding:24}}>
    <section style={{width:"min(440px,100%)",border:"1px solid #262b3b",borderRadius:20,padding:32,background:"#0b0d14"}}>
      <div style={{fontWeight:800,fontSize:22,marginBottom:6}}>Welcome to TTCGameLab</div>
      <p style={{color:"#9aa3b5",marginTop:0}}>Set a new password</p>
      <Suspense fallback={<p style={{color:"#9aa3b5"}}>Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
      <p style={{marginTop:16}}><Link href="/auth/sign-in" style={{color:"#9aa3b5",fontSize:13}}>Back to sign in</Link></p>
    </section>
  </main>;
}
