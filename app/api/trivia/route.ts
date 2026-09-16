import { NextResponse } from "next/server";

const DEFAULT_CATEGORIES = ["Science", "History", "Pop Culture", "Gaming", "Space"];

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function extractJson(text: string) {
  const fenced = text.match(/\`\`\`json\s*([\s\S]*?)\`\`\`/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("AI returned invalid trivia JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

async function sourceContext(topic: string) {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
    encodeURIComponent(topic) +
    "&srlimit=6&format=json&origin=*";
  const searchRes = await fetch(searchUrl, {
    cache: "no-store",
    headers: { "User-Agent": "TTCGameLab/1.0 (trivia source retrieval)" },
  });
  if (!searchRes.ok) return [];

  const searchData = await searchRes.json().catch(() => ({}));
  const titles = Array.isArray(searchData?.query?.search)
    ? searchData.query.search
        .map((x: any) => String(x.title || ""))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  if (!titles.length) return [];

  const extractUrl =
    "https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&explaintext=1&exintro=1&inprop=url&redirects=1&format=json&origin=*&titles=" +
    encodeURIComponent(titles.join("|"));

  const extractRes = await fetch(extractUrl, {
    cache: "no-store",
    headers: { "User-Agent": "TTCGameLab/1.0 (trivia source retrieval)" },
  });
  if (!extractRes.ok) return [];

  const extractData = await extractRes.json().catch(() => ({}));
  const pages = extractData?.query?.pages || {};

  return Object.values(pages)
    .map((x: any) => ({
      title: String(x.title || ""),
      extract: String(x.extract || "").slice(0, 5000),
      url: String(x.fullurl || ""),
    }))
    .filter((x: any) => x.title && x.extract && x.url);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const seedTopics = Array.isArray(body?.categories)
    ? body.categories.map(String).filter(Boolean).slice(0, 5)
    : [];
  const categories = seedTopics.length === 5 ? seedTopics : DEFAULT_CATEGORIES;
  const regenerateCategory =
    typeof body?.category === "string" ? body.category : "";

  const key = process.env.AGNES_API_KEY;
  if (!key) return jsonError("AGNES_API_KEY is not configured in Vercel.", 503);

  const targets = regenerateCategory
    ? categories.filter((name: string) => name === regenerateCategory)
    : categories;

  const built: any[] = [];

  for (const topic of targets) {
    const context = await sourceContext(topic);
    if (!context.length) {
      return jsonError(
        "No source material was found for " + topic + ". Trivia was not generated.",
        422,
      );
    }

    const prompt = `
Create a Jeopardy-style trivia category for TTCGameLab using ONLY the supplied source material.

Category: ${topic}

Return EXACTLY 5 questions worth 100, 200, 300, 400, 500 points, increasing in difficulty.

Strict rules:
- Every question MUST be answerable directly from the supplied sources.
- DO NOT use outside knowledge.
- DO NOT invent facts, dates, names, numbers, or answers.
- The answer must be an exact fact or short phrase supported by the evidence.
- Include the source title, source URL, and the exact evidence passage used.

Return JSON only:
{"category":{"name":"${topic}","questions":[
{"value":100,"prompt":"...","answer":"...","source":"...","sourceUrl":"...","evidence":"..."},
{"value":200,"prompt":"...","answer":"...","source":"...","sourceUrl":"...","evidence":"..."},
{"value":300,"prompt":"...","answer":"...","source":"...","sourceUrl":"...","evidence":"..."},
{"value":400,"prompt":"...","answer":"...","source":"...","sourceUrl":"...","evidence":"..."},
{"value":500,"prompt":"...","answer":"...","source":"...","sourceUrl":"...","evidence":"..."}
]}}

SUPPLIED SOURCES:
${JSON.stringify(context)}
`;

    const response = await fetch(
      "https://apihub.agnes-ai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AGNES_MODEL || "agnes-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You transform supplied source text into factual trivia. Never invent facts. Return JSON only.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return jsonError(
        payload?.error?.message || "Agnes trivia generation failed.",
        response.status,
      );
    }

    try {
      const parsed = extractJson(
        String(payload?.choices?.[0]?.message?.content || ""),
      );
      const cat = parsed.category;
      if (!cat?.name || !Array.isArray(cat.questions)) continue;

      const questions = cat.questions.slice(0, 5).filter((q: any) => {
        const answer = String(q.answer || "").trim().toLowerCase();
        const evidence = String(q.evidence || "").trim().toLowerCase();
        const sourceUrl = String(q.sourceUrl || "").trim();
        return (
          Number.isFinite(Number(q.value)) &&
          String(q.prompt || "").trim() &&
          answer &&
          evidence &&
          sourceUrl &&
          evidence.includes(answer)
        );
      });

      if (questions.length !== 5) continue;

      built.push({
        name: String(cat.name),
        questions: questions.map((q: any) => ({
          value: Number(q.value),
          prompt: String(q.prompt),
          answer: String(q.answer),
          source: String(q.source || "Wikipedia"),
          sourceUrl: String(q.sourceUrl),
          evidence: String(q.evidence),
        })),
      });
    } catch {
      // Reject malformed AI output rather than returning unsourced trivia.
    }
  }

  if (regenerateCategory && built.length !== 1) {
    return jsonError(
      "The requested category could not be generated from verified source material.",
      422,
    );
  }

  if (!regenerateCategory && built.length !== categories.length) {
    return jsonError(
      "One or more categories could not be generated from verified source material. No partial trivia board was saved.",
      422,
    );
  }

  return NextResponse.json({ mode: "source", categories: built });
}
