import { NextResponse } from "next/server";
import { requireCreator } from "../../../lib/auth/server";
import { triviaHistory, repeatedTrivia, type TriviaIdentity } from "../../../lib/trivia-history";
import { randomInt } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_CATEGORIES=["General Knowledge","Science","History","Music","Geography","Movies","Sports","Arts & Culture"];
const PROGRAMMING_TERMS=/\b(programming|coding|software development|developer|devops|docker|kubernetes|javascript|typescript|python|java|php|ruby|golang|rust|sql|html|css|react|next\.?js|node\.?js|git|github|api|database|linux|command line|algorithm|data structure)\b|c\+\+|c#/i;

function normalize(v:string){return v.toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[^a-z0-9]+/g," ").trim()}
function directAnswer(q:any){
  const answers=Array.isArray(q?.answers)?q.answers:[];
  return answers.find((a:any)=>a?.isCorrect)?.text?.trim()||"";
}
function acceptable(q:any){
  const question=String(q?.text??q?.question??"").trim();
  const answer=directAnswer(q);
  if(!question||!answer||question.length<12||answer.length<1) return false;
  if(PROGRAMMING_TERMS.test(question+" "+answer+" "+String(q?.category||"")+" "+JSON.stringify(q?.tags||[]))) return false;
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
async function verifyCandidate(candidate:any, deadline:number){
  const question=String(candidate?.text??candidate?.question??"").trim();
  const answer=directAnswer(candidate);
  if(!acceptable(candidate)) return null;
  const words=normalize(question).split(" ").filter(x=>x.length>3 && !["what","which","when","where","does","that","this","with","were","from"].includes(x));
  let pending:any=null;
  for(const query of [`"${question}" "${answer}"`,`${question} ${answer}`,`"${answer}" ${words.slice(0,6).join(" ")}`]){
    if(Date.now()>deadline) break;
    const r=await fetch("https://www.bing.com/search?format=rss&q="+encodeURIComponent(query),{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(7000)}).catch(()=>null);
    if(!r?.ok) continue;
    const xml=await r.text();
    for(const m of xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi)){
      const clean=(v:string)=>v.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").replace(/<[^>]+>/g," ").trim();
      const title=clean(m[1]),url=clean(m[2]),desc=clean(m[3]);
      let host="";try{const parsed=new URL(url);host=parsed.hostname.replace(/^www\./,"");if(parsed.protocol!=="https:" || !/^[a-z][a-z0-9.-]+\.[a-z]{2,}$/i.test(host))continue}catch{continue}
      if(/(^|\.)(bing\.com|microsoft\.com|wikipedia\.org|localhost)$/i.test(host))continue;
      const hay=normalize(title+" "+desc);
      if(!hay.includes(normalize(answer)))continue;
      const result={question,answer,category:String(candidate.category||"Trivia"),source:host+" — "+title,sourceUrl:url,evidence:desc,verificationStatus:"needs-review"};
      pending=pending || result;
      if(Date.now()>deadline)break;
      // Fetch the actual public source page; snippets alone never count as verified.
      const page=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)}).catch(()=>null);
      if(!page?.ok || !page.headers.get("content-type")?.includes("text/html"))continue;
      const html=(await page.text()).slice(0,1000000);
      const text=normalize(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," "));
      const at=text.indexOf(normalize(answer));if(at<0)continue;
      const context=text.slice(Math.max(0,at-600),at+600);
      const matched=words.filter(word=>context.includes(word)).length;
      if(words.length>=2 && matched>=Math.max(2,Math.ceil(words.length*.6)))return {...result,evidence:context,verificationStatus:"verified"};
    }
  }
  return pending;
}
async function generatedFallback(category:string,count:number,excluded:TriviaIdentity[]){
  const key=process.env.AGNES_API_KEY;
  if(!key) return [];
  const prompt=`Generate ${Math.min(20,count*2)} conventional, established trivia candidates for category "${category}". Questions must be objective, self-contained, uniquely answerable, notable/recognizable knowledge a knowledgeable player could plausibly know without reading a specific article. Do not use opinions, article-specific details, ordinary regular-season game scores, vague references, or ambiguous superlatives. Use a variety of subtopics within the requested category. Do not repeat or reword any of these previously offered questions: ${JSON.stringify(excluded.slice(-120).map(x=>x.question))}. Return JSON array only: [{"question":"...","answer":"...","category":"${category}"}].`;
  const r=await fetch("https://apihub.agnes-ai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"agnes-2.5-flash",messages:[{role:"system",content:"Generate established trivia candidates, not news extraction. JSON only."},{role:"user",content:prompt}],temperature:0.7}),signal:AbortSignal.timeout(20000)}).catch(()=>null);
  if(!r?.ok) return [];
  const p=await r.json().catch(()=>({}));
  const raw=String(p?.choices?.[0]?.message?.content||"");
  const a=raw.indexOf("["); const b=raw.lastIndexOf("]"); if(a<0||b<a) return [];
  try{return JSON.parse(raw.slice(a,b+1)).map((x:any)=>({text:x.question,answers:[{text:x.answer,isCorrect:true}],category:x.category||category}))}catch{return []}
}
export async function POST(request:Request){
  const user=await requireCreator();
  if(!user)return NextResponse.json({error:"Sign in to generate trivia."},{status:401});
  let saved:Awaited<ReturnType<typeof triviaHistory>>;
  try{saved=await triviaHistory(user.id)}catch{return NextResponse.json({error:"Trivia history is unavailable. Please try again shortly."},{status:503})}
  const body=await request.json().catch(()=>({}));
  const count=Math.max(1,Math.min(10,Math.floor(Number(body.count)||10)));
  const requested=Array.isArray(body.categories)?body.categories.map(String).map((x:string)=>x.trim()).filter(Boolean):[];
  const categories=requested.filter((x:string)=>!PROGRAMMING_TERMS.test(x));
  const pool=categories.length?categories:DEFAULT_CATEGORIES;
  const accepted:any[]=[],manual:any[]=[];
  const seen=new Set<string>((Array.isArray(body.exclude)?body.exclude:[]).map((x:any)=>normalize(String(x))));
  const history=[...saved.history,...(Array.isArray(body.exclude)?body.exclude:[]).map((x:any)=>typeof x==="string"?{question:x}:{question:String(x?.question||x?.prompt||""),answer:String(x?.answer||"")})];
  const categoryOffset=randomInt(pool.length);
  const deadline=Date.now()+180000;
  async function process(candidates:any[]){
    for(let offset=0;offset<candidates.length && accepted.length<count && Date.now()<deadline;offset+=4){
      const batch=candidates.slice(offset,offset+4).filter(candidate=>{
        const key=normalize(String(candidate?.text??candidate?.question??""));
        if(!key || seen.has(key) || !acceptable(candidate) || repeatedTrivia({question:String(candidate.text??candidate.question??""),answer:directAnswer(candidate)},history))return false;
        seen.add(key);history.push({question:String(candidate.text??candidate.question),answer:directAnswer(candidate)});return true;
      });
      const results=await Promise.all(batch.map(candidate=>verifyCandidate(candidate,deadline)));
      for(const result of results){if(!result)continue;if(result.verificationStatus==="verified"){if(accepted.length<count)accepted.push(result)}else manual.push(result)}
    }
  }
  for(let round=0;round<3 && accepted.length<count && Date.now()<deadline;round++){
    const category=pool[(categoryOffset+Math.max(0,Number(body.attempt)||0)+round)%pool.length];
    await process(await quizApi(category,count-accepted.length));
    if(accepted.length<count && Date.now()<deadline)await process(await generatedFallback(category,count-accepted.length,history));
  }
  // Pending source-backed candidates are separate. The client retries for verified
  // replacements before including any of them as clearly marked review items.
  const fresh:any[]=[],review:any[]=[];
  try{for(const q of accepted){if(await saved.claim(q))fresh.push(q)}for(const q of manual.slice(0,count)){if(await saved.claim(q))review.push(q)}}catch{return NextResponse.json({error:"Could not save trivia history. Please try again."},{status:503})}
  return NextResponse.json({questions:fresh,manualCandidates:review,requested:count,verified:fresh.length,shortfall:Math.max(0,count-fresh.length)});
}

