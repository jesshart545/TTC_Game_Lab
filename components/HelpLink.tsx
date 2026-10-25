"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SiteSupportChat from "./SiteSupportChat";

export default function HelpLink() {
  const path = usePathname();
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => { setEmbedded(window.self !== window.top); }, []);
  // Jessica's placement rule: no Ask Jewel bubble anywhere before sign-in —
  // the landing screen ("/") or any auth screen ("/auth/…": sign-in, sign-up,
  // password reset, verification) — nor on the signed-in home screen ("/").
  if (embedded || path === "/" || path.startsWith("/auth/") || path === "/overlay" || path.endsWith("/overlay")) return null;
  return <SiteSupportChat path={path}/>;
}
