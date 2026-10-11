"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';

export default function AdminDashboard(){
 const [admin,setAdmin]=useState<boolean|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let cancelled=false;void (async()=>{
  try{
   const r=await fetch('/api/help',{cache:'no-store'});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||'Could not check admin status.');
   if(!cancelled)setAdmin(!!data.admin);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not check admin status.');}
 })();return()=>{cancelled=true;};},[]);
 return <main className="help-page"><Link href="/">← TTCGameLab</Link><h1>Admin dashboard</h1>
 {error&&<p role="alert">{error}</p>}
 {admin===null&&!error&&<p>Loading…</p>}
 {admin===false&&<p role="alert">Admin access required. Sign in with an admin account to use this dashboard.</p>}
 {admin===true&&<>
  <p role="status">Signed in as admin.</p>
  <section><h2>Manage</h2><ul>
   <li><Link href="/admin/users">Registered users</Link> — every signup email, name, and signup date.</li>
   <li><Link href="/admin/mailbox">Support mailbox</Link> — messages sent to the admin, with review status.</li>
  </ul></section>
 </>}
 </main>;
}
