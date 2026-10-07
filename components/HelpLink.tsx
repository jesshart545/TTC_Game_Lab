"use client";
import {usePathname} from 'next/navigation';
export default function HelpLink(){const path=usePathname();if(path==='/overlay'||path.endsWith('/overlay')||path==='/help')return null;return <a className="site-help-link" href={`https://www.ttcgamelab.com/help?from=${encodeURIComponent(path)}`}>Help &amp; contact</a>;}
