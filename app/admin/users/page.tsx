"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';

type SiteUser={id:string;email:string;name:string|null;createdAt:string|null};

export default function AdminUsersPage(){
 const [users,setUsers]=useState<SiteUser[]|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let cancelled=false;void (async()=>{
  try{
   const r=await fetch('/api/admin/users',{cache:'no-store'});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||'User list could not be loaded.');
   if(!cancelled)setUsers(data.users||[]);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'User list could not be loaded.');}
 })();return()=>{cancelled=true;};},[]);
 return <main className="help-page"><Link href="/">← TTCGameLab</Link><h1>Registered users</h1><p>Admin only. Everyone who has signed up for the site.</p>
 {error&&<p role="alert">{error}</p>}
 {users===null&&!error&&<p>Loading…</p>}
 {users!==null&&<>
  <p><strong>{users.length}</strong> {users.length===1?'account':'accounts'}</p>
  {!users.length?<p>No accounts yet.</p>:<table><thead><tr><th>Email</th><th>Name</th><th>Signed up</th></tr></thead><tbody>
   {users.map(u=><tr key={u.id}><td>{u.email||'—'}</td><td>{u.name||'—'}</td><td>{u.createdAt?new Date(u.createdAt).toLocaleDateString():'—'}</td></tr>)}
  </tbody></table>}
 </>}
 </main>;
}
