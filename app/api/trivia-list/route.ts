import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_CATEGORIES=["General Knowledge","Science","History","Music","Geography","Movies","Sports","Arts & Culture"];\nconst PROGRAMMING_TERMS=/\\b(programming|coding|software development|developer|devops|docker|kubernetes|javascript|typescript|python|java|c\\+\\+|c#|php|ruby|golang|rust|sql|html|css|react|next\\.?js|node\\.?js|git|github|api|database|linux|command line|algorithm|data structure)\\b/i;

function normalize(v:string){return v.toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[^a-z0-9]+/g," ").trim()}
function directAnswer(q:any){
  const answers=Array.isArray(q?.answers)?q.answers:[];
  return answers.find((a:any)=>a?.isCorrect)?.text?.trim()||"";
}
function acceptable(q:any){
  const question=String(q?.text??q?.question??"").trim();
  const answer=directAnswer(q);
  if(!question||!answer||question.length<12||answer.length<1) return false;\n  if(PROGRAMMING_TERMS.test(question+" "+answer+" "+String(q?.category||"")+" "+JSON.stringify(q?.tags||[]))) return false;
  if(/^(a|an|the)?\s*(person|man|woman|team|player|staffer|artist|country|city|thing|someone|something)$/i.test(answer)) return false;
  if(/according to|extra attention|controversial|best|greatest|most important|primary cause/i.test(question)) return false;
  if(/what score|final score|defeat(ed)? .* \d|week \d+/i.test(question) && !/super bowl|world series|nba finals|stanley cup|olympic|championship|final\b/i.test(question)) return false;
  return true;
}
async function quizApi(category:string,count:number){
  const key=process.env.QUIZAPI_KEY;
  if(!key) return [];
  const url=new URL("https://quizapi.io/api/v1/questions");
  url.searchParams.set("limit",String(Math.min(20,Math.max(count*2,10))));
  url.searchParams.set("category",category);
  const r=await fetch(url,{cache:"no-store",headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},signal:AbortSignal.timeout(15000)}).catch(()=>null);
  if(!r?.ok) return [];
  const payload=await r.json().catch(()=>[]);
  return Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:[];
}
async function verifyCandidate(candidate:any){
  const question=String(candidate?.text??candidate?.question??"").trim();
  const answer=directAnswer(candidate);
  if(!acceptable(candidate)) return null;
  const query=`"${question}" "${answer}"`;
  const rss="https://www.bing.com/search?format=rss&q="+encodeURIComponent(query);
  const r=await fetch(rss,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0","Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(10000)}).catch(()=>null);
  if(!r?.ok) return null;
  const xml=await r.text();
  const items=Array.from(xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi));
  for(const m of items){
    const title=String(m[1]).replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").replace(/<[^>]+>/g," ").trim();
    const url=String(m[2]).replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").trim();
    const desc=String(m[3]).replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").replace(/<[^>]+>/g," ").trim();
    let host=""; try{host=new URL(url).hostname.replace(/^www\./,"")}catch{continue}
    if(/bing\.com|microsoft\.com|wikipedia\.org/i.test(host)) continue;
    const hay=normalize(title+" "+desc);
    if(!hay.includes(normalize(answer))) continue;
    return {question,answer,category:String(candidate.category||"Trivia"),source:`${host} — ${title}`,sourceUrl:url,evidence:desc};
  }
  return null;
}
async function generatedFallback(category:string,count:number){
  const key=process.env.AGNES_API_KEY;
  if(!key) return [];
  const prompt=`Generate ${Math.min(20,count*2)} conventional, established trivia candidates for category "${category}". Questions must be objective, self-contained, uniquely answerable, notable/recognizable knowledge a knowledgeable player could plausibly know without reading a specific article. Do not use opinions, article-specific details, ordinary regular-season game scores, vague references, or ambiguous superlatives. Return JSON array only: [{"question":"...","answer":"...","category":"${category}"}].`;
  const r=await fetch("https://apihub.agnes-ai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"agnes-2.5-flash",messages:[{role:"system",content:"Generate established trivia candidates, not news extraction. JSON only."},{role:"user",content:prompt}],temperature:0.4})}).catch(()=>null);
  if(!r?.ok) return [];
  const p=await r.json().catch(()=>({}));
  const raw=String(p?.choices?.[0]?.message?.content||"");
  const a=raw.indexOf("["); const b=raw.lastIndexOf("]"); if(a<0||b<a) return [];
  try{return JSON.parse(raw.slice(a,b+1)).map((x:any)=>({text:x.question,answers:[{text:x.answer,isCorrect:true}],category:x.category||category}))}catch{return []}
}
export async function POST(request:Request){
  const body=await request.json().catch(()=>({}));
  const count=Math.max(1,Math.min(10,Number(body.count)||10));
  const requested=Array.isArray(body.categories)?body.categories.map(String).map((x:string)=>x.trim()).filter(Boolean):[];
  const safeRequested=requested.filter((x:string)=>!PROGRAMMING_TERMS.test(x));\n  const category=safeRequested.length?safeRequested[Math.floor(Math.random()*safeRequested.length)]:DEFAULT_CATEGORIES[Math.floor(Math.random()*DEFAULT_CATEGORIES.length)];
  const accepted:any[]=[];
  const seen=new Set<string>();
  async function process(candidates:any[]){
    for(const candidate of candidates){
      if(accepted.length>=count) break;
      const key=normalize(String(candidate?.text??candidate?.question??""));
      if(!key||seen.has(key)) continue; seen.add(key);
      const verified=await verifyCandidate(candidate);
      if(verified) accepted.push(verified);
    }
  }
  await process(await quizApi(category,count));
  if(accepted.length<count) await process(await generatedFallback(category,count-accepted.length));
  if(!accepted.length) return NextResponse.json({error:"No candidate trivia questions passed independent verification.",stage:"candidate-verification",category},{status:422});
  return NextResponse.json({questions:accepted,category,requested:count,verified:accepted.length});
}
