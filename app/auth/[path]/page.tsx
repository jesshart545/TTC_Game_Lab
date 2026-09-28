"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../../lib/auth/client";

export default function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
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

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#05060a",color:"white",padding:24}}>
    <section style={{width:"min(440px,100%)",border:"1px solid #262b3b",borderRadius:20,padding:32,background:"#0b0d14"}}>
      <div style={{fontWeight:800,fontSize:22,marginBottom:6}}>TTCGameLab</div>
      <p style={{color:"#9aa3b5",marginTop:0}}>Private creator workspace</p>
      <div style={{display:"flex",gap:8,margin:"24px 0"}}>
        <button onClick={()=>setMode("sign-in")} type="button">Sign in</button>
        <button onClick={()=>setMode("sign-up")} type="button">Create account</button>
      </div>
      <form onSubmit={submit} style={{display:"grid",gap:14}}>
        {mode === "sign-up" && <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Display name" />}
        <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        {error && <p style={{color:"#ff7b91",margin:0}}>{error}</p>}
        <button disabled={busy} type="submit">{busy ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}</button>
      </form>
      <p style={{color:"#7f8797",fontSize:13,marginTop:20}}>Your projects and assets belong to your account.</p>
      <Link href="/tutorial" style={{color:"#9aa3b5",fontSize:13}}>How TTCGameLab works</Link>
    </section>
  </main>;
}
