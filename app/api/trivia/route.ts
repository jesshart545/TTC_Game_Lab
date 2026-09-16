import { NextResponse } from "next/server";

const DEFAULT_CATEGORIES = ["Science", "History", "Pop Culture", "Gaming", "Space"];

type Question = { value:number; prompt:string; answer:string; source?:string; sourceUrl?:string };
type Category = { name:string; questions:Question[] };

function jsonError(message:string,status=500){ return NextResponse.json({error:message},{status}); }

function extractJson(text:string){
  const fenced = text.match(/\`\`\`json\s*([\s\S]*?)\`\`\`/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if(start < 0 || end < 0) throw new Error("AI returned invalid trivia JSON.");
  return JSON.parse(raw.slice(start,end+1));
}

async function sourceContext(topic:string){
  const url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(topic)+"&srlimit=4&format=json&origin=*";
  const res = await fetch(url,{cache:"no-store",headers:{"User-Agent":"TTCGameLab/1.0"}});
  if(!res.ok) return [];
  const data = await res.json().catch(()=>({}));
  return Array.isArray(data?.query?.search) ? data.query.search.map((x:any)=>({
    title:String(x.title || ""),
    snippet:String(x.snippet || "").replace(/<[^>]+>/g,""),
    url:"https://en.wikipedia.org/wiki/"+encodeURIComponent(String(x.title || "").replace(/ /g,"_"))
  })) : [];
}

export async function POST(request:Request){
  const body = await request.json().catch(()=>({}));
  const mode = body?.mode === "source" ? "source" : "generate";
  const seedTopics = Array.isArray(body?.categories) ? body.categories.map(String).filter(Boolean).slice(0,5) : [];
  const categories = seedTopics.length === 5 ? seedTopics : DEFAULT_CATEGORIES;
  const regenerateCategory = typeof body?.category === "string" ? body.category : "";
  const key = process.env.AGNES_API_KEY;
  if(!key) return jsonError("AGNES_API_KEY is not configured in Vercel.",503);

  const targets = regenerateCategory ? categories.map((name:string)=>name===regenerateCategory?name:"").filter(Boolean) : categories;
  const built:Category[] = [];

  for(const topic of targets){
    const context = mode === "source" ? await sourceContext(topic) : [];
    const prompt = `
Create a Jeopardy-style trivia category for TTCGameLab.
Category: ${topic}
Return EXACTLY 5 questions worth 100, 200, 300, 400, 500 points, increasing in difficulty.
Questions must be factually correct, clear, answerable, and directly related to the category.
Do not repeat common examples.
Return JSON only:
{"category":{"name":"${topic}","questions":[{"value":100,"prompt":"...","answer":"..."},{"value":200,"prompt":"...","answer":"..."},{"value":300,"prompt":"...","answer":"..."},{"value":400,"prompt":"...","answer":"..."},{"value":500,"prompt":"...","answer":"..."}]}}
${mode === "source" ? "Ground the questions in these reference snippets and include source/sourceUrl on each question. Reference material:\\n"+JSON.stringify(context) : "Use your general knowledge and do not invent uncertain facts."}
`;

    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions",{
      method:"POST",
      headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.AGNES_MODEL || "agnes-2.5-flash",
        messages:[{role:"system",content:"You generate accurate structured trivia. Output JSON only."},{role:"user",content:prompt}],
        temperature:0.35
      })
    });
    const payload = await response.json().catch(()=>({}));
    if(!response.ok) return jsonError(payload?.error?.message || "Agnes trivia generation failed.",response.status);
    try{
      const parsed = extractJson(String(payload?.choices?.[0]?.message?.content || ""));
      const cat = parsed.category;
      if(cat?.name && Array.isArray(cat.questions)) built.push({
        name:String(cat.name),
        questions:cat.questions.slice(0,5).map((q:any)=>({
          value:Number(q.value),
          prompt:String(q.prompt),
          answer:String(q.answer),
          ...(mode==="source" ? {source:String(q.source || "Wikipedia"),sourceUrl:String(q.sourceUrl || "")} : {})
        }))
      });
    }catch{}
  }

  if(regenerateCategory) return NextResponse.json({mode,categories:built});
  return NextResponse.json({mode,categories:built});
}
