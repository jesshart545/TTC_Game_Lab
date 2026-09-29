import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function cleanHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
function extractJson(text: string) {
  const fenced=text.match(/\`\`\`json\s*([\s\S]*?)\`\`\`/i); const raw=fenced?.[1]||text;
  const a=raw.indexOf("["); const b=raw.lastIndexOf("]"); if(a<0||b<a) throw new Error("AI returned invalid trivia JSON.");
  return JSON.parse(raw.slice(a,b+1));
}
const TRUSTED_HOST_HINTS=["britannica.com","history.com","smithsonianmag.com","nasa.gov","nih.gov","noaa.gov","usgs.gov","loc.gov","archives.gov","billboard.com","grammy.com","rollingstone.com","officialcharts.com","oscars.org","variety.com","espn.com","olympics.com","nba.com","nfl.com","mlb.com","fifa.com","ign.com","gamespot.com","vogue.com","apnews.com","reuters.com","bbc.com","theguardian.com","time.com","wired.com","theverge.com"];

function decodeXml(v:string){return v.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim()}
async function fetchSourcePage(url:string){
  try{
    const page=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0 (compatible; TTCGameLab/1.0)","Accept-Language":"en-US,en;q=0.9"},redirect:"follow",signal:AbortSignal.timeout(10000)});
    if(!page.ok) return null; const type=page.headers.get("content-type")||""; if(!type.includes("text/html")) return null;
    const html=await page.text(); const text=cleanHtml(html).slice(0,24000); if(text.length<300) return null;
    const finalUrl=page.url||url; const host=new URL(finalUrl).hostname.replace(/^www\./,"");
    const title=cleanHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").trim();
    return {source:title?host+" — "+title:host,sourceUrl:finalUrl,text};
  }catch{return null}
}
async function sourcesFor(category:string) {
  const out:any[]=[]; const seen=new Set<string>();
  const queries=[category+" trivia facts",category+" questions answers",category+" facts",category+" history"];
  for(const query of queries){
    const rss="https://www.bing.com/search?format=rss&q="+encodeURIComponent(query);
    const res=await fetch(rss,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0","Accept-Language":"en-US,en;q=0.9"}}).catch(()=>null);
    if(!res?.ok) continue; const xml=await res.text();
    const items=Array.from(xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi));
    for(const m of items){
      const url=decodeXml(m[2]); if(seen.has(url)) continue; seen.add(url);
      let host=""; try{host=new URL(url).hostname.replace(/^www\./,"")}catch{continue}
      if(/bing\.com|microsoft\.com/i.test(host)) continue;
      const page=await fetchSourcePage(url);
      if(page){out.push(page); if(out.length>=6) return out}
    }
  }
  if(!out.length){
    for(const domain of TRUSTED_HOST_HINTS.slice(0,12)){
      const rss="https://www.bing.com/search?format=rss&q="+encodeURIComponent("site:"+domain+" "+category);
      const res=await fetch(rss,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"}}).catch(()=>null); if(!res?.ok) continue;
      const xml=await res.text();
      for(const m of xml.matchAll(/<link>(https?:[^<]+)<\/link>/gi)){
        const url=decodeXml(m[1]); if(seen.has(url)) continue; seen.add(url);
        const page=await fetchSourcePage(url); if(page){out.push(page); if(out.length>=4) return out}
      }
    }
  }
  return out;
}
export async function POST(request:Request){
  const body=await request.json().catch(()=>({})); const count=Math.max(1,Math.min(10,Number(body.count)||10));
  const requested=Array.isArray(body.categories)?body.categories.map(String).map((x:string)=>x.trim()).filter(Boolean):[];
  const category=requested.length?requested[Math.floor(Math.random()*requested.length)]:["General Knowledge","Science","History","Music","Movies","Sports","Geography","Technology"][Math.floor(Math.random()*8)];
  const sources=await sourcesFor(category); if(!sources.length) return NextResponse.json({error:"Source discovery returned no usable publisher pages for this category.",stage:"source-discovery",category},{status:422});
  const key=process.env.AGNES_API_KEY; if(!key) return NextResponse.json({error:"AGNES_API_KEY is not configured."},{status:503});
  const prompt=`Create exactly ${count} factual trivia questions in category "${category}" using ONLY the supplied source text. Each answer must appear verbatim in its evidence. Return a JSON array only. Each item: {"question":"...","answer":"...","category":"...","source":"specific human-readable citation","sourceUrl":"exact supplied URL","evidence":"short exact supporting passage"}. The source field MUST identify the publisher plus the specific page/article/list/topic and, when available, year or date (examples: "Billboard — 2005 Year-End Hot 100", "NASA — Apollo 11 Mission Overview", "GRAMMYs — 2024 Album of the Year"). Never return only a bare publisher/hostname. Do not invent or use outside knowledge. SUPPLIED SOURCES: ${JSON.stringify(sources)}`;
  const res=await fetch("https://apihub.agnes-ai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"agnes-2.5-flash",messages:[{role:"system",content:"Build sourced factual trivia from supplied text only. Return JSON only."},{role:"user",content:prompt}],temperature:0.1})});
  const payload=await res.json().catch(()=>({})); if(!res.ok) return NextResponse.json({error:payload?.error?.message||"Trivia generation failed."},{status:res.status});
  try { const parsed=extractJson(String(payload?.choices?.[0]?.message?.content||"")); const valid=parsed.filter((x:any)=>{const src=sources.find((s:any)=>s.sourceUrl===String(x.sourceUrl||"")); const answer=String(x.answer||"").trim(); const evidence=String(x.evidence||"").trim(); return src&&String(x.question||"").trim()&&answer&&evidence&&evidence.toLowerCase().includes(answer.toLowerCase())&&src.text.toLowerCase().includes(evidence.toLowerCase());}).slice(0,count);
    for(const x of valid){ const src=sources.find((s:any)=>s.sourceUrl===String(x.sourceUrl||"")); if(src){ try { const u=new URL(src.sourceUrl); const path=decodeURIComponent(u.pathname).replace(/[-_]+/g," ").replace(/\/+$/,"").split("/").filter(Boolean).slice(-2).join(" — "); const publisher=String(src.source||u.hostname).replace(/^www\./,""); if(!String(x.source||"").trim() || String(x.source).trim()===publisher) x.source=path?`${publisher} — ${path}`:publisher; } catch {} } }
    if(!valid.length) return NextResponse.json({error:"Publisher pages were found, but the generated questions did not match their supporting text.",stage:"question-verification",category,sourceCount:sources.length},{status:422});
    return NextResponse.json({questions:valid});
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Trivia verification failed."},{status:422});}
}