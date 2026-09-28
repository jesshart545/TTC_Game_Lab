"use client";
import { authClient } from "../lib/auth/client";
export default function SignOutButton() {
  return <button type="button" onClick={async()=>{ await authClient.signOut(); window.location.href="/auth/sign-in"; }}>Sign out</button>;
}
