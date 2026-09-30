"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import styles from "./HelpContact.module.css";

export default function HelpContact() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email,setEmail] = useState("");
  const [admin,setAdmin] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [receipt,setReceipt] = useState("");
  const [page,setPage] = useState("");
  async function open() {
    setPage(window.location.origin + window.location.pathname);
    dialog.current?.showModal();
    try {
      const response = await fetch("/api/support", { cache:"no-store" });
      if (response.ok) { const data=await response.json(); setEmail(current=>current || data.email || ""); setAdmin(data.admin===true); }
    } catch {}
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/support", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email,category:values.get("category"),subject:values.get("subject"),message:values.get("message"),website:values.get("website"),page })
      });
      const data=await response.json();
      if (!response.ok || !data.saved) throw new Error(data.error || "Could not send your message.");
      setReceipt(data.id);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send your message."); }
    finally { setBusy(false); }
  }
  return <>
    <button className={styles.launcher} onClick={()=>void open()} aria-haspopup="dialog">? Help / Contact Admin</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="contact-heading" onCancel={event=>{if(busy)event.preventDefault();}}>
      <div className={styles.head}><h2 id="contact-heading">Help / Contact Admin</h2><button type="button" disabled={busy} onClick={()=>dialog.current?.close()} aria-label="Close contact form">×</button></div>
      <p>Report a concern or site issue, or share a recommendation.</p>
      {receipt ? <div role="status"><h3>Message received</h3><p>Your message is saved in the private admin inbox. The admin can reply to your email.</p><small>Reference: {receipt}</small><button className={styles.submit} onClick={()=>{setReceipt("");dialog.current?.close();}}>Done</button></div> : <form onSubmit={event=>void send(event)}>
        <label>What is this about?<select name="category" required><option value="site issue">Site issue</option><option value="concern">Concern</option><option value="recommendation">Recommendation</option></select></label>
        <label>Your email<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254}/></label>
        <label>Subject<input name="subject" required minLength={3} maxLength={120}/></label>
        <label>Message<textarea name="message" required minLength={10} maxLength={5000} rows={5} placeholder="Tell us what happened or what you would like improved."/></label>
        <div className={styles.trap} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
        <small className={styles.page}>Page included: {page}</small>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <button type="submit" className={styles.submit} disabled={busy}>{busy ? "Sending…" : "Send to admin"}</button>
      </form>}
      <div className={styles.links}><Link href="/tutorial" onClick={()=>dialog.current?.close()}>How to use the site</Link>{admin ? <Link href="/admin/support" onClick={()=>dialog.current?.close()}>Admin inbox</Link> : null}</div>
    </dialog>
  </>;
}
