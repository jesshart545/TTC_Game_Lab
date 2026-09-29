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
async function sourcesFor(category:string) {
  const searchUrl="https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(category)+"&srlimit=8&format=json&origin=*";
  const search=await fetch(searchUrl,{cache:"no-store",headers:{"User-Agent":"TTCGameLab/1.0 trivia sourcing"}}).catch(()=>null);
  if(!search?.ok) return [];
  const payload=await search.json().catch(()=>({})); const hits=Array.isArray(payload?.query?.search)?payload.query.search:[];
  const out:any[]=[];
  for(const hit of hits.slice(0,6)){
    const title=String(hit.title||"").trim(); if(!title) continue;
    const pageUrl="https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=0&redirects=1&titles="+encodeURIComponent(title)+"&format=json&origin=*";
    const page=await fetch(pageUrl,{cache:"no-store",headers:{"User-Agent":"TTCGameLab/1.0 trivia sourcing"}}).catch(()=>null); if(!page?.ok) continue;
    const data=await page.json().catch(()=>({})); const pages=data?.query?.pages||{}; const record=Object.values(pages)[0] as any;
    const text=String(record?.extract||"").replace(/\s+/g," ").trim().slice(0,14000); if(text.length<300) continue;
    out.push({source:"Wikipedia — "+title,sourceUrl:"https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_")),text}); if(out.length>=5) break;
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