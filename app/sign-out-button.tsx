"use client";

import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth/client";

export default function SignOutButton() {
  const router = useRouter();
  return <button className="sign-out" onClick={async () => {
    await authClient.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }}>Sign out</button>;
}
