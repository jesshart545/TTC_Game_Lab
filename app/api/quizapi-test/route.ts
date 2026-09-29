import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.QUIZAPI_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "QUIZAPI_KEY is not configured." }, { status: 500 });
  }

  try {
    const url = new URL("https://quizapi.io/api/v1/questions");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "X-Api-Key": key,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        upstreamStatus: response.status,
        error: "QuizAPI request failed.",
        response: data,
      }, { status: 502 });
    }

    const questions = Array.isArray(data) ? data : [];
    return NextResponse.json({
      ok: true,
      count: questions.length,
      questions: questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        description: q.description,
        answers: q.answers,
        multipleCorrectAnswers: q.multiple_correct_answers,
        correctAnswers: q.correct_answers,
        category: q.category,
        difficulty: q.difficulty,
        tags: q.tags,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "QuizAPI test failed.",
    }, { status: 500 });
  }
}
