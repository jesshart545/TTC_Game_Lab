"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SiteSupportChat from "./SiteSupportChat";

export default function HelpLink() {
  const path = usePathname();
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => { setEmbedded(window.self !== window.top); }, []);
  // Jessica's placement rule: no Ask Jewel bubble on the pre-sign-in landing
  // screen or the signed-in home screen — both are served at "/".
  if (embedded || path === "/" || path === "/overlay" || path.endsWith("/overlay")) return null;
  return <SiteSupportChat path={path}/>;
}
