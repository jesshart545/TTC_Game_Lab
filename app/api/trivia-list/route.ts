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
const SOURCE_POLICIES = [
  { test:/science|space|astronomy|physics|biology|medicine|health|environment|weather|geology/i, domains:["nasa.gov","nih.gov","noaa.gov","usgs.gov","si.edu","nature.com","science.org"] },
  { test:/history|president|war|government|politic|law/i, domains:["loc.gov","archives.gov","nps.gov","si.edu","congress.gov"] },
  { test:/music|song|artist|album|hip.?hop|rap|country|rock|pop/i, domains:["billboard.com","grammy.com","rollingstone.com","pitchfork.com","officialcharts.com"] },
  { test:/movie|film|tv|television|actor|actress|celebrity|reality/i, domains:["oscars.org","variety.com","hollywoodreporter.com","deadline.com","ew.com"] },
  { test:/sport|football|basketball|baseball|soccer|olympic|tennis|golf/i, domains:["espn.com","olympics.com","nba.com","nfl.com","mlb.com","fifa.com","atptour.com","wtatennis.com"] },
  { test:/game|gaming|video game|playstation|xbox|nintendo/i, domains:["ign.com","gamespot.com","polygon.com","nintendo.com","playstation.com","xbox.com"] },
  { test:/fashion|style|beauty/i, domains:["vogue.com","elle.com","wwd.com","businessoffashion.com"] },
  { test:/internet|viral|social media|tiktok|youtube|trend|meme|culture/i, domains:["apnews.com","reuters.com","nytimes.com","washingtonpost.com","theguardian.com","time.com","wired.com","theverge.com"] },
];
const FALLBACK_DOMAINS=["apnews.com","reuters.com","britannica.com","si.edu","time.com","bbc.com","theguardian.com"];

function domainsFor(category:string){
  const matched=SOURCE_POLICIES.filter(p=>p.test.test(category)).flatMap(p=>p.domains);
  return [...new Set([...matched,...FALLBACK_DOMAINS])].slice(0,12);
}
async function sourcesFor(category:string) {
  const out:any[]=[]; const seen=new Set<string>();
  for(const domain of domainsFor(category)){
    const searchUrl="https://www.google.com/search?q="+encodeURIComponent("site:"+domain+" "+category)+"&num=5";
    const search=await fetch(searchUrl,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0 (compatible; TTCGameLab/1.0)"}}).catch(()=>null);
    if(!search?.ok) continue; const html=await search.text();
    const candidates = Array.from(html.matchAll(new RegExp("https?://[^\\\"&<> ]+", "g"))).map(m => m[0]);
    for(const raw of candidates){
      let url=raw; try { const parsed=new URL(url); if(!parsed.hostname.endsWith(domain)||seen.has(url)) continue; } catch { continue; }
      seen.add(url); const page=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0 (compatible; TTCGameLab/1.0)"},signal:AbortSignal.timeout(8000)}).catch(()=>null);
      if(!page?.ok || !(page.headers.get("content-type")||"").includes("text/html")) continue;
      const text=cleanHtml(await page.text()).slice(0,14000); if(text.length<400) continue;
      out.push({source:new URL(url).hostname.replace(/^www\\./,""),sourceUrl:url,text}); if(out.length>=5) return out;
    }
  }
  return out;
}
export async function POST(request:Request){
  const body=await request.json().catch(()=>({})); const count=Math.max(1,Math.min(10,Number(body.count)||10));
  const requested=Array.isArray(body.categories)?body.categories.map(String).map((x:string)=>x.trim()).filter(Boolean):[];
  const category=requested.length?requested[Math.floor(Math.random()*requested.length)]:["General Knowledge","Science","History","Music","Movies","Sports","Geography","Technology"][Math.floor(Math.random()*8)];
  const sources=await sourcesFor(category); if(!sources.length) return NextResponse.json({error:"No verifiable source pages were available for this batch. Please try again."},{status:422});
  const key=process.env.AGNES_API_KEY; if(!key) return NextResponse.json({error:"AGNES_API_KEY is not configured."},{status:503});
  const prompt=`Create exactly ${count} factual trivia questions in category "${category}" using ONLY the supplied source text. Each answer must appear verbatim in its evidence. Return a JSON array only. Each item: {"question":"...","answer":"...","category":"...","source":"hostname","sourceUrl":"exact supplied URL","evidence":"short exact supporting passage"}. Do not invent or use outside knowledge. SUPPLIED SOURCES: ${JSON.stringify(sources)}`;
  const res=await fetch("https://apihub.agnes-ai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.AGNES_MODEL||"agnes-2.5-flash",messages:[{role:"system",content:"Build sourced factual trivia from supplied text only. Return JSON only."},{role:"user",content:prompt}],temperature:0.1})});
  const payload=await res.json().catch(()=>({})); if(!res.ok) return NextResponse.json({error:payload?.error?.message||"Trivia generation failed."},{status:res.status});
  try { const parsed=extractJson(String(payload?.choices?.[0]?.message?.content||"")); const valid=parsed.filter((x:any)=>{const src=sources.find((s:any)=>s.sourceUrl===String(x.sourceUrl||"")); const answer=String(x.answer||"").trim(); const evidence=String(x.evidence||"").trim(); return src&&String(x.question||"").trim()&&answer&&evidence&&evidence.toLowerCase().includes(answer.toLowerCase())&&src.text.toLowerCase().includes(evidence.toLowerCase());}).slice(0,count);
    if(!valid.length) return NextResponse.json({error:"The generated questions did not pass source verification. Please try again."},{status:422});
    return NextResponse.json({questions:valid});
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Trivia verification failed."},{status:422});}
}