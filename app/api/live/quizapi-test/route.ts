import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const key = process.env.QUIZAPI_KEY;
  if (!key) return NextResponse.json({ ok:false, error:"QUIZAPI_KEY is not configured." }, {status:500});

  const requested = request.nextUrl.searchParams.get("category")?.trim();
  const limit = Math.max(1, Math.min(20, Number(request.nextUrl.searchParams.get("limit") || 10)));
  const url = new URL("https://quizapi.io/api/v1/questions");
  url.searchParams.set("limit", String(limit));
  if (requested) url.searchParams.set("category", requested);

  try {
    const response = await fetch(url, {
      cache:"no-store",
      headers:{ Authorization:`Bearer ${key}`, Accept:"application/json" },
      signal:AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let payload:any;
    try { payload=JSON.parse(text); } catch { payload=text.slice(0,500); }
    if(!response.ok) return NextResponse.json({ok:false, upstreamStatus:response.status, requestedCategory:requested||null, response:payload},{status:502});
    const questions=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:[];
    return NextResponse.json({
      ok:true, requestedCategory:requested||null, count:questions.length,
      questions:questions.map((q:any)=>({
        id:q.id, question:q.text??q.question, type:q.type, answers:q.answers,
        category:q.category, difficulty:q.difficulty, tags:q.tags,
        quizTitle:q.quizTitle, explanation:q.explanation
      }))
    });
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"QuizAPI test failed."},{status:500});
  }
}
