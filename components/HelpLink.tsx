"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SiteSupportChat from "./SiteSupportChat";

export default function HelpLink() {
  const path = usePathname();
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => { setEmbedded(window.self !== window.top); }, []);
  if (embedded || path === "/overlay" || path.endsWith("/overlay")) return null;
  return <SiteSupportChat path={path}/>;
}
